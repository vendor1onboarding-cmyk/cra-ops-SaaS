import { useCallback, useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import {
  formatISTDate,
  formatIST,
  formatISTAudit,
} from "../utils/time";

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
  adjustment_type: "EXCHANGE" | "INTER_SITE_TRANSFER";
  adjustment_amount: number;
  reason: string;
  reference?: string | null;
  created_at: string;
  created_by?: string | null;
  exchange_metadata?: any;
  transfer_metadata?: any;
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
    "ALL" | "EXCHANGE" | "INTER_SITE_TRANSFER"
  >("ALL");
  const [onlySelectedAssignment, setOnlySelectedAssignment] = useState(false);

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
           transfer_metadata`
        )
        .order("created_at", { ascending: false })
        .limit(200);

      if (typeFilter !== "ALL") {
        query = query.eq("adjustment_type", typeFilter);
      } else {
        query = query.in("adjustment_type", ["EXCHANGE", "INTER_SITE_TRANSFER"]);
      }

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

      setAdjustments(processed);
    } catch (err) {
      console.error("Adjustments Load Error:", err);
      setAdjustments([]);
    } finally {
      setAdjustmentsLoading(false);
    }
  }, [onlySelectedAssignment, profile, selectedSOA, typeFilter]);

  useEffect(() => {
    loadSOA();
  }, [loadSOA]);

  useEffect(() => {
    loadAdjustments();
  }, [loadAdjustments]);

  const typeMeta: Record<
    Adjustment["adjustment_type"],
    { label: string; badge: string }
  > = {
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
    const entries = Object.entries(denoms).filter(([, count]) => Number(count) > 0);
    if (entries.length === 0) return "-";
    return entries
      .map(([key, count]) => {
        const denom = key.replace("denom_", "");
        return `₹${denom}×${count}`;
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
            SOA Operational Records
          </h1>
          <p className="text-sm text-slate-600">
            Review exchanges and inter-site transfers logged against SOA
          </p>
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

        {/* ===== ADJUSTMENT HISTORY ===== */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                Operational Adjustment History
              </h2>
              <p className="text-xs text-slate-500">
                Latest 200 adjustments (exchanges, transfers)
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
                      | "EXCHANGE"
                      | "INTER_SITE_TRANSFER"
                  )
                }
              >
                <option value="ALL">All Types</option>
                <option value="EXCHANGE">Exchange</option>
                <option value="INTER_SITE_TRANSFER">Inter-site Transfer</option>
              </select>

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
                const operationalAmount = getOperationalAmount(adj);
                const displayAmount = `₹${operationalAmount.toLocaleString(
                  "en-IN",
                  {
                    minimumFractionDigits: 2,
                  }
                )}`;

                return (
                  <div
                    key={adj.id}
                    className="border border-slate-200 rounded-lg p-4 space-y-2"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs font-semibold px-2 py-1 rounded ${meta.badge}`}
                        >
                          {meta.label}
                        </span>
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

                    <div className="text-sm text-slate-700">
                      {adj.reason}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span>Assignment #{adj.assignment_id}</span>
                      <span>• Custodian: {adj.custodian_name}</span>
                      <span>• By: {adj.created_by_name}</span>
                      {adj.reference && <span>• Ref: {adj.reference}</span>}
                    </div>

                    {adj.adjustment_type === "EXCHANGE" && (
                      <div className="text-xs text-slate-600 bg-amber-50 border border-amber-200 rounded p-2">
                        <p>
                          {adj.exchange_metadata?.from_location || "-"} →{" "}
                          {adj.exchange_metadata?.to_location || "-"}
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
                          {adj.transfer_metadata?.from_site_name || "-"} →{" "}
                          {adj.transfer_metadata?.to_site_name || "-"}
                        </p>
                        <p>
                          Denoms: {formatDenoms(adj.transfer_metadata?.denominations)}
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
