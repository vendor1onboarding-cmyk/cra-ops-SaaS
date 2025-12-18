import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

type Assignment = {
  id: number;
  assignment_date: string;
  status: string;
  custodian_id: string;
  custodian?: { full_name: string };
};

type Site = {
  id: number;
  site_code: string;
  atm_id: string | null;
  bank_name: string | null;
  city: string | null;
};

type Custodian = {
  id: string;
  full_name: string;
};

export default function AdminRouteAssignment() {
  const { profile } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [custodians, setCustodians] = useState<Custodian[]>([]);

  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);
  const [selectedSites, setSelectedSites] = useState<number[]>([]);

  // Create assignment
  const [selectedCustodian, setSelectedCustodian] = useState<string>("");
  const [assignmentDate, setAssignmentDate] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --------------------------------------------------
  // Load base data (ADMIN ONLY)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile || profile.role !== "admin") return;

    async function loadData() {
      setLoading(true);

      // Assignments (exclude rejected)
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("id, assignment_date, status, custodian_id")
        .not("status", "eq", "rejected")
        .order("assignment_date", { ascending: false });

      // Custodians
      const { data: custodianProfiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "custodian");

      // Sites
      const { data: sitesData } = await supabase
        .from("sites")
        .select("id, site_code, atm_id, bank_name, city")
        .order("site_code");

      // Map custodian name
      const custodianMap = new Map(
        custodianProfiles?.map(c => [c.id, c.full_name]) || []
      );

      const mergedAssignments =
        assignmentsData?.map(a => ({
          ...a,
          custodian: {
            full_name: custodianMap.get(a.custodian_id) || "Custodian",
          },
        })) || [];

      setAssignments(mergedAssignments);
      setCustodians(custodianProfiles || []);
      setSites(sitesData || []);
      setLoading(false);
    }

    loadData();
  }, [profile]);

  // --------------------------------------------------
  // Load route when assignment selected
  // --------------------------------------------------
  useEffect(() => {
    if (!selectedAssignment) return;

    async function loadRoute() {
      const { data } = await supabase
        .from("route_sites")
        .select("site_id, sequence_no")
        .eq("assignment_id", selectedAssignment)
        .order("sequence_no");

      setSelectedSites(data?.map(r => r.site_id) || []);
    }

    loadRoute();
  }, [selectedAssignment]);

  // --------------------------------------------------
  // Create Assignment (Option B)
  // --------------------------------------------------
  async function createAssignment() {
    if (!selectedCustodian || !assignmentDate) {
      setMessage("Select custodian and date");
      return;
    }

    // Soft check – one per day
    const existing = assignments.find(
      a =>
        a.custodian_id === selectedCustodian &&
        a.assignment_date === assignmentDate
    );

    if (existing) {
      setMessage("Assignment already exists for this custodian and date");
      return;
    }

    const { error } = await supabase.from("assignments").insert({
      custodian_id: selectedCustodian,
      assignment_date: assignmentDate,
      status: "open",
      title: "Daily Route",
    });

    if (error) {
      setMessage("Failed to create assignment");
    } else {
      setMessage("Assignment created successfully");
      setSelectedCustodian("");
      setAssignmentDate("");
      window.location.reload(); // simple & safe refresh
    }
  }

  // --------------------------------------------------
  // Toggle site selection
  // --------------------------------------------------
  function toggleSite(siteId: number) {
    setSelectedSites(prev =>
      prev.includes(siteId)
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  }

  // --------------------------------------------------
  // Save route (Option A – only OPEN)
  // --------------------------------------------------
  async function saveRoute() {
    const assignment = assignments.find(a => a.id === selectedAssignment);

    if (!assignment || assignment.status !== "open") {
      setMessage("Route can be assigned only for OPEN assignments");
      return;
    }

    if (selectedSites.length === 0) {
      setMessage("Select at least one site");
      return;
    }

    setSaving(true);
    setMessage(null);

    await supabase
      .from("route_sites")
      .delete()
      .eq("assignment_id", assignment.id);

    const inserts = selectedSites.map((siteId, idx) => ({
      assignment_id: assignment.id,
      site_id: siteId,
      sequence_no: idx + 1,
    }));

    const { error } = await supabase
      .from("route_sites")
      .insert(inserts);

    if (error) {
      setMessage("Failed to save route");
    } else {
      setMessage("Route assigned successfully");
    }

    setSaving(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        <h2 className="text-xl font-semibold text-primary">
          Admin – Assignment & Route Management
        </h2>

        {loading && <p>Loading…</p>}

        {!loading && (
          <>
            {/* Create Assignment */}
            <div className="bg-white p-4 rounded shadow space-y-2">
              <h3 className="font-semibold">Create Assignment</h3>

              <select
                className="w-full border px-3 py-2"
                value={selectedCustodian}
                onChange={e => setSelectedCustodian(e.target.value)}
              >
                <option value="">Select Custodian</option>
                {custodians.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.full_name}
                  </option>
                ))}
              </select>

              <input
                type="date"
                className="w-full border px-3 py-2"
                value={assignmentDate}
                onChange={e => setAssignmentDate(e.target.value)}
              />

              <button
                onClick={createAssignment}
                className="bg-primary text-white px-4 py-2 rounded text-sm"
              >
                Create Assignment
              </button>
            </div>

            {/* Assignment Selector */}
            <div className="bg-white p-4 rounded shadow">
              <label className="font-medium">Select Assignment</label>
              <select
                className="w-full border px-3 py-2 mt-2"
                value={selectedAssignment ?? ""}
                onChange={e =>
                  setSelectedAssignment(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">-- Select --</option>
                {assignments.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.assignment_date} – {a.custodian?.full_name} ({a.status})
                  </option>
                ))}
              </select>
            </div>

            {/* Route Assignment */}
            {selectedAssignment && (
              <div className="bg-white p-4 rounded shadow">
                <h3 className="font-semibold mb-2">Assign Route</h3>

                <div className="max-h-72 overflow-y-auto border">
                  {sites.map(site => (
                    <label
                      key={site.id}
                      className="flex items-center gap-2 px-3 py-2 border-b"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSites.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                      />
                      <span>{site.site_code}</span>
                      <span className="text-xs text-slate-500">
                        {site.city} | {site.bank_name}
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  disabled={saving}
                  onClick={saveRoute}
                  className="mt-4 bg-primary text-white px-4 py-2 rounded"
                >
                  Save Route
                </button>

                {message && <p className="mt-2 text-sm text-blue-600">{message}</p>}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
