import React, { useEffect, useState , useRef} from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import SignatureCanvas from "react-signature-canvas";


// 🔹 Standard site label formatter
function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function EODSummary() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);

  // Custodian data
  const [assignment, setAssignment] = useState<any>(null);
  const [routeSites, setRouteSites] = useState<any[]>([]);
  const [taskSummary, setTaskSummary] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState<string | null>(null);
  

  // Admin data
  const [adminAssignments, setAdminAssignments] = useState<any[]>([]);
  const [issueSummary, setIssueSummary] = useState<any>(null);

  const today = new Date().toISOString().split("T")[0];

  useEffect(() => {
    if (!profile) return;

    if (profile.role === "custodian") {
      loadCustodianEOD();
    } else if (profile.role === "admin" || profile.role === "supervisor") {
      loadAdminDashboard();
    }
  }, [profile]);

  // --------------------------------------------------
  // CUSTODIAN EOD SUMMARY
  // --------------------------------------------------
  async function loadCustodianEOD() {
    setLoading(true);

    const { data: assign } = await supabase
      .from("assignments")
      .select("*")
      .eq("custodian_id", profile.id)
      .eq("assignment_date", today)
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

    const [denoms, pickups, loads, issues] = await Promise.all([
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
    ]);

    setTaskSummary({
      denomCount: denoms.count || 0,
      pickupCount: pickups.count || 0,
      loadCount: loads.count || 0,
      issueCount: issues.count || 0,
    });

    setLoading(false);
  }



  // --------------------------------------------------
  // SUBMIT EOD (NEW)
  // --------------------------------------------------

  {assignment?.status === "rejected" && assignment.rejection_reason && (
  <div className="bg-red-50 border border-red-200 p-3 rounded text-sm text-red-700">
    <strong>Rejected:</strong> {assignment.rejection_reason}
  </div>
)}


  async function submitEOD() {
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
    }

    setSubmitting(false);
  }

  // --------------------------------------------------
  // ADMIN / SUPERVISOR VIEW (UNCHANGED)
  // --------------------------------------------------
  async function loadAdminDashboard() {
    setLoading(true);

    const { data: assigns } = await supabase
      .from("assignments")
      .select("*, custodian:custodian_id(full_name)")
      .eq("assignment_date", today);

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
          onSubmit={submitEOD}
          submitting={submitting}
          submitMsg={submitMsg}
        />
      )}

      {!loading &&
        (profile?.role === "admin" ||
          profile?.role === "supervisor") && (
          <AdminDashboard
            adminAssignments={adminAssignments}
            issueSummary={issueSummary}
          />
        )}
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
  onSubmit,
  submitting,
  submitMsg,
}: any) {
  const sigPadRef = useRef<any>(null);
  const [signing, setSigning] = useState(false);
  const [sigError, setSigError] = useState<string | null>(null);

  async function submitSignature() {
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

      alert("EOD signed and locked successfully.");
      sigPadRef.current.clear();
    } catch (err) {
      setSigError("Failed to save signature. Please try again.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">
        End of Day Summary – Today
      </h2>

      {!assignment && (
        <div className="p-4 bg-yellow-100 rounded">
          No assignment created for today.
        </div>
      )}

      {assignment && (
        <>
          <div className="p-4 bg-white rounded shadow text-sm">
            <div className="font-semibold">Assignment ID: {assignment.id}</div>
            <div>Status: {assignment.status}</div>
          </div>

          <h3 className="font-semibold">Route Sites</h3>
          {routeSites.map((rs: any, idx: number) => (
            <div key={rs.id} className="p-3 bg-white rounded shadow text-sm">
              {idx + 1}. {formatSite(rs.site)}
            </div>
          ))}

          <h3 className="font-semibold">Tasks Summary</h3>
          <div className="grid grid-cols-2 gap-3">
            <SummaryBox label="Denomination Plans" value={taskSummary?.denomCount} />
            <SummaryBox label="Cash Pickup" value={taskSummary?.pickupCount} />
            <SummaryBox label="ATM Loads" value={taskSummary?.loadCount} />
            <SummaryBox label="Issues Logged" value={taskSummary?.issueCount} />
          </div>

          {/* Submit EOD */}
          {assignment.status === "open" && (
            <div className="pt-4">
              <button
                onClick={onSubmit}
                disabled={submitting}
                className="w-full bg-primary text-white py-2 rounded"
              >
                {submitting ? "Submitting..." : "Submit End of Day Report"}
              </button>
            </div>
          )}

          {submitMsg && (
            <p className="text-sm text-center text-green-700">{submitMsg}</p>
          )}
        </>
      )}

      {/* ✍️ DIGITAL SIGNATURE */}
      {assignment?.status === "submitted" && !assignment.eod_signed && (
        <div className="mt-6 p-4 bg-white rounded shadow">
          <h3 className="font-semibold mb-2">✍️ Custodian Signature</h3>

          <p className="text-xs text-slate-500 mb-2">
            Please sign to confirm today’s cash operations are accurate.
          </p>

          <div className="border rounded bg-slate-50">
            <SignatureCanvas
              ref={sigPadRef}
              penColor="black"
              canvasProps={{ width: 500, height: 180, className: "w-full" }}
            />
          </div>

          {sigError && <p className="text-xs text-red-600 mt-2">{sigError}</p>}

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
        </div>
      )}
    </div>
  );
}


  async function submitSignature() {
    if (!assignment?.id) return;

    if (!sigPadRef.current || sigPadRef.current.isEmpty()) {
      setSigError("Please sign before submitting.");
      return;
    }

    try {
      setSigning(true);
      setSigError(null);

      const dataUrl = sigPadRef.current.toDataURL("image/png");
      const res = await fetch(dataUrl);
      const blob = await res.blob();

      const path = `assignment_${assignment.id}_${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("eod-signatures")
        .upload(path, blob, { contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("eod-signatures")
        .getPublicUrl(path);

      const { error } = await supabase
        .from("assignments")
        .update({
          eod_signed: true,
          eod_signed_at: new Date().toISOString(),
          eod_signature_url: data.publicUrl,
        })
        .eq("id", assignment.id);

      if (error) throw error;

      alert("EOD signed successfully.");
      sigPadRef.current.clear();
    } catch (e) {
      setSigError("Failed to save signature.");
    } finally {
      setSigning(false);
    }
  }

// --------------------------------------------------
// Admin UI
// --------------------------------------------------
function AdminDashboard({ adminAssignments, issueSummary }: any) {
  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-primary">
        Admin Overview
      </h2>

      <h3 className="font-semibold">Today’s Assignments</h3>
      {adminAssignments.map((a: any) => (
        <div key={a.id} className="p-4 bg-white rounded shadow text-sm">
          <div>Assignment ID: {a.id}</div>
          <div>Custodian: {a.custodian?.full_name}</div>
          <div>Status: {a.status}</div>
        </div>
      ))}

      <h3 className="font-semibold">Issue Summary</h3>
      <div className="grid grid-cols-3 gap-3">
        <SummaryBox label="New" value={issueSummary?.new} />
        <SummaryBox
          label="In Progress"
          value={issueSummary?.inProgress}
        />
        <SummaryBox
          label="Resolved"
          value={issueSummary?.resolved}
        />
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