import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import { Link } from "react-router-dom";

/**
 * Supported denominations only
 */
const DENOMS = [2000, 500, 200, 100];

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  /* ================= Custodian State ================= */
  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [cashUtil, setCashUtil] = useState<any>(null);
  const [denomSummary, setDenomSummary] = useState<any>(null);

  /* ================= Admin State ================= */
  const [adminAssignments, setAdminAssignments] = useState<any[]>([]);
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [filterStatus, setFilterStatus] = useState("all");
  const [counts, setCounts] = useState<any>({});

  useEffect(() => {
    if (!profile) return;

    profile.role === "custodian"
      ? loadCustodianDashboard()
      : loadAdminDashboard();
  }, [profile, filterDate, filterStatus]);

  /* ==================================================
     CUSTODIAN DASHBOARD
     ================================================== */
  async function loadCustodianDashboard() {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const { data: assign } = await supabase
      .from("assignments")
      .select("*")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
      .eq("status", "open")
      .maybeSingle();

    if (!assign) {
      setAssignment(null);
      setLoading(false);
      return;
    }

    setAssignment(assign);

    const [
      routeSitesRes,
      plansRes,
      loadsRes,
      pickupsRes,
    ] = await Promise.all([
      supabase
        .from("route_sites")
        .select("*, site:site_id(site_code, bank_name, address, atm_id)")
        .eq("assignment_id", assign.id)
        .order("sequence_no"),

      supabase
        .from("denomination_plans")
        .select("*, site:site_id(site_code, bank_name, address, atm_id)")
        .eq("assignment_id", assign.id),

      supabase
        .from("atm_replenishments")
        .select("*, site:site_id(site_code, bank_name, address, atm_id)")
        .eq("assignment_id", assign.id),

      supabase
        .from("cash_pickups")
        .select("*")
        .eq("assignment_id", assign.id),
    ]);

    setRouteSites(routeSitesRes.data || []);
    setPlans(plansRes.data || []);
    setLoads(loadsRes.data || []);

    computeCashUtil(pickupsRes.data || [], loadsRes.data || []);
    computeDenominationSummary(pickupsRes.data || [], loadsRes.data || []);

    setLoading(false);
  }

  function computeCashUtil(pickups: any[], loads: any[]) {
    const totalPicked = pickups.reduce(
      (s, p) => s + (p.total_amount || 0),
      0
    );

    const totalLoadedAmount = loads.reduce(
      (s, l) =>
        s +
        DENOMS.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
      0
    );

    setCashUtil({
      totalPicked,
      totalLoadedAmount,
      cashInHand: totalPicked - totalLoadedAmount,
    });
  }

  function computeDenominationSummary(pickups: any[], loads: any[]) {
    const picked: any = {};
    const loaded: any = {};
    const inHand: any = {};

    DENOMS.forEach(d => {
      picked[d] = pickups.reduce((s, p) => s + (p[`denom_${d}`] || 0), 0);
      loaded[d] = loads.reduce((s, l) => s + (l[`denom_${d}`] || 0), 0);
      inHand[d] = picked[d] - loaded[d];
    });

    setDenomSummary({ picked, loaded, inHand });
  }

  /* ==================================================
     ADMIN DASHBOARD (UNCHANGED)
     ================================================== */
  async function loadAdminDashboard() {
    setLoading(true);

    let query = supabase
      .from("assignments")
      .select("id, assignment_date, status, custodian_id")
      .eq("assignment_date", filterDate);

    if (filterStatus !== "all") {
      query = query.eq("status", filterStatus);
    }

    const { data: assigns } = await query;

    const custodianIds = [...new Set(assigns?.map(a => a.custodian_id))];

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", custodianIds);

    const map = new Map(profiles?.map(p => [p.id, p.full_name]));

    const merged = assigns?.map(a => ({
      ...a,
      custodian_name: map.get(a.custodian_id) || "Custodian",
    })) || [];

    setAdminAssignments(merged);

    const summary: any = {};
    merged.forEach(a => {
      summary[a.status] = (summary[a.status] || 0) + 1;
    });
    setCounts(summary);

    setLoading(false);
  }

  /* ==================================================
     UI
     ================================================== */
  const assignedATMCount = routeSites.length;
  const loadedATMCount = new Set(loads.map(l => l.site_id)).size;
  const pendingATMCount = assignedATMCount - loadedATMCount;

  const loadedSiteIds = new Set(loads.map(l => l.site_id));
  const loadedSites = routeSites.filter(rs => loadedSiteIds.has(rs.site_id));
  const pendingSites = routeSites.filter(rs => !loadedSiteIds.has(rs.site_id));

  return (
    <AppLayout>
      {loading && <div className="text-sm text-center">Loading…</div>}

      {/* ================= Custodian ================= */}
      {!loading && profile?.role === "custodian" && assignment && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Custodian Dashboard – Today</h2>

          {/* ATM COUNTS */}
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Assigned ATMs" value={assignedATMCount} />
            <Stat label="Loaded ATMs" value={loadedATMCount} />
            <Stat label="Pending ATMs" value={pendingATMCount} />
          </div>

          {/* CASH SUMMARY */}
          {cashUtil && (
            <div className="grid grid-cols-3 gap-3 text-sm">
              <Stat label="Cash Picked" value={`₹${cashUtil.totalPicked}`} />
              <Stat label="Cash Loaded" value={`₹${cashUtil.totalLoadedAmount}`} />
              <Stat label="Cash In Hand" value={`₹${cashUtil.cashInHand}`} />
            </div>
          )}

          {/* DENOMINATION SPLIT */}
          {denomSummary && (
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-3">Denomination-wise Cash Position</h3>
              <table className="w-full text-xs border">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2">Denom</th>
                    <th className="border p-2">Picked</th>
                    <th className="border p-2">Loaded</th>
                    <th className="border p-2">In Hand</th>
                  </tr>
                </thead>
                <tbody>
                  {DENOMS.map(d => (
                    <tr key={d}>
                      <td className="border p-2">₹{d}</td>
                      <td className="border p-2">{denomSummary.picked[d]}</td>
                      <td className="border p-2">{denomSummary.loaded[d]}</td>
                      <td className={`border p-2 ${denomSummary.inHand[d] < 0 ? "text-red-600" : ""}`}>
                        {denomSummary.inHand[d]}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ASSIGNED ROUTE SITES – GROUPED */}
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-3">Assigned Route Sites</h3>

            {/* LOADED ATMs */}
            {loadedSites.length > 0 && (
              <>
                <h4 className="text-sm font-semibold text-green-700 mb-2">✅ Loaded ATMs</h4>
                {loadedSites.map(rs => {
                  const plan = plans.find(p => p.site_id === rs.site_id);
                  const load = loads.find(l => l.site_id === rs.site_id);

                  const plannedTotal = plan
                    ? DENOMS.reduce((s, d) => s + (plan[`denom_${d}`] || 0) * d, 0)
                    : 0;

                  const loadedTotal = load
                    ? DENOMS.reduce((s, d) => s + (load[`denom_${d}`] || 0) * d, 0)
                    : 0;

                  const variance = loadedTotal - plannedTotal;

                  return (
                    <details key={rs.id} className="mb-3 border rounded">
                      <summary className="cursor-pointer px-3 py-2 bg-slate-50 text-sm font-medium">
                        {formatSite(rs.site)}
                      </summary>

                      <div className="p-3 text-sm space-y-2">
                        <div className={`font-semibold ${variance !== 0 ? "text-red-600" : "text-green-600"}`}>
                          Planned ₹{plannedTotal} | Loaded ₹{loadedTotal} | Δ ₹{variance}
                        </div>

                        {!plan && (
                          <div className="p-2 bg-red-100 text-red-700 rounded text-xs">
                            ⚠️ Denomination plan missing (planned assumed as 0)
                          </div>
                        )}

                        <div className="mt-2 space-y-1">
                          {DENOMS.map(d => {
                            const pVal = plan?.[`denom_${d}`] || 0;
                            const lVal = load[`denom_${d}`] || 0;
                            return (
                              <div key={d} className="flex justify-between text-xs">
                                <span>₹{d}</span>
                                <span>Planned {pVal} | Loaded {lVal} | Δ {lVal - pVal}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  );
                })}
              </>
            )}

            {/* PENDING ATMs */}
            {pendingSites.length > 0 && (
              <>
                <h4 className="text-sm font-semibold text-yellow-700 mt-4 mb-2">⏳ Pending ATMs</h4>
                {pendingSites.map(rs => (
                  <div key={rs.id} className="border rounded p-3 mb-2 text-sm bg-yellow-50">
                    <div className="font-medium">{formatSite(rs.site)}</div>
                    <div className="text-xs text-yellow-800 mt-1">ATM not yet loaded</div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* ================= Admin ================= */}
      {!loading && profile?.role !== "custodian" && (
        <div className="space-y-4 max-w-5xl mx-auto">
          <h2 className="text-lg font-semibold">Admin Dashboard</h2>

          <div className="flex gap-3 text-sm">
            <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="border px-2 py-1 rounded" />
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border px-2 py-1 rounded">
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="grid grid-cols-4 gap-3 text-sm">
            {["open", "submitted", "approved", "rejected"].map(s => (
              <Stat key={s} label={s} value={counts[s] || 0} />
            ))}
          </div>

          {adminAssignments.map(a => (
            <div key={a.id} className="bg-white p-4 rounded shadow text-sm">
              <div><strong>Custodian:</strong> {a.custodian_name}</div>
              <div><strong>Status:</strong> {a.status}</div>
              <Link to={`/admin/eod/${a.id}`} className="text-blue-600 underline text-xs">
                View EOD Detail →
              </Link>
            </div>
          ))}
        </div>
      )}
    </AppLayout>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="bg-white p-3 rounded shadow text-center">
      <div className="font-bold">{value}</div>
      <div className="text-xs text-slate-600 capitalize">{label}</div>
    </div>
  );
}
