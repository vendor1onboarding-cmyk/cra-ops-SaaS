import { useEffect, useState, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import AppLayout from "../components/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getISTDateString,
  getISTMonthStart,
  formatISTDate,
  formatISTTime,
  parseUTCDate,
} from "../utils/time";

// Print styles for operational settlement report
const printStyles = `
  @page {
    size: A4 portrait;
    margin: 8mm;
  }

  @media print {
    .print-statement-table {
      table-layout: auto;
      width: 100%;
      font-size: 10px;
      border-collapse: collapse;
    }
    
    .print-statement-table th,
    .print-statement-table td {
      border: 1px solid #000;
      padding: 5px 4px;
      word-break: break-word;
      overflow-wrap: break-word;
      white-space: normal;
      overflow: visible;
      text-overflow: clip;
      vertical-align: top;
    }

    .print-statement-table th:nth-child(1),
    .print-statement-table td:nth-child(1),
    .print-statement-table th:nth-child(2),
    .print-statement-table td:nth-child(2) {
      white-space: nowrap;
      min-width: 76px;
      word-break: normal;
      overflow-wrap: normal;
    }
    
    .print-statement-table th {
      background-color: #f3f4f6;
      font-weight: bold;
      text-align: left;
    }
    
    .print-statement-table td.text-right {
      text-align: right;
    }
    
    .print-statement-row {
      page-break-inside: avoid;
    }
    
    /* Allocate wider column for Transaction Type to accommodate bank names */
    .print-statement-table th:nth-child(3),
    .print-statement-table td:nth-child(3) {
      width: 30%;
      min-width: 100px;
    }

    .print-statement-table th:nth-child(8),
    .print-statement-table td:nth-child(8) {
      min-width: 90px;
    }
    
    .print-only {
      display: block !important;
    }
    
    .print:hidden {
      display: none !important;
    }
  }
`;

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
  bank_withdrawals?: number;
  internal_withdrawals?: number;
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

type AdjustmentDetail = {
  id: number;
  adjustment_type: string;
  adjustment_amount: number;
  reason: string;
  reference?: string;
  exchange_metadata?: any;
  transfer_metadata?: any;
  created_at: string;
};

