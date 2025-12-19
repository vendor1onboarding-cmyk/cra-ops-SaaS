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
  const [siteLoads, setSiteLoads] = useState<any[]>([]); // 🔹 NEW

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
      setSiteLoads([]);
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

    const { data: loads } = await supabase
      .from("atm_replenishments")
      .select("*, site:site_id(site_code)")
      .eq("assignment_id", assign.id);

    setSiteLoads(loads || []);

    const [denoms, pickups, issues] = await Promise.all([
      supabase.from("denomination_plans").select("*", { count: "exact", head: true }).eq("assignment_id", assign.id),
      supabase.from("cash_pickups").select("*", { count: "exact", head: true }).eq("assignment_id", assign.id),
      supabase.from("technical_issues").select("*", { count: "exact", head: true }).eq("assignment_id", assign.id),
    ]);

    setTaskSummary({
      denomCount: denoms.count || 0,
      pickupCount: pickups.count || 0,
      loadCount: loads?.length || 0,
      issueCount: issues.count || 0,
    });

    await loadCashUtilization(assign.id, rsites || [], loads || []);
    setLoading(false);
  }

  // --------------------------------------------------
  // CASH UTILIZATION LOGIC
  // --------------------------------------------------
  async function loadCashUtilization(
    assignmentId: number,
    rsites: any[],
    loads: any[]
  ) {
    const { data: pickups } = await supabase
      .from("cash_pickups")
      .select("*")
      .eq("assignment_id", assignmentId);

    const { data: plans } = await supabase
      .from("denomination_plans")
      .select("*")
      .eq("assignment_id", assignmentId);

    const totalPicked =
      pickups?.reduce((s, p) => s + (p.total_amount || 0), 0) || 0;

    const totalLoaded =
      loads.reduce(
        (s, l) =>
          s +
          DENOMS.reduce(
            (ds, d) => ds + (l[`denom_${d}`] || 0) * d,
            0
          ),
        0
      );

    const denomInHand: any = {};
    DENOMS.forEach(d => {
      const picked =
        pickups?.reduce((s, p) => s + (p[`denom_${d}`] || 0), 0) || 0;
      const loaded =
        loads?.reduce((s, l) => s + (l[`denom_${d}`] || 0), 0) || 0;
      denomInHand[d] = picked - loaded;
    });

    const loadedSites = new Set(loads.map(l => l.site_id)).size;
    const totalSites = rsites.length;
    const remainingSites = totalSites - loadedSites;

    const remainingCash =
      plans?.reduce(
        (s, p) =>
          s +
          DENOMS.reduce(
            (ds, d) => ds + (p[`denom_${d}`] || 0) * d,
            0
          ),
        0
      ) - totalLoaded;

    const cashInHand = totalPicked - totalLoaded;
    const avgPerSite =
      remainingSites > 0 ? remainingCash / remainingSites : 0;
    const sitesCovered =
      avgPerSite > 0 ? Math.floor(cashInHand / avgPerSite) : remainingSites;

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
        <div className="space-y-6 print:p-6">
          <h2 className="text-lg font-semibold text-primary">
            Today’s Assignment
          </h2>

          {!assignment && (
            <div className="p-4 bg-yellow-100 rounded">
              No assignment created for today.
            </div>
          )}

          {assignment && cashUtil && (
            <>
              {/* 🔹 Predictive Warning */}
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

              {/* 🔹 Cash Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <SummaryBox label="Cash Picked" value={`₹${cashUtil.totalPicked.toLocaleString()}`} />
                <SummaryBox label="Cash Loaded" value={`₹${cashUtil.totalLoaded.toLocaleString()}`} />
                <SummaryBox label="Cash In Hand" value={`₹${cashUtil.cashInHand.toLocaleString()}`} />
                <SummaryBox label="Remaining Sites" value={cashUtil.remainingSites} />
              </div>

              {/* 🔹 SITE-WISE LOADED DENOMINATIONS */}
              <div className="bg-white rounded shadow p-4">
                <h3 className="font-semibold mb-3">
                  Site-wise Loaded Denominations
                </h3>

                {siteLoads.length === 0 && (
                  <div className="text-sm text-slate-500">
                    No ATM loads done yet.
                  </div>
                )}

                {siteLoads.map((l: any) => {
                  const siteTotal = DENOMS.reduce(
                    (s, d) => s + (l[`denom_${d}`] || 0) * d,
                    0
                  );

                  return (
                    <details key={l.id} className="mb-2 border rounded">
                      <summary className="cursor-pointer px-3 py-2 bg-slate-50 text-sm font-medium">
                        {l.site?.site_code} – ₹{siteTotal.toLocaleString()}
                      </summary>

                      <div className="p-3 text-sm space-y-1">
                        {DENOMS.map(d =>
                          l[`denom_${d}`] ? (
                            <div key={d} className="flex justify-between">
                              <span>₹{d} × {l[`denom_${d}`]}</span>
                              <span>
                                ₹{(l[`denom_${d}`] * d).toLocaleString()}
                              </span>
                            </div>
                          ) : null
                        )}
                      </div>
                    </details>
                  );
                })}
              </div>

              <button
                onClick={printCashReport}
                className="bg-primary text-white px-4 py-2 rounded text-sm print:hidden"
              >
                🖨️ Print Cash Report
              </button>
            </>
          )}
        </div>
      )}
    </AppLayout>
  );
}

// --------------------------------------------------
function SummaryBox({ label, value }: any) {
  return (
    <div className="p-4 bg-white rounded shadow text-center">
      <div className="text-xl font-bold text-primary">
        {value ?? 0}
      </div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}
