import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

export default function EODSummary() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [assignmentStatus, setAssignmentStatus] = useState<string | null>(null);

  const [counts, setCounts] = useState({
    denominationPlans: 0,
    cashPickups: 0,
    atmLoads: 0,
    issues: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --------------------------------------------------
  // Load ACTIVE assignment (safe fallback version)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadAssignment() {
      setLoading(true);

      let assignment: any = null;

      // 1️⃣ Try latest OPEN assignment with route sites
      const { data: primary } = await supabase
        .from("assignments")
        .select(`
          id,
          status,
          route_sites ( id )
        `)
        .eq("custodian_id", profile.id)
        .eq("status", "open")
        .order("assignment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (primary && primary.route_sites?.length > 0) {
        assignment = primary;
      }

      // 2️⃣ Fallback: any OPEN/SUBMITTED assignment that has route sites
      if (!assignment) {
        const { data: fallback } = await supabase
          .from("assignments")
          .select(`
            id,
            status,
            route_sites ( id )
          `)
          .eq("custodian_id", profile.id)
          .in("status", ["open", "submitted"])
          .order("assignment_date", { ascending: false });

        assignment =
          fallback?.find((a: any) => a.route_sites?.length > 0) || null;
      }

      if (!assignment) {
        setAssignmentId(null);
        setAssignmentStatus(null);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);
      setAssignmentStatus(assignment.status);

      // --------------------------------------------------
      // Load summary counts (NO business logic change)
      // --------------------------------------------------
      const [
        denom,
        pickup,
        atm,
        issues,
      ] = await Promise.all([
        supabase
          .from("denomination_plans")
          .select("id", { count: "exact", head: true })
          .eq("assignment_id", assignment.id),

        supabase
          .from("cash_pickups")
          .select("id", { count: "exact", head: true })
          .eq("assignment_id", assignment.id),

        supabase
          .from("atm_replenishments")
          .select("id", { count: "exact", head: true })
          .eq("assignment_id", assignment.id),

        supabase
          .from("technical_issues")
          .select("id", { count: "exact", head: true })
          .eq("assignment_id", assignment.id),
      ]);

      setCounts({
        denominationPlans: denom.count || 0,
        cashPickups: pickup.count || 0,
        atmLoads: atm.count || 0,
        issues: issues.count || 0,
      });

      setLoading(false);
    }

    loadAssignment();
  }, [profile]);

  // --------------------------------------------------
  // Submit EOD
  // --------------------------------------------------
  async function submitEOD() {
    if (!assignmentId) return;

    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("assignments")
      .update({ status: "submitted" })
      .eq("id", assignmentId);

    if (error) {
      console.error(error);
      setMessage("Failed to submit EOD");
    } else {
      setAssignmentStatus("submitted");
      setMessage("EOD submitted successfully");
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

        {!assignmentId && !loading && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No active assignment found.
          </div>
        )}

        {assignmentId && (
          <>
            <div className="bg-white rounded shadow p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Denomination Plans</span>
                <span className="font-semibold">
                  {counts.denominationPlans}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Cash Pickups</span>
                <span className="font-semibold">
                  {counts.cashPickups}
                </span>
              </div>
              <div className="flex justify-between">
                <span>ATM Loads</span>
                <span className="font-semibold">
                  {counts.atmLoads}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Technical Issues</span>
                <span className="font-semibold">
                  {counts.issues}
                </span>
              </div>
            </div>

            {assignmentStatus === "open" && (
              <button
                onClick={submitEOD}
                disabled={loading}
                className="w-full bg-primary text-white py-2 rounded text-sm"
              >
                {loading ? "Submitting..." : "Submit End of Day"}
              </button>
            )}

            {assignmentStatus === "submitted" && (
              <div className="p-3 bg-green-100 rounded text-sm text-green-800">
                EOD already submitted. Awaiting admin approval.
              </div>
            )}

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
