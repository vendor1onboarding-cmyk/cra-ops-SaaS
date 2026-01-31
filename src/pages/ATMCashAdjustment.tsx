import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { getISTDateString } from "../utils/time";

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
      const today = getISTDateString();

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
    if (saving) return;
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
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            ATM Cash Adjustment
          </h2>
          <p className="text-sm text-slate-600">
            Record cash adjustments with GPS verification
          </p>
        </div>

        {geoMessage && (
          <div className={`px-4 py-3 rounded-lg border font-medium text-sm ${
            geoStatus === "verified"
              ? "bg-green-50 text-green-800 border-green-200"
              : geoStatus === "no_gps"
              ? "bg-red-50 text-red-800 border-red-200"
              : "bg-yellow-50 text-yellow-800 border-yellow-200"
          }`}>
            {geoStatus === "verified" && "✓ "}
            {geoStatus === "no_gps" && "⚠️ "}
            {geoStatus === "mismatch" && "⚠️ "}
            {geoMessage}
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Select ATM <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
            className="w-full py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            📍 Acquire GPS Location
          </button>
        </div>

        {geoStatus === "mismatch" && GEO_MODE === "SOFT" && (
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ATM Photo <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="photo-input-adj"
                />
                <label htmlFor="photo-input-adj" className="cursor-pointer block">
                  <div className="text-3xl mb-2">📷</div>
                  <p className="text-sm font-medium text-slate-700">
                    {photo ? photo.name : "Click to upload ATM photo"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
                </label>
              </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Denomination Details</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Object.entries(denoms).map(([k, v]) => (
              <div key={k} className="form-group">
                <label className="text-sm font-medium text-slate-700">
                  ₹{k.replace("denom_", "")}
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={v}
                  onChange={(e) =>
                    setDenoms({ ...denoms, [k]: Number(e.target.value) })
                  }
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain the reason for this adjustment..."
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving || (GEO_MODE !== "OFF" && geoStatus === "unknown")}
            className="flex-1 py-2.5 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving…" : "Save Cash Adjustment"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
