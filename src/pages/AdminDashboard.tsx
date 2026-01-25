import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const { profile, retryLoadProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [eods, setEods] = useState<any[]>([]);
  const [retrying, setRetrying] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>("");

  // Enhanced role check
  const isAdmin = profile && (profile.role === "admin" || profile.role === "supervisor");

  useEffect(() => {
<<<<<<< HEAD
    if (!profile) {
      console.log("[AdminDashboard] No profile yet, waiting...");
      // Keep loading state true while waiting for profile
      return;
    }

    if (!isAdmin) {
      console.log("[AdminDashboard] User is not admin, access denied");
      setLoading(false);
      return;
    }

    console.log("[AdminDashboard] Admin profile loaded, fetching dashboard data");
=======
    if (!profile) return;

    async function loadAdminData() {
      setLoading(true);

      const today = new Date().toISOString().slice(0, 10);

      const [
        assignmentsRes,
        submittedRes,
        approvedRes,
        rejectedRes,
      ] = await Promise.all([
        supabase
          .from("assignments")
          .select("id")
          .eq("assignment_date", today),

        supabase
          .from("assignments")
          .select("id")
          .eq("assignment_date", today)
          .eq("status", "submitted"),

        supabase
          .from("assignments")
          .select("id")
          .eq("assignment_date", today)
          .eq("status", "approved"),

        supabase
          .from("assignments")
          .select("id")
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
          custodian:profiles!assignments_custodian_id_fkey(full_name)
        `
        )
        .in("status", ["submitted"])
        .order("assignment_date", { ascending: false });

      setStats({
        total: assignmentsRes.data?.length || 0,
        submitted: submittedRes.data?.length || 0,
        approved: approvedRes.data?.length || 0,
        rejected: rejectedRes.data?.length || 0,
      });

      setEods(eodList || []);
      setLoading(false);
    }

>>>>>>> parent of b4323fd (EOD Signature issue and Admin Dashboard)
    loadAdminData();
  }, [profile, isAdmin]);

  // Retry with timeout protection
  const loadAdminData = async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date().toISOString().slice(0, 10);
      console.log(`[AdminDashboard] Fetching admin data for date: ${today}`);

      // Create timeout promise (30 second timeout)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Dashboard data load timeout (30s) - Vercel edge function timeout")),
          30000
        )
      );

      // Fetch all assignment counts in parallel with timeout
      const fetchDataPromise = Promise.all([
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

        supabase
          .from("assignments")
          .select(
            `id, assignment_date, status, custodian:profiles!assignments_custodian_id_fkey(full_name)`
          )
          .eq("status", "submitted")
          .order("assignment_date", { ascending: false })
          .limit(20),
      ]);

      // Race between data fetch and timeout
      const [
        assignmentsRes,
        submittedRes,
        approvedRes,
        rejectedRes,
        eodListRes,
      ] = (await Promise.race([fetchDataPromise, timeoutPromise])) as any;

      // Validate responses
      if (
        assignmentsRes === null ||
        submittedRes === null ||
        approvedRes === null ||
        rejectedRes === null
      ) {
        throw new Error("Invalid response from server - null counts");
      }

      console.log("[AdminDashboard] Admin data fetched successfully", {
        total: assignmentsRes.count,
        submitted: submittedRes.count,
        approved: approvedRes.count,
        rejected: rejectedRes.count,
        eods: eodListRes?.data?.length || 0,
      });

      setStats({
        total: assignmentsRes.count || 0,
        submitted: submittedRes.count || 0,
        approved: approvedRes.count || 0,
        rejected: rejectedRes.count || 0,
      });

      setEods(eodListRes?.data || []);
      setLastUpdate(new Date().toLocaleTimeString());
      setError(null);
    } catch (error: any) {
      const errorMsg = error?.message || "Failed to load dashboard";
      console.error("[AdminDashboard] Error loading admin data:", errorMsg, error);
      setError(errorMsg);
      
      // Set default empty state to allow UI to show
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
  };

  // Render loading state
  if (loading) {
    return (
      <AppLayout>
        <div className="container py-6 space-y-4">
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-sm text-slate-600 font-medium">Loading admin dashboard</p>
              <p className="text-xs text-slate-500 mt-2">Authenticating your admin access...</p>
            </div>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Render access denied
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="container py-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center max-w-md mx-auto">
            <div className="text-2xl mb-2">🚫</div>
            <p className="text-sm text-red-900 font-semibold">Access Denied</p>
            <p className="text-xs text-red-700 mt-2">
              You do not have permission to access the admin dashboard. Please contact your administrator if you believe this is an error.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  // Main dashboard render
  return (
    <AppLayout>
      <div className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-primary">
            Admin Dashboard
          </h1>
          <div className="text-right">
            <div className="text-xs text-slate-500">
              {new Date().toLocaleDateString("en-IN", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
            {lastUpdate && (
              <div className="text-xs text-slate-400 mt-1">
                Updated: {lastUpdate}
              </div>
            )}
          </div>
        </div>

        {/* Error State with Retry */}
        {error && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-semibold text-yellow-900">⚠️ Dashboard Load Error</p>
                <p className="text-xs text-yellow-800 mt-2">{error}</p>
                <p className="text-xs text-yellow-700 mt-2">
                  This may be a temporary connectivity issue. Try clicking Retry below.
                </p>
              </div>
              <button
                onClick={async () => {
                  setRetrying(true);
                  try {
                    console.log("[AdminDashboard] User clicked retry");
                    await retryLoadProfile();
                    await new Promise((resolve) => setTimeout(resolve, 500));
                    await loadAdminData();
                  } catch (err) {
                    console.error("[AdminDashboard] Retry failed:", err);
                  } finally {
                    setRetrying(false);
                  }
                }}
                disabled={retrying}
                className="ml-4 px-4 py-2 text-xs bg-yellow-600 text-white rounded hover:bg-yellow-700 disabled:opacity-50 whitespace-nowrap font-medium transition"
              >
                {retrying ? "Retrying..." : "Retry"}
              </button>
            </div>
          </div>
        )}

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPI label="Total Assignments" value={stats?.total ?? 0} />
          <KPI label="Submitted EODs" value={stats?.submitted ?? 0} color="orange" />
          <KPI label="Approved" value={stats?.approved ?? 0} color="green" />
          <KPI label="Rejected" value={stats?.rejected ?? 0} color="red" />
        </div>

        {/* Submitted EODs Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-4 border-b bg-slate-50 font-semibold text-slate-700">
            📋 Pending EOD Approvals ({eods.length})
          </div>

          {eods.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-500">✓ No submitted EODs pending approval</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b">
                  <tr>
                    <th className="p-3 text-left font-semibold text-slate-700">Date</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Custodian</th>
                    <th className="p-3 text-left font-semibold text-slate-700">Status</th>
                    <th className="p-3 text-center font-semibold text-slate-700">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {eods.map((eod) => (
                    <tr key={eod.id} className="border-t hover:bg-slate-50 transition">
                      <td className="p-3 text-slate-900">{eod.assignment_date}</td>
                      <td className="p-3 text-slate-900">
                        {eod.custodian?.full_name || "—"}
                      </td>
                      <td className="p-3">
                        <span className="inline-block px-2 py-1 text-xs font-medium rounded bg-orange-100 text-orange-800">
                          {eod.status}
                        </span>
                      </td>
                      <td className="p-3 text-center">
                        <Link
                          to={`/admin/approvals/${eod.id}`}
                          className="inline-block px-3 py-1 text-xs font-medium text-primary hover:text-primary-light hover:underline transition"
                        >
                          View EOD
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Debug info in development */}
        {process.env.NODE_ENV === "development" && (
          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-xs text-slate-600">
            <p className="font-mono">
              Profile Role: {profile?.role} | Last Update: {lastUpdate}
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

function KPI({
  label,
  value,
  color = "blue",
}: {
  label: string;
  value: number;
  color?: "blue" | "green" | "orange" | "red";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600 border-blue-200",
    green: "bg-green-50 text-green-600 border-green-200",
    orange: "bg-orange-50 text-orange-600 border-orange-200",
    red: "bg-red-50 text-red-600 border-red-200",
  };

  return (
    <div className={`rounded-lg border p-4 text-center transition ${colorClasses[color]}`}>
      <div className="text-xs font-medium opacity-75">{label}</div>
      <div className="text-2xl font-bold mt-2">{value}</div>
    </div>
  );
}
