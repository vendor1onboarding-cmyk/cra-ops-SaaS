import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
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
  const [error, setError] = useState<string | null>(null);

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

  async function handleSave() {
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

    /* Reset form */
    setSiteId(null);
    setDenoms({
      denom_100: 0,
      denom_200: 0,
      denom_500: 0,
      denom_2000: 0,
    });
    setReceipt(null);
    setRemarks("");

    alert("ATM Excess Cash recorded successfully.");
    setSaving(false);
  }

  /* ---------------- UI ---------------- */

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            ATM Excess Cash
          </h2>
          <p className="text-sm text-slate-600">
            Record excess cash details found at ATM locations
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ATM Site <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <h3 className="text-lg font-semibold text-slate-800">Excess Denomination Details</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["100", "200", "500", "2000"] as const).map((d) => (
              <div key={d} className="form-group">
                <label className="text-sm font-medium text-slate-700">
                  ₹{d} Excess Notes
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={(denoms as any)[`denom_${d}`]}
                  onChange={(e) =>
                    setDenoms({
                      ...denoms,
                      [`denom_${d}`]: Number(e.target.value),
                    })
                  }
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ATM Receipt <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                className="hidden"
                id="receipt-input"
              />
              <label htmlFor="receipt-input" className="cursor-pointer block">
                <div className="text-3xl mb-2">🧾</div>
                <p className="text-sm font-medium text-slate-700">
                  {receipt ? receipt.name : "Click to upload ATM receipt"}
                </p>
                <p className="text-xs text-slate-500 mt-1">PNG, JPG up to 10MB</p>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Remarks
            </label>
            <textarea
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any observations about the excess cash..."
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 active:scale-95 disabled:opacity-50 transition-all"
          >
            {saving ? "Saving…" : "Save Excess Cash Record"}
          </button>
        </div>
      </div>
    </AppLayout>
  );
}
