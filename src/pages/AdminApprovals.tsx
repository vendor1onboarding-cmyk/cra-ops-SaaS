import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { formatISTDate } from "../utils/time";

type Assignment = {
  id: number;
  assignment_date: string;
  title: string | null;
  status: string;
  custodian_id: string;
  custodian_name: string;
};

export default function AdminApprovals() {
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;

    async function load() {
      setLoading(true);

      /* ---- 1. Load submitted assignments ONLY ---- */
      const { data: assignmentData, error } = await supabase
        .from("assignments")
        .select("id, assignment_date, title, status, custodian_id")
        .eq("status", "submitted")
        .order("assignment_date", { ascending: false });

      if (error || !assignmentData || assignmentData.length === 0) {
        setAssignments([]);
        setLoading(false);
        return;
      }

      /* ---- 2. Load custodian names separately (RLS-safe) ---- */
      const custodianIds = [
        ...new Set(assignmentData.map(a => a.custodian_id)),
      ];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", custodianIds);

      const nameMap = new Map(
        profiles?.map(p => [p.id, p.full_name]) || []
      );

      /* ---- 3. Merge cleanly ---- */
      const merged = assignmentData.map(a => ({
        ...a,
        custodian_name: nameMap.get(a.custodian_id) || "—",
      }));

      setAssignments(merged);
      setLoading(false);
    }

    load();
  }, [profile]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-4">
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
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 border">Date</th>
                  <th className="p-3 border">Assignment</th>
                  <th className="p-3 border">Custodian</th>
                  <th className="p-3 border">Status</th>
                  <th className="p-3 border text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {assignments.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="p-3 border">{formatISTDate(a.assignment_date, "short")}</td>
                    <td className="p-3 border">
                      {a.title || `Assignment #${a.id}`}
                    </td>
                    <td className="p-3 border">{a.custodian_name}</td>
                    <td className="p-3 border capitalize">{a.status}</td>
                    <td className="p-3 border text-center">
                      <Link
                        to={`/admin/approvals/${a.id}`}
                        className="btn-primary text-xs"
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
    </AppLayout>
  );
}
