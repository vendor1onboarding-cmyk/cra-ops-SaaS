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
  const [adjustments, setAdjustments] = useState<any[]>([]);

  const [cashUtil, setCashUtil] = useState<any>(null);
  const [denomSummary, setDenomSummary] = useState<any>(null);
  const [loadedBySite, setLoadedBySite] = useState<any[]>([]);

  const [kpiOpen, setKpiOpen] = useState(true);

  useEffect(() => {
    if (!profile) return;
    if (profile.role === "custodian") loadCustodianDashboard();
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

    const [rs, ls, cps, adj] = await Promise.all([
      supabase
        .from("route_sites")
        .select("*, site:site_id(bank_name,address,site_code)")
        .eq("assignment_id", assign.id),
      supabase
        .from("atm_replenishments")
        .select("*")
        .eq("assignment_id", assign.id),
      supabase
        .from("cash_pickups")
        .select("*")
        .eq("assignment_id", assign.id),
      supabase
        .from("atm_cash_adjustments")
        .select("*")
        .eq("assignment_id", assign.id),
    ]);

    setRouteSites(rs.data || []);
    setLoads(ls.data || []);
    setPickups(cps.data || []);
    setAdjustments(adj.data || []);

    computeCash(cps.data || [], ls.data || [], adj.data || []);
    computeDenoms(cps.data || [], ls.data || [], adj.data || []);
    computeLoadedBySite(rs.data || [], ls.data || []);

    setLoading(false);
  }

  function computeCash(pickups: any[], loads: any[], adjustments: any[]) {
    const picked = pickups.reduce((s, p) => s + (p.total_amount || 0), 0);

    const loaded = loads.reduce(
      (s, l) =>
        s +
        DENOMS.reduce(
          (ds, d) => ds + (l[`denom_${d}`] || 0) * d,
          0
        ),
      0
    );

    const adjusted = adjustments.reduce(
      (s, a) =>
        s +
        DENOMS.reduce(
          (ds, d) => ds + (a[`denom_${d}`] || 0) * d,
          0
        ),
      0
    );

    setCashUtil({
      picked,
      loaded,
      adjusted,
      inHand: picked - loaded + adjusted,
    });
  }

  function computeDenoms(pickups: any[], loads: any[], adjustments: any[]) {
    const picked: any = {};
    const loaded: any = {};
    const adjusted: any = {};
    const inHand: any = {};

    DENOMS.forEach(d => {
      picked[d] = pickups.reduce((s, p) => s + (p[`denom_${d}`] || 0), 0);
      loaded[d] = loads.reduce((s, l) => s + (l[`denom_${d}`] || 0), 0);
      adjusted[d] = adjustments.reduce(
        (s, a) => s + (a[`denom_${d}`] || 0),
        0
      );
      inHand[d] = picked[d] - loaded[d] + adjusted[d];
    });

    setDenomSummary({ picked, loaded, adjusted, inHand });
  }

  function computeLoadedBySite(routeSites: any[], loads: any[]) {
    const map: any = {};
    loads.forEach(l => {
      if (!map[l.site_id]) {
        map[l.site_id] = { site_id: l.site_id, denoms: {} };
      }
      DENOMS.forEach(d => {
        map[l.site_id].denoms[d] =
          (map[l.site_id].denoms[d] || 0) + (l[`denom_${d}`] || 0);
      });
    });

    setLoadedBySite(
      Object.values(map).map((x: any) => ({
        ...x,
        site: routeSites.find(r => r.site_id === x.site_id)?.site,
      }))
    );
  }

  const loadedSiteIds = new Set(loads.map(l => l.site_id));
  const loadedSites = routeSites.filter(r => loadedSiteIds.has(r.site_id));
  const pendingSites = routeSites.filter(r => !loadedSiteIds.has(r.site_id));

  return (
    <AppLayout>
      {loading && <div className="text-center text-sm">Loading…</div>}

      {!loading && profile?.role === "custodian" && assignment && (
        <div className="space-y-6 pb-24 px-1">

          <h2 className="text-lg font-semibold">Custodian Dashboard – Today</h2>

          {/* KPI BAR */}
          <div className="bg-white rounded shadow">
            <button
              onClick={() => setKpiOpen(!kpiOpen)}
              className="w-full flex justify-between items-center px-4 py-3 font-semibold"
            >
              Cash Summary
              <span>{kpiOpen ? "▲" : "▼"}</span>
            </button>

            {kpiOpen && cashUtil && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4">
                <Stat label="Cash Picked" value={`₹${cashUtil.picked}`} />
                <Stat label="Cash Loaded" value={`₹${cashUtil.loaded}`} />
                <Stat label="Cash Adjusted" value={`₹${cashUtil.adjusted}`} />
                <Stat
                  label="Cash In Hand"
                  value={`₹${cashUtil.inHand}`}
                  highlight={cashUtil.inHand < 0 ? "warn" : "ok"}
                />
              </div>
            )}
          </div>

          {/* DENOMINATION CASH – DESKTOP TABLE */}
          {denomSummary && (
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-3">
                Denomination-wise Cash Position
              </h3>

              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border p-2">Denomination</th>
                      <th className="border p-2">Picked</th>
                      <th className="border p-2">Loaded</th>
                      <th className="border p-2">Adjusted</th>
                      <th className="border p-2">In Hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DENOMS.map(d => (
                      <tr key={d}>
                        <td className="border p-2">₹{d}</td>
                        <td className="border p-2">{denomSummary.picked[d]}</td>
                        <td className="border p-2">{denomSummary.loaded[d]}</td>
                        <td className="border p-2">{denomSummary.adjusted[d]}</td>
                        <td className="border p-2 font-semibold">
                          {denomSummary.inHand[d]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile */}
              <div className="sm:hidden space-y-2">
                {DENOMS.map(d => (
                  <div key={d} className="border rounded p-2 text-sm">
                    <div className="font-semibold">₹{d}</div>
                    <div className="text-xs">
                      Picked: {denomSummary.picked[d]} | Loaded:{" "}
                      {denomSummary.loaded[d]} | Adjusted:{" "}
                      {denomSummary.adjusted[d]} | In Hand:{" "}
                      {denomSummary.inHand[d]}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* LOADED ATMS – DESKTOP TABLE */}
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-3">
              Loaded ATMs ({loadedSites.length}/{routeSites.length})
            </h3>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="border p-2 text-left">ATM</th>
                    {DENOMS.map(d => (
                      <th key={d} className="border p-2 text-center">
                        ₹{d}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadedBySite.map(s => (
                    <tr key={s.site_id}>
                      <td className="border p-2 font-medium">
                        {formatSite(s.site)}
                      </td>
                      {DENOMS.map(d => (
                        <td key={d} className="border p-2 text-center">
                          {s.denoms[d] || 0}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="sm:hidden space-y-2">
              {loadedBySite.map(s => (
                <div key={s.site_id} className="border rounded p-3">
                  <div className="font-semibold mb-1">
                    {formatSite(s.site)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {DENOMS.map(d => (
                      <div key={d}>
                        ₹{d}: {s.denoms[d] || 0}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* PENDING ATMS */}
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

          {/* STICKY PRINT */}
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

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: "warn" | "ok";
}) {
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
      <div className="text-xs text-slate-700">{label}</div>
    </div>
  );
}
