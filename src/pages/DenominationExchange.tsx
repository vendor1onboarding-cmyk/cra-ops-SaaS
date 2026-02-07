import { useEffect, useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { getISTDateString } from "../utils/time";
import { travelLogService, TravelContext } from "../utils/travelLogService";

type Denoms = {
  denom_100: number;
  denom_200: number;
  denom_500: number;
  denom_2000: number;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_code: string | null;
  branch_name: string | null;
  branch_phone: string | null;
  branch_email: string | null;
  branch_address: string | null;
};

const EMPTY_DENOMS: Denoms = {
  denom_100: 0,
  denom_200: 0,
  denom_500: 0,
  denom_2000: 0,
};

function denomTotal(denoms: Denoms) {
  return (
    denoms.denom_100 * 100 +
    denoms.denom_200 * 200 +
    denoms.denom_500 * 500 +
    denoms.denom_2000 * 2000
  );
}

export default function DenominationExchange() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [soaId, setSoaId] = useState<number | null>(null);
  const [loadingAssignment, setLoadingAssignment] = useState(true);
  const [loadingSOA, setLoadingSOA] = useState(false);

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);

  const [fromBankId, setFromBankId] = useState("");
  const [toBankId, setToBankId] = useState("");
  const [reason, setReason] = useState("Denomination exchange");
  const [reference, setReference] = useState("");

  const [fromDenoms, setFromDenoms] = useState<Denoms>(EMPTY_DENOMS);
  const [toDenoms, setToDenoms] = useState<Denoms>(EMPTY_DENOMS);

  const [availableFromDenoms, setAvailableFromDenoms] = useState<Denoms | null>(null);
  const [availableFromTotal, setAvailableFromTotal] = useState(0);
  const [availableFromLoading, setAvailableFromLoading] = useState(false);
  const [availableFromError, setAvailableFromError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  useEffect(() => {
    if (!profile) return;

    async function loadAssignment() {
      setLoadingAssignment(true);
      setError(null);

      const today = getISTDateString();

      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .single();

      if (assignmentError || !assignment) {
        setError("No active assignment found for today.");
        setAssignmentId(null);
        setLoadingAssignment(false);
        return;
      }

      setAssignmentId(assignment.id);
      setLoadingAssignment(false);
    }

    loadAssignment();
  }, [profile]);

  useEffect(() => {
    async function loadBankAccounts() {
      setBanksLoading(true);
      setBanksError(null);

      try {
        const { data, error: banksError } = await supabase
          .from("bank_accounts")
          .select("*")
          .eq("is_active", true)
          .order("bank_name", { ascending: true });

        if (banksError) {
          console.error("Error loading banks:", banksError);
          setBanksError("Could not load bank list. Please refresh.");
          setBankAccounts([]);
        } else {
          setBankAccounts(data || []);
        }
      } catch (err) {
        console.error("Error:", err);
        setBanksError("Error loading bank accounts");
        setBankAccounts([]);
      } finally {
        setBanksLoading(false);
      }
    }

    loadBankAccounts();
  }, []);

  useEffect(() => {
    if (!assignmentId) return;

    async function loadSOAId() {
      setLoadingSOA(true);
      setError(null);

      const { data, error: soaError } = await supabase
        .from("v_soa_effective")
        .select("soa_id")
        .eq("assignment_id", assignmentId)
        .maybeSingle();

      if (soaError || !data) {
        setWarning(
          "SOA view not available yet for this assignment. Using assignment ID for posting."
        );
        setSoaId(assignmentId);
        setLoadingSOA(false);
        return;
      }

      setSoaId(data.soa_id);
      setWarning(null);
      setLoadingSOA(false);
    }

    loadSOAId();
  }, [assignmentId]);

  const fromTotal = useMemo(() => denomTotal(fromDenoms), [fromDenoms]);
  const toTotal = useMemo(() => denomTotal(toDenoms), [toDenoms]);

  const selectedFromBank = bankAccounts.find((b) => b.id === fromBankId);
  const selectedToBank = bankAccounts.find((b) => b.id === toBankId);

  useEffect(() => {
    if (!assignmentId || !selectedFromBank?.bank_name) {
      setAvailableFromDenoms(null);
      setAvailableFromTotal(0);
      setAvailableFromError(null);
      return;
    }

    async function loadAvailableFromBank() {
      setAvailableFromLoading(true);
      setAvailableFromError(null);

      const { data, error: pickupError } = await supabase
        .from("cash_pickups")
        .select("denom_2000, denom_500, denom_200, denom_100")
        .eq("assignment_id", assignmentId)
        .eq("bank_name", selectedFromBank.bank_name);

      if (pickupError) {
        console.warn("Failed to load bank pickups:", pickupError);
        setAvailableFromDenoms(null);
        setAvailableFromTotal(0);
        setAvailableFromError("Unable to load picked denominations for this bank.");
        setAvailableFromLoading(false);
        return;
      }

      const totals = (data || []).reduce(
        (acc: Denoms, row: any) => {
          acc.denom_100 += row.denom_100 || 0;
          acc.denom_200 += row.denom_200 || 0;
          acc.denom_500 += row.denom_500 || 0;
          acc.denom_2000 += row.denom_2000 || 0;
          return acc;
        },
        { ...EMPTY_DENOMS }
      );

      setAvailableFromDenoms(totals);
      setAvailableFromTotal(denomTotal(totals));
      setAvailableFromLoading(false);
    }

    loadAvailableFromBank();
  }, [assignmentId, selectedFromBank?.bank_name]);

  const canSubmit =
    !saving &&
    !submitLocked &&
    assignmentId &&
    soaId &&
    fromBankId &&
    toBankId &&
    reason.trim().length > 0 &&
    fromTotal > 0 &&
    fromTotal === toTotal;

  async function handleSubmit() {
    if (!canSubmit || !profile) return;

    setSaving(true);
    setError(null);
    setWarning(null);
    setSuccess(null);

    const fromLabel = selectedFromBank?.bank_name || "bank";
    const toLabel = selectedToBank?.bank_name || "bank";

    try {
      const { error: insertError } = await supabase
        .from("soa_adjustments")
        .insert({
          soa_id: assignmentId,
          assignment_id: assignmentId,
          custodian_id: profile.id,
          adjustment_type: "EXCHANGE",
          adjustment_amount: 0,
          reason: reason.trim(),
          reference: reference.trim() || null,
          created_by: profile.id,
          exchange_metadata: {
            from_bank_id: selectedFromBank?.id || null,
            to_bank_id: selectedToBank?.id || null,
            from_bank_name: selectedFromBank?.bank_name || "",
            to_bank_name: selectedToBank?.bank_name || "",
            from_account_number: selectedFromBank?.account_number || "",
            to_account_number: selectedToBank?.account_number || "",
            from_denominations: fromDenoms,
            to_denominations: toDenoms,
            total_amount: fromTotal,
            exchange_time: new Date().toISOString(),
          },
        });

      if (insertError) {
        setError(insertError.message || "Failed to record exchange.");
        setSaving(false);
        return;
      }

      try {
        if (assignmentId && profile?.id) {
          await travelLogService.triggerCheckpoint({
            assignmentId,
            custodianId: profile.id,
            vehicleType: "bike",
            context: TravelContext.MANUAL,
          });
        }
      } catch (err) {
        console.warn("[DenominationExchange] Travel log trigger failed:", err);
      }

      setSubmitLocked(true);
      setSuccess("Exchange recorded successfully.");
      setConfirmMessage(
        `Exchange recorded successfully from ${fromLabel} to ${toLabel}.`
      );
      setShowConfirm(true);
    } catch (err) {
      setError("Unexpected error while saving exchange.");
    } finally {
      setSaving(false);
    }
  }

  function resetForm() {
    setFromBankId("");
    setToBankId("");
    setReason("Denomination exchange");
    setReference("");
    setFromDenoms(EMPTY_DENOMS);
    setToDenoms(EMPTY_DENOMS);
    setSubmitLocked(false);
  }

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            Denomination Exchange
          </h1>
          <p className="text-sm text-slate-600">
            Record denomination swaps without changing net cash position.
          </p>
        </div>

        {loadingAssignment || loadingSOA ? (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            Loading assignment details…
          </div>
        ) : null}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {warning && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            ⚠️ {warning}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700">
            ✅ {success}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                From Bank <span className="text-red-600">*</span>
              </label>
              {banksLoading ? (
                <div className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-500">
                  Loading banks...
                </div>
              ) : bankAccounts.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  No bank accounts available.
                </div>
              ) : (
                <select
                  value={fromBankId}
                  onChange={(e) => setFromBankId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Select a bank account --</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bank_name} ({bank.account_number})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                To Bank <span className="text-red-600">*</span>
              </label>
              {banksLoading ? (
                <div className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-500">
                  Loading banks...
                </div>
              ) : bankAccounts.length === 0 ? (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  No bank accounts available.
                </div>
              ) : (
                <select
                  value={toBankId}
                  onChange={(e) => setToBankId(e.target.value)}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">-- Select a bank account --</option>
                  {bankAccounts.map((bank) => (
                    <option key={bank.id} value={bank.id}>
                      {bank.bank_name} ({bank.account_number})
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {banksError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              ⚠️ {banksError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Reason <span className="text-red-600">*</span>
              </label>
              <input
                className="input w-full"
                placeholder="Reason for exchange"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">
                Reference (Optional)
              </label>
              <input
                className="input w-full"
                placeholder="Reference ID or note"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                From Denominations
              </h2>
              <span className="text-sm font-semibold text-slate-600">
                ₹{fromTotal.toLocaleString("en-IN")}
              </span>
            </div>
            {availableFromLoading ? (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-xs text-slate-600">
                Loading picked denominations...
              </div>
            ) : availableFromError ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                ⚠️ {availableFromError}
              </div>
            ) : availableFromDenoms ? (
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">
                      Picked From Bank (Today)
                    </p>
                    <p className="text-xs text-slate-600">
                      Use this as a reference while entering the exchange.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-indigo-900 bg-indigo-100 px-2 py-1 rounded">
                    ₹{availableFromTotal.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    ["denom_100", 100],
                    ["denom_200", 200],
                    ["denom_500", 500],
                    ["denom_2000", 2000],
                  ].map(([key, value]) => (
                    <div
                      key={key}
                      className="rounded-md border border-indigo-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs text-slate-500">₹{value}</div>
                      <div className="text-sm font-semibold text-indigo-900">
                        {(availableFromDenoms as any)[key] || 0}
                      </div>
                      <div className="text-xs text-slate-500">
                        ₹{(((availableFromDenoms as any)[key] || 0) * value).toLocaleString(
                          "en-IN"
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            <DenominationFields
              values={fromDenoms}
              onChange={(name, value) =>
                setFromDenoms({
                  ...fromDenoms,
                  [name]: value,
                })
              }
            />
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                To Denominations
              </h2>
              <span className="text-sm font-semibold text-slate-600">
                ₹{toTotal.toLocaleString("en-IN")}
              </span>
            </div>
            <DenominationFields
              values={toDenoms}
              onChange={(name, value) =>
                setToDenoms({
                  ...toDenoms,
                  [name]: value,
                })
              }
            />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Exchange Validation</span>
            <span
              className={`font-semibold ${
                fromTotal > 0 && fromTotal === toTotal
                  ? "text-green-600"
                  : "text-amber-600"
              }`}
            >
              {fromTotal === 0
                ? "Enter denominations to proceed"
                : fromTotal === toTotal
                ? "Balanced exchange"
                : "Totals must match"}
            </span>
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full btn-primary"
          >
            {saving ? "Saving…" : "Record Exchange"}
          </button>
        </div>
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Exchange Saved"
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
