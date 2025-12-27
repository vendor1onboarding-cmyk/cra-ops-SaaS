import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import { useNavigate } from "react-router-dom";

const DENOMS_DESKTOP = [2000, 500, 200, 100];
const DENOMS_MOBILE = [2000, 500]; // hide low-value denoms on mobile

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  return `${site.bank_name} – ${site.address}${site.atm_id ? ` (ATM: ${site.atm_id})` : ""}`;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [cashUtil, setCashUtil] = useState<any>(null);
  const [denomSummary, setDenomSummary] = useState<any>(null);

  useEffect(() => {
    if (profile?.role === "custodian") loadCustodian();
  }, [profile]);

  async function loadCustodian() {
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

    const [rs, ps, ls, cs] = await Promise.all([
      supabase.from("route_sites").select("*, site:site_id(*)").eq("assignment_id", assign.id),
      supabase.from("denomination_plans").select("*").eq("assignment_id", assign.id),
      supabase.from("atm_replenishments").select("*").eq("assignment_id", assign.id),
      supabase.from("cash_pickups").select("*").eq("assignment_id", assign.id),
    ]);

    setRouteSites(rs.data || []);
    setPlans(ps.data || []);
    setLoads(ls.data || []);

    computeCash(cs.data || [], ls.data || []);
    computeDenoms(cs.data || [], ls.data || []);
    setLoading(false);
  }

  function computeCash(pickups: any[], loads: any[]) {
    const picked = pickups.reduce((s, p) => s + (p.total_amount || 0), 0);
    const loaded = loads.reduce(
      (s, l) => s + DENOMS_DESKTOP.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
      0
    );
    setCashUtil({ picked, loaded, inHand: picked - loaded });
  }

  function computeDenoms(pickups: any[], loads: any[]) {
    const r: any = { picked: {}, loaded: {}, inHand: {} };
    DENOMS_DESKTOP.forEach(d => {
      r.picked[d] = pickups.reduce((s, p) => s + (p[`denom_${d}`] || 0), 0);
      r.loaded[d] = loads.reduce((s, l) => s + (l[`denom_${d}`] || 0), 0);
      r.inHand[d] = r.picked[d] - r.loaded[d];
    });
    setDenomSummary(r);
  }

  if (loading) return <AppLayout><div className="text-center text-sm">Loading…</div></AppLayout>;

  if (!assignment) {
    return (
      <AppLayout>
        <div className="text-center text-sm text-slate-500">
          No assignment assigned for today.
        </div>
      </AppLayout>
    );
  }

  const loadedIds = new Set(loads.map(l => l.site_id));
  const loadedSites = routeSites.filter(r => loadedIds.has(r.site_id));
  const pendingSites = routeSites.filter(r => !loadedIds.has(r.site_id));

  return (
    <AppLayout>
      <div className="space-y-5">

        {/* HEADER */}
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold">Custodian Dashboard – Today</h2>
          <button
            onClick={() => window.print()}
            className="bg-slate-700 text-white px-3 py-2 rounded text-sm"
          >
            🖨️ Print / PDF
          </button>
        </div>

        {/* KPI GRID */}
        {cashUtil && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat label="Cash Picked" value={`₹${cashUtil.picked}`} />
            <Stat label="Cash Loaded" value={`₹${cashUtil.loaded}`} />
            <Stat label="Cash In Hand" value={`₹${cashUtil.inHand}`} />
          </div>
        )}

        {/* DESKTOP DENOM TABLE */}
        {denomSummary && (
          <div className="hidden md:block bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-2">Denomination-wise Cash Position</h3>
            <table className="w-full text-sm border">
              <thead className="bg-slate-100">
                <tr>
                  <th className="border p-2">₹</th>
                  <th className="border p-2">Picked</th>
                  <th className="border p-2">Loaded</th>
                  <th className="border p-2">In Hand</th>
                </tr>
              </thead>
              <tbody>
                {DENOMS_DESKTOP.map(d => (
                  <tr key={d}>
                    <td className="border p-2">₹{d}</td>
                    <td className="border p-2">{denomSummary.picked[d]}</td>
                    <td className="border p-2">{denomSummary.loaded[d]}</td>
                    <td className="border p-2">{denomSummary.inHand[d]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* MOBILE ACCORDION */}
        <div className="md:hidden space-y-3">
          <h3 className="font-semibold">Loaded ATMs</h3>

          {loadedSites.map(rs => {
            const plan = plans.find(p => p.site_id === rs.site_id);
            const load = loads.find(l => l.site_id === rs.site_id);

            return (
              <details key={rs.id} className="bg-white rounded shadow">
                <summary className="px-3 py-2 font-medium cursor-pointer">
                  {formatSite(rs.site)}
                </summary>

                <div className="p-3 space-y-1 text-sm">
                  {DENOMS_MOBILE.map(d => (
                    <div key={d} className="flex justify-between">
                      <span>₹{d}</span>
                      <span>
                        {load?.[`denom_${d}`] || 0} (Planned {plan?.[`denom_${d}`] || 0})
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            );
          })}

          {pendingSites.length > 0 && (
            <div className="bg-yellow-50 border p-3 rounded text-sm">
              <div className="font-semibold mb-1">Pending ATMs</div>
              {pendingSites.map(rs => (
                <div key={rs.id}>{formatSite(rs.site)}</div>
              ))}
            </div>
          )}
        </div>

      </div>
    </AppLayout>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="bg-white rounded shadow p-3 text-center">
      <div className="font-bold">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

