import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

/* ---------------------------------------------
   Utils
---------------------------------------------- */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateKm({
  startGPS,
  endGPS,
  odoStart,
  odoEnd,
}: {
  startGPS?: { lat: number; lng: number } | null;
  endGPS?: { lat: number; lng: number } | null;
  odoStart?: string;
  odoEnd?: string;
}): { km: number; source: "gps" | "odometer" } {
  if (startGPS && endGPS) {
    const km = haversineKm(
      startGPS.lat,
      startGPS.lng,
      endGPS.lat,
      endGPS.lng
    );
    if (km >= 0.01) return { km, source: "gps" };
  }

  if (odoStart && odoEnd) {
    const diff = Number(odoEnd) - Number(odoStart);
    if (diff > 0) return { km: diff, source: "odometer" };
  }

  throw new Error(
    "Unable to calculate distance. Please capture GPS or enter odometer values."
  );
}

/* ---------------------------------------------
   Component
---------------------------------------------- */
export default function TravelTracking() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [activeLog, setActiveLog] = useState<any>(null);

  const [vehicleType, setVehicleType] = useState("bike");
  const [ratePerKm, setRatePerKm] = useState<number>(0);

  const [startGPS, setStartGPS] = useState<any>(null);
  const [endGPS, setEndGPS] = useState<any>(null);

  const [odometerStart, setOdometerStart] = useState("");
  const [odometerEnd, setOdometerEnd] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------------------------------------------
     Load assignment + rate
  ---------------------------------------------- */
  useEffect(() => {
    if (!profile) return;

    async function load() {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("status", "open")
        .order("assignment_date", { ascending: false })
        .limit(1)
        .single();

      if (assignment) setAssignmentId(assignment.id);

      const { data: rate } = await supabase
        .from("vehicle_rates")
        .select("rate_per_km")
        .eq("vehicle_type", vehicleType)
        .single();

      setRatePerKm(rate?.rate_per_km || 0);

      const { data: active } = await supabase
        .from("travel_logs")
        .select("*")
        .eq("custodian_id", profile.id)
        .eq("status", "in_progress")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      setActiveLog(active || null);
    }

    load();
  }, [profile, vehicleType]);

  /* ---------------------------------------------
     GPS capture
  ---------------------------------------------- */
  function acquireGPS(setter: any) {
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        setter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => setError("Unable to acquire GPS location"),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  /* ---------------------------------------------
     Start Travel
  ---------------------------------------------- */
  async function startTravel() {
    if (!assignmentId) return;

    setLoading(true);
    setError(null);

    try {
      const gps = await new Promise<any>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          reject,
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });

      const { data, error } = await supabase
        .from("travel_logs")
        .insert({
          assignment_id: assignmentId,
          custodian_id: profile!.id,
          start_time: new Date().toISOString(),
          gps_start_lat: gps.lat,
          gps_start_lng: gps.lng,
          odometer_start: odometerStart || null,
          status: "in_progress",
        })
        .select()
        .single();

      if (error) throw error;

      setActiveLog(data);
      setStartGPS(gps);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------
     End Travel
  ---------------------------------------------- */
  async function endTravel() {
    if (!activeLog) return;

    setLoading(true);
    setError(null);

    try {
      const gps = await new Promise<any>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (pos) =>
            resolve({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            }),
          reject,
          { enableHighAccuracy: true, timeout: 15000 }
        );
      });

      const { km, source } = calculateKm({
        startGPS: {
          lat: activeLog.gps_start_lat,
          lng: activeLog.gps_start_lng,
        },
        endGPS: gps,
        odoStart: activeLog.odometer_start,
        odoEnd: odometerEnd,
      });

      const allowance = km * ratePerKm;

      const { error } = await supabase
        .from("travel_logs")
        .update({
          end_time: new Date().toISOString(),
          gps_end_lat: gps.lat,
          gps_end_lng: gps.lng,
          odometer_end: odometerEnd || null,
          km_covered: km,
          allowance_amount: allowance,
          status: "completed",
        })
        .eq("id", activeLog.id);

      if (error) throw error;

      setActiveLog(null);
      setOdometerStart("");
      setOdometerEnd("");
      setStartGPS(null);
      setEndGPS(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------------------------------------
     UI
  ---------------------------------------------- */
  return (
    <AppLayout>
      <div className="container mx-auto max-w-xl space-y-4">
        <h2 className="text-lg font-semibold text-primary">Travel Tracking</h2>

        {error && (
          <div className="bg-red-100 text-red-700 text-sm p-2 rounded">
            {error}
          </div>
        )}

        <div className="bg-white rounded shadow p-4 space-y-3">
          <div>
            <label className="text-sm">Vehicle Type</label>
            <select
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value)}
              className="w-full border rounded px-2 py-1 text-sm"
            >
              <option value="bike">Bike</option>
              <option value="car">Car</option>
              <option value="van">Van</option>
            </select>
          </div>

          {!activeLog && (
            <>
              <div>
                <label className="text-sm">Odometer Start (optional)</label>
                <input
                  value={odometerStart}
                  onChange={(e) => setOdometerStart(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              <button
                onClick={startTravel}
                disabled={loading}
                className="btn-primary w-full"
              >
                Start Travel
              </button>
            </>
          )}

          {activeLog && (
            <>
              <div>
                <label className="text-sm">Odometer End (optional)</label>
                <input
                  value={odometerEnd}
                  onChange={(e) => setOdometerEnd(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm"
                />
              </div>

              <button
                onClick={endTravel}
                disabled={loading}
                className="btn-success w-full"
              >
                End Travel
              </button>
            </>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
