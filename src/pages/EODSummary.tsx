import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

export default function EODSummary() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --------------------------------------------------
  // Load EOD data – ONLY assignment that HAS route sites
  // (open OR submitted)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadEOD() {
      setLoading(true);

      const { data: assignment, error } = await supabase
        .from("assignments")
        .select(`
          id,
          title,
          status,
          route_sites!inner (
            site_id
          )
        `)
        .eq("custodian_id", profile.id)
        .in("status", ["open", "submitted"])
        .order("assignment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !assignment) {
        setSummary(null);
        setAssignmentId(null);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);

      // --------------------------------------------------
      // Load all EOD-related data in parallel
      // --------------------------------------------------
      const [
        routeSitesRes,
        denomPlansRes,
        cashPickupsRes,
        atmLoadsRes,
        issuesRes,
        travelLogsRes,
      ] = await Promise.all([
        supabase
          .from("route_sites")
          .select("site_id, site:site_id(site_code)")
          .eq("assignment_id", assignment.id),

        supabase
          .from("denomination_plans")
          .select("*")
          .eq("assignment_id", assignment.id),

        supabase
          .from("cash_pickups")
          .select("*")
          .eq("assignment_id", assignment.id),

        supabase
          .from("atm_replenishments")
          .select("*")
          .eq("assignment_id", assignment.id),

        supabase
          .from("technical_issues")
          .select("*")
          .eq("assignment_id", assignment.id),

        supabase
          .from("travel_logs")
          .select("*")
          .eq("assignment_id", assignment.id),
      ]);

      setSummary({
        assignment,
        routeSites: routeSitesRes.data || [],
        denominationCount: denomPlansRes.data?.length || 0,
        cashPickupCount: cashPickupsRes.data?.length || 0,
        atmLoadCount: atmLoadsRes.data?.length || 0,
        issueCount: issuesRes.data?.length || 0,
        travelCount: travelLogsRes.data?.length || 0,
      });

      setLoading(false);
    }

    loadEOD();
  }, [profile]);

  // --------------------------------------------------
  // Submit EOD
  // --------------------------------------------------
  async function handleSubmit() {
    if (!assignmentId) return;

    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("assignments")
      .update({ status: "submitted" })
      .eq("id", assignmentId);

    if (error) {
      setMessage("Failed to submit EOD");
    } else {
      setMessage("EOD submitted successfully");
      setSummary((prev: any) =>
        prev
          ? {
              ...prev,
              assignment: { ...prev.assignment, status: "submitted" },
            }
          : prev
      );
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-5">
        <h2 className="text-lg font-semibold text-primary">
          End of Day Summary
        </h2>

        {loading && <p className="text-sm">Loading...</p>}

        {!summary && !loading && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No active assignment found.
          </div>
        )}

        {summary && (
          <>
            <div className="bg-white rounded shadow p-4 space-y-2 text-sm">
              <div>
                <strong>Assignment:</strong>{" "}
                {summary.assignment.title || `#${summary.assignment.id}`}
              </div>
              <div>
                <strong>Route Sites:</strong>{" "}
                {summary.routeSites.length}
              </div>
              <div>
                <strong>Denomination Plans:</strong>{" "}
                {summary.denominationCount}
              </div>
              <div>
                <strong>Cash Pickups:</strong>{" "}
                {summary.cashPickupCount}
              </div>
              <div>
                <strong>ATM Replenishments:</strong>{" "}
                {summary.atmLoadCount}
              </div>
              <div>
                <strong>Technical Issues:</strong>{" "}
                {summary.issueCount}
              </div>
              <div>
                <strong>Travel Logs:</strong>{" "}
                {summary.travelCount}
              </div>
              <div>
                <strong>Status:</strong>{" "}
                <span className="capitalize">
                  {summary.assignment.status}
                </span>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              disabled={
                loading || summary.assignment.status !== "open"
              }
              className="w-full bg-primary text-white py-2 rounded text-sm disabled:opacity-60"
            >
              {loading ? "Submitting..." : "Submit End of Day"}
            </button>

            {message && (
              <p className="text-xs text-center text-slate-700">
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
