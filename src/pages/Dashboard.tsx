import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import { useNavigate } from "react-router-dom";

const DENOMS = [100, 200, 500, 2000];

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  return `${site.bank_name || "Bank"} – ${site.address || site.site_code}`;
}

export default function Dashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [pickups, setPickups] = useState<any[]>([]);
  const [cashUtil, setCashUtil] = useState<any>(null);
  const [denomSummary, setDenomSummary] = useState<any>(null);

  const [kpiOpen, setKpiOpen] = useState(true); // KPI COLLAPSE

  useEffect(() => {
    if (!profile) return;
    profile.role === "custodian"
      ? loadCustodianDashboard()
      : loadAdminDashboard();
  }, [profile]);

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
      setLoading(false);
      return;
    }

    setAssignment(assign);

    const [rs, ls, cps] = await Promise.all([
      supabase
        .from("route_sites")
        .select("*, site:site_id(bank_name,address)")
        .eq("assignment_id", assign.id),
      supabase
        .from("atm_replenishments")
        .select("*")
        .eq("assignment_id", assign.id),
      supabase
        .from("cash_pickups")
        .select("*")
        .eq("assignment_id", assign.id),
    ]);

    setRouteSites(rs.data || []);
    setLoads(ls.data || []);
    setPickups(cps.data || []);

    computeCash(cps.data || [], ls.data || []);
    computeDenoms(cps.data || [], ls.data || []);
    setLoading(false);
  }

  async function loadAdminDashboard() {
    setLoading(false); // unchanged admin logic
  }

  function computeCash(pickups: any[], loads: any[]) {
    const picked = pickups.reduce((s, p) => s + (p.total_amount || 0), 0);
    const loaded = loads.reduce(
      (s, l) =>
        s +
        DENOMS.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
      0
    );
    setCashUtil({ picked, loaded, inHand: picked - loaded });
  }

  function computeDenoms(pickups: any[], loads: any[]) {
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

  const loadedSiteIds = new Set(loads.map(l => l.site_id));
  const loadedSites = routeSites.filter(r => loadedSiteIds.has(r.site_id));
  const pendingSites = routeSites.filter(r => !loadedSiteIds.has(r.site_id));

  return (
    <AppLayout>
      {loading && <div className="text-center text-sm">Loading…</div>}

      {!loading && profile?.role === "custodian" && assignment && (
        <div className="space-y-6 pb-20 px-1">

          {/* HEADER */}
          <h2 className="text-lg font-semibold">Custodian Dashboard – Today</h2>

          {/* COLLAPSIBLE KPI BAR */}
          <div className="bg-white rounded shadow">
            <button
              onClick={() => setKpiOpen(!kpiOpen)}
              className="w-full flex justify-between items-center px-4 py-3 font-semibold"
            >
              Cash Summary
              <span>{kpiOpen ? "▲" : "▼"}</span>
            </button>

            {kpiOpen && cashUtil && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4">
                <Stat label="Cash Picked" value={`₹${cashUtil.picked}`} />
                <Stat label="Cash Loaded" value={`₹${cashUtil.loaded}`} />
                <Stat label="Cash In Hand" value={`₹${cashUtil.inHand}`} />
              </div>
            )}
          </div>

          {/* DENOMINATION – MOBILE ACCORDION */}
          {denomSummary && (
            <div className="bg-white rounded shadow">
              <details open className="sm:hidden">
                <summary className="p-3 font-semibold">
                  Denomination-wise Cash
                </summary>
                <div className="p-3 space-y-2 text-sm">
                  {DENOMS.map(d => (
                    <div key={d} className="border rounded p-2">
                      <div className="font-semibold">₹{d}</div>
                      <div className="text-xs">
                        Picked: {denomSummary.picked[d]} | Loaded:{" "}
                        {denomSummary.loaded[d]} | In Hand:{" "}
                        {denomSummary.inHand[d]}
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          )}

          {/* LOADED ATMs */}
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-2">
              Loaded ATMs ({loadedSites.length}/{routeSites.length})
            </h3>
            {loadedSites.map(rs => (
              <div key={rs.id} className="border rounded p-2 text-sm mb-1">
                {formatSite(rs.site)}
              </div>
            ))}
          </div>

          {/* PENDING ATMs */}
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

          {/* STICKY MOBILE PRINT BAR */}
          <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-white border-t shadow p-3">
            <button
              onClick={() => window.print()}
              className="w-full bg-slate-700 text-white py-2 rounded font-medium"
            >
              🖨️ Save / Print PDF
            </button>
          </div>
        </div>
      )}
    </AppLayout>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="bg-slate-50 rounded p-3 text-center">
      <div className="font-bold text-lg">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
