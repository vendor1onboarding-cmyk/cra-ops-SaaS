import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { formatIST, formatISTAudit } from "../utils/time";

/* ---------------- Utilities ---------------- */
function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

function denomTotal(row: any) {
  return (
    (row.denom_100 || 0) * 100 +
    (row.denom_200 || 0) * 200 +
    (row.denom_500 || 0) * 500 +
    (row.denom_2000 || 0) * 2000
  );
}

const DENOM_ORDER = [100, 200, 500, 2000];

/* ---------------- Component ---------------- */
export default function AdminEODDetail() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();

  const id = Number(assignmentId);

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showSignature, setShowSignature] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmNavigate, setConfirmNavigate] = useState(false);

  const [data, setData] = useState<any>({
    routeSites: [],
    denominations: [],
    cashPickups: [],
    atmLoads: [],
    excessCash: [],
    adjustments: [],
    issues: [],
    travel: [],
  });

  /* ---------------- Load Data ---------------- */
  useEffect(() => {
    if (!id) return;

    async function load() {
      setLoading(true);

      const { data: assignmentData } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (!assignmentData) {
        setLoading(false);
        return;
      }

      const [
        routeSites,
        denominations,
        cashPickups,
        atmLoads,
        excessCash,
        adjustments,
        issues,
        travel,
      ] = await Promise.all([
        supabase
          .from("route_sites")
          .select(`sequence_no, site:site_id(*)`)
          .eq("assignment_id", id)
          .order("sequence_no"),

        supabase
          .from("denomination_plans")
          .select(`*, site:site_id(*)`)
          .eq("assignment_id", id),

        supabase
          .from("cash_pickups")
          .select("*")
          .eq("assignment_id", id),

        supabase
          .from("atm_replenishments")
          .select(`*, site:site_id(*)`)
          .eq("assignment_id", id),

        supabase
          .from("atm_excess_cash")
          .select(`*, site:site_id(*)`)
          .eq("assignment_id", id),

        supabase
          .from("soa_adjustments")
          .select("adjustment_type, exchange_metadata, transfer_metadata, created_at")
          .eq("assignment_id", id)
          .in("adjustment_type", ["EXCHANGE", "INTER_SITE_TRANSFER"])
          .order("created_at", { ascending: true }),

        supabase
          .from("technical_issues")
          .select(`*, site:site_id(*)`)
          .eq("assignment_id", id),

        supabase
          .from("travel_logs")
          .select("*")
          .eq("assignment_id", id),
      ]);

      setAssignment(assignmentData);
      setData({
        routeSites: routeSites.data || [],
        denominations: denominations.data || [],
        cashPickups: cashPickups.data || [],
        atmLoads: atmLoads.data || [],
        excessCash: excessCash.data || [],
        adjustments: adjustments.data || [],
        issues: issues.data || [],
        travel: travel.data || [],
      });

      setLoading(false);
    }

    load();
  }, [id]);

  if (loading) {
    return (
      <AppLayout>
        <div className="container">Loading EOD details…</div>
      </AppLayout>
    );
  }

  if (!assignment) {
    return (
      <AppLayout>
        <div className="container text-red-600">Assignment not found.</div>
      </AppLayout>
    );
  }

  const exchanges = (data.adjustments || []).filter(
    (a: any) => a.adjustment_type === "EXCHANGE"
  );
  const transfers = (data.adjustments || []).filter(
    (a: any) => a.adjustment_type === "INTER_SITE_TRANSFER"
  );

  const totalPicked = (data.cashPickups || []).reduce(
    (sum: number, row: any) => sum + denomTotal(row),
    0
  );
  const totalLoaded = (data.atmLoads || []).reduce(
    (sum: number, row: any) => sum + denomTotal(row),
    0
  );
  const cashInHand = totalPicked - totalLoaded;
  const closingUnbalanced = Math.abs(cashInHand) >= 0.01;

  /* ---------------- Render ---------------- */
  return (
    <AppLayout>
      <div className="container space-y-6 text-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-xl font-semibold text-primary">
            EOD Detail – Assignment #{assignment.id}
          </h2>
          <button
            onClick={() => window.print()}
            className="btn-secondary text-xs print:hidden"
          >
            🖨️ Print / PDF
          </button>
        </div>

        <Section title="Assignment Summary">
          <div>Date: {assignment.assignment_date}</div>
          <div>Status: {assignment.status}</div>
        </Section>

        <Section title="EOD Report Summary">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            <div className="bg-slate-50 border border-slate-200 rounded p-3">
              <div className="text-xs text-slate-600">Cash Picked</div>
              <div className="font-semibold">₹{totalPicked.toLocaleString("en-IN")}</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded p-3">
              <div className="text-xs text-slate-600">Cash Loaded</div>
              <div className="font-semibold">₹{totalLoaded.toLocaleString("en-IN")}</div>
            </div>
            <div className={`rounded p-3 border ${closingUnbalanced ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
              <div className="text-xs text-slate-600">Cash in Hand (Expected 0)</div>
              <div className="font-semibold">
                ₹{cashInHand.toLocaleString("en-IN")}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Route Sites">
          {data.routeSites.map((r: any) => (
            <div key={r.sequence_no}>
              {r.sequence_no}. {formatSite(r.site)}
            </div>
          ))}
        </Section>

          <Section title="Cash Pickups (Detailed)">
        {data.cashPickups.map((c: any, i: number) => {
    const total =
      (c.denom_100 || 0) * 100 +
      (c.denom_200 || 0) * 200 +
      (c.denom_500 || 0) * 500 +
      (c.denom_2000 || 0) * 2000;

    return (
      <div key={i} className="border rounded p-3 mb-3">
        <div className="font-medium">
          {c.bank_name} {c.branch && `– ${c.branch}`}
        </div>

        <div className="text-xs text-slate-600">
          Pickup Time:
          {" "}
          {formatIST(c.pickup_time)}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs mt-2">
          {DENOM_ORDER.map((d) => (
            <div key={d}>₹{d} × {c[`denom_${d}`] || 0}</div>
          ))}
        </div>

        <div className="mt-2 font-semibold">
          Total Picked: ₹{total}
        </div>

        {c.slip_url && (
          <a
            href={c.slip_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-blue-600 underline mt-1 inline-block"
          >
            View Pickup Slip
          </a>
        )}
      </div>
    );
  })}
</Section>


        <Section title="ATM Replenishments (Detailed)">
          {data.atmLoads.map((a: any, i: number) => (
            <div key={i} className="border rounded p-3 mb-2">
              <div className="font-medium">{formatSite(a.site)}</div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                {DENOM_ORDER.map((d) => (
                  <div key={d}>₹{d} × {a[`denom_${d}`] || 0}</div>
                ))}
              </div>

              <div className="mt-2 font-semibold">
                Total Loaded: ₹{denomTotal(a)}
              </div>

              {a.closing_balance != null && (
                <div className="text-xs text-slate-600">
                  Closing Balance: ₹{a.closing_balance}
                </div>
              )}
            </div>
          ))}
        </Section>

        <Section title="Inter-Site Transfers">
          {transfers.length === 0 && (
            <div className="text-xs text-slate-500">No transfers recorded.</div>
          )}
          {transfers.map((t: any, i: number) => (
            <div key={i} className="border rounded p-3 mb-2 text-xs">
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
            <div key={i} className="border rounded p-3 mb-2 text-xs">
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
          {(data.excessCash || []).length === 0 && (
            <div className="text-xs text-slate-500">No excess recorded.</div>
          )}
          {(data.excessCash || []).map((e: any, i: number) => (
            <div key={i} className="border rounded p-3 mb-2 text-xs">
              <div className="font-medium">{formatSite(e.site)}</div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {DENOM_ORDER.map((d) => (
                  <div key={d}>₹{d} × {e[`denom_${d}`] || 0}</div>
                ))}
              </div>
              <div className="mt-2 font-semibold">
                Total: ₹{denomTotal(e)}
              </div>
            </div>
          ))}
        </Section>

        <Section title="Technical Issues">
          {data.issues.map((t: any, i: number) => (
            <div key={i}>
              {formatSite(t.site)} – {t.issue_type}
            </div>
          ))}
        </Section>

        {/* ---------------- Signature Review ---------------- */}
        {assignment.eod_signed && assignment.eod_signature_url && (
          <Section title="Custodian Signature">
            <button
              className="btn-secondary"
              onClick={() => setShowSignature(true)}
            >
              View Signature
            </button>

            {showSignature && (
              <div
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
                onClick={() => setShowSignature(false)}
              >
                <div className="bg-white p-4 rounded shadow max-w-lg w-full">
                  <img
                    src={assignment.eod_signature_url}
                    alt="Signature"
                    className="w-full border"
                  />
                  <div className="text-xs mt-2 text-slate-500">
                    Signed on{" "}
                    {new Date(
                      assignment.eod_signed_at
                    ).toLocaleString("en-IN")}
                  </div>
                </div>
              </div>
            )}
          </Section>
        )}

        {/* ---------------- Approval Actions ---------------- */}
        {assignment.status === "submitted" && (
          <Section title="Approval Actions">
            <div className="flex gap-3">
              <button
                className="btn-primary"
                onClick={async () => {
                  if (submitLocked) return;
                  setSubmitLocked(true);
                  console.log("=== APPROVAL STARTED ===");
                  console.log("Assignment ID:", assignment.id);
                  console.log("Approved by:", profile?.id);
                  
                  try {
                    // Use RPC function to bypass triggers
                    console.log("Calling approve_eod_assignment RPC function...");
                    const { data, error } = await supabase.rpc(
                      'approve_eod_assignment',
                      { 
                        p_assignment_id: assignment.id,
                        p_approved_by: profile?.id 
                      }
                    );

                    console.log("RPC Response:", { data, error });

                    if (error) {
                      console.error("RPC error:", error);
                      setSubmitLocked(false);
                      alert(
                        `Failed to approve EOD: ${error.message}\n\n` +
                        `Please ensure you have run FIX_EOD_APPROVAL_TRIGGER.sql in Supabase SQL Editor.\n\n` +
                        `Technical details: ${error.code || 'N/A'}`
                      );
                      return;
                    }

                    // Check if the function returned an error in the result
                    if (data && !data.success) {
                      console.error("Function returned error:", data);
                      setSubmitLocked(false);
                      alert(`Failed to approve EOD: ${data.message || 'Unknown error'}`);
                      return;
                    }

                    // Success
                    console.log("Approval successful, navigating back...");
                    setConfirmTitle("EOD Approved");
                    setConfirmMessage("EOD approved successfully.");
                    setConfirmNavigate(true);
                    setShowConfirm(true);
                  } catch (err: any) {
                    console.error("Approval error:", err);
                    setSubmitLocked(false);
                    alert(
                      `Failed to approve EOD: ${err.message || "Unknown error"}\n\n` +
                      `Please ensure you have run FIX_EOD_APPROVAL_TRIGGER.sql in Supabase SQL Editor.`
                    );
                  }
                }}
              >
                ✅ Approve EOD
              </button>

              <button
                className="btn-secondary"
                onClick={() => navigate("/admin/approvals")}
              >
                Back
              </button>
            </div>

            <textarea
              className="w-full border rounded p-2 text-sm mt-3"
              placeholder="Rejection reason (mandatory)"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />

            <button
              className="btn-danger mt-2"
              onClick={async () => {
                if (submitLocked) return;
                if (!rejectReason.trim()) {
                  alert("Rejection reason is mandatory");
                  return;
                }

                setSubmitLocked(true);

                const { error } = await supabase
                  .from("assignments")
                  .update({
                    status: "rejected",
                    rejected_at: new Date().toISOString(),
                    rejected_by: profile?.id,
                    rejection_reason: rejectReason,
                  })
                  .eq("id", assignment.id);

                if (error) {
                  console.error("Rejection error:", error);
                  setSubmitLocked(false);
                  alert(`Failed to reject EOD: ${error.message}`);
                  return;
                }

                setConfirmTitle("EOD Rejected");
                setConfirmMessage("EOD rejected successfully.");
                setConfirmNavigate(true);
                setShowConfirm(true);
              }}
            >
              ❌ Reject EOD
            </button>
          </Section>
        )}
      </div>

      <ConfirmationModal
        open={showConfirm}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
          if (confirmNavigate) {
            navigate("/admin/approvals");
          }
        }}
      />
    </AppLayout>
  );
}

/* ---------------- Section Wrapper ---------------- */
function Section({ title, children }: any) {
  const hasContent = React.Children.count(children) > 0;

  return (
    <div className="bg-white p-4 rounded shadow">
      <h3 className="font-semibold mb-2">{title}</h3>
      {hasContent ? children : (
        <p className="text-xs text-slate-500">No records</p>
      )}
    </div>
  );
}
