import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { getISTDateString } from "../utils/time";
import { travelLogService, TravelContext } from "../utils/travelLogService";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_code: string | null;
  branch_name: string | null;
  branch_phone: string | null;
  branch_email: string | null;
  branch_address: string | null;
}

export default function CashPickup() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [expectedAmount, setExpectedAmount] = useState<number>(0);

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
  const [submitLocked, setSubmitLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);

  const [plannedDenoms, setPlannedDenoms] = useState<
    | {
        denom_100: number;
        denom_200: number;
        denom_500: number;
        denom_2000: number;
      }
    | null
  >(null);
  const [plannedLoading, setPlannedLoading] = useState(false);
  const [plannedError, setPlannedError] = useState<string | null>(null);

  const today = getISTDateString();

  // --------------------------------------------------
  // Load TODAY's assignment ONLY (NO FALLBACK)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadTodayAssignment() {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .eq("status", "open")
        .maybeSingle();

      if (!assignment) {
        setAssignmentId(null);
        return;
      }

      setAssignmentId(assignment.id);
    }

    loadTodayAssignment();
  }, [profile]);

  // --------------------------------------------------
  // Load bank accounts
  // --------------------------------------------------
  useEffect(() => {
    loadBankAccounts();
  }, []);

  async function loadBankAccounts() {
    setBanksLoading(true);
    setBanksError(null);

    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("bank_name", { ascending: true });

      if (error) {
        console.error("Error loading banks:", error);
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

  // Get selected bank details
  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

  // --------------------------------------------------
  // Load planned bank denominations (for comparison)
  // --------------------------------------------------
  useEffect(() => {
    if (!assignmentId || !selectedBankId) {
      setPlannedDenoms(null);
      setPlannedError(null);
      return;
    }

    async function loadPlannedDenoms() {
      setPlannedLoading(true);
      setPlannedError(null);

      const { data, error } = await supabase
        .from("bank_denomination_plans")
        .select("denom_2000, denom_500, denom_200, denom_100")
        .eq("assignment_id", assignmentId)
        .eq("bank_account_id", selectedBankId)
        .maybeSingle();

      if (error) {
        console.warn("[CashPickup] Failed to load bank plan:", error);
        setPlannedError("Failed to load planned denominations");
        setPlannedDenoms(null);
        setPlannedLoading(false);
        return;
      }

      if (data) {
        setPlannedDenoms({
          denom_100: data.denom_100 || 0,
          denom_200: data.denom_200 || 0,
          denom_500: data.denom_500 || 0,
          denom_2000: data.denom_2000 || 0,
        });
      } else {
        setPlannedDenoms(null);
      }

      setPlannedLoading(false);
    }

    loadPlannedDenoms();
  }, [assignmentId, selectedBankId]);

  // --------------------------------------------------
  // Calculate totals
  // --------------------------------------------------
  const totalAmount =
    form.denom_2000 * 2000 +
    form.denom_500 * 500 +
    form.denom_200 * 200 +
    form.denom_100 * 100;

  const variance = totalAmount - expectedAmount;

  const plannedTotal = plannedDenoms
    ? plannedDenoms.denom_2000 * 2000 +
      plannedDenoms.denom_500 * 500 +
      plannedDenoms.denom_200 * 200 +
      plannedDenoms.denom_100 * 100
    : 0;

  // --------------------------------------------------
  // Save (UPSERT – one pickup per bank per day)
  // --------------------------------------------------
  function resetForm() {
    setSelectedBankId("");
    setExpectedAmount(0);
    setForm({
      denom_2000: 0,
      denom_500: 0,
      denom_200: 0,
      denom_100: 0,
      denom_50: 0,
      denom_20: 0,
      denom_10: 0,
    });
    setSubmitLocked(false);
  }

  async function handleSave() {
    if (loading || submitLocked) return;
    if (!assignmentId || !selectedBankId) {
      setMessage("Assignment or Bank selection missing");
      return;
    }

    setLoading(true);
    setMessage(null);

    const bankName = selectedBank?.bank_name || "";

    const { error } = await supabase
      .from("cash_pickups")
      .upsert(
        {
          assignment_id: assignmentId,
          bank_name: bankName,
          branch: selectedBank?.branch_name || selectedBank?.branch_code || "",
          pickup_time: new Date().toISOString(),
          expected_amount: expectedAmount,
          total_amount: totalAmount,
          variance,
          ...form,
        },
        {
          onConflict: "assignment_id,bank_name",
        }
      );

    if (error) {
      console.error(error);
      setMessage("Failed to save cash pickup");
    } else {
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
        console.warn("[CashPickup] Travel log trigger failed:", err);
      }
      setSubmitLocked(true);
      setConfirmMessage(
        `Cash pickup saved successfully for ${selectedBank?.bank_name || "bank"}.`
      );
      setShowConfirm(true);
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            Cash Pickup
          </h2>
          <p className="text-sm text-slate-600">
            Record cash pickup details from banks
          </p>
        </div>

        {!assignmentId && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <span className="font-semibold">ℹ️ No assignment available</span> for today.
          </div>
        )}

        {assignmentId && (
          <>
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              {banksError && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <span className="font-semibold">⚠️ {banksError}</span>
                </div>
              )}

              {/* Bank Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Bank Account <span className="text-red-500">*</span>
                </label>
                {banksLoading ? (
                  <div className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-500">
                    Loading banks...
                  </div>
                ) : bankAccounts.length === 0 ? (
                  <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                    <p className="font-semibold mb-2">ℹ️ No bank accounts available</p>
                    <p className="text-xs">Contact admin to onboard bank accounts</p>
                  </div>
                ) : (
                  <select
                    value={selectedBankId}
                    onChange={(e) => setSelectedBankId(e.target.value)}
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

              {/* Auto-filled Bank Details */}
              {selectedBank && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                  <h3 className="text-sm font-semibold text-slate-800">
                    Account Details
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-xs font-semibold text-slate-600">
                        Account Number
                      </span>
                      <div className="font-mono text-slate-800">
                        {selectedBank.account_number}
                      </div>
                    </div>

                    <div>
                      <span className="text-xs font-semibold text-slate-600">
                        IFSC Code
                      </span>
                      <div className="font-mono text-slate-800">
                        {selectedBank.ifsc_code}
                      </div>
                    </div>

                    {selectedBank.branch_name && (
                      <div>
                        <span className="text-xs font-semibold text-slate-600">
                          Branch
                        </span>
                        <div className="text-slate-800">
                          {selectedBank.branch_name}
                        </div>
                      </div>
                    )}

                    {selectedBank.branch_phone && (
                      <div>
                        <span className="text-xs font-semibold text-slate-600">
                          Branch Phone
                        </span>
                        <div className="text-slate-800">
                          {selectedBank.branch_phone}
                        </div>
                      </div>
                    )}
                  </div>

                  {selectedBank.branch_address && (
                    <div>
                      <span className="text-xs font-semibold text-slate-600">
                        Address
                      </span>
                      <div className="text-sm text-slate-800 mt-1">
                        {selectedBank.branch_address}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Expected Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={expectedAmount}
                  onChange={(e) =>
                    setExpectedAmount(Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Denomination Details
                </h3>
              </div>

              {plannedLoading ? (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                  Loading planned denominations...
                </div>
              ) : plannedError ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
                  ⚠️ {plannedError}
                </div>
              ) : plannedDenoms ? (
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">
                        Planned Denominations (Bank)
                      </p>
                      <p className="text-xs text-slate-600 mt-1">
                        Compare plan vs actual pickup while entering values.
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-indigo-900 bg-indigo-100 px-2 py-1 rounded">
                      ₹{plannedTotal.toLocaleString("en-IN")}
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
                          {(plannedDenoms as any)[key] || 0}
                        </div>
                        <div className="text-xs text-slate-500">
                          ₹{(((plannedDenoms as any)[key] || 0) * value).toLocaleString(
                            "en-IN"
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

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

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <span className="text-xs text-slate-600">Total Amount</span>
                  <div className="text-xl font-bold text-primary">
                    ₹{totalAmount.toLocaleString()}
                  </div>
                </div>

                <div className={`rounded-lg p-4 ${
                  variance === 0
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}>
                  <span className="text-xs text-slate-600">Variance</span>
                  <div className={`text-xl font-bold ${
                    variance === 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    ₹{variance.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSave}
                disabled={loading || submitLocked || !selectedBankId}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
              >
                {loading ? "Saving..." : "Save Cash Pickup"}
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
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Cash Pickup Saved"
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
