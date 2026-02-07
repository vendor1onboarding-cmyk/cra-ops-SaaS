import { useEffect, useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import ConfirmationModal from "../components/ConfirmationModal";
import { getISTDateString } from "../utils/time";

type SiteOption = {
  site_id: number;
  display_label: string;
};

type BankAccount = {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_code: string | null;
  branch_name: string | null;
};

type DenomPlan = {
  denom_2000: number;
  denom_500: number;
  denom_200: number;
  denom_100: number;
  denom_50: number;
  denom_20: number;
  denom_10: number;
  remarks: string;
  has_source_report: boolean;
};

const EMPTY_PLAN: DenomPlan = {
  denom_2000: 0,
  denom_500: 0,
  denom_200: 0,
  denom_100: 0,
  denom_50: 0,
  denom_20: 0,
  denom_10: 0,
  remarks: "",
  has_source_report: true,
};

function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

function normalizePlan(row: any): DenomPlan {
  return {
    denom_2000: row?.denom_2000 || 0,
    denom_500: row?.denom_500 || 0,
    denom_200: row?.denom_200 || 0,
    denom_100: row?.denom_100 || 0,
    denom_50: row?.denom_50 || 0,
    denom_20: row?.denom_20 || 0,
    denom_10: row?.denom_10 || 0,
    remarks: row?.remarks || "",
    has_source_report: row?.has_source_report ?? true,
  };
}

function planTotal(plan: DenomPlan) {
  return (
    plan.denom_2000 * 2000 +
    plan.denom_500 * 500 +
    plan.denom_200 * 200 +
    plan.denom_100 * 100 +
    plan.denom_50 * 50 +
    plan.denom_20 * 20 +
    plan.denom_10 * 10
  );
}

function planDenomValues(plan: DenomPlan) {
  return {
    denom_100: plan.denom_100,
    denom_200: plan.denom_200,
    denom_500: plan.denom_500,
    denom_2000: plan.denom_2000,
  };
}

export default function DenominationPlan() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [siteToAdd, setSiteToAdd] = useState<number | "">("");
  const [selectedSites, setSelectedSites] = useState<number[]>([]);
  const [sitePlans, setSitePlans] = useState<Record<number, DenomPlan>>({});
  const [existingPlans, setExistingPlans] = useState<Record<number, DenomPlan>>({});

  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  const [bankToAdd, setBankToAdd] = useState<string>("");
  const [selectedBanks, setSelectedBanks] = useState<string[]>([]);
  const [bankPlans, setBankPlans] = useState<Record<string, DenomPlan>>({});
  const [existingBankPlans, setExistingBankPlans] = useState<Record<string, DenomPlan>>({});

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
  // Load existing site plans
  // --------------------------------------------------
  useEffect(() => {
    if (!assignmentId) return;

    async function loadExistingPlans() {
      const { data, error } = await supabase
        .from("denomination_plans")
        .select("*")
        .eq("assignment_id", assignmentId);

      if (error) {
        console.warn("Failed to load denomination plans:", error);
        setExistingPlans({});
        return;
      }

      const mapped = (data || []).reduce((acc: Record<number, DenomPlan>, row: any) => {
        acc[row.site_id] = normalizePlan(row);
        return acc;
      }, {});

      setExistingPlans(mapped);
    }

    loadExistingPlans();
  }, [assignmentId]);

  // --------------------------------------------------
  // Load bank accounts + existing bank plans
  // --------------------------------------------------
  useEffect(() => {
    async function loadBankAccounts() {
      setBanksLoading(true);
      setBanksError(null);

      try {
        const { data, error } = await supabase
          .from("bank_accounts")
          .select("id, bank_name, account_number, ifsc_code, branch_code, branch_name")
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

    loadBankAccounts();
  }, []);

  useEffect(() => {
    if (!assignmentId) return;

    async function loadExistingBankPlans() {
      const { data, error } = await supabase
        .from("bank_denomination_plans")
        .select("*")
        .eq("assignment_id", assignmentId);

      if (error) {
        console.warn("Failed to load bank denomination plans:", error);
        setExistingBankPlans({});
        return;
      }

      const mapped = (data || []).reduce((acc: Record<string, DenomPlan>, row: any) => {
        acc[row.bank_account_id] = normalizePlan(row);
        return acc;
      }, {});

      setExistingBankPlans(mapped);
    }

    loadExistingBankPlans();
  }, [assignmentId]);

  // --------------------------------------------------
  // Plan manipulation
  // --------------------------------------------------
  function addSite(siteId: number) {
    if (selectedSites.includes(siteId)) return;
    setSelectedSites((prev) => [...prev, siteId]);
    setSitePlans((prev) => ({
      ...prev,
      [siteId]: existingPlans[siteId] ? { ...existingPlans[siteId] } : { ...EMPTY_PLAN },
    }));
  }

  function removeSite(siteId: number) {
    setSelectedSites((prev) => prev.filter((id) => id !== siteId));
    setSitePlans((prev) => {
      const next = { ...prev };
      delete next[siteId];
      return next;
    });
  }

  function addAllSites() {
    const allIds = sites.map((s) => s.site_id);
    setSelectedSites(allIds);
    setSitePlans((prev) => {
      const next = { ...prev };
      allIds.forEach((id) => {
        if (!next[id]) {
          next[id] = existingPlans[id] ? { ...existingPlans[id] } : { ...EMPTY_PLAN };
        }
      });
      return next;
    });
  }

  function addBank(bankId: string) {
    if (selectedBanks.includes(bankId)) return;
    setSelectedBanks((prev) => [...prev, bankId]);
    setBankPlans((prev) => ({
      ...prev,
      [bankId]: existingBankPlans[bankId]
        ? { ...existingBankPlans[bankId] }
        : { ...EMPTY_PLAN },
    }));
  }

  function removeBank(bankId: string) {
    setSelectedBanks((prev) => prev.filter((id) => id !== bankId));
    setBankPlans((prev) => {
      const next = { ...prev };
      delete next[bankId];
      return next;
    });
  }

  // --------------------------------------------------
  // Save plan
  // --------------------------------------------------
  function resetForm() {
    setSiteToAdd("");
    setSelectedSites([]);
    setSitePlans({});
    setBankToAdd("");
    setSelectedBanks([]);
    setBankPlans({});
    setSubmitLocked(false);
  }

  async function handleSaveAll() {
    if (loading || submitLocked) return;
    if (!assignmentId) return;

    const siteCount = selectedSites.length;
    const bankCount = selectedBanks.length;

    if (siteCount === 0 && bankCount === 0) {
      setMessage("Add at least one site or bank to save a plan.");
      return;
    }

    setLoading(true);
    setMessage(null);

    let siteError: string | null = null;
    let bankError: string | null = null;

    if (siteCount > 0) {
      const siteRows = selectedSites.map((siteId) => ({
        assignment_id: assignmentId,
        site_id: siteId,
        ...(sitePlans[siteId] || EMPTY_PLAN),
      }));

      const { error } = await supabase
        .from("denomination_plans")
        .upsert(siteRows, { onConflict: "assignment_id,site_id" });

      if (error) {
        siteError = "Failed to save site denomination plans";
      }
    }

    if (bankCount > 0) {
      const bankRows = selectedBanks.map((bankId) => ({
        assignment_id: assignmentId,
        bank_account_id: bankId,
        ...(bankPlans[bankId] || EMPTY_PLAN),
      }));

      const { error } = await supabase
        .from("bank_denomination_plans")
        .upsert(bankRows, { onConflict: "assignment_id,bank_account_id" });

      if (error) {
        bankError = "Failed to save bank withdrawal plan";
      }
    }

    if (siteError || bankError) {
      setMessage([siteError, bankError].filter(Boolean).join(". "));
      setLoading(false);
      return;
    }

    setSubmitLocked(true);
    setConfirmMessage(
      `Denomination plan saved for ${siteCount} site${siteCount === 1 ? "" : "s"}` +
        ` and ${bankCount} bank${bankCount === 1 ? "" : "s"}.`
    );
    setShowConfirm(true);
    setLoading(false);
  }

  const aggregatedSiteDenoms = useMemo(() => {
    return selectedSites.reduce(
      (acc, siteId) => {
        const plan = sitePlans[siteId] || EMPTY_PLAN;
        acc.denom_100 += plan.denom_100;
        acc.denom_200 += plan.denom_200;
        acc.denom_500 += plan.denom_500;
        acc.denom_2000 += plan.denom_2000;
        return acc;
      },
      { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 }
    );
  }, [selectedSites, sitePlans]);

  const aggregatedSiteTotal =
    aggregatedSiteDenoms.denom_100 * 100 +
    aggregatedSiteDenoms.denom_200 * 200 +
    aggregatedSiteDenoms.denom_500 * 500 +
    aggregatedSiteDenoms.denom_2000 * 2000;

  const aggregatedBankTotal = useMemo(() => {
    return selectedBanks.reduce((sum, bankId) => {
      const plan = bankPlans[bankId] || EMPTY_PLAN;
      return sum + planTotal(plan);
    }, 0);
  }, [selectedBanks, bankPlans]);

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            Denomination Planning
          </h2>
          <p className="text-sm text-slate-600">
            Plan denomination breakdowns across multiple sites and banks in one view.
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
              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Add Site to Plan
                  </label>
                  <select
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    value={siteToAdd}
                    onChange={(e) => setSiteToAdd(Number(e.target.value) || "")}
                  >
                    <option value="">-- Select a Site --</option>
                    {sites.map((s) => (
                      <option key={s.site_id} value={s.site_id}>
                        {s.display_label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => siteToAdd && addSite(Number(siteToAdd))}
                  className="bg-primary text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-700 active:scale-95"
                >
                  Add Site
                </button>
                <button
                  type="button"
                  onClick={addAllSites}
                  className="border border-slate-300 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Add All Sites
                </button>
              </div>

              {selectedSites.length === 0 && (
                <p className="text-xs text-slate-500">
                  Select one or more sites to start planning.
                </p>
              )}
            </div>

            {selectedSites.length > 0 && (
              <div className="space-y-4">
                {selectedSites.map((siteId) => {
                  const siteLabel = sites.find((s) => s.site_id === siteId)?.display_label;
                  const plan = sitePlans[siteId] || EMPTY_PLAN;

                  return (
                    <div
                      key={siteId}
                      className="bg-white rounded-lg border border-slate-200 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h3 className="text-base font-semibold text-slate-800">
                            {siteLabel || "Site"}
                          </h3>
                          <p className="text-xs text-slate-500">
                            Planned Total: ₹{planTotal(plan).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeSite(siteId)}
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </div>

                      <DenominationFields
                        values={planDenomValues(plan)}
                        onChange={(name, value) =>
                          setSitePlans((prev) => ({
                            ...prev,
                            [siteId]: {
                              ...(prev[siteId] || EMPTY_PLAN),
                              [name]: value,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {selectedSites.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-blue-700 font-semibold">
                      Total Planned (All Sites)
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Consolidated denomination requirement for your route.
                    </p>
                  </div>
                  <span className="text-lg font-bold text-primary">
                    ₹{aggregatedSiteTotal.toLocaleString("en-IN")}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
                  {[100, 200, 500, 2000].map((d) => (
                    <div
                      key={d}
                      className="rounded-md border border-blue-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs text-slate-500">₹{d}</div>
                      <div className="text-sm font-semibold text-blue-900">
                        {(aggregatedSiteDenoms as any)[`denom_${d}`]}
                      </div>
                      <div className="text-xs text-slate-500">
                        ₹{(((aggregatedSiteDenoms as any)[`denom_${d}`] || 0) * d).toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Bank Withdrawal Planning
                </h3>
                <p className="text-xs text-slate-500">
                  Map planned denominations to bank withdrawals in one view.
                </p>
              </div>

              {banksError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                  ⚠️ {banksError}
                </div>
              )}

              <div className="flex flex-col md:flex-row md:items-end gap-3">
                <div className="flex-1">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Add Bank Account
                  </label>
                  {banksLoading ? (
                    <div className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-500">
                      Loading banks...
                    </div>
                  ) : (
                    <select
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={bankToAdd}
                      onChange={(e) => setBankToAdd(e.target.value)}
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
                <button
                  type="button"
                  onClick={() => bankToAdd && addBank(bankToAdd)}
                  className="border border-slate-300 px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-slate-50"
                >
                  Add Bank
                </button>
              </div>

              {selectedBanks.length === 0 && (
                <p className="text-xs text-slate-500">
                  Select one or more banks to plan withdrawals.
                </p>
              )}
            </div>

            {selectedBanks.length > 0 && (
              <div className="space-y-4">
                {selectedBanks.map((bankId) => {
                  const bank = bankAccounts.find((b) => b.id === bankId);
                  const plan = bankPlans[bankId] || EMPTY_PLAN;
                  return (
                    <div
                      key={bankId}
                      className="bg-white rounded-lg border border-slate-200 p-5 space-y-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <h4 className="text-base font-semibold text-slate-800">
                            {bank?.bank_name || "Bank"}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {bank?.account_number}
                          </p>
                          <p className="text-xs text-slate-500">
                            Planned Total: ₹{planTotal(plan).toLocaleString("en-IN")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeBank(bankId)}
                          className="text-xs text-red-600"
                        >
                          Remove
                        </button>
                      </div>

                      <DenominationFields
                        values={planDenomValues(plan)}
                        onChange={(name, value) =>
                          setBankPlans((prev) => ({
                            ...prev,
                            [bankId]: {
                              ...(prev[bankId] || EMPTY_PLAN),
                              [name]: value,
                            },
                          }))
                        }
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {selectedBanks.length > 0 && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-emerald-700 font-semibold">
                      Total Planned (All Banks)
                    </p>
                    <p className="text-xs text-slate-600 mt-1">
                      Consolidated withdrawal plan across banks.
                    </p>
                  </div>
                  <span className="text-lg font-bold text-emerald-700">
                    ₹{aggregatedBankTotal.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSaveAll}
                disabled={loading || submitLocked}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
              >
                {loading ? "Saving..." : "Save Plan"}
              </button>
            </div>

            {message && (
              <p className="text-sm text-center p-3 rounded-lg bg-red-50 text-red-800 border border-red-200">
                {message}
              </p>
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
