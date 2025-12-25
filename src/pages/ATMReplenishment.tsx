import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

const GPS_RADIUS_METERS = 100;

// ---------------- Utilities ----------------
function toISTISOString(date = new Date()) {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;

  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      reject,
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 0,
      }
    );
  });
}

// Image compression (client-side)
async function compressImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");

  const MAX_WIDTH = 1024;
  const scale = Math.min(1, MAX_WIDTH / bitmap.width);

  canvas.width = bitmap.width * scale;
  canvas.height = bitmap.height * scale;

  const ctx = canvas.getContext("2d");
  if (!ctx) return file;

  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) =>
        resolve(
          new File([blob!], file.name, {
            type: "image/jpeg",
          })
        ),
      "image/jpeg",
      0.7
    );
  });
}

// ---------------- Component ----------------
export default function ATMReplenishment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const selectedSite = sites.find((s) => s.id === selectedSiteId);

  const [timeIn] = useState(toISTISOString());
  const [remarks, setRemarks] = useState("");

  const [denoms, setDenoms] = useState({
    denom_100: 0,
    denom_200: 0,
    denom_500: 0,
    denom_2000: 0,
  });

  const [geoStatus, setGeoStatus] =
    useState<"unknown" | "verified" | "mismatch" | "no_gps">("unknown");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoDistance, setGeoDistance] = useState<number | null>(null);

  const [loadLat, setLoadLat] = useState<number | null>(null);
  const [loadLng, setLoadLng] = useState<number | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const geoMode = "SOFT"; // OFF / SOFT

  // ---------------- Load Assignment & Sites ----------------
  useEffect(() => {
    if (!profile) return;

    async function loadData() {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", new Date().toISOString().slice(0, 10))
        .single();

      if (!assignment) return;

      setAssignmentId(assignment.id);

      const { data } = await supabase
        .from("route_sites")
        .select(
          "site:sites(id, bank_name, address, latitude, longitude)"
        )
        .eq("assignment_id", assignment.id);

      setSites((data || []).map((r: any) => r.site));
    }

    loadData();
  }, [profile]);

  // ---------------- Acquire GPS ----------------
  async function handleAcquireGPS() {
    setGeoMessage("Acquiring GPS location…");
    setGeoStatus("unknown");

    try {
      const gps = await getCurrentLocation();
      setLoadLat(gps.lat);
      setLoadLng(gps.lng);

      if (!selectedSite?.latitude || !selectedSite?.longitude) {
        setGeoStatus("no_gps");
        setGeoMessage("Site GPS coordinates not configured.");
        return;
      }

      const distance = calculateDistanceMeters(
        gps.lat,
        gps.lng,
        Number(selectedSite.latitude),
        Number(selectedSite.longitude)
      );

      setGeoDistance(distance);

      if (distance <= GPS_RADIUS_METERS) {
        setGeoStatus("verified");
        setGeoMessage(`GPS verified (${distance.toFixed(1)} m)`);
      } else {
        setGeoStatus("mismatch");
        setGeoMessage(`GPS mismatch (${distance.toFixed(1)} m away)`);
      }
    } catch {
      setGeoStatus("no_gps");
      setGeoMessage("Unable to acquire GPS. Please stand near ATM.");
    }
  }

  // ---------------- Save ----------------
  async function handleSave() {
    setError(null);
    setSaving(true);

    const totalNotes =
      denoms.denom_100 +
      denoms.denom_200 +
      denoms.denom_500 +
      denoms.denom_2000;

    if (totalNotes === 0) {
      setError("At least one denomination must be entered.");
      setSaving(false);
      return;
    }

    if (geoMode === "SOFT" && geoStatus !== "verified" && !photo) {
      setError("GPS validation failed. Please upload ATM photo.");
      setSaving(false);
      return;
    }

    let photoUrl: string | null = null;

    if (photo) {
      const compressed = await compressImage(photo);
      const path = `atm-loads/${assignmentId}-${selectedSiteId}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from("issue-photos")
        .upload(path, compressed, { upsert: true });

      if (uploadError) {
        setError("Photo upload failed.");
        setSaving(false);
        return;
      }

      photoUrl = path;
    }

    const { error } = await supabase.from("atm_replenishments").insert({
      assignment_id: assignmentId,
      site_id: selectedSiteId,
      time_in: new Date(timeIn).toISOString(),
      ...denoms,
      remarks,
      load_lat: loadLat,
      load_lng: loadLng,
      distance_meters: geoDistance,
      geo_status: geoStatus,
      photo_required: geoStatus !== "verified",
      photo_url: photoUrl,
    });

    if (error) {
      setError("Failed to save ATM Replenishment.");
    } else {
      alert("ATM Replenishment saved successfully.");
    }

    setSaving(false);
  }

  // ---------------- UI ----------------
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-primary">
          ATM Replenishment
        </h2>

        {geoMessage && (
          <div className="p-2 bg-yellow-100 text-sm rounded">
            {geoMessage}
          </div>
        )}

        <div>
          <label className="text-sm">Select Site</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={selectedSiteId ?? ""}
            onChange={(e) => setSelectedSiteId(Number(e.target.value))}
          >
            <option value="">-- Select ATM --</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.bank_name} – {s.address}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleAcquireGPS}
          disabled={!selectedSiteId}
          className="px-3 py-1 bg-primary text-white rounded text-sm"
        >
          Acquire GPS Location
        </button>

        {geoMode === "SOFT" && geoStatus !== "verified" && (
          <div>
            <label className="text-sm">ATM Photo (Required)</label>
            <input
              type="file"
              accept="image/*"
              className="w-full text-sm"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
          </div>
        )}

        <div>
          <label className="text-sm">Remarks</label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(denoms).map(([k, v]) => (
            <div key={k}>
              <label className="text-sm">
                ₹{k.replace("denom_", "")}
              </label>
              <input
                type="number"
                min={0}
                className="w-full border rounded px-2 py-1 text-sm"
                value={v}
                onChange={(e) =>
                  setDenoms({ ...denoms, [k]: Number(e.target.value) })
                }
              />
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full py-2 bg-green-600 text-white rounded text-sm"
        >
          {saving ? "Saving…" : "Save ATM Replenishment"}
        </button>
      </div>
    </AppLayout>
  );
}
