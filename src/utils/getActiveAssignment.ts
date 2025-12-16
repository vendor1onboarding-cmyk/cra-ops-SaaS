import { supabase } from "../api/supabaseClient";

export async function getActiveAssignment(userId: string) {
  const { data, error } = await supabase
    .from("assignments")
    .select("*")
    .eq("custodian_id", userId)
    .in("status", ["open", "submitted"])
    .order("assignment_date", { ascending: false })
    .limit(1)
    .single();

  if (error) {
    return null;
  }

  return data;
}
