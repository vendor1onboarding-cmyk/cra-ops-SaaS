import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";


/**
 * Standard site formatter
 */
function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function AdminEODDetail() {
  const params = useParams();
  const navigate = useNavigate();
const { profile } = useAuth();
const [rejectReason, setRejectReason] = useState("");

  // 🔑 FIX: parse assignmentId as number
  const assignmentId = Number(params.assignmentId);

  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<any>(null);
  const [data, setData] = useState<any>({
    routeSites: [],
    denominations: [],
    cashPickups: [],
    atmLoads: [],
    issues: [],
    travel: [],
  });

  useEffect(() => {
    if (!assignmentId || Number.isNaN(assignmentId)) {
      setLoading(false);
      return;
    }

    async function load() {
      setLoading(true);

      /* ---------------- Assignment ---------------- */
      const { data: assignmentData } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
        .maybeSingle();

      if (!assignmentData) {
        setLoading(false);
        return;
      }

      /* ---------------- All EOD Data ---------------- */
      const [
        routeSites,
        denominations,
        cashPickups,
        atmLoads,
        issues,
        travel,
      ] = await Promise.all([
        supabase
          .from("route_sites")
          .select(`
            sequence_no,
            site:site_id(
              site_code,
              bank_name,
              address,
              atm_id
            )
          `)
          .eq("assignment_id", assignmentId)
          .order("sequence_no"),

        supabase
          .from("denomination_plans")
          .select(`
            *,
            site:site_id(
              site_code,
              bank_name,
              address,
              atm_id
            )
          `)
          .eq("assignment_id", assignmentId),

        supabase
          .from("cash_pickups")
          .select("*")
          .eq("assignment_id", assignmentId),

        supabase
          .from("atm_replenishments")
          .select(`
            *,
            site:site_id(
              site_code,
              bank_name,
              address,
              atm_id
            )
          `)
          .eq("assignment_id", assignmentId),

        supabase
          .from("technical_issues")
          .select(`
            *,
            site:site_id(
              site_code,
              bank_name,
              address,
              atm_id
            )
          `)
          .eq("assignment_id", assignmentId),

        supabase
          .from("travel_logs")
          .select("*")
          .eq("assignment_id", assignmentId),
      ]);

      setAssignment(assignmentData);
      setData({
        routeSites: routeSites.data || [],
        denominations: denominations.data || [],
        cashPickups: cashPickups.data || [],
        atmLoads: atmLoads.data || [],
        issues: issues.data || [],
        travel: travel.data || [],
      });

      setLoading(false);
    }

    load();
  }, [assignmentId]);

  async function updateStatus(status: "approved" | "rejected") {
    await supabase
      .from("assignments")
      .update({ status })
      .eq("id", assignmentId);

    navigate("/admin/approvals");
  }

  if (loading) {
    return (
      <AppLayout>
        <p className="text-sm">Loading EOD…</p>
      </AppLayout>
    );
  }

  if (!assignment) {
    return (
      <AppLayout>
        <p className="text-sm text-red-600">
          Assignment not found.
        </p>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-3 text-sm">
        <h2 className="text-lg font-semibold text-primary">
          EOD Detail – Assignment #{assignment.id}
        </h2>

        <Section title="Assignment">
          <div>Date: {assignment.assignment_date}</div>
          <div>Status: {assignment.status}</div>
        </Section>

        <Section title="Route Sites">
          {data.routeSites.map((r: any, i: number) => (
            <div key={i}>
              {r.sequence_no}. {formatSite(r.site)}
            </div>
          ))}
        </Section>

        <Section title="Denomination Plans">
          {data.denominations.map((d: any, i: number) => (
            <div key={i}>
              {formatSite(d.site)}
            </div>
          ))}
        </Section>

        <Section title="Cash Pickups">
          {data.cashPickups.map((c: any, i: number) => (
            <div key={i}>
              {c.bank_name} – ₹{c.total_amount}
            </div>
          ))}
        </Section>

        <Section title="ATM Replenishments">
          {data.atmLoads.map((a: any, i: number) => (
            <div key={i}>
              {formatSite(a.site)} – Closing ₹{a.closing_balance}
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
{/* ---------- Signature Review ---------- */}
        {assignment.eod_signed && assignment.eod_signature_url && (
          <div className="bg-white border rounded-xl p-4">
            <h3 className="font-semibold mb-2">✍️ Custodian Signature</h3>
            <div className="border bg-slate-50 p-3 inline-block">
              <img
                src={assignment.eod_signature_url}
                alt="Custodian Signature"
                className="max-h-40 object-contain"
              />
            </div>
            <div className="text-xs text-slate-500 mt-2">
              Signed on{" "}
              {new Date(assignment.eod_signed_at).toLocaleString("en-IN")}
            </div>
          </div>
        )}

        {/* ---------- Approval Actions ---------- */}
        {assignment.status === "submitted" && (
          <div className="bg-white border rounded-xl p-4 space-y-3">
            <div className="flex gap-3">
              <button
                className="btn-primary"
                onClick={async () => {
                  await supabase
                    .from("assignments")
                    .update({
                      status: "approved",
                      approved_at: new Date().toISOString(),
                      approved_by: profile?.id,
                    })
                    .eq("id", assignment.id);

                  navigate("/admin/approvals");
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
              placeholder="Reason for rejection (mandatory)"
              className="w-full border rounded p-2 text-sm"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />

            <button
              className="btn-danger"
              onClick={async () => {
                if (!rejectReason.trim()) {
                  alert("Rejection reason is mandatory");
                  return;
                }

                await supabase
                  .from("assignments")
                  .update({
                    status: "rejected",
                    rejected_at: new Date().toISOString(),
                    rejected_by: profile?.id,
                    rejection_reason: rejectReason,
                  })
                  .eq("id", assignment.id);

                navigate("/admin/approvals");
              }}
            >
              ❌ Reject EOD
            </button>
          </div>
        )}

      </div>
    </AppLayout>
  );
}

/* ---------------- Safe Section Wrapper ---------------- */
function Section({ title, children }: any) {
  const hasContent = Array.isArray(children)
    ? children.length > 0
    : !!children;

  return (
    <div className="bg-white p-4 rounded shadow space-y-1">
      <h3 className="font-semibold">{title}</h3>
      {hasContent ? (
        children
      ) : (
        <p className="text-slate-500 text-xs">No records</p>
      )}
    </div>
  );
}
