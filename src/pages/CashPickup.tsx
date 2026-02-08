import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { getISTDateString } from "../utils/time";
import { travelLogService, TravelContext } from "../utils/travelLogService";
import { ATMSiteSelector } from "../components/ATMSiteSelector";

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

interface SiteDenoms {
  denom_100: number;
  denom_200: number;
  denom_500: number;
  denom_2000: number;
}

interface ATMSite {
  id: number;
  bank_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
}

interface SelectedSite {
  site: ATMSite;
  denoms: SiteDenoms;
  available: SiteDenoms;
}

type SourceMode = "bank-only" | "bank-and-atm";

export default function CashPickup() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [expectedAmount, setExpectedAmount] = useState<number>(0);
  const [sourceMode, setSourceMode] = useState<SourceMode>("bank-only");
  const [selectedATMSites, setSelectedATMSites] = useState<SelectedSite[]>([]);

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
  const bankAmount =
    form.denom_2000 * 2000 +
    form.denom_500 * 500 +
    form.denom_200 * 200 +
    form.denom_100 * 100;

  const internalAmount = selectedATMSites.reduce((total, site) => {
    return (
      total +
      site.denoms.denom_100 * 100 +
      site.denoms.denom_200 * 200 +
      site.denoms.denom_500 * 500 +
      site.denoms.denom_2000 * 2000
    );
  }, 0);

  const totalAmount = sourceMode === "bank-only" ? bankAmount : bankAmount + internalAmount;

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
    setSourceMode("bank-only");
    setSelectedATMSites([]);
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

    // Construct internal_source_metadata for bank-and-atm mode
    let internalSourceMetadata = null;
    if (sourceMode === "bank-and-atm" && selectedATMSites.length > 0) {
      const sources = selectedATMSites.map((selected) => ({
        site_id: selected.site.id,
        site_name: selected.site.bank_name,
        denominations: {
          denom_100: selected.denoms.denom_100,
          denom_200: selected.denoms.denom_200,
          denom_500: selected.denoms.denom_500,
          denom_2000: selected.denoms.denom_2000,
        },
        total_amount:
          selected.denoms.denom_100 * 100 +
          selected.denoms.denom_200 * 200 +
          selected.denoms.denom_500 * 500 +
          selected.denoms.denom_2000 * 2000,
      }));

      internalSourceMetadata = {
        sources,
        total_internal_amount: internalAmount,
      };
    }

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
          internal_source_metadata: internalSourceMetadata,
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

              {/* Source Mode Selection */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Cash Pickup Source
                </label>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSourceMode("bank-only");
                      setSelectedATMSites([]);
                    }}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      sourceMode === "bank-only"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-700 border-slate-300 hover:border-primary"
                    }`}
                  >
                    Bank Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setSourceMode("bank-and-atm")}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-semibold border-2 transition-all ${
                      sourceMode === "bank-and-atm"
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-slate-700 border-slate-300 hover:border-primary"
                    }`}
                  >
                    Bank + Internal ATM
                  </button>
                </div>
                {sourceMode === "bank-and-atm" && (
                  <p className="text-xs text-slate-600 mt-2">
                    💡 You can pick up cash from both bank and internal ATM sites
                  </p>
                )}
              </div>
            </div>

            {/* Bank Denomination Details */}
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">
                  {sourceMode === "bank-and-atm" ? "Bank Cash Pickup" : "Denomination Details"}
                </h3>
                {sourceMode === "bank-and-atm" && (
                  <p className="text-xs text-slate-600">
                    Enter cash collected from the bank below
                  </p>
                )}
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
                          ₹{(((plannedDenoms as any)[key] || 0) * Number(value)).toLocaleString(
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
                  <span className="text-xs text-slate-600">
                    {sourceMode === "bank-and-atm" ? "Bank Amount" : "Total Amount"}
                  </span>
                  <div className="text-xl font-bold text-primary">
                    ₹{bankAmount.toLocaleString("en-IN")}
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
                    ₹{variance.toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            </div>

            {/* Internal ATM Sites Selector */}
            {sourceMode === "bank-and-atm" && assignmentId && (
              <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800 mb-1">
                    Internal ATM Cash Pickup
                  </h3>
                  <p className="text-xs text-slate-600">
                    Select ATM sites to transfer cash from (optional)
                  </p>
                </div>

                <ATMSiteSelector
                  assignmentId={assignmentId}
                  selectedSites={selectedATMSites}
                  onChange={setSelectedATMSites}
                />
              </div>
            )}

            {/* Combined Total Summary (for bank-and-atm mode) */}
            {sourceMode === "bank-and-atm" && (
              <div className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-300 rounded-lg p-5 space-y-4">
                <h3 className="text-lg font-semibold text-indigo-900 mb-3">
                  💰 Combined Cash Pickup Summary
                </h3>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Bank Cash:</span>
                    <span className="font-semibold text-slate-900">
                      ₹{bankAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-700">Internal ATM Cash:</span>
                    <span className="font-semibold text-slate-900">
                      ₹{internalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>

                  <div className="border-t border-indigo-300 my-2"></div>

                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-indigo-900">Grand Total:</span>
                    <span className="text-2xl font-bold text-indigo-900">
                      ₹{totalAmount.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>

                {selectedATMSites.length > 0 && (
                  <div className="bg-white bg-opacity-70 rounded-md p-3 mt-3">
                    <div className="text-xs font-semibold text-slate-700 mb-2">
                      Internal Sources ({selectedATMSites.length}):
                    </div>
                    <div className="space-y-1">
                      {selectedATMSites.map((site) => {
                        const siteTotal =
                          site.denoms.denom_100 * 100 +
                          site.denoms.denom_200 * 200 +
                          site.denoms.denom_500 * 500 +
                          site.denoms.denom_2000 * 2000;
                        return (
                          <div
                            key={site.site.id}
                            className="flex justify-between text-xs text-slate-600"
                          >
                            <span>• {site.site.bank_name}</span>
                            <span className="font-medium">
                              ₹{siteTotal.toLocaleString("en-IN")}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

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
