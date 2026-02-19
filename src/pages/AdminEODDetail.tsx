import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { formatIST, formatISTAudit, formatISTDate, formatISTTime, parseUTCDate } from "../utils/time";

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
    if (!id || isNaN(id)) {
      setLoading(false);
      return;
    }

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
        <div className="container">
          <div className="text-red-600 mb-4">
            <p className="font-semibold">Assignment not found.</p>
            <p className="text-sm mt-2">
              {!id || isNaN(id) 
                ? "Invalid assignment ID in URL." 
                : `No assignment found for ID: ${id}`}
            </p>
            <button
              onClick={() => navigate("/admin/approvals")}
              className="btn-primary text-xs mt-3"
            >
              ← Back to Approvals
            </button>
          </div>
        </div>
      </AppLayout>
    );
  }

  const extractInternalSources = (pickup: any) =>
    pickup?.internal_source_metadata?.sources || [];

  const { exchanges, transfers, bankPicked, bankLoaded, adminLoadAlloc } = useMemo(() => {
    // Filter adjustments
    const exch = (data.adjustments || []).filter(
      (a: any) => a.adjustment_type === "EXCHANGE"
    );
    const trans = (data.adjustments || []).filter(
      (a: any) => a.adjustment_type === "INTER_SITE_TRANSFER"
    );

    // FLOW 1: BANK CASH ONLY (affects Cash-in-Hand)
    const bankPick = (data.cashPickups || []).reduce((sum: number, row: any) => {
      const source = row.pickup_source || "BANK";
      if (source === "ATM_INTERNAL") return sum;
      const metaSources = extractInternalSources(row);
      const metaTotal = metaSources.reduce(
        (acc: number, s: any) => acc + Number(s.total_amount || 0),
        0
      );
      return sum + Math.max(denomTotal(row) - metaTotal, 0);
    }, 0);

    // ── Chronological denomination matching ──
    type AdminCashEvt = { kind: "pickup" | "load"; ts: number; raw: any };
    const adminCashEvents: AdminCashEvt[] = [];

    (data.cashPickups || []).forEach((p: any) => {
      const ts = p.pickup_time ? new Date(p.pickup_time).getTime() : 0;
      adminCashEvents.push({ kind: "pickup", ts, raw: p });
    });
    (data.atmLoads || []).forEach((l: any) => {
      const ts = l.time_in ? new Date(l.time_in).getTime() : 0;
      adminCashEvents.push({ kind: "load", ts, raw: l });
    });

    adminCashEvents.sort((a, b) => {
      const diff = a.ts - b.ts;
      if (diff !== 0) return diff;
      return (a.kind === "pickup" ? 0 : 1) - (b.kind === "pickup" ? 0 : 1);
    });

    const adminRemovalPool: Record<number, number> = { 100: 0, 200: 0, 500: 0, 2000: 0 };
    let adminBankLoad = 0;
    const adminLoadAllocMap = new Map<any, { bankAmount: number; internalAmount: number }>();

    adminCashEvents.forEach((evt) => {
      if (evt.kind === "pickup") {
        const p = evt.raw;
        const source = p.pickup_source || "BANK";
        if (source === "ATM_INTERNAL") {
          DENOM_ORDER.forEach((d) => {
            adminRemovalPool[d] += (p[`denom_${d}`] || 0);
          });
        } else {
          const metaSources = extractInternalSources(p);
          metaSources.forEach((s: any) => {
            DENOM_ORDER.forEach((d) => {
              adminRemovalPool[d] += Number(s.denominations?.[`denom_${d}`] || 0);
            });
          });
        }
      } else {
        const l = evt.raw;
        let loadBank = 0;
        let loadInternal = 0;

        DENOM_ORDER.forEach((d) => {
          const loadCount = (l[`denom_${d}`] || 0) as number;
          const poolCount = adminRemovalPool[d] || 0;
          const matched = Math.min(loadCount, poolCount);

          loadInternal += matched * d;
          loadBank += (loadCount - matched) * d;
          adminRemovalPool[d] = poolCount - matched;
        });

        adminBankLoad += loadBank;
        adminLoadAllocMap.set(l, { bankAmount: loadBank, internalAmount: loadInternal });
      }
    });

    return {
      exchanges: exch,
      transfers: trans,
      bankPicked: bankPick,
      bankLoaded: adminBankLoad,
      adminLoadAlloc: adminLoadAllocMap,
    };
  }, [data.adjustments, data.cashPickups, data.atmLoads]);

  // CRITICAL: Cash-in-Hand = Bank Picked - Bank Loaded (ONLY)
  const totalPicked = bankPicked;
  const totalLoaded = bankLoaded;
  const cashInHand = totalPicked - totalLoaded;
  const closingUnbalanced = Math.abs(cashInHand) >= 0.01;

  const siteMap = useMemo(
    () =>
      new Map(
        (data.routeSites || []).map((r: any) => [r.site?.id, r.site])
      ),
    [data.routeSites]
  );

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

    (data.cashPickups || []).forEach((c: any) => {
      const ts = normalizeUtcDate(c.pickup_time) || new Date();
      const isInternal = (c.pickup_source || "BANK") === "ATM_INTERNAL";
      const sourceSite = siteMap.get(c.source_site_id) || c.site;
      const amount = denomTotal(c);

      if (isInternal) {
        rows.push({
          ts,
          type: "ATM Cash Removal",
          atm: getAtmLabel(sourceSite),
          debit: 0,
          credit: -amount,
          balanceImpact: amount,
          remarks: "Removed from ATM",
        });
      } else {
        // Bank pickup — subtract internal metadata portion
        const metaSources = extractInternalSources(c);
        const metaTotal = metaSources.reduce(
          (acc: number, s: any) => acc + Number(s.total_amount || 0),
          0
        );
        const bankAmount = Math.max(amount - metaTotal, 0);
        if (bankAmount > 0) {
          rows.push({
            ts,
            type: "Bank Pickup",
            atm: "",
            debit: 0,
            credit: bankAmount,
            balanceImpact: bankAmount,
            remarks: c.branch ? `${c.bank_name || "Bank"} - ${c.branch}` : (c.bank_name || ""),
          });
        }
        if (metaTotal > 0) {
          rows.push({
            ts,
            type: "ATM Cash Removal",
            atm: "",
            debit: 0,
            credit: -metaTotal,
            balanceImpact: metaTotal,
            remarks: "From mixed pickup",
          });
        }
      }
    });

    (data.atmLoads || []).forEach((a: any) => {
      const ts = normalizeUtcDate(a.time_in || a.load_time) || new Date();
      const alloc = adminLoadAlloc.get(a);
      const bankAmt = alloc?.bankAmount || denomTotal(a);
      const internalAmt = alloc?.internalAmount || 0;
      const total = bankAmt + internalAmt;

      rows.push({
        ts,
        type: "ATM Load",
        atm: getAtmLabel(a.site),
        debit: bankAmt,
        credit: internalAmt,
        balanceImpact: -total,
        remarks: internalAmt > 0
          ? `Bank: ₹${bankAmt.toLocaleString("en-IN")} | ATM Cash: ₹${internalAmt.toLocaleString("en-IN")}`
          : "",
      });
    });

    (data.excessCash || []).forEach((e: any) => {
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
      const total = Number(
        t.transfer_metadata?.total_amount ||
          t.transfer_metadata?.source_total_amount ||
          0
      );
      const sourceSiteName = t.transfer_metadata?.source_site_name || "-";
      const destinations = t.transfer_metadata?.destinations || [];

      if (total > 0) {
        rows.push({
          ts,
          type: "Inter-site Transfer (Out)",
          atm: sourceSiteName,
          debit: 0,
          credit: -total,
          balanceImpact: -total,
          remarks: t.transfer_metadata?.reference || `Transferred to ${destinations.length} site(s)`,
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
            remarks: t.transfer_metadata?.reference || `From ${sourceSiteName}`,
          });
        }
      });
    });

    return rows.sort((a, b) => a.ts.getTime() - b.ts.getTime());
  }, [data.cashPickups, data.atmLoads, data.excessCash, exchanges, transfers, siteMap, adminLoadAlloc]);

  const printBalanceRows = useMemo(() => {
    let running = 0;
    return printRows.map((row) => {
      running += row.balanceImpact;
      return { ...row, balance: running };
    });
  }, [printRows]);

  /* ---------------- Render ---------------- */
  return (
    <AppLayout>
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
            <p>Date: {assignment.assignment_date}</p>
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

      <div className="container space-y-6 text-sm print:hidden print-hidden">
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
            <div key={d}>{c[`denom_${d}`] || 0} × ₹{d}</div>
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
              <div className="text-xs text-slate-600">Load Time: {formatIST(a.time_in || a.load_time)}</div>

              <div className="grid grid-cols-2 gap-2 text-xs mt-2">
                {DENOM_ORDER.map((d) => (
                  <div key={d}>{a[`denom_${d}`] || 0} × ₹{d}</div>
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
                  <div key={d}>{e[`denom_${d}`] || 0} × ₹{d}</div>
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
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 print:hidden"
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

      {/* PRINT FOOTER – SIGNATURES */}
      <div className="print-only mt-10 pt-6 border-t text-xs text-slate-700">
        <div className="grid grid-cols-2 gap-12">
          <div>
            <p className="font-semibold">Custodian Signature</p>
            <div className="mt-6 border-b w-48"></div>
            <p className="mt-1">Name & Date</p>
          </div>
          <div className="text-right">
            <p className="font-semibold">Admin / Supervisor</p>
            <div className="mt-6 border-b w-48 ml-auto"></div>
            <p className="mt-1">Name, Seal & Date</p>
          </div>
        </div>
        <div className="mt-4 flex justify-between">
          <div>
            <div className="font-semibold">Sruthi CRA Ops</div>
            <div>Cash Replenishment & ATM Operations</div>
          </div>
          <div className="text-right">
            <div>Generated: {new Date().toLocaleDateString("en-IN")}</div>
            <div>Confidential – Internal Use Only</div>
          </div>
        </div>
        <p className="mt-2 text-[10px] text-slate-500">
          This is a system-generated report from Sruthi CRA Ops. Any discrepancy must be reported within RBI-prescribed timelines.
        </p>
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
