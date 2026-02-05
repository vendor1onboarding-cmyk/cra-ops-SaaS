import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { getISTDateString } from "../utils/time";

export default function ATMExcessCash() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);

  const [denoms, setDenoms] = useState({
    denom_100: 0,
    denom_200: 0,
    denom_500: 0,
    denom_2000: 0,
  });

  const [receipt, setReceipt] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  /* ---------------- Load assignment & sites ---------------- */

  useEffect(() => {
    if (!profile) return;

    async function loadData() {
      const today = getISTDateString();

      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .single();

      if (!assignment) return;

      setAssignmentId(assignment.id);

      const { data } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address)")
        .eq("assignment_id", assignment.id);

      setSites((data || []).map((r: any) => r.site));
    }

    loadData();
  }, [profile]);

  /* ---------------- Save Excess Cash ---------------- */

  function resetForm() {
    setSiteId(null);
    setDenoms({
      denom_100: 0,
      denom_200: 0,
      denom_500: 0,
      denom_2000: 0,
    });
    setReceipt(null);
    setRemarks("");
    setSubmitLocked(false);
  }

  async function handleSave() {
    if (saving || submitLocked) return;
    setError(null);
    setSaving(true);

    const totalNotes =
      denoms.denom_100 +
      denoms.denom_200 +
      denoms.denom_500 +
      denoms.denom_2000;

    if (!siteId) {
      setError("Please select ATM site.");
      setSaving(false);
      return;
    }

    if (totalNotes === 0) {
      setError("Enter at least one excess denomination.");
      setSaving(false);
      return;
    }

    if (!receipt) {
      setError("ATM receipt upload is mandatory.");
      setSaving(false);
      return;
    }

    const filePath = `atm-excess/${assignmentId}-${siteId}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("issue-photos")
      .upload(filePath, receipt, { upsert: true });

    if (uploadError) {
      setError("Receipt upload failed.");
      setSaving(false);
      return;
    }

    const { error } = await supabase.from("atm_excess_cash").insert({
      assignment_id: assignmentId,
      site_id: siteId,
      ...denoms,
      atm_receipt_url: filePath,
      remarks,
    });

    if (error) {
      setError("Failed to save excess cash record.");
      setSaving(false);
      return;
    }

    setSaving(false);
    setSubmitLocked(true);
    setConfirmMessage(
      `ATM excess cash recorded successfully for ${
        sites.find((s) => s.id === siteId)?.bank_name || "site"
      }.`
    );
    setShowConfirm(true);
  }

  /* ---------------- UI ---------------- */

  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-4">
        <h2 className="text-xl font-semibold text-primary">
          ATM Excess Cash Entry
        </h2>

        <div>
          <label className="text-sm">ATM Site</label>
          <select
            className="w-full border rounded px-2 py-1 text-sm"
            value={siteId ?? ""}
            onChange={(e) => setSiteId(Number(e.target.value))}
          >
            <option value="">-- Select ATM --</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.bank_name} – {s.address}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(["100", "200", "500", "2000"] as const).map((d) => (
            <div key={d}>
              <label className="text-sm">₹{d} Excess Notes</label>
              <input
                type="number"
                min={0}
                className="w-full border rounded px-2 py-1 text-sm"
                value={(denoms as any)[`denom_${d}`]}
                onChange={(e) =>
                  setDenoms({
                    ...denoms,
                    [`denom_${d}`]: Number(e.target.value),
                  })
                }
              />
            </div>
          ))}
        </div>

        <div>
          <label className="text-sm">ATM Receipt (Required)</label>
          <input
            type="file"
            accept="image/*"
            className="w-full text-sm"
            onChange={(e) => setReceipt(e.target.files?.[0] || null)}
          />
        </div>

        <div>
          <label className="text-sm">Remarks</label>
          <textarea
            className="w-full border rounded px-2 py-1 text-sm"
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving || submitLocked}
          className="w-full py-2 bg-green-600 text-white rounded text-sm"
        >
          {saving ? "Saving…" : "Save Excess Cash Record"}
        </button>
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Excess Cash Saved"
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
