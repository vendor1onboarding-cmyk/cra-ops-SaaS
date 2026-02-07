import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
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
  address?: string | null;
  city: string | null;
};

type Custodian = {
  id: string;
  full_name: string;
};

// 🔹 Centralized site formatter (UI only)
function formatSite(site: Site) {
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function AdminRouteAssignment() {
  const { profile } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [custodians, setCustodians] = useState<Custodian[]>([]);

  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);
  const [selectedSites, setSelectedSites] = useState<number[]>([]);

  // Assignment creation
  const [selectedCustodian, setSelectedCustodian] = useState<string>("");
  const [assignmentDate, setAssignmentDate] = useState<string>("");

  // District auto assign
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState<string>("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [autoAssignNotice, setAutoAssignNotice] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<
    "create" | "route" | null
  >(null);

  // --------------------------------------------------
  // Load base data (ADMIN ONLY)
  // --------------------------------------------------
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

    // Sites (⚠️ include address)
    const { data: sitesData } = await supabase
      .from("sites")
      .select("id, site_code, atm_id, bank_name, address, city")
      .order("site_code");

    // Build district list
    const uniqueDistricts = Array.from(
      new Set((sitesData || []).map(s => s.city).filter(Boolean))
    );

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
    setDistricts(uniqueDistricts);
    setLoading(false);
  }

  useEffect(() => {
    if (!profile || profile.role !== "admin") return;
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

  useEffect(() => {
    setAutoAssignNotice(null);
  }, [selectedAssignment, selectedDistrict]);

  // --------------------------------------------------
  // Create Assignment (Option B – unchanged)
  // --------------------------------------------------
  async function createAssignment() {
    if (submitLocked || creating) return;
    if (!selectedCustodian || !assignmentDate) {
      setMessage("Select custodian and date");
      return;
    }

    const existing = assignments.find(
      a =>
        a.custodian_id === selectedCustodian &&
        a.assignment_date === assignmentDate
    );

    if (existing) {
      setMessage("Assignment already exists for this custodian and date");
      return;
    }

    setCreating(true);
    setMessage(null);

    const { error } = await supabase.from("assignments").insert({
      custodian_id: selectedCustodian,
      assignment_date: assignmentDate,
      status: "open",
      title: "Daily Route",
    });

    if (error) {
      const msg = error.message || "Failed to create assignment";
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique")) {
        setMessage("Assignment already exists for this custodian and date");
      } else {
        setMessage("Failed to create assignment");
      }
    } else {
      await loadData();
      setMessage("Assignment created successfully");
      setSubmitLocked(true);
      const custodianLabel = custodians.find(
        (c) => c.id === selectedCustodian
      )?.full_name;
      setConfirmTitle("Assignment Created");
      setConfirmMessage(
        `Assignment created successfully for ${custodianLabel || "custodian"}.`
      );
      setConfirmAction("create");
      setShowConfirm(true);
    }

    setCreating(false);
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
  // Save route (manual – unchanged)
  // --------------------------------------------------
  async function saveRoute() {
    if (submitLocked) return;
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
    setAutoAssignNotice(null);

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
      setSubmitLocked(true);
      setConfirmTitle("Route Assigned");
      setConfirmMessage("Route assigned successfully.");
      setConfirmAction("route");
      setShowConfirm(true);
    }
    setSaving(false);
  }

  // --------------------------------------------------
  // AUTO ASSIGN BY DISTRICT (RPC – unchanged)
  // --------------------------------------------------
  async function autoAssignByDistrict() {
    if (submitLocked) return;
    if (!selectedAssignment || !selectedDistrict) {
      setMessage("Select assignment and district");
      return;
    }

    const assignment = assignments.find(a => a.id === selectedAssignment);
    if (!assignment || assignment.status !== "open") {
      setMessage("Auto-assign allowed only for OPEN assignments");
      return;
    }

    setSaving(true);
    setMessage(null);

    const { error } = await supabase.rpc("auto_assign_route_by_district", {
      p_assignment_id: selectedAssignment,
      p_district: selectedDistrict,
    });

    if (error) {
      setMessage(error.message);
    } else {
      setMessage("Route auto-assigned by district");

      const { data } = await supabase
        .from("route_sites")
        .select("site_id, sequence_no")
        .eq("assignment_id", selectedAssignment)
        .order("sequence_no");

      setSelectedSites(data?.map(r => r.site_id) || []);
      const assignedCount = data?.length || 0;
      setAutoAssignNotice(
        `Auto-assigned ${assignedCount} site${assignedCount === 1 ? "" : "s"} for ${selectedDistrict}. You can adjust and click Save Route.`
      );
    }

    setSaving(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-6xl mx-auto space-y-3">
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
                type="button"
                onClick={createAssignment}
                disabled={submitLocked || creating}
                className="bg-primary text-white px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Assignment"}
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
              <div className="bg-white p-4 rounded shadow space-y-4">
                <h3 className="font-semibold">Assign Route</h3>

                {/* Auto Assign */}
                <div className="border p-3 rounded space-y-2">
                  <label className="text-sm font-medium">
                    Auto-assign by District
                  </label>

                  <select
                    className="w-full border px-3 py-2"
                    value={selectedDistrict}
                    onChange={e => setSelectedDistrict(e.target.value)}
                  >
                    <option value="">Select District</option>
                    {districts.map(d => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={autoAssignByDistrict}
                    disabled={saving}
                    className="bg-slate-700 text-white px-4 py-2 rounded text-sm"
                  >
                    Auto Assign Route
                  </button>

                  {autoAssignNotice && (
                    <div className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
                      {autoAssignNotice}
                    </div>
                  )}
                </div>

                {/* Manual Assign */}
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
                      <span>{formatSite(site)}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={saving || submitLocked}
                  onClick={saveRoute}
                  className="bg-primary text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  Save Route
                </button>

                {message && (
                  <p className="text-sm text-blue-600">{message}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmationModal
        open={showConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
          if (confirmAction === "create") {
            setSelectedCustodian("");
            setAssignmentDate("");
          }
          if (confirmAction === "route") {
            setSelectedAssignment(null);
            setSelectedSites([]);
          }
          setConfirmAction(null);
          setSubmitLocked(false);
        }}
      />
    </AppLayout>
  );
}
