import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

type VehicleType = "bike" | "car" | "van";

export default function TravelTracking() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");
  const [source, setSource] = useState<"gps" | "odometer">("gps");

  const [startGPS, setStartGPS] = useState<any>(null);
  const [endGPS, setEndGPS] = useState<any>(null);

  const [odoStart, setOdoStart] = useState<number | null>(null);
  const [odoEnd, setOdoEnd] = useState<number | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [allowance, setAllowance] = useState<number | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --------------------------------------------------
  // Load today's assignment
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    const today = new Date().toISOString().slice(0, 10);

    supabase
      .from("assignments")
      .select("id")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
      .single()
      .then(({ data }) => {
        if (data) setAssignmentId(data.id);
      });
  }, [profile]);

  // --------------------------------------------------
  // GPS helper
  // --------------------------------------------------
  function acquireGPS(setter: Function) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          time: new Date().toISOString(),
        });
      },
      () => {
        setError("GPS unavailable. Please use odometer entry.");
        setSource("odometer");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  function haversineKm(a: any, b: any) {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  // --------------------------------------------------
  // Start / End travel
  // --------------------------------------------------
  function startTravel() {
    setError(null);
    setStartGPS(null);
    setEndGPS(null);
    setDistanceKm(null);
    setAllowance(null);

    if (source === "gps") acquireGPS(setStartGPS);
  }

  function endTravel() {
    if (source === "gps") {
      acquireGPS(setEndGPS);
    } else {
      if (!odoStart || !odoEnd || odoEnd <= odoStart) {
        setError("Invalid odometer readings.");
        return;
      }
      setDistanceKm(Number((odoEnd - odoStart).toFixed(2)));
    }
  }

  // --------------------------------------------------
  // Compute distance from GPS
  // --------------------------------------------------
  useEffect(() => {
    if (startGPS && endGPS && source === "gps") {
      const km = haversineKm(startGPS, endGPS);
      setDistanceKm(Number(km.toFixed(2)));
    }
  }, [startGPS, endGPS, source]);

  // --------------------------------------------------
  // Compute allowance
  // --------------------------------------------------
  useEffect(() => {
    if (!distanceKm) return;

    supabase
      .from("vehicle_rates")
      .select("rate_per_km")
      .eq("vehicle_type", vehicleType)
      .single()
      .then(({ data }) => {
        if (data) {
          setAllowance(Number((distanceKm * data.rate_per_km).toFixed(2)));
        }
      });
  }, [distanceKm, vehicleType]);

  // --------------------------------------------------
  // Save travel
  // --------------------------------------------------
  async function saveTravel() {
    if (!assignmentId || distanceKm === null) {
      setError("Travel data incomplete.");
      return;
    }

    setSaving(true);
    setError(null);

    const { error } = await supabase.from("travel_logs").insert({
      assignment_id: assignmentId,
      custodian_id: profile?.id,
      start_time: startGPS?.time,
      end_time: endGPS?.time,
      gps_start_lat: startGPS?.lat,
      gps_start_lng: startGPS?.lng,
      gps_end_lat: endGPS?.lat,
      gps_end_lng: endGPS?.lng,
      odometer_start: odoStart,
      odometer_end: odoEnd,
      km_covered: distanceKm,
      vehicle_type: vehicleType,
      source,
      allowance_amount: allowance,
      status: "completed",
    });

    setSaving(false);

    if (error) {
      console.error(error);
      setError("Failed to save travel log.");
      return;
    }

    alert("Travel recorded successfully.");
    window.location.reload();
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <h2 className="text-lg font-semibold">Travel Log</h2>

        <select
          className="w-full border rounded px-3 py-2"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value as VehicleType)}
        >
          <option value="bike">Bike</option>
          <option value="car">Car</option>
          <option value="van">Van</option>
        </select>

        <div className="flex gap-2">
          <button className="btn-secondary w-1/2" onClick={startTravel}>
            Start Travel
          </button>
          <button className="btn-secondary w-1/2" onClick={endTravel}>
            End Travel
          </button>
        </div>

        {source === "odometer" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="number"
              placeholder="Odometer Start"
              className="border rounded px-2 py-1"
              onChange={(e) => setOdoStart(Number(e.target.value))}
            />
            <input
              type="number"
              placeholder="Odometer End"
              className="border rounded px-2 py-1"
              onChange={(e) => setOdoEnd(Number(e.target.value))}
            />
          </div>
        )}

        {distanceKm !== null && (
          <div className="bg-slate-100 rounded p-3 text-sm">
            <div>Distance: <b>{distanceKm} km</b></div>
            {allowance !== null && (
              <div>Allowance: <b>₹{allowance}</b></div>
            )}
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          onClick={saveTravel}
          disabled={saving || distanceKm === null}
          className="btn-primary w-full"
        >
          {saving ? "Saving..." : "Save Travel"}
        </button>
      </div>
    </AppLayout>
  );
}
