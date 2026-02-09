import React, { useEffect, useState , useRef} from "react";
import { Link } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import SignatureCanvas from "react-signature-canvas";
import {
  getISTDateString,
  getISTMonthStart,
  formatISTDate,
  formatIST,
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
        <div className="text-center text-sm text-slate-500">
          Loading...
        </div>
      )}

      {!loading && profile?.role === "custodian" && (
        <CustodianEOD
          assignment={assignment}
          routeSites={routeSites}
          taskSummary={taskSummary}
          eodDetails={eodDetails}
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
  assignment,
  routeSites,
  taskSummary,
  eodDetails,
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

  const cashPickups = eodDetails?.cashPickups || [];
  const atmLoads = eodDetails?.atmLoads || [];
  const excessCash = eodDetails?.excessCash || [];
  const adjustments = eodDetails?.adjustments || [];
  const exchanges = adjustments.filter(
    (a: any) => a.adjustment_type === "EXCHANGE"
  );
  const transfers = adjustments.filter(
    (a: any) => a.adjustment_type === "INTER_SITE_TRANSFER"
  );

  const sumPickupDenoms = (row: any) => denomTotal(row);

  const extractInternalSources = (pickup: any) =>
    pickup?.internal_source_metadata?.sources || [];

  const bankPicked = cashPickups.reduce((sum: number, row: any) => {
    const source = row.pickup_source || "BANK";
    if (source === "ATM_INTERNAL") return sum;
    return sum + sumPickupDenoms(row);
  }, 0);

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

  const bankLoaded = atmLoads.reduce((sum: number, row: any) => {
    if (row.source_breakdown?.bank_source) {
      return sum + Number(row.source_breakdown?.bank_source?.total_amount || 0);
    }
    return sum + denomTotal(row);
  }, 0);

  const internalLoaded = atmLoads.reduce((sum: number, row: any) => {
    if (row.source_breakdown?.internal_source) {
      return sum + Number(row.source_breakdown?.internal_source?.total_amount || 0);
    }
    return sum;
  }, 0);

  // Bank cash drives EOD net position; internal transfers are neutralized.
  const totalPicked = bankPicked;
  const totalLoaded = bankLoaded;
  const netInternalTransfer = internalPicked - internalLoaded;
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
    (row: any) => Number(row.source_breakdown?.internal_source?.total_amount || 0) > 0
  );

  const status = assignment?.status || "open";
  const isEditable = status === "open" || status === "rejected";
  const canSubmit = isEditable && !assignment?.eod_signed;

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
    requestAnimationFrame(() =>
      resizeSignatureCanvas(modalSigPadRef, modalCanvasWrapRef)
    );
  }, [showSignatureModal]);

  async function submitSignature() {
    if (signing || signatureLocked) return;
    if (!assignment?.id) return;

    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setSigError("Please sign before submitting.");
      return;
    }

    try {
      setSigning(true);
      setSigError(null);

      // Convert signature to image
      const dataUrl = sigPadRef.current.toDataURL("image/png");
      const blob = await (await fetch(dataUrl)).blob();

      const path = `eod_signature_assignment_${assignment.id}_${Date.now()}.png`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from("eod-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("eod-signatures")
        .getPublicUrl(path);

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

      // Update local state to reflect signed EOD
      const updatedAssignment = {
        ...assignment,
        eod_signed: true,
        eod_signed_at: new Date().toISOString(),
        eod_signature_url: data.publicUrl,
      };
      
      // Call the callback to update parent component
      if (onSignatureComplete) {
        onSignatureComplete(updatedAssignment);
      }

      setSignatureLocked(true);
      setSignatureConfirmMessage("EOD signed and locked successfully.");
      setShowSignatureConfirm(true);
      setShowSignatureModal(false);
      sigPadRef.current.clear();
    } catch (err) {
      setSigError("Failed to save signature. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* PRINT HEADER */}
      <div className="print-only mb-4 border-b pb-3">
        <div className="flex justify-between items-start">
          <div className="flex items-center gap-3">
            <img src="/bank-logo.png" alt="Bank Logo" className="h-10 w-auto" />
            <div>
              <h1 className="text-xl font-bold">Sruthi CRA Ops</h1>
              <p className="text-xs text-slate-600">
                End of Day Cash Operations Summary
              </p>
            </div>
          </div>
          <div className="text-right text-xs">
            <p className="font-semibold">EOD Report</p>
            <p>Date: {assignment?.assignment_date}</p>
            {assignment?.custodian_id && (
              <p>Custodian: {assignment?.custodian_id}</p>
            )}
          </div>
        </div>
      </div>
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

          <h3 className="font-semibold">Tasks Summary</h3>
          <div className={`grid grid-cols-2 gap-3 ${!isEditable ? 'opacity-75 pointer-events-none' : ''}`}>
            <SummaryBox label="Denomination Plans" value={taskSummary?.denomCount} />
            <SummaryBox label="Cash Pickup" value={taskSummary?.pickupCount} />
            <SummaryBox label="ATM Loads" value={taskSummary?.loadCount} />
            <SummaryBox label="Issues Logged" value={taskSummary?.issueCount} />
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
                  ₹{internalLoaded.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
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
              {atmLoads.map((a: any, i: number) => (
                <div key={i} className="border rounded p-3 mb-3 bg-white text-xs">
                  <div className="font-medium">{formatSite(a.site)}</div>
                  <div className="text-slate-500">Load Time: {formatIST(a.time_in)}</div>
                  {Number(a.source_breakdown?.internal_source?.total_amount || 0) > 0 && (
                    <div className="text-[10px] text-amber-700 mt-1">
                      Internal source used for this load
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {DENOM_ORDER.map((d) => (
                      <div key={d}>{a[`denom_${d}`] || 0} × ₹{d}</div>
                    ))}
                  </div>
                  <div className="mt-2 font-semibold">
                    Total: ₹{denomTotal(a).toLocaleString("en-IN")}
                  </div>
                </div>
              ))}
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
                  {internalLoadRows.map((a: any, i: number) => (
                    <div key={`dest-${i}`} className="border rounded p-3 mb-2 bg-white text-xs">
                      <div className="text-[10px] text-indigo-700 font-semibold mb-1">Internal Transfer (Neutral)</div>
                      <div className="font-medium">{formatSite(a.site)}</div>
                      <div className="text-slate-500">Load Time: {formatIST(a.time_in)}</div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        {DENOM_ORDER.map((d) => (
                          <div key={d}>
                            {a.source_breakdown?.internal_source?.[`denom_${d}`] || 0} × ₹{d}
                          </div>
                        ))}
                      </div>
                      <div className="mt-2 font-semibold">
                        Total: ₹{Number(a.source_breakdown?.internal_source?.total_amount || 0).toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
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

      {/* PRINT SIGNATURE */}
      {assignment?.eod_signature_url && (
        <div className="print-only mt-8 border-t pt-4">
          <div className="text-xs font-semibold text-slate-700 mb-2">
            Custodian Signature
          </div>
          <img
            src={assignment.eod_signature_url}
            alt="EOD Signature"
            className="h-24 w-auto"
          />
        </div>
      )}

      {/* ✍️ DIGITAL SIGNATURE - READ ONLY (SIGNED) */}
      {assignment?.eod_signed && (
        <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded shadow">
          <h3 className="font-semibold mb-2 text-green-800">✍️ Signed EOD</h3>
          <p className="text-xs text-slate-600 mb-4">
            Signed on: {formatIST(assignment.eod_signed_at)}
          </p>
          {assignment.eod_signature_url && (
            <div className="border rounded bg-white p-2">
              <img
                src={assignment.eod_signature_url}
                alt="EOD Signature"
                className="w-full h-auto max-h-60 object-contain"
              />
              <p className="text-xs text-slate-500 text-center mt-2">Signature (Read-only)</p>
            </div>
          )}
        </div>
      )}

      {/* ✍️ DIGITAL SIGNATURE - INPUT MODE */}
      {assignment?.status === "submitted" && !assignment.eod_signed && (
        <div className="mt-6 p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">✍️ Custodian Signature</h3>

          <p className="text-xs text-slate-500 mb-2">
            Please sign to confirm today’s cash operations are accurate.
          </p>

          {/* Preview / Tap to expand */}
          <div
            className="border rounded bg-slate-50 cursor-pointer"
            onClick={() => setShowSignatureModal(true)}
          >
            <div ref={previewCanvasWrapRef} className="h-36 sm:h-44">
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
            <p className="text-center text-xs text-slate-500 py-1">
              Tap to sign (full screen)
            </p>
          </div>

          {sigError && (
            <p className="text-xs text-red-600 mt-2">{sigError}</p>
          )}

          <div className="flex gap-3 mt-3">
            <button
              className="btn-secondary"
              onClick={() => sigPadRef.current?.clear()}
            >
              Clear
            </button>

            <button
              className="btn-primary"
              onClick={submitSignature}
              disabled={signing}
            >
              {signing ? "Saving..." : "Sign & Lock EOD"}
            </button>
          </div>

          {/* ================= FULL SCREEN SIGNATURE MODAL ================= */}
          {showSignatureModal && (
            <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
              <div className="bg-white w-full h-full sm:w-[90%] sm:h-[90%] rounded-lg p-4 flex flex-col">

                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-lg">✍️ Sign Here</h3>
                  <button
                    className="text-sm text-red-600"
                    onClick={() => setShowSignatureModal(false)}
                  >
                    Close ✖
                  </button>
                </div>

                <div
                  ref={modalCanvasWrapRef}
                  className="flex-1 border rounded bg-slate-50"
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

                {sigError && <p className="text-xs text-red-600 mt-2">{sigError}</p>}

                <div className="flex gap-3 mt-3">
                  <button
                    className="btn-secondary"
                    onClick={() => modalSigPadRef.current?.clear()}
                  >
                    Clear
                  </button>

                  <button
                    className="btn-primary"
                    onClick={() => {
                      // Copy signature from modal → main canvas
                      const data = modalSigPadRef.current?.toDataURL();
                      if (data) {
                        sigPadRef.current?.fromDataURL(data);
                      }
                      setShowSignatureModal(false);
                    }}
                  >
                    {signing ? "Saving..." : "Sign & Lock EOD"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sticky Print/PDF Action */}
      {assignment && (
        <div className="fixed bottom-0 inset-x-0 z-50 bg-white border-t shadow-md print:hidden">
          <div className="px-4 py-3">
            <button
              onClick={() => window.print()}
              disabled={!assignment.eod_signed}
              className={`w-full rounded-lg py-2 text-sm font-semibold transition ${
                assignment.eod_signed
                  ? "bg-primary text-white active:scale-95"
                  : "bg-slate-200 text-slate-500 cursor-not-allowed"
              }`}
            >
              {assignment.eod_signed ? "🖨️ Print / PDF" : "Print / PDF (Sign & Lock to enable)"}
            </button>
          </div>
        </div>
      )}

      {/* PRINT FOOTER */}
      <div className="print-only mt-10 pt-4 border-t text-xs text-slate-600">
        <div className="flex justify-between">
          <div>
            <div className="font-semibold">Sruthi CRA Ops</div>
            <div>Cash Replenishment & ATM Operations</div>
          </div>
          <div className="text-right">
            <div>Generated: {new Date().toLocaleDateString("en-IN")}</div>
            <div>Confidential – Internal Use Only</div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-slate-500">
          This EOD report is system-generated and digitally signed. Any discrepancy must be reported within the prescribed timeline.
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