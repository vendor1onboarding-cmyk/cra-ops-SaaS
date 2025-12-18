import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

type SiteOption = {
  site_id: number;
  display_label: string;
};

export default function ATMReplenishment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedSite, setSelectedSite] = useState<number | null>(null);

  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
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

  // --------------------------------------------------
  // Load ACTIVE assignment (safe fallback version)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadAssignmentAndSites() {
      setLoading(true);

      let assignment: any = null;

      // 1️⃣ Try latest OPEN assignment with route sites
      const { data: primary } = await supabase
        .from("assignments")
        .select(`
          id,
          route_sites (
            site_id,
            site:site_id (
              site_code,
              atm_id,
              bank_name
            )
          )
        `)
        .eq("custodian_id", profile.id)
        .eq("status", "open")
        .order("assignment_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (primary && primary.route_sites?.length > 0) {
        assignment = primary;
      }

      // 2️⃣ Fallback: any OPEN/SUBMITTED assignment that has route sites
      if (!assignment) {
        const { data: fallback } = await supabase
          .from("assignments")
          .select(`
            id,
            route_sites (
              site_id,
              site:site_id (
                site_code,
                atm_id,
                bank_name
              )
            )
          `)
          .eq("custodian_id", profile.id)
          .in("status", ["open", "submitted"])
          .order("assignment_date", { ascending: false });

        assignment =
          fallback?.find((a: any) => a.route_sites?.length > 0) || null;
      }

      if (!assignment) {
        setAssignmentId(null);
        setSites([]);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);

      const mappedSites: SiteOption[] =
        assignment.route_sites.map((r: any) => ({
          site_id: r.site_id,
          display_label: `${r.site.site_code} (${r.site.atm_id ?? "ATM"}) - ${r.site.bank_name ?? ""}`,
        })) || [];

      setSites(mappedSites);
      setLoading(false);
    }

    loadAssignmentAndSites();
  }, [profile]);

  // --------------------------------------------------
  // Save ATM replenishment
  // --------------------------------------------------
  async function handleSave() {
    if (!assignmentId || !selectedSite) {
      setMessage("Assignment or Site missing");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase.from("atm_replenishments").insert({
      assignment_id: assignmentId,
      site_id: selectedSite,
      time_in: timeIn || null,
      time_out: timeOut || null,
      closing_balance: closingBalance,
      remarks,
      ...form,
    });

    if (error) {
      console.error(error);
      setMessage("Failed to save ATM replenishment");
    } else {
      setMessage("ATM replenishment saved successfully");

      // Reset form
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
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-5">
        <h2 className="text-lg font-semibold text-primary">
          ATM Replenishment
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
                  <label className="text-xs">{label}</label>
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
                onChange={(e) => setClosingBalance(Number(e.target.value))}
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
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded text-sm"
            >
              {loading ? "Saving..." : "Save Replenishment"}
            </button>

            {message && (
              <p className="text-xs text-center text-slate-700">
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
