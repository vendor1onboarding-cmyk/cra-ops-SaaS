import React, { useEffect, useState , useRef} from "react";
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
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { formatIST } from "../utils/time";
import "leaflet-polylinedecorator";

/* ---------------- Utilities ---------------- */

function isValidCoord(v: any) {
  return typeof v === "number" && !isNaN(v);
}

function isToday(utc: string) {
  const d = new Date(utc);
  const now = new Date();
  return (
    d.getUTCFullYear() === now.getUTCFullYear() &&
    d.getUTCMonth() === now.getUTCMonth() &&
    d.getUTCDate() === now.getUTCDate()
  );
}

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

function getGPS(): Promise<{ lat: number; lng: number }> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => reject(new Error("Unable to acquire GPS location")),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  });
}


/* ---------------- Component ---------------- */

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
  
  const [playIndex, setPlayIndex] = useState<number | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
const playbackTimerRef = useRef<number | null>(null);
const isPlayingRef = useRef(false);
	
  
  /* ---------------- Load ---------------- */
  
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
        .maybeSingle();

      if (assignment) setAssignmentId(assignment.id);

      const { data: rate } = await supabase
        .from("vehicle_rates")
        .select("rate_per_km")
        .eq("vehicle_type", vehicleType)
        .maybeSingle();

      setRatePerKm(rate?.rate_per_km || 0);

      const { data: logs } = await supabase
        .from("travel_logs")
        .select("*")
        .eq("custodian_id", profile.id)
        .order("created_at", { ascending: true });

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
  }, [profile, vehicleType]);


const todayKey = segments
  .filter(s => s.start_time)
  .map(s => s.id)
  .join(",");
  
useEffect(() => {
  return () => {
    if (playbackTimerRef.current) {
      clearInterval(playbackTimerRef.current);
    }
  };
}, []);

