import { useEffect, useMemo, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import AppLayout from "../components/Layout";
import { supabase } from "../api/supabaseClient";
import { formatIST, isTodayIST } from "../utils/time";

type Custodian = { id: string; full_name: string };
type Location = { custodian_id: string; latitude: number; longitude: number; accuracy_meters?: number; recorded_at: string };
type Travel = { custodian_id: string; gps_start_lat: number; gps_start_lng: number; gps_end_lat?: number; gps_end_lng?: number; start_time: string; end_time?: string };

export default function AdminCustodianTracking() {
  const [custodians, setCustodians] = useState<Custodian[]>([]);
  const [selected, setSelected] = useState("");
  const [locations, setLocations] = useState<Location[]>([]);
  const [travels, setTravels] = useState<Travel[]>([]);
  const [error, setError] = useState("");

  async function load() {
    const [users, current, history] = await Promise.all([
      supabase.from("profiles").select("id, full_name").eq("role", "custodian").order("full_name"),
      supabase.from("custodian_locations").select("custodian_id, latitude, longitude, accuracy_meters, recorded_at"),
      supabase.from("travel_logs").select("custodian_id, gps_start_lat, gps_start_lng, gps_end_lat, gps_end_lng, start_time, end_time").order("start_time", { ascending: true }),
    ]);
    if (users.error || current.error || history.error) { setError("Tracking data is unavailable. Apply the location tracking migration first."); return; }
    setCustodians(users.data || []); setLocations(current.data || []); setTravels(history.data || []);
  }

  useEffect(() => { load(); const timer = window.setInterval(load, 60_000); return () => window.clearInterval(timer); }, []);

  const current = locations.find((l) => l.custodian_id === selected);
  const routes = useMemo(() => travels.filter((t) => t.custodian_id === selected && isTodayIST(t.start_time) && t.gps_end_lat != null && t.gps_end_lng != null), [travels, selected]);
  const center: [number, number] = current ? [current.latitude, current.longitude] : routes.length ? [routes[0].gps_start_lat, routes[0].gps_start_lng] : [20.5937, 78.9629];
  const selectedName = custodians.find((c) => c.id === selected)?.full_name || "Select a custodian";

  return <AppLayout><div className="container py-4 space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold text-primary">Custodian Tracking</h2><p className="text-xs text-slate-500">Foreground location and today&apos;s travel route</p></div><button className="btn-secondary" onClick={load}>Refresh</button></div>
    {error && <div className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{error}</div>}
    <select className="w-full max-w-md rounded border border-slate-300 px-3 py-2" value={selected} onChange={(e) => setSelected(e.target.value)}><option value="">Select custodian</option>{custodians.map((c) => <option key={c.id} value={c.id}>{c.full_name}</option>)}</select>
    {selected && <div className="grid gap-4 lg:grid-cols-[1fr_280px]"><div className="h-[520px] overflow-hidden rounded border"><MapContainer center={center} zoom={14} className="h-full w-full"><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />{current && <Marker position={[current.latitude, current.longitude]}><Popup>{selectedName}<br />Last update: {formatIST(current.recorded_at)}</Popup></Marker>}{routes.map((r, i) => <Polyline key={i} positions={[[r.gps_start_lat, r.gps_start_lng], [r.gps_end_lat!, r.gps_end_lng!]]} pathOptions={{ color: "#2563eb", weight: 5 }} />)}</MapContainer></div><div className="rounded border bg-white p-4 space-y-3"><h3 className="font-semibold">{selectedName}</h3><div className="text-sm">{current ? <><div>Last location: {formatIST(current.recorded_at)}</div><div>Accuracy: {Math.round(current.accuracy_meters || 0)} m</div></> : "No current location available"}</div><div className="text-xs text-slate-500">Location updates are available while the custodian is actively using the app during travel.</div></div></div>}
  </div></AppLayout>;
}