export default function StatementOfAccounts() {
  const location = useLocation();
  const { profile } = useAuth();

  // Read initial filter values from URL query params (only on first mount)
  function getInitialFromQuery(param: string, fallback: string) {
    const params = new URLSearchParams(location.search);
    return params.get(param) || fallback;
  }

  const [viewMode, setViewMode] = useState<"summary" | "detailed">(() => {
    const v = getInitialFromQuery("view", "summary");
    return v === "detailed" ? "detailed" : "summary";
  });
  const [summaryRows, setSummaryRows] = useState<SOASummaryRow[]>([]);
  const [detailedRows, setDetailedRows] = useState<SOADetailedRow[]>([]);
  const [loadSourceData, setLoadSourceData] = useState<Map<number, { bank: number; internal: number }>>(new Map());
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [adjustmentDetails, setAdjustmentDetails] = useState<Map<number, AdjustmentDetail[]>>(new Map());
  const [loadingAdjustments, setLoadingAdjustments] = useState<Set<number>>(new Set());
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
  const [custodianSignatureUrl, setCustodianSignatureUrl] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "open" | "submitted" | "approved" | "rejected"
  >("ALL");
  const [custodianFilter, setCustodianFilter] = useState(() => getInitialFromQuery("custodian", "ALL"));
  const [custodianOptions, setCustodianOptions] = useState<
    { id: string; full_name: string }[]
  >([]);

  // Initialize dates based on IST timezone or URL
  const [fromDate, setFromDate] = useState(() => getInitialFromQuery("from", getISTMonthStart()));
  const [toDate, setToDate] = useState(() => getInitialFromQuery("to", getISTDateString()));

  const isAdmin = profile?.role === "admin" || profile?.role === "supervisor";
  const showAllowance = isAdmin;
  const bankLogoSrc = `${import.meta.env.BASE_URL}bank-logo.png`;

  // Inject print styles
  useEffect(() => {
    const styleTag = document.createElement("style");
    styleTag.textContent = printStyles;
    document.head.appendChild(styleTag);
    
    return () => {
      document.head.removeChild(styleTag);
    };
  }, []);

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
                bank_withdrawals,
                internal_withdrawals,
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
                .select("id, status, eod_signature_url, eod_signed")
                .in("id", assignmentIds);

              const statusMap = new Map(
                (assignments || []).map((a: any) => [a.id, a.status])
              );

              rows = rows.map((row: any) => {
                const sources = sourceMap.get(row.assignment_id ?? row.soa_id);
                const bankPicked = row.bank_picked ?? row.cash_picked;
                const internalPicked = row.internal_picked ?? 0;
                // CRITICAL: Use sources from v_atm_load_sources (aggregated source_breakdown)
                // These values come from summing bank_source.total_amount and internal_source.total_amount
                // across all ATM loads for this assignment, ensuring proper separation
                const bankLoaded = sources?.bank ?? Number(row.bank_loaded ?? 0);
                // Internal movement in SOA must be sourced from ATM_INTERNAL pickups only.
                const internalLoaded = Number(internalPicked);
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
                      .select("assignment_id, adjustment_type, exchange_metadata, transfer_metadata, created_at, custodian_confirmed, custodian_confirmed_at, custodian_signature_url")
                      .in("assignment_id", assignmentIds)
                      .or(`and(adjustment_type.in.(EXCHANGE,INTER_SITE_TRANSFER)),and(exchange_metadata->>type.eq.ADMIN_CORRECTION,custodian_confirmed.eq.true)`),
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

  useEffect(() => {
    if (!profile) return;

    async function loadLoggedInCustodianSignature() {
      if (profile.role !== "custodian") {
        setCustodianSignatureUrl(null);
        return;
      }

      const { data, error } = await supabase
        .from("assignments")
        .select("eod_signature_url")
        .eq("custodian_id", profile.id)
        .eq("eod_signed", true)
        .not("eod_signature_url", "is", null)
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error("Error loading custodian signature:", error);
        setCustodianSignatureUrl(null);
        return;
      }

      setCustodianSignatureUrl(data?.eod_signature_url || null);
    }

    loadLoggedInCustodianSignature();
  }, [profile]);


  const getClosingBalance = (row: SOADetailedRow) => {
    // CRITICAL: Closing Balance = Only Bank Cash movement (bank picked - bank loaded)
    // Internal transfers between ATMs are movements, not cash position changes
    // They are tracked separately as transfers, not in closing balance
    return (row.bank_withdrawals ?? row.opening_balance ?? 0) - row.total_loads;
  };

  const toggleRowExpansion = async (assignmentId: number) => {
    const newExpanded = new Set(expandedRows);
    
    if (newExpanded.has(assignmentId)) {
      newExpanded.delete(assignmentId);
      setExpandedRows(newExpanded);
    } else {
      newExpanded.add(assignmentId);
      setExpandedRows(newExpanded);
      
      // Fetch adjustment details if not already loaded
      if (!adjustmentDetails.has(assignmentId)) {
        setLoadingAdjustments(new Set(loadingAdjustments).add(assignmentId));
        
        try {
          const { data, error } = await supabase
            .from("soa_adjustments")
            .select("id, adjustment_type, adjustment_amount, reason, reference, exchange_metadata, transfer_metadata, created_at")
            .eq("assignment_id", assignmentId)
            .in("adjustment_type", ["EXCHANGE", "INTER_SITE_TRANSFER"])
            .order("created_at", { ascending: false });
          
          if (!error && data) {
            setAdjustmentDetails(new Map(adjustmentDetails).set(assignmentId, data));
          }
        } catch (err) {
          console.error("Error loading adjustment details:", err);
        } finally {
          const newLoading = new Set(loadingAdjustments);
          newLoading.delete(assignmentId);
          setLoadingAdjustments(newLoading);
        }
      }
    }
  };

  const getFinalNet = (row: SOASummaryRow) => {
    // CRITICAL: Cash-in-Hand = Total Picked - Total Loaded (INCLUDES both Bank and ATM_INTERNAL)
    // This must match ATMReplenishment, Dashboard, and EOD calculations to avoid inconsistency
    // ATM_INTERNAL pickups ARE part of available cash for ATM replenishment
    const totalPicked = (row.bank_picked ?? row.cash_picked) + (row.internal_picked ?? 0);
    const totalLoaded = (row.bank_loaded ?? 0) + (row.internal_loaded ?? 0);
    return totalPicked - totalLoaded;
  };

  // Calculate totals
  const summaryTotals = useMemo(() => {
    return summaryRows.reduce(
      (acc, r) => {
        acc.cashPicked += r.cash_picked;
        acc.cashLoaded += r.bank_loaded ?? 0;
        acc.bankPicked += r.bank_picked ?? r.cash_picked;
        acc.internalPicked += r.internal_picked ?? 0;
        acc.bankLoaded += r.bank_loaded ?? 0;
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

  // ATM load time_in has mixed historical formats across app versions.
  // Resolve timestamps by preferring the interpretation that matches
  // assignment_date in IST, which avoids false midnight shifts.
  const normalizeLoadDate = (value: string | Date | undefined, assignmentDate?: string) => {
    if (!value) return null;
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    const hasTimezone = /[zZ]|[+-]\d{2}(:?\d{2})?$/.test(raw);
    const parsedAsUtc = parseUTCDate(raw);

    const normalized = raw.includes("T") ? raw : raw.replace(" ", "T");
    const withoutTz = normalized.replace(/[zZ]|[+-]\d{2}(:?\d{2})?$/, "");
    const parsedAsIstClock = new Date(`${withoutTz}+05:30`);

    const getIstDateKey = (d: Date | null) =>
      d
        ? d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
        : "";

    if (assignmentDate) {
      const utcKey = getIstDateKey(parsedAsUtc);
      const istClockKey = !isNaN(parsedAsIstClock.getTime()) ? getIstDateKey(parsedAsIstClock) : "";

      if (utcKey === assignmentDate && istClockKey !== assignmentDate) {
        return parsedAsUtc;
      }
      if (istClockKey === assignmentDate && utcKey !== assignmentDate) {
        return parsedAsIstClock;
      }
      if (utcKey === assignmentDate && istClockKey === assignmentDate) {
        return parsedAsUtc;
      }
    }

    if (hasTimezone && parsedAsUtc) {
      const hourInIst = Number(
        parsedAsUtc.toLocaleString("en-IN", {
          timeZone: "Asia/Kolkata",
          hour: "2-digit",
          hour12: false,
        })
      );

      // Legacy encoded records may appear around 00:00-03:59 after UTC conversion.
      if (!isNaN(hourInIst) && hourInIst <= 3 && !isNaN(parsedAsIstClock.getTime())) {
        return parsedAsIstClock;
      }

      return parsedAsUtc;
    }

    if (!isNaN(parsedAsIstClock.getTime())) {
      return parsedAsIstClock;
    }

    return parsedAsUtc;
  };

  const printStatementRows = useMemo(() => {
    if (!printTransactions) return [];

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
      balanceImpact: number;
      remarks: string;
      bank_name?: string;
    }> = [];

    // Build a map of assignments with bank pickups (to handle legacy loads correctly)
    const assignmentsWithBankPickup = new Set<number>();
    (printTransactions.cashPickups || []).forEach((c: any) => {
      const isInternal = (c.pickup_source || "BANK") === "ATM_INTERNAL";
      if (!isInternal) {
        assignmentsWithBankPickup.add(c.assignment_id);
      }
    });

    // ──────────────────────────────────────────────────────────────
    // CHRONOLOGICAL EVENT PROCESSING
    // Merge pickups + ATM loads into a single timeline so that:
    //   • Each bank withdrawal / ATM removal adds to the pool first
    //   • Each ATM load consumes from the pool available at that moment
    // This supports multiple removals and withdrawals at any time of day.
    // ──────────────────────────────────────────────────────────────

    type TimelineEvent = {
      kind: "pickup" | "load";
      assignment_id: number;
      ts: Date;
      raw: any;
    };

    const timeline: TimelineEvent[] = [];

    (printTransactions.cashPickups || []).forEach((c: any) => {
      timeline.push({
        kind: "pickup",
        assignment_id: c.assignment_id,
        ts: normalizeUtcDate(c.pickup_time) || new Date(),
        raw: c,
      });
    });

    (printTransactions.atmLoads || []).forEach((a: any) => {
      const assignmentDate = printTransactions.assignmentDates.get(a.assignment_id) || "";
      timeline.push({
        kind: "load",
        assignment_id: a.assignment_id,
        ts: normalizeLoadDate(a.time_in, assignmentDate) || new Date(),
        raw: a,
      });
    });

    // Sort: by assignment, then by time, pickups before loads at same time
    timeline.sort((a, b) => {
      if (a.assignment_id !== b.assignment_id) return a.assignment_id - b.assignment_id;
      const timeDiff = a.ts.getTime() - b.ts.getTime();
      if (timeDiff !== 0) return timeDiff;
      // Pickups come before loads at the same timestamp
      return (a.kind === "pickup" ? 0 : 1) - (b.kind === "pickup" ? 0 : 1);
    });

    // Live denomination pools that grow with each removal and shrink with each load
    const removalPools = new Map<number, { [key: number]: number }>();

    const getOrCreatePool = (assignmentId: number) => {
      let pool = removalPools.get(assignmentId);
      if (!pool) {
        pool = { 100: 0, 200: 0, 500: 0, 2000: 0 };
        removalPools.set(assignmentId, pool);
      }
      return pool;
    };

    // Process every event in chronological order
    timeline.forEach((evt) => {
      if (evt.kind === "pickup") {
        const c = evt.raw;
        const ts = evt.ts;
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

        const internalSources = c.internal_source_metadata?.sources || [];
        const internalTotal = internalSources.reduce(
          (sum: number, s: any) => sum + Number(s.total_amount || 0),
          0
        );
        const pickupSiteLabel = getSiteLabelById(c.source_site_id);

        if (isInternal) {
          const amount = internalTotal > 0 ? internalTotal : creditAmount;
          if (amount > 0) {
            // Add denominations to the removal pool (accumulates across multiple removals)
            const pool = getOrCreatePool(c.assignment_id);
            for (const d of [100, 200, 500, 2000]) {
              pool[d] += (c[`denom_${d}`] || 0);
            }

            transactionRows.push({
              assignment_id: c.assignment_id,
              assignment_date: assignmentDate,
              ts,
              type: "ATM Cash Removal",
              atm: pickupSiteLabel,
              debit: 0,
              credit: -amount,
              balanceImpact: amount,
              remarks: "",
            });
          }
          return;
        }

        // Bank pickup
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
            balanceImpact: bankAmount,
            remarks: "",
            bank_name: c.bank_name || "",
          });
        }
        if (internalTotal > 0) {
          // Mixed pickup with internal component — add to removal pool
          const pool = getOrCreatePool(c.assignment_id);
          for (const d of [100, 200, 500, 2000]) {
            pool[d] += (c[`denom_${d}`] || 0);
          }

          transactionRows.push({
            assignment_id: c.assignment_id,
            assignment_date: assignmentDate,
            ts,
            type: "ATM Cash Removal",
            atm: pickupSiteLabel,
            debit: -internalTotal,
            credit: 0,
            balanceImpact: internalTotal,
            remarks: "",
          });
        }
      } else {
        // ── ATM LOAD ──
        const a = evt.raw;
        const ts = evt.ts;
        const assignmentDate = printTransactions.assignmentDates.get(a.assignment_id) || "";
        const hasBankPickup = assignmentsWithBankPickup.has(a.assignment_id);
        const pool = removalPools.get(a.assignment_id);
        const loadSiteLabel = getSiteLabelById(a.site_id);

        let loadBankAmount = 0;
        let loadInternalAmount = 0;

        if (pool) {
          // Denomination-level matching: consume from pool available at this moment
          for (const denom of [100, 200, 500, 2000]) {
            const loadCount = (a[`denom_${denom}`] || 0) as number;
            const poolCount = pool[denom] || 0;
            const matchedCount = Math.min(loadCount, poolCount);

            loadInternalAmount += matchedCount * denom;
            loadBankAmount += (loadCount - matchedCount) * denom;

            // Consume matched denominations from the removal pool
            pool[denom] = poolCount - matchedCount;
          }
        } else {
          // No ATM removal for this assignment - all bank-sourced
          loadBankAmount = hasBankPickup
            ? (a.denom_100 || 0) * 100 +
              (a.denom_200 || 0) * 200 +
              (a.denom_500 || 0) * 500 +
              (a.denom_2000 || 0) * 2000
            : 0;
        }

        const totalLoaded = loadBankAmount + loadInternalAmount;

        if (totalLoaded > 0) {
          // CRITICAL FIX: Debit includes BOTH bank + internal for running balance
          // Internal removal increases balance (+₹X), internal load must decrease it (-₹X)
          // This ensures end-of-day balance = 0 when all internal transfers are matched
          // Note: This does NOT affect SOA KPI totals (bank_loaded remains bank-only in DB)
          transactionRows.push({
            assignment_id: a.assignment_id,
            assignment_date: assignmentDate,
            ts,
            type: "ATM Load",
            atm: loadSiteLabel,
            debit: totalLoaded, // Bank + Internal (both reduce running balance)
            credit: 0,
            balanceImpact: -totalLoaded, // Total load reduces cash-in-hand
            remarks: loadInternalAmount > 0
              ? `Bank: ₹${loadBankAmount.toLocaleString("en-IN")} | Internal ATM Transfer: ₹${loadInternalAmount.toLocaleString("en-IN")}`
              : "",
          });
        }
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
          balanceImpact: creditAmount,
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
            balanceImpact: -total,
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
            balanceImpact: total,
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
        
        // Source removal (negative debit - cash leaving)
        if (sourceTotal > 0) {
          transactionRows.push({
            assignment_id: adj.assignment_id,
            assignment_date: assignmentDate,
            ts,
            type: "Inter-site Transfer (Out)",
            atm: sourceSiteName,
            debit: -sourceTotal,
            credit: 0,
            balanceImpact: -sourceTotal,
            remarks: `Transferred to ${destinations.length} site(s)`,
          });
        }
        
        // Destination loads (positive debit - cash arriving)
        destinations.forEach((dest: any) => {
          const destAmount = Number(dest.total_amount || 0);
          if (destAmount > 0) {
            transactionRows.push({
              assignment_id: adj.assignment_id,
              assignment_date: assignmentDate,
              ts,
              type: "Inter-site Transfer (In)",
              atm: dest.site_name || "",
              debit: destAmount,
              credit: 0,
              balanceImpact: destAmount,
              remarks: `From ${sourceSiteName}`,
            });
          }
        });
      }

      // Admin Correction (confirmed only)
      if (adj.exchange_metadata?.type === "ADMIN_CORRECTION" && adj.custodian_confirmed) {
        const deltaTotal = Number(adj.exchange_metadata?.delta_total || 0);
        const signatureIndicator = adj.custodian_signature_url ? "✓ Signed" : "Unsigned";
        const remarks = `Correction approved by Custodian (${signatureIndicator})`;

        if (deltaTotal !== 0) {
          transactionRows.push({
            assignment_id: adj.assignment_id,
            assignment_date: assignmentDate,
            ts: normalizeUtcDate(adj.custodian_confirmed_at) || new Date(),
            type: "Admin Correction",
            atm: "Adjustment",
            debit: deltaTotal > 0 ? deltaTotal : 0,
            credit: deltaTotal < 0 ? -deltaTotal : 0,
            balanceImpact: deltaTotal,
            remarks,
          });
        }
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

    // Calculate running balance using balanceImpact
    // - Pickups (Bank/ATM Removal): positive impact (cash entering custody)
    // - ATM Loads: negative impact (total cash leaving, regardless of source)
    // - Excess Cash: excluded (handed over to vendor)
    // 
    // OPERATIONAL MODEL: Print ledger represents daily operational settlement.
    // Running balance starts at 0 each day (opening balance excluded intentionally).
    // This differs from accounting model where opening balance carries forward.
    //
    // Running balance should reflect actual operations; no synthetic reconciliation row.
    let running = 0;
    let currentAssignment = -1;
    
    return sorted.flatMap((row, index, array) => {
      if (row.assignment_id !== currentAssignment) {
        currentAssignment = row.assignment_id;
        // Operational daily settlement: start fresh at 0 each day
        running = 0;
      }
      
      // Excess cash is handed over to vendor (India One), so don't include in balance
      const isExcessCash = row.type.includes("Excess Cash");
      if (!isExcessCash) {
        running += row.balanceImpact;
      }
      
      const outputRow = { ...row, balance: running };
      
      return [outputRow];
    }).filter((row) => row.type !== "Reconciliation Adjustment");
  }, [printTransactions]);

  const summaryTravelKmTotal = useMemo(() => {
    return summaryRows.reduce((acc, r) => acc + (r.travel_km || 0), 0);
  }, [summaryRows]);

  const detailedTotals = useMemo(() => {
    return detailedRows.reduce(
      (acc, r) => {
        acc.opening += r.opening_balance;
        // CRITICAL: withdrawals = only bank withdrawals (internal transfers shown separately)
        const bankWithdrawals = r.bank_withdrawals ?? r.opening_balance ?? 0;
        acc.withdrawals += bankWithdrawals;
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
          "Internal Movement",
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
            row.bank_loaded ?? 0,
            row.internal_picked ?? 0,
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
                <h1 className="text-xl font-bold">Cash Track Pro</h1>
                <p className="text-xs text-slate-600">
                  Track, Manage, Deliver
                </p>
              </div>
            </div>

            <div className="text-right text-xs">
              <p className="font-semibold">Operational Daily Settlement Report</p>
              <p>Period: {fromDate} to {toDate}</p>
              <p>Date: {new Date().toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}</p>
              <p>Time: {new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true })} IST</p>
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
              {printStatementRows.map((row) => (
                <tr
                  key={`print-row-${row.assignment_id || row.id || ''}-${row.type}-${row.ts instanceof Date ? row.ts.getTime() : row.ts}-${row.atm}`}
                  className="print-statement-row"
                >
                  <td>{formatISTDate(row.ts, "short")}</td>
                  <td>{formatISTTime(row.ts)}</td>
                  <td>
                    {row.type === "Bank Pickup" && row.bank_name
                      ? `${row.type} – ${row.bank_name}`
                      : row.type}
                  </td>
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

          {/* ===== Load Source Breakdown & Internal Movement Info ===== */}
          {!loading && viewMode === "summary" && (summaryTotals.bankLoaded > 0 || summaryTotals.internalPicked > 0) && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-blue-900 mb-2">
              💡 Cash Flow Summary (Month-End)
            </h3>
            <div className="text-xs text-blue-800 space-y-1">
              <p className="font-medium text-green-700">✓ Total ATM Cash Loaded (SOA): ₹{summaryTotals.bankLoaded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
              <p className="ml-4 text-slate-600">From Bank withdrawals → Affects Closing Balance</p>
              {summaryTotals.internalPicked > 0 && (
                <>
                  <p className="font-medium mt-2 text-blue-700">⟷ Internal ATM Transfers (Neutral): ₹{summaryTotals.internalPicked.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                  <p className="ml-4 text-slate-600">Movement between ATMs → Net Impact = 0 (not in SOA KPI)</p>
                </>
              )}
            </div>
            <p className="text-xs text-blue-700 mt-3 italic border-t border-blue-200 pt-2">
              Internal transfers: Same amount removed from one ATM + loaded to another = cancels out. Visible for audit, not counted in month-end totals.
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
              label="Transfers"
              value={summaryTotals.internalPicked}
              subtext="₹"
              color="slate"
              highlight={false}
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
                    {summaryRows.map((r) => {
                      const netUnbalanced =
                        Math.abs(getFinalNet(r)) >= 0.01;
                      return (
                        <div
                          key={r.assignment_id || r.soa_id || r.id}
                          className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-semibold text-slate-900">
                              {formatISTDate(r.assignment_date, "short") || r.assignment_date || "—"}
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
                                ₹{(r.bank_loaded ?? 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Transfers</p>
                              <p className="font-semibold text-blue-700">
                                ₹{(r.internal_picked ?? 0).toLocaleString("en-IN", {
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
                              className={`flex items-center gap-1 px-2 py-1 rounded font-semibold ${
                                netUnbalanced
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-emerald-100 text-emerald-900"
                              }`}
                            >
                              {netUnbalanced && <span title="Unreconciled">⚠️</span>}
                              ₹{getFinalNet(r).toLocaleString(
                                "en-IN",
                                { minimumFractionDigits: 2 }
                              )}
                              {netUnbalanced && (
                                <span className="ml-1 text-xs font-normal text-amber-900">Unreconciled</span>
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
                            Final Net
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {summaryRows.map((r) => {
                          const netUnbalanced =
                            Math.abs(getFinalNet(r)) >= 0.01;
                          return (
                            <tr
                              key={r.assignment_id || r.soa_id || r.id}
                              className="hover:bg-slate-50 transition-colors"
                            >
                              <td className="px-4 py-3 text-slate-900">
                                {formatISTDate(r.assignment_date, "short") || r.assignment_date || "—"}
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
                                {(r.bank_loaded ?? 0).toLocaleString("en-IN", {
                                  minimumFractionDigits: 2,
                                })}
                              </td>
                              <td className="px-4 py-3 text-right text-blue-700 font-medium">
                                {(r.internal_picked ?? 0).toLocaleString("en-IN", {
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
                            {summaryTotals.internalPicked.toLocaleString("en-IN", {
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
                    {detailedRows.map((r) => {
                      const closing = getClosingBalance(r);
                      const balanced = Math.abs(closing) < 0.01;
                      return (
                        <div
                          key={r.assignment_id || r.soa_id || r.id}
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
                        {detailedRows.map((r) => {
                          const closing = getClosingBalance(r);
                          const balanced = Math.abs(closing) < 0.01;
                          const hasAdjustments = (r.exchange_count + r.transfer_count) > 0;
                          const isExpanded = expandedRows.has(r.assignment_id);
                          const adjustments = adjustmentDetails.get(r.assignment_id) || [];
                          const isLoadingAdj = loadingAdjustments.has(r.assignment_id);
                          
                          return (
                            <>
                              <tr
                                key={r.assignment_id || r.soa_id || r.id}
                                className="hover:bg-slate-50 transition-colors"
                              >
                                <td className="px-4 py-3 text-slate-900">
                                  {formatISTDate(r.assignment_date, "short") || r.assignment_date || "—"}
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
                                <td className="px-4 py-3 text-right">
                                  {hasAdjustments ? (
                                    <button
                                      onClick={() => toggleRowExpansion(r.assignment_id)}
                                      className="inline-flex items-center gap-1 text-yellow-700 hover:text-yellow-900 font-medium text-sm transition-colors"
                                      title="Click to see exchange details"
                                    >
                                      <span>{r.exchange_count}</span>
                                      <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-900">{r.exchange_count}</span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  {hasAdjustments ? (
                                    <button
                                      onClick={() => toggleRowExpansion(r.assignment_id)}
                                      className="inline-flex items-center gap-1 text-blue-700 hover:text-blue-900 font-medium text-sm transition-colors"
                                      title="Click to see transfer details"
                                    >
                                      <span>{r.transfer_count}</span>
                                      <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                                    </button>
                                  ) : (
                                    <span className="text-slate-900">{r.transfer_count}</span>
                                  )}
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
                                  <div className="flex items-center justify-end gap-2">
                                    <span
                                      className={`inline-block rounded px-2 py-1 font-semibold text-xs ${
                                        balanced
                                          ? "bg-emerald-100 text-emerald-900"
                                          : "bg-amber-100 text-amber-900"
                                      }`}
                                    >
                                      ₹{closing.toLocaleString("en-IN", {
                                        minimumFractionDigits: 2,
                                      })}
                                    </span>
                                    {balanced ? (
                                      <span className="text-emerald-600 text-sm font-bold" title="Balanced">✓</span>
                                    ) : (
                                      <span className="text-amber-600 text-sm font-bold" title="Unreconciled">⚠️</span>
                                    )}
                                  </div>
                                </td>
                              </tr>
                              
                              {/* Expandable adjustment details row */}
                              {isExpanded && (
                                <tr className="bg-slate-50">
                                  <td colSpan={isAdmin ? 12 : 11} className="px-4 py-4">
                                    {isLoadingAdj ? (
                                      <div className="flex items-center justify-center py-4 text-slate-600">
                                        <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-slate-400 mr-2" />
                                        Loading adjustment details...
                                      </div>
                                    ) : adjustments.length > 0 ? (
                                      <div className="space-y-3">
                                        <h4 className="text-sm font-semibold text-slate-700 mb-2">
                                          📋 Operational Adjustments (Neutral - No Net Impact)
                                        </h4>
                                        {adjustments.map((adj) => (
                                          <div
                                            key={adj.id}
                                            className={`rounded-lg border p-3 ${
                                              adj.adjustment_type === "EXCHANGE"
                                                ? "bg-yellow-50 border-yellow-200"
                                                : "bg-blue-50 border-blue-200"
                                            }`}
                                          >
                                            <div className="flex items-start justify-between mb-2">
                                              <div className="flex items-center gap-2">
                                                <span
                                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                                    adj.adjustment_type === "EXCHANGE"
                                                      ? "bg-yellow-100 text-yellow-800"
                                                      : "bg-blue-100 text-blue-800"
                                                  }`}
                                                >
                                                  {adj.adjustment_type === "EXCHANGE" ? "💱 Exchange" : "🔄 Transfer"}
                                                </span>
                                                <span className="text-xs text-slate-500">
                                                  {formatISTDate(adj.created_at, "short")} {formatISTTime(adj.created_at)}
                                                </span>
                                              </div>
                                            </div>
                                            
                                            <p className="text-sm text-slate-700 mb-2">
                                              <span className="font-medium">Reason:</span> {adj.reason}
                                            </p>
                                            
                                            {adj.exchange_metadata && (
                                              <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                                                <div className="bg-white rounded p-2 border border-yellow-200">
                                                  <p className="font-semibold text-yellow-900 mb-1">From: {adj.exchange_metadata.from_location}</p>
                                                  <p className="text-slate-600">
                                                    {Object.entries(adj.exchange_metadata.from_denominations || {})
                                                      .filter(([_, count]) => (count as number) > 0)
                                                      .map(([denom, count]) => `₹${denom.replace('denom_', '')} × ${count}`)
                                                      .join(', ')}
                                                  </p>
                                                  <p className="font-semibold text-yellow-900 mt-1">
                                                    Total: ₹{(adj.exchange_metadata.total_amount || 0).toLocaleString("en-IN")}
                                                  </p>
                                                </div>
                                                <div className="bg-white rounded p-2 border border-yellow-200">
                                                  <p className="font-semibold text-yellow-900 mb-1">To: {adj.exchange_metadata.to_location}</p>
                                                  <p className="text-slate-600">
                                                    {Object.entries(adj.exchange_metadata.to_denominations || {})
                                                      .filter(([_, count]) => (count as number) > 0)
                                                      .map(([denom, count]) => `₹${denom.replace('denom_', '')} × ${count}`)
                                                      .join(', ')}
                                                  </p>
                                                  <p className="font-semibold text-yellow-900 mt-1">
                                                    Total: ₹{(adj.exchange_metadata.total_amount || 0).toLocaleString("en-IN")}
                                                  </p>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {adj.transfer_metadata && (
                                              <div className="grid grid-cols-2 gap-3 text-xs mt-2">
                                                <div className="bg-white rounded p-2 border border-blue-200">
                                                  <p className="font-semibold text-blue-900 mb-1">From: {adj.transfer_metadata.from_site_name}</p>
                                                  <p className="text-slate-600">
                                                    ₹{(adj.transfer_metadata.amount || 0).toLocaleString("en-IN")}
                                                  </p>
                                                </div>
                                                <div className="bg-white rounded p-2 border border-blue-200">
                                                  <p className="font-semibold text-blue-900 mb-1">To: {adj.transfer_metadata.to_site_name}</p>
                                                  <p className="text-slate-600">
                                                    ₹{(adj.transfer_metadata.amount || 0).toLocaleString("en-IN")}
                                                  </p>
                                                </div>
                                              </div>
                                            )}
                                            
                                            {adj.reference && (
                                              <p className="text-xs text-slate-500 mt-2">
                                                <span className="font-medium">Reference:</span> {adj.reference}
                                              </p>
                                            )}
                                          </div>
                                        ))}
                                      </div>
                                    ) : (
                                      <p className="text-sm text-slate-600 text-center py-2">
                                        No adjustment details available
                                      </p>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
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
              {custodianSignatureUrl ? (
                <img
                  src={custodianSignatureUrl}
                  alt="Custodian Signature"
                  className="mt-2 h-12 w-auto object-contain"
                  style={{ maxHeight: "48px", maxWidth: "180px" }}
                />
              ) : (
                <div className="mt-6 border-b w-48"></div>
              )}
              <p className="mt-1">Name & Date</p>
            </div>

            <div className="sm:text-right">
              <p className="font-semibold">Supervisor / Bank Officer</p>
              <div className="mt-6 border-b w-48 sm:ml-auto"></div>
              <p className="mt-1">Name, Seal & Date</p>
            </div>
          </div>

            <p className="mt-6 text-[9px] sm:text-[10px] text-slate-500">
            This is a system-generated report from Cash Track Pro. Track, Manage, Deliver.
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
