import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

export default function AdminApprovals() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;

    async function loadAssignments() {
      setLoading(true);

      const { data, error } = await supabase
        .from("assignments")
        .select(`
          id,
          assignment_date,
          title,
          status,
          custodian_id,
          profiles:profiles!profiles_pkey(
            full_name
          )
        `)
        .in("status", ["submitted", "approved", "rejected"])
        .order("assignment_date", { ascending: false });

      if (!error) {
        setAssignments(data || []);
      }

      setLoading(false);
    }

    loadAssignments();
  }, [profile]);

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-primary">
          Admin – EOD Approvals
        </h2>

        {loading && <p className="text-sm">Loading assignments…</p>}

        {!loading && assignments.length === 0 && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No submitted assignments found.
          </div>
        )}

        {!loading && assignments.length > 0 && (
          <div className="bg-white shadow rounded overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="bg-slate-100 text-left">
                <tr>
                  <th className="p-3 border">Date</th>
                  <th className="p-3 border">Assignment</th>
                  <th className="p-3 border">Custodian</th>
                  <th className="p-3 border">Status</th>
                  <th className="p-3 border text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-3 border">
                      {a.assignment_date}
                    </td>
                    <td className="p-3 border">
                      {a.title || `Assignment #${a.id}`}
                    </td>
                    <td className="p-3 border">
                      {a.profiles?.full_name || "—"}
                    </td>
                    <td className="p-3 border capitalize">
                      {a.status}
                    </td>
                    <td className="p-3 border text-center">
                      <Link
                        to={`/admin/approvals/${a.id}`}
                        className="px-3 py-1 bg-slate-700 text-white rounded text-xs hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
