import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

type VehicleType = "bike" | "car" | "van";

export default function TravelTracking() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState<VehicleType>("bike");
  const [tracking, setTracking] = useState(false);

  const [startGPS, setStartGPS] = useState<any>(null);
  const [endGPS, setEndGPS] = useState<any>(null);

  const [odoStart, setOdoStart] = useState<number | null>(null);
  const [odoEnd, setOdoEnd] = useState<number | null>(null);

  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [source, setSource] = useState<"gps" | "odometer">("gps");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // --------------------------------------------------
  // Load today's assignment
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    supabase
      .from("assignments")
      .select("id")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", new Date().toISOString().slice(0, 10))
      .single()
      .then(({ data }) => {
        if (data) setAssignmentId(data.id);
      });
  }, [profile]);

  // --------------------------------------------------
  // GPS helpers
  // --------------------------------------------------
  function acquireGPS(setter: Function) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          time: new Date().toISOString()
        });
      },
      () => {
        setError("Unable to capture GPS. Switch to odometer mode.");
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
  // Start Travel
  // --------------------------------------------------
  function startTravel() {
    setError(null);
    setTracking(true);

    if (source === "gps") {
      acquireGPS(setStartGPS);
    }
  }

  // --------------------------------------------------
  // End Travel
  // --------------------------------------------------
  function endTravel() {
    setError(null);

    if (source === "gps") {
      acquireGPS(setEndGPS);
    } else if (source === "odometer") {
      if (odoStart === null || odoEnd === null || odoEnd <= odoStart) {
        setError("Invalid odometer readings.");
        return;
      }
      setDistanceKm(odoEnd - odoStart);
    }
  }

  // --------------------------------------------------
  // Compute distance once GPS end captured
  // --------------------------------------------------
  useEffect(() => {
    if (startGPS && endGPS && source === "gps") {
      const km = haversineKm(startGPS, endGPS);
      setDistanceKm(Number(km.toFixed(2)));
    }
  }, [startGPS, endGPS, source]);

  // --------------------------------------------------
  // Save travel log
  // --------------------------------------------------
  async function saveTravel() {
    if (!assignmentId || distanceKm === null) {
      setError("Travel data incomplete.");
      return;
    }

    setSaving(true);
    setError(null);

    const { data: rate } = await supabase
      .from("vehicle_rates")
      .select("rate_per_km")
      .eq("vehicle_type", vehicleType)
      .single();

    const allowance = rate ? distanceKm * rate.rate_per_km : 0;

    const { error } = await supabase.from("travel_logs").insert({
      assignment_id: assignmentId,
      custodian_id: profile?.id,
      vehicle_type: vehicleType,
      source,
      start_time: startGPS?.time,
      end_time: endGPS?.time,
      gps_start_lat: startGPS?.lat,
      gps_start_lng: startGPS?.lng,
      gps_end_lat: endGPS?.lat,
      gps_end_lng: endGPS?.lng,
      odometer_start: odoStart,
      odometer_end: odoEnd,
      distance_km: distanceKm,
      allowance_amount: allowance
    });

    setSaving(false);

    if (error) {
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
        <h2 className="text-lg font-semibold">Travel Tracking</h2>

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
          <button
            onClick={startTravel}
            disabled={tracking}
            className="btn-secondary w-1/2"
          >
            Start Travel
          </button>
          <button
            onClick={endTravel}
            disabled={!tracking}
            className="btn-secondary w-1/2"
          >
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
          <div className="p-3 bg-slate-100 rounded text-sm">
            Distance: <b>{distanceKm} km</b>
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
