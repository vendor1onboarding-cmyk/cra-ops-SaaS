import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import { getISTDateString, getISTMonthStart, formatISTDate } from "../utils/time";

const DENOMS = [100, 200, 500, 2000];

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  return `${site.bank_name || "Bank"} – ${site.address || site.site_code}`;
}

function denomValue(count: number, denom: number) {
  return count * denom;
}

function sumDenoms(row: any, denoms: number[]) {
  return denoms.reduce((sum, d) => sum + (row?.[`denom_${d}`] || 0) * d, 0);
}

function emptyDenomMap() {
  return { 100: 0, 200: 0, 500: 0, 2000: 0 } as Record<number, number>;
}

function extractInternalSourcesFromMetadata(pickup: any) {
  const sources = pickup?.internal_source_metadata?.sources || [];
  return sources.map((s: any) => ({
    site_id: s.site_id,
    site_name: s.site_name,
    denominations: s.denominations || {},
    total_amount: s.total_amount || 0,
  }));
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  const [assignment, setAssignment] = useState<any>(null);
  const [lastAssignment, setLastAssignment] = useState<any>(null);
  const [lastAssignmentSitesCount, setLastAssignmentSitesCount] = useState<number>(0);
  const [lastAssignmentLoadsCount, setLastAssignmentLoadsCount] = useState<number>(0);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [loads, setLoads] = useState<any[]>([]);
  const [pickups, setPickups] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  // Only loaded ATMs (remove pending logic)
  const [loadedATMs, setLoadedATMs] = useState<any[]>([]);

  const [cashUtil, setCashUtil] = useState<any>(null);
  const [denomSummary, setDenomSummary] = useState<any>(null);
  const [loadedBySite, setLoadedBySite] = useState<any[]>([]);
  const [kpiOpen, setKpiOpen] = useState(true);
  const [exchangeCount, setExchangeCount] = useState(0);
  const [internalTransferTotal, setInternalTransferTotal] = useState(0);
  const [internalTransfers, setInternalTransfers] = useState<any[]>([]);
const isSubmitted = assignment?.status === "submitted";
const isRejected = assignment?.status === "rejected";
const isApproved = assignment?.status === "approved";
const isEditable = assignment?.status === "open" || assignment?.status === "rejected";


const today = getISTDateString();
const monthStart = getISTMonthStart();

const [todayKm, setTodayKm] = useState(0);
const [monthlyKm, setMonthlyKm] = useState(0);


  useEffect(() => {
    if (!profile || profile.role !== "custodian") return;
    loadDashboard();
	async function loadTravelKPI() {
  if (!profile) return;

  // Today KM
  const { data: todayLogs } = await supabase
    .from("travel_logs")
    .select("km_covered")
    .eq("custodian_id", profile.id)
    .eq("status", "completed")
    .gte("start_time", `${today}T00:00:00`)
    .lte("start_time", `${today}T23:59:59`);

  const todayTotal =
    todayLogs?.reduce(
      (sum, r) => sum + (Number(r.km_covered) || 0),
      0
    ) || 0;

  setTodayKm(todayTotal);

  // Monthly KM
  const { data: monthLogs } = await supabase
    .from("travel_logs")
    .select("km_covered")
    .eq("custodian_id", profile.id)
    .eq("status", "completed")
    .gte("start_time", `${monthStart}T00:00:00`);

  const monthTotal =
    monthLogs?.reduce(
      (sum, r) => sum + (Number(r.km_covered) || 0),
      0
    ) || 0;

  setMonthlyKm(monthTotal);
}

loadTravelKPI();

	
  }, [profile]);


  async function loadDashboard() {
    setLoading(true);
    const today = getISTDateString();

    const { data: assign } = await supabase
      .from("assignments")
      .select("*")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
      .in("status", ["open", "submitted", "rejected", "approved"])
	  .order("created_at", { ascending: false })
	  .limit(1)
	  .maybeSingle();

    if (!assign) {
      setAssignment(null);
      setExchangeCount(0);
      setInternalTransferTotal(0);
      setInternalTransfers([]);

      // Fetch last assignment (fallback view)
      const { data: last } = await supabase
        .from("assignments")
        .select("id, assignment_date, status")
        .eq("custodian_id", profile.id)
        .order("assignment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (last) {
        setLastAssignment(last);
        const [{ count: sitesCount }, { count: loadsCount }] = await Promise.all([
          supabase
            .from("route_sites")
            .select("id", { count: "exact", head: true })
            .eq("assignment_id", last.id),
          supabase
            .from("atm_replenishments")
            .select("id", { count: "exact", head: true })
            .eq("assignment_id", last.id),
        ]);

        setLastAssignmentSitesCount(sitesCount || 0);
        setLastAssignmentLoadsCount(loadsCount || 0);
      } else {
        setLastAssignment(null);
        setLastAssignmentSitesCount(0);
        setLastAssignmentLoadsCount(0);
      }

      setLoading(false);
      return;
    }

    setAssignment(assign);

    const [rs, ls, cps, dp, ops] = await Promise.all([
      supabase
        .from("route_sites")
        .select("*, site:site_id(bank_name,address,site_code)")
        .eq("assignment_id", assign.id),
      supabase.from("atm_replenishments").select("*").eq("assignment_id", assign.id),
      supabase.from("cash_pickups").select("*").eq("assignment_id", assign.id),
      supabase.from("denomination_plans").select("*").eq("assignment_id", assign.id),
      supabase
        .from("soa_adjustments")
        .select("id, adjustment_type, exchange_metadata")
        .eq("assignment_id", assign.id)
        .in("adjustment_type", ["EXCHANGE", "INTER_SITE_TRANSFER"]),
    ]);
	

    setRouteSites(rs.data || []);
    setLoads(ls.data || []);
    setPickups(cps.data || []);
    setPlans(dp.data || []);
    // Only ATMs that have been loaded (remove pending logic)
    const loaded = (ls.data || []).map((l: any) => l.site_id);
    setLoadedATMs(loaded);

    const operational = ops.data || [];
    setExchangeCount(
      operational.filter((o: any) => o.adjustment_type === "EXCHANGE").length
    );
    const siteMap = new Map(
      (rs.data || []).map((r: any) => [r.site_id, r.site])
    );

    const derivedInternalTransfers: any[] = [];
    (cps.data || []).forEach((p: any) => {
      const source = p.pickup_source || "BANK";

      if (source === "ATM_INTERNAL") {
        const site = siteMap.get(p.source_site_id);
        derivedInternalTransfers.push({
          site: site || { bank_name: "ATM", address: "Internal Source" },
          denoms: {
            denom_100: p.denom_100 || 0,
            denom_200: p.denom_200 || 0,
            denom_500: p.denom_500 || 0,
            denom_2000: p.denom_2000 || 0,
          },
          total_amount: sumDenoms(p, DENOMS),
        });
        return;
      }

      const metaSources = extractInternalSourcesFromMetadata(p);
      metaSources.forEach((s: any) => {
        const site = siteMap.get(s.site_id);
        derivedInternalTransfers.push({
          site: site || { bank_name: s.site_name || "ATM", address: "Internal Source" },
          denoms: {
            denom_100: Number(s.denominations?.denom_100 || 0),
            denom_200: Number(s.denominations?.denom_200 || 0),
            denom_500: Number(s.denominations?.denom_500 || 0),
            denom_2000: Number(s.denominations?.denom_2000 || 0),
          },
          total_amount: Number(s.total_amount || 0),
        });
      });
    });

    setInternalTransfers(derivedInternalTransfers);

    computeCash(cps.data || [], ls.data || []);
    computeDenoms(cps.data || [], ls.data || [], ops.data || []);
    computeLoadedBySite(rs.data || [], ls.data || [], dp.data || []);

    setLoading(false);
  }

  function computeCash(pickups: any[], loads: any[]) {
    const bankPicked = pickups.reduce((sum, p) => {
      const source = p.pickup_source || "BANK";
      if (source === "ATM_INTERNAL") return sum;
      return sum + sumDenoms(p, DENOMS);
    }, 0);

    const internalPickedRows = pickups.reduce((sum, p) => {
      const source = p.pickup_source || "BANK";
      if (source !== "ATM_INTERNAL") return sum;
      return sum + sumDenoms(p, DENOMS);
    }, 0);

    const internalPickedMeta = pickups.reduce((sum, p) => {
      const metaSources = extractInternalSourcesFromMetadata(p);
      const metaTotal = metaSources.reduce(
        (acc: number, s: any) => acc + Number(s.total_amount || 0),
        0
      );
      return sum + metaTotal;
    }, 0);

    const bankLoaded = loads.reduce((sum, l) => {
      if (l.source_breakdown?.bank_source) {
        return sum + Number(l.source_breakdown?.bank_source?.total_amount || 0);
      }
      return sum + sumDenoms(l, DENOMS);
    }, 0);

    const internalLoaded = loads.reduce((sum, l) => {
      if (l.source_breakdown?.internal_source) {
        return sum + Number(l.source_breakdown?.internal_source?.total_amount || 0);
      }
      return sum;
    }, 0);

    const internalPickedTotal = internalPickedRows + internalPickedMeta;
    const picked = bankPicked + internalPickedTotal;
    const loaded = bankLoaded + internalLoaded;

    // Avoid double counting: show the larger of picked vs loaded for transfer volume
    setInternalTransferTotal(Math.max(internalPickedTotal, internalLoaded));
    setCashUtil({
      picked,
      loaded,
      inHand: picked - loaded,
    });
  }

  function computeDenoms(pickups: any[], loads: any[], exchanges: any[]) {
    const picked: Record<number, number> = emptyDenomMap();
    const loaded: Record<number, number> = emptyDenomMap();
    const inHand: Record<number, number> = emptyDenomMap();
    const exchangeNet: Record<number, number> = emptyDenomMap();

    (exchanges || []).forEach((row: any) => {
      if (row.adjustment_type !== "EXCHANGE") return;
      const from = row.exchange_metadata?.from_denominations || {};
      const to = row.exchange_metadata?.to_denominations || {};

      DENOMS.forEach((d) => {
        const key = `denom_${d}`;
        exchangeNet[d] += (to[key] || 0) - (from[key] || 0);
      });
    });

    pickups.forEach((p) => {
      const source = p.pickup_source || "BANK";
      DENOMS.forEach((d) => {
        if (source === "ATM_INTERNAL") {
          picked[d] += p[`denom_${d}`] || 0;
          return;
        }

        picked[d] += p[`denom_${d}`] || 0;
      });

      const metaSources = extractInternalSourcesFromMetadata(p);
      if (metaSources.length > 0) {
        metaSources.forEach((s: any) => {
          DENOMS.forEach((d) => {
            picked[d] += Number(s.denominations?.[`denom_${d}`] || 0);
          });
        });
      }
    });

    loads.forEach((l) => {
      if (l.source_breakdown?.bank_source || l.source_breakdown?.internal_source) {
        DENOMS.forEach((d) => {
          loaded[d] += Number(l.source_breakdown?.bank_source?.[`denom_${d}`] || 0);
          loaded[d] += Number(l.source_breakdown?.internal_source?.[`denom_${d}`] || 0);
        });
        return;
      }

      DENOMS.forEach((d) => {
        loaded[d] += l[`denom_${d}`] || 0;
      });
    });

    DENOMS.forEach((d) => {
      inHand[d] = picked[d] - loaded[d] + exchangeNet[d];
    });

    setDenomSummary({ picked, loaded, inHand });
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
        site: routeSites.find(r => r.site_id === x.site_id)?.site,
      }))
    );
  }

  // Only show loaded ATMs
  const loadedSiteIds = new Set(loads.map(l => l.site_id));
  const totalATMs = routeSites.length;
  const loadedATMsCount = loadedSiteIds.size;
  const completionPct = totalATMs > 0 ? Math.round((loadedATMsCount / totalATMs) * 100) : 0;

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
{isSubmitted && (
  <div className="bg-yellow-50 border border-yellow-300 p-3 rounded text-sm text-yellow-800">
    ⏳ EOD submitted. Awaiting admin approval.
  </div>
)}

