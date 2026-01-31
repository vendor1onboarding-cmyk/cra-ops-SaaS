import { useEffect, useState } from "react";
import { supabase } from "../../api/supabaseClient";
import { AppLayout } from "../../components/Layout";
import { formatISTDate } from "../../utils/time";

// Types for analytics metrics
interface AnalyticsMetrics {
  totalAssignments: number;
  totalCashPicked: number;
  totalCashLoaded: number;
  totalAdjustments: number;
  totalExcessReported: number;
  avgNetCashPosition: number;
  topCustodians: Array<{ id: string; name: string; assignments: number }>;
  busiestSites: Array<{ label: string; count: number }>;
  dailyTrends: Array<{ date: string; assignments: number; cashPicked: number; cashLoaded: number }>;
}

export default function AdvancedAnalytics() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const formatCurrency = (value: number) =>
    `₹${value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      try {
        // Core SOA view (single source of truth for picked/loaded/adjusted/excess/net)
        const [
          { data: soaRows, error: soaError },
          { data: assignments, error: assignmentsError },
          { data: adjustments, error: adjustmentsError },
          { data: routeSites, error: routeSitesError },
        ] =
          await Promise.all([
            supabase
              .from("v_soa_effective")
              .select(
                `soa_id,
                 assignment_date,
                 cash_picked,
                 cash_loaded,
                 cash_adjusted,
                 excess_reported,
                 final_net_cash_position,
                 custodian_id`
              )
              .order("assignment_date", { ascending: false }),
            // Fetch assignments for route analytics
            supabase
              .from("assignments")
              .select("id, assignment_date, custodian_id")
              .order("assignment_date", { ascending: false }),
            // Fetch adjustments for total adjustment volume
            supabase
              .from("soa_adjustments")
              .select("adjustment_amount, adjustment_type, assignment_id"),
            // Fetch route sites for busiest site analytics
            supabase
              .from("route_sites")
              .select(
                `site_id,
                 assignment_id,
                 site:site_id(
                   site_code,
                   bank_name,
                   address,
                   atm_id
                 )`
              ),
          ]);

        if (soaError) throw soaError;
        if (assignmentsError) throw assignmentsError;
        if (adjustmentsError) throw adjustmentsError;
        if (routeSitesError) throw routeSitesError;

        const soaData = soaRows || [];
        const assignmentData = assignments || [];
        const adjustmentData = adjustments || [];
        const routeSitesData = routeSites || [];

        // Fetch custodian names (optional, fallback to id if missing)
        const custodianIds = [...new Set(soaData.map((a: any) => a.custodian_id))];
        let nameMap = new Map();
        if (custodianIds.length > 0) {
          const { data: profiles, error: profilesError } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", custodianIds);
          if (!profilesError && profiles) {
            nameMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
          }
        }

        // Aggregate metrics
        const totalAssignments = soaData.length;
        const totalCashPicked = soaData.reduce((sum: number, r: any) => sum + (r.cash_picked || 0), 0);
        const totalCashLoaded = soaData.reduce((sum: number, r: any) => sum + (r.cash_loaded || 0), 0);
        const totalAdjustments = adjustmentData.reduce((sum: number, a: any) => sum + (a.adjustment_amount || 0), 0);
        const totalExcessReported = soaData.reduce((sum: number, r: any) => sum + (r.excess_reported || 0), 0);

        // Calculate net cash position per assignment
        const netPositions: number[] = soaData.map((r: any) => r.final_net_cash_position || 0);
        const avgNetCashPosition = netPositions.length > 0 ? netPositions.reduce((a, b) => a + b, 0) / netPositions.length : 0;

        // Top custodians by assignment count
        const custodianCounts: Record<string, number> = {};
        soaData.forEach((a: any) => {
          custodianCounts[a.custodian_id] = (custodianCounts[a.custodian_id] || 0) + 1;
        });
        const topCustodians = Object.entries(custodianCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, assignments]) => ({ id, name: nameMap.get(id) || id, assignments }));

        // Busiest sites by occurrence in route assignments
        const siteCounts: Record<string, { label: string; count: number }> = {};
        routeSitesData.forEach((r: any) => {
          const site = r.site || {};
          const bank = site.bank_name || "Bank";
          const address = site.address || site.site_code || "Location";
          const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
          const label = `${bank} – ${address}${atm}`;

          if (!siteCounts[r.site_id]) {
            siteCounts[r.site_id] = { label, count: 0 };
          }
          siteCounts[r.site_id].count += 1;
        });
        const busiestSites = Object.values(siteCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);

        // Daily trends (last 30 days)
        const today = new Date();
        const dailyMap = new Map<string, { assignments: number; cashPicked: number; cashLoaded: number }>();
        for (let i = 29; i >= 0; i--) {
          const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split("T")[0];
          dailyMap.set(dateStr, { assignments: 0, cashPicked: 0, cashLoaded: 0 });
        }

        soaData.forEach((row: any) => {
          if (!row.assignment_date) return;
          const dateStr = row.assignment_date;
          const day = dailyMap.get(dateStr);
          if (!day) return;
          day.assignments += 1;
          day.cashPicked += row.cash_picked || 0;
          day.cashLoaded += row.cash_loaded || 0;
        });

        const dailyTrends = Array.from(dailyMap.entries()).map(([date, data]) => ({
          date,
          assignments: data.assignments,
          cashPicked: data.cashPicked,
          cashLoaded: data.cashLoaded,
        }));

        setMetrics({
          totalAssignments,
          totalCashPicked,
          totalCashLoaded,
          totalAdjustments,
          totalExcessReported,
          avgNetCashPosition,
          topCustodians,
          busiestSites,
          dailyTrends,
        });
      } catch (err: any) {
        setError(err.message || "Failed to load analytics");
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, []);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto py-8 px-2 space-y-8">
        <h1 className="text-3xl font-bold text-primary mb-2">Advanced Analytics</h1>
        <p className="text-slate-600 mb-6">Business insights and operational metrics for Sruthi CRA Ops</p>
        {loading && <div className="text-sm text-slate-500">Loading analytics…</div>}
        {error && <div className="text-sm text-red-600">{error}</div>}
        {metrics && (
          <div className="space-y-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label="Total Assignments" value={metrics.totalAssignments} icon="📋" />
              <MetricCard label="Total Cash Picked" value={formatCurrency(metrics.totalCashPicked)} icon="💵" />
              <MetricCard label="Total Cash Loaded" value={formatCurrency(metrics.totalCashLoaded)} icon="🚚" />
              <MetricCard label="Total Adjustments" value={formatCurrency(metrics.totalAdjustments)} icon="📝" />
              <MetricCard label="Total Excess Reported" value={formatCurrency(metrics.totalExcessReported)} icon="⚠️" />
              <MetricCard label="Avg Net Cash Position" value={formatCurrency(metrics.avgNetCashPosition)} icon="📊" />
            </div>
            <section>
              <h2 className="text-xl font-semibold mb-3">Top Custodians</h2>
              {metrics.topCustodians.length === 0 ? (
                <div className="text-sm text-slate-500">No custodian data available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Name</th>
                        <th className="px-4 py-2 text-left">Assignments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.topCustodians.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-2">{c.name}</td>
                          <td className="px-4 py-2">{c.assignments}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-3">Busiest Sites</h2>
              {metrics.busiestSites.length === 0 ? (
                <div className="text-sm text-slate-500">No site data available.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[400px] text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-4 py-2 text-left">Site</th>
                        <th className="px-4 py-2 text-left">Assignments</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.busiestSites.map((r, idx) => (
                        <tr key={`${r.label}-${idx}`}>
                          <td className="px-4 py-2">{r.label}</td>
                          <td className="px-4 py-2">{r.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-3">Daily Trends (Last 30 Days)</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[500px] text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Date</th>
                      <th className="px-4 py-2 text-left">Assignments</th>
                      <th className="px-4 py-2 text-left">Cash Picked</th>
                      <th className="px-4 py-2 text-left">Cash Loaded</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.dailyTrends.map((trend) => (
                      <tr key={trend.date}>
                        <td className="px-4 py-2">{formatISTDate(trend.date, "short")}</td>
                        <td className="px-4 py-2">{trend.assignments}</td>
                        <td className="px-4 py-2">{formatCurrency(trend.cashPicked)}</td>
                        <td className="px-4 py-2">{formatCurrency(trend.cashLoaded)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
