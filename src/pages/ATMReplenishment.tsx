import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

/* ================= CONFIG ================= */
const DENOMS = [2000, 500, 200, 100] as const;
type GeoMode = "OFF" | "SOFT" | "STRICT";

/* ================= HELPERS ================= */
function getISTDateTimeLocal(): string {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  return new Date(now.getTime() + istOffset).toISOString().slice(0, 16);
}

function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject("Geolocation not supported");
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      (err) => reject(err.message),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatSite(site: any) {
  return `${site.bank_name} – ${site.address} (ATM: ${site.atm_id})`;
}

/* ================= COMPONENT ================= */
export default function ATMReplenishment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);

  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");

  const [form, setForm] = useState({
    denom_2000: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
  });

  const [closingBalance, setClosingBalance] = useState<number | null>(null);
  const [remarks, setRemarks] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);

  const [geoStatus, setGeoStatus] = useState<
    "verified" | "mismatch" | "no_gps" | "unknown"
  >("unknown");
  const [geoMode, setGeoMode] = useState<GeoMode>("OFF");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  /* ---------- Load GPS Mode ---------- */
  useEffect(() => {
    supabase
      .from("system_settings")
      .select("value")
      .eq("key", "geo_enforcement_mode")
      .maybeSingle()
      .then(({ data }) => {
        if (data?.value) setGeoMode(data.value as GeoMode);
      });
  }, []);

  /* ---------- Load Assignment + Sites ---------- */
  useEffect(() => {
    if (!profile) return;

    async function loadAssignment() {
      const { data } = await supabase
        .from("assignments")
        .select(
          `
          id,
          route_sites (
            site_id,
            site:site_id (
              bank_name,
              address,
              atm_id,
              latitude,
              longitude
            )
          )
        `
        )
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .eq("status", "open")
        .maybeSingle();

      if (!data) return;

      setAssignmentId(data.id);
      setSites(
        data.route_sites.map((r: any) => ({
          site_id: r.site_id,
          site: r.site,
          label: formatSite(r.site),
        }))
      );
    }

    loadAssignment();
  }, [profile]);

  /* ---------- Draft + Auto TimeIn ---------- */
  useEffect(() => {
    if (!assignmentId || !selectedSite) return;

    const key = `atm_draft_${assignmentId}_${selectedSite.site_id}`;
    const existing = localStorage.getItem(key);

    if (existing) {
      const d = JSON.parse(existing);
      setTimeIn(d.timeIn);
    } else {
      const now = getISTDateTimeLocal();
      setTimeIn(now);
      localStorage.setItem(
        key,
        JSON.stringify({ siteId: selectedSite.site_id, timeIn: now })
      );
    }
  }, [selectedSite, assignmentId]);

  /* ---------- Validation ---------- */
  const totalNotes = Object.values(form).reduce((a, b) => a + b, 0);

  function getValidationMessage(): string | null {
    if (!assignmentId || !selectedSite)
      return "Assignment or ATM site not selected.";

    if (totalNotes === 0)
      return "Enter at least one denomination before saving.";

    if (geoStatus !== "verified") {
      if (geoMode === "STRICT")
        return "ATM load blocked due to GPS mismatch. Contact Admin.";
      if (geoMode === "SOFT" && !photo)
        return "ATM photo is mandatory due to GPS mismatch.";
    }
    return null;
  }

  const validationMessage = getValidationMessage();

  /* ---------- SAVE ---------- */
  async function handleSave() {
    setError(null);

    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setLoading(true);

    let lat: number | null = null;
    let lng: number | null = null;
    let distance: number | null = null;
    let geo: typeof geoStatus = "unknown";

    try {
      const gps = await getCurrentLocation();
      lat = gps.lat;
      lng = gps.lng;

      if (selectedSite.site.latitude && selectedSite.site.longitude) {
        distance = calculateDistanceMeters(
          gps.lat,
          gps.lng,
          selectedSite.site.latitude,
          selectedSite.site.longitude
        );
        geo = distance <= 100 ? "verified" : "mismatch";
      }
    } catch {
      geo = "no_gps";
    }

    setGeoStatus(geo);

    let photoUrl: string | null = null;
    if (photo) {
      const name = `atm_${assignmentId}_${selectedSite.site_id}_${Date.now()}.jpg`;
      const { data } = await supabase.storage
        .from("atm-photos")
        .upload(name, photo);
      photoUrl = data?.path ?? null;
    }

    const finalTimeOut = getISTDateTimeLocal();
    setTimeOut(finalTimeOut);

    const { error: insertError } = await supabase
      .from("atm_replenishments")
      .insert({
        assignment_id: assignmentId,
        site_id: selectedSite.site_id,
        time_in: timeIn,
        time_out: finalTimeOut,

        denom_2000: form.denom_2000,
        denom_500: form.denom_500,
        denom_200: form.denom_200,
        denom_100: form.denom_100,

        closing_balance: closingBalance,
        remarks,

        load_lat: lat,
        load_lng: lng,
        distance_meters: distance,
        geo_status: geo,
        photo_required: geo !== "verified",
        photo_url: photoUrl,
      });

    if (insertError) {
      console.error(insertError);
      setError(insertError.message);
      setLoading(false);
      return;
    }

    localStorage.removeItem(
      `atm_draft_${assignmentId}_${selectedSite.site_id}`
    );

    setSelectedSite(null);
    setForm({ denom_2000: 0, denom_500: 0, denom_200: 0, denom_100: 0 });
    setClosingBalance(null);
    setRemarks("");
    setPhoto(null);
    setTimeIn("");
    setTimeOut("");
    setLoading(false);
  }

  /* ================= UI ================= */
  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <h2 className="text-lg font-semibold text-primary">
          ATM Replenishment
        </h2>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700">
            Select ATM Site
          </label>
          <select
            className="w-full border rounded px-3 py-2 text-sm"
            value={selectedSite?.site_id ?? ""}
            onChange={(e) =>
              setSelectedSite(
                sites.find(
                  (s) => s.site_id === Number(e.target.value)
                ) || null
              )
            }
          >
            <option value="">-- Select ATM --</option>
            {sites.map((s) => (
              <option key={s.site_id} value={s.site_id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {selectedSite && (
          <div className="bg-white border rounded-lg p-4 space-y-5 shadow-sm">
            <div>
              <p className="text-sm font-medium text-slate-700 mb-2">
                Cash Loaded (Denomination-wise)
              </p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {DENOMS.map((d) => (
                  <div key={d} className="space-y-1">
                    <label className="text-xs text-slate-600">
                      ₹{d}
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={(form as any)[`denom_${d}`]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [`denom_${d}`]: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Closing Balance (₹)
              </label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2 text-sm"
                value={closingBalance ?? ""}
                onChange={(e) =>
                  setClosingBalance(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Time In (IST)
                </label>
                <input
                  type="datetime-local"
                  value={timeIn}
                  readOnly
                  className="w-full border rounded px-3 py-2 text-sm bg-slate-100"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">
                  Time Out (Auto)
                </label>
                <input
                  type="datetime-local"
                  value={timeOut}
                  readOnly
                  className="w-full border rounded px-3 py-2 text-sm bg-slate-100"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">
                Remarks
              </label>
              <textarea
                className="w-full border rounded px-3 py-2 text-sm"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            {geoMode === "SOFT" && geoStatus !== "verified" && (
              <div className="border rounded-md p-3 bg-yellow-50 space-y-3">
                <p className="text-sm font-medium text-yellow-800">
                  GPS Verification Required
                </p>

                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={(e) =>
                    setPhoto(e.target.files?.[0] || null)
                  }
                />
              </div>
            )}

            {validationMessage && (
              <div className="bg-red-100 border border-red-300 p-3 rounded text-sm text-red-700">
                ⚠️ {validationMessage}
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={loading || !!validationMessage}
              className={`w-full py-2 rounded text-sm font-semibold ${
                validationMessage
                  ? "bg-slate-300 text-slate-600"
                  : "bg-primary text-white hover:bg-primary-light"
              }`}
            >
              {loading
                ? "Saving ATM Load..."
                : "Save ATM Replenishment"}
            </button>

            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
