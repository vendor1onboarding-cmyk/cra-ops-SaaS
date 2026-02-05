import { useEffect, useState, useMemo } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getISTDateString,
  getISTMonthStart,
  formatISTDate,
} from "../utils/time";

type SOASummaryRow = {
  soa_id: number;
  assignment_id?: number;
  assignment_date: string;
  cash_picked: number;
  cash_loaded: number;
  excess_reported: number;
  travel_km: number;
  travel_allowance: number;
  final_net_cash_position: number;
  posted_at: string;
  status?: string;
  custodian_id?: string;
  full_name?: string;
};

type SOADetailedRow = {
  assignment_id: number;
  custodian_id?: string;
  assignment_date: string;
  opening_balance: number;
  total_withdrawals: number;
  total_loads: number;
  exchange_count: number;
  transfer_count: number;
  excess_reported: number;
  travel_km: number;
  travel_allowance: number;
  status?: string;
  full_name?: string;
};

export default function StatementOfAccounts() {
  const { profile } = useAuth();
  const [viewMode, setViewMode] = useState<"summary" | "detailed">("summary");
  const [summaryRows, setSummaryRows] = useState<SOASummaryRow[]>([]);
  const [detailedRows, setDetailedRows] = useState<SOADetailedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "open" | "submitted" | "approved" | "rejected"
  >("ALL");
  const [custodianFilter, setCustodianFilter] = useState("ALL");
  const [custodianOptions, setCustodianOptions] = useState<
    { id: string; full_name: string }[]
  >([]);

  // Initialize dates based on IST timezone
  // These are used for database queries (stored in DATE format, not timestamps)
  const [fromDate, setFromDate] = useState(getISTMonthStart());
  const [toDate, setToDate] = useState(getISTDateString());

  const isAdmin = profile?.role === "admin" || profile?.role === "supervisor";
  const showAllowance = isAdmin;

  useEffect(() => {
    if (!profile) return;

    async function loadSOA() {
      setLoading(true);
      setError(null);

      const isSummary = viewMode === "summary";

      try {
        let query = supabase
          .from(isSummary ? "v_soa_effective" : "v_soa_detailed")
          .select(
            isSummary
              ? `soa_id,
                assignment_id,
                assignment_date,
                cash_picked,
                cash_loaded,
                excess_reported,
                travel_km,
                travel_allowance,
                final_net_cash_position,
                posted_at,
                custodian_id`
              : `assignment_id,
                custodian_id,
                assignment_date,
                opening_balance,
                total_withdrawals,
                total_loads,
                exchange_count,
                transfer_count,
                excess_reported,
                travel_km,
                travel_allowance,
                status`
          )
          .gte("assignment_date", fromDate)
          .lte("assignment_date", toDate)
          .order("assignment_date", { ascending: false });

        // 🔐 Custodian isolation - custodians see only their records
        if (profile.role === "custodian") {
          query = query.eq("custodian_id", profile.id);
        }

        if (isAdmin && custodianFilter !== "ALL") {
          query = query.eq("custodian_id", custodianFilter);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          setError("Failed to load SOA records. Please try again.");
          console.error("SOA Query Error:", queryError);
          if (isSummary) {
            setSummaryRows([]);
          } else {
            setDetailedRows([]);
          }
        } else {
          let rows: any[] = data || [];

          if (isAdmin && rows.length > 0) {
            const custodianIds = [
              ...new Set(rows.map((r: any) => r.custodian_id)),
            ];
            const { data: custodians } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", custodianIds);

            const custodianMap = new Map(
              (custodians || []).map((c: any) => [c.id, c.full_name])
            );

            rows = rows.map((row: any) => ({
              ...row,
              full_name: custodianMap.get(row.custodian_id) || "Unknown",
            }));
          }

          if (isSummary && rows.length > 0) {
            const assignmentIds = [
              ...new Set(
                rows.map((r: any) => r.assignment_id ?? r.soa_id).filter(Boolean)
              ),
            ];

            if (assignmentIds.length > 0) {
              const { data: assignments } = await supabase
                .from("assignments")
                .select("id, status")
                .in("id", assignmentIds);

              const statusMap = new Map(
                (assignments || []).map((a: any) => [a.id, a.status])
              );

              rows = rows.map((row: any) => ({
                ...row,
                status: statusMap.get(row.assignment_id ?? row.soa_id),
              }));
            }
          }

          if (statusFilter !== "ALL") {
            rows = rows.filter((row: any) => row.status === statusFilter);
          }

          if (isSummary) {
            setSummaryRows(rows);
          } else {
            setDetailedRows(rows);
          }
        }
      } catch (err) {
        setError("An unexpected error occurred while loading SOA records.");
        console.error("Unexpected Error:", err);
        if (viewMode === "summary") {
          setSummaryRows([]);
        } else {
          setDetailedRows([]);
        }
      } finally {
        setLoading(false);
      }
    }

    loadSOA();
  }, [profile, fromDate, toDate, isAdmin, viewMode, statusFilter, custodianFilter]);

  useEffect(() => {
    if (!isAdmin) return;

    async function loadCustodians() {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "custodian")
        .order("full_name", { ascending: true });

      setCustodianOptions(data || []);
    }

    loadCustodians();
  }, [isAdmin]);


  const getClosingBalance = (row: SOADetailedRow) =>
    row.opening_balance - row.total_loads;

  // Calculate totals
  const summaryTotals = useMemo(() => {
    return summaryRows.reduce(
      (acc, r) => {
        acc.cashPicked += r.cash_picked;
        acc.cashLoaded += r.cash_loaded;
        acc.allowance += r.travel_allowance;
        acc.net += r.final_net_cash_position;
        return acc;
      },
      { cashPicked: 0, cashLoaded: 0, allowance: 0, net: 0 }
    );
  }, [summaryRows]);

  const summaryTravelKmTotal = useMemo(() => {
    return summaryRows.reduce((acc, r) => acc + (r.travel_km || 0), 0);
  }, [summaryRows]);

  const detailedTotals = useMemo(() => {
    return detailedRows.reduce(
      (acc, r) => {
        acc.opening += r.opening_balance;
        acc.withdrawals += r.total_withdrawals;
        acc.loads += r.total_loads;
        acc.allowance += r.travel_allowance;
        acc.travelKm += r.travel_km || 0;
        acc.closing += getClosingBalance(r);
        return acc;
      },
      {
        opening: 0,
        withdrawals: 0,
        loads: 0,
        allowance: 0,
        travelKm: 0,
        closing: 0,
      }
    );
  }, [detailedRows]);

  function exportCSV() {
    const isSummary = viewMode === "summary";
    const exportRows = isSummary ? summaryRows : detailedRows;

    if (exportRows.length === 0) {
      alert("No records to export");
      return;
    }

    const header = isSummary
      ? [
          "Date",
          ...(isAdmin ? ["Custodian"] : []),
          "Status",
          "Cash Picked",
          "Cash Loaded",
          "Travel KM",
          ...(showAllowance ? ["Allowance"] : []),
          "Final Net Position",
        ]
      : [
          "Date",
          ...(isAdmin ? ["Custodian"] : []),
          "Status",
          "Opening Balance",
          "Withdrawals",
          "Loads",
          "Exchanges",
          "Transfers",
          "Travel KM",
          ...(showAllowance ? ["Allowance"] : []),
          "Excess",
          "Closing Balance",
        ];

    const csv = [
      header.join(","),
      ...exportRows.map((r) => {
        if (isSummary) {
          const row = r as SOASummaryRow;
          return [
            row.assignment_date,
            ...(isAdmin ? [row.full_name || "Unknown"] : []),
            row.status || "-",
            row.cash_picked,
            row.cash_loaded,
            row.travel_km,
            ...(showAllowance ? [row.travel_allowance] : []),
            row.final_net_cash_position,
          ].join(",");
        }

        const row = r as SOADetailedRow;
        return [
          row.assignment_date,
          ...(isAdmin ? [row.full_name || "Unknown"] : []),
          row.status || "-",
          row.opening_balance,
          row.total_withdrawals,
          row.total_loads,
          row.exchange_count,
          row.transfer_count,
          row.travel_km,
          ...(showAllowance ? [row.travel_allowance] : []),
          row.excess_reported,
          getClosingBalance(row),
        ].join(",");
      }),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `SOA_${fromDate}_to_${toDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  return (
    <AppLayout>
      <div className="container space-y-6">
        {/* ===== PRINT HEADER WITH LOGO ===== */}
        <div className="print-only mb-4 border-b pb-3">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {/* Bank Logo */}
              <img
                src="/bank-logo.png"
                alt="Bank Logo"
                className="h-10 w-auto"
              />

              <div>
                <h1 className="text-xl font-bold">Sruthi CRA Ops</h1>
                <p className="text-xs text-slate-600">
                  Cash Replenishment & ATM Operations
                </p>
              </div>
            </div>

            <div className="text-right text-xs">
              <p className="font-semibold">Statement of Accounts Report</p>
              <p>Period: {fromDate} to {toDate}</p>
              <p>Date: {new Date().toLocaleDateString("en-IN")}</p>
              {profile?.full_name && (
                <p>Custodian: {profile.full_name}</p>
              )}
            </div>
          </div>
        </div>

        {/* ===== Page Header (Hidden on Print) ===== */}
        <div className="space-y-2 print:hidden">
          <h1 className="text-2xl font-bold text-slate-900">
            Statement of Accounts
          </h1>
          <p className="text-sm text-slate-600">
            {isAdmin
              ? "View and manage all custodian statements of accounts"
              : "View your personal statement of accounts"}
          </p>
        </div>

        {/* ===== Error Message ===== */}
        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4">
            <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
          </div>
        )}

        {/* ===== Filters Section ===== */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end print:hidden">
            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="input w-full"
              />
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="input w-full"
              />
            </div>

            <div className="w-full sm:w-auto">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(
                    e.target.value as
                      | "ALL"
                      | "open"
                      | "submitted"
                      | "approved"
                      | "rejected"
                  )
                }
                className="input w-full"
              >
                <option value="ALL">All</option>
                <option value="open">Open</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {isAdmin && (
              <div className="w-full sm:w-auto">
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Custodian
                </label>
                <select
                  value={custodianFilter}
                  onChange={(e) => setCustodianFilter(e.target.value)}
                  className="input w-full"
                >
                  <option value="ALL">All Custodians</option>
                  {custodianOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2 w-full sm:w-auto">
                <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setViewMode("summary")}
                    className={`px-3 py-2 text-xs font-semibold transition-colors ${
                      viewMode === "summary"
                        ? "bg-primary text-white"
                        : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewMode("detailed")}
                    className={`px-3 py-2 text-xs font-semibold transition-colors ${
                      viewMode === "detailed"
                        ? "bg-primary text-white"
                        : "bg-white text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    Detailed
                  </button>
                </div>

              <button
                onClick={exportCSV}
                  disabled={
                    loading ||
                    (viewMode === "summary"
                      ? summaryRows.length === 0
                      : detailedRows.length === 0)
                  }
                className="flex-1 sm:flex-none btn-secondary"
                title="Export current records to CSV"
              >
                📥 Export CSV
              </button>

              <button
                onClick={() => window.print()}
                className="flex-1 sm:flex-none btn-primary"
                title="Print or save as PDF"
              >
                🖨️ Print / PDF
              </button>
            </div>
          </div>

          {/* Admin View - Show Custodian Filter */}
          {isAdmin && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-700">
                💡 Consolidated View: Displaying all working custodians' SOA records. Use date filters to refine the period. Custodian names shown in the table.
              </p>
            </div>
          )}
        </div>

        {/* ===== KPI Section ===== */}
        {!loading && viewMode === "summary" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <KPI
              label="Total Picked"
              value={summaryTotals.cashPicked}
              subtext="₹"
              color="blue"
            />
            <KPI
              label="Total Loaded"
              value={summaryTotals.cashLoaded}
              subtext="₹"
              color="green"
            />
            {showAllowance ? (
              <KPI
                label="Travel Allowance"
                value={summaryTotals.allowance}
                subtext="₹"
                color="amber"
              />
            ) : (
              <KPI
                label="Travel KM"
                value={summaryRows.reduce(
                  (sum, r) => sum + (r.travel_km || 0),
                  0
                )}
                color="amber"
              />
            )}
            <KPI
              label="Net Position"
              value={summaryTotals.net}
              subtext="₹"
              color="indigo"
              highlight
            />
          </div>
        )}

        {!loading && viewMode === "detailed" && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <KPI
              label="Opening Balance"
              value={detailedTotals.opening}
              subtext="₹"
              color="blue"
            />
            <KPI
              label="Withdrawals"
              value={detailedTotals.withdrawals}
              subtext="₹"
              color="green"
            />
            <KPI
              label="Loads"
              value={detailedTotals.loads}
              subtext="₹"
              color="amber"
            />
            <KPI
              label="Closing Balance"
              value={detailedTotals.closing}
              subtext="₹"
              color="indigo"
              highlight
            />
          </div>
        )}

        {/* ===== Table Section ===== */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center p-12">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-3"></div>
                <p className="text-sm text-slate-600">Loading SOA records…</p>
              </div>
            </div>
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600 mb-4">
                Unable to load records
              </p>
              <button
                onClick={() => window.location.reload()}
                className="btn-secondary text-sm"
              >
                Retry
              </button>
            </div>
          ) : (viewMode === "summary"
              ? summaryRows.length === 0
              : detailedRows.length === 0) ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600">
                No SOA records found for the selected period.
              </p>
            </div>
          ) : (
            <>
              {viewMode === "summary" ? (
                <>
                  <div className="sm:hidden p-4 space-y-3">
                    {summaryRows.map((r, idx) => {
                      const netUnbalanced =
                        Math.abs(r.final_net_cash_position) >= 0.01;
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">
                              {formatISTDate(r.assignment_date, "short")}
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                              {r.status || "unknown"}
                            </span>
                          </div>
                          {isAdmin && (
                            <div className="text-xs text-slate-600 mt-1">
                              Custodian: {r.full_name || "Unknown"}
                            </div>
                          )}
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-slate-500">Picked</p>
                              <p className="font-semibold text-slate-900">
                                ₹{r.cash_picked.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Loaded</p>
                              <p className="font-semibold text-slate-900">
                                ₹{r.cash_loaded.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">KM</p>
                              <p className="font-semibold text-slate-900">
                                {r.travel_km}
                              </p>
                            </div>
                            {showAllowance && (
                              <div>
                                <p className="text-slate-500">Allowance</p>
                                <p className="font-semibold text-slate-900">
                                  ₹{r.travel_allowance.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </p>
                              </div>
                            )}
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-slate-600">
                              Final Net (Expected 0)
                            </span>
                            <span
                              className={`px-2 py-1 rounded font-semibold ${
                                netUnbalanced
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-emerald-100 text-emerald-900"
                              }`}
                            >
                              ₹{r.final_net_cash_position.toLocaleString(
                                "en-IN",
                                { minimumFractionDigits: 2 }
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">
                            Status
                          </th>
                          {isAdmin && (
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">
                              Custodian
                            </th>
                          )}
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Picked
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Loaded
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            KM
                          </th>
                          {showAllowance && (
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">
                              Allowance
                            </th>
                          )}
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Final Net
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {summaryRows.map((r, idx) => {
                          const netUnbalanced =
                            Math.abs(r.final_net_cash_position) >= 0.01;
                          return (
                            <tr
                              key={idx}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-3 text-slate-900">
                                {formatISTDate(r.assignment_date, "short")}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <span className="inline-block bg-slate-100 rounded px-2 py-1 text-xs font-medium">
                                  {r.status || "unknown"}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-3 text-slate-700">
                                  <span className="inline-block bg-slate-100 rounded px-2 py-1 text-xs font-medium">
                                    {r.full_name || "Unknown"}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.cash_picked.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.cash_loaded.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.travel_km}
                              </td>
                              {showAllowance && (
                                <td className="px-4 py-3 text-right text-slate-900">
                                  {r.travel_allowance.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              )}
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`inline-block rounded px-2 py-1 font-semibold text-xs ${
                                    netUnbalanced
                                      ? "bg-amber-100 text-amber-900"
                                      : "bg-emerald-100 text-emerald-900"
                                  }`}
                                >
                                  {r.final_net_cash_position.toLocaleString(
                                    "en-IN",
                                    { minimumFractionDigits: 2 }
                                  )}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            Total ({summaryRows.length} records)
                          </td>
                          <td></td>
                          {isAdmin && <td></td>}
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {summaryTotals.cashPicked.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {summaryTotals.cashLoaded.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {summaryTravelKmTotal.toLocaleString("en-IN")}
                          </td>
                          {showAllowance && (
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {summaryTotals.allowance.toLocaleString(
                                "en-IN",
                                { minimumFractionDigits: 2 }
                              )}
                            </td>
                          )}
                          <td className="px-4 py-3 text-right font-semibold text-indigo-900 bg-indigo-100 rounded">
                            {summaryTotals.net.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              ) : (
                <>
                  <div className="sm:hidden p-4 space-y-3">
                    {detailedRows.map((r, idx) => {
                      const closing = getClosingBalance(r);
                      const balanced = Math.abs(closing) < 0.01;
                      return (
                        <div
                          key={idx}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">
                              {formatISTDate(r.assignment_date, "short")}
                            </div>
                            <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                              {r.status || "unknown"}
                            </span>
                          </div>
                          {isAdmin && (
                            <div className="text-xs text-slate-600 mt-1">
                              Custodian: {r.full_name || "Unknown"}
                            </div>
                          )}
                          <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-slate-500">Opening</p>
                              <p className="font-semibold text-slate-900">
                                ₹{r.opening_balance.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Withdrawals</p>
                              <p className="font-semibold text-slate-900">
                                ₹{r.total_withdrawals.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Loads</p>
                              <p className="font-semibold text-slate-900">
                                ₹{r.total_loads.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Exchanges</p>
                              <p className="font-semibold text-slate-900">
                                {r.exchange_count}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Transfers</p>
                              <p className="font-semibold text-slate-900">
                                {r.transfer_count}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">KM</p>
                              <p className="font-semibold text-slate-900">
                                {r.travel_km}
                              </p>
                            </div>
                            {showAllowance && (
                              <div>
                                <p className="text-slate-500">Allowance</p>
                                <p className="font-semibold text-slate-900">
                                  ₹{r.travel_allowance.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </p>
                              </div>
                            )}
                            <div>
                              <p className="text-slate-500">Excess</p>
                              <p className="font-semibold text-slate-900">
                                ₹{r.excess_reported.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs">
                            <span className="text-slate-600">Closing</span>
                            <span
                              className={`px-2 py-1 rounded font-semibold ${
                                balanced
                                  ? "bg-emerald-100 text-emerald-900"
                                  : "bg-amber-100 text-amber-900"
                              }`}
                            >
                              ₹{closing.toLocaleString("en-IN", {
                                minimumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="hidden sm:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 border-b border-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">
                            Date
                          </th>
                          <th className="px-4 py-3 text-left font-semibold text-slate-700">
                            Status
                          </th>
                          {isAdmin && (
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">
                              Custodian
                            </th>
                          )}
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Opening
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Withdrawals
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Loads
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Exchanges
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Transfers
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            KM
                          </th>
                          {showAllowance && (
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">
                              Allowance
                            </th>
                          )}
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Excess
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Closing
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {detailedRows.map((r, idx) => {
                          const closing = getClosingBalance(r);
                          const balanced = Math.abs(closing) < 0.01;
                          return (
                            <tr
                              key={idx}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-3 text-slate-900">
                                {formatISTDate(r.assignment_date, "short")}
                              </td>
                              <td className="px-4 py-3 text-slate-700">
                                <span className="inline-block bg-slate-100 rounded px-2 py-1 text-xs font-medium">
                                  {r.status || "unknown"}
                                </span>
                              </td>
                              {isAdmin && (
                                <td className="px-4 py-3 text-slate-700">
                                  <span className="inline-block bg-slate-100 rounded px-2 py-1 text-xs font-medium">
                                    {r.full_name || "Unknown"}
                                  </span>
                                </td>
                              )}
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.opening_balance.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.total_withdrawals.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.total_loads.toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.exchange_count}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.transfer_count}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-900">
                                {r.travel_km}
                              </td>
                              {showAllowance && (
                                <td className="px-4 py-3 text-right text-slate-900">
                                  {r.travel_allowance.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </td>
                              )}
                              <td className="px-4 py-3 text-right text-slate-900">
                                <span
                                  className={
                                    r.excess_reported > 0
                                      ? "text-red-600 font-semibold"
                                      : ""
                                  }
                                >
                                  {r.excess_reported.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span
                                  className={`inline-block rounded px-2 py-1 font-semibold text-xs ${
                                    balanced
                                      ? "bg-emerald-100 text-emerald-900"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {closing.toLocaleString("en-IN", {
                                    minimumFractionDigits: 2,
                                  })}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="bg-slate-50 border-t border-slate-200">
                        <tr>
                          <td className="px-4 py-3 font-semibold text-slate-900">
                            Total ({detailedRows.length} records)
                          </td>
                          <td></td>
                          {isAdmin && <td></td>}
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {detailedTotals.opening.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {detailedTotals.withdrawals.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {detailedTotals.loads.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td colSpan={2}></td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {detailedTotals.travelKm.toLocaleString("en-IN")}
                          </td>
                          {showAllowance && (
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">
                              {detailedTotals.allowance.toLocaleString(
                                "en-IN",
                                { minimumFractionDigits: 2 }
                              )}
                            </td>
                          )}
                          <td></td>
                          <td className="px-4 py-3 text-right font-semibold text-indigo-900 bg-indigo-100 rounded">
                            {detailedTotals.closing.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {/* ===== PRINT FOOTER – SIGNATURES ===== */}
        <div className="print-only mt-10 pt-6 border-t text-xs text-slate-700">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 sm:gap-12">
            <div>
              <p className="font-semibold">Custodian Signature</p>
              <div className="mt-6 border-b w-48"></div>
              <p className="mt-1">Name & Date</p>
            </div>

            <div className="text-right">
              <p className="font-semibold">Supervisor / Bank Officer</p>
              <div className="mt-6 border-b w-48 ml-auto"></div>
              <p className="mt-1">Name, Seal & Date</p>
            </div>
          </div>

          <p className="mt-6 text-[10px] text-slate-500">
            This is a system-generated report from Sruthi CRA Ops.
            Any discrepancy must be reported within RBI-prescribed timelines.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

/**
 * KPI Component for displaying key metrics
 * Industrial standard card with proper styling
 */
function KPI({
  label,
  value,
  subtext,
  color = "slate",
  highlight = false,
}: {
  label: string;
  value: number;
  subtext?: string;
  color?: "blue" | "green" | "amber" | "indigo" | "slate";
  highlight?: boolean;
}) {
  const colorClasses: Record<string, { bg: string; border: string; text: string }> = {
    blue: {
      bg: "bg-blue-50",
      border: "border-blue-200",
      text: "text-blue-700",
    },
    green: {
      bg: "bg-green-50",
      border: "border-green-200",
      text: "text-green-700",
    },
    amber: {
      bg: "bg-amber-50",
      border: "border-amber-200",
      text: "text-amber-700",
    },
    indigo: {
      bg: "bg-indigo-50",
      border: "border-indigo-200",
      text: "text-indigo-700",
    },
    slate: {
      bg: "bg-slate-50",
      border: "border-slate-200",
      text: "text-slate-700",
    },
  };

  const { bg, border, text } = colorClasses[color];

  return (
    <div
      className={`rounded-lg border p-3 sm:p-4 ${bg} ${border} ${
        highlight ? "ring-2 ring-offset-2 ring-indigo-300" : ""
      }`}
    >
      <p className="text-xs sm:text-sm text-slate-600 mb-1 font-medium">
        {label}
      </p>
      <div className="flex items-baseline gap-1">
        {subtext && <span className={`text-xs ${text}`}>{subtext}</span>}
        <p className={`text-lg sm:text-xl font-bold ${text}`}>
          {value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </p>
      </div>
    </div>
  );
}
