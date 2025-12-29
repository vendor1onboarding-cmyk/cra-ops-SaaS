import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

const DENOMS = [100, 200, 500, 2000];

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  return `${site.bank_name || "Bank"} – ${site.address || site.site_code}`;
}

export default function Dashboard() {
  const { profile } = useAuth();
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
    if (!profile || profile.role !== "custodian") return;
    loadCustodianDashboard();
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
      supabase.from("atm_replenishments").select("*").eq("assignment_id", assign.id),
      supabase.from("cash_pickups").select("*").eq("assignment_id", assign.id),
      supabase.from("atm_cash_adjustments").select("*").eq("assignment_id", assign.id),
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
        DENOMS.reduce((ds, d) => ds + (l[`denom_${d}`] || 0) * d, 0),
      0
    );
    const adjusted = adjustments.reduce(
      (s, a) =>
        s +
        DENOMS.reduce((ds, d) => ds + (a[`denom_${d}`] || 0) * d, 0),
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

  function computeLoadedBySite(routeSites: any[], loads: any[]) {
    const map: any = {};
    loads.forEach(l => {
      if (!map[l.site_id]) map[l.site_id] = { site_id: l.site_id, denoms: {} };
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

  function exportCSV() {
    if (!loadedBySite.length) return;

    let csv = "ATM,100,200,500,2000\n";
    loadedBySite.forEach(s => {
      csv += `"${formatSite(s.site)}",${DENOMS.map(d => s.denoms[d] || 0).join(",")}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "ATM_Load_Report.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const loadedSiteIds = new Set(loads.map(l => l.site_id));
  const pendingSites = routeSites.filter(r => !loadedSiteIds.has(r.site_id));

  return (
    <AppLayout>
	
		{/* PRINT HEADER WITH LOGO */}
<div className="print-only mb-4 border-b pb-3">
  <div className="flex justify-between items-start">
    <div className="flex items-center gap-3">
      {/* Bank Logo */}
      <img
        src="/bank-logo.png"
        alt="Bank Logo"
        className="h-10 w-auto"
      />

      <div>
        <h1 className="text-xl font-bold">Sruthi CRA Ops</h1>
        <p className="text-xs text-slate-600">
          Cash Replenishment & ATM Operations
        </p>
      </div>
    </div>

    <div className="text-right text-xs">
      <p className="font-semibold">Daily Cash Operations Report</p>
      <p>Date: {new Date().toLocaleDateString("en-IN")}</p>
      {profile?.full_name && (
        <p>Custodian: {profile.full_name}</p>
      )}
    </div>
  </div>
</div>

      {loading && <div className="text-center text-sm">Loading…</div>}

      {!loading && assignment && (
        <div className="space-y-6 pb-28 px-2 max-w-full overflow-x-hidden">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">
              Custodian Dashboard – Today ({loadedSiteIds.size}/{routeSites.length} ATMs Loaded)
            </h2>
            <div className="hidden sm:flex gap-2">
              <button onClick={exportCSV} className="btn-secondary">⬇ CSV</button>
              <button onClick={() => window.print()} className="btn-primary">🖨 Print</button>
            </div>
          </div>

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

          {/* DESKTOP: Denomination-wise Cash (WITH IN HAND) */}
          {denomSummary && (
            <div className="bg-white rounded shadow p-4 hidden sm:block">
              <h3 className="font-semibold mb-3">Denomination-wise Cash Position</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="border p-2">₹</th>
                      <th className="border p-2">Picked</th>
                      <th className="border p-2">Adjusted</th>
					  <th className="border p-2">Loaded</th>
                      <th className="border p-2">In Hand</th>
                    </tr>
                  </thead>
                  <tbody>
                    {DENOMS.map(d => (
                      <tr key={d}>
                        <td className="border p-2">₹{d}</td>
                        <td className="border p-2">{denomSummary.picked[d]}</td>
                        <td className="border p-2">{denomSummary.adjusted[d]}</td>
						<td className="border p-2">{denomSummary.loaded[d]}</td>
                        <td className="border p-2 font-semibold">
                          {denomSummary.inHand[d]}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
		  
		  {/* DESKTOP: Loaded ATMs – Denomination-wise */}
{loadedBySite.length > 0 && (
  <div className="bg-white rounded shadow p-4 hidden sm:block">
    <h3 className="font-semibold mb-3">
      Loaded ATMs – Denomination-wise
    </h3>

    <div className="overflow-x-auto">
      <table className="w-full text-sm border">
        <thead className="bg-slate-100">
          <tr>
            <th className="border p-2 text-left sticky left-0 bg-slate-100 z-10">
              ATM
            </th>
            {DENOMS.map((d) => (
              <th key={d} className="border p-2 text-right">
                ₹{d}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {loadedBySite.map((row) => (
            <tr key={row.site_id}>
              <td className="border p-2 sticky left-0 bg-white z-10">
                {formatSite(row.site)}
              </td>

              {DENOMS.map((d) => (
                <td
                  key={d}
                  className="border p-2 text-right font-medium"
                >
                  {row.denoms[d] || 0}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
)}



          {/* MOBILE: Denomination cards (unchanged) */}
          {denomSummary && (
            <div className="sm:hidden space-y-2">
              {DENOMS.map(d => (
                <div key={d} className="border rounded p-2 text-sm bg-white shadow">
                  <div className="font-semibold">₹{d}</div>
                  Picked {denomSummary.picked[d]} | Loaded {denomSummary.loaded[d]} |
                  Adjusted {denomSummary.adjusted[d]} | In Hand{" "}
                  <span className="font-semibold">{denomSummary.inHand[d]}</span>
                </div>
              ))}
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

          {/* Mobile Sticky */}
          <div className="fixed bottom-0 left-0 right-0 sm:hidden bg-white border-t p-3 flex gap-2">
            <button onClick={exportCSV} className="w-1/2 btn-secondary">CSV</button>
            <button onClick={() => window.print()} className="w-1/2 btn-primary">Print</button>
          </div>
        </div>
		
      )}
	  {/* PRINT FOOTER – SIGNATURES */}
<div className="print-only mt-10 pt-6 border-t text-xs text-slate-700">
  <div className="grid grid-cols-2 gap-12">
    <div>
      <p className="font-semibold">Custodian Signature</p>
      <div className="mt-6 border-b w-48"></div>
      <p className="mt-1">Name & Date</p>
    </div>

    <div className="text-right">
      <p className="font-semibold">Supervisor / Bank Officer</p>
      <div className="mt-6 border-b w-48 ml-auto"></div>
      <p className="mt-1">Name, Seal & Date</p>
    </div>
  </div>

  <p className="mt-6 text-[10px] text-slate-500">
    This is a system-generated report from Sruthi CRA Ops.  
    Any discrepancy must be reported within RBI-prescribed timelines.
  </p>
</div>

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
