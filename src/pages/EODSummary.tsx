// EOD Summary - Updated 2026-02-12
import React, { useEffect, useMemo, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import SignatureCanvas from "react-signature-canvas";
import { SignatureImage, SignatureModal, preloadSignatureImage } from "../components/SignatureImage";
import {
  getISTDateString,
  getISTMonthStart,
  formatISTDate,
  formatIST,
  formatISTFromUTC,
  formatISTTime,
  parseUTCDate,
} from "../utils/time";


// 🔹 Standard site label formatter
function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

const DENOM_ORDER = [100, 200, 500, 2000];

function denomTotal(row: any) {
  return (
    (row.denom_100 || 0) * 100 +
    (row.denom_200 || 0) * 200 +
    (row.denom_500 || 0) * 500 +
    (row.denom_2000 || 0) * 2000
  );
}

export default function EODSummary() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Custodian data
  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [taskSummary, setTaskSummary] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const modalSigPadRef = useRef<any>(null);
  const [custodianAssignments, setCustodianAssignments] = useState<any[]>([]);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [custodianNotice, setCustodianNotice] = useState<string | null>(null);
  const [travelKm, setTravelKm] = useState(0);

  // Admin data
  const [adminAssignments, setAdminAssignments] = useState<any[]>([]);
  const [issueSummary, setIssueSummary] = useState<any>(null);
  const [eodDetails, setEodDetails] = useState<{
    cashPickups: any[];
    atmLoads: any[];
    excessCash: any[];
    adjustments: any[];
  }>({ cashPickups: [], atmLoads: [], excessCash: [], adjustments: [] });

  const [adminFromDate, setAdminFromDate] = useState(getISTMonthStart());
  const [adminToDate, setAdminToDate] = useState(getISTDateString());
  const [adminStatus, setAdminStatus] = useState<
    "ALL" | "open" | "submitted" | "approved" | "rejected"
  >("ALL");
  const [adminCustodian, setAdminCustodian] = useState("ALL");
  const [adminCustodians, setAdminCustodians] = useState<any[]>([]);

  const today = getISTDateString();

  useEffect(() => {
    if (!profile) return;

    if (profile.role === "custodian") {
      loadCustodianAssignments();
    } else if (profile.role === "admin" || profile.role === "supervisor") {
      loadAdminDashboard();
    }
  }, [profile, adminFromDate, adminToDate, adminStatus, adminCustodian]);

  useEffect(() => {
    if (!profile || profile.role !== "custodian") return;
    if (!selectedAssignmentId) return;
    loadCustodianEOD(selectedAssignmentId);
  }, [profile, selectedAssignmentId]);

  // --------------------------------------------------
  // CUSTODIAN EOD SUMMARY
  // --------------------------------------------------
  async function loadCustodianAssignments() {
    if (!profile) return;
    const { data } = await supabase
      .from("assignments")
      .select("id, assignment_date, status")
      .eq("custodian_id", profile.id)
      .order("assignment_date", { ascending: false })
      .limit(30);

    const rows = data || [];
    setCustodianAssignments(rows);

    const todayAssignment = rows.find((r) => r.assignment_date === today);
    if (todayAssignment) {
      setSelectedAssignmentId(todayAssignment.id);
      setCustodianNotice(null);
      return;
    }

    if (rows.length > 0) {
      setSelectedAssignmentId(rows[0].id);
      setCustodianNotice(
        "No assignment for today. Showing latest available EOD."
      );
      return;
    }

    setSelectedAssignmentId(null);
    setCustodianNotice("No EOD records found yet.");
  }

  async function loadCustodianEOD(assignmentId: number) {
    setLoading(true);

    const { data: assign } = await supabase
      .from("assignments")
      .select("*")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assign) {
      setAssignment(null);
      setRouteSites([]);
      setTaskSummary(null);
      setTravelKm(0);
      setLoading(false);
      return;
    }

    setAssignment(assign);

    const { data: rsites } = await supabase
      .from("route_sites")
      .select(`
        *,
        site:site_id(
          site_code,
          bank_name,
          address,
          atm_id
        )
      `)
      .eq("assignment_id", assign.id)
      .order("sequence_no");

    setRouteSites(rsites || []);

    const [
      denoms,
      pickups,
      loads,
      issues,
      pickupRows,
      loadRows,
      excessRows,
      adjustmentRows,
      travelRows,
    ] = await Promise.all([
      supabase
        .from("denomination_plans")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
      supabase
        .from("cash_pickups")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
      supabase
        .from("atm_replenishments")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("assignment_id", assign.id),
      supabase
        .from("cash_pickups")
        .select("*")
        .eq("assignment_id", assign.id)
        .order("pickup_time", { ascending: true }),
      supabase
        .from("atm_replenishments")
        .select(`*, site:site_id(*)`)
        .eq("assignment_id", assign.id),
      supabase
        .from("atm_excess_cash")
        .select(`*, site:site_id(*)`)
        .eq("assignment_id", assign.id),
      supabase
        .from("soa_adjustments")
        .select("adjustment_type, exchange_metadata, transfer_metadata, created_at")
        .eq("assignment_id", assign.id)
        .in("adjustment_type", ["EXCHANGE", "INTER_SITE_TRANSFER"])
        .order("created_at", { ascending: true }),
      supabase
        .from("travel_logs")
        .select("km_covered")
        .eq("assignment_id", assign.id)
        .eq("status", "completed"),
    ]);

    setTaskSummary({
      denomCount: denoms.count || 0,
      pickupCount: pickups.count || 0,
      loadCount: loads.count || 0,
      issueCount: issues.count || 0,
    });

    setEodDetails({
      cashPickups: pickupRows.data || [],
      atmLoads: loadRows.data || [],
      excessCash: excessRows.data || [],
      adjustments: adjustmentRows.data || [],
    });

    const travelTotal = (travelRows.data || []).reduce(
      (sum: number, row: any) => sum + (Number(row.km_covered) || 0),
      0
    );
    setTravelKm(travelTotal);

    setLoading(false);
  }



  // --------------------------------------------------
  // SUBMIT EOD (NEW)
  // --------------------------------------------------

  async function submitEOD() {
    if (submitting || submitLocked) return;
    if (!assignment) return;

    setSubmitting(true);
    setSubmitMsg(null);

    const { error } = await supabase
      .from("assignments")
      .update({ status: "submitted" })
      .eq("id", assignment.id);

    if (error) {
      setSubmitMsg("Failed to submit EOD. Please try again.");
    } else {
      setSubmitMsg("EOD submitted successfully. Awaiting admin approval.");
      setAssignment({ ...assignment, status: "submitted" });
      setSubmitLocked(true);
      setConfirmMessage("EOD submitted successfully. Awaiting admin approval.");
      setShowConfirm(true);
    }

    setSubmitting(false);
  }

  // --------------------------------------------------
  // ADMIN / SUPERVISOR VIEW (UNCHANGED)
  // --------------------------------------------------
  async function loadAdminDashboard() {
    setLoading(true);

    const { data: custodianList } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("role", "custodian")
      .order("full_name", { ascending: true });

    setAdminCustodians(custodianList || []);

    let assignmentQuery = supabase
      .from("assignments")
      .select("*, custodian:custodian_id(full_name)")
      .gte("assignment_date", adminFromDate)
      .lte("assignment_date", adminToDate)
      .order("assignment_date", { ascending: false });

    if (adminStatus !== "ALL") {
      assignmentQuery = assignmentQuery.eq("status", adminStatus);
    }

    if (adminCustodian !== "ALL") {
      assignmentQuery = assignmentQuery.eq("custodian_id", adminCustodian);
    }

    const { data: assigns } = await assignmentQuery;

    setAdminAssignments(assigns || []);

    const [newIssues, inProgress, resolved] = await Promise.all([
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "new"),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "in_progress"),
      supabase
        .from("technical_issues")
        .select("*", { count: "exact", head: true })
        .eq("status", "resolved"),
    ]);

    setIssueSummary({
      new: newIssues.count || 0,
      inProgress: inProgress.count || 0,
      resolved: resolved.count || 0,
    });

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      {loading && (
        <div className="text-center text-sm text-slate-500 print:hidden">
          Loading...
        </div>
      )}

      {!loading && profile?.role === "custodian" && (
        <CustodianEOD
          profile={profile}
          assignment={assignment}
          routeSites={routeSites}
          taskSummary={taskSummary}
          eodDetails={eodDetails}
          travelKm={travelKm}
          custodianAssignments={custodianAssignments}
          selectedAssignmentId={selectedAssignmentId}
          setSelectedAssignmentId={setSelectedAssignmentId}
          custodianNotice={custodianNotice}
          onSubmit={submitEOD}
          submitting={submitting}
          submitLocked={submitLocked}
          submitMsg={submitMsg}
          onSignatureComplete={(updatedAssignment) => setAssignment(updatedAssignment)}
        />
      )}

      {!loading &&
        (profile?.role === "admin" ||
          profile?.role === "supervisor") && (
          <AdminDashboard
            adminAssignments={adminAssignments}
            issueSummary={issueSummary}
            adminFromDate={adminFromDate}
            adminToDate={adminToDate}
            adminStatus={adminStatus}
            adminCustodian={adminCustodian}
            adminCustodians={adminCustodians}
            setAdminFromDate={setAdminFromDate}
            setAdminToDate={setAdminToDate}
            setAdminStatus={setAdminStatus}
            setAdminCustodian={setAdminCustodian}
          />
        )}
      <ConfirmationModal
        open={showConfirm}
        title="EOD Submitted"
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
        }}
      />
    </AppLayout>
  );
}

