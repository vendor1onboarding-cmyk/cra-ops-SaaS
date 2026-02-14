import { useEffect, useState, useMemo } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getISTDateString,
  getISTMonthStart,
  formatISTDate,
  formatISTTime,
  parseUTCDate,
} from "../utils/time";

type SOASummaryRow = {
  soa_id: number;
  assignment_id?: number;
  assignment_date: string;
  cash_picked: number;
  cash_loaded: number;
  bank_picked?: number;
  internal_picked?: number;
  bank_loaded?: number;
  internal_loaded?: number;
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
  const [loadSourceData, setLoadSourceData] = useState<Map<number, { bank: number; internal: number }>>(new Map());
  const [printTransactions, setPrintTransactions] = useState<{
    cashPickups: any[];
    atmLoads: any[];
    excessCash: any[];
    adjustments: any[];
    routeSites: any[];
    openingBalances: Map<number, number>;
    assignmentDates: Map<number, string>;
  } | null>(null);
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
  const bankLogoSrc = `${import.meta.env.BASE_URL}bank-logo.png`;

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
                bank_picked,
                internal_picked,
                bank_loaded,
                internal_loaded,
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

        let sourceMap = new Map<number, { bank: number; internal: number }>();

        // Load source breakdown data for summary view
        if (isSummary && data && data.length > 0) {
          const assignmentIds = [...new Set(data.map((r: any) => r.assignment_id).filter(Boolean))];

          if (assignmentIds.length > 0) {
            const { data: sourceData } = await supabase
              .from("v_atm_load_sources")
              .select("assignment_id, bank_total_amount, internal_total_amount")
              .in("assignment_id", assignmentIds);

            if (sourceData) {
              sourceData.forEach((s: any) => {
                const existing = sourceMap.get(s.assignment_id) || { bank: 0, internal: 0 };
                sourceMap.set(s.assignment_id, {
                  bank: existing.bank + (s.bank_total_amount || 0),
                  internal: existing.internal + (s.internal_total_amount || 0),
                });
              });
            }
          }
        }

        if (isSummary) {
          setLoadSourceData(sourceMap);
        }

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

              rows = rows.map((row: any) => {
                const sources = sourceMap.get(row.assignment_id ?? row.soa_id);
                const bankPicked = row.bank_picked ?? row.cash_picked;
                const internalPicked = row.internal_picked ?? 0;
                const bankLoaded = row.bank_loaded ?? sources?.bank ?? row.cash_loaded;
                const internalLoaded = row.internal_loaded ?? sources?.internal ?? 0;
                return {
                  ...row,
                  status: statusMap.get(row.assignment_id ?? row.soa_id),
                  bank_picked: bankPicked,
                  internal_picked: internalPicked,
                  bank_loaded: bankLoaded,
                  internal_loaded: internalLoaded,
                };
              });

              if (assignmentIds.length > 0) {
                const assignmentDates = new Map<number, string>();
                rows.forEach((row: any) => {
                  const id = row.assignment_id ?? row.soa_id;
                  if (id) {
                    assignmentDates.set(id, row.assignment_date);
                  }
                });

                const [routeSites, cashPickups, atmLoads, excessCash, adjustments, openingRows] =
                  await Promise.all([
                    supabase
                      .from("route_sites")
                      .select("assignment_id, site:site_id(id, site_code, atm_id, bank_name, address)")
                      .in("assignment_id", assignmentIds),
                    supabase
                      .from("cash_pickups")
                      .select("assignment_id, pickup_time, pickup_source, source_site_id, bank_name, branch, total_amount, expected_amount, internal_source_metadata, denom_10, denom_20, denom_50, denom_100, denom_200, denom_500, denom_2000")
                      .in("assignment_id", assignmentIds),
                    supabase
                      .from("atm_replenishments")
                      .select("assignment_id, time_in, site_id, denom_100, denom_200, denom_500, denom_2000, source_breakdown")
                      .in("assignment_id", assignmentIds),
                    supabase
                      .from("atm_excess_cash")
                      .select("assignment_id, site_id, created_at, remarks, denom_100, denom_200, denom_500, denom_2000")
                      .in("assignment_id", assignmentIds),
                    supabase
                      .from("soa_adjustments")
                      .select("assignment_id, adjustment_type, exchange_metadata, transfer_metadata, created_at")
                      .in("assignment_id", assignmentIds)
                      .in("adjustment_type", ["EXCHANGE", "INTER_SITE_TRANSFER"]),
                    supabase
                      .from("v_soa_detailed")
                      .select("assignment_id, opening_balance")
                      .in("assignment_id", assignmentIds),
                  ]);

                const openingBalances = new Map<number, number>();
                (openingRows.data || []).forEach((row: any) => {
                  if (row.assignment_id) {
                    openingBalances.set(row.assignment_id, Number(row.opening_balance || 0));
                  }
                });

                setPrintTransactions({
                  cashPickups: cashPickups.data || [],
                  atmLoads: atmLoads.data || [],
                  excessCash: excessCash.data || [],
                  adjustments: adjustments.data || [],
                  routeSites: routeSites.data || [],
                  openingBalances,
                  assignmentDates,
                });
              } else {
                setPrintTransactions(null);
              }
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

  const getFinalNet = (row: SOASummaryRow) => {
    // CRITICAL: Only BANK CASH affects closing balance
    // Internal transfers are neutral and must NOT be included
    const bankPicked = row.bank_picked ?? row.cash_picked;
    const bankLoaded = row.bank_loaded ?? row.cash_loaded;
    return bankPicked - bankLoaded;
  };

  // Calculate totals
  const summaryTotals = useMemo(() => {
    return summaryRows.reduce(
      (acc, r) => {
        acc.cashPicked += r.cash_picked;
        acc.cashLoaded += r.bank_loaded ?? r.cash_loaded;
        acc.bankPicked += r.bank_picked ?? r.cash_picked;
        acc.internalPicked += r.internal_picked ?? 0;
        acc.bankLoaded += r.bank_loaded ?? r.cash_loaded;
        acc.internalLoaded += r.internal_loaded ?? 0;
        acc.allowance += r.travel_allowance;
        acc.net += getFinalNet(r);
        return acc;
      },
      { cashPicked: 0, cashLoaded: 0, bankPicked: 0, internalPicked: 0, bankLoaded: 0, internalLoaded: 0, allowance: 0, net: 0 }
    );
  }, [summaryRows]);

  const normalizeUtcDate = (value?: string | Date) =>
    value ? parseUTCDate(value) : null;

  const printStatementRows = useMemo(() => {
    if (!printTransactions) return [];

    console.log("[SOA Print] printTransactions:", {
      cashPickups: printTransactions.cashPickups?.length || 0,
      atmLoads: printTransactions.atmLoads?.length || 0,
      excessCash: printTransactions.excessCash?.length || 0,
      adjustments: printTransactions.adjustments?.length || 0,
    });

    const routeSiteMap = new Map<number, any>();
    const assignmentSiteLabels = new Map<number, string>();
    (printTransactions.routeSites || []).forEach((row: any) => {
      if (row?.site?.id) {
        routeSiteMap.set(row.site.id, row.site);
      }
      if (row?.assignment_id && row?.site) {
        const siteCode = row.site.site_code || row.site.atm_id || "";
        const address = row.site.address || row.site.bank_name || "";
        const label = [siteCode, address].filter(Boolean).join(" - ");
        if (label) {
          const existing = assignmentSiteLabels.get(row.assignment_id);
          const labels = existing ? existing.split(" | ") : [];
          if (!labels.includes(label)) {
            labels.push(label);
            assignmentSiteLabels.set(row.assignment_id, labels.join(" | "));
          }
        }
      }
    });

    const getAssignmentSiteLabel = (assignmentId: number) =>
      assignmentSiteLabels.get(assignmentId) || "";
    const formatSiteLabel = (site: any) => {
      if (!site) return "";
      const siteCode = site.site_code || site.atm_id || "";
      const address = site.address || site.bank_name || "";
      return [siteCode, address].filter(Boolean).join(" - ");
    };
    const getSiteLabelById = (siteId?: number | null) => {
      if (!siteId) return "";
      const site = routeSiteMap.get(siteId);
      return formatSiteLabel(site);
    };

    const transactionRows: Array<{
      assignment_id: number;
      assignment_date: string;
      ts: Date;
      type: string;
      atm: string;
      debit: number;
      credit: number;
      remarks: string;
    }> = [];

    // Process cash pickups
    (printTransactions.cashPickups || []).forEach((c: any) => {
      const ts = normalizeUtcDate(c.pickup_time) || new Date();
      const isInternal = (c.pickup_source || "BANK") === "ATM_INTERNAL";
      const assignmentDate = printTransactions.assignmentDates.get(c.assignment_id) || "";
      
      const denomTotal =
        (c.denom_10 || 0) * 10 +
        (c.denom_20 || 0) * 20 +
        (c.denom_50 || 0) * 50 +
        (c.denom_100 || 0) * 100 +
        (c.denom_200 || 0) * 200 +
        (c.denom_500 || 0) * 500 +
        (c.denom_2000 || 0) * 2000;
      const creditAmount = denomTotal > 0
        ? denomTotal
        : Number(c.total_amount || c.expected_amount || 0);

      console.log("[SOA Print] Processing cash pickup:", {
        assignment_id: c.assignment_id,
        pickup_source: c.pickup_source,
        isInternal,
        creditAmount,
        bank_name: c.bank_name,
        total_amount: c.total_amount,
        expected_amount: c.expected_amount,
        denomTotal
      });

      const internalSources = c.internal_source_metadata?.sources || [];
      const internalTotal = internalSources.reduce(
        (sum: number, s: any) => sum + Number(s.total_amount || 0),
        0
      );
      const pickupSiteLabel = getSiteLabelById(c.source_site_id);

      if (isInternal) {
        const amount = internalTotal > 0 ? internalTotal : creditAmount;
        if (amount > 0) {
          transactionRows.push({
            assignment_id: c.assignment_id,
            assignment_date: assignmentDate,
            ts,
            type: "ATM Cash Removal",
            atm: pickupSiteLabel,
            debit: 0,
            credit: -amount,
            remarks: "",
          });
        }
        return;
      }

      const bankAmount = Math.max(creditAmount - internalTotal, 0);
      if (bankAmount > 0) {
        transactionRows.push({
          assignment_id: c.assignment_id,
          assignment_date: assignmentDate,
          ts,
          type: "Bank Pickup",
          atm: pickupSiteLabel,
          debit: 0,
          credit: bankAmount,
          remarks: "",
        });
      }
      if (internalTotal > 0) {
        transactionRows.push({
          assignment_id: c.assignment_id,
          assignment_date: assignmentDate,
          ts,
          type: "ATM Cash Removal",
          atm: pickupSiteLabel,
          debit: 0,
          credit: -internalTotal,
          remarks: "",
        });
      }
    });

    // Process ATM loads
    (printTransactions.atmLoads || []).forEach((a: any) => {
      const ts = normalizeUtcDate(a.time_in) || new Date();
      const assignmentDate = printTransactions.assignmentDates.get(a.assignment_id) || "";
      const bankDebitAmount = a.source_breakdown?.bank_source
        ? Number(a.source_breakdown?.bank_source?.total_amount || 0)
        : (a.denom_100 || 0) * 100 +
          (a.denom_200 || 0) * 200 +
          (a.denom_500 || 0) * 500 +
          (a.denom_2000 || 0) * 2000;
      const internalCreditAmount = a.source_breakdown?.internal_source
        ? Number(a.source_breakdown?.internal_source?.total_amount || 0)
        : 0;

      const loadSiteLabel = getSiteLabelById(a.site_id);
      if (bankDebitAmount > 0) {
        transactionRows.push({
          assignment_id: a.assignment_id,
          assignment_date: assignmentDate,
          ts,
          type: "ATM Load",
          atm: loadSiteLabel,
          debit: bankDebitAmount,
          credit: 0,
          remarks: "",
        });
      }
      if (internalCreditAmount > 0) {
        transactionRows.push({
          assignment_id: a.assignment_id,
          assignment_date: assignmentDate,
          ts,
          type: "ATM Internal Load",
          atm: loadSiteLabel,
          debit: 0,
          credit: internalCreditAmount,
          remarks: "",
        });
      }
    });

    // Process excess cash
    (printTransactions.excessCash || []).forEach((e: any) => {
      const ts = normalizeUtcDate(e.created_at || e.reported_at) || new Date();
      const assignmentDate = printTransactions.assignmentDates.get(e.assignment_id) || "";
      const creditAmount = (e.denom_100 || 0) * 100 + (e.denom_200 || 0) * 200 + (e.denom_500 || 0) * 500 + (e.denom_2000 || 0) * 2000;

      const excessSiteLabel = getSiteLabelById(e.site_id);
      if (creditAmount > 0) {
        transactionRows.push({
          assignment_id: e.assignment_id,
          assignment_date: assignmentDate,
          ts,
          type: "Excess Cash",
          atm: excessSiteLabel,
          debit: 0,
          credit: creditAmount,
          remarks: e.remarks || "",
        });
      }
    });

    // Process adjustments (keep these as individual items)
    (printTransactions.adjustments || []).forEach((adj: any) => {
      const ts = normalizeUtcDate(adj.created_at) || new Date();
      const assignmentDate = printTransactions.assignmentDates.get(adj.assignment_id) || "";

      if (adj.adjustment_type === "EXCHANGE") {
        const total = Number(adj.exchange_metadata?.total_amount || 0);
        const remarks = adj.exchange_metadata?.from_bank_name && adj.exchange_metadata?.to_bank_name
          ? `${adj.exchange_metadata.from_bank_name} to ${adj.exchange_metadata.to_bank_name}`
          : "";
        if (total > 0) {
          const atmLabel = getAssignmentSiteLabel(adj.assignment_id);
          transactionRows.push({
            assignment_id: adj.assignment_id,
            assignment_date: assignmentDate,
            ts,
            type: "Exchange (Out)",
            atm: atmLabel,
            debit: 0,
            credit: -total,
            remarks,
          });
          transactionRows.push({
            assignment_id: adj.assignment_id,
            assignment_date: assignmentDate,
            ts,
            type: "Exchange (In)",
            atm: atmLabel,
            debit: 0,
            credit: total,
            remarks,
          });
        }
      }
      if (adj.adjustment_type === "INTER_SITE_TRANSFER") {
        const sourceTotal = Number(
          adj.transfer_metadata?.source_total_amount ||
            adj.transfer_metadata?.total_amount ||
            0
        );
        const sourceSiteName = adj.transfer_metadata?.source_site_name || "";
        const destinations = adj.transfer_metadata?.destinations || [];
        
        // Source removal (negative credit - cash leaving)
        if (sourceTotal > 0) {
          transactionRows.push({
            assignment_id: adj.assignment_id,
            assignment_date: assignmentDate,
            ts,
            type: "Inter-site Transfer (Out)",
            atm: sourceSiteName,
            debit: 0,
            credit: -sourceTotal,
            remarks: `Transferred to ${destinations.length} site(s)`,
          });
        }
        
        // Destination loads (positive credit - cash arriving)
        destinations.forEach((dest: any) => {
          const destAmount = Number(dest.total_amount || 0);
          if (destAmount > 0) {
            transactionRows.push({
              assignment_id: adj.assignment_id,
              assignment_date: assignmentDate,
              ts,
              type: "Inter-site Transfer (In)",
              atm: dest.site_name || "",
              debit: 0,
              credit: destAmount,
              remarks: `From ${sourceSiteName}`,
            });
          }
        });
      }
    });

    const sorted = transactionRows.sort((a, b) => {
      if (a.assignment_date !== b.assignment_date) {
        return a.assignment_date.localeCompare(b.assignment_date);
      }
      if (a.assignment_id !== b.assignment_id) {
        return a.assignment_id - b.assignment_id;
      }
      return a.ts.getTime() - b.ts.getTime();
    });

    // Calculate running balance (exclude excess cash - it's handed over to vendor)
    let running = 0;
    let currentAssignment = -1;
    return sorted.map((row) => {
      if (row.assignment_id !== currentAssignment) {
        currentAssignment = row.assignment_id;
        running = printTransactions.openingBalances.get(row.assignment_id) || 0;
      }
      
      // Excess cash is handed over to vendor (India One), so don't include in balance
      const isExcessCash = row.type.includes("Excess Cash");
      if (!isExcessCash) {
        running += row.credit - row.debit;
      }
      
      return { ...row, balance: running };
    });
  }, [printTransactions]);

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
          "Bank Picked",
          "ATM Picked",
          "Bank Loaded",
          "ATM Loaded",
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
            row.bank_picked ?? row.cash_picked,
            row.internal_picked ?? 0,
            row.bank_loaded ?? row.cash_loaded,
            row.internal_loaded ?? 0,
            row.travel_km,
            ...(showAllowance ? [row.travel_allowance] : []),
            getFinalNet(row),
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
                src={bankLogoSrc}
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

        <div className="print-only">
          <table className="print-statement-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Time</th>
                <th>Transaction Type</th>
                <th>ATM</th>
                <th>Debit</th>
                <th>Credit</th>
                <th>Balance</th>
                <th>Remarks</th>
              </tr>
            </thead>
            <tbody>
              {printStatementRows.map((row, idx) => (
                <tr key={`print-row-${idx}`} className="print-statement-row">
                  <td>{formatISTDate(row.ts, "short")}</td>
                  <td>{formatISTTime(row.ts)}</td>
                  <td>{row.type}</td>
                  <td>{row.atm}</td>
                  <td className="text-right">
                    {row.debit !== 0
                      ? row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                      : "-"}
                  </td>
                  <td className="text-right">
                    {row.credit !== 0
                      ? row.credit.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                      : "-"}
                  </td>
                  <td className="text-right">
                    {row.balance.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                  </td>
                  <td>{row.remarks || ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print:hidden print-hidden">
          {/* ===== Page Header (Hidden on Print) ===== */}
          <div className="space-y-2">
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

          {/* ===== Load Source Breakdown Info ===== */}
          {!loading && viewMode === "summary" && summaryTotals.internalLoaded > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              💡 Cash Load Breakdown
            </h3>
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium">Total Bank Cash Loaded: ₹{summaryTotals.cashLoaded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              <p className="ml-4">├─ From Bank: ₹{summaryTotals.bankLoaded.toLocaleString("en-IN", { minimumFractionDigits: 2 })} <span className="text-green-700">(included in SOA)</span></p>
              <p className="ml-4">└─ Internal Transfers: ₹{summaryTotals.internalLoaded.toLocaleString("en-IN", { minimumFractionDigits: 2 })} <span className="text-slate-700">(neutral - already accounted)</span></p>
            </div>
            <p className="text-xs text-blue-700 mt-2 italic">
              Internal ATM transfers do not affect vendor reconciliation. They represent cash moved between sites.
            </p>
          </div>
        )}

          {/* ===== KPI Section ===== */}
          {!loading && viewMode === "summary" && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-3 sm:gap-4">
            <KPI
              label="Bank Picked"
              value={summaryTotals.bankPicked}
              subtext="₹"
              color="blue"
            />
            <KPI
              label="ATM Picked"
              value={summaryTotals.internalPicked}
              subtext="₹"
              color="slate"
            />
            <KPI
              label="Bank Loaded"
              value={summaryTotals.bankLoaded}
              subtext="₹"
              color="green"
            />
            <KPI
              label="ATM Loaded"
              value={summaryTotals.internalLoaded}
              subtext="₹"
              color="slate"
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
                        Math.abs(getFinalNet(r)) >= 0.01;
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
                              <p className="text-slate-500">Bank Picked</p>
                              <p className="font-semibold text-slate-900">
                                ₹{(r.bank_picked ?? r.cash_picked).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">ATM Picked</p>
                              <p className="font-semibold text-slate-900">
                                ₹{(r.internal_picked ?? 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Bank Loaded</p>
                              <p className="font-semibold text-green-700">
                                ₹{(r.bank_loaded ?? r.cash_loaded).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">ATM Loaded</p>
                              <p className="font-semibold text-slate-700">
                                ₹{(r.internal_loaded ?? 0).toLocaleString("en-IN", {
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
                              ₹{getFinalNet(r).toLocaleString(
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
                            Bank Picked
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            ATM Picked
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            Bank Loaded
                          </th>
                          <th className="px-4 py-3 text-right font-semibold text-slate-700">
                            ATM Loaded
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
                            Math.abs(getFinalNet(r)) >= 0.01;
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
                                {(r.bank_picked ?? r.cash_picked).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-700 font-medium">
                                {(r.internal_picked ?? 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-green-700 font-medium">
                                {(r.bank_loaded ?? r.cash_loaded).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-slate-700">
                                {(r.internal_loaded ?? 0) > 0
                                  ? (r.internal_loaded ?? 0).toLocaleString("en-IN", {
                                      minimumFractionDigits: 2,
                                    })
                                  : "-"}
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
                                  {getFinalNet(r).toLocaleString(
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
                            {summaryTotals.bankPicked.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            {summaryTotals.internalPicked.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">
                            {summaryTotals.bankLoaded.toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-700">
                            {summaryTotals.internalLoaded.toLocaleString("en-IN", {
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
