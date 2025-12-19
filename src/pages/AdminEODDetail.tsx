import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";

// 🔹 Standard site formatter (same as rest of app)
function formatSite(site: any) {
  if (!site) return "Unknown Site";
  const bank = site.bank_name || "Bank";
  const address = site.address || site.site_code || "Location";
  const atm = site.atm_id ? ` (ATM: ${site.atm_id})` : "";
  return `${bank} – ${address}${atm}`;
}

export default function AdminEODDetail() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();

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
    async function load() {
      setLoading(true);

      const { data: assignmentData } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
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

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6 text-sm">
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
              {formatSite(d.site)} | ₹2000:{d.denom_2000} ₹500:{d.denom_500}
            </div>
          ))}
        </Section>

        <Section title="Cash Pickups">
          {data.cashPickups.map((c: any, i: number) => (
            <div key={i}>
              {c.bank_name} – ₹{c.total_amount} (Var: {c.variance})
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
              {t.photo_url && (
                <div>
                  <a
                    href={t.photo_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline text-xs"
                  >
                    View Photo
                  </a>
                </div>
              )}
            </div>
          ))}
        </Section>

        {assignment.status === "submitted" && (
          <div className="flex gap-4">
            <button
              onClick={() => updateStatus("approved")}
              className="bg-green-600 text-white px-4 py-2 rounded"
            >
              Approve
            </button>
            <button
              onClick={() => updateStatus("rejected")}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// --------------------------------------------------
// Safe Section wrapper
// --------------------------------------------------
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
