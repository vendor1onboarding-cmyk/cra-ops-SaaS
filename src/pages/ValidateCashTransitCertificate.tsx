import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "../api/supabaseClient";

type ValidationState = "loading" | "valid" | "invalid" | "error";

export default function ValidateCashTransitCertificate() {
  const location = useLocation();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const assignmentId = params.get("assignment_id") || "";

  const [state, setState] = useState<ValidationState>("loading");
  const [message, setMessage] = useState("Checking certificate details...");
  const [details, setDetails] = useState<{
    assignmentDate?: string;
    custodianId?: string;
    totalIndent?: number;
  }>({});

  useEffect(() => {
    async function validateCertificate() {
      if (!assignmentId) {
        setState("invalid");
        setMessage("Invalid QR: assignment id is missing.");
        return;
      }

      try {
        const { data: assignment, error: assignmentError } = await supabase
          .from("assignments")
          .select("id, assignment_date, custodian_id")
          .eq("id", assignmentId)
          .maybeSingle();

        if (assignmentError || !assignment) {
          setState("invalid");
          setMessage("Certificate not found or cannot be verified.");
          return;
        }

        const { data: plans, error: plansError } = await supabase
          .from("denomination_plans")
          .select("denom_500, denom_200, denom_100")
          .eq("assignment_id", assignmentId);

        if (plansError) {
          setState("error");
          setMessage("Certificate found, but denomination details could not be loaded.");
          return;
        }

        const totalIndent = (plans || []).reduce((sum, p: any) => {
          return sum + (p.denom_500 || 0) * 500 + (p.denom_200 || 0) * 200 + (p.denom_100 || 0) * 100;
        }, 0);

        setDetails({
          assignmentDate: assignment.assignment_date,
          custodianId: assignment.custodian_id,
          totalIndent,
        });
        setState("valid");
        setMessage("Valid certificate.");
      } catch {
        setState("error");
        setMessage("Unexpected error during validation.");
      }
    }

    validateCertificate();
  }, [assignmentId]);

  const badgeColor =
    state === "valid"
      ? "#166534"
      : state === "loading"
      ? "#1d4ed8"
      : "#b91c1c";

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", padding: 16 }}>
      <div
        style={{
          maxWidth: 720,
          margin: "24px auto",
          background: "#fff",
          border: "1px solid #e2e8f0",
          borderRadius: 12,
          padding: 24,
          fontFamily: "Arial, sans-serif",
        }}
      >
        <h1 style={{ marginTop: 0, marginBottom: 12, fontSize: 22 }}>Cash Transit Certificate Validation</h1>

        <div
          style={{
            display: "inline-block",
            padding: "6px 10px",
            borderRadius: 999,
            color: "#fff",
            background: badgeColor,
            fontWeight: 700,
            fontSize: 12,
            marginBottom: 12,
          }}
        >
          {state.toUpperCase()}
        </div>

        <p style={{ marginTop: 0, fontSize: 15 }}>{message}</p>

        <div style={{ fontSize: 14, lineHeight: 1.7 }}>
          <div>
            <b>Assignment ID:</b> {assignmentId || "-"}
          </div>
          <div>
            <b>Assignment Date:</b> {details.assignmentDate || "-"}
          </div>
          <div>
            <b>Custodian ID:</b> {details.custodianId || "-"}
          </div>
          <div>
            <b>Total Planned Amount:</b>{" "}
            {typeof details.totalIndent === "number" ? `Rs ${details.totalIndent.toLocaleString("en-IN")}` : "-"}
          </div>
        </div>
      </div>
    </div>
  );
}