{isRejected && assignment?.rejection_reason && (
  <div className="bg-red-50 border border-red-300 p-3 rounded text-sm text-red-700">
    ❌ EOD rejected: {assignment.rejection_reason}
  </div>
)}

{isApproved && (
  <div className="bg-green-50 border border-green-300 p-3 rounded text-sm text-green-700">
    ✅ EOD approved. Day is locked.
  </div>
)}

      {!loading && !assignment && (
        <div className="space-y-4 pb-10 px-2 max-w-full">
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  No assignment for today
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Your dashboard will update automatically once an admin assigns today’s route.
                </p>
              </div>
              <div className="hidden sm:flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 text-xs px-2 py-1">
                  ⏳ Waiting for assignment
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Today KM</div>
                <div className="text-lg font-semibold text-slate-800">
                  {todayKm.toFixed(2)} km
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">This Month KM</div>
                <div className="text-lg font-semibold text-slate-800">
                  {monthlyKm.toFixed(2)} km
                </div>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs text-slate-500">Status</div>
                <div className="text-sm font-semibold text-slate-800">
                  Active day will appear once assigned
                </div>
              </div>
            </div>
          </div>

          {lastAssignment && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    Last assignment summary
                  </h3>
                  <p className="text-xs text-slate-600 mt-1">
                    {formatISTDate(lastAssignment.assignment_date, "short")} • Status: {lastAssignment.status}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link to="/soa" className="btn-secondary">
                    View SOA
                  </Link>
                  <Link to="/travel-log" className="btn-primary">
                    Travel Log
                  </Link>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">ATMs Assigned</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {lastAssignmentSitesCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">ATMs Loaded</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {lastAssignmentLoadsCount}
                  </div>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Completion</div>
                  <div className="text-lg font-semibold text-slate-800">
                    {lastAssignmentSitesCount > 0
                      ? Math.round((lastAssignmentLoadsCount / lastAssignmentSitesCount) * 100)
                      : 0}%
                  </div>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                Note: Showing your most recent assignment until today’s assignment is issued.
              </div>
            </div>
          )}
        </div>
      )}

      {!loading && assignment && (
        <div className="space-y-4 pb-24 px-2 max-w-full overflow-x-hidden">
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
                <Stat label="Loaded" value={`₹${cashUtil.loaded}`} />
                <Stat
                  label="In Hand"
                  value={`₹${cashUtil.inHand}`}
                  highlight={cashUtil.inHand < 0 ? "warn" : "ok"}
                />
                <Stat label="Exchanges" value={exchangeCount} />
                <Stat
                  label="Internal Transfers"
                  value={`₹${internalTransferTotal.toLocaleString("en-IN")}`}
                />
				
{profile?.role === "custodian" && (
  <>
    <div className="bg-white rounded-xl shadow p-4 border-l-4 border-indigo-600">
      <div className="text-xs text-slate-500 flex items-center gap-1"> 🚗 Today KM</div>
      <div className="text-lg font-semibold text-slate-800">{todayKm.toFixed(2)} km</div>
    </div>

    <div className="bg-white rounded-xl shadow p-4 border-l-4 border-indigo-600">
      <div className="text-xs text-slate-500 flex items-center gap-1">🚗 This Month KM</div>
      <div className="text-lg font-semibold text-slate-800">{monthlyKm.toFixed(2)} km</div>
    </div>
  </>
)}

              </div>
            )}
          </div>
		  
		  {/* ATM Completion Progress */}
{totalATMs > 0 && (
  <div className="bg-white rounded shadow p-4 mb-4">
    <div className="flex justify-between text-sm mb-2">
      <span className="font-semibold">ATMs Loaded Today</span>
      <span className="text-slate-600">
        {loadedATMsCount} / {totalATMs} ({completionPct}%)
      </span>
    </div>

    <div className="w-full h-3 bg-slate-200 rounded overflow-hidden">
      <div
  className={`h-3 rounded transition-all duration-700 ease-out ${
    completionPct === 100
      ? "bg-green-600"
      : completionPct >= 70
      ? "bg-blue-600"
      : "bg-orange-500"
  }`}
  style={{
    width: `${completionPct}%`,
    animation: "progressGrow 0.8s ease-out",
  }}
/>
    </div>
  </div>
)}



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
                    <div>Loaded: {denomSummary.loaded[d]} (₹{denomValue(denomSummary.loaded[d], d)})</div>
                    <div className="font-semibold">
                      In Hand: {denomSummary.inHand[d]} (₹{denomValue(denomSummary.inHand[d], d)})
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {internalTransfers.length > 0 && (
            <div className="bg-white rounded shadow p-4">
              <h3 className="font-semibold mb-3">
                Internal ATM Transfers (Source)
              </h3>

              <div className="space-y-3">
                {internalTransfers.map((t: any, idx: number) => (
                  <div key={`${t.site?.id || idx}-${idx}`} className="border rounded p-3 text-sm">
                    <div className="font-semibold text-slate-800">
                      {formatSite(t.site)}
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      {DENOMS.map((d) => (
                        <div key={d}>
                          {t.denoms?.[`denom_${d}`] || 0} × ₹{d}
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-xs font-semibold text-slate-700">
                      Total: ₹{(t.total_amount || 0).toLocaleString("en-IN")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
		  
          {/* MOBILE: Loaded ATMs – Denomination wise (pending list removed) */}
{loadedBySite.length > 0 && (
  <div className="sm:hidden bg-white rounded shadow p-4">
    <h3 className="font-semibold mb-3">
      Loaded ATMs – Denomination Details
    </h3>
    <div className="space-y-3">
      {loadedBySite
        .filter(row => loadedSiteIds.has(row.site_id))
        .map(row => (
          <div
            key={row.site_id}
            className="border rounded-lg p-3 text-sm"
          >
            <div className="font-semibold mb-2 text-slate-800">
              {formatSite(row.site)}
            </div>
            {/* Denomination rows */}
            <div className="space-y-1">
              {DENOMS.map(d => (
                <div
                  key={d}
                  className="flex justify-between text-xs"
                >
                  <span>₹{d}</span>
                  <span>
                    {row.denoms[d] || 0} × ₹{d} = ₹
                    {denomValue(row.denoms[d] || 0, d)}
                  </span>
                </div>
              ))}
            </div>
            {/* Totals */}
            <div className="border-t mt-2 pt-2 text-xs space-y-0.5">
              <div>
                Planned: <span className="font-medium">₹{row.plannedValue}</span>
              </div>
              <div>
                Loaded: <span className="font-medium">₹{row.loadedValue}</span>
              </div>
            </div>
          </div>
        ))}
    </div>
  </div>
)}


          {/* Loaded ATMs (only show loaded, remove pending) */}
          {loadedBySite.length > 0 && (
            <div className="bg-white rounded shadow p-4 hidden sm:block">
              <h3 className="font-semibold mb-3">
                Loaded ATMs – Denomination Details
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
                    </tr>
                  </thead>
                  <tbody>
                    {loadedBySite
                      .filter(row => loadedSiteIds.has(row.site_id))
                      .map(row => (
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
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
		  
		
        </div>
      )}
	{/* Mobile Sticky CSV / Print Actions */}
<div className="sm:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t shadow-md">
  <div className="flex gap-3 px-4 py-3">
    <button
      onClick={exportCSV}
      className="flex-1 rounded-lg border border-slate-300 bg-slate-100 py-2 text-sm font-semibold text-slate-700 active:scale-95 transition"
    >
      Export CSV
    </button>

    <button
      onClick={() => window.print()}
      className="flex-1 rounded-lg bg-primary py-2 text-sm font-semibold text-white active:scale-95 transition"
    >
      Print PDF
    </button>
  </div>
</div>
  
	  
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