useEffect(() => {
  if (todaySegments.length === 0) return;
  setPlayIndex(null);
}, [todayKey]);


  /* ---------------- Start / End ---------------- */

  async function startTravel() {
    if (!assignmentId || activeTravel) return;

    setLoading(true);
    setError(null);

    try {
      const gps = await getGPS();
      const nowUTC = new Date().toISOString();

      const { data } = await supabase
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

      setActiveTravel(data);
      setSegments(prev => [...prev, data]);
      setOdoStart("");
      setInfo("Travel started.");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function endTravel() {
    if (!activeTravel) return;

    setLoading(true);
    setError(null);

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

      if (km < 0.05) throw new Error("Distance too small");

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

      setActiveTravel(null);
      setOdoEnd("");
      setInfo(`Travel completed (${km.toFixed(2)} km).`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  /* ---------------- Map Data (TODAY ONLY) ---------------- */

  const todaySegments = segments.filter(s => isToday(s.start_time));
  const mapCenter = activeTravel
    ? [activeTravel.gps_start_lat, activeTravel.gps_start_lng]
    : todaySegments.length > 0
    ? [todaySegments[0].gps_start_lat, todaySegments[0].gps_start_lng]
    : null;
/* ---------------- Derived playback segments ---------------- */
const playbackSegments =
  playIndex === null
    ? todaySegments
    : todaySegments.slice(0, playIndex + 1);

function startPlayback() {
  if (todaySegments.length === 0) return;

  stopPlayback();
  isPlayingRef.current = true;
  setIsPlaying(true);

  playbackTimerRef.current = setInterval(() => {
    setPlayIndex(prev => {
      if (prev === null) return 0;
      if (prev >= todaySegments.length - 1) {
        stopPlayback();
        return prev;
      }
      return prev + 1;
    });
  }, 800);
}

function stopPlayback() {
  isPlayingRef.current = false;
  setIsPlaying(false);

  if (playbackTimerRef.current) {
    clearInterval(playbackTimerRef.current);
    playbackTimerRef.current = null;
  }
}


  /* ---------------- UI ---------------- */

  return (
    <AppLayout>
      <div className="container py-4 space-y-4 relative">
        <h2 className="text-lg font-semibold text-primary">
          Travel Tracking
        </h2>

        {error && (
          <div className="bg-red-50 border border-red-300 p-3 rounded text-sm">
            {error}
          </div>
        )}

        {info && (
          <div className="bg-green-50 border border-green-300 p-3 rounded text-sm">
            {info}
          </div>
        )}

        {activeTravel && (
          <div className="text-sm text-slate-700">
            🚗 Travel in progress since {formatIST(activeTravel.start_time)}
          </div>
        )}

        {/* MAP – TODAY ONLY */}
       
	   {mapCenter && (
<div className="relative z-0 overflow-hidden">
          <div className="bg-white rounded-xl border shadow-sm p-3">
            <div className="h-72 rounded overflow-hidden">
			 <MapContainer
                center={mapCenter as any}
                zoom={14}
                className="h-full w-full"
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {playbackSegments.map((s, i) => {
  if (!s.gps_end_lat || !s.gps_end_lng) return null;

  return (
    <React.Fragment key={i}>
      {/* Polyline */}
	  
      <Polyline
        positions={[
          [s.gps_start_lat, s.gps_start_lng],
          [s.gps_end_lat, s.gps_end_lng],
        ]}
		
        pathOptions={{ color: "#2563eb", weight: 5 }}
      />
	  
{/* 🚦 Start marker */}
<Marker
  position={[s.gps_start_lat, s.gps_start_lng]}
  icon={L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    html: `<div style="font-size:22px;">🚦</div>`,
  })}
>
  <Popup>Start</Popup>
</Marker>

{/* 🏁 End marker */}
<Marker
  position={[s.gps_end_lat, s.gps_end_lng]}
  icon={L.divIcon({
    className: "",
    iconSize: [26, 26],
    iconAnchor: [13, 26],
    html: `<div style="font-size:22px;">🏁</div>`,
  })}
>
  <Popup>End</Popup>
</Marker>

      {/* 📏 Distance label */}
      {typeof s.km_covered === "number" && s.km_covered > 0 && (
        <Marker
          position={[
            (s.gps_start_lat + s.gps_end_lat) / 2,
            (s.gps_start_lng + s.gps_end_lng) / 2,
          ]}
          icon={L.divIcon({
            className: "",
            iconSize: [64, 22],
            iconAnchor: [32, 11],
            html: `
              <div style="
                background:#1e293b;
                color:white;
                padding:2px 6px;
                border-radius:6px;
                font-size:11px;
                font-weight:600;
                white-space:nowrap;
                box-shadow:0 2px 6px rgba(0,0,0,0.25);
              ">
                ${s.km_covered.toFixed(2)} km
              </div>
            `,
          })}
        />
      )}
    </React.Fragment>
  );
})}

{activeTravel &&
  isValidCoord(activeTravel.gps_start_lat) &&
  isValidCoord(activeTravel.gps_start_lng) && (
    <Marker
      position={[
        activeTravel.gps_start_lat,
        activeTravel.gps_start_lng,
      ]}
      icon={L.divIcon({
        className: "",
        iconSize: [20, 20],
        iconAnchor: [10, 10],
        html: `
          <div style="
            width:14px;
            height:14px;
            background:#22c55e;
            border-radius:50%;
            border:3px solid white;
            box-shadow:0 0 10px rgba(34,197,94,0.9);
            animation:pulse 1.5s infinite;
          "></div>
        `,
      })}
    >
      <Popup>🧭 You are here</Popup>
    </Marker>
)}

              </MapContainer>
			  
  </div>
<input
  type="range"
  min={0}
  max={todaySegments.length - 1}
  value={playIndex ?? todaySegments.length - 1}
  onChange={(e) => {
    stopPlayback();
    setPlayIndex(Number(e.target.value));
  }}
  className="w-full"
/>

<button
  onClick={() => {
    if (isPlaying) stopPlayback();
    else startPlayback();
  }}
  className="text-sm font-semibold text-slate-700 mb-2"
>
  {isPlaying ? "⏸ Pause" : "▶ Route Playback"}
</button>


{/* Legend */}
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span className="w-4 h-1 bg-blue-600 rounded" />
          Completed Travel
        </div>
        <div className="flex items-center gap-2">
          <span className="w-4 h-1 border-t-2 border-dashed border-amber-500" />
          In-Progress Travel
<div className="flex items-center gap-2">🧭 You are here</div>
        </div>
        <div className="flex items-center gap-2">🚦 Start</div>
        <div className="flex items-center gap-2">🏁 End       </div>
				      </div>
            </div>
          </div>
        )}


        {/* FORM */}
        <div className="bg-white rounded shadow p-4 space-y-3">
          <select
            value={vehicleType}
            onChange={e => setVehicleType(e.target.value)}
            className="w-full border rounded px-2 py-1"
          >
            <option value="bike">Bike</option>
            <option value="car">Car</option>
            <option value="van">Van</option>
          </select>

          <input
            placeholder="Odometer Start"
            value={odoStart}
            onChange={e => setOdoStart(e.target.value)}
            className="w-full border rounded px-2 py-1"
          />

          <button
            onClick={startTravel}
            disabled={loading || !!activeTravel}
            className="btn-primary w-full"
          >
            Start Travel
          </button>

          <input
            placeholder="Odometer End"
            value={odoEnd}
            onChange={e => setOdoEnd(e.target.value)}
            className="w-full border rounded px-2 py-1"
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