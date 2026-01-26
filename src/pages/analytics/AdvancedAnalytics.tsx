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
  busiestRoutes: Array<{ route: string; count: number }>;
  dailyTrends: Array<{ date: string; assignments: number; cashPicked: number; cashLoaded: number }>;
}

export default function AdvancedAnalytics() {
  const [metrics, setMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      setError(null);
      try {
        // Fetch assignments (route_id is a UUID, no route name available)
        const { data: assignments, error: assignmentsError } = await supabase
          .from("assignments")
          .select("id, assignment_date, custodian_id, route_id")
          .order("assignment_date", { ascending: false });
        if (assignmentsError) throw assignmentsError;
        if (!assignments) throw new Error("No assignments data returned");

        // Fetch cash picked
        const { data: cashPickups, error: cashPickupsError } = await supabase
          .from("cash_pickups")
          .select("cash_picked, assignment_id");
        if (cashPickupsError) throw cashPickupsError;
        if (!cashPickups) throw new Error("No cash pickups data returned");

        // Fetch cash loaded
        const { data: cashLoaded, error: cashLoadedError } = await supabase
          .from("cash_loaded")
          .select("cash_loaded, assignment_id");
        if (cashLoadedError) throw cashLoadedError;
        if (!cashLoaded) throw new Error("No cash loaded data returned");

        // Fetch adjustments
        const { data: adjustments, error: adjustmentsError } = await supabase
          .from("soa_adjustments")
          .select("adjustment_amount, adjustment_type, assignment_id");
        if (adjustmentsError) throw adjustmentsError;
        if (!adjustments) throw new Error("No adjustments data returned");

        // Fetch excess cash
        const { data: excessCash, error: excessCashError } = await supabase
          .from("excess_cash")
          .select("excess_reported, assignment_id");
        if (excessCashError) throw excessCashError;
        if (!excessCash) throw new Error("No excess cash data returned");

        // Fetch custodian names (optional, fallback to id if missing)
        const custodianIds = [...new Set(assignments.map((a: any) => a.custodian_id))];
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
        const totalAssignments = assignments.length;
        const totalCashPicked = cashPickups.reduce((sum: number, c: any) => sum + (c.cash_picked || 0), 0);
        const totalCashLoaded = cashLoaded.reduce((sum: number, c: any) => sum + (c.cash_loaded || 0), 0);
        const totalAdjustments = adjustments.reduce((sum: number, a: any) => sum + (a.adjustment_amount || 0), 0);
        const totalExcessReported = excessCash.reduce((sum: number, e: any) => sum + (e.excess_reported || 0), 0);

        // Calculate net cash position per assignment
        const netPositions: number[] = assignments.map((a: any) => {
          const picked = cashPickups.find((c: any) => c.assignment_id === a.id)?.cash_picked || 0;
          const loaded = cashLoaded.find((c: any) => c.assignment_id === a.id)?.cash_loaded || 0;
          const adjustment = adjustments.filter((adj: any) => adj.assignment_id === a.id).reduce((sum: number, adj: any) => sum + (adj.adjustment_amount || 0), 0);
          const excess = excessCash.find((e: any) => e.assignment_id === a.id)?.excess_reported || 0;
          return picked - loaded + adjustment - excess;
        });
        const avgNetCashPosition = netPositions.length > 0 ? netPositions.reduce((a, b) => a + b, 0) / netPositions.length : 0;

        // Top custodians by assignment count
        const custodianCounts: Record<string, number> = {};
        assignments.forEach((a: any) => {
          custodianCounts[a.custodian_id] = (custodianCounts[a.custodian_id] || 0) + 1;
        });
        const topCustodians = Object.entries(custodianCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([id, assignments]) => ({ id, name: nameMap.get(id) || id, assignments }));

        // Busiest routes by assignment count (route_id is UUID, no name available)
        const routeCounts: Record<string, number> = {};
        assignments.forEach((a: any) => {
          if (a.route_id) routeCounts[a.route_id] = (routeCounts[a.route_id] || 0) + 1;
        });
        const busiestRoutes = Object.entries(routeCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([route, count]) => ({ route, count }));

        // Daily trends (last 30 days)
        const today = new Date();
        const dailyTrends: Array<{ date: string; assignments: number; cashPicked: number; cashLoaded: number }> = [];
        for (let i = 0; i < 30; i++) {
          const date = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
          const dateStr = date.toISOString().split("T")[0];
          const dayAssignments = assignments.filter((a: any) => a.assignment_date === dateStr);
          const dayCashPicked = dayAssignments.map((a: any) => cashPickups.find((c: any) => c.assignment_id === a.id)?.cash_picked || 0).reduce((a, b) => a + b, 0);
          const dayCashLoaded = dayAssignments.map((a: any) => cashLoaded.find((c: any) => c.assignment_id === a.id)?.cash_loaded || 0).reduce((a, b) => a + b, 0);
          dailyTrends.push({ date: dateStr, assignments: dayAssignments.length, cashPicked: dayCashPicked, cashLoaded: dayCashLoaded });
        }

        setMetrics({
          totalAssignments,
          totalCashPicked,
          totalCashLoaded,
          totalAdjustments,
          totalExcessReported,
          avgNetCashPosition,
          topCustodians,
          busiestRoutes,
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
              <MetricCard label="Total Cash Picked" value={metrics.totalCashPicked} icon="💵" />
              <MetricCard label="Total Cash Loaded" value={metrics.totalCashLoaded} icon="🚚" />
              <MetricCard label="Total Adjustments" value={metrics.totalAdjustments} icon="📝" />
              <MetricCard label="Total Excess Reported" value={metrics.totalExcessReported} icon="⚠️" />
              <MetricCard label="Avg Net Cash Position" value={metrics.avgNetCashPosition.toFixed(2)} icon="📊" />
            </div>
            <section>
              <h2 className="text-xl font-semibold mb-3">Top Custodians</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Name</th>
                      <th className="px-4 py-2 text-left">Assignments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.topCustodians.map(c => (
                      <tr key={c.id}>
                        <td className="px-4 py-2">{c.name}</td>
                        <td className="px-4 py-2">{c.assignments}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
            <section>
              <h2 className="text-xl font-semibold mb-3">Busiest Routes</h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[400px] text-sm">
                  <thead className="bg-slate-100">
                    <tr>
                      <th className="px-4 py-2 text-left">Route ID (UUID)</th>
                      <th className="px-4 py-2 text-left">Assignments</th>
                    </tr>
                  </thead>
                  <tbody>
                    {metrics.busiestRoutes.map(r => (
                      <tr key={r.route}>
                        <td className="px-4 py-2">{r.route}</td>
                        <td className="px-4 py-2">{r.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="text-xs text-slate-500 mt-2">
                  <strong>Note:</strong> Route names are not available in the current schema. Only <code>route_id</code> (UUID) is shown. To display route names, add a <code>routes</code> table and join on <code>route_id</code>.
                </div>
              </div>
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
                    {metrics.dailyTrends.map(trend => (
                      <tr key={trend.date}>
                        <td className="px-4 py-2">{formatISTDate(trend.date, "short")}</td>
                        <td className="px-4 py-2">{trend.assignments}</td>
                        <td className="px-4 py-2">{trend.cashPicked}</td>
                        <td className="px-4 py-2">{trend.cashLoaded}</td>
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
