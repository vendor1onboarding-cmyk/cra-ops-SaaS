import { useEffect } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";

const HEARTBEAT_MS = 60_000;

export default function LocationHeartbeat() {
  const { profile } = useAuth();

  useEffect(() => {
    if (!profile || profile.role !== "custodian" || !navigator.geolocation) return;

    let cancelled = false;
    const send = () => {
      navigator.geolocation.getCurrentPosition(async ({ coords }) => {
        if (cancelled) return;
        const { data: active } = await supabase
          .from("travel_logs")
          .select("assignment_id")
          .eq("custodian_id", profile.id)
          .eq("status", "in_progress")
          .order("start_time", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (!active) return;
        await supabase.from("custodian_locations").upsert({
          custodian_id: profile.id,
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy_meters: coords.accuracy,
          assignment_id: active.assignment_id,
          recorded_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }, () => undefined, { enableHighAccuracy: true, maximumAge: 15_000, timeout: 10_000 });
    };
    send();
    const timer = window.setInterval(send, HEARTBEAT_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [profile]);

  return null;
}
