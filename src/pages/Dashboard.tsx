import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Custodian data
  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [taskSummary, setTaskSummary] = useState<any>(null);

  // Admin data
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

  // --------------------------------------------------
  // CUSTODIAN DASHBOARD (DATE-FIRST, NO FALLBACK)
  // --------------------------------------------------
  async function loadCustodianDashboard() {
    setLoading(true);

    // 1️⃣ Fetch TODAY's assignment only
    const { data: assign, error } = await supabase
      .from("assignments")
      .select("*")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
      .eq("status", "open")
      .maybeSingle();

    if (error || !assign) {
      setAssignment(null);
      setRouteSites([]);
      setTaskSummary(null);
      setLoading(false);
      return;
    }

    setAssignment(assign);

    // 2️⃣ Fetch route sites (may be empty)
    const { data: rsites } = await supabase
      .from("route_sites")
      .select("*, site:site_id(site_code)")
      .eq("assignment_id", assign.id)
      .order("sequence_no");

    setRouteSites(rsites || []);

    // 3️⃣ Task summary
    const [denoms, pickups, loads, issues] = await Promise.all([
      supabase
        .from("denomination_plans")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
      supabase
        .from("cash_pickups")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
      supabase
        .from("atm_replenishments")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
    ]);

    setTaskSummary({
      denomCount: denoms.count || 0,
      pickupCount: pickups.count || 0,
      loadCount: loads.count || 0,
      issueCount: issues.count || 0,
    });

    setLoading(false);
  }

  // --------------------------------------------------
  // ADMIN DASHBOARD (KEEP AS IS – DATE BASED)
  // --------------------------------------------------
  async function loadAdminDashboard() {
    setLoading(true);

    const { data: assigns } = await supabase
      .from("assignments")
      .select("*, custodian:custodian_id(full_name)")
      .eq("assignment_date", today);

    setAdminAssignments(assigns || []);

    const [newIssues, inProgress, resolved] = await Promise.all([
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved"),
    ]);

    setIssueSummary({
      new: newIssues.count || 0,
      inProgress: inProgress.count || 0,
      resolved: resolved.count || 0,
    });

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      {loading && (
        <div className="text-center text-sm text-slate-500">
          Loading...
        </div>
      )}

      {!loading && profile?.role === "custodian" && (
        <CustodianDashboard
          assignment={assignment}
          routeSites={routeSites}
          taskSummary={taskSummary}
        />
      )}

      {!loading &&
        (profile?.role === "admin" ||
          profile?.role === "supervisor") && (
          <AdminDashboard
            adminAssignments={adminAssignments}
            issueSummary={issueSummary}
          />
        )}
    </AppLayout>
  );
}

// --------------------------------------------------
// Custodian UI
// --------------------------------------------------
function CustodianDashboard({ assignment, routeSites, taskSummary }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">
        Today’s Assignment
      </h2>

      {!assignment && (
        <div className="p-4 bg-yellow-100 rounded">
          No assignment created for today.
        </div>
      )}

      {assignment && (
        <>
          <div className="p-4 bg-white rounded shadow text-sm">
            <div className="font-semibold">
              Assignment ID: {assignment.id}
            </div>
            <div>Status: {assignment.status}</div>
          </div>

          <h3 className="font-semibold">Route Sites</h3>

          {routeSites.length === 0 && (
            <div className="p-3 bg-slate-100 rounded text-sm">
              Route not assigned yet.
            </div>
          )}

          {routeSites.map((rs: any, idx: number) => (
            <div
              key={rs.id}
              className="p-3 bg-white rounded shadow text-sm"
            >
              {idx + 1}. {rs.site?.site_code}
            </div>
          ))}

          <h3 className="font-semibold">Tasks Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <SummaryBox
              label="Denomination Plans"
              value={taskSummary?.denomCount}
            />
            <SummaryBox
              label="Cash Pickup"
              value={taskSummary?.pickupCount}
            />
            <SummaryBox
              label="ATM Loads"
              value={taskSummary?.loadCount}
            />
            <SummaryBox
              label="Issues Logged"
              value={taskSummary?.issueCount}
            />
          </div>
        </>
      )}
    </div>
  );
}

// --------------------------------------------------
// Admin UI
// --------------------------------------------------
function AdminDashboard({ adminAssignments, issueSummary }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">
        Admin Overview
      </h2>

      <h3 className="font-semibold">Today’s Assignments</h3>
      {adminAssignments.map((a: any) => (
        <div key={a.id} className="p-4 bg-white rounded shadow text-sm">
          <div>Assignment ID: {a.id}</div>
          <div>Custodian: {a.custodian?.full_name}</div>
          <div>Status: {a.status}</div>
        </div>
      ))}

      <h3 className="font-semibold">Issue Summary</h3>
      <div className="grid grid-cols-3 gap-3">
        <SummaryBox label="New" value={issueSummary?.new} />
        <SummaryBox
          label="In Progress"
          value={issueSummary?.inProgress}
        />
        <SummaryBox
          label="Resolved"
          value={issueSummary?.resolved}
        />
      </div>
    </div>
  );
}

// --------------------------------------------------
function SummaryBox({ label, value }: any) {
  return (
    <div className="p-4 bg-white rounded shadow text-center">
      <div className="text-xl font-bold text-primary">
        {value || 0}
      </div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
