import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import { getISTDateString, formatISTDate } from "../utils/time";

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [eods, setEods] = useState<any[]>([]);

  useEffect(() => {
    if (!profile || (profile.role !== "admin" && profile.role !== "supervisor")) {
      setLoading(false);
      return;
    }

    async function loadAdminData() {
      setLoading(true);
      try {
        const today = getISTDateString();

        // Fetch all assignment counts in parallel
        const [
          assignmentsRes,
          submittedRes,
          approvedRes,
          rejectedRes,
        ] = await Promise.all([
          supabase
            .from("assignments")
            .select("id", { count: "exact", head: true })
            .eq("assignment_date", today),
          supabase
            .from("assignments")
            .select("id", { count: "exact", head: true })
            .eq("assignment_date", today)
            .eq("status", "submitted"),
          supabase
            .from("assignments")
            .select("id", { count: "exact", head: true })
            .eq("assignment_date", today)
            .eq("status", "approved"),
          supabase
            .from("assignments")
            .select("id", { count: "exact", head: true })
            .eq("assignment_date", today)
            .eq("status", "rejected"),
        ]);

        // Fetch ALL pending EODs (status=submitted, any date) - NO JOIN
        const { data: eodList, error: eodError } = await supabase
          .from("assignments")
          .select("id, assignment_date, status, custodian_id")
          .eq("status", "submitted")
          .order("assignment_date", { ascending: false });

        let merged: any[] = [];
        if (!eodError && eodList && eodList.length > 0) {
          // Fetch custodian names for all unique custodian_ids
          const custodianIds = [...new Set(eodList.map(a => a.custodian_id))];
          const { data: profiles } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", custodianIds);
          const nameMap = new Map((profiles || []).map(p => [p.id, p.full_name]));
          merged = eodList.map(a => ({
            ...a,
            custodian: { full_name: nameMap.get(a.custodian_id) || "—" },
          }));
        }
        setStats({
          total: assignmentsRes.count || 0,
          submitted: submittedRes.count || 0,
          approved: approvedRes.count || 0,
          rejected: rejectedRes.count || 0,
        });
        setEods(merged);
      } catch (error) {
        console.error("Error loading admin data:", error);
        setStats({
          total: 0,
          submitted: 0,
          approved: 0,
          rejected: 0,
        });
        setEods([]);
      } finally {
        setLoading(false);
      }
    }
    loadAdminData();
  }, [profile]);


  if (loading) {
    return (
      <AppLayout>
        <div className="container py-8 flex flex-col items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary mb-4" />
          <div className="text-slate-600 text-sm">Loading admin dashboard…</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* ===== PRINT HEADER WITH LOGO ===== */}
      <div className="print-only mb-4 border-b pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img src="/bank-logo.png" alt="Bank Logo" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold">Sruthi CRA Ops</h1>
              <p className="text-xs text-slate-600">Cash Replenishment & ATM Operations</p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold">Admin Dashboard Report</p>
            <p>Date: {new Date().toLocaleDateString("en-IN")}</p>
            {profile?.full_name && <p>Admin: {profile.full_name}</p>}
          </div>
        </div>
      </div>

      <div className="space-y-8 max-w-6xl mx-auto px-2 md:px-0">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 print:hidden">
          <div>
            <h1 className="text-3xl font-bold text-primary mb-1">Admin Dashboard</h1>
            <p className="text-sm text-slate-600">Monitor and manage EOD submissions and approvals</p>
          </div>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-white font-semibold shadow hover:bg-blue-700 transition-colors text-sm print:hidden"
            aria-label="Print dashboard report"
          >
            <span className="text-lg">🖨️</span> Print / PDF
          </button>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
          <KPI label="Total Assignments" value={stats.total} icon="📋" />
          <KPI label="Submitted EODs" value={stats.submitted} icon="📝" />
          <KPI label="Approved" value={stats.approved} icon="✅" />
          <KPI label="Rejected" value={stats.rejected} icon="❌" />
        </div>

        {/* Pending EODs Table */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow print:shadow-none">
          <div className="flex items-center justify-between p-5 border-b border-slate-200 bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-800">All Pending EOD Approvals</h2>
            <span className="text-xs text-slate-500">Total: {eods.length}</span>
          </div>

          {eods.length === 0 ? (
            <div className="p-10 flex flex-col items-center text-slate-500">
              <span className="text-4xl mb-2">📭</span>
              <p className="text-base font-medium mb-1">No submitted EODs awaiting approval</p>
              <p className="text-xs">All custodians have completed their EODs for today.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Custodian</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {eods.map((eod, idx) => (
                    <tr
                      key={eod.id}
                      className={`border-b border-slate-100 hover:bg-blue-50/40 transition-colors ${idx === eods.length - 1 ? "border-b-0" : ""}`}
                    >
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatISTDate(eod.assignment_date, "short")}</td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{eod.custodian?.full_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-block px-3 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800 capitalize">
                          {eod.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Link
                          to={`/admin/approvals/${eod.id}`}
                          className="inline-block px-4 py-1.5 text-xs font-semibold text-primary hover:bg-blue-100 rounded transition-colors border border-primary/20"
                          aria-label={`Review EOD for ${eod.custodian?.full_name || "custodian"}`}
                        >
                          Review →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

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
}

function KPI({ label, value, icon }: { label: string; value: number; icon?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 md:p-5 hover:shadow-md transition-shadow flex flex-col items-start">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-2xl" aria-hidden>{icon || "📊"}</span>
        <span className="sr-only">{label}</span>
      </div>
      <div className="text-xs text-slate-600 font-medium">{label}</div>
      <div className="text-2xl md:text-3xl font-bold text-primary mt-1">{value}</div>
    </div>
  );
}
