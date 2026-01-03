import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

type VehicleType = "bike" | "car" | "van" | "other";

export default function TravelTracking() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [activeTravelId, setActiveTravelId] = useState<number | null>(null);

  const [vehicleType, setVehicleType] = useState<VehicleType | "">("");

  const [odometerStart, setOdometerStart] = useState("");
  const [odometerEnd, setOdometerEnd] = useState("");

  const [startLat, setStartLat] = useState<number | null>(null);
  const [startLng, setStartLng] = useState<number | null>(null);
  const [endLat, setEndLat] = useState<number | null>(null);
  const [endLng, setEndLng] = useState<number | null>(null);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  /* ----------------------------------------
     Load assignment + active travel
  ---------------------------------------- */
  useEffect(() => {
    if (!profile) return;

    async function init() {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", new Date().toISOString().slice(0, 10))
        .in("status", ["open", "submitted"])
        .order("id", { ascending: false })
        .limit(1)
        .single();

      if (!assignment) return;
      setAssignmentId(assignment.id);

      const { data: travel } = await supabase
        .from("travel_logs")
        .select("id, vehicle_type")
        .eq("assignment_id", assignment.id)
        .eq("custodian_id", profile.id)
        .eq("status", "in_progress")
        .limit(1)
        .single();

      if (travel) {
        setActiveTravelId(travel.id);
        setVehicleType(travel.vehicle_type as VehicleType);
      }
    }

    init();
  }, [profile]);

  /* ----------------------------------------
     GPS helper
  ---------------------------------------- */
  function acquireGPS(): Promise<{ lat: number; lng: number }> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject("GPS not supported");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        () => reject("Unable to acquire GPS"),
        { enableHighAccuracy: true, timeout: 15000 }
      );
    });
  }

  /* ----------------------------------------
     Start Travel
  ---------------------------------------- */
  async function startTravel() {
    if (!assignmentId || !profile || !vehicleType) {
      setMessage("Please select vehicle type before starting travel.");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const gps = await acquireGPS();
      setStartLat(gps.lat);
      setStartLng(gps.lng);

      const { data, error } = await supabase
        .from("travel_logs")
        .insert({
          assignment_id: assignmentId,
          custodian_id: profile.id,
          vehicle_type: vehicleType,
          start_time: new Date().toISOString(),
          odometer_start: odometerStart || null,
          gps_start_lat: gps.lat,
          gps_start_lng: gps.lng,
          status: "in_progress",
        })
        .select("id")
        .single();

      if (error) throw error;

      setActiveTravelId(data.id);
      setMessage("Travel started successfully.");
    } catch {
      setMessage("Failed to start travel. Please acquire GPS.");
    }

    setLoading(false);
  }

  /* ----------------------------------------
     End Travel
  ---------------------------------------- */
  async function endTravel() {
  if (!activeTravelId || !vehicleType) return;

  setLoading(true);
  setMessage(null);

  try {
    // 1️⃣ Acquire GPS
    const gps = await acquireGPS();
    setEndLat(gps.lat);
    setEndLng(gps.lng);

    // 2️⃣ Calculate KM
    const kmCovered =
      odometerStart && odometerEnd
        ? Number(odometerEnd) - Number(odometerStart)
        : null;

    if (!kmCovered || kmCovered <= 0) {
      throw new Error("Invalid KM covered");
    }

    // 3️⃣ Fetch vehicle rate (MASTER DATA)
    const { data: rateRow, error: rateError } = await supabase
      .from("vehicle_rates")
      .select("rate_per_km")
      .eq("vehicle_type", vehicleType)
      .eq("active", true)
      .order("effective_from", { ascending: false })
      .limit(1)
      .single();

    if (rateError || !rateRow) {
      throw new Error("Vehicle rate not configured");
    }

    const ratePerKm = Number(rateRow.rate_per_km);
    const allowanceAmount = kmCovered * ratePerKm;

    // 4️⃣ Update travel log (ATOMIC, AUDITABLE)
    const { error } = await supabase
      .from("travel_logs")
      .update({
        end_time: new Date().toISOString(),
        odometer_end: odometerEnd || null,
        km_covered: kmCovered,
        rate_per_km: ratePerKm,
        allowance_amount: allowanceAmount,
        gps_end_lat: gps.lat,
        gps_end_lng: gps.lng,
        status: "completed",
      })
      .eq("id", activeTravelId);

    if (error) throw error;

    setActiveTravelId(null);
    setVehicleType("");
    setOdometerEnd("");
    setMessage(
      `Travel ended. Allowance ₹${allowanceAmount.toFixed(2)}`
    );
  } catch (err: any) {
    setMessage(err.message || "Failed to end travel");
  }

  setLoading(false);
}


  /* ----------------------------------------
     UI
  ---------------------------------------- */
  return (
    <AppLayout>
      <div className="container max-w-xl space-y-5">
        <h2 className="text-xl font-semibold text-primary">
          Travel Tracking
        </h2>

        {message && (
          <div className="p-3 bg-yellow-100 rounded text-sm">
            {message}
          </div>
        )}

        {/* Vehicle Type */}
        <div>
          <label className="text-sm font-medium">Vehicle Type</label>
          <select
            className="w-full border rounded px-2 py-2 text-sm"
            value={vehicleType}
            onChange={(e) =>
              setVehicleType(e.target.value as VehicleType)
            }
            disabled={!!activeTravelId}
          >
            <option value="">Select Vehicle</option>
            <option value="bike">Bike</option>
            <option value="car">Car</option>
            <option value="van">Van</option>
            <option value="other">Other</option>
          </select>
        </div>

        {/* Odometer */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm">Odometer Start</label>
            <input
              type="number"
              className="w-full border rounded px-2 py-1 text-sm"
              value={odometerStart}
              onChange={(e) => setOdometerStart(e.target.value)}
              disabled={!!activeTravelId}
            />
          </div>

          <div>
            <label className="text-sm">Odometer End</label>
            <input
              type="number"
              className="w-full border rounded px-2 py-1 text-sm"
              value={odometerEnd}
              onChange={(e) => setOdometerEnd(e.target.value)}
              disabled={!activeTravelId}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={startTravel}
            disabled={loading || !!activeTravelId}
            className="flex-1 btn-primary"
          >
            Start Travel
          </button>

          <button
            onClick={endTravel}
            disabled={loading || !activeTravelId}
            className="flex-1 bg-green-600 text-white py-2 rounded"
          >
            End Travel
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
