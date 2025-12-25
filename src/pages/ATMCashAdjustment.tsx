import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

/* ================= CONFIG ================= */
const GEO_MODE: "OFF" | "SOFT" = "SOFT";
const GPS_RADIUS_METERS = 100;

/* ================= UTILS ================= */
function toRad(v: number) {
  return (v * Math.PI) / 180;
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function sumDenoms(r: any) {
  return (
    (r?.denom_100 || 0) * 100 +
    (r?.denom_200 || 0) * 200 +
    (r?.denom_500 || 0) * 500 +
    (r?.denom_2000 || 0) * 2000
  );
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
      { enableHighAccuracy: true, timeout: 20000 }
    );
  });
}

/* ================= COMPONENT ================= */
export default function ATMCashAdjustment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const selectedSite = sites.find((s) => s.id === siteId);

  const [denoms, setDenoms] = useState({
    denom_100: 0,
    denom_200: 0,
    denom_500: 0,
    denom_2000: 0,
  });

  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [geoStatus, setGeoStatus] =
    useState<"unknown" | "verified" | "mismatch" | "no_gps">("unknown");
  const [geoMessage, setGeoMessage] = useState<string | null>(null);
  const [geoDistance, setGeoDistance] = useState<number | null>(null);
  const [loadLat, setLoadLat] = useState<number | null>(null);
  const [loadLng, setLoadLng] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* -------- Load assignment & sites -------- */
  useEffect(() => {
    if (!profile) return;

    async function load() {
      const today = new Date().toISOString().slice(0, 10);

      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .single();

      if (!assignment) return;
      setAssignmentId(assignment.id);

      const { data } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address, latitude, longitude)")
        .eq("assignment_id", assignment.id);

      setSites((data || []).map((r: any) => r.site));
    }

    load();
  }, [profile]);

  /* -------- Acquire GPS (EXPLICIT) -------- */
  async function handleAcquireGPS() {
    setGeoStatus("unknown");
    setGeoMessage("Acquiring GPS location…");

    try {
      const gps = await getCurrentLocation();
      setLoadLat(gps.lat);
      setLoadLng(gps.lng);

      if (!selectedSite?.latitude || !selectedSite?.longitude) {
        setGeoStatus("no_gps");
        setGeoMessage("Site GPS not configured.");
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

  /* -------- Save -------- */
  async function handleSave() {
    setError(null);

    const adjustmentAmount = sumDenoms(denoms);
    if (adjustmentAmount <= 0) {
      setError("Enter at least one denomination.");
      return;
    }

    if (!reason.trim()) {
      setError("Reason is mandatory.");
      return;
    }

    if (GEO_MODE === "SOFT" && geoStatus !== "verified" && !photo) {
      setError("GPS mismatch. Please upload ATM photo.");
      return;
    }

    setSaving(true);

    const { error } = await supabase
  .from("atm_cash_adjustments")
  .insert({
    assignment_id: assignmentId,
    site_id: siteId,
    ...denoms,
    reason,
    geo_lat: loadLat,
    geo_lng: loadLng,
    distance_meters: geoDistance,
    photo_url: null, // or actual URL if uploaded
    created_by: profile?.id,
  });


    if (error) {
      setError("Failed to save ATM Cash Adjustment.");
    } else {
      alert("ATM Cash Adjustment saved successfully.");
    }

    setSaving(false);
  }

  /* -------- UI -------- */
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-primary">
          ATM Cash Adjustment
        </h2>

        {geoMessage && (
          <div className="p-2 bg-yellow-100 rounded text-sm">
            {geoMessage}
          </div>
        )}

        <div>
          <label className="text-sm">Select ATM</label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={siteId ?? ""}
            onChange={(e) => setSiteId(Number(e.target.value))}
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
          disabled={!siteId}
          className="px-3 py-2 bg-primary text-white rounded text-sm"
        >
          Acquire GPS Location
        </button>

        {geoStatus === "mismatch" && GEO_MODE === "SOFT" && (
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

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(denoms).map(([k, v]) => (
            <div key={k}>
              <label className="text-sm">₹{k.replace("denom_", "")}</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded px-3 py-2 text-sm"
                value={v}
                onChange={(e) =>
                  setDenoms({ ...denoms, [k]: Number(e.target.value) })
                }
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-sm">Reason</label>
          <textarea
            className="w-full border rounded px-3 py-2 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || (GEO_MODE !== "OFF" && geoStatus === "unknown")}
          className="w-full py-2 bg-indigo-600 text-white rounded text-sm font-semibold"
        >
          {saving ? "Saving…" : "Save Cash Adjustment"}
        </button>
      </div>
    </AppLayout>
  );
}
