import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

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

export default function ATMReplenishment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<number | null>(null);

  const [timeIn, setTimeIn] = useState<string>("");
  const [timeOut, setTimeOut] = useState<string>("");
  const [closingBalance, setClosingBalance] = useState<number>(0);
  const [remarks, setRemarks] = useState("");

  const [form, setForm] = useState({
    denom_2000: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  /* --------------------------------------------------
     Load TODAY's assignment and sites
     -------------------------------------------------- */
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

  /* --------------------------------------------------
     Auto set Time In when site selected
     -------------------------------------------------- */
  useEffect(() => {
    if (selectedSite && !timeIn) {
      setTimeIn(new Date().toISOString().slice(0, 16));
    }
  }, [selectedSite]);

  /* --------------------------------------------------
     Derived validation
     -------------------------------------------------- */
  const totalNotes =
    form.denom_2000 +
    form.denom_500 +
    form.denom_200 +
    form.denom_100 +
    form.denom_50 +
    form.denom_20 +
    form.denom_10;

  const canSave =
    !loading &&
    !!assignmentId &&
    !!selectedSite &&
    totalNotes > 0;

  /* --------------------------------------------------
     Save ATM replenishment (HARD GUARDED)
     -------------------------------------------------- */
  async function handleSave() {
    setMessage(null);

    if (!assignmentId || !selectedSite) {
      setMessage("Assignment or Site missing");
      return;
    }

    if (totalNotes === 0) {
      setMessage("Please enter at least one denomination before saving.");
      return;
    }

    setLoading(true);

    const finalTimeOut = new Date().toISOString().slice(0, 16);

    const { error } = await supabase
      .from("atm_replenishments")
      .insert({
        assignment_id: assignmentId,
        site_id: selectedSite,
        time_in: timeIn || null,
        time_out: finalTimeOut,
        closing_balance: closingBalance,
        remarks,
        ...form,
      });

    if (error) {
      console.error(error);
      setMessage("Failed to save ATM replenishment");
      setLoading(false);
      return;
    }

    // Reset form safely
    setForm({
      denom_2000: 0,
      denom_500: 0,
      denom_200: 0,
      denom_100: 0,
      denom_50: 0,
      denom_20: 0,
      denom_10: 0,
    });
    setClosingBalance(0);
    setRemarks("");
    setTimeIn("");
    setTimeOut("");
    setSelectedSite(null);

    setLoading(false);
    setMessage("ATM replenishment saved successfully");
  }

  /* --------------------------------------------------
     UI
     -------------------------------------------------- */
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-5">
        <h2 className="text-lg font-semibold text-primary">
          ATM Replenishment
        </h2>

        {!assignmentId && !loading && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No assignment available for today or route not assigned yet.
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
                  <div>
                    <label className="text-sm">Time In</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={timeIn}
                      onChange={(e) => setTimeIn(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-sm">Time Out</label>
                    <input
                      type="datetime-local"
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={timeOut}
                      onChange={(e) => setTimeOut(e.target.value)}
                      disabled
                    />
                  </div>
                </div>

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
                      <label className="text-xs">₹{label}</label>
                      <input
                        type="number"
                        min={0}
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={(form as any)[key]}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            [key]: Number(e.target.value),
                          })
                        }
                      />
                    </div>
                  ))}
                </div>

                <div>
                  <label className="text-sm">Closing Balance</label>
                  <input
                    type="number"
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={closingBalance}
                    onChange={(e) =>
                      setClosingBalance(Number(e.target.value))
                    }
                  />
                </div>

                <div>
                  <label className="text-sm">Remarks</label>
                  <textarea
                    className="w-full border rounded px-3 py-2 text-sm"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <button
                  onClick={handleSave}
                  disabled={!canSave}
                  className={`w-full py-2 rounded text-sm ${
                    canSave
                      ? "bg-primary text-white"
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  }`}
                >
                  {loading ? "Saving..." : "Save Replenishment"}
                </button>

                {message && (
                  <p className="text-xs text-center mt-2 text-red-600">
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
