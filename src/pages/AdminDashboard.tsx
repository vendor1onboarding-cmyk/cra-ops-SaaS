import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { getISTDateString, formatDateString, getISTMonthStart } from "../utils/time";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [eods, setEods] = useState<any[]>([]);
  const [unreconciledAccounts, setUnreconciledAccounts] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || (profile.role !== "admin" && profile.role !== "supervisor")) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setEods([]);
    setStats(null);
    setUnreconciledAccounts([]);

    // Fetch pending EODs from assignments table
    supabase
      .from("assignments")
      .select("id, assignment_date, custodian_id, status")
      .eq("status", "submitted")
      .order("assignment_date", { ascending: false })
      .then(async ({ data, error }) => {
        if (!error && data && data.length > 0) {
          // Get custodian names
          const custodianIds = [...new Set(data.map((a: any) => a.custodian_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", custodianIds);
          
          const custodianMap = new Map(profiles?.map((p: any) => [p.id, p.full_name]) || []);
          
          setEods(
            data.map((eod: any) => ({
              ...eod,
              custodian: { full_name: custodianMap.get(eod.custodian_id) || "—" },
            }))
          );
        } else {
          console.error("Error fetching EODs:", error);
          setEods([]);
        }
      })
      .catch((err) => {
        console.error("EODs fetch failed:", err);
        setEods([]);
      });


    // Fetch stats from assignments table
    supabase
      .from("assignments")
      .select("status", { count: "exact", head: false })
      .then(({ data, error }) => {
        if (!error && data) {
          // Compute stats from status counts
          const stats = { total: 0, submitted: 0, approved: 0, rejected: 0 };
          data.forEach((assignment: any) => {
            stats.total++;
            if (assignment.status === "submitted") stats.submitted++;
            if (assignment.status === "approved") stats.approved++;
            if (assignment.status === "rejected") stats.rejected++;
          });
          setStats(stats);
        } else {
          console.error("Error fetching stats:", error);
          setStats({ total: 0, submitted: 0, approved: 0, rejected: 0 });
        }
      })
      .catch((err) => {
        console.error("Stats fetch failed:", err);
        setStats({ total: 0, submitted: 0, approved: 0, rejected: 0 });
      });

    // Fetch unreconciled accounts from SOA
    supabase
      .from("v_soa_effective")
      .select("assignment_id, custodian_id, assignment_date, final_net_cash_position")
      .then(({ data, error }) => {
        if (!error && data) {
          // Filter client-side for non-zero closing balance
          const unreconciled = data
            .filter((row: any) => Math.abs(row.final_net_cash_position || 0) >= 0.01)
            .sort((a: any, b: any) => new Date(b.assignment_date).getTime() - new Date(a.assignment_date).getTime())
            .slice(0, 20);
          setUnreconciledAccounts(unreconciled);
        } else {
          console.error("Error fetching unreconciled accounts:", error);
          setUnreconciledAccounts([]);
        }
      })
      .catch((err) => {
        console.error("Error fetching unreconciled accounts:", err);
        setUnreconciledAccounts([]);
      })
      .finally(() => setLoading(false));
  }, [profile]);

  return (
    <AppLayout>
      <div className="min-h-screen bg-slate-50 max-w-7xl mx-auto px-3 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6 md:py-8">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 print:hidden">
          <div className="flex-1">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900 mb-2">Admin Dashboard</h1>
            <p className="text-sm sm:text-base text-slate-600">Monitor, review, and approve EOD submissions in real-time</p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg bg-blue-600 text-white font-semibold shadow-md hover:bg-blue-700 active:shadow-inner transition-all text-sm sm:text-base whitespace-nowrap print:hidden"
            aria-label="Print dashboard report"
          >
            <span>📋</span> Export / Print
          </button>
        </div>

        {/* KPI Grid - Enterprise Style */}
        {stats && (
          <section className="mb-8">
            <h2 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Key Metrics</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              <KPI label="Total Assignments" value={stats.total} icon="📊" color="blue" />
              <KPI label="Pending Approval" value={stats.submitted} icon="⏳" color="amber" />
              <KPI label="Approved" value={stats.approved} icon="✓" color="green" />
              <KPI label="Rejected" value={stats.rejected} icon="✕" color="red" />
            </div>
          </section>
        )}

        {/* Unreconciled Accounts Alert - Enterprise Style */}
        {unreconciledAccounts.length > 0 && (
          <section className="mb-8">
            <div className="bg-white border-l-4 border-amber-500 rounded-lg shadow-md p-4 sm:p-6 print:shadow-none">
              <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5">
                <div className="flex-shrink-0">
                  <div className="text-3xl sm:text-4xl">⚠️</div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
                    Unreconciled Cash Accounts
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 mb-4">
                    {unreconciledAccounts.length} account{unreconciledAccounts.length > 1 ? 's' : ''} with non-zero closing balance requiring immediate reconciliation.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                    {unreconciledAccounts.slice(0, 10).map((account: any) => (
                      <div
                        key={account.assignment_id || `${account.custodian_id}-${account.assignment_date}`}
                        className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 rounded-lg p-3 sm:p-4 border border-amber-200 hover:border-amber-400 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 text-sm sm:text-base truncate">{account.custodian_name || account.custodian_id}</div>
                          <div className="text-xs text-slate-600 mt-1">
                            Net position: <span className="font-semibold text-amber-700">₹{Math.abs(account.final_net_cash_position).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="text-xs text-slate-500 mt-1">{formatDateString(account.assignment_date)}</div>
                        </div>
                        <Link
                          to={`/soa?from=${account.assignment_date}&to=${account.assignment_date}&custodian=${account.custodian_id}&view=detailed`}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold bg-amber-600 text-white rounded hover:bg-amber-700 active:bg-amber-800 transition-colors whitespace-nowrap self-start sm:self-center"
                        >
                          View SOA
                        </Link>
                      </div>
                    ))}
                  </div>
                  {unreconciledAccounts.length > 10 && (
                    <p className="text-xs text-slate-600 mt-4 font-medium">
                      + {unreconciledAccounts.length - 10} more unreconciled account{unreconciledAccounts.length - 10 > 1 ? 's' : ''}. 
                      <Link to="/soa?view=detailed" className="text-blue-600 hover:underline ml-1 font-semibold">View all</Link>
                    </p>
                  )}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Pending EODs Section */}
        <section>
          <h2 className="text-xs sm:text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">Pending EOD Approvals</h2>
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-md print:shadow-none">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 p-4 sm:p-6 border-b border-slate-200 bg-slate-50">
              <span className="text-sm sm:text-base font-semibold text-slate-800">Submitted EODs Awaiting Review</span>
              <span className="text-xs text-slate-500 font-medium">Total: <span className="font-bold text-slate-700">{eods.length}</span></span>
            </div>

            {eods.length === 0 ? (
              <div className="p-8 sm:p-12 flex flex-col items-center text-slate-500 text-center">
                <span className="text-4xl sm:text-5xl mb-3">📭</span>
                <p className="text-base sm:text-lg font-semibold text-slate-700 mb-1">All clear!</p>
                <p className="text-xs sm:text-sm text-slate-600">No pending EOD approvals at this time.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-100 border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="px-3 sm:px-5 py-3 text-left font-semibold text-slate-700">Date</th>
                      <th className="px-3 sm:px-5 py-3 text-left font-semibold text-slate-700">Custodian</th>
                      <th className="px-3 sm:px-5 py-3 text-left font-semibold text-slate-700">Status</th>
                      <th className="px-3 sm:px-5 py-3 text-center font-semibold text-slate-700">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {eods.map((eod) => (
                      <tr key={eod.id} className="hover:bg-blue-50/50 active:bg-blue-100 transition-colors">
                        <td className="px-3 sm:px-5 py-3 text-slate-700 font-medium">{formatDateString(eod.assignment_date)}</td>
                        <td className="px-3 sm:px-5 py-3 text-slate-700">
                          <span className="block truncate">{eod.custodian?.full_name || "—"}</span>
                        </td>
                        <td className="px-3 sm:px-5 py-3">
                          <span className="inline-block px-2.5 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 whitespace-nowrap">
                            Pending
                          </span>
                        </td>
                        <td className="px-3 sm:px-5 py-3 text-center">
                          <Link
                            to={`/admin/approvals/${eod.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded transition-colors whitespace-nowrap"
                            aria-label={`Review EOD for ${eod.custodian?.full_name || "custodian"}`}
                          >
                            Review
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* ===== PRINT FOOTER – SIGNATURES ===== */}
        <div className="print-only mt-10 pt-6 border-t text-xs text-slate-700">
          <div className="grid grid-cols-2 gap-12">
            <div>
              <p className="font-semibold">Admin Signature</p>
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
            This is a system-generated report from Sruthi CRA Ops. Any discrepancy must be reported within RBI-prescribed timelines.
          </p>
        </div>
      </div>
    </AppLayout>
  );

// KPI summary card component
function KPI({ label, value, icon, color }: { label: string; value: number; icon?: string; color?: string }) {
  const colorSchemes: any = {
    blue: "border-blue-200 bg-blue-50/50 text-blue-900",
    amber: "border-amber-200 bg-amber-50/50 text-amber-900",
    green: "border-green-200 bg-green-50/50 text-green-900",
    red: "border-red-200 bg-red-50/50 text-red-900",
  };
  
  const colorClass = colorSchemes[color || "blue"] || colorSchemes.blue;
  
  return (
    <div className={`bg-white rounded-lg border ${colorClass} shadow-sm p-4 sm:p-6 hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between mb-3">
        <div className="text-2xl sm:text-3xl" aria-hidden>
          {icon || "📊"}
        </div>
        <span className="sr-only">{label}</span>
      </div>
      <div className="text-slate-600 text-xs sm:text-sm font-semibold uppercase tracking-wide mb-2">
        {label}
      </div>
      <div className="text-2xl sm:text-3xl md:text-4xl font-bold text-slate-900">
        {value}
      </div>
    </div>
  );
}
}
