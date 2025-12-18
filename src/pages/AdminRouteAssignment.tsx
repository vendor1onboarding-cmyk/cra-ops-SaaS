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

export default function AdminRouteAssignment() {
  const { profile } = useAuth();

  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedAssignment, setSelectedAssignment] = useState<number | null>(null);
  const [selectedSites, setSelectedSites] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --------------------------------------------------
  // Load assignments + sites (ADMIN ONLY)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile || profile.role !== "admin") return;

    async function loadData() {
      setLoading(true);

      // 1️⃣ Load assignments (NO joins)
      const { data: assignmentsData, error } = await supabase
        .from("assignments")
        .select("id, assignment_date, status, custodian_id")
        .not("status", "eq", "rejected")
        .order("assignment_date", { ascending: false });

      if (error) {
        console.error("Failed to load assignments", error);
        setAssignments([]);
        setLoading(false);
        return;
      }

      // 2️⃣ Load custodian names separately
      const custodianIds = Array.from(
        new Set(assignmentsData.map(a => a.custodian_id))
      );

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", custodianIds);

      const profileMap = new Map(
        profilesData?.map(p => [p.id, p.full_name]) || []
      );

      // 3️⃣ Merge assignments + custodian name
      const mergedAssignments: Assignment[] = assignmentsData.map(a => ({
        ...a,
        custodian: {
          full_name: profileMap.get(a.custodian_id) || "Custodian",
        },
      }));

      // 4️⃣ Load sites
      const { data: sitesData } = await supabase
        .from("sites")
        .select("id, site_code, atm_id, bank_name, city")
        .order("site_code");

      setAssignments(mergedAssignments);
      setSites(sitesData || []);
      setLoading(false);
    }

    loadData();
  }, [profile]);

  // --------------------------------------------------
  // Load existing route when assignment changes
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
  // Save route
  // --------------------------------------------------
  async function saveRoute() {
    if (!selectedAssignment || selectedSites.length === 0) {
      setMessage("Select an assignment and at least one site.");
      return;
    }

    setSaving(true);
    setMessage(null);

    // Clear existing route
    await supabase
      .from("route_sites")
      .delete()
      .eq("assignment_id", selectedAssignment);

    // Insert new route
    const inserts = selectedSites.map((siteId, idx) => ({
      assignment_id: selectedAssignment,
      site_id: siteId,
      sequence_no: idx + 1,
    }));

    const { error } = await supabase
      .from("route_sites")
      .insert(inserts);

    if (error) {
      console.error(error);
      setMessage("Failed to save route. Try again.");
    } else {
      setMessage("Route assigned successfully.");
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
          Admin – Route Assignment
        </h2>

        {loading && <p className="text-sm">Loading data…</p>}

        {!loading && (
          <>
            {/* Assignment Selector */}
            <div className="bg-white p-4 rounded shadow space-y-2">
              <label className="text-sm font-medium">Select Assignment</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
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

            {/* Sites List */}
            {selectedAssignment && (
              <div className="bg-white p-4 rounded shadow">
                <h3 className="text-sm font-semibold mb-2">
                  Select Sites
                </h3>

                <div className="max-h-80 overflow-y-auto border rounded">
                  {sites.map(site => (
                    <label
                      key={site.id}
                      className="flex items-center gap-2 px-3 py-2 border-b text-sm cursor-pointer hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSites.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                      />
                      <span className="font-medium">{site.site_code}</span>
                      <span className="text-xs text-slate-500">
                        {site.city} | {site.bank_name}
                      </span>
                    </label>
                  ))}
                </div>

                <button
                  disabled={saving}
                  onClick={saveRoute}
                  className="mt-4 px-4 py-2 bg-primary text-white rounded text-sm disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save Route"}
                </button>

                {message && (
                  <p className="mt-2 text-sm text-blue-600">{message}</p>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
