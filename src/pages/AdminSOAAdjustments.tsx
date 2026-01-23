import { useEffect, useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

type SOA = {
  id: number;
  assignment_id: number;
  custodian_id: string;
  assignment_date: string;
  final_net_cash_position: number;
};

export default function AdminSOAAdjustments() {
  const { profile } = useAuth();

  const [soaList, setSoaList] = useState<SOA[]>([]);
  const [selectedSOA, setSelectedSOA] = useState<SOA | null>(null);

  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [reference, setReference] = useState("");

  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  // =========================
  // ROLE GUARD + LOAD SOA
  // =========================
  useEffect(() => {
    if (!profile || !["admin", "supervisor"].includes(profile.role)) return;

    async function loadSOA() {
      setInitialLoad(true);

      const { data, error } = await supabase
        .from("v_soa_effective")
        .select(`
          id,
          assignment_id,
          custodian_id,
          assignment_date,
          final_net_cash_position
        `)
        .order("assignment_date", { ascending: false });

      if (error) {
        console.error("Failed to load SOA:", error);
        setSoaList([]);
      } else {
        setSoaList(data || []);
      }

      setInitialLoad(false);
    }

    loadSOA();
  }, [profile]);

  // =========================
  // PREVIEW CALCULATION
  // =========================
  const parsedAmount = Number(amount || 0);

  const previewNetPosition = useMemo(() => {
    if (!selectedSOA) return null;
    return selectedSOA.final_net_cash_position + parsedAmount;
  }, [selectedSOA, parsedAmount]);

  // =========================
  // SUBMIT ADJUSTMENT
  // =========================
  async function submitAdjustment() {
    if (!selectedSOA) {
      alert("Please select an SOA");
      return;
    }

    if (!amount || isNaN(parsedAmount) || parsedAmount === 0) {
      alert("Enter a valid adjustment amount");
      return;
    }

    if (!reason.trim()) {
      alert("Reason is mandatory");
      return;
    }

    setLoading(true);

    const { error } = await supabase.from("soa_adjustments").insert({
      soa_id: selectedSOA.id,
      assignment_id: selectedSOA.assignment_id,
      custodian_id: selectedSOA.custodian_id,
      adjustment_type: parsedAmount >= 0 ? "CREDIT" : "DEBIT",
      adjustment_amount: parsedAmount,
      reason: reason.trim(),
      reference: reference.trim() || null,
      created_by: profile?.id,
    });

    if (error) {
      console.error(error);
      alert("Failed to post SOA adjustment");
    } else {
      alert("SOA adjustment posted successfully");

      // Reset safely
      setAmount("");
      setReason("");
      setReference("");
      setSelectedSOA(null);
    }

    setLoading(false);
  }

  // =========================
  // RENDER
  // =========================
  if (!profile || !["admin", "supervisor"].includes(profile.role)) {
    return (
      <AppLayout>
        <div className="container">
          <p className="text-red-600">Access denied</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container space-y-6">

        {/* HEADER */}
        <h2 className="text-xl font-semibold text-primary">
          Statement of Account – Adjustments
        </h2>

        {/* SOA SELECTOR */}
        <div className="bg-white border rounded-xl p-4 space-y-3">
          <label className="block text-sm font-medium">
            Select Assignment / SOA
          </label>

          <select
            className="input w-full"
            value={selectedSOA?.id || ""}
            onChange={e =>
              setSelectedSOA(
                soaList.find(s => s.id === Number(e.target.value)) || null
              )
            }
          >
            <option value="">-- Select Approved Assignment --</option>
            {soaList.map(s => (
              <option key={s.id} value={s.id}>
                {s.assignment_date} | Assignment #{s.assignment_id}
              </option>
            ))}
          </select>

          {initialLoad && (
            <div className="text-sm text-slate-500">Loading SOA records…</div>
          )}

          {!initialLoad && soaList.length === 0 && (
            <div className="text-sm text-slate-500">
              No SOA records available
            </div>
          )}

          {selectedSOA && (
            <div className="text-sm text-slate-700">
              Current Net Position:&nbsp;
              <b>{selectedSOA.final_net_cash_position.toFixed(2)}</b>
            </div>
          )}
        </div>

        {/* ADJUSTMENT FORM */}
        {selectedSOA && (
          <div className="bg-white border rounded-xl p-4 space-y-4">

            <div>
              <label className="text-sm font-medium">
                Adjustment Amount (+ / -)
              </label>
              <input
                type="number"
                className="input w-full"
                placeholder="+500 or -250"
                value={amount}
                onChange={e => setAmount(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Reason (mandatory)
              </label>
              <textarea
                className="input w-full"
                rows={3}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            <div>
              <label className="text-sm font-medium">
                Reference (optional)
              </label>
              <input
                className="input w-full"
                value={reference}
                onChange={e => setReference(e.target.value)}
              />
            </div>

            {/* PREVIEW */}
            <div className="bg-slate-50 border rounded-lg p-3 text-sm space-y-1">
              <div>
                Current Net:&nbsp;
                <b>{selectedSOA.final_net_cash_position.toFixed(2)}</b>
              </div>
              <div>
                Adjustment:&nbsp;
                <b className={parsedAmount >= 0 ? "text-green-600" : "text-red-600"}>
                  {parsedAmount.toFixed(2)}
                </b>
              </div>
              <div>
                Resulting Net:&nbsp;
                <b>{previewNetPosition?.toFixed(2)}</b>
              </div>
            </div>

            <button
              onClick={submitAdjustment}
              disabled={loading}
              className="btn-primary"
            >
              {loading ? "Posting Adjustment…" : "Post Adjustment"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
