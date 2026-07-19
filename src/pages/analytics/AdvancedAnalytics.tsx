import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../api/supabaseClient";
import AppLayout from "../../components/Layout";
import { formatISTDate } from "../../utils/time";

/* ================================================================
   TYPES
   ================================================================ */

interface OptionItem { id: string; label: string }
interface SiteOption { id: number; label: string }

interface ExecutiveKPIs {
  cashUtilPct: number;       // bank_loaded / bank_picked
  costPerLoad: number;       // travel_allowance / loads
  avgLoadMin: number;        // mean load duration
  slaPct: number;            // % loads ≤ 30 min
  assignments: number;
  loads: number;
  travelKm: number;
  eodPct: number;            // % approved
  netExposure: number;       // avg net cash position
  gpsPct: number;            // % geo_status = verified
  internalPct: number;       // internal_loaded / total_loaded
  bankPicked: number;
  bankLoaded: number;
  intPicked: number;
  intLoaded: number;
  excess: number;
  travelAllowance: number;
}

interface DenomMix {
  picked: [number, number, number, number]; // [₹2000, ₹500, ₹200, ₹100]
  loaded: [number, number, number, number];
}

interface DailyRow {
  date: string;
  loads: number;
  km: number;
  bankPicked: number;
  bankLoaded: number;
  net: number;
}

interface CustodianRow {
  id: string;
  name: string;
  assignments: number;
  loads: number;
  utilPct: number;
  avgMin: number;
  km: number;
  kmPerLoad: number;
  gpsPct: number;
  score: number;
}

interface SiteRow {
  id: number;
  label: string;
  loads: number;
  avgMin: number;
  excessCount: number;
  issueCount: number;
}

interface BankRow { bank: string; amount: number; count: number }

interface Anomaly {
  type: "cash" | "route" | "load" | "gps" | "excess";
  severity: "warning" | "critical";
  title: string;
  detail: string;
}

// ─── New Analytics Types ───
interface BankPickupTrend {
  bank: string;
  branch: string;
  count: number;
  total: number;
  avg: number;
  variance_rate: number;
}

interface ATMPerformance {
  siteId: number;
  label: string;
  loadCount: number;
  totalLoaded: number;
  efficiencyScore: number;
  city: string;
}

interface CashRecyclingMetrics {
  atmRemoved: number;
  atmReused: number;
  bankPickup: number;
  recyclingPercent: number;
  internalReusePercent: number;
}

interface RiskIndicator {
  type: string;
  identifier: string;
  riskValue: number;
  riskPercent: number | null;
  description: string;
}

interface Analytics {
  kpis: ExecutiveKPIs;
  denom: DenomMix;
  daily: DailyRow[];
  custodians: CustodianRow[];
  sites: SiteRow[];
  peaks: number[];          // 24 slots
  anomalies: Anomaly[];
  banks: BankRow[];
  loadBuckets: number[];    // [0-10, 10-20, 20-30, 30-45, 45-60, 60+] min
  // ─── New Analytics ───
  bankPickupTrends: BankPickupTrend[];
  atmPerformance: ATMPerformance[];
  cashRecycling: CashRecyclingMetrics;
  riskIndicators: RiskIndicator[];
}

/* ================================================================
   CONSTANTS
   ================================================================ */

const SLA_MINUTES = 30;
const DENOM_LABELS = ["₹2000", "₹500", "₹200", "₹100"];
const DENOM_VALUES = [2000, 500, 200, 100];
const DENOM_COLORS = ["#dc2626", "#2563eb", "#7c3aed", "#059669"];
const LOAD_BUCKETS = ["0-10", "10-20", "20-30", "30-45", "45-60", "60+"];

/* ================================================================
   MAIN COMPONENT
   ================================================================ */

