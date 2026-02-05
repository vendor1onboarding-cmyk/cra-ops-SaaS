import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { getISTDateString } from "../utils/time";

type SiteOption = {
  site_id: number;
  display_label: string;
};

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

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
  const [submitLocked, setSubmitLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  const today = getISTDateString();

  // --------------------------------------------------
  // Load TODAY's assignment and sites (DATE-FIRST)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadAssignmentAndSites() {
      setLoading(true);

      const { data: assignment } = await supabase
        .from("assignments")
        .select(`
          id,
          route_sites (
            site_id,
            site:site_id(
              site_code,
              bank_name,
              address,
              atm_id
            )
          )
        `)
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .eq("status", "open")
        .maybeSingle();

      if (!assignment) {
        setAssignmentId(null);
        setSites([]);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);

      const mappedSites: SiteOption[] =
        assignment.route_sites?.map((r: any) => ({
          site_id: r.site_id,
          display_label: formatSite(r.site),
        })) || [];

      setSites(mappedSites);
      setLoading(false);
    }

    loadAssignmentAndSites();
  }, [profile]);

  // --------------------------------------------------
  // Load existing plan when site changes
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
  // Save plan
  // --------------------------------------------------
  function resetForm() {
    setSelectedSite(null);
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
    setSubmitLocked(false);
  }

  async function handleSave() {
    if (loading || submitLocked) return;
    if (!assignmentId || !selectedSite) return;

    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("denomination_plans")
      .upsert(
        {
          assignment_id: assignmentId,
          site_id: selectedSite,
          ...form,
        },
        { onConflict: "assignment_id,site_id" }
      );

    if (error) {
      setMessage("Failed to save denomination plan");
    } else {
      const siteLabel = sites.find((s) => s.site_id === selectedSite)
        ?.display_label;
      setSubmitLocked(true);
      setConfirmMessage(
        `Denomination plan saved successfully for ${siteLabel || "site"}.`
      );
      setShowConfirm(true);
    }

    setLoading(false);
  }

  const totalAmount =
    form.denom_2000 * 2000 +
    form.denom_500 * 500 +
    form.denom_200 * 200 +
    form.denom_100 * 100;

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            Denomination Planning
          </h2>
          <p className="text-sm text-slate-600">
            Plan the denomination breakdown for each site in your route
          </p>
        </div>

        {!assignmentId && !loading && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <span className="font-semibold">⚠️ No assignment available</span> for today or route not assigned yet.
          </div>
        )}

        {assignmentId && (
          <>
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Select Site
                </label>
                <select
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selectedSite ?? ""}
                  onChange={(e) => setSelectedSite(Number(e.target.value))}
                >
                  <option value="">-- Select a Site --</option>
                  {sites.map((s) => (
                    <option key={s.site_id} value={s.site_id}>
                      {s.display_label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedSite && (
              <>
                <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-800 mb-4">
                      Denomination Details
                    </h3>
                  </div>

                  {/* Use DenominationFields if imported, otherwise inline */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      ["denom_100", 100],
                      ["denom_200", 200],
                      ["denom_500", 500],
                      ["denom_2000", 2000],
                    ].map(([key, label]) => (
                      <div key={key} className="form-group">
                        <label className="text-sm font-medium text-slate-700">
                          ₹{label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                          value={(form as any)[key]}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              [key]: Number(e.target.value),
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>

                  {/* Summary Box */}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-semibold text-slate-700">
                        Total Amount:
                      </span>
                      <span className="text-xl font-bold text-primary">
                        ₹{totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={handleSave}
                    disabled={loading || submitLocked}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {loading ? "Saving..." : "Save Plan"}
                  </button>
                </div>

                {message && (
                  <p className={`text-sm text-center p-3 rounded-lg ${
                    message.includes("success")
                      ? "bg-green-50 text-green-800 border border-green-200"
                      : "bg-red-50 text-red-800 border border-red-200"
                  }`}>
                    {message}
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Denomination Plan Saved"
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
          resetForm();
        }}
      />
    </AppLayout>
  );
}
