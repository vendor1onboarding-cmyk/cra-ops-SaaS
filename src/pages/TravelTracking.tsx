import React, { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { formatIST } from "../utils/time";

/* -------------------- Utilities -------------------- */

function isValidCoord(v: any) {
  return typeof v === "number" && !isNaN(v);
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
) {
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

function getGPS(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos =>
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        }),
      () => reject(new Error("Unable to acquire GPS location")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}

/* -------------------- Component -------------------- */

export default function TravelTracking() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [vehicleType, setVehicleType] = useState("bike");
  const [ratePerKm, setRatePerKm] = useState(0);

  const [segments, setSegments] = useState<any[]>([]);
  const [activeTravel, setActiveTravel] = useState<any | null>(null);

  const [odoStart, setOdoStart] = useState("");
  const [odoEnd, setOdoEnd] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  /* -------------------- Load data -------------------- */

  useEffect(() => {
    if (!profile) return;

    let mounted = true;

    async function load() {
      // Open assignment
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("status", "open")
        .order("assignment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (mounted && assignment) setAssignmentId(assignment.id);

      // Vehicle rate
      const { data: rate } = await supabase
        .from("vehicle_rates")
        .select("rate_per_km")
        .eq("vehicle_type", vehicleType)
        .maybeSingle();

      if (mounted) setRatePerKm(rate?.rate_per_km || 0);

      // Travel logs
      const { data: logs } = await supabase
        .from("travel_logs")
        .select("*")
        .eq("custodian_id", profile.id)
        .order("created_at", { ascending: true });

      if (!mounted) return;

      const clean = (logs || []).filter(
        l =>
          l &&
          l.start_time &&
          isValidCoord(l.gps_start_lat) &&
          isValidCoord(l.gps_start_lng)
      );

      setSegments(clean);
      setActiveTravel(clean.find(l => l.status === "in_progress") || null);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [profile, vehicleType]);

  /* -------------------- Start Travel -------------------- */

  async function startTravel() {
    if (!assignmentId || activeTravel) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const gps = await getGPS();
      const nowUTC = new Date().toISOString();

      const { data, error } = await supabase
        .from("travel_logs")
        .insert({
          assignment_id: assignmentId,
          custodian_id: profile!.id,
          start_time: nowUTC,
          gps_start_lat: gps.lat,
          gps_start_lng: gps.lng,
          odometer_start: odoStart || null,
          status: "in_progress",
          vehicle_type: vehicleType,
          rate_per_km: ratePerKm,
        })
        .select()
        .single();

      if (error) throw error;

      setActiveTravel(data);
      setSegments(prev => [...prev, data]);
      setInfo("Travel started successfully.");
      setOdoStart("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- End Travel -------------------- */

  async function endTravel() {
    if (!activeTravel) {
      setError("No active travel to end.");
      return;
    }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const gpsEnd = await getGPS();

      let km = haversineKm(
        activeTravel.gps_start_lat,
        activeTravel.gps_start_lng,
        gpsEnd.lat,
        gpsEnd.lng
      );

      if (km < 0.05 && odoStart && odoEnd) {
        km = Number(odoEnd) - Number(odoStart);
      }

      if (km < 0.05) throw new Error("Distance too small.");
      if (km > 300) throw new Error("Distance exceeds sanity limit.");

      const allowance = km * ratePerKm;
      const nowUTC = new Date().toISOString();

      await supabase
        .from("travel_logs")
        .update({
          end_time: nowUTC,
          gps_end_lat: gpsEnd.lat,
          gps_end_lng: gpsEnd.lng,
          odometer_end: odoEnd || null,
          km_covered: km,
          allowance_amount: allowance,
          status: "completed",
        })
        .eq("id", activeTravel.id);

      setInfo(
        `Travel completed: ${km.toFixed(
          2
        )} km, allowance ₹${allowance.toFixed(2)}`
      );

      setActiveTravel(null);
      setOdoEnd("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* -------------------- Derived -------------------- */

  const firstSegment = segments.length > 0 ? segments[0] : null;

  /* -------------------- UI -------------------- */

  return (
    <AppLayout>
      <div className="container py-4 space-y-4">
        <h2 className="text-lg font-semibold text-primary">Travel Tracking</h2>

        {error && (
          <div className="bg-red-50 border border-red-300 p-3 rounded text-sm text-red-700">
            {error}
          </div>
        )}

        {info && (
          <div className="bg-green-50 border border-green-300 p-3 rounded text-sm text-green-700">
            {info}
          </div>
        )}

        {activeTravel && (
          <div className="text-sm text-slate-700">
            🚗 Travel in progress since{" "}
            {formatIST(activeTravel.start_time)}{" "}
            <span className="text-xs text-slate-500">(IST)</span>
          </div>
        )}

        {/* MAP */}
        {firstSegment && (
          <div className="bg-white rounded-xl border shadow-sm p-3">
            <div className="h-72 w-full rounded overflow-hidden border">
              <MapContainer
                center={[
                  firstSegment.gps_start_lat,
                  firstSegment.gps_start_lng,
                ]}
                zoom={14}
                className="h-full w-full"
              >
                <TileLayer
                  attribution="© OpenStreetMap contributors"
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {segments.map((s, i) => {
                  const hasEnd =
                    isValidCoord(s.gps_end_lat) &&
                    isValidCoord(s.gps_end_lng);

                  return (
                    <React.Fragment key={i}>
                      <Polyline
                        positions={
                          hasEnd
                            ? [
                                [s.gps_start_lat, s.gps_start_lng],
                                [s.gps_end_lat, s.gps_end_lng],
                              ]
                            : [
                                [s.gps_start_lat, s.gps_start_lng],
                                [s.gps_start_lat, s.gps_start_lng],
                              ]
                        }
                        pathOptions={
                          hasEnd
                            ? { color: "#2563eb", weight: 4 }
                            : {
                                color: "#f59e0b",
                                dashArray: "6,6",
                                weight: 4,
                              }
                        }
                      />

                      {hasEnd && (
                        <Marker
                          position={[s.gps_end_lat, s.gps_end_lng]}
                        >
                          <Popup>
                            🏁 {s.km_covered?.toFixed(2)} km
                          </Popup>
                        </Marker>
                      )}
                    </React.Fragment>
                  );
                })}
              </MapContainer>
            </div>
          </div>
        )}

        {/* FORM */}
        <div className="bg-white rounded shadow p-4 space-y-3">
          <label className="text-sm">Vehicle Type</label>
          <select
            value={vehicleType}
            onChange={e => setVehicleType(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          >
            <option value="bike">Bike</option>
            <option value="car">Car</option>
            <option value="van">Van</option>
          </select>

          <input
            placeholder="Odometer Start (optional)"
            value={odoStart}
            onChange={e => setOdoStart(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />

          <button
            onClick={startTravel}
            disabled={loading || !!activeTravel}
            className="btn-primary w-full"
          >
            Start Travel
          </button>

          <input
            placeholder="Odometer End (optional)"
            value={odoEnd}
            onChange={e => setOdoEnd(e.target.value)}
            className="w-full border rounded px-2 py-1 text-sm"
          />

          <button
            onClick={endTravel}
            disabled={loading || !activeTravel}
            className="btn-success w-full"
          >
            End Travel
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
