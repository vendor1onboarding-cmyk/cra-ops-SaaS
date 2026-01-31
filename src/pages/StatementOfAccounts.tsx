import { useEffect, useState, useMemo } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getISTDateString,
  getISTMonthStart,
  formatISTDate,
} from "../utils/time";

type SOARow = {
  soa_id: number;
  assignment_date: string;
  cash_picked: number;
  cash_loaded: number;
  cash_adjusted: number;
  excess_reported: number;
  travel_km: number;
  travel_allowance: number;
  final_net_cash_position: number;
  posted_at: string;
  custodian_id?: string;
  full_name?: string;
};

export default function StatementOfAccounts() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<SOARow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize dates based on IST timezone
  // These are used for database queries (stored in DATE format, not timestamps)
  const [fromDate, setFromDate] = useState(getISTMonthStart());
  const [toDate, setToDate] = useState(getISTDateString());

  const isAdmin = profile?.role === "admin" || profile?.role === "supervisor";

  useEffect(() => {
    if (!profile) return;

    async function loadSOA() {
      setLoading(true);
      setError(null);

      try {
        let query = supabase
          .from("v_soa_effective")
          .select(
            `soa_id,
            assignment_date,
            cash_picked,
            cash_loaded,
            cash_adjusted,
            excess_reported,
            travel_km,
            travel_allowance,
            final_net_cash_position,
            posted_at,
            custodian_id`
          )
          .gte("assignment_date", fromDate)
          .lte("assignment_date", toDate)
          .order("assignment_date", { ascending: false });

        // 🔐 Custodian isolation - custodians see only their records
        if (profile.role === "custodian") {
          query = query.eq("custodian_id", profile.id);
        }

        const { data, error: queryError } = await query;

        if (queryError) {
          setError("Failed to load SOA records. Please try again.");
          console.error("SOA Query Error:", queryError);
          setRows([]);
        } else {
          // Fetch custodian names for admin view
          if (isAdmin && data && data.length > 0) {
            const custodianIds = [...new Set(data.map((r: any) => r.custodian_id))];
            const { data: custodians } = await supabase
              .from("profiles")
              .select("id, full_name")
              .in("id", custodianIds);

            const custodianMap = new Map(
              (custodians || []).map((c: any) => [c.id, c.full_name])
            );

            const processedData = data.map((row: any) => ({
              ...row,
              full_name: custodianMap.get(row.custodian_id) || "Unknown",
            }));
            setRows(processedData);
          } else {
            setRows(data || []);
          }
        }
      } catch (err) {
        setError("An unexpected error occurred while loading SOA records.");
        console.error("Unexpected Error:", err);
        setRows([]);
      } finally {
        setLoading(false);
      }
    }

    loadSOA();
  }, [profile, fromDate, toDate, isAdmin]);


  // Calculate totals
  const totals = useMemo(() => {
    return rows.reduce(
      (acc, r) => {
        acc.cashPicked += r.cash_picked;
        acc.cashLoaded += r.cash_loaded;
        acc.allowance += r.travel_allowance;
        acc.net += r.final_net_cash_position;
        return acc;
      },
      { cashPicked: 0, cashLoaded: 0, allowance: 0, net: 0 }
    );
  }, [rows]);

  function exportCSV() {
    if (rows.length === 0) {
      alert("No records to export");
      return;
    }

    const header = [
      "Date",
      "Cash Picked",
      "Cash Loaded",
      "Adjusted",
      "Excess",
      "Travel KM",
      "Allowance",
      "Final Net Position",
    ];

    const csv = [
      header.join(","),
      ...rows.map((r) =>
        [
          r.assignment_date,
          r.cash_picked,
          r.cash_loaded,
          r.cash_adjusted,
          r.excess_reported,
          r.travel_km,
          r.travel_allowance,
          r.final_net_cash_position,
        ].join(",")
      ),
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

            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={exportCSV}
                disabled={loading || rows.length === 0}
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
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
            <KPI
              label="Total Picked"
              value={totals.cashPicked}
              subtext="₹"
              color="blue"
            />
            <KPI
              label="Total Loaded"
              value={totals.cashLoaded}
              subtext="₹"
              color="green"
            />
            <KPI
              label="Travel Allowance"
              value={totals.allowance}
              subtext="₹"
              color="amber"
            />
            <KPI
              label="Net Position"
              value={totals.net}
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
          ) : rows.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-slate-600">
                No SOA records found for the selected period.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 border-b border-slate-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">
                      Date
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
                      Adjusted
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">
                      Excess
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">
                      KM
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">
                      Allowance
                    </th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">
                      Final Net
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {rows.map((r, idx) => (
                    <tr
                      key={idx}
                      className="hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-slate-900">
                        {formatISTDate(r.assignment_date, "short")}
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
                        <span
                          className={
                            r.cash_adjusted !== 0 ? "font-semibold" : ""
                          }
                        >
                          {r.cash_adjusted.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>
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
                      <td className="px-4 py-3 text-right text-slate-900">
                        {r.travel_km}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-900">
                        {r.travel_allowance.toLocaleString("en-IN", {
                          minimumFractionDigits: 2,
                        })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-block bg-indigo-100 text-indigo-900 rounded px-2 py-1 font-semibold text-xs">
                          {r.final_net_cash_position.toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Table Footer Summary */}
                <tfoot className="bg-slate-50 border-t border-slate-200">
                  <tr>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      Total ({rows.length} records)
                    </td>
                    {isAdmin && <td></td>}
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {totals.cashPicked.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {totals.cashLoaded.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td colSpan={3}></td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {totals.allowance.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-indigo-900 bg-indigo-100 rounded">
                      {totals.net.toLocaleString("en-IN", {
                        minimumFractionDigits: 2,
                      })}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
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
