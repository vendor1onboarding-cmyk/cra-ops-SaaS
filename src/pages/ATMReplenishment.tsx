import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

const GPS_RADIUS_METERS = 100;

const DENOM_VALUES: Record<string, number> = {
  denom_100: 100,
  denom_200: 200,
  denom_500: 500,
  denom_2000: 2000,
};

function toIST(date = new Date()) {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000).toISOString();
}

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function getGPS() {
  return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 20000 }
    );
  });
}

export default function ATMReplenishment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const site = sites.find((s) => s.id === siteId);

  const [timeIn, setTimeIn] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  const [denoms, setDenoms] = useState({
    denom_100: 0,
    denom_200: 0,
    denom_500: 0,
    denom_2000: 0,
  });

  const [gpsStatus, setGpsStatus] =
    useState<"unknown" | "verified" | "mismatch" | "no_gps">("unknown");
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------------- Load assignment & sites ---------------- */

  useEffect(() => {
    if (!profile) return;

    (async () => {
      const today = new Date().toISOString().slice(0, 10);

      const { data: a } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .single();

      if (!a) return;
      setAssignmentId(a.id);

      const { data } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address, latitude, longitude)")
        .eq("assignment_id", a.id);

      setSites((data || []).map((r: any) => r.site));
    })();
  }, [profile]);

  /* ---------------- GPS ---------------- */

  async function acquireGPS() {
  setGpsMsg("Acquiring GPS signal… please wait");
  setGpsStatus("unknown");
  setDistance(null);
  setLat(null);
  setLng(null);
  setPhoto(null); // reset photo on every retry

  try {
    const g = await getGPS();
    setLat(g.lat);
    setLng(g.lng);

    if (!site?.latitude || !site?.longitude) {
      setGpsStatus("no_gps");
      setGpsMsg("ATM GPS not configured. Photo required.");
      return;
    }

    const d = distanceMeters(
      g.lat,
      g.lng,
      Number(site.latitude),
      Number(site.longitude)
    );

    setDistance(d);

    if (d <= GPS_RADIUS_METERS) {
      setGpsStatus("verified");
      setGpsMsg(`GPS verified successfully (${d.toFixed(1)} m)`);
    } else {
      setGpsStatus("mismatch");
      setGpsMsg(
        `GPS mismatch (${d.toFixed(1)} m). Move closer to ATM and retry.`
      );
    }
  } catch (err) {
    setGpsStatus("no_gps");
    setGpsMsg("Unable to fetch GPS. Ensure location is enabled.");
  }
}


  /* ---------------- Amount Calculation ---------------- */

  const denomBreakup = Object.entries(DENOM_VALUES).map(([k, value]) => {
    const count = (denoms as any)[k] as number;
    return {
      key: k,
      value,
      count,
      amount: count * value,
    };
  });

  const totalNotes = denomBreakup.reduce((a, d) => a + d.count, 0);
  const totalAmount = denomBreakup.reduce((a, d) => a + d.amount, 0);

  /* ---------------- Save ---------------- */

  async function saveLoad() {
    setError(null);
    setSaving(true);

    if (!siteId || !assignmentId) {
      setError("Select ATM site");
      setSaving(false);
      return;
    }

    if (!timeIn) {
      setError("Time In not captured");
      setSaving(false);
      return;
    }

    if (totalNotes === 0) {
      setError("Enter at least one denomination");
      setSaving(false);
      return;
    }

    if (gpsStatus !== "verified" && !photo) {
      setError("ATM photo required due to GPS mismatch");
      setSaving(false);
      return;
    }

    let photoPath: string | null = null;

    if (photo) {
      const path = `atm-loads/${assignmentId}-${siteId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("issue-photos")
        .upload(path, photo, { upsert: true });

      if (error) {
        setError("Photo upload failed");
        setSaving(false);
        return;
      }
      photoPath = path;
    }

    const { error } = await supabase.from("atm_replenishments").insert({
      assignment_id: assignmentId,
      site_id: siteId,
      time_in: timeIn,
      time_out: toIST(),
      ...denoms,
      remarks,
      load_lat: lat,
      load_lng: lng,
      distance_meters: distance,
      geo_status: gpsStatus,
      photo_required: gpsStatus !== "verified",
      photo_url: photoPath,
    });

    if (error) {
      setError("Failed to save ATM Load");
      setSaving(false);
      return;
    }

    // Reset
    setSiteId(null);
    setTimeIn(null);
    setRemarks("");
    setDenoms({ denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 });
    setGpsStatus("unknown");
    setGpsMsg(null);
    setDistance(null);
    setLat(null);
    setLng(null);
    setPhoto(null);
    setSaving(false);

    alert("ATM Load saved successfully");
  }

  /* ---------------- UI ---------------- */

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto bg-white rounded shadow p-4 space-y-3">
        <h2 className="text-lg font-semibold text-primary">ATM Load</h2>

        {gpsMsg && (
          <div
            className={`text-sm px-3 py-2 rounded ${
              gpsStatus === "verified"
                ? "bg-green-100 text-green-800"
                : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {gpsMsg}
          </div>
        )}

        <label className="text-sm font-medium">ATM Site</label>
        <select
          className="w-full border rounded px-2 py-1 text-sm"
          value={siteId ?? ""}
          onChange={(e) => {
            const id = Number(e.target.value);
            setSiteId(id);
            setTimeIn(id ? toIST() : null);
            setGpsStatus("unknown");
            setGpsMsg(null);
          }}
        >
          <option value="">Select ATM</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.bank_name} – {s.address}
            </option>
          ))}
        </select>

        <button
  type="button"
  onClick={acquireGPS}
  disabled={!siteId || saving}
  className="w-full bg-primary text-white py-2 rounded text-sm flex items-center justify-center gap-2"
>
  📍 Acquire GPS Location
</button>


        {(gpsStatus === "mismatch" || gpsStatus === "no_gps") && (
          <>
            <label className="text-sm font-medium">ATM Photo (Required)</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            />
          </>
        )}

        <div className="grid grid-cols-2 gap-2">
          {denomBreakup.map((d) => (
            <div key={d.key}>
              <label className="text-sm">₹{d.value}</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded px-2 py-1 text-sm"
                value={d.count}
                onChange={(e) =>
                  setDenoms({ ...denoms, [d.key]: Number(e.target.value) })
                }
              />
            </div>
          ))}
        </div>

        {/* Denomination-wise value summary */}
        <div className="bg-slate-50 rounded p-3 text-sm space-y-1">
          {denomBreakup
            .filter((d) => d.count > 0)
            .map((d) => (
              <div
                key={d.key}
                className="flex justify-between text-slate-700"
              >
                <span>
                  ₹{d.value} × {d.count}
                </span>
                <span className="font-medium">
                  ₹{d.amount.toLocaleString("en-IN")}
                </span>
              </div>
            ))}

          <div className="border-t pt-1 flex justify-between font-semibold">
            <span>Total</span>
            <span>₹{totalAmount.toLocaleString("en-IN")}</span>
          </div>
        </div>

        <label className="text-sm font-medium">Remarks</label>
        <textarea
          className="w-full border rounded px-2 py-1 text-sm"
          rows={2}
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={saveLoad}
          disabled={saving}
          className="w-full bg-green-600 text-white py-2 rounded text-sm"
        >
          {saving ? "Saving…" : "Save ATM Load"}
        </button>
      </div>
    </AppLayout>
  );
}
