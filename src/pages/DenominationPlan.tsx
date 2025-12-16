import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

type SiteOption = {
  site_id: number;
  display_label: string;
};

export default function DenominationPlan() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<number | null>(null);

  const [form, setForm] = useState({
    denom_2000: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
    remarks: "",
    has_source_report: true,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // --------------------------------------------------
  // Load active assignment + route sites
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadAssignmentAndSites() {
      setLoading(true);

      // 1️⃣ Resolve active assignment
      const { data: assignment, error } = await supabase
        .from("assignments")
        .select("id, status")
        .eq("custodian_id", profile.id)
        .in("status", ["open", "submitted"])
        .order("assignment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !assignment) {
        setAssignmentId(null);
        setSites([]);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);

      // 2️⃣ Load route sites
      const { data: routeSites } = await supabase
        .from("route_sites")
        .select("site_id, site:site_id(site_code, atm_id, bank_name)")
        .eq("assignment_id", assignment.id)
        .order("sequence_no");

      const mappedSites: SiteOption[] =
        routeSites?.map((r: any) => ({
          site_id: r.site_id,
          display_label: `${r.site.site_code} (${r.site.atm_id ?? "ATM"}) - ${r.site.bank_name ?? ""}`,
        })) || [];

      setSites(mappedSites);
      setLoading(false);
    }

    loadAssignmentAndSites();
  }, [profile]);

  // --------------------------------------------------
  // Load existing denomination plan when site changes
  // --------------------------------------------------
  useEffect(() => {
    if (!assignmentId || !selectedSite) return;

    async function loadExistingPlan() {
      const { data } = await supabase
        .from("denomination_plans")
        .select("*")
        .eq("assignment_id", assignmentId)
        .eq("site_id", selectedSite)
        .maybeSingle();

      if (data) {
        setForm({
          denom_2000: data.denom_2000,
          denom_500: data.denom_500,
          denom_200: data.denom_200,
          denom_100: data.denom_100,
          denom_50: data.denom_50,
          denom_20: data.denom_20,
          denom_10: data.denom_10,
          remarks: data.remarks || "",
          has_source_report: data.has_source_report,
        });
      } else {
        // Reset form
        setForm({
          denom_2000: 0,
          denom_500: 0,
          denom_200: 0,
          denom_100: 0,
          denom_50: 0,
          denom_20: 0,
          denom_10: 0,
          remarks: "",
          has_source_report: true,
        });
      }
    }

    loadExistingPlan();
  }, [assignmentId, selectedSite]);

  // --------------------------------------------------
  // Save denomination plan (UPSERT)
  // --------------------------------------------------
  async function handleSave() {
    if (!assignmentId || !selectedSite) return;

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.from("denomination_plans").upsert(
      {
        assignment_id: assignmentId,
        site_id: selectedSite,
        ...form,
      },
      {
        onConflict: "assignment_id,site_id",
      }
    );

    setMessage(
      error ? "Failed to save denomination plan" : "Denomination plan saved successfully"
    );

    setLoading(false);
  }

  const totalAmount =
    form.denom_2000 * 2000 +
    form.denom_500 * 500 +
    form.denom_200 * 200 +
    form.denom_100 * 100 +
    form.denom_50 * 50 +
    form.denom_20 * 20 +
    form.denom_10 * 10;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-5">
        <h2 className="text-lg font-semibold text-primary">
          Denomination Planning
        </h2>

        {!assignmentId && !loading && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No active assignment found.
          </div>
        )}

        {assignmentId && (
          <>
            <div>
              <label className="text-sm block mb-1">Select Site</label>
              <select
                className="w-full border rounded px-3 py-2 text-sm"
                value={selectedSite ?? ""}
                onChange={(e) => setSelectedSite(Number(e.target.value))}
              >
                <option value="">-- Select Site --</option>
                {sites.map((s) => (
                  <option key={s.site_id} value={s.site_id}>
                    {s.display_label}
                  </option>
                ))}
              </select>
            </div>

            {selectedSite && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ["denom_2000", 2000],
                    ["denom_500", 500],
                    ["denom_200", 200],
                    ["denom_100", 100],
                    ["denom_50", 50],
                    ["denom_20", 20],
                    ["denom_10", 10],
                  ].map(([key, label]) => (
                    <div key={key}>
                      <label className="text-xs">{label}</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={(form as any)[key]}
                        onChange={(e) =>
                          setForm({ ...form, [key]: Number(e.target.value) })
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="text-sm font-semibold">
                  Total Amount: ₹{totalAmount.toLocaleString()}
                </div>

                <div>
                  <label className="text-sm block mb-1">Remarks</label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={form.remarks}
                    onChange={(e) =>
                      setForm({ ...form, remarks: e.target.value })
                    }
                  />
                </div>

                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.has_source_report}
                    onChange={(e) =>
                      setForm({ ...form, has_source_report: e.target.checked })
                    }
                  />
                  Source report available
                </label>

                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full bg-primary text-white py-2 rounded text-sm"
                >
                  {loading ? "Saving..." : "Save Plan"}
                </button>

                {message && (
                  <p className="text-xs text-center text-green-600">
                    {message}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
