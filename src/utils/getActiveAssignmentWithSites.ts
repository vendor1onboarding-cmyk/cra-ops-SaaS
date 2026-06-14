import { supabase } from "../api/supabaseClient";

export async function getActiveAssignmentWithSites(userId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select(`
      id,
      title,
      status,
      route_sites!inner (
        site_id,
        site:site_id (
          site_code,
          atm_id,
          bank_name
        )
      )
    `)
    .eq("custodian_id", userId)
    .in("status", ["open", "submitted"])
    .order("assignment_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data;
}
