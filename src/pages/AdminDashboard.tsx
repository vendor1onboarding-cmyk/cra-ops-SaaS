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
    if (!profile || profile.role !== "admin" && profile.role !== "supervisor") {
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

        const { data: eodList } = await supabase
          .from("assignments")
          .select(
            `
            id,
            assignment_date,
            status,
            custodian:custodian_id(full_name)
          `
          )
          .in("status", ["submitted"])
          .order("assignment_date", { ascending: false });

        setStats({
          total: assignmentsRes.count || 0,
          submitted: submittedRes.count || 0,
          approved: approvedRes.count || 0,
          rejected: rejectedRes.count || 0,
        });

        setEods(eodList || []);
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
        <div className="container py-6 text-sm">Loading admin dashboard…</div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <h1 className="text-xl font-semibold text-primary">
          Admin Dashboard
        </h1>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Total Assignments" value={stats.total} />
          <KPI label="Submitted EODs" value={stats.submitted} />
          <KPI label="Approved" value={stats.approved} />
          <KPI label="Rejected" value={stats.rejected} />
        </div>

        {/* Submitted EODs */}
        <div className="bg-white rounded shadow">
          <div className="p-4 border-b font-medium">
            Pending EOD Approvals
          </div>

          {eods.length === 0 ? (
            <div className="p-4 text-sm text-slate-500">
              No submitted EODs.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Custodian</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {eods.map((eod) => (
                  <tr key={eod.id} className="border-t">
                    <td className="p-3">{formatISTDate(eod.assignment_date, "short")}</td>
                    <td className="p-3">
                      {eod.custodian?.full_name || "—"}
                    </td>
                    <td className="p-3 capitalize">{eod.status}</td>
                    <td className="p-3 text-center">
                      <Link
                        to={`/admin/approvals/${eod.id}`}
                        className="text-primary text-xs font-medium hover:underline"
                      >
                        View EOD
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function KPI({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded shadow p-4 text-center">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-xl font-semibold text-primary">{value}</div>
    </div>
  );
}