// --------------------------------------------------
// Custodian UI
// --------------------------------------------------
function CustodianEOD({
  profile,
  assignment,
  routeSites,
  taskSummary,
  eodDetails,
  travelKm,
  custodianAssignments,
  selectedAssignmentId,
  setSelectedAssignmentId,
  custodianNotice,
  onSubmit,
  submitting,
  submitLocked,
  submitMsg,
  onSignatureComplete,
}: any) {
  const sigPadRef = useRef<any>(null);
  const modalSigPadRef = useRef<any>(null);
  const previewCanvasWrapRef = useRef<HTMLDivElement | null>(null);
  const modalCanvasWrapRef = useRef<HTMLDivElement | null>(null);
  const [signing, setSigning] = useState(false);
  const [signatureLocked, setSignatureLocked] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [showSignatureConfirm, setShowSignatureConfirm] = useState(false);
  const [signatureConfirmMessage, setSignatureConfirmMessage] = useState("");
  const [signaturePreviewUrl, setSignaturePreviewUrl] = useState<string | null>(null);
  const [showSignaturePreview, setShowSignaturePreview] = useState(false);

  const cashPickups = eodDetails?.cashPickups || [];
  const atmLoads = eodDetails?.atmLoads || [];
  const excessCash = eodDetails?.excessCash || [];
  const adjustments = eodDetails?.adjustments || [];
  const normalizeAdjustmentType = (value: any) =>
    String(value || "").trim().toUpperCase();

  const exchanges = adjustments.filter(
    (a: any) => normalizeAdjustmentType(a.adjustment_type) === "EXCHANGE"
  );
  const transfers = adjustments.filter((a: any) => {
    const normalized = normalizeAdjustmentType(a.adjustment_type);
    return normalized === "INTER_SITE_TRANSFER" || normalized === "INTERSITE_TRANSFER";
  });

  const sumPickupDenoms = (row: any) => denomTotal(row);

  const extractInternalSources = (pickup: any) =>
    pickup?.internal_source_metadata?.sources || [];

  // FLOW 1: BANK CASH (affects Cash-in-Hand)
  const bankPicked = cashPickups.reduce((sum: number, row: any) => {
    const source = row.pickup_source || "BANK";
    if (source === "ATM_INTERNAL") return sum;
    // Subtract internal_source_metadata portion from BANK pickups
    const metaSources = extractInternalSources(row);
    const metaTotal = metaSources.reduce(
      (acc: number, s: any) => acc + Number(s.total_amount || 0),
      0
    );
    return sum + Math.max(sumPickupDenoms(row) - metaTotal, 0);
  }, 0);

  // FLOW 2: INTERNAL ATM TRANSFER tracking
  const internalPickedFromRows = cashPickups.reduce((sum: number, row: any) => {
    const source = row.pickup_source || "BANK";
    if (source !== "ATM_INTERNAL") return sum;
    return sum + sumPickupDenoms(row);
  }, 0);

  const internalPickedFromMeta = cashPickups.reduce((sum: number, row: any) => {
    const metaSources = extractInternalSources(row);
    if (!metaSources.length) return sum;
    const metaTotal = metaSources.reduce(
      (acc: number, s: any) => acc + Number(s.total_amount || 0),
      0
    );
    return sum + metaTotal;
  }, 0);

  const internalPicked = internalPickedFromRows + internalPickedFromMeta;

  // ── Chronological denomination matching ──
  // Build timeline of pickup + load events sorted by time
  type CashEvt = { kind: "pickup" | "load"; ts: number; raw: any };
  const cashEvents: CashEvt[] = [];

  cashPickups.forEach((p: any) => {
    const ts = p.pickup_time ? new Date(p.pickup_time).getTime() : 0;
    cashEvents.push({ kind: "pickup", ts, raw: p });
  });
  atmLoads.forEach((l: any) => {
    const ts = l.time_in ? new Date(l.time_in).getTime() : 0;
    cashEvents.push({ kind: "load", ts, raw: l });
  });

  // Pickups before loads at same timestamp
  cashEvents.sort((a, b) => {
    const diff = a.ts - b.ts;
    if (diff !== 0) return diff;
    return (a.kind === "pickup" ? 0 : 1) - (b.kind === "pickup" ? 0 : 1);
  });

  // Live denomination pool from ATM removals
  const removalPool: Record<number, number> = { 100: 0, 200: 0, 500: 0, 2000: 0 };

  let totalBankLoaded = 0;
  let totalInternalLoaded = 0;

  // Per-load allocation results for print rows
  const loadAllocations = new Map<any, { bankAmount: number; internalAmount: number }>();

  cashEvents.forEach((evt) => {
    if (evt.kind === "pickup") {
      const p = evt.raw;
      const source = p.pickup_source || "BANK";
      if (source === "ATM_INTERNAL") {
        DENOM_ORDER.forEach((d) => {
          removalPool[d] += (p[`denom_${d}`] || 0);
        });
      } else {
        const metaSources = extractInternalSources(p);
        metaSources.forEach((s: any) => {
          DENOM_ORDER.forEach((d) => {
            removalPool[d] += Number(s.denominations?.[`denom_${d}`] || 0);
          });
        });
      }
    } else {
      const l = evt.raw;
      let loadBank = 0;
      let loadInternal = 0;

      DENOM_ORDER.forEach((d) => {
        const loadCount = (l[`denom_${d}`] || 0) as number;
        const poolCount = removalPool[d] || 0;
        const matched = Math.min(loadCount, poolCount);

        loadInternal += matched * d;
        loadBank += (loadCount - matched) * d;

        removalPool[d] = poolCount - matched;
      });

      totalBankLoaded += loadBank;
      totalInternalLoaded += loadInternal;
      loadAllocations.set(l, { bankAmount: loadBank, internalAmount: loadInternal });
    }
  });

  const bankLoaded = totalBankLoaded;
  const internalLoaded = totalInternalLoaded;

  // Internal transfer net MUST be zero (showing max for visibility only)
  const internalTransferTotal = Math.max(internalPicked, internalLoaded);
  const netInternalTransfer = internalPicked - internalLoaded;

  // CRITICAL: Cash-in-Hand = Bank Picked - Bank Loaded (ONLY)
  // Internal transfers are neutral and do NOT impact Cash-in-Hand
  const totalPicked = bankPicked;
  const totalLoaded = bankLoaded;
  const cashInHand = totalPicked - totalLoaded;
  const closingUnbalanced = Math.abs(cashInHand) >= 0.01;

  const siteMap = new Map(
    (routeSites || []).map((r: any) => [r.site_id, r.site])
  );

  const bankPickupRows = cashPickups.filter(
    (row: any) => (row.pickup_source || "BANK") !== "ATM_INTERNAL"
  );

  const atmPickupRows = cashPickups.filter(
    (row: any) => (row.pickup_source || "BANK") === "ATM_INTERNAL"
  );

  const internalPickupSources = bankPickupRows.flatMap((row: any) => {
    const sources = extractInternalSources(row);
    return sources.map((s: any) => ({
      site: siteMap.get(s.site_id) || { bank_name: s.site_name || "ATM", address: "Internal Source" },
      denoms: {
        denom_100: Number(s.denominations?.denom_100 || 0),
        denom_200: Number(s.denominations?.denom_200 || 0),
        denom_500: Number(s.denominations?.denom_500 || 0),
        denom_2000: Number(s.denominations?.denom_2000 || 0),
      },
      total_amount: Number(s.total_amount || 0),
      pickup_time: row.pickup_time,
    }));
  });

  const internalLoadRows = atmLoads.filter(
    (row: any) => {
      const alloc = loadAllocations.get(row);
      return alloc ? alloc.internalAmount > 0 : false;
    }
  );

  const status = assignment?.status || "open";
  const isEditable = status === "open" || status === "rejected";
  const canSubmit = isEditable && !assignment?.eod_signed;
  const custodianName =
    profile?.full_name || assignment?.custodian?.full_name || "—";

  const normalizeUtcDate = (value?: string | null) =>
    value ? parseUTCDate(value) : null;

  const getAtmLabel = (site?: any) =>
    site?.site_code || site?.atm_id || site?.bank_name || "-";

  const printRows = useMemo(() => {
    const rows: Array<{
      ts: Date;
      type: string;
      atm: string;
      debit: number;
      credit: number;
      balanceImpact: number;
      remarks: string;
    }> = [];

    bankPickupRows.forEach((c: any) => {
      const ts = normalizeUtcDate(c.pickup_time) || new Date();
      // Subtract internal metadata portion from bank pickup credit
      const metaSources = extractInternalSources(c);
      const metaTotal = metaSources.reduce(
        (acc: number, s: any) => acc + Number(s.total_amount || 0),
        0
      );
      const total = denomTotal(c);
      const bankAmount = Math.max(total - metaTotal, 0);
      if (bankAmount > 0) {
        rows.push({
          ts,
          type: "Bank Pickup",
          atm: "",
          debit: 0,
          credit: bankAmount,
          balanceImpact: bankAmount,
          remarks: c.branch ? `${c.bank_name || "Bank"} - ${c.branch}` : (c.bank_name || "Bank"),
        });
      }
    });

    atmPickupRows.forEach((c: any) => {
      const ts = normalizeUtcDate(c.pickup_time) || new Date();
      const amount = denomTotal(c);
      rows.push({
        ts,
        type: "ATM Cash Removal",
        atm: getAtmLabel(siteMap.get(c.source_site_id) || c.site),
        debit: 0,
        credit: -amount,
        balanceImpact: amount,
        remarks: "Removed from ATM",
      });
    });

    internalPickupSources.forEach((s: any) => {
      const ts = normalizeUtcDate(s.pickup_time) || new Date();
      const amount = Number(s.total_amount || 0);
      rows.push({
        ts,
        type: "ATM Cash Removal",
        atm: getAtmLabel(s.site),
        debit: 0,
        credit: -amount,
        balanceImpact: amount,
        remarks: "Removed from ATM",
      });
    });

    (atmLoads || []).forEach((a: any) => {
      const ts = normalizeUtcDate(a.time_in) || new Date();
      
      // CRITICAL: Use source_breakdown saved with ATM load for accurate bank/internal split
      // This overrides the chronological matching to ensure internal transfers don't inflate bank total
      let bankSourceAmount = 0;
      let internalSourceAmount = 0;
      
      const breakdown = a.source_breakdown;
      if (breakdown?.bank_source?.total_amount !== undefined && breakdown?.internal_source?.total_amount !== undefined) {
        // Explicit source_breakdown exists (set when load was saved)
        bankSourceAmount = Number(breakdown.bank_source.total_amount || 0);
        internalSourceAmount = Number(breakdown.internal_source.total_amount || 0);
      } else {
        // Fallback to chronological matching allocation
        const alloc = loadAllocations.get(a);
        bankSourceAmount = alloc?.bankAmount || 0;
        internalSourceAmount = alloc?.internalAmount || 0;
      }
      
      const total = bankSourceAmount + internalSourceAmount;
      
      if (total > 0) {
        rows.push({
          ts,
          type: "ATM Load",
          atm: getAtmLabel(a.site),
          debit: bankSourceAmount,
          credit: internalSourceAmount,
          balanceImpact: -total,
          remarks: internalSourceAmount > 0
            ? `Bank: ₹${bankSourceAmount.toLocaleString("en-IN")} | ATM Cash: ₹${internalSourceAmount.toLocaleString("en-IN")}`
            : "",
        });
      }
    });

    (excessCash || []).forEach((e: any) => {
      const ts = normalizeUtcDate(e.created_at || e.reported_at) || new Date();
      rows.push({
        ts,
        type: "Excess Cash",
        atm: getAtmLabel(e.site),
        debit: 0,
        credit: denomTotal(e),
        balanceImpact: denomTotal(e),
        remarks: e.remarks || "",
      });
    });

    exchanges.forEach((e: any) => {
      const ts = normalizeUtcDate(e.created_at) || new Date();
      const total = Number(e.exchange_metadata?.total_amount || 0);
      rows.push({
        ts,
        type: "Exchange",
        atm: "",
        debit: total,
        credit: total,
        balanceImpact: 0,
        remarks: e.exchange_metadata?.from_bank_name && e.exchange_metadata?.to_bank_name
          ? `${e.exchange_metadata.from_bank_name} to ${e.exchange_metadata.to_bank_name}`
          : "",
      });
    });

    transfers.forEach((t: any) => {
      const ts = normalizeUtcDate(t.created_at) || new Date();
      const sourceTotal = Number(
        t.transfer_metadata?.source_total_amount ||
          t.transfer_metadata?.total_amount ||
          0
      );
      const sourceSiteName = t.transfer_metadata?.source_site_name || "-";
      const destinations = t.transfer_metadata?.destinations || [];
      const reference = t.transfer_metadata?.reference || "";
      
      if (sourceTotal > 0) {
        rows.push({
          ts,
          type: "Inter-site Transfer (Out)",
          atm: sourceSiteName,
          debit: 0,
          credit: -sourceTotal,
          balanceImpact: -sourceTotal,
          remarks: reference || `Transferred to ${destinations.length} site(s)`,
        });
      }
      
      destinations.forEach((dest: any) => {
        const destAmount = Number(dest.total_amount || 0);
        if (destAmount > 0) {
          rows.push({
            ts,
            type: "Inter-site Transfer (In)",
            atm: dest.site_name || "-",
            debit: 0,
            credit: destAmount,
            balanceImpact: destAmount,
            remarks: reference || `From ${sourceSiteName}`,
          });
        }
      });
    });

    return rows.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  }, [
    bankPickupRows,
    atmPickupRows,
    internalPickupSources,
    atmLoads,
    excessCash,
    exchanges,
    transfers,
    siteMap,
    loadAllocations,
  ]);

  const printBalanceRows = useMemo(() => {
    let running = 0;
    return printRows.map((row) => {
      running += row.balanceImpact;
      return { ...row, balance: running };
    });
  }, [printRows]);

  const resizeSignatureCanvas = (
    ref: React.MutableRefObject<any>,
    wrapRef: React.MutableRefObject<HTMLDivElement | null>
  ) => {
    const pad = ref.current;
    const wrapper = wrapRef.current;
    if (!pad || !wrapper) return;

    const canvas = pad.getCanvas?.() || pad.canvas;
    if (!canvas) return;

    const ratio = window.devicePixelRatio || 1;
    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    if (!width || !height) return;

    const dataUrl = pad.toDataURL?.();

    canvas.width = Math.floor(width * ratio);
    canvas.height = Math.floor(height * ratio);

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    pad.clear?.();
    if (dataUrl) {
      pad.fromDataURL?.(dataUrl);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      resizeSignatureCanvas(sigPadRef, previewCanvasWrapRef);
      if (showSignatureModal) {
        resizeSignatureCanvas(modalSigPadRef, modalCanvasWrapRef);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [showSignatureModal]);

  useEffect(() => {
    if (!showSignatureModal) return;
    
    // Resize multiple times to handle modal animation completion
    requestAnimationFrame(() =>
      resizeSignatureCanvas(modalSigPadRef, modalCanvasWrapRef)
    );
    
    // Delayed resize for after modal animation completes (300ms typical for modal animation)
    const timer1 = setTimeout(() => {
      resizeSignatureCanvas(modalSigPadRef, modalCanvasWrapRef);
    }, 100);
    
    const timer2 = setTimeout(() => {
      resizeSignatureCanvas(modalSigPadRef, modalCanvasWrapRef);
    }, 350);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [showSignatureModal]);

  // Open modal for signature capture (user draws on modal canvas, not preview)
  function openSignatureModal() {
    setShowSignatureModal(true);
    setSigError(null);
    // Clear previous signature attempt
    modalSigPadRef.current?.clear();
  }

  // Validate that signature actually has drawing content (not blank white)
  async function validateSignatureNotEmpty(dataUrl: string): Promise<boolean> {
    console.log('[EOD] Validating signature content...');
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('[EOD] Could not get canvas context for validation');
          resolve(true); // Allow upload if validation fails (graceful fallback)
          return;
        }

        ctx.drawImage(img, 0, 0);

        // Check if any pixel is NOT white (R>240, G>240, B>240)
        // White = (255, 255, 255, 255), Signature stroke = (0, 0, 0, 255)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;
        
        // Sample check: look for at least 100 dark pixels to confirm signature exists
        let darkPixelCount = 0;
        for (let i = 0; i < pixels.length; i += 4) {
          const r = pixels[i];
          const g = pixels[i + 1];
          const b = pixels[i + 2];
          const a = pixels[i + 3];
          
          // Consider dark if any color channel is < 200 (showing ink)
          if (a > 200 && (r < 200 || g < 200 || b < 200)) {
            darkPixelCount++;
          }
        }

        const hasSignature = darkPixelCount > 100;
        console.log('[EOD] Signature validation:', {
          darkPixels: darkPixelCount,
          hasSignature,
          minRequired: 100,
        });
        
        resolve(hasSignature);
      };
      img.onerror = () => {
        console.warn('[EOD] Could not validate signature image');
        resolve(true); // Allow upload if validation fails (graceful fallback)
      };
      img.src = dataUrl;
    });
  }

  return (
    <div className="space-y-6">
      {/* PRINT HEADER */}
      <div className="print-only mb-6 pb-4 border-b-2 border-slate-400">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-2">
            <img src="/bank-logo.png" alt="Bank Logo" className="h-12 w-auto" />
            <div>
              <h1 className="text-lg font-bold text-slate-900">SRUTHI CRA OPERATIONS</h1>
              <p className="text-xs text-slate-700 font-medium">
                End of Day (EOD) Cash Operations Summary
              </p>
            </div>
          </div>
          <div className="text-right text-xs text-slate-700">
            <p className="font-bold text-sm">EOD REPORT</p>
            <p className="mt-1"><span className="font-semibold">Date:</span> {assignment?.assignment_date}</p>
            <p><span className="font-semibold">Custodian:</span> {custodianName}</p>
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
            {printBalanceRows.map((row, idx) => (
              <tr key={`print-row-${idx}`} className="print-statement-row">
                <td>{formatISTDate(row.ts, "short")}</td>
                <td>{formatISTTime(row.ts)}</td>
                <td>{row.type}</td>
                <td>{row.atm}</td>
                <td className="text-right">
                  {row.debit > 0
                    ? row.debit.toLocaleString("en-IN", { minimumFractionDigits: 2 })
                    : "-"}
                </td>
                <td className="text-right">
                  {row.credit > 0
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

      <div className="print:hidden pb-24 sm:pb-20">
        <div className="space-y-2">
        <h2 className="text-lg font-semibold text-primary">
          End of Day Summary
        </h2>
        <p className="text-xs text-slate-500">
          Review and submit non-approved EODs. Approved EODs are read-only.
        </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Select EOD Date
            </label>
            <select
              value={selectedAssignmentId ?? ""}
              onChange={(e) => setSelectedAssignmentId(Number(e.target.value))}
              className="input w-full"
            >
              <option value="">-- Select --</option>
              {custodianAssignments.map((a: any) => (
                <option key={a.id} value={a.id}>
                  {a.assignment_date} ({a.status})
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 flex items-end">
            {custodianNotice && (
              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 w-full">
                {custodianNotice}
              </div>
            )}
          </div>
        </div>
      </div>

        {!assignment && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No EOD available for the selected date.
          </div>
        )}

        {assignment && (
          <>
          <div className={`p-4 rounded shadow text-sm ${assignment.eod_signed ? 'bg-green-50 border border-green-200' : 'bg-white'}`}>
            <div className="flex items-center justify-between">
              <div className="font-semibold">Assignment ID: {assignment.id}</div>
              <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                {status}
              </span>
            </div>
            <div>Date: {assignment.assignment_date}</div>
            {assignment.eod_signed && (
              <div className="text-green-700 font-semibold text-xs mt-1">✓ Locked & Signed</div>
            )}
          </div>

          {assignment?.status === "rejected" && assignment.rejection_reason && (
            <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
              <strong>Rejected:</strong> {assignment.rejection_reason}
            </div>
          )}

          {/* ✅ APPROVED EOD - SIGNATURE DISPLAY (PROMINENT) */}
          {assignment?.eod_signed && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✓</span>
                <h3 className="font-bold text-lg text-green-900">EOD Signed & Locked</h3>
              </div>
              <p className="text-sm text-green-800">
                Signed on: <span className="font-semibold">{formatIST(assignment.eod_signed_at)}</span>
              </p>
              {assignment.eod_signature_url && (
                <SignatureImage
                  src={assignment.eod_signature_url}
                  size="medium"
                  showLabel={true}
                  onLoadError={(error) => {
                    console.warn('[EODSummary] Signature load warning:', error);
                  }}
                />
              )}
              <div className="bg-green-100 border border-green-300 rounded px-3 py-2">
                <p className="text-xs text-green-800">
                  📋 This EOD is finalized and embedded in the PDF. You can now print and download the complete report.
                </p>
              </div>
            </div>
          )}

          <h3 className="font-semibold">Tasks Summary</h3>
          <div className={`grid grid-cols-2 gap-3 ${!isEditable ? 'opacity-75 pointer-events-none' : ''}`}>
            <SummaryBox label="Denomination Plans" value={taskSummary?.denomCount} />
            <SummaryBox label="Cash Pickup" value={taskSummary?.pickupCount} />
            <SummaryBox label="ATM Loads" value={taskSummary?.loadCount} />
            <SummaryBox label="Issues Logged" value={taskSummary?.issueCount} />
          </div>

          <h3 className="font-semibold">KPI Summary</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <SummaryBox
              label="Internal Transfers"
              value={`₹${internalTransferTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
            />
            <SummaryBox
              label="Covered KM"
              value={`${Number(travelKm || 0).toFixed(2)} km`}
            />
          </div>

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">EOD Report</h3>
            </div>

            <div className="bg-white border border-slate-200 rounded-lg p-4 text-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Bank Cash Picked</span>
                <span className="font-semibold text-slate-900">
                  ₹{bankPicked.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Bank Cash Loaded</span>
                <span className="font-semibold text-slate-900">
                  ₹{bankLoaded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">ATM Cash Picked (Internal Credit)</span>
                <span className="font-semibold text-slate-900">
                  ₹{internalPicked.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">ATM Cash Loaded (Internal Debit)</span>
                <span className="font-semibold text-slate-900">
                  ₹{totalInternalLoaded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Internal Transfer Net (Expected 0)</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    Math.abs(netInternalTransfer) >= 0.01
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  ₹{netInternalTransfer.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Cash in Hand (Bank Net)</span>
                <span
                  className={`px-2 py-1 rounded text-xs font-semibold ${
                    closingUnbalanced
                      ? "bg-amber-100 text-amber-900"
                      : "bg-emerald-100 text-emerald-900"
                  }`}
                >
                  ₹{cashInHand.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <Section title="Bank Cash Picked">
              {bankPickupRows.length === 0 && (
                <div className="text-xs text-slate-500">No bank pickups recorded.</div>
              )}
              {bankPickupRows.map((c: any, i: number) => (
                <div key={i} className="border rounded p-3 mb-3 bg-white text-xs">
                  <div className="font-medium">
                    {c.bank_name || "Bank"} {c.branch && `– ${c.branch}`}
                  </div>
                  <div className="text-slate-500">
                    Pickup Time: {formatIST(c.pickup_time)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DENOM_ORDER.map((d) => (
                      <div key={d}>{c[`denom_${d}`] || 0} × ₹{d}</div>
                    ))}
                  </div>
                  <div className="mt-2 font-semibold">
                    Total: ₹{denomTotal(c).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="ATM Cash Picked (Internal)">
              {atmPickupRows.length === 0 && internalPickupSources.length === 0 && (
                <div className="text-xs text-slate-500">No internal pickups recorded.</div>
              )}

              {atmPickupRows.map((c: any, i: number) => (
                <div key={`atm-${i}`} className="border rounded p-3 mb-3 bg-white text-xs">
                  <div className="font-medium">
                    {formatSite(siteMap.get(c.source_site_id) || c.site)}
                  </div>
                  <div className="text-slate-500">
                    Pickup Time: {formatIST(c.pickup_time)}
                  </div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DENOM_ORDER.map((d) => (
                      <div key={d}>{c[`denom_${d}`] || 0} × ₹{d}</div>
                    ))}
                  </div>
                  <div className="mt-2 font-semibold">
                    Total: ₹{denomTotal(c).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}

              {internalPickupSources.map((s: any, i: number) => (
                <div key={`meta-${i}`} className="border rounded p-3 mb-3 bg-white text-xs">
                  <div className="font-medium">{formatSite(s.site)}</div>
                  {s.pickup_time && (
                    <div className="text-slate-500">
                      Pickup Time: {formatIST(s.pickup_time)}
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DENOM_ORDER.map((d) => (
                      <div key={d}>{s.denoms?.[`denom_${d}`] || 0} × ₹{d}</div>
                    ))}
                  </div>
                  <div className="mt-2 font-semibold">
                    Total: ₹{(s.total_amount || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="ATM Loads">
              {atmLoads.length === 0 && (
                <div className="text-xs text-slate-500">No loads recorded.</div>
              )}
              {atmLoads.map((a: any, i: number) => {
                const bankAmount = loadAllocations.get(a)?.bankAmount || 0;
                const internalAmount = loadAllocations.get(a)?.internalAmount || 0;
                return (
                  <div key={i} className="border rounded p-3 mb-3 bg-white text-xs">
                    <div className="font-medium">{formatSite(a.site)}</div>
                    <div className="text-slate-500">Load Time: {formatISTFromUTC(a.time_in)}</div>
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      {DENOM_ORDER.map((d) => (
                        <div key={d}>{a[`denom_${d}`] || 0} × ₹{d}</div>
                      ))}
                    </div>
                    {/* Show bank-loaded as the main total */}
                    <div className="mt-2 font-semibold text-green-700">
                      Total (Bank Loaded): ₹{bankAmount.toLocaleString("en-IN")}
                    </div>
                    {/* Show internal transfer separately as neutral info */}
                    {internalAmount > 0 && (
                      <div className="text-[10px] text-amber-700 mt-2 pt-2 border-t border-amber-200">
                        + Internal ATM Transfer: ₹{internalAmount.toLocaleString("en-IN")} (neutral, not in SOA total)
                      </div>
                    )}
                  </div>
                );
              })}
            </Section>

            <Section title="Internal Transfers (Neutral)">
              {atmPickupRows.length === 0 && internalPickupSources.length === 0 && internalLoadRows.length === 0 && (
                <div className="text-xs text-slate-500">No internal transfers recorded.</div>
              )}

              {(atmPickupRows.length > 0 || internalPickupSources.length > 0) && (
                <div className="mb-4">
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Source ATM → Internal Pool (Removal)
                  </div>
                  {atmPickupRows.map((c: any, i: number) => (
                    <div key={`src-${i}`} className="border rounded p-3 mb-2 bg-white text-xs">
                      <div className="text-[10px] text-indigo-700 font-semibold mb-1">Internal Transfer (Neutral)</div>
                      <div className="font-medium">
                        {formatSite(siteMap.get(c.source_site_id) || c.site)}
                      </div>
                      <div className="text-slate-500">Pickup Time: {formatIST(c.pickup_time)}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {DENOM_ORDER.map((d) => (
                          <div key={d}>{c[`denom_${d}`] || 0} × ₹{d}</div>
                        ))}
                      </div>
                      <div className="mt-2 font-semibold">
                        Total: ₹{denomTotal(c).toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}

                  {internalPickupSources.map((s: any, i: number) => (
                    <div key={`src-meta-${i}`} className="border rounded p-3 mb-2 bg-white text-xs">
                      <div className="text-[10px] text-indigo-700 font-semibold mb-1">Internal Transfer (Neutral)</div>
                      <div className="font-medium">{formatSite(s.site)}</div>
                      {s.pickup_time && (
                        <div className="text-slate-500">Pickup Time: {formatIST(s.pickup_time)}</div>
                      )}
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {DENOM_ORDER.map((d) => (
                          <div key={d}>{s.denoms?.[`denom_${d}`] || 0} × ₹{d}</div>
                        ))}
                      </div>
                      <div className="mt-2 font-semibold">
                        Total: ₹{(s.total_amount || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {internalLoadRows.length > 0 && (
                <div>
                  <div className="text-xs font-semibold text-slate-600 mb-2">
                    Internal Pool → Destination ATM (Load)
                  </div>
                  {internalLoadRows.map((a: any, i: number) => {
                    const alloc = loadAllocations.get(a);
                    const internalAmt = alloc?.internalAmount || 0;
                    return (
                    <div key={`dest-${i}`} className="border rounded p-3 mb-2 bg-white text-xs">
                      <div className="text-[10px] text-indigo-700 font-semibold mb-1">Internal Transfer (Neutral)</div>
                      <div className="font-medium">{formatSite(a.site)}</div>
                      <div className="text-slate-500">Load Time: {formatISTFromUTC(a.time_in)}</div>
                      <div className="mt-2 font-semibold">
                        ATM Removal Used: ₹{internalAmt.toLocaleString("en-IN")}
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </Section>

            <Section title="Inter-Site Transfers">
              {transfers.length === 0 && (
                <div className="text-xs text-slate-500">No transfers recorded.</div>
              )}
              {transfers.map((t: any, i: number) => (
                <div key={i} className="border rounded p-3 mb-3 bg-white text-xs">
                  <div className="font-medium">
                    {t.transfer_metadata?.source_site_name || "Source"}
                  </div>
                  <div className="text-slate-600">
                    Destinations: {t.transfer_metadata?.destinations?.length || 0}
                  </div>
                  <div className="mt-2 font-semibold">
                    Total: ₹{(t.transfer_metadata?.total_amount || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Denomination Exchanges">
              {exchanges.length === 0 && (
                <div className="text-xs text-slate-500">No exchanges recorded.</div>
              )}
              {exchanges.map((e: any, i: number) => (
                <div key={i} className="border rounded p-3 mb-3 bg-white text-xs">
                  <div className="font-medium">
                    {e.exchange_metadata?.from_bank_name || "From"} → {e.exchange_metadata?.to_bank_name || "To"}
                  </div>
                  <div className="mt-2 font-semibold">
                    Total: ₹{(e.exchange_metadata?.total_amount || 0).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </Section>

            <Section title="Excess Cash">
              {excessCash.length === 0 && (
                <div className="text-xs text-slate-500">No excess recorded.</div>
              )}
              {excessCash.map((e: any, i: number) => (
                <div key={i} className="border rounded p-3 mb-3 bg-white text-xs">
                  <div className="font-medium">{formatSite(e.site)}</div>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DENOM_ORDER.map((d) => (
                      <div key={d}>{e[`denom_${d}`] || 0} × ₹{d}</div>
                    ))}
                  </div>
                  <div className="mt-2 font-semibold">
                    Total: ₹{denomTotal(e).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
            </Section>
          </div>

          {/* Submit EOD - Only show if not signed */}
          {canSubmit && (
            <div className="pt-4">
              <button
                onClick={onSubmit}
                disabled={submitting || submitLocked}
                className="w-full bg-primary text-white py-2 rounded"
              >
                {submitting ? "Submitting..." : "Submit End of Day Report"}
              </button>
            </div>
          )}

          {!canSubmit && (
            <div className="pt-4 text-xs text-slate-600">
              {status === "submitted" && "EOD submitted. Awaiting admin approval."}
              {status === "approved" && "EOD approved. Read-only."}
            </div>
          )}

            {submitMsg && (
              <p className="text-sm text-center text-green-700">{submitMsg}</p>
            )}
          </>
        )}

        <div
          className="sm:hidden"
          style={{ height: "calc(5rem + env(safe-area-inset-bottom))" }}
          aria-hidden="true"
        />
      </div>

      {/* PRINT SIGNATURE – embedded in footer; shown prominently above for signed EODs */}

      {/* ✍️ DIGITAL SIGNATURE - INPUT MODE - MOBILE OPTIMIZED */}
      {assignment?.status === "submitted" && !assignment.eod_signed && (
        <div className="mt-6 mb-24 sm:mb-20 p-4 sm:p-5 bg-white rounded-lg shadow-md print:hidden">
          <h3 className="font-bold text-lg sm:text-base mb-3">✍️ Custodian Signature</h3>

          <p className="text-sm sm:text-xs text-slate-600 mb-4 leading-relaxed">
            Please sign to confirm today’s cash operations are accurate.
          </p>

          {/* Preview / Tap to expand - MOBILE OPTIMIZED */}
          <div
            className="border-2 border-dashed border-slate-300 rounded-lg bg-slate-50 cursor-pointer hover:bg-slate-100 transition active:scale-95"
            onClick={() => setShowSignatureModal(true)}
            style={{ minHeight: '160px' }}
          >
            <div ref={previewCanvasWrapRef} className="h-40 sm:h-44">
              <SignatureCanvas
                ref={sigPadRef}
                penColor="black"
                canvasProps={{
                  width: 1,
                  height: 1,
                  className: "w-full h-full pointer-events-none",
                  style: { display: "block", touchAction: "none" },
                }}
              />
            </div>
            <p className="text-center text-sm sm:text-xs text-slate-500 py-2 font-medium">
              🔍 Tap to sign (full screen)
            </p>
          </div>

          {sigError && (
            <p className="text-sm text-red-600 mt-3 bg-red-50 p-2 rounded">{sigError}</p>
          )}

          <div className="flex gap-2 sm:gap-3 mt-4 mb-20">
            <button
              className="btn-secondary py-3 sm:py-2 text-sm font-bold"
              onClick={() => modalSigPadRef.current?.clear()}
              style={{ minHeight: '44px' }}
            >
              Clear
            </button>

            <button
              className="btn-primary py-3 sm:py-2 text-sm font-bold"
              onClick={openSignatureModal}
              disabled={signing}
              style={{ minHeight: '44px' }}
            >
              {signing ? "⏳ Saving..." : "✓ Sign & Lock EOD"}
            </button>
          </div>

          {/* ================= FULL SCREEN SIGNATURE MODAL - MOBILE OPTIMIZED ================= */}
          {showSignatureModal && (
            <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="bg-white w-full sm:rounded-lg rounded-t-2xl sm:w-[90%] sm:max-w-2xl sm:h-[90vh] h-screen max-h-screen sm:max-h-[90vh] flex flex-col overflow-hidden">

                {/* Header - Fixed at top */}
                <div className="flex justify-between items-center px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-200 flex-shrink-0">
                  <h3 className="font-bold text-lg sm:text-xl text-slate-900">✍️ Sign Here</h3>
                  <button
                    className="text-slate-400 hover:text-slate-600 font-bold text-2xl sm:text-2xl leading-none"
                    onClick={() => setShowSignatureModal(false)}
                    style={{ minHeight: '44px', minWidth: '44px', marginLeft: '8px' }}
                  >
                    ✖
                  </button>
                </div>

                {/* Canvas Area - Takes up available space */}
                <div
                  ref={modalCanvasWrapRef}
                  className="flex-1 border-b border-slate-200 bg-slate-50 overflow-hidden"
                >
                  <SignatureCanvas
                    ref={modalSigPadRef}
                    penColor="black"
                    canvasProps={{
                      width: 1,
                      height: 1,
                      className: "w-full h-full block",
                      style: { display: "block", touchAction: "none" },
                    }}
                  />
                </div>

                {/* Error Message - Fixed spacing */}
                {sigError && (
                  <div className="px-4 sm:px-5 py-2 bg-red-50 border-b border-red-200">
                    <p className="text-xs text-red-600">{sigError}</p>
                  </div>
                )}

                {/* Buttons - Fixed at bottom, always visible */}
                <div className="flex gap-2 sm:gap-3 px-4 sm:px-5 py-3 sm:py-4 flex-shrink-0 bg-white">
                  <button
                    className="btn-secondary py-3 sm:py-2 text-sm font-bold"
                    onClick={() => modalSigPadRef.current?.clear()}
                    style={{ minHeight: '44px' }}
                  >
                    Clear
                  </button>

                  <button
                    className="btn-primary flex-1 py-3 sm:py-2 text-sm font-bold"
                    onClick={() => {
                      // Show preview before final submission
                      const data = modalSigPadRef.current?.toDataURL();
                      if (data) {
                        setSignaturePreviewUrl(data);
                        setShowSignaturePreview(true);
                      } else {
                        setSigError("Please sign before proceeding.");
                      }
                    }}
                    disabled={signing}
                    style={{ minHeight: '44px' }}
                  >
                    {signing ? "⏳ Processing..." : "✓ Next: Review"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ✍️ SIGNATURE PREVIEW & CONFIRMATION MODAL - MOBILE OPTIMIZED */}
      {showSignaturePreview && signaturePreviewUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-end sm:items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-lg sm:shadow-2xl w-full sm:w-full sm:max-w-md max-h-[95vh] sm:max-h-none flex flex-col overflow-hidden">
            {/* Header - Fixed */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
              <h3 className="font-bold text-lg sm:text-xl text-slate-900">✍️ Confirm Signature</h3>
              <button
                className="text-slate-400 hover:text-slate-600 text-2xl leading-none"
                onClick={() => {
                  setShowSignaturePreview(false);
                  setSignaturePreviewUrl(null);
                }}
                style={{ minHeight: '44px', minWidth: '44px', marginLeft: '8px' }}
              >
                ✕
              </button>
            </div>

            {/* Content - Scrollable */}
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                Please review your signature carefully. It will be embedded in the EOD report.
              </p>

              {/* Signature Preview */}
              <div className="border-2 border-slate-200 rounded-lg bg-slate-50 p-4">
                <img
                  src={signaturePreviewUrl}
                  alt="Signature Preview"
                  className="w-full h-48 object-contain"
                />
                <p className="text-xs text-slate-500 text-center mt-2">Your signature</p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800 leading-relaxed">
                  <strong>📝 Note:</strong> Once locked, this signature cannot be changed. Ensure it matches your official signature.
                </p>
              </div>
            </div>

            {/* Buttons - Fixed at bottom */}
            <div className="flex gap-2 sm:gap-3 px-5 py-4 bg-white border-t border-slate-200 flex-shrink-0">
              <button
                className="btn-secondary flex-1 py-3 sm:py-2 text-sm font-bold"
                onClick={() => {
                  setShowSignaturePreview(false);
                  setSignaturePreviewUrl(null);
                }}
                style={{ minHeight: '44px' }}
              >
                ↶ Retake
              </button>

              <button
                className="btn-primary flex-1 py-3 sm:py-2 text-sm font-bold"
                onClick={async () => {
                  // Validate signature has actual content before uploading
                  const isValid = await validateSignatureNotEmpty(signaturePreviewUrl!);
                  if (!isValid) {
                    setSigError("❌ Please draw a complete signature before submitting. Your current signature appears to be blank or incomplete.");
                    return;
                  }

                  // Submit signature directly from preview URL (already captured from modal)
                  setShowSignatureModal(false);
                  setShowSignaturePreview(false);
                  // Now submit the signature
                  setSigning(true);
                  setSigError(null);

                  if (!assignment?.id) {
                    setSigError("Assignment ID missing");
                    setSigning(false);
                    return;
                  }

                  try {
                    // Convert signature to image
                    const blob = await (await fetch(signaturePreviewUrl!)).blob();
                    const path = `eod_signature_assignment_${assignment.id}_${Date.now()}.png`;

                    console.log('[EOD] Uploading signature:', {
                      blobSize: blob.size,
                      blobType: blob.type,
                      path,
                      timestamp: new Date().toISOString(),
                    });

                    // Upload to Supabase Storage
                    const { error: uploadError } = await supabase.storage
                      .from("eod-signatures")
                      .upload(path, blob, { contentType: "image/png" });

                    if (uploadError) throw uploadError;

                    const { data } = supabase.storage
                      .from("eod-signatures")
                      .getPublicUrl(path);

                    console.log('[EOD] Signature uploaded successfully:', {
                      publicUrl: data.publicUrl?.substring(0, 80) + '...',
                    });

                    // Lock EOD
                    const { error } = await supabase
                      .from("assignments")
                      .update({
                        eod_signed: true,
                        eod_signed_at: new Date().toISOString(),
                        eod_signature_url: data.publicUrl,
                      })
                      .eq("id", assignment.id);

                    if (error) throw error;

                    console.log('[EOD] Assignment locked with signature');

                    // Update local state
                    const updatedAssignment = {
                      ...assignment,
                      eod_signed: true,
                      eod_signed_at: new Date().toISOString(),
                      eod_signature_url: data.publicUrl,
                    };
                    
                    if (onSignatureComplete) {
                      onSignatureComplete(updatedAssignment);
                    }

                    setSignatureLocked(true);
                    setSignatureConfirmMessage("✓ EOD signed and locked successfully. Your signature is now embedded.");
                    setShowSignatureConfirm(true);
                    setSignaturePreviewUrl(null);
                    // Clear modal canvas after successful save
                    modalSigPadRef.current?.clear();
                  } catch (err) {
                    setSigError("Failed to save signature. Please try again.");
                    console.error("[EOD] Signature save error:", err);
                  } finally {
                    setSigning(false);
                  }
                }}
                disabled={signing}
                style={{ minHeight: '44px' }}
              >
                {signing ? "⏳ Confirming..." : "✓ Confirm & Lock"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Print/PDF Action - Mobile Optimized */}
      {assignment && (
        <div className="fixed bottom-0 inset-x-0 z-40 bg-gradient-to-t from-white via-white to-transparent border-t shadow-lg print:hidden safe-area-inset-b">
          <div className="px-3 py-3 sm:px-4 sm:py-3 max-w-4xl mx-auto">
            <button
              onClick={async () => {
                // Preload signature image before PDF render
                if (assignment.eod_signature_url) {
                  console.log('[EODSummary] Preloading signature before print...');
                  await preloadSignatureImage(assignment.eod_signature_url);
                }
                // Small delay to ensure image is loaded
                setTimeout(() => window.print(), 300);
              }}
              disabled={!assignment.eod_signed}
              className={`w-full rounded-lg py-4 sm:py-3 px-4 text-sm sm:text-base font-bold transition-all active:scale-95 touch-target ${
                assignment.eod_signed
                  ? "bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:shadow-lg active:from-blue-700 active:to-blue-800"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed opacity-60"
              }`}
              style={{ minHeight: '44px' }}
            >
              <span className="inline-block mr-2">🖨️</span>
              {assignment.eod_signed 
                ? "Print / Download PDF" 
                : "Complete signature for Print"}
            </button>
            {assignment.eod_signed && (
              <p className="text-xs text-center text-green-700 mt-2.5 font-medium">✓ Signed & ready to print</p>
            )}
          </div>
        </div>
      )}

      {/* PRINT FOOTER */}
      <div className="print-only mt-10 pt-6 border-t text-xs text-slate-700">
        {/* Signature grid - Professional print layout */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 sm:gap-12 mb-8">
          {/* Custodian Signature */}
          <div>
            <div className="mb-4">
              <SignatureImage
                src={assignment?.eod_signature_url}
                size="small"
                showLabel={false}
                isPrint={true}
              />
            </div>
            <div className="border-b border-slate-400 w-40 mb-2"></div>
            <p className="font-semibold text-slate-800">{profile?.full_name || "Custodian Name"}</p>
            <p className="text-slate-700">{assignment?.assignment_date || "Date"}</p>
            <p className="text-slate-600 text-[10px] mt-1">Custodian / Cash Handler</p>
          </div>
          
          {/* Supervisor Signature */}
          <div className="sm:text-right">
            <div className="mb-4 h-20"></div>
            <div className="border-b border-slate-400 w-40 mb-2 sm:ml-auto"></div>
            <p className="font-semibold text-slate-800">Bank Officer / Supervisor</p>
            <p className="text-slate-700">Date: _________________</p>
            <p className="text-slate-600 text-[10px] mt-1">Name, Seal & Signature</p>
          </div>
        </div>
        
        {/* Footer info bar */}
        <div className="flex flex-col sm:flex-row justify-between gap-3 sm:gap-0 border-t pt-4 mt-4">
          <div>
            <div className="font-semibold text-slate-800">Sruthi CRA Operations</div>
            <div className="text-[10px] text-slate-600">Cash Replenishment & ATM Operations Management</div>
          </div>
          <div className="sm:text-right">
            <div className="text-[10px] text-slate-600">Generated: {new Date().toLocaleDateString("en-IN")}</div>
            <div className="text-[10px] text-slate-600">Confidential – Internal Use Only</div>
          </div>
        </div>
        
        {/* Legal note */}
        <div className="mt-3 text-[9px] text-slate-500 border-t pt-2">
          This EOD report is system-generated and digitally signed by the custodian. Any discrepancies must be reported to the Operations Manager within the prescribed timeline.
        </div>
      </div>

      <ConfirmationModal
        open={showSignatureConfirm}
        title="EOD Signed"
        message={signatureConfirmMessage}
        confirmLabel="Done"
        onConfirm={() => setShowSignatureConfirm(false)}
      />
    </div>
  );
}

// --------------------------------------------------
// Admin UI
// --------------------------------------------------
function AdminDashboard({
  adminAssignments,
  issueSummary,
  adminFromDate,
  adminToDate,
  adminStatus,
  adminCustodian,
  adminCustodians,
  setAdminFromDate,
  setAdminToDate,
  setAdminStatus,
  setAdminCustodian,
}: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">Admin Overview</h2>

      <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">EOD Filters</h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">From</label>
            <input
              type="date"
              value={adminFromDate}
              onChange={(e: any) => setAdminFromDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">To</label>
            <input
              type="date"
              value={adminToDate}
              onChange={(e: any) => setAdminToDate(e.target.value)}
              className="input w-full"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Status</label>
            <select
              value={adminStatus}
              onChange={(e: any) => setAdminStatus(e.target.value)}
              className="input w-full"
            >
              <option value="ALL">All</option>
              <option value="open">Open</option>
              <option value="submitted">Submitted</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">Custodian</label>
            <select
              value={adminCustodian}
              onChange={(e: any) => setAdminCustodian(e.target.value)}
              className="input w-full"
            >
              <option value="ALL">All</option>
              {adminCustodians.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">EOD Records</h3>
          <span className="text-xs text-slate-500">
            {adminAssignments.length} records
          </span>
        </div>

        <div className="space-y-3">
          {adminAssignments.map((a: any) => (
            <Link
              key={a.id}
              to={`/admin/approvals/${a.id}`}
              className="block rounded-lg border border-slate-200 p-4 hover:bg-slate-50 transition"
            >
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    Assignment #{a.id}
                  </div>
                  <div className="text-xs text-slate-600">
                    {a.assignment_date} • {a.custodian?.full_name || "Unknown"}
                  </div>
                </div>
                <span className="text-xs font-semibold px-2 py-1 rounded bg-slate-100 text-slate-700">
                  {a.status}
                </span>
              </div>
            </Link>
          ))}

          {adminAssignments.length === 0 && (
            <div className="text-sm text-slate-500">No EOD records found.</div>
          )}
        </div>
      </div>

      <h3 className="font-semibold">Issue Summary</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SummaryBox label="New" value={issueSummary?.new} />
        <SummaryBox label="In Progress" value={issueSummary?.inProgress} />
        <SummaryBox label="Resolved" value={issueSummary?.resolved} />
      </div>
    </div>
  );
}

// --------------------------------------------------
function SummaryBox({ label, value }: any) {
  return (
    <div className="p-4 bg-white rounded shadow text-center">
      <div className="text-xl font-bold text-primary">
        {value || 0}
      </div>
      <div className="text-sm text-slate-600">{label}</div>
    </div>
  );
}

function Section({ title, children }: any) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}