import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

const DENOMS = [2000, 500, 200, 100, 50, 20, 10];

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

  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [cashUtil, setCashUtil] = useState<any>(null);
  const [siteLoads, setSiteLoads] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!profile || profile.role !== "custodian") return;
    loadDashboard();
  }, [profile]);

  async function loadDashboard() {
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
      setLoading(false);
      return;
    }

    setAssignment(assign);

    const [{ data: rsites }, { data: loads }, { data: plansData }, { data: pickups }] =
      await Promise.all([
        supabase
          .from("route_sites")
          .select("*, site:site_id(site_code, bank_name, address, atm_id)")
          .eq("assignment_id", assign.id)
          .order("sequence_no"),

        supabase
          .from("atm_replenishments")
          .select("*, site:site_id(site_code, bank_name, address, atm_id)")
          .eq("assignment_id", assign.id),

        supabase
          .from("denomination_plans")
          .select("*")
          .eq("assignment_id", assign.id),

        supabase
          .from("cash_pickups")
          .select("*")
          .eq("assignment_id", assign.id),
      ]);

    setRouteSites(rsites || []);
    setSiteLoads(loads || []);
    setPlans(plansData || []);

    computeCashUtil(rsites || [], loads || [], plansData || [], pickups || []);
    setLoading(false);
  }

  function computeCashUtil(
    rsites: any[],
    loads: any[],
    plans: any[],
    pickups: any[]
  ) {
    const totalPicked = pickups.reduce((s, p) => s + (p.total_amount || 0), 0);

    const totalLoaded = loads.reduce(
      (s, l) =>
        s +
        DENOMS.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
      0
    );

    const loadedSites = new Set(loads.map(l => l.site_id)).size;
    const remainingSites = rsites.length - loadedSites;

    const remainingCash =
      plans.reduce(
        (s, p) =>
          s +
          DENOMS.reduce((ds, d) => ds + (p[`denom_${d}`] || 0) * d, 0),
        0
      ) - totalLoaded;

    setCashUtil({
      totalPicked,
      totalLoaded,
      cashInHand: totalPicked - totalLoaded,
      remainingCash,
      remainingSites,
    });
  }

  function printCashReport() {
    window.print();
  }

  return (
    <AppLayout>
      {loading && <div className="text-center text-sm">Loading…</div>}

      {!loading && assignment && (
        <div className="space-y-6 print:p-6">
          <h2 className="text-lg font-semibold">
            Cash Utilization – Today
          </h2>

          {cashUtil && (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Box label="Cash Picked" value={`₹${cashUtil.totalPicked.toLocaleString()}`} />
              <Box label="Cash Loaded" value={`₹${cashUtil.totalLoaded.toLocaleString()}`} />
              <Box label="Cash In Hand" value={`₹${cashUtil.cashInHand.toLocaleString()}`} />
              <Box label="Remaining Sites" value={cashUtil.remainingSites} />
            </div>
          )}

          {/* ROUTE SITES */}
          <div className="bg-white rounded shadow p-4">
            <h3 className="font-semibold mb-2">Route Sites</h3>
            {routeSites.map((rs: any, idx: number) => (
              <div key={rs.id} className="text-sm py-1">
                {idx + 1}. {formatSite(rs.site)}
              </div>
            ))}
          </div>

          {/* SITE-WISE LOADED DENOMINATIONS */}
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

              const plan = plans.find(p => p.site_id === l.site_id);
              const plannedTotal = plan
                ? DENOMS.reduce((s, d) => s + (plan[`denom_${d}`] || 0) * d, 0)
                : 0;

              const variance = siteTotal - plannedTotal;
              const mismatch = plan
                ? DENOMS.some(d => (plan[`denom_${d}`] || 0) !== (l[`denom_${d}`] || 0))
                : false;

              return (
                <details key={l.id} className="mb-2 border rounded">
                  <summary className="cursor-pointer px-3 py-2 bg-slate-50 text-sm font-medium">
                    {formatSite(l.site)} | Loaded ₹{siteTotal.toLocaleString()}
                  </summary>

                  <div className="p-3 text-sm space-y-2">
                    <div
                      className={`font-semibold ${
                        variance === 0 ? "text-green-600" : "text-red-600"
                      }`}
                    >
                      Planned ₹{plannedTotal.toLocaleString()} | Variance ₹{variance.toLocaleString()}
                    </div>

                    {mismatch && (
                      <div className="p-2 bg-red-100 text-red-800 rounded text-xs">
                        ⚠️ Denomination mismatch detected
                      </div>
                    )}

                    {DENOMS.map(d => (
                      <div key={d} className="flex justify-between text-xs">
                        <span>₹{d}</span>
                        <span>
                          Planned {plan?.[`denom_${d}`] || 0} | Loaded {l[`denom_${d}`] || 0}
                        </span>
                      </div>
                    ))}
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
        </div>
      )}
    </AppLayout>
  );
}

function Box({ label, value }: any) {
  return (
    <div className="p-3 bg-white rounded shadow text-center">
      <div className="font-bold text-primary">{value}</div>
      <div className="text-xs text-slate-600">{label}</div>
    </div>
  );
}
