import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

const DENOMS = [100, 200, 500, 2000];

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  return `${site.bank_name || "Bank"} – ${site.address || site.site_code}`;
}

function denomValue(count: number, denom: number) {
  return count * denom;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [pickups, setPickups] = useState<any[]>([]);
  const [adjustments, setAdjustments] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const [cashUtil, setCashUtil] = useState<any>(null);
  const [denomSummary, setDenomSummary] = useState<any>(null);
  const [loadedBySite, setLoadedBySite] = useState<any[]>([]);
  const [kpiOpen, setKpiOpen] = useState(true);

  useEffect(() => {
    if (!profile || profile.role !== "custodian") return;
    loadDashboard();
  }, [profile]);

  async function loadDashboard() {
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
      setLoading(false);
      return;
    }

    setAssignment(assign);

    const [rs, ls, cps, adj, dp] = await Promise.all([
      supabase
        .from("route_sites")
        .select("*, site:site_id(bank_name,address,site_code)")
        .eq("assignment_id", assign.id),
      supabase.from("atm_replenishments").select("*").eq("assignment_id", assign.id),
      supabase.from("cash_pickups").select("*").eq("assignment_id", assign.id),
      supabase.from("atm_cash_adjustments").select("*").eq("assignment_id", assign.id),
      supabase.from("denomination_plans").select("*").eq("assignment_id", assign.id),
    ]);

    setRouteSites(rs.data || []);
    setLoads(ls.data || []);
    setPickups(cps.data || []);
    setAdjustments(adj.data || []);
    setPlans(dp.data || []);

    computeCash(cps.data || [], ls.data || [], adj.data || []);
    computeDenoms(cps.data || [], ls.data || [], adj.data || []);
    computeLoadedBySite(rs.data || [], ls.data || [], dp.data || []);

    setLoading(false);
  }

  function computeCash(pickups: any[], loads: any[], adjustments: any[]) {
    const picked = pickups.reduce((s, p) => s + (p.total_amount || 0), 0);
    const loaded = loads.reduce(
      (s, l) =>
        s + DENOMS.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
      0
    );
    const adjusted = adjustments.reduce(
      (s, a) =>
        s + DENOMS.reduce((ds, d) => ds + (a[`denom_${d}`] || 0) * d, 0),
      0
    );

    setCashUtil({
      picked,
      adjusted,
      loaded,
      inHand: picked - loaded + adjusted,
    });
  }

  function computeDenoms(pickups: any[], loads: any[], adjustments: any[]) {
    const picked: any = {};
    const adjusted: any = {};
    const loaded: any = {};
    const inHand: any = {};

    DENOMS.forEach(d => {
      picked[d] = pickups.reduce((s, p) => s + (p[`denom_${d}`] || 0), 0);
      adjusted[d] = adjustments.reduce((s, a) => s + (a[`denom_${d}`] || 0), 0);
      loaded[d] = loads.reduce((s, l) => s + (l[`denom_${d}`] || 0), 0);
      inHand[d] = picked[d] - loaded[d] + adjusted[d];
    });

    setDenomSummary({ picked, adjusted, loaded, inHand });
  }

  function computeLoadedBySite(routeSites: any[], loads: any[], plans: any[]) {
    const map: any = {};

    loads.forEach(l => {
      if (!map[l.site_id]) {
        map[l.site_id] = {
          site_id: l.site_id,
          denoms: {},
          loadedValue: 0,
          plannedValue: 0,
        };
      }

      DENOMS.forEach(d => {
        const count = l[`denom_${d}`] || 0;
        map[l.site_id].denoms[d] =
          (map[l.site_id].denoms[d] || 0) + count;
        map[l.site_id].loadedValue += count * d;
      });
    });

    plans.forEach(p => {
      if (!map[p.site_id]) {
        map[p.site_id] = {
          site_id: p.site_id,
          denoms: {},
          loadedValue: 0,
          plannedValue: 0,
        };
      }

      DENOMS.forEach(d => {
        map[p.site_id].plannedValue += (p[`denom_${d}`] || 0) * d;
      });
    });

    setLoadedBySite(
      Object.values(map).map((x: any) => ({
        ...x,
        variance: x.loadedValue - x.plannedValue,
        site: routeSites.find(r => r.site_id === x.site_id)?.site,
      }))
    );
  }

  const loadedSiteIds = new Set(loads.map(l => l.site_id));
  const pendingSites = routeSites.filter(r => !loadedSiteIds.has(r.site_id));

  return (
    <AppLayout>
      {loading && <div className="text-center text-sm">Loading…</div>}

      {!loading && assignment && (
        <div className="space-y-4 pb-24 px-2 max-w-full overflow-x-hidden">

          {/* KPI */}
          <div className="bg-white rounded shadow">
            <button
              onClick={() => setKpiOpen(!kpiOpen)}
              className="w-full flex justify-between px-4 py-3 font-semibold"
            >
              Cash Summary <span>{kpiOpen ? "▲" : "▼"}</span>
            </button>

            {kpiOpen && cashUtil && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
                <Stat label="Picked" value={`₹${cashUtil.picked}`} />
                <Stat label="Adjusted" value={`₹${cashUtil.adjusted}`} />
                <Stat label="Loaded" value={`₹${cashUtil.loaded}`} />
                <Stat
                  label="In Hand"
                  value={`₹${cashUtil.inHand}`}
                  highlight={cashUtil.inHand < 0 ? "warn" : "ok"}
                />
              </div>
            )}
          </div>

          {/* DENOMINATION-WISE CASH POSITION */}
          {denomSummary && (
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-3">
                Denomination-wise Cash Position
              </h3>

              {/* Desktop table */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border p-2">Denom</th>
                      <th className="border p-2 text-right">Picked</th>
                      <th className="border p-2 text-right">Adjusted</th>
                      <th className="border p-2 text-right">Loaded</th>
                      <th className="border p-2 text-right">In Hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DENOMS.map(d => (
                      <tr key={d}>
                        <td className="border p-2 font-medium">₹{d}</td>
                        <td className="border p-2 text-right">
                          {denomSummary.picked[d]} / ₹{denomValue(denomSummary.picked[d], d)}
                        </td>
                        <td className="border p-2 text-right">
                          {denomSummary.adjusted[d]} / ₹{denomValue(denomSummary.adjusted[d], d)}
                        </td>
                        <td className="border p-2 text-right">
                          {denomSummary.loaded[d]} / ₹{denomValue(denomSummary.loaded[d], d)}
                        </td>
                        <td className="border p-2 text-right font-semibold">
                          {denomSummary.inHand[d]} / ₹{denomValue(denomSummary.inHand[d], d)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="sm:hidden space-y-2">
                {DENOMS.map(d => (
                  <div key={d} className="border rounded p-3 text-sm">
                    <div className="font-semibold mb-1">₹{d}</div>
                    <div>Picked: {denomSummary.picked[d]} (₹{denomValue(denomSummary.picked[d], d)})</div>
                    <div>Adjusted: {denomSummary.adjusted[d]} (₹{denomValue(denomSummary.adjusted[d], d)})</div>
                    <div>Loaded: {denomSummary.loaded[d]} (₹{denomValue(denomSummary.loaded[d], d)})</div>
                    <div className="font-semibold">
                      In Hand: {denomSummary.inHand[d]} (₹{denomValue(denomSummary.inHand[d], d)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Loaded ATMs */}
          {loadedBySite.length > 0 && (
            <div className="bg-white rounded shadow p-4 hidden sm:block">
              <h3 className="font-semibold mb-3">
                Loaded ATMs – Denomination & Variance
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border p-2 text-left">ATM</th>
                      {DENOMS.map(d => (
                        <th key={d} className="border p-2 text-right">
                          ₹{d} (Cnt / Val)
                        </th>
                      ))}
                      <th className="border p-2 text-right">Planned ₹</th>
                      <th className="border p-2 text-right">Loaded ₹</th>
                      <th className="border p-2 text-right">Variance ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadedBySite.map(row => (
                      <tr key={row.site_id}>
                        <td className="border p-2">
                          {formatSite(row.site)}
                        </td>
                        {DENOMS.map(d => (
                          <td key={d} className="border p-2 text-right">
                            {row.denoms[d] || 0} / ₹
                            {denomValue(row.denoms[d] || 0, d)}
                          </td>
                        ))}
                        <td className="border p-2 text-right">₹{row.plannedValue}</td>
                        <td className="border p-2 text-right">₹{row.loadedValue}</td>
                        <td className={`border p-2 text-right font-semibold ${row.variance !== 0 ? "text-red-600" : ""}`}>
                          ₹{row.variance}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Pending ATMs */}
          {pendingSites.length > 0 && (
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-2">Pending ATMs</h3>
              {pendingSites.map(rs => (
                <div key={rs.id} className="text-sm border-b py-1">
                  {formatSite(rs.site)}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </AppLayout>
  );
}

function Stat({ label, value, highlight }: any) {
  return (
    <div
      className={`rounded p-3 text-center ${
        highlight === "warn"
          ? "bg-yellow-100"
          : highlight === "ok"
          ? "bg-green-100"
          : "bg-slate-50"
      }`}
    >
      <div className="font-bold text-lg">{value}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
