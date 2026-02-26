import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import { useAuth } from "../context/AuthContext";
import {
  formatISTDate,
  formatISTAudit,
} from "../utils/time";

const ADMIN_CORRECTION_TYPE = "ADMIN_CORRECTION";
const DENOM_SETS: Record<string, number[]> = {
  ATM_LOAD: [100, 200, 500, 2000],
  CASH_PICKUP: [10, 20, 50, 100, 200, 500, 2000],
  EXCHANGE: [100, 200, 500, 2000],
  INTER_SITE_TRANSFER: [100, 200, 500, 2000],
};

function sumDenoms(denoms: Record<string, number>, list: number[]) {
  return list.reduce((sum, d) => sum + (Number(denoms[`denom_${d}`]) || 0) * d, 0);
}

function normalizeDenoms(input: any, list: number[]) {
  const result: Record<string, number> = {};
  list.forEach((d) => {
    result[`denom_${d}`] = Number(input?.[`denom_${d}`] || 0);
  });
  return result;
}

type SOA = {
  id: number;
  assignment_id: number;
  custodian_id: string;
  assignment_date: string;
  final_net_cash_position: number;
  full_name?: string;
};

type Adjustment = {
  id: number;
  assignment_id: number;
  custodian_id: string;
  adjustment_type: "EXCHANGE" | "INTER_SITE_TRANSFER" | "CREDIT" | "DEBIT";
  adjustment_amount: number;
  reason: string;
  reference?: string | null;
  created_at: string;
  created_by?: string | null;
  exchange_metadata?: any;
  transfer_metadata?: any;
  requires_custodian_confirmation?: boolean;
  custodian_confirmed?: boolean;
  custodian_confirmed_at?: string | null;
  custodian_signature_url?: string | null;
  original_reference_snapshot?: any;
  custodian_name?: string;
  created_by_name?: string;
};

