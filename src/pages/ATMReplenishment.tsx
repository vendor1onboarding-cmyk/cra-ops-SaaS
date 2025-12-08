import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import { useAuth } from "../context/AuthContext";

export default function ATMReplenishmentPage() {
  const { profile } = useAuth();
  const [siteId, setSiteId] = useState<number | null>(null);
  const [timeIn, setTimeIn] = useState("");
  const [timeOut, setTimeOut] = useState("");
  const [closingBalance, setClosingBalance] = useState(0);
  const [remarks, setRemarks] = useState("");
  const [denoms, setDenoms] = useState<Record<string, number>>({});

  const { data: assignment } = useQuery({
    queryKey: ["current-assignment", profile?.id],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("assignments")
        .select("*")
        .eq("assignment_date", today)
        .eq("custodian_id", profile?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile && profile.role === "custodian",
  });

  const { data: sites } = useQuery({
    queryKey: ["sites"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sites").select("*");
      if (error) throw error;
      return data;
    },
  });

  const mutation = useMutation({
    mutationFn: async () => {
      if (!assignment || !siteId) return;

      const payload = {
        assignment_id: assignment.id,
        site_id: siteId,
        time_in: timeIn ? new Date(timeIn).toISOString() : null,
        time_out: timeOut ? new Date(timeOut).toISOString() : null,
        closing_balance: closingBalance,
        remarks,
        ...denoms,
      };

      const { error } = await supabase
        .from("atm_replenishments")
        .insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      alert("ATM replenishment saved");
      setTimeIn("");
      setTimeOut("");
      setClosingBalance(0);
      setRemarks("");
      setDenoms({});
    },
  });

  const handleDenomChange = (name: string, value: number) => {
    setDenoms((prev) => ({ ...prev, [name]: value }));
  };

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto pb-20 md:pb-0">
        <h2 className="text-lg font-semibold mb-2 text-slate-800">
          ATM Replenishment
        </h2>
        {!assignment && profile?.role === "custodian" && (
          <p className="text-sm text-slate-600">
            No assignment found for today.
          </p>
        )}
        {profile?.role !== "custodian" && (
          <p className="text-xs text-slate-500 mb-4">
            This is a field-entry view for custodians to log ATM loads.
          </p>
        )}
        {assignment && profile?.role === "custodian" && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4 border-t-4 border-primary-light">
            <div>
              <label className="block text-xs mb-1">Site</label>
              <select
                className="w-full border rounded-lg px-2 py-2 text-sm"
                value={siteId ?? ""}
                onChange={(e) =>
                  setSiteId(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              >
                <option value="">Select site</option>
                {sites?.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.site_code} - {s.city}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs mb-1">Time In</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-lg px-2 py-2 text-sm"
                  value={timeIn}
                  onChange={(e) => setTimeIn(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Time Out</label>
                <input
                  type="datetime-local"
                  className="w-full border rounded-lg px-2 py-2 text-sm"
                  value={timeOut}
                  onChange={(e) => setTimeOut(e.target.value)}
                />
              </div>
            </div>

            <DenominationFields
              values={denoms}
              onChange={handleDenomChange}
            />

            <div>
              <label className="block text-xs mb-1">
                Closing balance after load (₹)
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-2 py-2 text-sm"
                value={closingBalance}
                onChange={(e) =>
                  setClosingBalance(Number(e.target.value || 0))
                }
              />
            </div>

            <div>
              <label className="block text-xs mb-1">Remarks</label>
              <textarea
                className="w-full border rounded-lg px-2 py-2 text-sm"
                rows={3}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="High demand site, tech issue observed, etc."
              />
            </div>

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
            >
              {mutation.isPending ? "Saving..." : "Save Replenishment"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
