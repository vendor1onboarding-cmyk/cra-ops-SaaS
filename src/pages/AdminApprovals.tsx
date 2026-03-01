import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import { formatDateString, getISTDateString } from "../utils/time";

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
  const [custodians, setCustodians] = useState<Array<{ id: string; full_name: string }>>([]);
  const [selectedCustodian, setSelectedCustodian] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedDate, setSelectedDate] = useState("");
  const [resolvedAssignment, setResolvedAssignment] = useState<Assignment | null>(null);
  const [resolveNotice, setResolveNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const today = getISTDateString();

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;

    async function loadCustodians() {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "custodian")
        .order("full_name", { ascending: true });

      setCustodians(data || []);
    }

    loadCustodians();
  }, [profile]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;

    async function load() {
      setLoading(true);

      /* ---- 1. Load assignments across statuses (or selected status) ---- */
      let assignmentQuery = supabase
        .from("assignments")
        .select("id, assignment_date, title, status, custodian_id")
        .order("assignment_date", { ascending: false });

      if (selectedStatus !== "ALL") {
        assignmentQuery = assignmentQuery.eq("status", selectedStatus);
      }

      const { data: assignmentData, error } = await assignmentQuery;

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
  }, [profile, selectedStatus]);

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
    if (!selectedCustodian || selectedCustodian === "ALL" || !selectedDate) {
      setResolvedAssignment(null);
      setResolveNotice(null);
      return;
    }

    async function resolveAssignmentByCustodianAndDate() {
      const { data, error } = await supabase
        .from("assignments")
        .select("id, assignment_date, title, status, custodian_id")
        .eq("custodian_id", selectedCustodian)
        .eq("assignment_date", selectedDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setResolvedAssignment(null);
        setResolveNotice("No assignment found for selected custodian and date.");
        return;
      }

      const custodianName =
        custodians.find((c) => c.id === data.custodian_id)?.full_name || "—";

      setResolvedAssignment({
        ...data,
        custodian_name: custodianName,
      });
      setResolveNotice(null);
    }

    resolveAssignmentByCustodianAndDate();
  }, [profile, selectedCustodian, selectedDate, custodians]);

  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-primary">
          Admin – EOD Approvals
        </h2>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">Open Custodian EOD</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-slate-600 mb-1">Custodian</label>
              <select
                value={selectedCustodian}
                onChange={(e) => setSelectedCustodian(e.target.value)}
                className="input w-full"
              >
                <option value="ALL">Select Custodian</option>
                {custodians.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="input w-full"
                max={today}
              />
            </div>

            <div>
              <label className="block text-xs text-slate-600 mb-1">Status (List)</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="input w-full"
              >
                <option value="ALL">All</option>
                <option value="open">Open</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="flex items-end">
              {resolvedAssignment ? (
                <Link
                  to={`/admin/approvals/${resolvedAssignment.id}`}
                  className="btn-primary w-full text-center"
                >
                  Open EOD #{resolvedAssignment.id}
                </Link>
              ) : (
                <div className="text-xs text-slate-500 w-full p-2 border border-slate-200 rounded">
                  Select custodian and date to open EOD.
                </div>
              )}
            </div>
          </div>

          {resolveNotice && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {resolveNotice}
            </div>
          )}

          {resolvedAssignment && (
            <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded px-3 py-2">
              {formatDateString(resolvedAssignment.assignment_date)} • {resolvedAssignment.custodian_name} • {resolvedAssignment.status}
            </div>
          )}
        </div>

        {loading && <p className="text-sm">Loading assignments…</p>}

        {!loading && assignments.length === 0 && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No assignments found for selected status.
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
                    <td className="p-3 border">{formatDateString(a.assignment_date)}</td>
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
