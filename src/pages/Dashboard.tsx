import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

const DENOMS = [2000, 500, 200, 100, 50, 20, 10];

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Custodian data
  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [taskSummary, setTaskSummary] = useState<any>(null);
  const [cashUtil, setCashUtil] = useState<any>(null);

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
  // CUSTODIAN DASHBOARD (DATE-FIRST)
  // --------------------------------------------------
  async function loadCustodianDashboard() {
    setLoading(true);

    const { data: assign } = await supabase
      .from("assignments")
      .select("*")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
      .eq("status", "open")
      .maybeSingle();

    if (!assign) {
      setAssignment(null);
      setRouteSites([]);
      setTaskSummary(null);
      setCashUtil(null);
      setLoading(false);
      return;
    }

    setAssignment(assign);

    const { data: rsites } = await supabase
      .from("route_sites")
      .select("*, site:site_id(site_code)")
      .eq("assignment_id", assign.id)
      .order("sequence_no");

    setRouteSites(rsites || []);

    const [denoms, pickups, loads, issues] = await Promise.all([
      supabase.from("denomination_plans").select("*", { count: "exact", head: true }).eq("assignment_id", assign.id),
      supabase.from("cash_pickups").select("*", { count: "exact", head: true }).eq("assignment_id", assign.id),
      supabase.from("atm_replenishments").select("*", { count: "exact", head: true }).eq("assignment_id", assign.id),
      supabase.from("technical_issues").select("*", { count: "exact", head: true }).eq("assignment_id", assign.id),
    ]);

    setTaskSummary({
      denomCount: denoms.count || 0,
      pickupCount: pickups.count || 0,
      loadCount: loads.count || 0,
      issueCount: issues.count || 0,
    });

    await loadCashUtilization(assign.id, rsites || []);
    setLoading(false);
  }

  // --------------------------------------------------
  // CASH UTILIZATION LOGIC
  // --------------------------------------------------
  async function loadCashUtilization(assignmentId: number, rsites: any[]) {
    const { data: pickups } = await supabase.from("cash_pickups").select("*").eq("assignment_id", assignmentId);
    const { data: loads } = await supabase.from("atm_replenishments").select("*").eq("assignment_id", assignmentId);
    const { data: plans } = await supabase.from("denomination_plans").select("*").eq("assignment_id", assignmentId);

    const totalPicked = pickups?.reduce((s, p) => s + (p.total_amount || 0), 0) || 0;

    const totalLoaded =
      loads?.reduce(
        (s, l) =>
          s +
          DENOMS.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
        0
      ) || 0;

    const denomInHand: any = {};
    DENOMS.forEach(d => {
      const picked = pickups?.reduce((s, p) => s + (p[`denom_${d}`] || 0), 0) || 0;
      const loaded = loads?.reduce((s, l) => s + (l[`denom_${d}`] || 0), 0) || 0;
      denomInHand[d] = picked - loaded;
    });

    const loadedSites = new Set(loads?.map(l => l.site_id)).size;
    const totalSites = rsites.length;
    const remainingSites = totalSites - loadedSites;

    const remainingCash =
      plans?.reduce(
        (s, p) =>
          s +
          DENOMS.reduce((ds, d) => ds + (p[`denom_${d}`] || 0) * d, 0),
        0
      ) - totalLoaded;

    const cashInHand = totalPicked - totalLoaded;
    const avgPerSite = remainingSites > 0 ? remainingCash / remainingSites : 0;
    const sitesCovered = avgPerSite > 0 ? Math.floor(cashInHand / avgPerSite) : remainingSites;

    setCashUtil({
      totalSites,
      loadedSites,
      remainingSites,
      totalPicked,
      totalLoaded,
      cashInHand,
      remainingCash,
      buffer: cashInHand - remainingCash,
      denomInHand,
      sitesCovered,
    });
  }

  function printCashReport() {
    window.print();
  }

  // --------------------------------------------------
  // ADMIN DASHBOARD (UNCHANGED)
  // --------------------------------------------------
  async function loadAdminDashboard() {
    setLoading(true);

    const { data: assigns } = await supabase
      .from("assignments")
      .select("*, custodian:custodian_id(full_name)")
      .eq("assignment_date", today);

    setAdminAssignments(assigns || []);

    const [newIssues, inProgress, resolved] = await Promise.all([
      supabase.from("technical_issues").select("*", { count: "exact", head: true }).eq("status", "new"),
      supabase.from("technical_issues").select("*", { count: "exact", head: true }).eq("status", "in_progress"),
      supabase.from("technical_issues").select("*", { count: "exact", head: true }).eq("status", "resolved"),
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
      {loading && <div className="text-center text-sm text-slate-500">Loading...</div>}

      {!loading && profile?.role === "custodian" && (
        <CustodianDashboard
          assignment={assignment}
          routeSites={routeSites}
          taskSummary={taskSummary}
          cashUtil={cashUtil}
          onPrint={printCashReport}
        />
      )}

      {!loading && (profile?.role === "admin" || profile?.role === "supervisor") && (
        <AdminDashboard adminAssignments={adminAssignments} issueSummary={issueSummary} />
      )}
    </AppLayout>
  );
}

// --------------------------------------------------
// Custodian UI
// --------------------------------------------------
function CustodianDashboard({ assignment, routeSites, taskSummary, cashUtil, onPrint }: any) {
  return (
    <div className="space-y-6 print:p-6">
      <h2 className="text-lg font-semibold text-primary">Today’s Assignment</h2>

      {!assignment && <div className="p-4 bg-yellow-100 rounded">No assignment created for today.</div>}

      {assignment && (
        <>
          <div className="p-4 bg-white rounded shadow text-sm">
            <div className="font-semibold">Assignment ID: {assignment.id}</div>
            <div>Status: {assignment.status}</div>
          </div>

          <h3 className="font-semibold">Route Sites</h3>
          {routeSites.length === 0 && <div className="p-3 bg-slate-100 rounded text-sm">Route not assigned yet.</div>}
          {routeSites.map((rs: any, idx: number) => (
            <div key={rs.id} className="p-3 bg-white rounded shadow text-sm">
              {idx + 1}. {rs.site?.site_code}
            </div>
          ))}

          <h3 className="font-semibold">Tasks Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <SummaryBox label="Denomination Plans" value={taskSummary?.denomCount} />
            <SummaryBox label="Cash Pickup" value={taskSummary?.pickupCount} />
            <SummaryBox label="ATM Loads" value={taskSummary?.loadCount} />
            <SummaryBox label="Issues Logged" value={taskSummary?.issueCount} />
          </div>

          {cashUtil && <CashUtilization cashUtil={cashUtil} onPrint={onPrint} />}
        </>
      )}
    </div>
  );
}

// --------------------------------------------------
function CashUtilization({ cashUtil, onPrint }: any) {
  return (
    <div className="space-y-4">
      <h3 className="font-semibold">Cash Utilization – Today</h3>

      {/* Predictive Warning */}
      <div
        className={`p-3 rounded text-sm font-semibold ${
          cashUtil.sitesCovered < cashUtil.remainingSites
            ? "bg-red-100 text-red-800"
            : "bg-green-100 text-green-800"
        }`}
      >
        {cashUtil.sitesCovered < cashUtil.remainingSites
          ? `⚠️ You may run out of cash after ${cashUtil.sitesCovered} more site(s)`
          : "✅ Cash in hand is sufficient for remaining sites"}
      </div>

      <div className="grid grid-cols-3 gap-3 text-sm">
        <SummaryBox label="Total Sites" value={cashUtil.totalSites} />
        <SummaryBox label="Loaded" value={cashUtil.loadedSites} />
        <SummaryBox label="Remaining" value={cashUtil.remainingSites} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <SummaryBox label="Cash Picked" value={`₹${cashUtil.totalPicked.toLocaleString()}`} />
        <SummaryBox label="Cash Loaded" value={`₹${cashUtil.totalLoaded.toLocaleString()}`} />
        <SummaryBox label="Cash In Hand" value={`₹${cashUtil.cashInHand.toLocaleString()}`} />
        <SummaryBox label="Cash Required" value={`₹${cashUtil.remainingCash.toLocaleString()}`} />
      </div>

      <div className={`p-3 rounded text-sm ${cashUtil.buffer >= 0 ? "bg-green-100" : "bg-red-100"}`}>
        Buffer / Shortfall: ₹{cashUtil.buffer.toLocaleString()}
      </div>

      <div className="bg-white rounded shadow p-3 text-sm">
        <div className="font-semibold mb-2">Denomination In Hand</div>
        {Object.entries(cashUtil.denomInHand).map(([d, c]: any) => (
          <div key={d} className="flex justify-between">
            <span>₹{d} × {c}</span>
            <span>₹{(Number(d) * c).toLocaleString()}</span>
          </div>
        ))}
      </div>

      <button
        onClick={onPrint}
        className="bg-primary text-white px-4 py-2 rounded text-sm print:hidden"
      >
        🖨️ Print Cash Report
      </button>
    </div>
  );
}

// --------------------------------------------------
function AdminDashboard({ adminAssignments, issueSummary }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">Admin Overview</h2>

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
        <SummaryBox label="In Progress" value={issueSummary?.inProgress} />
        <SummaryBox label="Resolved" value={issueSummary?.resolved} />
      </div>
    </div>
  );
}

// --------------------------------------------------
function SummaryBox({ label, value }: any) {
  return (
    <div className="p-4 bg-white rounded shadow text-center">
      <div className="text-xl font-bold text-primary">{value ?? 0}</div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
