import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // CUSTODIAN VIEW DATA
  const [todayAssignment, setTodayAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [taskSummary, setTaskSummary] = useState<any>(null);

  // ADMIN VIEW DATA
  const [adminAssignments, setAdminAssignments] = useState<any[]>([]);
  const [issueSummary, setIssueSummary] = useState<any>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!profile) return;

    if (profile.role === "custodian") {
      loadCustodianDashboard();
    } else if (profile.role === "admin" || profile.role === "supervisor") {
      loadAdminDashboard();
    }
  }, [profile]);

  // ---------------------------------------------------------------------
  // CUSTODIAN DASHBOARD
  // ---------------------------------------------------------------------

  async function loadCustodianDashboard() {
    setLoading(true);

    // 1. Fetch today's assignment for this custodian
    const { data: assign } = await supabase
      .from("assignments")
      .select("*, supervisor:supervisor_id(full_name)")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
      .single();

    setTodayAssignment(assign);

    if (assign) {
      // 2. Fetch route sites for that assignment
      const { data: rsites } = await supabase
        .from("route_sites")
        .select("*, site:site_id(site_code, site_name)")
        .eq("assignment_id", assign.id)
        .order("sequence_no");

      setRouteSites(rsites || []);

      // 3. Fetch task status summary (count how many entries exist)
      const [denoms, pickups, loads, issues] = await Promise.all([
        supabase
          .from("denomination_plans")
          .select("*", { count: "exact" })
          .eq("assignment_id", assign.id),
        supabase
          .from("cash_pickups")
          .select("*", { count: "exact" })
          .eq("assignment_id", assign.id),
        supabase
          .from("atm_replenishments")
          .select("*", { count: "exact" })
          .eq("assignment_id", assign.id),
        supabase
          .from("technical_issues")
          .select("*", { count: "exact" })
          .eq("assignment_id", assign.id),
      ]);

      setTaskSummary({
        denomCount: denoms?.count || 0,
        pickupCount: pickups?.count || 0,
        loadCount: loads?.count || 0,
        issueCount: issues?.count || 0,
      });
    }

    setLoading(false);
  }

  // ---------------------------------------------------------------------
  // ADMIN DASHBOARD
  // ---------------------------------------------------------------------

  async function loadAdminDashboard() {
    setLoading(true);

    // 1. Fetch all today's assignments
    const { data: assigns } = await supabase
      .from("assignments")
      .select(
        "*, custodian:custodian_id(full_name), supervisor:supervisor_id(full_name)"
      )
      .eq("assignment_date", today);

    setAdminAssignments(assigns || []);

    // 2. Issue summary
    const [newIssues, inProgress, resolved] = await Promise.all([
      supabase
        .from("technical_issues")
        .select("*", { count: "exact" })
        .eq("status", "new"),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact" })
        .eq("status", "in_progress"),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact" })
        .eq("status", "resolved"),
    ]);

    setIssueSummary({
      new: newIssues?.count || 0,
      inProgress: inProgress?.count || 0,
      resolved: resolved?.count || 0,
    });

    setLoading(false);
  }

  // ---------------------------------------------------------------------
  // UI Rendering
  // ---------------------------------------------------------------------

  return (
    <AppLayout>
      {loading && (
        <div className="text-center text-sm text-slate-500">Loading...</div>
      )}

      {!loading && profile?.role === "custodian" && (
        <CustodianDashboard
          todayAssignment={todayAssignment}
          routeSites={routeSites}
          taskSummary={taskSummary}
        />
      )}

      {!loading && (profile?.role === "admin" || profile?.role === "supervisor") && (
        <AdminDashboard
          adminAssignments={adminAssignments}
          issueSummary={issueSummary}
        />
      )}
    </AppLayout>
  );
}

//
// ----------------------------------------------------
// Custodian Dashboard UI
// ----------------------------------------------------

function CustodianDashboard({ todayAssignment, routeSites, taskSummary }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">Today's Assignment</h2>

      {!todayAssignment && (
        <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-md">
          No assignment assigned for today.
        </div>
      )}

      {todayAssignment && (
        <div className="p-4 bg-white rounded-lg shadow">
          <div className="font-semibold">{todayAssignment.title}</div>
          <div className="text-xs text-slate-600">
            Supervisor: {todayAssignment.supervisor?.full_name || "-"}
          </div>
          <div className="text-xs">Status: {todayAssignment.status}</div>
        </div>
      )}

      <h3 className="text-md font-semibold">Route Sites</h3>
      <div className="space-y-2">
        {routeSites.map((rs: any, index: number) => (
          <div key={rs.id} className="p-3 bg-white rounded shadow text-sm">
            <div>{index + 1}. {rs.site?.site_code} – {rs.site?.site_name}</div>
          </div>
        ))}
      </div>

      <h3 className="text-md font-semibold">Tasks Summary</h3>
      <div className="grid grid-cols-2 gap-3">
        <SummaryBox label="Denomination Plans" value={taskSummary?.denomCount} />
        <SummaryBox label="Cash Pickup" value={taskSummary?.pickupCount} />
        <SummaryBox label="ATM Loads" value={taskSummary?.loadCount} />
        <SummaryBox label="Issues Logged" value={taskSummary?.issueCount} />
      </div>
    </div>
  );
}

//
// ----------------------------------------------------
// Admin Dashboard UI
// ----------------------------------------------------

function AdminDashboard({ adminAssignments, issueSummary }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">Admin Overview</h2>

      <h3 className="text-md font-semibold">Today's Assignments</h3>
      <div className="space-y-3">
        {adminAssignments.map((a: any) => (
          <div key={a.id} className="p-4 bg-white rounded shadow text-sm">
            <div className="font-semibold">{a.title}</div>
            <div>Custodian: {a.custodian?.full_name || "-"}</div>
            <div>Supervisor: {a.supervisor?.full_name || "-"}</div>
            <div>Status: {a.status}</div>
          </div>
        ))}
      </div>

      <h3 className="text-md font-semibold">Issue Summary</h3>
      <div className="grid grid-cols-3 gap-3">
        <SummaryBox label="New" value={issueSummary?.new} />
        <SummaryBox label="In Progress" value={issueSummary?.inProgress} />
        <SummaryBox label="Resolved" value={issueSummary?.resolved} />
      </div>
    </div>
  );
}

//
// ----------------------------------------------------
// Small component for summary numbers
// ----------------------------------------------------

function SummaryBox({ label, value }: any) {
  return (
    <div className="p-4 bg-white rounded shadow text-center">
      <div className="text-xl font-bold text-primary">{value}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