export default function AdminSOAAdjustments() {
  const { profile } = useAuth();

  const [soaList, setSoaList] = useState<SOA[]>([]);
  const [selectedSOA, setSelectedSOA] = useState<SOA | null>(null);

  const [initialLoad, setInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [adjustmentsLoading, setAdjustmentsLoading] = useState(false);
  const [typeFilter, setTypeFilter] = useState<
    "ALL" | "EXCHANGE" | "INTER_SITE_TRANSFER" | "CREDIT" | "DEBIT"
  >("ALL");
  const [onlySelectedAssignment, setOnlySelectedAssignment] = useState(false);
  const [includeLegacyAdjustments, setIncludeLegacyAdjustments] = useState(false);

  const [correctionRefType, setCorrectionRefType] = useState<
    "ATM_LOAD" | "CASH_PICKUP" | "EXCHANGE" | "INTER_SITE_TRANSFER"
  >("ATM_LOAD");
  const [correctionRefId, setCorrectionRefId] = useState<string>("");
  const [correctionDelta, setCorrectionDelta] = useState<Record<string, number>>({
    denom_10: 0,
    denom_20: 0,
    denom_50: 0,
    denom_100: 0,
    denom_200: 0,
    denom_500: 0,
    denom_2000: 0,
  });
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [correctionError, setCorrectionError] = useState<string | null>(null);
  const [correctionSuccess, setCorrectionSuccess] = useState<string | null>(null);
  const [referenceOptions, setReferenceOptions] = useState<any[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(false);

  // =========================
  // ROLE GUARD + LOAD SOA
  // =========================
  const loadSOA = useCallback(async () => {
    if (!profile || !["admin", "supervisor"].includes(profile.role)) return;

    setInitialLoad(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from("v_soa_effective")
        .select(
          `soa_id,
          assignment_id,
          custodian_id,
          assignment_date,
          final_net_cash_position`
        )
        .order("assignment_date", { ascending: false });

      if (queryError) {
        setError("Failed to load SOA records. Please try again.");
        console.error("Query Error:", queryError);
        setSoaList([]);
      } else {
        const custodianIds = [
          ...new Set((data || []).map((row: any) => row.custodian_id)),
        ];

        let custodianMap: { [key: string]: string } = {};
        if (custodianIds.length > 0) {
          const { data: custodians } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", custodianIds);

          if (custodians) {
            custodians.forEach((c: any) => {
              custodianMap[c.id] = c.full_name;
            });
          }
        }

        const processedData = (data || []).map((row: any) => ({
          id: row.soa_id,
          ...row,
          full_name: custodianMap[row.custodian_id] || "Unknown",
        }));
        setSoaList(processedData);
      }
    } catch (err) {
      setError("An unexpected error occurred.");
      console.error("Unexpected Error:", err);
      setSoaList([]);
    } finally {
      setInitialLoad(false);
    }
  }, [profile]);

  const loadReferenceOptions = useCallback(async () => {
    if (!selectedSOA) {
      setReferenceOptions([]);
      setCorrectionRefId("");
      return;
    }

    setReferenceLoading(true);
    setCorrectionError(null);

    try {
      console.log(`Loading ${correctionRefType} records for assignment ${selectedSOA.assignment_id}`);
      
      if (correctionRefType === "ATM_LOAD") {
        const { data, error } = await supabase
          .from("atm_replenishments")
          .select("id, time_in, site_id, denom_100, denom_200, denom_500, denom_2000")
          .eq("assignment_id", selectedSOA.assignment_id)
          .order("time_in", { ascending: false });

        if (error) {
          console.error("ATM Load Query Error:", error);
          setCorrectionError(`Failed to load ATM loads: ${error.message}`);
          setReferenceOptions([]);
        } else {
          console.log(`Found ${(data || []).length} ATM loads`);
          setReferenceOptions(
            (data || []).map((row: any) => ({
              id: row.id,
              label: `ATM Load #${row.id} • ${formatISTDate(row.time_in, "short")}`,
              data: row,
            }))
          );
        }
      } else if (correctionRefType === "CASH_PICKUP") {
        const { data, error } = await supabase
          .from("cash_pickups")
          .select("id, pickup_time, bank_name, branch, denom_10, denom_20, denom_50, denom_100, denom_200, denom_500, denom_2000")
          .eq("assignment_id", selectedSOA.assignment_id)
          .order("pickup_time", { ascending: false });

        if (error) {
          console.error("Cash Pickup Query Error:", error);
          setCorrectionError(`Failed to load cash pickups: ${error.message}`);
          setReferenceOptions([]);
        } else {
          console.log(`Found ${(data || []).length} cash pickups`);
          setReferenceOptions(
            (data || []).map((row: any) => ({
              id: row.id,
              label: `Cash Pickup #${row.id} • ${formatISTDate(row.pickup_time, "short")}`,
              data: row,
            }))
          );
        }
      } else if (correctionRefType === "EXCHANGE") {
        const { data, error } = await supabase
          .from("soa_adjustments")
          .select("id, exchange_metadata, created_at")
          .eq("assignment_id", selectedSOA.assignment_id)
          .eq("adjustment_type", "EXCHANGE")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Exchange Query Error:", error);
          setCorrectionError(`Failed to load exchanges: ${error.message}`);
          setReferenceOptions([]);
        } else {
          console.log(`Found ${(data || []).length} exchanges`);
          setReferenceOptions(
            (data || []).map((row: any) => ({
              id: row.id,
              label: `Exchange #${row.id} • ${formatISTDate(row.created_at, "short")}`,
              data: row,
            }))
          );
        }
      } else {
        const { data, error } = await supabase
          .from("soa_adjustments")
          .select("id, transfer_metadata, created_at")
          .eq("assignment_id", selectedSOA.assignment_id)
          .eq("adjustment_type", "INTER_SITE_TRANSFER")
          .order("created_at", { ascending: false });

        if (error) {
          console.error("Transfer Query Error:", error);
          setCorrectionError(`Failed to load transfers: ${error.message}`);
          setReferenceOptions([]);
        } else {
          console.log(`Found ${(data || []).length} transfers`);
          setReferenceOptions(
            (data || []).map((row: any) => ({
              id: row.id,
              label: `Transfer #${row.id} • ${formatISTDate(row.created_at, "short")}`,
              data: row,
            }))
          );
        }
      }
    } catch (err) {
      console.error("Failed to load reference records:", err);
      setCorrectionError(`Unexpected error: ${err instanceof Error ? err.message : String(err)}`);
      setReferenceOptions([]);
    } finally {
      setReferenceLoading(false);
    }
  }, [correctionRefType, selectedSOA]);

  const loadAdjustments = useCallback(async () => {
    if (!profile || !["admin", "supervisor"].includes(profile.role)) return;

    setAdjustmentsLoading(true);

    try {
      let query = supabase
        .from("soa_adjustments")
        .select(
          `id,
           assignment_id,
           custodian_id,
           adjustment_type,
           adjustment_amount,
           reason,
           reference,
           created_at,
           created_by,
           exchange_metadata,
           transfer_metadata,
           requires_custodian_confirmation,
           custodian_confirmed,
           custodian_confirmed_at,
           custodian_signature_url,
           original_reference_snapshot`
        )
        .order("created_at", { ascending: false })
        .limit(200);

      query = query.in("adjustment_type", [
        "EXCHANGE",
        "INTER_SITE_TRANSFER",
        "CREDIT",
        "DEBIT",
      ]);

      if (onlySelectedAssignment && selectedSOA) {
        query = query.eq("assignment_id", selectedSOA.assignment_id);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        console.error("Adjustments Query Error:", queryError);
        setAdjustments([]);
        return;
      }

      const custodianIds = [
        ...new Set((data || []).map((row: any) => row.custodian_id)),
      ];
      const creatorIds = [
        ...new Set((data || []).map((row: any) => row.created_by).filter(Boolean)),
      ];
      const allIds = [...new Set([...custodianIds, ...creatorIds])];

      let profileMap: { [key: string]: string } = {};
      if (allIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", allIds);

        if (profiles) {
          profiles.forEach((p: any) => {
            profileMap[p.id] = p.full_name;
          });
        }
      }

      const processed = (data || []).map((row: any) => ({
        ...row,
        custodian_name: profileMap[row.custodian_id] || "Unknown",
        created_by_name: row.created_by
          ? profileMap[row.created_by] || "Unknown"
          : "Unknown",
      }));

      const filtered = processed.filter((row: Adjustment) => {
        const isAdminCorrection =
          (row.adjustment_type === "CREDIT" || row.adjustment_type === "DEBIT") &&
          row.exchange_metadata?.type === ADMIN_CORRECTION_TYPE;
        const isLegacyCreditDebit =
          (row.adjustment_type === "CREDIT" || row.adjustment_type === "DEBIT") &&
          !isAdminCorrection;

        if (typeFilter !== "ALL") {
          if (typeFilter === "CREDIT" || typeFilter === "DEBIT") {
            return includeLegacyAdjustments
              ? row.adjustment_type === typeFilter
              : isAdminCorrection && row.adjustment_type === typeFilter;
          }
          return row.adjustment_type === typeFilter;
        }

        if (isLegacyCreditDebit) {
          return includeLegacyAdjustments;
        }

        return true;
      });

      setAdjustments(filtered);
    } catch (err) {
      console.error("Adjustments Load Error:", err);
      setAdjustments([]);
    } finally {
      setAdjustmentsLoading(false);
    }
  }, [includeLegacyAdjustments, onlySelectedAssignment, profile, selectedSOA, typeFilter]);

  useEffect(() => {
    loadSOA();
  }, [loadSOA]);

  useEffect(() => {
    loadAdjustments();
  }, [loadAdjustments]);

  useEffect(() => {
    loadReferenceOptions();
    setCorrectionRefId("");
    setCorrectionDelta({
      denom_10: 0,
      denom_20: 0,
      denom_50: 0,
      denom_100: 0,
      denom_200: 0,
      denom_500: 0,
      denom_2000: 0,
    });
  }, [loadReferenceOptions]);

  const typeMeta: Record<
    Adjustment["adjustment_type"],
    { label: string; badge: string }
  > = {
    CREDIT: {
      label: "Credit (Legacy)",
      badge: "bg-slate-100 text-slate-700",
    },
    DEBIT: {
      label: "Debit (Legacy)",
      badge: "bg-slate-100 text-slate-700",
    },
    EXCHANGE: {
      label: "Exchange",
      badge: "bg-amber-100 text-amber-800",
    },
    INTER_SITE_TRANSFER: {
      label: "Transfer",
      badge: "bg-blue-100 text-blue-800",
    },
  };

  function formatDenoms(denoms: Record<string, number> | undefined) {
    if (!denoms) return "-";
    const entries = Object.entries(denoms).filter(([, count]) => Number(count) !== 0);
    if (entries.length === 0) return "-";
    return entries
      .map(([key, count]) => {
        const denom = key.replace("denom_", "");
        const signed = Number(count);
        return `${signed} × ₹${denom}`;
      })
      .join(", ");
  }

  function getOperationalAmount(adj: Adjustment) {
    if (adj.adjustment_type === "EXCHANGE") {
      return adj.exchange_metadata?.total_amount ?? 0;
    }
    if (adj.adjustment_type === "INTER_SITE_TRANSFER") {
      return (
        adj.transfer_metadata?.total_amount ??
        adj.transfer_metadata?.source_total_amount ??
        0
      );
    }
    return adj.adjustment_amount;
  }

  const selectedReference = referenceOptions.find(
    (opt: any) => String(opt.id) === String(correctionRefId)
  );
  const activeDenoms = DENOM_SETS[correctionRefType] || DENOM_SETS.ATM_LOAD;

  function getReferenceDenoms(refType: string, refData: any) {
    if (!refData) return normalizeDenoms({}, activeDenoms);

    if (refType === "ATM_LOAD") {
      return normalizeDenoms(refData, activeDenoms);
    }

    if (refType === "CASH_PICKUP") {
      return normalizeDenoms(refData, activeDenoms);
    }

    if (refType === "EXCHANGE") {
      return normalizeDenoms(refData?.exchange_metadata?.from_denominations, activeDenoms);
    }

    return normalizeDenoms(refData?.transfer_metadata?.source_denominations, activeDenoms);
  }

  const originalDenoms = getReferenceDenoms(correctionRefType, selectedReference?.data);
  const deltaDenoms = normalizeDenoms(correctionDelta, activeDenoms);
  const effectiveDenoms = activeDenoms.reduce((acc: Record<string, number>, d) => {
    const key = `denom_${d}`;
    acc[key] = (originalDenoms[key] || 0) + (deltaDenoms[key] || 0);
    return acc;
  }, {});

  const originalTotal = sumDenoms(originalDenoms, activeDenoms);
  const deltaTotal = sumDenoms(deltaDenoms, activeDenoms);
  const effectiveTotal = originalTotal + deltaTotal;

  const isAdminCorrectionAdjustment = (adj: Adjustment) =>
    (adj.adjustment_type === "CREDIT" || adj.adjustment_type === "DEBIT") &&
    adj.exchange_metadata?.type === ADMIN_CORRECTION_TYPE;

  async function handleCreateCorrection() {
    if (!selectedSOA || !profile) return;
    if (!correctionRefId || !correctionReason.trim()) {
      setCorrectionError("Reference and reason are required.");
      return;
    }

    if (deltaTotal === 0) {
      setCorrectionError("Correction delta must not be zero.");
      return;
    }

    setCorrectionSubmitting(true);
    setCorrectionError(null);
    setCorrectionSuccess(null);

    const adjustmentType = deltaTotal >= 0 ? "CREDIT" : "DEBIT";
    const adjustmentAmount = Math.abs(deltaTotal);

    const metadata = {
      type: ADMIN_CORRECTION_TYPE,
      reference_type: correctionRefType,
      reference_id: correctionRefId,
      reference_label: selectedReference?.label || null,
      original_denominations: originalDenoms,
      delta_denominations: deltaDenoms,
      effective_denominations: effectiveDenoms,
      original_total: originalTotal,
      delta_total: deltaTotal,
      effective_total: effectiveTotal,
      notes: correctionNotes.trim() || null,
      created_at: new Date().toISOString(),
    };

    try {
      const { error: insertError } = await supabase
        .from("soa_adjustments")
        .insert({
          soa_id: selectedSOA.assignment_id,
          assignment_id: selectedSOA.assignment_id,
          custodian_id: selectedSOA.custodian_id,
          adjustment_type: adjustmentType,
          adjustment_amount: adjustmentAmount,
          reason: correctionReason.trim(),
          reference: `${correctionRefType}:${correctionRefId}`,
          created_by: profile.id,
          exchange_metadata: metadata,
          requires_custodian_confirmation: true,
          custodian_confirmed: false,
          original_reference_snapshot: selectedReference?.data || null,
        });

      if (insertError) {
        setCorrectionError(insertError.message || "Failed to create correction.");
        return;
      }

      setCorrectionSuccess("Administrative correction submitted for custodian confirmation.");
      setCorrectionReason("");
      setCorrectionNotes("");
      setCorrectionRefId("");
      setCorrectionDelta({
        denom_10: 0,
        denom_20: 0,
        denom_50: 0,
        denom_100: 0,
        denom_200: 0,
        denom_500: 0,
        denom_2000: 0,
      });

      await loadAdjustments();
    } catch (err) {
      console.error("Correction creation failed:", err);
      setCorrectionError("Failed to create correction. Please retry.");
    } finally {
      setCorrectionSubmitting(false);
    }
  }

  // =========================
  // RENDER
  // =========================
  if (!profile || !["admin", "supervisor"].includes(profile.role)) {
    return (
      <AppLayout>
        <div className="container">
          <div className="rounded-lg bg-red-50 border border-red-200 p-6 text-center">
            <p className="text-red-700 font-medium">
              ⛔ Access Denied. Only administrators can adjust SOA records.
            </p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container space-y-6 max-w-2xl">
        {/* ===== PAGE HEADER ===== */}
        <div className="space-y-2">
          <h1 className="text-2xl font-bold text-slate-900">
            SOA Operational Records & Corrections
          </h1>
          <p className="text-sm text-slate-600">
            Review operational adjustments and submit administrative correction overlays.
          </p>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Legacy cash adjustments (CREDIT/DEBIT) are deprecated and do not affect SOA net.
          Administrative corrections use a confirmation overlay and never alter original records.
        </div>

        {/* ===== ERROR MESSAGE ===== */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* ===== SOA SELECTOR ===== */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-900 mb-2">
              Select Assignment / SOA <span className="text-red-600">*</span>
            </label>

            {initialLoad ? (
              <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                <p className="text-sm text-slate-600">Loading SOA records…</p>
              </div>
            ) : soaList.length === 0 ? (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-700">
                  📭 No SOA records available for adjustment
                </p>
              </div>
            ) : (
              <select
                className="input w-full text-sm"
                value={selectedSOA?.id || ""}
                onChange={(e) =>
                  setSelectedSOA(
                    soaList.find((s) => s.id === Number(e.target.value)) ||
                      null
                  )
                }
              >
                <option value="">-- Select an Assignment --</option>
                {soaList.map((s) => (
                  <option key={s.id} value={s.id}>
                    📅 {formatISTDate(s.assignment_date, "short")} | Assignment
                    #{s.assignment_id} | {s.full_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Display Selected SOA Details */}
          {selectedSOA && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs text-blue-600 font-medium">
                    Assignment ID
                  </p>
                  <p className="text-sm font-semibold text-blue-900">
                    #{selectedSOA.assignment_id}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">
                    Current Net Position
                  </p>
                  <p className="text-sm font-semibold text-blue-900">
                    ₹
                    {selectedSOA.final_net_cash_position.toLocaleString(
                      "en-IN",
                      { minimumFractionDigits: 2 }
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">Custodian</p>
                  <p className="text-sm font-semibold text-blue-900">
                    {selectedSOA.full_name || "Unknown"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-blue-600 font-medium">
                    Assignment Date
                  </p>
                  <p className="text-sm font-semibold text-blue-900">
                    {formatISTDate(selectedSOA.assignment_date, "short")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ===== ADMIN CORRECTION OVERLAY ===== */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Administrative Correction Overlay
            </h2>
            <p className="text-xs text-slate-500">
              Create delta-only corrections without editing original operational records.
            </p>
          </div>

          {!selectedSOA ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-800">
              Select an assignment to enable administrative corrections.
            </div>
          ) : (
            <div className="space-y-4">
              {correctionError && (
                <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-xs text-red-800">
                  ⚠️ {correctionError}
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference Type
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={correctionRefType}
                    onChange={(e) =>
                      setCorrectionRefType(
                        e.target.value as
                          | "ATM_LOAD"
                          | "CASH_PICKUP"
                          | "EXCHANGE"
                          | "INTER_SITE_TRANSFER"
                      )
                    }
                  >
                    <option value="ATM_LOAD">ATM Load</option>
                    <option value="CASH_PICKUP">Cash Pickup</option>
                    <option value="EXCHANGE">Exchange</option>
                    <option value="INTER_SITE_TRANSFER">Inter-site Transfer</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reference Record
                  </label>
                  <select
                    className="input w-full text-xs"
                    value={correctionRefId}
                    onChange={(e) => setCorrectionRefId(e.target.value)}
                    disabled={referenceLoading}
                  >
                    <option value="">
                      {referenceLoading ? "Loading..." : "-- Select reference --"}
                    </option>
                    {referenceOptions.map((opt: any) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  {referenceLoading && (
                    <p className="text-xs text-slate-500 mt-1">Loading records...</p>
                  )}
                  {referenceOptions.length === 0 && !referenceLoading && (
                    <p className="text-xs text-amber-700 mt-1">
                      No {correctionRefType === "ATM_LOAD" ? "ATM loads" : correctionRefType === "CASH_PICKUP" ? "cash pickups" : correctionRefType === "EXCHANGE" ? "exchanges" : "transfers"} found for this assignment.
                    </p>
                  )}
                </div>
              </div>

              {selectedReference && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <p className="text-slate-500">Original</p>
                      <p className="font-semibold text-slate-900">₹{originalTotal.toLocaleString("en-IN")}</p>
                      <p className="text-slate-600 mt-1">{formatDenoms(originalDenoms)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Delta</p>
                      <p className={`font-semibold ${deltaTotal >= 0 ? "text-green-700" : "text-red-700"}`}>
                        {deltaTotal >= 0 ? "+" : "-"}₹{Math.abs(deltaTotal).toLocaleString("en-IN")}
                      </p>
                      <p className="text-slate-600 mt-1">{formatDenoms(deltaDenoms)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Effective</p>
                      <p className="font-semibold text-slate-900">₹{effectiveTotal.toLocaleString("en-IN")}</p>
                      <p className="text-slate-600 mt-1">{formatDenoms(effectiveDenoms)}</p>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Correction Delta (Denominations)
                </label>
                <DenominationFields
                  values={correctionDelta}
                  onChange={(name, value) =>
                    setCorrectionDelta((prev) => ({ ...prev, [name]: value }))
                  }
                  denoms={activeDenoms}
                  allowNegative
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Reason (required)
                  </label>
                  <input
                    className="input w-full text-xs"
                    value={correctionReason}
                    onChange={(e) => setCorrectionReason(e.target.value)}
                    placeholder="Explain the correction"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Supporting Notes
                  </label>
                  <input
                    className="input w-full text-xs"
                    value={correctionNotes}
                    onChange={(e) => setCorrectionNotes(e.target.value)}
                    placeholder="Optional notes"
                  />
                </div>
              </div>

              {correctionError && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                  {correctionError}
                </div>
              )}
              {correctionSuccess && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-700">
                  {correctionSuccess}
                </div>
              )}

              <button
                className="btn-primary w-full"
                onClick={handleCreateCorrection}
                disabled={correctionSubmitting || !selectedReference}
              >
                {correctionSubmitting ? "Submitting..." : "Submit Correction for Confirmation"}
              </button>
            </div>
          )}
        </div>

        {/* ===== ADJUSTMENT HISTORY ===== */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Adjustment History
              </h2>
              <p className="text-xs text-slate-500">
                Latest 200 operational adjustments and admin corrections
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <select
                className="input text-xs"
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(
                    e.target.value as
                      | "ALL"
                      | "CREDIT"
                      | "DEBIT"
                      | "EXCHANGE"
                      | "INTER_SITE_TRANSFER"
                  )
                }
              >
                <option value="ALL">All Types</option>
                <option value="CREDIT">Credit (Admin)</option>
                <option value="DEBIT">Debit (Admin)</option>
                <option value="EXCHANGE">Exchange</option>
                <option value="INTER_SITE_TRANSFER">Inter-site Transfer</option>
              </select>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={includeLegacyAdjustments}
                  onChange={(e) => {
                    setIncludeLegacyAdjustments(e.target.checked);
                    setTypeFilter("ALL");
                  }}
                />
                Include legacy credit/debit (read-only)
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={onlySelectedAssignment}
                  onChange={(e) => setOnlySelectedAssignment(e.target.checked)}
                  disabled={!selectedSOA}
                />
                Only selected assignment
              </label>
            </div>
          </div>

          {adjustmentsLoading ? (
            <div className="flex items-center gap-2 p-3 bg-slate-50 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <p className="text-sm text-slate-600">Loading adjustments…</p>
            </div>
          ) : adjustments.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-lg text-sm text-slate-600">
              No adjustments found for the selected filters.
            </div>
          ) : (
            <div className="space-y-3">
              {adjustments.map((adj) => {
                const meta = typeMeta[adj.adjustment_type];
                const isAdminCorrection = isAdminCorrectionAdjustment(adj);
                const operationalAmount = getOperationalAmount(adj);
                const correctionDelta = Number(adj.exchange_metadata?.delta_total ?? 0);
                const signedDelta = correctionDelta || (adj.adjustment_type === "CREDIT" ? adj.adjustment_amount : -adj.adjustment_amount);
                const displayAmount = isAdminCorrection
                  ? `₹${Math.abs(signedDelta).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                  : `₹${operationalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`;
                const confirmationPending =
                  adj.requires_custodian_confirmation && !adj.custodian_confirmed;

                return (
                  <div
                    key={adj.id}
                    className="border border-slate-200 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${
                            isAdminCorrection
                              ? "bg-emerald-100 text-emerald-800"
                              : meta.badge
                          }`}
                        >
                          {isAdminCorrection ? "Admin Correction" : meta.label}
                        </span>
                        {adj.requires_custodian_confirmation && (
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                              confirmationPending
                                ? "bg-amber-100 text-amber-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {confirmationPending ? "Pending Confirmation" : "Confirmed"}
                          </span>
                        )}
                        <span className="text-xs text-slate-500">
                          {formatISTAudit(adj.created_at)}
                        </span>
                      </div>
                      <div className="text-sm font-semibold text-slate-900">
                        {displayAmount}
                        {(adj.adjustment_type === "EXCHANGE" ||
                          adj.adjustment_type === "INTER_SITE_TRANSFER") && (
                          <span className="ml-2 text-xs text-slate-500">
                            (Net ₹0)
                          </span>
                        )}
                      </div>
                    </div>

                    {isAdminCorrection && adj.custodian_confirmed && (
                      <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                        ✅ Custodian confirmed on {formatISTAudit(adj.custodian_confirmed_at || adj.created_at)}
                        {adj.custodian_signature_url ? " • Signature attached" : ""}
                      </div>
                    )}

                    <div className="text-sm text-slate-700">
                      {adj.reason}
                    </div>

                    {(adj.adjustment_type === "CREDIT" ||
                      adj.adjustment_type === "DEBIT") && !isAdminCorrection && (
                      <div className="text-xs text-slate-500">
                        Legacy record (no impact on SOA net)
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Assignment #{adj.assignment_id}</span>
                      <span>• Custodian: {adj.custodian_name}</span>
                      <span>• By: {adj.created_by_name}</span>
                      {adj.reference && <span>• Ref: {adj.reference}</span>}
                    </div>

                    {isAdminCorrection && (
                      <div className="text-xs text-slate-700 bg-emerald-50 border border-emerald-200 rounded p-2 space-y-1">
                        <div className="flex flex-wrap gap-2">
                          <span className="font-semibold">Original:</span>
                          <span>₹{Number(adj.exchange_metadata?.original_total || 0).toLocaleString("en-IN")}</span>
                          <span>• {formatDenoms(adj.exchange_metadata?.original_denominations)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="font-semibold">Delta:</span>
                          <span>{signedDelta >= 0 ? "+" : "-"}₹{Math.abs(signedDelta).toLocaleString("en-IN")}</span>
                          <span>• {formatDenoms(adj.exchange_metadata?.delta_denominations)}</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <span className="font-semibold">Effective:</span>
                          <span>₹{Number(adj.exchange_metadata?.effective_total || 0).toLocaleString("en-IN")}</span>
                          <span>• {formatDenoms(adj.exchange_metadata?.effective_denominations)}</span>
                        </div>
                      </div>
                    )}

                    {adj.adjustment_type === "EXCHANGE" && (
                      <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-2">
                        <p>
                          {adj.exchange_metadata?.from_bank_name || "-"} →{" "}
                          {adj.exchange_metadata?.to_bank_name || "-"}
                        </p>
                        <p>
                          From: {formatDenoms(adj.exchange_metadata?.from_denominations)}
                        </p>
                        <p>To: {formatDenoms(adj.exchange_metadata?.to_denominations)}</p>
                      </div>
                    )}

                    {adj.adjustment_type === "INTER_SITE_TRANSFER" && (
                      <div className="text-xs text-slate-600 bg-blue-50 border border-blue-200 rounded p-2">
                        <p>
                          {adj.transfer_metadata?.source_site_name || "-"} →{" "}
                          {adj.transfer_metadata?.to_site_name || "-"}
                        </p>
                        <p>
                          Denoms: {formatDenoms(adj.transfer_metadata?.source_denominations)}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ===== HELP SECTION ===== */}
        {!selectedSOA && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <p className="text-sm font-medium text-amber-900 mb-2">
              📝 How to use this tool:
            </p>
            <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside">
              <li>Select an SOA record from the dropdown above</li>
              <li>Filter by exchange or inter-site transfer type</li>
              <li>Use the history list to audit operational movements</li>
            </ul>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