export default function AdvancedAnalytics() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState(() => isoDate(daysAgo(29)));
  const [toDate, setToDate] = useState(() => isoDate(new Date()));
  const [custodianOpts, setCustodianOpts] = useState<OptionItem[]>([]);
  const [siteOpts, setSiteOpts] = useState<SiteOption[]>([]);
  const [selCustodians, setSelCustodians] = useState<string[]>([]);
  const [selSites, setSelSites] = useState<number[]>([]);

  const dateLabel = useMemo(() => {
    return `${formatISTDate(fromDate, "short")} → ${formatISTDate(toDate, "short")}`;
  }, [fromDate, toDate]);

  // One-time option load
  useEffect(() => {
    (async () => {
      const [{ data: profiles }, { data: sites }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").order("full_name"),
        supabase.from("sites").select("id, bank_name, address, site_code, atm_id").order("bank_name"),
      ]);
      setCustodianOpts(
        (profiles || [])
          .filter((p: any) => p.role === "custodian")
          .map((p: any) => ({ id: p.id, label: p.full_name }))
      );
      setSiteOpts(
        (sites || []).map((s: any) => ({
          id: s.id,
          label: `${s.bank_name || "Bank"} – ${s.address || s.site_code || ""}${s.atm_id ? ` (${s.atm_id})` : ""}`,
        }))
      );
    })();
  }, []);

  // Main analytics fetch
  useEffect(() => {
    fetchAnalytics(
      fromDate, toDate, selCustodians, selSites,
      custodianOpts, siteOpts,
      setData, setLoading, setError
    );
  }, [fromDate, toDate, selCustodians, selSites, custodianOpts, siteOpts]);

  const fmt = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  const fmtDec = (v: number) => `₹${v.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <AppLayout>
      {/* ── Print Header ── */}
      <div className="print-only mb-4 border-b pb-3">
        <div className="flex items-start justify-between">
          <div>
            <img src="/bank-logo.png" alt="" className="h-8 mb-1" />
            <h1 className="text-lg font-bold">Cash Track Pro</h1>
            <p className="text-xs text-slate-600">Track, Manage, Deliver</p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <div>Period: {dateLabel}</div>
            <div>Generated: {new Date().toLocaleDateString("en-IN")}</div>
          </div>
        </div>
      </div>

      {/* ── Page Title ── */}
      <div className="print:hidden mb-4">
        <h1 className="text-2xl sm:text-3xl font-bold text-primary">Operations Intelligence</h1>
        <p className="text-slate-500 text-sm">Actionable CMS insights for decision-making</p>
      </div>

      {/* ── Filters ── */}
      <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 mb-4 print:hidden">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-slate-700">Filters</div>
            <div className="text-xs text-slate-500">{dateLabel}</div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-500 mb-1 block">To</label>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm" />
            </div>
            <FilterMultiSelect title="Custodians" options={custodianOpts}
              selected={selCustodians} onChange={setSelCustodians} />
            <FilterMultiSelect title="Sites" options={siteOpts}
              selected={selSites} onChange={setSelSites} />
          </div>

          <div className="flex flex-wrap gap-2">
            {[
              { label: "Reset", fn: () => { setFromDate(isoDate(daysAgo(29))); setToDate(isoDate(new Date())); setSelCustodians([]); setSelSites([]); } },
              { label: "Last 7 Days", fn: () => { setFromDate(isoDate(daysAgo(6))); setToDate(isoDate(new Date())); } },
              { label: "Last 30 Days", fn: () => { setFromDate(isoDate(daysAgo(29))); setToDate(isoDate(new Date())); } },
              { label: "This Month", fn: () => { const now = new Date(); setFromDate(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`); setToDate(isoDate(now)); } },
            ].map((b) => (
              <button key={b.label} onClick={b.fn}
                className="px-3 py-1 text-xs rounded-full bg-slate-100 text-slate-700 hover:bg-slate-200">
                {b.label}
              </button>
            ))}
          </div>
      </section>

      {loading && <div className="text-sm text-slate-500 print:hidden">Loading analytics…</div>}
      {error && <div className="text-sm text-red-600 print:hidden">⚠ {error}</div>}

      {data && (
        <div className="space-y-5 mt-4 print:block">
            {/* ═══════════ I. EXECUTIVE KPI STRIP ═══════════ */}
            <section>
              <SectionHead title="Executive Summary" question="How is the operation performing overall?" />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                <KPI label="Cash Utilization" value={`${data.kpis.cashUtilPct.toFixed(1)}%`}
                  sub={`${fmt(data.kpis.bankLoaded)} of ${fmt(data.kpis.bankPicked)} picked`}
                  color={data.kpis.cashUtilPct >= 90 ? "green" : data.kpis.cashUtilPct >= 70 ? "amber" : "red"} />
                <KPI label="Cost per ATM Load" value={fmtDec(data.kpis.costPerLoad)}
                  sub={`${fmt(data.kpis.travelAllowance)} travel for ${data.kpis.loads} loads`}
                  color={data.kpis.costPerLoad <= 150 ? "green" : data.kpis.costPerLoad <= 300 ? "amber" : "red"} />
                <KPI label="SLA Compliance" value={`${data.kpis.slaPct.toFixed(0)}%`}
                  sub={`ATM loads ≤ ${SLA_MINUTES} min`}
                  color={data.kpis.slaPct >= 90 ? "green" : data.kpis.slaPct >= 70 ? "amber" : "red"} />
                <KPI label="EOD Compliance" value={`${data.kpis.eodPct.toFixed(0)}%`}
                  sub={`${data.kpis.assignments} assignments`}
                  color={data.kpis.eodPct >= 90 ? "green" : data.kpis.eodPct >= 70 ? "amber" : "red"} />
                <KPI label="GPS Verified" value={`${data.kpis.gpsPct.toFixed(0)}%`}
                  sub="Load location audits"
                  color={data.kpis.gpsPct >= 90 ? "green" : data.kpis.gpsPct >= 70 ? "amber" : "red"} />
                <KPI label="Avg Load Time" value={`${data.kpis.avgLoadMin.toFixed(0)} min`}
                  sub={`SLA target: ${SLA_MINUTES} min`}
                  color={data.kpis.avgLoadMin <= 20 ? "green" : data.kpis.avgLoadMin <= 30 ? "amber" : "red"} />
                <KPI label="Net Cash Exposure" value={fmt(data.kpis.netExposure)}
                  sub="Avg daily holding"
                  color={data.kpis.netExposure <= 200000 ? "green" : data.kpis.netExposure <= 500000 ? "amber" : "red"} />
                <KPI label="Internal Transfer %" value={`${data.kpis.internalPct.toFixed(1)}%`}
                  sub={`${fmt(data.kpis.intLoaded)} of ${fmt(data.kpis.bankLoaded + data.kpis.intLoaded)}`}
                  color={data.kpis.internalPct <= 15 ? "green" : data.kpis.internalPct <= 30 ? "amber" : "red"} />
                <KPI label="ATM Loads" value={String(data.kpis.loads)}
                  sub={`${data.kpis.travelKm.toFixed(0)} km total travel`} />
                <KPI label="Excess Cash" value={fmt(data.kpis.excess)}
                  sub="Reported at sites"
                  color={data.kpis.excess === 0 ? "green" : "amber"} />
              </div>
            </section>

            {/* ═══════════ II. RISK & ANOMALY ALERTS ═══════════ */}
            {data.anomalies.length > 0 && (
              <section>
                <SectionHead title="Risk & Anomaly Alerts" question="What needs immediate attention?" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {data.anomalies.map((a, i) => (
                    <div key={i} className={`rounded-lg border p-3 text-sm ${
                      a.severity === "critical"
                        ? "bg-red-50 border-red-200"
                        : "bg-amber-50 border-amber-200"
                    }`}>
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0" aria-hidden>{
                          a.type === "cash" ? "💰" : a.type === "route" ? "🛣️" :
                          a.type === "load" ? "⏱️" : a.type === "gps" ? "📍" : "📦"
                        }</span>
                        <div className="min-w-0">
                          <div className={`font-semibold text-xs ${
                            a.severity === "critical" ? "text-red-800" : "text-amber-800"
                          }`}>{a.title}</div>
                          <div className="text-xs text-slate-600 mt-0.5">{a.detail}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ═══════════ III. CASH FLOW INTELLIGENCE ═══════════ */}
            <section>
              <SectionHead title="Cash Flow Intelligence" question="Where does the money go?" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Daily Cash Flow" sub="Bank pickup vs bank loaded (₹)">
                  <DualAreaChart data={data.daily} />
                </Card>
                <Card title="Denomination Mix" sub="What denominations are being picked vs loaded?">
                  <DenomChart picked={data.denom.picked} loaded={data.denom.loaded} />
                </Card>
                <Card title="Cash Source Breakdown" sub="Bank vs internal transfer contribution">
                  <SourceDonut kpis={data.kpis} fmt={fmt} />
                </Card>
                <Card title="Bank-wise Pickup Volume" sub="Which banks contribute most cash?">
                  {data.banks.length === 0
                    ? <Empty msg="No bank pickup data." />
                    : <HBar data={data.banks.map(b => ({ label: b.bank, value: b.amount, sub: `${b.count} pickups` }))} fmt={fmt} />
                  }
                </Card>
              </div>
            </section>

            {/* ═══════════ IV. OPERATIONAL EFFICIENCY ═══════════ */}
            <section>
              <SectionHead title="Operational Efficiency" question="Are we optimizing time and resources?" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Load Time Distribution" sub={`SLA target: ≤${SLA_MINUTES} min per ATM`}>
                  <LoadTimeBuckets buckets={data.loadBuckets} slaIdx={2} />
                </Card>
                <Card title="Peak Activity Hours" sub="When are ATMs being loaded?">
                  <HeatStrip hours={data.peaks} />
                </Card>
                <Card title="Daily Operational Trend" sub="Loads and travel distance per day">
                  <DailyOpsChart data={data.daily} />
                </Card>
                <Card title="Net Cash Exposure Trend" sub="Daily custodian cash holding (lower is safer)">
                  <NetExposureChart data={data.daily} />
                </Card>
              </div>
            </section>

            {/* ═══════════ V. CUSTODIAN PERFORMANCE ═══════════ */}
            <section>
              <SectionHead title="Custodian Performance Scorecard" question="How are individual custodians performing?" />
              {data.custodians.length === 0
                ? <Empty msg="No custodian data in this range." />
                : <CustodianTable rows={data.custodians} fmt={fmt} />
              }
            </section>

            {/* ═══════════ VI. SITE INTELLIGENCE ═══════════ */}
            <section>
              <SectionHead title="Site Intelligence" question="Which ATM sites need attention?" />
              {data.sites.length === 0
                ? <Empty msg="No site data in this range." />
                : <SiteTable rows={data.sites} />
              }
            </section>

            {/* ═══════════ VII. BANK PICKUP TRENDS ═══════════ */}
            <section>
              <SectionHead title="Bank Pickup Trends" question="What are the patterns in bank cash collection?" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Top Bank Branches by Volume" sub="Highest cash pickup sources">
                  {data.bankPickupTrends.length === 0
                    ? <Empty msg="No bank pickup trend data." />
                    : <BankPickupTable rows={data.bankPickupTrends.slice(0, 10)} fmt={fmt} />
                  }
                </Card>
                <Card title="Pickup Frequency vs Amount" sub="Branch performance comparison">
                  {data.bankPickupTrends.length === 0
                    ? <Empty msg="No data available." />
                    : <PickupScatterChart data={data.bankPickupTrends.slice(0, 15)} />
                  }
                </Card>
                <Card title="Variance Analysis" sub="Branches with highest discrepancy rates">
                  {data.bankPickupTrends.length === 0
                    ? <Empty msg="No variance data." />
                    : <VarianceBarChart data={data.bankPickupTrends.filter(b => b.variance_rate > 5).slice(0, 10)} />
                  }
                </Card>
                <Card title="Cash Recycling Metrics" sub="ATM-to-ATM cash reuse efficiency">
                  <RecyclingMetrics metrics={data.cashRecycling} fmt={fmt} />
                </Card>
              </div>
            </section>

            {/* ═══════════ VIII. ATM PERFORMANCE ANALYTICS ═══════════ */}
            <section>
              <SectionHead title="ATM Performance Analytics" question="Which ATMs drive the most activity?" />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card title="Top ATMs by Load Volume" sub="Most frequently serviced sites">
                  {data.atmPerformance.length === 0
                    ? <Empty msg="No ATM performance data." />
                    : <ATMPerformanceTable rows={data.atmPerformance.slice(0, 10)} fmt={fmt} />
                  }
                </Card>
                <Card title="ATM Efficiency Distribution" sub="Performance score across all sites">
                  {data.atmPerformance.length === 0
                    ? <Empty msg="No data available." />
                    : <EfficiencyDistribution data={data.atmPerformance} />
                  }
                </Card>
                <Card title="City-wise Load Analysis" sub="Geographic distribution of activity">
                  {data.atmPerformance.length === 0
                    ? <Empty msg="No city data." />
                    : <CityHBar data={aggregateByCity(data.atmPerformance)} fmt={fmt} />
                  }
                </Card>
                <Card title="Risk Indicators" sub="Alerts requiring attention">
                  {data.riskIndicators.length === 0
                    ? <div className="text-xs text-emerald-600 py-4 text-center flex items-center justify-center gap-2">
                        <span>✓</span> No critical risks detected
                      </div>
                    : <RiskIndicatorList risks={data.riskIndicators.slice(0, 8)} />
                  }
                </Card>
              </div>
            </section>
          </div>
        )}

      {/* ── Print Footer ── */}
      <div className="print-only mt-10 pt-4 border-t text-xs text-slate-600">
        <div className="flex justify-between">
          <div>
            <div className="font-semibold">Cash Track Pro</div>
            <div>Track, Manage, Deliver</div>
          </div>
          <div className="text-right">
            <div>Generated: {new Date().toLocaleDateString("en-IN")}</div>
            <div>Confidential – Internal Use Only</div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

/* ================================================================
   DATA FETCHING & COMPUTATION
   ================================================================ */

async function fetchAnalytics(
  fromDate: string, toDate: string,
  selCustodians: string[], selSites: number[],
  custodianOpts: OptionItem[], siteOpts: SiteOption[],
  setData: (d: Analytics | null) => void,
  setLoading: (b: boolean) => void,
  setError: (e: string | null) => void,
) {
  setLoading(true);
  setError(null);

  try {
    // 1. Fetch assignments
    const aq = supabase
      .from("assignments")
      .select("id, assignment_date, custodian_id, status")
      .gte("assignment_date", fromDate)
      .lte("assignment_date", toDate);

    if (selCustodians.length) aq.in("custodian_id", selCustodians);

    const { data: rawAssignments, error: aErr } = await aq;
    if (aErr) throw aErr;
    const assignments = rawAssignments || [];
    if (!assignments.length) {
      setData(buildEmpty(fromDate, toDate));
      return;
    }
    const aIds = assignments.map((a: any) => a.id);

    // 2. Parallel fetch all related data
    const [
      { data: soaRows, error: sErr },
      { data: pickupRows, error: pErr },
      { data: loadRows, error: lErr },
      { data: travelRows, error: tErr },
      { data: excessRows, error: eErr },
      { data: issueRows, error: iErr },
    ] = await Promise.all([
      supabase.from("v_soa_effective").select(
        "assignment_id, assignment_date, custodian_id, bank_picked, bank_loaded, internal_picked, internal_loaded, cash_picked, cash_loaded, excess_reported, final_net_cash_position, travel_km, travel_allowance"
      ).in("assignment_id", aIds),
      supabase.from("cash_pickups").select(
        "assignment_id, pickup_source, pickup_time, total_amount, denom_2000, denom_500, denom_200, denom_100, bank_name"
      ).in("assignment_id", aIds),
      supabase.from("atm_replenishments").select(
        "assignment_id, site_id, time_in, time_out, denom_2000, denom_500, denom_200, denom_100, geo_status"
      ).in("assignment_id", aIds),
      supabase.from("travel_logs").select(
        "assignment_id, km_covered, start_time, allowance_amount"
      ).in("assignment_id", aIds),
      supabase.from("atm_excess_cash").select(
        "assignment_id, site_id, denom_2000, denom_500, denom_200, denom_100"
      ).in("assignment_id", aIds),
      supabase.from("technical_issues").select(
        "assignment_id, site_id, issue_type"
      ).in("assignment_id", aIds),
    ]);

    if (sErr) throw sErr;
    if (pErr) throw pErr;
    if (lErr) throw lErr;
    if (tErr) throw tErr;
    if (eErr) throw eErr;
    if (iErr) throw iErr;

    const soa = soaRows || [];
    const pickups = pickupRows || [];
    let loads = loadRows || [];
    const travels = travelRows || [];
    const excesses = excessRows || [];
    const issues = issueRows || [];

    // Apply site filter if active
    if (selSites.length) {
      loads = loads.filter((l: any) => selSites.includes(l.site_id));
    }

    const nameMap = new Map(custodianOpts.map(c => [c.id, c.label]));
    const siteMap = new Map(siteOpts.map(s => [s.id, s.label]));
    const assignMap = new Map(assignments.map((a: any) => [a.id, a]));

    // 3. Fetch new analytics views (read-only)
    const [
      { data: varianceData },
      { data: atmUtilData },
      { data: internalEffData },
      { data: recyclingData },
      { data: riskData },
    ] = await Promise.all([
      supabase.from("v_cash_variance_analytics").select("*"),
      supabase.from("v_atm_load_utilization").select("*"),
      supabase.from("v_internal_transfer_efficiency").select("*").in("assignment_id", aIds),
      supabase.from("v_cash_recycling_rate").select("*").in("assignment_id", aIds),
      supabase.from("v_cash_risk_indicators").select("*"),
    ]);

    // Process bank pickup trends from variance analytics
    const bankPickupTrends: BankPickupTrend[] = (varianceData || []).map((v: any) => ({
      bank: v.bank_name || "Unknown",
      branch: v.branch || "Unknown",
      count: v.total_pickups || 0,
      total: 0, // Will aggregate from pickups
      avg: 0,
      variance_rate: v.variance_rate_percent || 0,
    }));

    // Enrich with actual amounts from pickups
    const branchTotalMap = new Map<string, { total: number; count: number }>();
    pickups.forEach((p: any) => {
      if (p.pickup_source === "BANK") {
        const key = `${p.bank_name || "Unknown"}|${p.branch || "Unknown"}`;
        if (!branchTotalMap.has(key)) branchTotalMap.set(key, { total: 0, count: 0 });
        const b = branchTotalMap.get(key)!;
        b.total += p.total_amount || 0;
        b.count += 1;
      }
    });
    bankPickupTrends.forEach(t => {
      const key = `${t.bank}|${t.branch}`;
      const b = branchTotalMap.get(key);
      if (b) {
        t.total = b.total;
        t.avg = b.count > 0 ? b.total / b.count : 0;
      }
    });
    bankPickupTrends.sort((a, b) => b.total - a.total);

    // Process ATM performance
    const atmPerformance: ATMPerformance[] = (atmUtilData || [])
      .filter((a: any) => (selSites.length === 0 || selSites.includes(a.site_id)))
      .map((a: any) => ({
        siteId: a.site_id,
        label: siteMap.get(a.site_id) || `${a.bank_name || "Bank"} - ${a.address || "Site"}`,
        loadCount: a.load_count || 0,
        totalLoaded: a.total_loaded || 0,
        efficiencyScore: 0, // Will compute from internal_transfer_efficiency
        city: a.city || "Unknown",
      }))
      .sort((a, b) => b.loadCount - a.loadCount);

    // Compute cash recycling metrics (aggregated across period)
    const recyclingMetrics = (recyclingData || []).reduce(
      (acc: CashRecyclingMetrics, r: any) => ({
        atmRemoved: acc.atmRemoved + (r.atm_removed || 0),
        atmReused: acc.atmReused + (r.atm_reused || 0),
        bankPickup: acc.bankPickup + (r.bank_pickup || 0),
        recyclingPercent: 0, // Will compute after reduction
        internalReusePercent: 0,
      }),
      { atmRemoved: 0, atmReused: 0, bankPickup: 0, recyclingPercent: 0, internalReusePercent: 0 }
    );
    recyclingMetrics.recyclingPercent = recyclingMetrics.atmRemoved > 0
      ? (recyclingMetrics.atmReused / recyclingMetrics.atmRemoved) * 100
      : 0;
    
    // Compute internal reuse % from internal_transfer_efficiency
    const totalInternalUsed = (internalEffData || []).reduce((s: number, r: any) => s + (r.internal_used || 0), 0);
    const totalBankUsed = (internalEffData || []).reduce((s: number, r: any) => s + (r.bank_used || 0), 0);
    recyclingMetrics.internalReusePercent = (totalInternalUsed + totalBankUsed) > 0
      ? (totalInternalUsed / (totalInternalUsed + totalBankUsed)) * 100
      : 0;

    // Process risk indicators
    const riskIndicators: RiskIndicator[] = (riskData || []).map((r: any) => ({
      type: r.risk_type || "Unknown",
      identifier: r.identifier || "",
      riskValue: r.risk_value || 0,
      riskPercent: r.risk_percent,
      description: r.risk_description || "",
    }));

    // ─── Executive KPIs ───
    // CRITICAL: Use bank_picked/bank_loaded for utilization. Internal transfers
    // are neutral cash movement and must NOT inflate KPI totals.
    const bankPicked = soa.reduce((s: number, r: any) => s + (r.bank_picked || r.cash_picked || 0), 0);
    const bankLoaded = soa.reduce((s: number, r: any) => s + (r.bank_loaded || 0), 0);
    const intPicked = soa.reduce((s: number, r: any) => s + (r.internal_picked || 0), 0);
    const intLoaded = soa.reduce((s: number, r: any) => s + (r.internal_loaded || 0), 0);
    const totalExcess = soa.reduce((s: number, r: any) => s + (r.excess_reported || 0), 0);
    const totalKm = soa.reduce((s: number, r: any) => s + (r.travel_km || 0), 0);
    const totalAllowance = soa.reduce((s: number, r: any) => s + (r.travel_allowance || 0), 0);
    const nets = soa.map((r: any) => r.final_net_cash_position || 0);
    const avgNet = nets.length ? nets.reduce((a: number, b: number) => a + b, 0) / nets.length : 0;

    const approvedCount = assignments.filter((a: any) => a.status === "approved").length;
    const totalAssignments = assignments.length;

    const loadDurations = loads.map((l: any) => minDiff(l.time_in, l.time_out)).filter((v: number) => v > 0);
    const avgLoadMin = loadDurations.length ? loadDurations.reduce((a: number, b: number) => a + b, 0) / loadDurations.length : 0;
    const slaCount = loadDurations.filter((d: number) => d <= SLA_MINUTES).length;
    const slaPct = loadDurations.length ? (slaCount / loadDurations.length) * 100 : 100;

    const gpsVerified = loads.filter((l: any) => l.geo_status === "verified").length;
    const gpsPct = loads.length ? (gpsVerified / loads.length) * 100 : 100;

    const totalLoaded = bankLoaded + intLoaded;
    const internalPct = totalLoaded > 0 ? (intLoaded / totalLoaded) * 100 : 0;

    const kpis: ExecutiveKPIs = {
      cashUtilPct: bankPicked > 0 ? (bankLoaded / bankPicked) * 100 : 0,
      costPerLoad: loads.length ? totalAllowance / loads.length : 0,
      avgLoadMin,
      slaPct,
      assignments: totalAssignments,
      loads: loads.length,
      travelKm: totalKm,
      eodPct: totalAssignments ? (approvedCount / totalAssignments) * 100 : 0,
      netExposure: avgNet,
      gpsPct,
      internalPct,
      bankPicked,
      bankLoaded,
      intPicked,
      intLoaded,
      excess: totalExcess,
      travelAllowance: totalAllowance,
    };

    // ─── Denomination Mix ───
    // Counts are note counts, NOT rupee amounts. We display both.
    const denomPicked: [number, number, number, number] = [0, 0, 0, 0];
    const denomLoaded: [number, number, number, number] = [0, 0, 0, 0];

    pickups.forEach((p: any) => {
      denomPicked[0] += (p.denom_2000 || 0);
      denomPicked[1] += (p.denom_500 || 0);
      denomPicked[2] += (p.denom_200 || 0);
      denomPicked[3] += (p.denom_100 || 0);
    });
    loads.forEach((l: any) => {
      denomLoaded[0] += (l.denom_2000 || 0);
      denomLoaded[1] += (l.denom_500 || 0);
      denomLoaded[2] += (l.denom_200 || 0);
      denomLoaded[3] += (l.denom_100 || 0);
    });

    // ─── Daily Trends ───
    const dateKeys = buildDateKeys(fromDate, toDate);
    const dailyMap = new Map<string, DailyRow>();
    dateKeys.forEach(d => dailyMap.set(d, { date: d, loads: 0, km: 0, bankPicked: 0, bankLoaded: 0, net: 0 }));

    loads.forEach((l: any) => {
      const d = (l.time_in || "").split("T")[0];
      const row = dailyMap.get(d);
      if (row) row.loads += 1;
    });
    travels.forEach((t: any) => {
      const d = (t.start_time || "").split("T")[0];
      const row = dailyMap.get(d);
      if (row) row.km += (t.km_covered || 0);
    });
    soa.forEach((r: any) => {
      const d = r.assignment_date;
      const row = dailyMap.get(d);
      if (row) {
        row.bankPicked += (r.bank_picked || r.cash_picked || 0);
        row.bankLoaded += (r.bank_loaded || 0);
        row.net += (r.final_net_cash_position || 0);
      }
    });
    const daily = dateKeys.map(d => dailyMap.get(d)!);

    // ─── Peak Hours ───
    const peaks = new Array(24).fill(0);
    loads.forEach((l: any) => {
      const t = l.time_in || l.time_out;
      if (t) peaks[new Date(t).getHours()] += 1;
    });

    // ─── Custodian Performance Scores ───
    // Composite score weighting:
    //   30% cash utilization (bank only) — measures planning accuracy
    //   25% load speed vs SLA — measures operational execution
    //   20% GPS compliance — measures audit readiness
    //   15% productivity (loads per assignment) — measures throughput
    //   10% route efficiency (fewer km per load = better) — measures route planning
    const custMap = new Map<string, {
      asgn: number; loads: number; bp: number; bl: number; km: number;
      durSum: number; durCount: number; gpsOk: number; gpsAll: number;
    }>();

    assignments.forEach((a: any) => {
      if (!custMap.has(a.custodian_id)) {
        custMap.set(a.custodian_id, { asgn: 0, loads: 0, bp: 0, bl: 0, km: 0, durSum: 0, durCount: 0, gpsOk: 0, gpsAll: 0 });
      }
      custMap.get(a.custodian_id)!.asgn += 1;
    });

    soa.forEach((r: any) => {
      const c = custMap.get(r.custodian_id);
      if (c) {
        c.bp += (r.bank_picked || r.cash_picked || 0);
        c.bl += (r.bank_loaded || 0);
        c.km += (r.travel_km || 0);
      }
    });

    loads.forEach((l: any) => {
      const a = assignMap.get(l.assignment_id);
      if (!a) return;
      const c = custMap.get(a.custodian_id);
      if (!c) return;
      c.loads += 1;
      c.gpsAll += 1;
      if (l.geo_status === "verified") c.gpsOk += 1;
      const dur = minDiff(l.time_in, l.time_out);
      if (dur > 0) { c.durSum += dur; c.durCount += 1; }
    });

    const custodians: CustodianRow[] = Array.from(custMap.entries())
      .map(([id, c]) => {
        const utilPct = c.bp > 0 ? (c.bl / c.bp) * 100 : 0;
        const avgMin = c.durCount ? c.durSum / c.durCount : 0;
        const kmPL = c.loads ? c.km / c.loads : 0;
        const gp = c.gpsAll ? (c.gpsOk / c.gpsAll) * 100 : 100;

        const utilScore = Math.min(utilPct, 100);
        const speedScore = avgMin > 0 ? Math.max(0, 100 - ((avgMin - 10) / 50) * 100) : 50;
        const gpsScore = gp;
        const productivityScore = c.asgn > 0 ? Math.min((c.loads / c.asgn) * 10, 100) : 0;
        const routeScore = kmPL > 0 ? Math.max(0, 100 - ((kmPL - 5) / 30) * 100) : 50;

        const score = utilScore * 0.3 + speedScore * 0.25 + gpsScore * 0.2 + productivityScore * 0.15 + routeScore * 0.1;

        return {
          id, name: nameMap.get(id) || id,
          assignments: c.asgn, loads: c.loads,
          utilPct, avgMin, km: c.km, kmPerLoad: kmPL,
          gpsPct: gp, score: Math.max(0, Math.min(100, score)),
        };
      })
      .sort((a, b) => b.score - a.score);

    // ─── Site Intelligence ───
    const siteStatsMap = new Map<number, { loads: number; durSum: number; durCount: number; excess: number; issues: number }>();

    loads.forEach((l: any) => {
      if (!siteStatsMap.has(l.site_id)) siteStatsMap.set(l.site_id, { loads: 0, durSum: 0, durCount: 0, excess: 0, issues: 0 });
      const s = siteStatsMap.get(l.site_id)!;
      s.loads += 1;
      const dur = minDiff(l.time_in, l.time_out);
      if (dur > 0) { s.durSum += dur; s.durCount += 1; }
    });

    excesses.forEach((e: any) => {
      if (!siteStatsMap.has(e.site_id)) siteStatsMap.set(e.site_id, { loads: 0, durSum: 0, durCount: 0, excess: 0, issues: 0 });
      siteStatsMap.get(e.site_id)!.excess += 1;
    });

    issues.forEach((i: any) => {
      if (!siteStatsMap.has(i.site_id)) siteStatsMap.set(i.site_id, { loads: 0, durSum: 0, durCount: 0, excess: 0, issues: 0 });
      siteStatsMap.get(i.site_id)!.issues += 1;
    });

    const sites: SiteRow[] = Array.from(siteStatsMap.entries())
      .map(([id, s]) => ({
        id, label: siteMap.get(id) || `Site ${id}`,
        loads: s.loads, avgMin: s.durCount ? s.durSum / s.durCount : 0,
        excessCount: s.excess, issueCount: s.issues,
      }))
      .sort((a, b) => b.loads - a.loads)
      .slice(0, 15);

    // ─── Bank-wise Pickups (bank source only, not internal) ───
    const bankMap = new Map<string, { amount: number; count: number }>();
    pickups.forEach((p: any) => {
      if (p.pickup_source === "ATM_INTERNAL") return;
      const bank = p.bank_name || "Unknown Bank";
      if (!bankMap.has(bank)) bankMap.set(bank, { amount: 0, count: 0 });
      const b = bankMap.get(bank)!;
      b.amount += (p.total_amount || 0);
      b.count += 1;
    });
    const banks: BankRow[] = Array.from(bankMap.entries())
      .map(([bank, v]) => ({ bank, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);

    // ─── Load Time Distribution ───
    const loadBuckets = [0, 0, 0, 0, 0, 0]; // [0-10, 10-20, 20-30, 30-45, 45-60, 60+]
    loadDurations.forEach((d: number) => {
      if (d <= 10) loadBuckets[0]++;
      else if (d <= 20) loadBuckets[1]++;
      else if (d <= 30) loadBuckets[2]++;
      else if (d <= 45) loadBuckets[3]++;
      else if (d <= 60) loadBuckets[4]++;
      else loadBuckets[5]++;
    });

    // ─── Anomaly Detection ───
    // Business rules based on RBI CMS operational norms
    const anomalies: Anomaly[] = [];

    if (kpis.cashUtilPct < 70 && kpis.bankPicked > 0)
      anomalies.push({ type: "cash", severity: "critical", title: "Low Cash Utilization",
        detail: `Only ${kpis.cashUtilPct.toFixed(1)}% of bank-picked cash is being loaded into ATMs. ₹${((kpis.bankPicked - kpis.bankLoaded)).toLocaleString("en-IN")} idle cash across the period. Review denomination planning and route coverage.` });
    else if (kpis.cashUtilPct < 85 && kpis.bankPicked > 0)
      anomalies.push({ type: "cash", severity: "warning", title: "Cash Utilization Below Target",
        detail: `${kpis.cashUtilPct.toFixed(1)}% utilization vs 90% target. Review denomination planning to reduce idle cash holding.` });

    if (kpis.gpsPct < 70)
      anomalies.push({ type: "gps", severity: "critical", title: "GPS Compliance Critical",
        detail: `Only ${kpis.gpsPct.toFixed(0)}% of ATM loads have verified GPS locations. This is an audit risk under RBI guidelines for CMS operations.` });
    else if (kpis.gpsPct < 90)
      anomalies.push({ type: "gps", severity: "warning", title: "GPS Verification Below Target",
        detail: `${kpis.gpsPct.toFixed(0)}% GPS verified vs 90% target. Ensure custodians enable location before loading.` });

    if (kpis.slaPct < 70)
      anomalies.push({ type: "load", severity: "critical", title: "SLA Breach Alert",
        detail: `Only ${kpis.slaPct.toFixed(0)}% of ATM loads completed within ${SLA_MINUTES}-minute SLA. Review load process bottlenecks and site access timing.` });
    else if (kpis.slaPct < 85)
      anomalies.push({ type: "load", severity: "warning", title: "SLA Compliance Slipping",
        detail: `${kpis.slaPct.toFixed(0)}% within SLA. ${loadDurations.filter((d: number) => d > SLA_MINUTES).length} loads exceeded the ${SLA_MINUTES}-min target.` });

    if (kpis.netExposure > 500000)
      anomalies.push({ type: "cash", severity: "critical", title: "High Cash Holding Risk",
        detail: `Average daily net cash position of ₹${kpis.netExposure.toLocaleString("en-IN")}. Custodians carrying excess cash – insurance and regulatory risk per RBI norms.` });

    if (kpis.internalPct > 25)
      anomalies.push({ type: "route", severity: "warning", title: "High Internal Transfer Ratio",
        detail: `${kpis.internalPct.toFixed(1)}% of loaded cash sourced from inter-ATM transfers instead of bank pickups. Review if bank withdrawal planning is adequate.` });

    if (kpis.eodPct < 80 && totalAssignments > 2)
      anomalies.push({ type: "route", severity: "warning", title: "EOD Submission Gap",
        detail: `Only ${kpis.eodPct.toFixed(0)}% of assignments approved. ${totalAssignments - approvedCount} pending EODs need review.` });

    // Flag low-performing custodians
    custodians.filter(c => c.score < 40 && c.loads > 0).slice(0, 2).forEach(c => {
      anomalies.push({ type: "route", severity: "warning", title: `Low Performance: ${c.name}`,
        detail: `Score ${c.score.toFixed(0)}/100. Utilization ${c.utilPct.toFixed(0)}%, Avg load ${c.avgMin.toFixed(0)} min, GPS ${c.gpsPct.toFixed(0)}%.` });
    });

    // Flag slow sites
    sites.filter(s => s.avgMin > 45 && s.loads >= 3).slice(0, 2).forEach(s => {
      anomalies.push({ type: "load", severity: "warning", title: `Slow Site: ${s.label.slice(0, 40)}`,
        detail: `${s.avgMin.toFixed(0)} min average load time across ${s.loads} loads. Investigate site access or technical issues.` });
    });

    setData({
      kpis, denom: { picked: denomPicked, loaded: denomLoaded },
      daily, custodians, sites, peaks, anomalies, banks, loadBuckets,
      bankPickupTrends, atmPerformance, cashRecycling: recyclingMetrics, riskIndicators,
    });
  } catch (err: any) {
    setError(err.message || "Failed to load analytics");
  } finally {
    setLoading(false);
  }
}

function buildEmpty(from: string, to: string): Analytics {
  const keys = buildDateKeys(from, to);
  return {
    kpis: {
      cashUtilPct: 0, costPerLoad: 0, avgLoadMin: 0, slaPct: 100,
      assignments: 0, loads: 0, travelKm: 0, eodPct: 0, netExposure: 0,
      gpsPct: 100, internalPct: 0, bankPicked: 0, bankLoaded: 0,
      intPicked: 0, intLoaded: 0, excess: 0, travelAllowance: 0,
    },
    denom: { picked: [0, 0, 0, 0], loaded: [0, 0, 0, 0] },
    daily: keys.map(d => ({ date: d, loads: 0, km: 0, bankPicked: 0, bankLoaded: 0, net: 0 })),
    custodians: [], sites: [], peaks: new Array(24).fill(0),
    anomalies: [], banks: [], loadBuckets: [0, 0, 0, 0, 0, 0],
    bankPickupTrends: [], atmPerformance: [],
    cashRecycling: { atmRemoved: 0, atmReused: 0, bankPickup: 0, recyclingPercent: 0, internalReusePercent: 0 },
    riskIndicators: [],
  };
}

/* ================================================================
   UI COMPONENTS
   ================================================================ */

function SectionHead({ title, question }: { title: string; question: string }) {
  return (
    <div className="mb-2.5">
      <h2 className="text-base sm:text-lg font-bold text-slate-800">{title}</h2>
      <p className="text-xs text-slate-500 italic">{question}</p>
    </div>
  );
}

function KPI({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  const ring =
    color === "green" ? "border-l-emerald-500" :
    color === "amber" ? "border-l-amber-400" :
    color === "red" ? "border-l-red-500" :
    "border-l-slate-300";
  return (
    <div className={`bg-white rounded-lg border border-slate-200 border-l-4 ${ring} p-3 shadow-sm`}>
      <div className="text-[11px] text-slate-500 font-medium leading-tight">{label}</div>
      <div className="text-lg sm:text-xl font-bold text-slate-800 mt-0.5 leading-tight">{value}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4">
      <div className="mb-3">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <div className="text-xs text-slate-400 py-4 text-center">{msg}</div>;
}

/* ── Filter Multi-Select Dropdown ── */
function FilterMultiSelect<T extends { id: any; label: string }>({
  title, options, selected, onChange,
}: {
  title: string; options: T[]; selected: any[]; onChange: (v: any[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="text-[11px] font-medium text-slate-500 mb-1 block">{title}</label>
      <button onClick={() => setOpen(!open)}
        className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm text-left bg-white truncate">
        {selected.length ? `${selected.length} selected` : `All ${title.toLowerCase()}`}
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-slate-200 rounded shadow-lg max-h-48 overflow-y-auto">
          {options.length === 0 ? (
            <div className="text-xs text-slate-400 p-2">None found</div>
          ) : (
            <>
              {selected.length > 0 && (
                <button onClick={() => onChange([])}
                  className="text-xs text-blue-600 px-2 py-1 w-full text-left hover:bg-slate-50">
                  Clear all
                </button>
              )}
              {options.map(opt => (
                <label key={opt.id} className="flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 cursor-pointer">
                  <input type="checkbox" className="h-3.5 w-3.5"
                    checked={selected.includes(opt.id)}
                    onChange={e => onChange(
                      e.target.checked
                        ? [...selected, opt.id]
                        : selected.filter(id => id !== opt.id)
                    )} />
                  <span className="text-xs text-slate-700 line-clamp-1">{opt.label}</span>
                </label>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Custodian Performance Table ── */
function CustodianTable({ rows, fmt }: { rows: CustodianRow[]; fmt: (v: number) => string }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">#</th>
            <th className="px-3 py-2 text-left font-semibold">Custodian</th>
            <th className="px-3 py-2 text-center font-semibold">Score</th>
            <th className="px-3 py-2 text-right font-semibold">Loads</th>
            <th className="px-3 py-2 text-right font-semibold">Util%</th>
            <th className="px-3 py-2 text-right font-semibold">Avg Time</th>
            <th className="px-3 py-2 text-right font-semibold">Km/Load</th>
            <th className="px-3 py-2 text-right font-semibold">GPS%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => (
            <tr key={c.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
              <td className="px-3 py-2 text-slate-400">{i + 1}</td>
              <td className="px-3 py-2 font-medium text-slate-800 max-w-[160px] truncate">{c.name}</td>
              <td className="px-3 py-2">
                <div className="flex items-center justify-center gap-1.5">
                  <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{
                      width: `${c.score}%`,
                      backgroundColor: c.score >= 70 ? "#059669" : c.score >= 40 ? "#d97706" : "#dc2626",
                    }} />
                  </div>
                  <span className="text-[10px] text-slate-500 w-7 text-right">{c.score.toFixed(0)}</span>
                </div>
              </td>
              <td className="px-3 py-2 text-right">{c.loads}</td>
              <td className="px-3 py-2 text-right">
                <span className={c.utilPct >= 90 ? "text-emerald-600" : c.utilPct >= 70 ? "text-amber-600" : "text-red-600"}>
                  {c.utilPct.toFixed(0)}%
                </span>
              </td>
              <td className="px-3 py-2 text-right">
                <span className={c.avgMin <= SLA_MINUTES ? "text-emerald-600" : "text-red-600"}>
                  {c.avgMin.toFixed(0)}m
                </span>
              </td>
              <td className="px-3 py-2 text-right">{c.kmPerLoad.toFixed(1)}</td>
              <td className="px-3 py-2 text-right">
                <span className={c.gpsPct >= 90 ? "text-emerald-600" : c.gpsPct >= 70 ? "text-amber-600" : "text-red-600"}>
                  {c.gpsPct.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="p-2 text-[10px] text-slate-400 border-t">
        Score = 30% Cash Utilization + 25% Load Speed + 20% GPS Compliance + 15% Productivity + 10% Route Efficiency
      </div>
    </div>
  );
}

/* ── Site Intelligence Table ── */
function SiteTable({ rows }: { rows: SiteRow[] }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-x-auto">
      <table className="w-full text-xs sm:text-sm">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="px-3 py-2 text-left font-semibold">Site</th>
            <th className="px-3 py-2 text-right font-semibold">Loads</th>
            <th className="px-3 py-2 text-right font-semibold">Avg Time</th>
            <th className="px-3 py-2 text-right font-semibold">Excess</th>
            <th className="px-3 py-2 text-right font-semibold">Issues</th>
            <th className="px-3 py-2 text-center font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => {
            const hasProblems = s.avgMin > 40 || s.excessCount > 2 || s.issueCount > 1;
            return (
              <tr key={s.id} className={i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}>
                <td className="px-3 py-2 font-medium text-slate-800 max-w-[200px] truncate">{s.label}</td>
                <td className="px-3 py-2 text-right">{s.loads}</td>
                <td className="px-3 py-2 text-right">
                  <span className={s.avgMin <= SLA_MINUTES ? "text-emerald-600" : "text-red-600"}>
                    {s.avgMin.toFixed(0)}m
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{s.excessCount || "—"}</td>
                <td className="px-3 py-2 text-right">{s.issueCount || "—"}</td>
                <td className="px-3 py-2 text-center">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                    hasProblems ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700"
                  }`}>
                    {hasProblems ? "Needs Review" : "Healthy"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ================================================================
   CHART COMPONENTS (Pure SVG — no dependencies)
   ================================================================ */

/* ── Dual Area Chart: Picked vs Loaded ── */
function DualAreaChart({ data }: { data: DailyRow[] }) {
  if (!data.length) return <Empty msg="No trend data." />;
  const W = 600, H = 160, P = 24;
  const maxV = Math.max(...data.map(d => Math.max(d.bankPicked, d.bankLoaded)), 1);
  const xStep = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;

  const toPoints = (key: "bankPicked" | "bankLoaded") =>
    data.map((d, i) => ({ x: P + i * xStep, y: H - P - ((d[key] || 0) / maxV) * (H - P * 2) }));

  const pickedPts = toPoints("bankPicked");
  const loadedPts = toPoints("bankLoaded");

  const line = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const area = (pts: { x: number; y: number }[]) =>
    `${line(pts)} L${W - P},${H - P} L${P},${H - P} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-36" preserveAspectRatio="none">
        <path d={area(pickedPts)} fill="#dbeafe" opacity={0.5} />
        <path d={area(loadedPts)} fill="#dcfce7" opacity={0.5} />
        <path d={line(pickedPts)} fill="none" stroke="#2563eb" strokeWidth={2} />
        <path d={line(loadedPts)} fill="none" stroke="#059669" strokeWidth={2} />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
        <span>{formatISTDate(data[0].date, "short")}</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-600" />Picked</span>
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-emerald-600" />Loaded</span>
        </div>
        <span>{formatISTDate(data[data.length - 1].date, "short")}</span>
      </div>
    </div>
  );
}

/* ── Denomination Comparison Chart ── */
function DenomChart({ picked, loaded }: { picked: [number, number, number, number]; loaded: [number, number, number, number] }) {
  const pickedAmts = picked.map((c, i) => c * DENOM_VALUES[i]);
  const loadedAmts = loaded.map((c, i) => c * DENOM_VALUES[i]);
  const maxAmt = Math.max(...pickedAmts, ...loadedAmts, 1);

  return (
    <div className="space-y-2">
      {DENOM_LABELS.map((label, i) => (
        <div key={label} className="space-y-0.5">
          <div className="flex justify-between text-[11px]">
            <span className="font-medium text-slate-700">{label}</span>
            <span className="text-slate-500">
              P: {picked[i].toLocaleString()} · L: {loaded[i].toLocaleString()} notes
            </span>
          </div>
          <div className="flex gap-0.5">
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full opacity-70" style={{
                width: `${(pickedAmts[i] / maxAmt) * 100}%`,
                backgroundColor: DENOM_COLORS[i],
              }} />
            </div>
            <div className="flex-1 bg-slate-100 rounded-full h-2 overflow-hidden">
              <div className="h-full rounded-full" style={{
                width: `${(loadedAmts[i] / maxAmt) * 100}%`,
                backgroundColor: DENOM_COLORS[i],
              }} />
            </div>
          </div>
          <div className="flex text-[9px] text-slate-400">
            <span className="flex-1">Picked</span>
            <span className="flex-1">Loaded</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Source Donut: Bank vs Internal ── */
function SourceDonut({ kpis, fmt }: { kpis: ExecutiveKPIs; fmt: (v: number) => string }) {
  const total = kpis.bankLoaded + kpis.intLoaded;
  if (total === 0) return <Empty msg="No load data." />;

  const bankPct = (kpis.bankLoaded / total) * 100;
  const intPct = (kpis.intLoaded / total) * 100;

  const R = 60, CX = 80, CY = 76;
  const bankAngle = (bankPct / 100) * 360;
  const bankArc = describeArc(CX, CY, R, 0, bankAngle);
  const intArc = describeArc(CX, CY, R, bankAngle, 360);

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 160 160" className="w-32 h-32 flex-shrink-0">
        <path d={bankArc} fill="#2563eb" />
        <path d={intArc} fill="#f59e0b" />
        <circle cx={CX} cy={CY} r={38} fill="white" />
        <text x={CX} y={CY - 4} textAnchor="middle" className="text-[11px] font-bold fill-slate-800">
          {bankPct.toFixed(0)}%
        </text>
        <text x={CX} y={CY + 10} textAnchor="middle" className="text-[8px] fill-slate-500">Bank</text>
      </svg>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-blue-600 inline-block flex-shrink-0" />
          <div>
            <div className="font-medium text-slate-700">Bank Source</div>
            <div className="text-slate-500">{fmt(kpis.bankLoaded)} ({bankPct.toFixed(1)}%)</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded bg-amber-500 inline-block flex-shrink-0" />
          <div>
            <div className="font-medium text-slate-700">Internal Transfer</div>
            <div className="text-slate-500">{fmt(kpis.intLoaded)} ({intPct.toFixed(1)}%)</div>
          </div>
        </div>
        <div className="border-t pt-1.5 mt-1.5">
          <div className="text-[11px] text-slate-600">
            <strong>Picked:</strong> {fmt(kpis.bankPicked)} bank + {fmt(kpis.intPicked)} internal
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Horizontal Bar Chart ── */
function HBar({ data, fmt }: { data: { label: string; value: number; sub?: string }[]; fmt?: (v: number) => string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="space-y-2">
      {data.map(item => (
        <div key={item.label} className="space-y-0.5">
          <div className="flex justify-between text-[11px] text-slate-600">
            <span className="line-clamp-1 pr-2 max-w-[60%]">{item.label}</span>
            <span className="font-medium flex-shrink-0">
              {fmt ? fmt(item.value) : item.value}{item.sub ? ` · ${item.sub}` : ""}
            </span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="h-full rounded-full bg-primary" style={{ width: `${(item.value / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Load Time Distribution Buckets ── */
function LoadTimeBuckets({ buckets, slaIdx }: { buckets: number[]; slaIdx: number }) {
  const max = Math.max(...buckets, 1);
  const total = buckets.reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-1.5">
      {LOAD_BUCKETS.map((label, i) => {
        const withinSla = i <= slaIdx;
        const pct = total > 0 ? ((buckets[i] / total) * 100).toFixed(0) : "0";
        return (
          <div key={label} className="flex items-center gap-2">
            <span className="text-[11px] text-slate-500 w-12 text-right font-mono">{label}m</span>
            <div className="flex-1 bg-slate-100 rounded-full h-3 overflow-hidden">
              <div className="h-full rounded-full transition-all" style={{
                width: `${(buckets[i] / max) * 100}%`,
                backgroundColor: withinSla ? "#059669" : i <= slaIdx + 1 ? "#d97706" : "#dc2626",
              }} />
            </div>
            <span className="text-[10px] text-slate-500 w-14 text-right">
              {buckets[i]} ({pct}%)
            </span>
          </div>
        );
      })}
      <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
        <span className="inline-block w-2 h-2 rounded bg-emerald-600" /> Within SLA
        <span className="inline-block w-2 h-2 rounded bg-amber-500 ml-2" /> Near limit
        <span className="inline-block w-2 h-2 rounded bg-red-600 ml-2" /> Breach
      </div>
    </div>
  );
}

/* ── Peak Hours Heat Strip ── */
function HeatStrip({ hours }: { hours: number[] }) {
  const max = Math.max(...hours, 1);
  return (
    <div>
      <div className="flex gap-[2px]">
        {hours.map((count, h) => {
          const intensity = count / max;
          return (
            <div key={h} className="flex-1 flex flex-col items-center">
              <div className="w-full aspect-square rounded-sm" style={{
                backgroundColor: intensity > 0.7 ? "#1d4ed8" : intensity > 0.4 ? "#60a5fa" : intensity > 0 ? "#bfdbfe" : "#f1f5f9",
              }} title={`${h}:00 – ${count} loads`} />
              {h % 3 === 0 && <span className="text-[8px] text-slate-400 mt-0.5">{h}</span>}
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] text-slate-400">12 AM</span>
        <div className="flex items-center gap-1 text-[9px] text-slate-400">
          <span className="w-3 h-2 rounded-sm bg-slate-100 inline-block" />Low
          <span className="w-3 h-2 rounded-sm bg-blue-300 inline-block ml-1" />Medium
          <span className="w-3 h-2 rounded-sm bg-blue-700 inline-block ml-1" />High
        </div>
        <span className="text-[9px] text-slate-400">11 PM</span>
      </div>
    </div>
  );
}

/* ── Daily Ops Chart: Loads + Km ── */
function DailyOpsChart({ data }: { data: DailyRow[] }) {
  if (!data.length) return <Empty msg="No data." />;
  const W = 600, H = 140, P = 20;
  const maxLoads = Math.max(...data.map(d => d.loads), 1);
  const maxKm = Math.max(...data.map(d => d.km), 1);
  const xStep = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;

  const loadLine = data.map((d, i) => {
    const x = P + i * xStep;
    const y = H - P - (d.loads / maxLoads) * (H - P * 2);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  const kmLine = data.map((d, i) => {
    const x = P + i * xStep;
    const y = H - P - (d.km / maxKm) * (H - P * 2);
    return `${i === 0 ? "M" : "L"}${x},${y}`;
  }).join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
        <path d={kmLine} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4,3" />
        <path d={loadLine} fill="none" stroke="#2563eb" strokeWidth={2.5} />
      </svg>
      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
        <span>{formatISTDate(data[0].date, "short")}</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-600" />Loads</span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 border-b border-dashed border-amber-500" />Travel Km
          </span>
        </div>
        <span>{formatISTDate(data[data.length - 1].date, "short")}</span>
      </div>
    </div>
  );
}

/* ── Net Cash Exposure Trend ── */
function NetExposureChart({ data }: { data: DailyRow[] }) {
  if (!data.length) return <Empty msg="No data." />;
  const W = 600, H = 140, P = 20;
  const maxNet = Math.max(...data.map(d => Math.abs(d.net)), 1);
  const xStep = data.length > 1 ? (W - P * 2) / (data.length - 1) : 0;
  const baseline = H - P;

  const pts = data.map((d, i) => ({
    x: P + i * xStep,
    y: baseline - (d.net / maxNet) * (H - P * 2),
  }));

  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath = `${linePath} L${W - P},${baseline} L${P},${baseline} Z`;

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-32" preserveAspectRatio="none">
        <path d={areaPath} fill="#fef3c7" opacity={0.5} />
        <path d={linePath} fill="none" stroke="#d97706" strokeWidth={2} />
        {/* ₹5L risk threshold line */}
        {maxNet >= 500000 && (
          <line
            x1={P} y1={baseline - (500000 / maxNet) * (H - P * 2)}
            x2={W - P} y2={baseline - (500000 / maxNet) * (H - P * 2)}
            stroke="#dc2626" strokeWidth={1} strokeDasharray="4,3" opacity={0.6}
          />
        )}
      </svg>
      <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
        <span>{formatISTDate(data[0].date, "short")}</span>
        <div className="flex gap-3">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-amber-600" />Net Position
          </span>
          {maxNet >= 500000 && (
            <span className="flex items-center gap-1">
              <span className="inline-block w-3 border-b border-dashed border-red-500" />₹5L limit
            </span>
          )}
        </div>
        <span>{formatISTDate(data[data.length - 1].date, "short")}</span>
      </div>
    </div>
  );
}

/* ================================================================
   NEW ANALYTICS UI COMPONENTS
   ================================================================ */

/* ── Bank Pickup Trends Table ── */
function BankPickupTable({ rows, fmt }: { rows: BankPickupTrend[]; fmt: (v: number) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th className="text-left py-1 pr-2 font-medium">Bank</th>
            <th className="text-left py-1 pr-2 font-medium">Branch</th>
            <th className="text-right py-1 px-1 font-medium">Count</th>
            <th className="text-right py-1 px-1 font-medium">Total</th>
            <th className="text-right py-1 px-1 font-medium">Avg</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-1.5 pr-2 text-slate-700 font-medium">{r.bank}</td>
              <td className="py-1.5 pr-2 text-slate-600">{r.branch}</td>
              <td className="py-1.5 px-1 text-right text-slate-700">{r.count}</td>
              <td className="py-1.5 px-1 text-right text-slate-900 font-semibold">{fmt(r.total)}</td>
              <td className="py-1.5 px-1 text-right text-slate-600">{fmt(r.avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Pickup Scatter: Frequency vs Amount ── */
function PickupScatterChart({ data }: { data: BankPickupTrend[] }) {
  if (!data.length) return <Empty msg="No data" />;
  const W = 400, H = 180, P = 30;
  const maxCount = Math.max(...data.map(d => d.count), 1);
  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
        {data.map((d, i) => {
          const x = P + (d.count / maxCount) * (W - P * 2);
          const y = H - P - (d.total / maxTotal) * (H - P * 2);
          return (
            <circle key={i} cx={x} cy={y} r={4} fill="#3b82f6" opacity={0.6}
              title={`${d.bank} ${d.branch}: ${d.count} pickups, ₹${d.total.toLocaleString()}`} />
          );
        })}
      </svg>
      <div className="text-[9px] text-slate-400 mt-1 text-center">
        Horizontal: Pickup Count · Vertical: Total Amount
      </div>
    </div>
  );
}

/* ── Variance Bar Chart ── */
function VarianceBarChart({ data }: { data: BankPickupTrend[] }) {
  if (!data.length) return <Empty msg="No variance data" />;
  const maxVar = Math.max(...data.map(d => d.variance_rate), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-slate-600 truncate">{d.bank} - {d.branch}</span>
            <span className="text-red-600 font-semibold">{d.variance_rate.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div className="h-full rounded-full bg-red-500" style={{ width: `${(d.variance_rate / maxVar) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Cash Recycling Metrics Display ── */
function RecyclingMetrics({ metrics, fmt }: { metrics: CashRecyclingMetrics; fmt: (v: number) => string }) {
  const items = [
    { label: "ATM Removed", value: fmt(metrics.atmRemoved), color: "text-amber-600" },
    { label: "ATM Reused", value: fmt(metrics.atmReused), color: "text-emerald-600" },
    { label: "Recycling Rate", value: `${metrics.recyclingPercent.toFixed(1)}%`, color: "text-blue-600" },
    { label: "Internal Reuse %", value: `${metrics.internalReusePercent.toFixed(1)}%`, color: "text-purple-600" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map((item, i) => (
        <div key={i} className="bg-slate-50 rounded p-2">
          <div className="text-[10px] text-slate-500 font-medium">{item.label}</div>
          <div className={`text-lg font-bold ${item.color} mt-0.5`}>{item.value}</div>
        </div>
      ))}
    </div>
  );
}

/* ── ATM Performance Table ── */
function ATMPerformanceTable({ rows, fmt }: { rows: ATMPerformance[]; fmt: (v: number) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-600">
            <th className="text-left py-1 pr-2 font-medium">ATM Site</th>
            <th className="text-right py-1 px-1 font-medium">Loads</th>
            <th className="text-right py-1 px-1 font-medium">Total Loaded</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-1.5 pr-2 text-slate-700 truncate max-w-[200px]" title={r.label}>{r.label}</td>
              <td className="py-1.5 px-1 text-right text-slate-700 font-semibold">{r.loadCount}</td>
              <td className="py-1.5 px-1 text-right text-slate-900 font-semibold">{fmt(r.totalLoaded)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Efficiency Distribution ── */
function EfficiencyDistribution({ data }: { data: ATMPerformance[] }) {
  const buckets = [0, 0, 0, 0]; // [0-25%, 25-50%, 50-75%, 75-100%]
  data.forEach(d => {
    const eff = d.efficiencyScore;
    if (eff < 25) buckets[0]++;
    else if (eff < 50) buckets[1]++;
    else if (eff < 75) buckets[2]++;
    else buckets[3]++;
  });
  const max = Math.max(...buckets, 1);
  const labels = ["0-25%", "25-50%", "50-75%", "75-100%"];
  const colors = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981"];

  return (
    <div className="space-y-2">
      {labels.map((label, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[11px] text-slate-600 w-16">{label}</span>
          <div className="flex-1 bg-slate-100 rounded-full h-3">
            <div className="h-full rounded-full transition-all" style={{
              width: `${(buckets[i] / max) * 100}%`,
              backgroundColor: colors[i],
            }} />
          </div>
          <span className="text-[11px] text-slate-600 w-8 text-right">{buckets[i]}</span>
        </div>
      ))}
    </div>
  );
}

/* ── City-wise Horizontal Bar ── */
function CityHBar({ data, fmt }: { data: { city: string; total: number }[]; fmt: (v: number) => string }) {
  if (!data.length) return <Empty msg="No city data" />;
  const max = Math.max(...data.map(d => d.total), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i}>
          <div className="flex justify-between text-[10px] mb-0.5">
            <span className="text-slate-700 font-medium">{d.city}</span>
            <span className="text-slate-900 font-semibold">{fmt(d.total)}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(d.total / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Risk Indicator List ── */
function RiskIndicatorList({ risks }: { risks: RiskIndicator[] }) {
  const iconMap: Record<string, string> = {
    "HIGH_VARIANCE_BRANCH": "⚠️",
    "ATM_OVERLOAD": "📦",
    "LOW_CASH_RECYCLING": "🔄",
  };
  return (
    <div className="space-y-1.5">
      {risks.map((r, i) => (
        <div key={i} className="bg-amber-50 border border-amber-200 rounded p-2 text-[11px]">
          <div className="flex items-start gap-2">
            <span className="text-sm flex-shrink-0">{iconMap[r.type] || "🔔"}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-amber-800">{r.identifier}</div>
              <div className="text-slate-600 text-[10px] mt-0.5">{r.description}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Helper: Aggregate ATM data by city ── */
function aggregateByCity(data: ATMPerformance[]): { city: string; total: number }[] {
  const map = new Map<string, number>();
  data.forEach(d => {
    const curr = map.get(d.city) || 0;
    map.set(d.city, curr + d.totalLoaded);
  });
  return Array.from(map.entries())
    .map(([city, total]) => ({ city, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
}

/* ================================================================
   SVG HELPERS
   ================================================================ */

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const rad = (a: number) => ((a - 90) * Math.PI) / 180;
  const start = { x: cx + r * Math.cos(rad(endAngle)), y: cy + r * Math.sin(rad(endAngle)) };
  const end = { x: cx + r * Math.cos(rad(startAngle)), y: cy + r * Math.sin(rad(startAngle)) };
  const large = endAngle - startAngle > 180 ? 1 : 0;
  return `M${cx},${cy} L${start.x},${start.y} A${r},${r} 0 ${large} 0 ${end.x},${end.y} Z`;
}

/* ================================================================
   UTILITIES
   ================================================================ */

function isoDate(d: Date) { return d.toISOString().split("T")[0]; }

function daysAgo(n: number) { return new Date(Date.now() - n * 864e5); }

function buildDateKeys(from: string, to: string) {
  const s = new Date(from), e = new Date(to), keys: string[] = [];
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) keys.push(isoDate(d));
  return keys;
}

function minDiff(start?: string, end?: string) {
  if (!start || !end) return 0;
  const d = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
  return d > 0 && Number.isFinite(d) ? d : 0;
}
