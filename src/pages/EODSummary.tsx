import { useQuery } from "@tanstack/react-query";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { useAuth } from "../context/AuthContext";

export default function EODSummaryPage() {
  const { profile } = useAuth();

  const { data: assignment } = useQuery({
    queryKey: ["current-assignment-eod", profile?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      let query = supabase.from("assignments").select("*").eq("assignment_date", today);

      if (profile?.role === "custodian") {
        query = query.eq("custodian_id", profile.id);
      }

      const { data, error } = await query.single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile,
  });

  const { data: cashPickups } = useQuery({
    queryKey: ["cash-pickups", assignment?.id],
    queryFn: async () => {
      if (!assignment) return [];
      const { data, error } = await supabase
        .from("cash_pickups")
        .select("*")
        .eq("assignment_id", assignment.id);
      if (error) throw error;
      return data;
    },
    enabled: !!assignment,
  });

  const { data: replenishments } = useQuery({
    queryKey: ["replenishments", assignment?.id],
    queryFn: async () => {
      if (!assignment) return [];
      const { data, error } = await supabase
        .from("atm_replenishments")
        .select("*, sites(site_code)")
        .eq("assignment_id", assignment.id);
      if (error) throw error;
      return data;
    },
    enabled: !!assignment,
  });

  const { data: issues } = useQuery({
    queryKey: ["issues", assignment?.id],
    queryFn: async () => {
      if (!assignment) return [];
      const { data, error } = await supabase
        .from("technical_issues")
        .select("*, sites(site_code)")
        .eq("assignment_id", assignment.id);
      if (error) throw error;
      return data;
    },
    enabled: !!assignment,
  });

  const totalCash = (cashPickups || []).reduce(
    (sum: number, c: any) => sum + (c.total_amount || 0),
    0
  );

  return (
    <AppLayout>
      <div className="max-w-4xl mx-auto pb-20 md:pb-0 space-y-4">
        <h2 className="text-lg font-semibold text-slate-800">
          End-of-Day Summary
        </h2>

        {!assignment && (
          <p className="text-sm text-slate-600">
            No assignment found for today.
          </p>
        )}

        {assignment && (
          <>
            <div className="bg-white rounded-xl shadow-sm p-4 text-sm border-t-4 border-primary">
              <p>
                <span className="font-semibold">Assignment:</span>{" "}
                {assignment.title || assignment.id}
              </p>
              <p>
                <span className="font-semibold">Date:</span>{" "}
                {assignment.assignment_date}
              </p>
              <p>
                <span className="font-semibold">Total cash picked:</span> ₹
                {totalCash || 0}
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-semibold text-sm mb-2">
                  Cash Pickups
                </h3>
                {cashPickups && cashPickups.length > 0 ? (
                  <ul className="space-y-1">
                    {cashPickups.map((c: any) => (
                      <li key={c.id}>
                        • {c.bank_name} {c.branch} – ₹
                        {c.total_amount} (Var: {c.variance})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No cash pickups recorded.</p>
                )}
              </div>

              <div className="bg-white rounded-xl shadow-sm p-4">
                <h3 className="font-semibold text-sm mb-2">
                  ATM Replenishments
                </h3>
                {replenishments && replenishments.length > 0 ? (
                  <ul className="space-y-1">
                    {replenishments.map((r: any) => (
                      <li key={r.id}>
                        • Site {r.site_id} – Closing ₹{r.closing_balance}{" "}
                        ({r.remarks || "No remarks"})
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No replenishment entries.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4 text-xs">
              <h3 className="font-semibold text-sm mb-2">
                Technical Issues
              </h3>
              {issues && issues.length > 0 ? (
                <ul className="space-y-1">
                  {issues.map((i: any) => (
                    <li key={i.id}>
                      • Site {i.site_id} – {i.issue_type} – Code{" "}
                      {i.error_code} – {i.status || "new"}
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No issues logged.</p>
              )}
            </div>
          </>
        )}
      </div>
    </AppLayout>
  );
}
