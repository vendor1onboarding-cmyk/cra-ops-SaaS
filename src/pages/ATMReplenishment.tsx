import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

/**
 * Supported denominations only
 */
const DENOMS = [2000, 500, 200, 100];

/**
 * IST DateTime helper (yyyy-MM-ddTHH:mm)
 */
function getISTDateTimeLocal(): string {
  const now = new Date();
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffsetMs);
  return istDate.toISOString().slice(0, 16);
}

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
  const [sites, setSites] = useState<any[]>([]);
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
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  /* --------------------------------------------------
     Load assignment and sites
     -------------------------------------------------- */
  useEffect(() => {
    if (!profile) return;

    async function load() {
      const { data } = await supabase
        .from("assignments")
        .select(`
          id,
          route_sites (
            site_id,
            site:site_id(site_code, bank_name, address, atm_id)
          )
        `)
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .eq("status", "open")
        .maybeSingle();

      if (!data) return;

      setAssignmentId(data.id);
      setSites(
        data.route_sites.map((r: any) => ({
          site_id: r.site_id,
          label: formatSite(r.site),
        }))
      );

      /* 🔑 AUTO-RESUME DRAFT (if exists) */
      const draftKeyPrefix = `atm_draft_${data.id}_`;
      const draftKey = Object.keys(localStorage).find(k =>
        k.startsWith(draftKeyPrefix)
      );

      if (draftKey) {
        const parsed = JSON.parse(localStorage.getItem(draftKey)!);
        setSelectedSite(parsed.siteId);
        setTimeIn(parsed.timeIn);
      }
    }

    load();
  }, [profile]);

  /* --------------------------------------------------
     Draft persistence helpers
     -------------------------------------------------- */
  function draftKey(siteId: number) {
    return `atm_draft_${assignmentId}_${siteId}`;
  }

  /* --------------------------------------------------
     On site select → restore or create draft
     -------------------------------------------------- */
  useEffect(() => {
    if (!assignmentId || !selectedSite) return;

    const key = draftKey(selectedSite);
    const draft = localStorage.getItem(key);

    if (draft) {
      const parsed = JSON.parse(draft);
      setTimeIn(parsed.timeIn);
    } else {
      const nowIST = getISTDateTimeLocal();
      setTimeIn(nowIST);
      localStorage.setItem(
        key,
        JSON.stringify({ siteId: selectedSite, timeIn: nowIST })
      );
    }
  }, [selectedSite, assignmentId]);

  /* --------------------------------------------------
     Derived validation
     -------------------------------------------------- */
  const totalNotes =
    form.denom_2000 +
    form.denom_500 +
    form.denom_200 +
    form.denom_100;

  const canSave =
    !!assignmentId &&
    !!selectedSite &&
    totalNotes > 0 &&
    !loading;

  /* --------------------------------------------------
     Save ATM Replenishment (FINAL INSERT)
     -------------------------------------------------- */
  async function handleSave() {
    setError(null);

    if (!assignmentId || !selectedSite) {
      setError("Assignment or Site missing");
      return;
    }

    if (totalNotes === 0) {
      setError("Please enter at least one denomination before saving.");
      return;
    }

    setLoading(true);

    const finalTimeOut = getISTDateTimeLocal();
    setTimeOut(finalTimeOut); // 👈 show it in UI (even though disabled)

    const { error } = await supabase
      .from("atm_replenishments")
      .insert({
        assignment_id: assignmentId,
        site_id: selectedSite,
        time_in: timeIn,
        time_out: finalTimeOut,
        closing_balance: closingBalance,
        remarks,
        ...form,
      });

    if (error) {
      setError("Failed to save ATM replenishment");
      setLoading(false);
      return;
    }

    /* Clear draft */
    localStorage.removeItem(draftKey(selectedSite));

    /* Reset form */
    setForm({
      denom_2000: 0,
      denom_500: 0,
      denom_200: 0,
      denom_100: 0,
    });
    setTimeIn("");
    setTimeOut("");
    setClosingBalance(0);
    setRemarks("");
    setSelectedSite(null);

    setLoading(false);
  }

  /* --------------------------------------------------
     UI
     -------------------------------------------------- */
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <h2 className="text-lg font-semibold">ATM Replenishment</h2>

        <select
          className="w-full border px-3 py-2"
          value={selectedSite ?? ""}
          onChange={e => setSelectedSite(Number(e.target.value))}
        >
          <option value="">Select Site</option>
          {sites.map(s => (
            <option key={s.site_id} value={s.site_id}>
              {s.label}
            </option>
          ))}
        </select>

        {selectedSite && (
          <>
            <div className="grid grid-cols-2 gap-3">
              {DENOMS.map(d => (
                <div key={d}>
                  <label className="text-xs">₹{d}</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border px-2 py-1"
                    value={(form as any)[`denom_${d}`]}
                    onChange={e =>
                      setForm({
                        ...form,
                        [`denom_${d}`]: Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div>
              <label className="text-sm">Time In</label>
              <input
                type="datetime-local"
                className="w-full border px-2 py-1"
                value={timeIn}
                onChange={e => setTimeIn(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm">Time Out</label>
              <input
                type="datetime-local"
                className="w-full border px-2 py-1"
                value={timeOut}
                disabled
              />
            </div>

            <input
              type="number"
              className="w-full border px-3 py-2"
              placeholder="Closing Balance"
              value={closingBalance}
              onChange={e => setClosingBalance(Number(e.target.value))}
            />

            <textarea
              className="w-full border px-3 py-2"
              placeholder="Remarks"
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
            />

            <button
              disabled={!canSave}
              onClick={handleSave}
              className={`w-full py-2 rounded ${
                canSave
                  ? "bg-primary text-white"
                  : "bg-slate-300 text-slate-500 cursor-not-allowed"
              }`}
            >
              {loading ? "Saving…" : "Save ATM Replenishment"}
            </button>

            {error && (
              <p className="text-sm text-red-600 text-center">{error}</p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
