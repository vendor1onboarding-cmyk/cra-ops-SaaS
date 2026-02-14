import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../api/supabaseClient";
import { AppLayout } from "../../components/Layout";
import { formatISTDate } from "../../utils/time";

interface AnalyticsMetrics {
  totalAssignments: number;
  totalCashPicked: number;
  totalCashLoaded: number;
  totalExcessReported: number;
  avgNetCashPosition: number;
  totalTravelKm: number;
  totalLoads: number;
  avgLoadMinutes: number;
  topCustodians: Array<{ id: string; name: string; assignments: number; loads: number }>;
  topSites: Array<{ id: number; label: string; loads: number; avgMinutes: number }>;
  dailyLoadTrend: Array<{ date: string; loads: number }>;
  dailyTravelKm: Array<{ date: string; km: number }>;
  peakHours: Array<{ hour: number; count: number }>;
}

interface OptionItem {
  id: string;
  label: string;
}

interface SiteOption {
  id: number;
  label: string;
}

export default function AdvancedAnalytics() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [fromDate, setFromDate] = useState(() => toISODate(daysAgo(29)));
  const [toDate, setToDate] = useState(() => toISODate(new Date()));
  const [custodianOptions, setCustodianOptions] = useState<OptionItem[]>([]);
  const [siteOptions, setSiteOptions] = useState<SiteOption[]>([]);
  const [selectedCustodians, setSelectedCustodians] = useState<string[]>([]);
  const [selectedSites, setSelectedSites] = useState<number[]>([]);

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  const dateRangeLabel = useMemo(() => {
    const fromLabel = formatISTDate(fromDate, "short");
    const toLabel = formatISTDate(toDate, "short");
    return `${fromLabel} → ${toLabel}`;
  }, [fromDate, toDate]);

  useEffect(() => {
    async function loadOptions() {
      const [{ data: profiles }, { data: sites }] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role").order("full_name"),
        supabase
          .from("sites")
          .select("id, bank_name, address, site_code, atm_id")
          .order("bank_name"),
      ]);

      const custodianList = (profiles || [])
        .filter((p: any) => p.role === "custodian")
        .map((p: any) => ({ id: p.id, label: p.full_name }));

      const siteList = (sites || []).map((s: any) => {
        const bank = s.bank_name || "Bank";
        const address = s.address || s.site_code || "Location";
        const atm = s.atm_id ? ` (ATM: ${s.atm_id})` : "";
        return { id: s.id, label: `${bank} – ${address}${atm}` };
      });

      setCustodianOptions(custodianList);
      setSiteOptions(siteList);
    }

    loadOptions();
  }, []);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);

      try {
        const assignmentQuery = supabase
          .from("assignments")
          .select("id, assignment_date, custodian_id")
          .gte("assignment_date", fromDate)
          .lte("assignment_date", toDate);

        if (selectedCustodians.length > 0) {
          assignmentQuery.in("custodian_id", selectedCustodians);
        }

        const { data: assignments, error: assignmentsError } = await assignmentQuery;
        if (assignmentsError) throw assignmentsError;

        const assignmentData = assignments || [];
        const assignmentIds = assignmentData.map((a: any) => a.id);

        let filteredAssignmentIds = assignmentIds;
        let loadRows: any[] = [];

        if (selectedSites.length > 0) {
          const { data: loads, error: loadsError } = await supabase
            .from("atm_replenishments")
            .select("assignment_id, site_id, time_in, time_out")
            .in("site_id", selectedSites)
            .gte("time_in", `${fromDate}T00:00:00.000Z`)
            .lte("time_in", `${toDate}T23:59:59.999Z`);

          if (loadsError) throw loadsError;
          loadRows = loads || [];

          const loadAssignmentIds = new Set(loadRows.map((r: any) => r.assignment_id));
          filteredAssignmentIds = assignmentIds.filter((id) => loadAssignmentIds.has(id));
        }

        if (filteredAssignmentIds.length === 0) {
          setMetrics(buildEmptyMetrics(buildDateKeys(fromDate, toDate)));
          return;
        }

        const [
          { data: soaRows, error: soaError },
          { data: travelLogs, error: travelError },
          { data: loadsAll, error: loadsAllError },
        ] = await Promise.all([
          supabase
            .from("v_soa_effective")
            .select(
              `assignment_id,
               assignment_date,
               cash_picked,
               cash_loaded,
               bank_picked,
               bank_loaded,
               internal_picked,
               internal_loaded,
               excess_reported,
               final_net_cash_position,
               custodian_id`
            )
            .in("assignment_id", filteredAssignmentIds),
          supabase
            .from("travel_logs")
            .select("assignment_id, start_time, km_covered")
            .in("assignment_id", filteredAssignmentIds),
          supabase
            .from("atm_replenishments")
            .select("assignment_id, site_id, time_in, time_out")
            .in("assignment_id", filteredAssignmentIds)
            .gte("time_in", `${fromDate}T00:00:00.000Z`)
            .lte("time_in", `${toDate}T23:59:59.999Z`),
        ]);

        if (soaError) throw soaError;
        if (travelError) throw travelError;
        if (loadsAllError) throw loadsAllError;

        const soaData = soaRows || [];
        const travelData = travelLogs || [];
        const loadsData = selectedSites.length > 0 ? loadRows : loadsAll || [];

        const assignmentMap = new Map(
          assignmentData.map((a: any) => [a.id, a])
        );

        const nameMap = new Map(
          custodianOptions.map((c) => [c.id, c.label])
        );

        const siteMap = new Map(siteOptions.map((s) => [s.id, s.label]));

        const totalAssignments = assignmentData.filter((a: any) =>
          filteredAssignmentIds.includes(a.id)
        ).length;

        // CRITICAL: Use bank_picked and bank_loaded for KPI metrics
        // Internal transfers are neutral and must NOT inflate KPI totals
        const totalCashPicked = soaData.reduce(
          (sum: number, r: any) => sum + (r.bank_picked || r.cash_picked || 0),
          0
        );
        const totalCashLoaded = soaData.reduce(
          (sum: number, r: any) => sum + (r.bank_loaded || 0),
          0
        );
        const totalExcessReported = soaData.reduce(
          (sum: number, r: any) => sum + (r.excess_reported || 0),
          0
        );

        const netPositions: number[] = soaData.map(
          (r: any) => r.final_net_cash_position || 0
        );
        const avgNetCashPosition = netPositions.length
          ? netPositions.reduce((a, b) => a + b, 0) / netPositions.length
          : 0;

        const totalTravelKm = travelData.reduce(
          (sum: number, t: any) => sum + (t.km_covered || 0),
          0
        );

        const totalLoads = loadsData.length;

        const loadDurations = loadsData
          .map((l: any) => getMinutesDiff(l.time_in, l.time_out))
          .filter((v: number) => v > 0);
        const avgLoadMinutes = loadDurations.length
          ? loadDurations.reduce((a: number, b: number) => a + b, 0) /
            loadDurations.length
          : 0;

        const custodianAssignmentCounts: Record<string, number> = {};
        assignmentData.forEach((a: any) => {
          if (!filteredAssignmentIds.includes(a.id)) return;
          custodianAssignmentCounts[a.custodian_id] =
            (custodianAssignmentCounts[a.custodian_id] || 0) + 1;
        });

        const custodianLoadCounts: Record<string, number> = {};
        loadsData.forEach((l: any) => {
          const assignment = assignmentMap.get(l.assignment_id);
          if (!assignment) return;
          const custodianId = assignment.custodian_id;
          custodianLoadCounts[custodianId] =
            (custodianLoadCounts[custodianId] || 0) + 1;
        });

        const topCustodians = Object.keys(custodianAssignmentCounts)
          .map((id) => ({
            id,
            name: nameMap.get(id) || id,
            assignments: custodianAssignmentCounts[id] || 0,
            loads: custodianLoadCounts[id] || 0,
          }))
          .sort((a, b) => b.loads - a.loads)
          .slice(0, 6);

        const siteLoadCounts: Record<number, number> = {};
        const siteDurationTotals: Record<number, number> = {};
        const siteDurationCounts: Record<number, number> = {};

        loadsData.forEach((l: any) => {
          siteLoadCounts[l.site_id] = (siteLoadCounts[l.site_id] || 0) + 1;
          const minutes = getMinutesDiff(l.time_in, l.time_out);
          if (minutes > 0) {
            siteDurationTotals[l.site_id] =
              (siteDurationTotals[l.site_id] || 0) + minutes;
            siteDurationCounts[l.site_id] =
              (siteDurationCounts[l.site_id] || 0) + 1;
          }
        });

        const topSites = Object.keys(siteLoadCounts)
          .map((idStr) => {
            const id = Number(idStr);
            const avgMinutes = siteDurationCounts[id]
              ? siteDurationTotals[id] / siteDurationCounts[id]
              : 0;
            return {
              id,
              label: siteMap.get(id) || `Site ${id}`,
              loads: siteLoadCounts[id] || 0,
              avgMinutes,
            };
          })
          .sort((a, b) => b.loads - a.loads)
          .slice(0, 6);

        const dateKeys = buildDateKeys(fromDate, toDate);
        const dailyLoadTrend = dateKeys.map((date) => ({ date, loads: 0 }));
        const dailyTravelKm = dateKeys.map((date) => ({ date, km: 0 }));

        const loadIndex = new Map(
          dailyLoadTrend.map((d, idx) => [d.date, idx])
        );
        const travelIndex = new Map(
          dailyTravelKm.map((d, idx) => [d.date, idx])
        );

        loadsData.forEach((l: any) => {
          const dateStr = (l.time_in || "").split("T")[0];
          const idx = loadIndex.get(dateStr);
          if (idx === undefined) return;
          dailyLoadTrend[idx].loads += 1;
        });

        travelData.forEach((t: any) => {
          const dateStr = (t.start_time || "").split("T")[0];
          const idx = travelIndex.get(dateStr);
          if (idx === undefined) return;
          dailyTravelKm[idx].km += t.km_covered || 0;
        });

        const peakHours = Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 }));
        loadsData.forEach((l: any) => {
          const timeStr = l.time_in || l.time_out;
          if (!timeStr) return;
          const hour = new Date(timeStr).getHours();
          peakHours[hour].count += 1;
        });

        setMetrics({
          totalAssignments,
          totalCashPicked,
          totalCashLoaded,
          totalExcessReported,
          avgNetCashPosition,
          totalTravelKm,
          totalLoads,
          avgLoadMinutes,
          topCustodians,
          topSites,
          dailyLoadTrend,
          dailyTravelKm,
          peakHours,
        });
      } catch (err: any) {
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }

    fetchAnalytics();
  }, [fromDate, toDate, selectedCustodians, selectedSites, custodianOptions, siteOptions]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-6 px-3 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1">Advanced Analytics</h1>
          <p className="text-slate-600 text-sm sm:text-base">Decision-ready insights for Admin operations</p>
        </div>

        <section className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-col gap-2">
            <div className="text-sm font-semibold text-slate-700">Filters</div>
            <div className="text-xs text-slate-500">{dateRangeLabel}</div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-600">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FilterMultiSelect
              title="Custodians"
              options={custodianOptions}
              selected={selectedCustodians}
              onChange={setSelectedCustodians}
              emptyLabel="No custodians found"
            />
            <FilterMultiSelect
              title="Sites"
              options={siteOptions}
              selected={selectedSites}
              onChange={setSelectedSites}
              emptyLabel="No sites found"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-slate-100 text-slate-700"
              onClick={() => {
                setFromDate(toISODate(daysAgo(29)));
                setToDate(toISODate(new Date()));
                setSelectedCustodians([]);
                setSelectedSites([]);
              }}
            >
              Reset Filters
            </button>
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700"
              onClick={() => {
                setFromDate(toISODate(daysAgo(6)));
                setToDate(toISODate(new Date()));
              }}
            >
              Last 7 Days
            </button>
            <button
              className="px-3 py-1.5 text-xs font-semibold rounded-full bg-blue-50 text-blue-700"
              onClick={() => {
                setFromDate(toISODate(daysAgo(29)));
                setToDate(toISODate(new Date()));
              }}
            >
              Last 30 Days
            </button>
          </div>
        </section>

        {loading && <div className="text-sm text-slate-500">Loading analytics…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}

        {metrics && (
          <div className="space-y-6">
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <MetricCard label="Assignments" value={metrics.totalAssignments} icon="📋" />
              <MetricCard label="ATM Loads" value={metrics.totalLoads} icon="🏧" />
              <MetricCard label="Travel Km" value={metrics.totalTravelKm.toFixed(1)} icon="🛣️" />
              <MetricCard label="Avg Load Time" value={`${metrics.avgLoadMinutes.toFixed(0)} min`} icon="⏱️" />
              <MetricCard label="Cash Picked" value={formatCurrency(metrics.totalCashPicked)} icon="💵" />
              <MetricCard label="Cash Loaded" value={formatCurrency(metrics.totalCashLoaded)} icon="🚚" />
              <MetricCard label="Avg Net Position" value={formatCurrency(metrics.avgNetCashPosition)} icon="📊" />
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InsightCard
                title="Load Frequency Trend"
                subtitle="Daily ATM loads"
              >
                <LineChart
                  data={metrics.dailyLoadTrend.map((d) => ({
                    label: d.date,
                    value: d.loads,
                  }))}
                />
              </InsightCard>
              <InsightCard
                title="Travel Distance Trend"
                subtitle="Total km per day"
              >
                <LineChart
                  data={metrics.dailyTravelKm.map((d) => ({
                    label: d.date,
                    value: d.km,
                  }))}
                  stroke="#0f766e"
                  fill="#ccfbf1"
                />
              </InsightCard>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InsightCard
                title="Custodian Productivity"
                subtitle="ATM loads by custodian"
              >
                {metrics.topCustodians.length === 0 ? (
                  <EmptyState message="No custodian activity in this range." />
                ) : (
                  <BarChart
                    data={metrics.topCustodians.map((c) => ({
                      label: c.name,
                      value: c.loads,
                    }))}
                  />
                )}
              </InsightCard>
              <InsightCard
                title="Site Operational Intensity"
                subtitle="ATM loads by site"
              >
                {metrics.topSites.length === 0 ? (
                  <EmptyState message="No site activity in this range." />
                ) : (
                  <BarChart
                    data={metrics.topSites.map((s) => ({
                      label: s.label,
                      value: s.loads,
                    }))}
                    barColor="#7c3aed"
                  />
                )}
              </InsightCard>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InsightCard
                title="Peak Activity Hours"
                subtitle="ATM loads by hour"
              >
                <BarChart
                  data={metrics.peakHours.map((h) => ({
                    label: `${h.hour}:00`,
                    value: h.count,
                  }))}
                  barColor="#0ea5e9"
                  compact
                />
              </InsightCard>

              <InsightCard
                title="Top Sites & Avg Time"
                subtitle="Average time spent per site"
              >
                {metrics.topSites.length === 0 ? (
                  <EmptyState message="No site duration data available." />
                ) : (
                  <div className="space-y-2">
                    {metrics.topSites.map((s) => (
                      <div key={s.id} className="flex items-center justify-between text-xs sm:text-sm">
                        <div className="text-slate-700 line-clamp-1 pr-2">{s.label}</div>
                        <div className="text-slate-500">{s.avgMinutes.toFixed(0)} min</div>
                      </div>
                    ))}
                  </div>
                )}
              </InsightCard>
            </section>

            <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <InsightCard
                title="Custodian Summary"
                subtitle="Assignments vs loads"
              >
                {metrics.topCustodians.length === 0 ? (
                  <EmptyState message="No custodian data available." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left">Custodian</th>
                          <th className="px-3 py-2 text-left">Assignments</th>
                          <th className="px-3 py-2 text-left">Loads</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.topCustodians.map((c) => (
                          <tr key={c.id}>
                            <td className="px-3 py-2">{c.name}</td>
                            <td className="px-3 py-2">{c.assignments}</td>
                            <td className="px-3 py-2">{c.loads}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </InsightCard>
              <InsightCard
                title="Site Summary"
                subtitle="Loads and time per site"
              >
                {metrics.topSites.length === 0 ? (
                  <EmptyState message="No site data available." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left">Site</th>
                          <th className="px-3 py-2 text-left">Loads</th>
                          <th className="px-3 py-2 text-left">Avg Time</th>
                        </tr>
                      </thead>
                      <tbody>
                        {metrics.topSites.map((s) => (
                          <tr key={s.id}>
                            <td className="px-3 py-2">{s.label}</td>
                            <td className="px-3 py-2">{s.loads}</td>
                            <td className="px-3 py-2">{s.avgMinutes.toFixed(0)} min</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </InsightCard>
            </section>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function MetricCard({ label, value, icon }: { label: string; value: number | string; icon?: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 flex flex-col items-start">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl" aria-hidden>{icon || "📊"}</span>
      </div>
      <div className="text-xs text-slate-600 font-medium">{label}</div>
      <div className="text-xl md:text-2xl font-bold text-primary mt-1">{value}</div>
    </div>
  );
}

function InsightCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2">
      <div>
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        {subtitle && <div className="text-xs text-slate-500">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return <div className="text-xs text-slate-500">{message}</div>;
}

function FilterMultiSelect<T extends { id: any; label: string }>({
  title,
  options,
  selected,
  onChange,
  emptyLabel,
}: {
  title: string;
  options: T[];
  selected: any[];
  onChange: (value: any[]) => void;
  emptyLabel: string;
}) {
  return (
    <div className="border border-slate-200 rounded-lg p-3 space-y-2">
      <div className="text-xs font-semibold text-slate-600">{title}</div>
      {options.length === 0 ? (
        <div className="text-xs text-slate-400">{emptyLabel}</div>
      ) : (
        <div className="max-h-40 overflow-y-auto space-y-2">
          {options.map((opt) => (
            <label key={opt.id} className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={selected.includes(opt.id)}
                onChange={(e) => {
                  const checked = e.target.checked;
                  if (checked) {
                    onChange([...selected, opt.id]);
                  } else {
                    onChange(selected.filter((id) => id !== opt.id));
                  }
                }}
                className="h-4 w-4"
              />
              <span className="line-clamp-1">{opt.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function LineChart({
  data,
  stroke = "#2563eb",
  fill = "#dbeafe",
}: {
  data: { label: string; value: number }[];
  stroke?: string;
  fill?: string;
}) {
  if (!data.length) return <EmptyState message="No trend data available." />;

  const width = 1000;
  const height = 200;
  const padding = 24;
  const maxValue = Math.max(...data.map((d) => d.value), 1);

  const points = data.map((d, i) => {
    const x = padding + (i * (width - padding * 2)) / (data.length - 1 || 1);
    const y = height - padding - (d.value / maxValue) * (height - padding * 2);
    return { x, y };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${width - padding},${height - padding} L ${padding},${height - padding} Z`;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-40"
        preserveAspectRatio="none"
      >
        <path d={areaPath} fill={fill} opacity={0.6} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth={3} />
      </svg>
      <div className="flex justify-between text-[10px] text-slate-500 mt-1">
        <span>{formatISTDate(data[0].label, "short")}</span>
        <span>{formatISTDate(data[data.length - 1].label, "short")}</span>
      </div>
    </div>
  );
}

function BarChart({
  data,
  barColor = "#2563eb",
  compact,
}: {
  data: { label: string; value: number }[];
  barColor?: string;
  compact?: boolean;
}) {
  if (!data.length) return <EmptyState message="No chart data available." />;

  const maxValue = Math.max(...data.map((d) => d.value), 1);
  const slice = compact ? data.slice(0, 12) : data.slice(0, 8);

  return (
    <div className="space-y-2">
      {slice.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex justify-between text-[11px] text-slate-600">
            <span className="line-clamp-1 pr-2">{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-2">
            <div
              className="h-2 rounded-full"
              style={{
                width: `${(item.value / maxValue) * 100}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function toISODate(date: Date) {
  return date.toISOString().split("T")[0];
}

function daysAgo(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

function buildDateKeys(fromDate: string, toDate: string) {
  const start = new Date(fromDate);
  const end = new Date(toDate);
  const keys: string[] = [];
  for (
    let d = new Date(start.getTime());
    d <= end;
    d.setDate(d.getDate() + 1)
  ) {
    keys.push(toISODate(d));
  }
  return keys;
}

function buildEmptyMetrics(dateKeys: string[]): AnalyticsMetrics {
  return {
    totalAssignments: 0,
    totalCashPicked: 0,
    totalCashLoaded: 0,
    totalExcessReported: 0,
    avgNetCashPosition: 0,
    totalTravelKm: 0,
    totalLoads: 0,
    avgLoadMinutes: 0,
    topCustodians: [],
    topSites: [],
    dailyLoadTrend: dateKeys.map((date) => ({ date, loads: 0 })),
    dailyTravelKm: dateKeys.map((date) => ({ date, km: 0 })),
    peakHours: Array.from({ length: 24 }, (_, i) => ({ hour: i, count: 0 })),
  };
}

function getMinutesDiff(start?: string, end?: string) {
  if (!start || !end) return 0;
  const startDate = new Date(start);
  const endDate = new Date(end);
  const diff = (endDate.getTime() - startDate.getTime()) / 60000;
  return diff > 0 && Number.isFinite(diff) ? diff : 0;
}
