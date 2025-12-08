import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import { useAuth } from "../context/AuthContext";

export default function CashPickupPage() {
  const { profile } = useAuth();
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [expected, setExpected] = useState(0);
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

  const mutation = useMutation({
    mutationFn: async () => {
      if (!assignment) return;

      const total = [2000, 500, 200, 100, 50, 20, 10].reduce(
        (sum, d) => sum + (denoms[`denom_${d}`] || 0) * d,
        0
      );

      const payload = {
        assignment_id: assignment.id,
        bank_name: bankName,
        branch,
        expected_amount: expected,
        total_amount: total,
        variance: total - expected,
        ...denoms,
      };

      const { error } = await supabase.from("cash_pickups").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      alert("Cash pickup saved");
      setBankName("");
      setBranch("");
      setExpected(0);
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
          Cash Pickup & Verification
        </h2>
        {!assignment && profile?.role === "custodian" && (
          <p className="text-sm text-slate-600">
            No assignment found for today.
          </p>
        )}
        {profile?.role !== "custodian" && (
          <p className="text-xs text-slate-500 mb-4">
            This screen is primarily for custodians to capture cash from bank.
          </p>
        )}
        {assignment && profile?.role === "custodian" && (
          <div className="bg-white rounded-xl shadow-sm p-4 space-y-4 border-t-4 border-primary">
            <div className="grid md:grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs mb-1">Bank Name</label>
                <input
                  className="w-full border rounded-lg px-2 py-2 text-sm"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                />
              </div>
              <div>
                <label className="block text-xs mb-1">Branch</label>
                <input
                  className="w-full border rounded-lg px-2 py-2 text-sm"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. Velachery"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs mb-1">
                Expected amount from bank (₹)
              </label>
              <input
                type="number"
                className="w-full border rounded-lg px-2 py-2 text-sm"
                value={expected}
                onChange={(e) =>
                  setExpected(Number(e.target.value || 0))
                }
              />
            </div>

            <DenominationFields
              values={denoms}
              onChange={handleDenomChange}
            />

            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending}
              className="w-full py-2 rounded-lg bg-primary text-white text-sm font-semibold disabled:opacity-60"
            >
              {mutation.isPending ? "Saving..." : "Save Pickup"}
            </button>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
