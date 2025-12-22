import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

/**
 * Supported denominations only
 */
const DENOMS = [2000, 500, 200, 100];

/**
 * IST DateTime helper (yyyy-MM-ddTHH:mm)
 */
function getISTDateTimeLocal(): string {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().slice(0, 16);
}

/**
 * GPS helpers
 */
function getCurrentLocation(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      pos => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude
      }),
      err => reject(err.message),
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
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function ATMReplenishment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSite, setSelectedSite] = useState<any | null>(null);

  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");

  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [remarks, setRemarks] = useState("");

  const [form, setForm] = useState({
    denom_2000: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
  });

  const [photo, setPhoto] = useState<File | null>(null);
  const [geoStatus, setGeoStatus] = useState<string>("unknown");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  /* --------------------------------------------------
     Load assignment and sites
     -------------------------------------------------- */
  useEffect(() => {
    if (!profile) return;

    async function load() {
      const { data } = await supabase
        .from("assignments")
        .select(`
          id,
          route_sites (
            site_id,
            site:site_id(
              site_code,
              bank_name,
              address,
              atm_id,
              latitude,
              longitude
            )
          )
        `)
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .eq("status", "open")
        .maybeSingle();

      if (!data) return;

      setAssignmentId(data.id);
      setSites(data.route_sites.map((r: any) => ({
        site_id: r.site_id,
        site: r.site,
        label: formatSite(r.site),
      })));

      // Resume draft if exists
      const draftKey = Object.keys(localStorage)
        .find(k => k.startsWith(`atm_draft_${data.id}_`));

      if (draftKey) {
        const parsed = JSON.parse(localStorage.getItem(draftKey)!);
        const site = data.route_sites.find((r: any) => r.site_id === parsed.siteId);
        setSelectedSite(site);
        setTimeIn(parsed.timeIn);
      }
    }

    load();
  }, [profile]);

  /* --------------------------------------------------
     Draft persistence
     -------------------------------------------------- */
  useEffect(() => {
    if (!assignmentId || !selectedSite) return;

    const key = `atm_draft_${assignmentId}_${selectedSite.site_id}`;
    const draft = localStorage.getItem(key);

    if (!draft) {
      const nowIST = getISTDateTimeLocal();
      setTimeIn(nowIST);
      localStorage.setItem(key, JSON.stringify({
        siteId: selectedSite.site_id,
        timeIn: nowIST
      }));
    }
  }, [selectedSite, assignmentId]);

  /* --------------------------------------------------
     Save ATM Replenishment
     -------------------------------------------------- */
  async function handleSave() {
    setError(null);

    const totalNotes =
      form.denom_2000 +
      form.denom_500 +
      form.denom_200 +
      form.denom_100;

    if (!assignmentId || !selectedSite) {
      setError("Assignment or Site missing");
      return;
    }

    if (totalNotes === 0) {
      setError("Please enter at least one denomination before saving.");
      return;
    }

    setLoading(true);

    // GPS capture
    let loadLat = null;
    let loadLng = null;
    let distance = null;
    let geo = "unknown";

    try {
      const gps = await getCurrentLocation();
      loadLat = gps.lat;
      loadLng = gps.lng;

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

    // Photo upload (optional)
    let photoUrl = null;
    if (photo) {
      const fileName = `${assignmentId}_${selectedSite.site_id}_${Date.now()}.jpg`;
      const { data, error } = await supabase.storage
        .from("atm-photos")
        .upload(fileName, photo);

      if (!error) {
        photoUrl = data?.path;
      }
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
        closing_balance: closingBalance,
        remarks,
        ...form,
        load_lat: loadLat,
        load_lng: loadLng,
        distance_meters: distance,
        geo_status: geo,
        photo_url: photoUrl,
      });

    if (insertError) {
      setError("Failed to save ATM replenishment");
      setLoading(false);
      return;
    }

    localStorage.removeItem(`atm_draft_${assignmentId}_${selectedSite.site_id}`);
    setSelectedSite(null);
    setForm({ denom_2000: 0, denom_500: 0, denom_200: 0, denom_100: 0 });
    setTimeIn("");
    setTimeOut("");
    setPhoto(null);
    setClosingBalance(0);
    setRemarks("");
    setGeoStatus(geo);

    setLoading(false);
  }

  /* --------------------------------------------------
     UI
     -------------------------------------------------- */
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <h2 className="text-lg font-semibold">ATM Replenishment</h2>

        <select
          className="w-full border px-3 py-2"
          value={selectedSite?.site_id ?? ""}
          onChange={e => {
            const site = sites.find(s => s.site_id === Number(e.target.value));
            setSelectedSite(site || null);
          }}
        >
          <option value="">Select Site</option>
          {sites.map(s => (
            <option key={s.site_id} value={s.site_id}>
              {s.label}
            </option>
          ))}
        </select>

        {selectedSite && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {DENOMS.map(d => (
                <div key={d}>
                  <label className="text-xs">₹{d}</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border px-2 py-1"
                    value={(form as any)[`denom_${d}`]}
                    onChange={e =>
                      setForm({ ...form, [`denom_${d}`]: Number(e.target.value) })
                    }
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm">Time In</label>
              <input
                type="datetime-local"
                className="w-full border px-2 py-1"
                value={timeIn}
                onChange={e => setTimeIn(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm">Time Out</label>
              <input
                type="datetime-local"
                className="w-full border px-2 py-1"
                value={timeOut}
                disabled
              />
            </div>

            <input
              type="number"
              className="w-full border px-3 py-2"
              placeholder="Closing Balance"
              value={closingBalance}
              onChange={e => setClosingBalance(Number(e.target.value))}
            />

            <textarea
              className="w-full border px-3 py-2"
              placeholder="Remarks"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />

            <div>
              <label className="text-sm">ATM Photo (Optional)</label>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={e => setPhoto(e.target.files?.[0] || null)}
              />
            </div>

            {geoStatus === "mismatch" && (
              <div className="bg-yellow-100 text-xs p-2 rounded">
                ⚠️ Location mismatch detected. Photo evidence recommended.
              </div>
            )}

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full py-2 rounded bg-primary text-white"
            >
              {loading ? "Saving…" : "Save ATM Replenishment"}
            </button>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
