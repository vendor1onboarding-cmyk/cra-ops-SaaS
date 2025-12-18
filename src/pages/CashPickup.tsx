import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";

export default function CashPickup() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [bankName, setBankName] = useState("");
  const [branch, setBranch] = useState("");
  const [expectedAmount, setExpectedAmount] = useState<number>(0);

  const [form, setForm] = useState({
    denom_2000: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
    denom_50: 0,
    denom_20: 0,
    denom_10: 0,
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const today = new Date().toISOString().split("T")[0];

  // --------------------------------------------------
  // Load TODAY's assignment ONLY (NO FALLBACK)
  // --------------------------------------------------
  useEffect(() => {
    if (!profile) return;

    async function loadTodayAssignment() {
      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .eq("status", "open")
        .maybeSingle();

      if (!assignment) {
        setAssignmentId(null);
        return;
      }

      setAssignmentId(assignment.id);
    }

    loadTodayAssignment();
  }, [profile]);

  // --------------------------------------------------
  // Calculate totals
  // --------------------------------------------------
  const totalAmount =
    form.denom_2000 * 2000 +
    form.denom_500 * 500 +
    form.denom_200 * 200 +
    form.denom_100 * 100 +
    form.denom_50 * 50 +
    form.denom_20 * 20 +
    form.denom_10 * 10;

  const variance = totalAmount - expectedAmount;

  // --------------------------------------------------
  // Save (UPSERT – one pickup per bank per day)
  // --------------------------------------------------
  async function handleSave() {
    if (!assignmentId || !bankName) {
      setMessage("Assignment or Bank name missing");
      return;
    }

    setLoading(true);
    setMessage(null);

    const { error } = await supabase
      .from("cash_pickups")
      .upsert(
        {
          assignment_id: assignmentId,
          bank_name: bankName,
          branch,
          pickup_time: new Date().toISOString(),
          expected_amount: expectedAmount,
          total_amount: totalAmount,
          variance,
          ...form,
        },
        {
          onConflict: "assignment_id,bank_name",
        }
      );

    if (error) {
      console.error(error);
      setMessage("Failed to save cash pickup");
    } else {
      setMessage("Cash pickup saved successfully");
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-xl mx-auto space-y-5">
        <h2 className="text-lg font-semibold text-primary">
          Cash Pickup
        </h2>

        {!assignmentId && (
          <div className="p-4 bg-yellow-100 rounded text-sm">
            No assignment available for today.
          </div>
        )}

        {assignmentId && (
          <>
            <div>
              <label className="text-sm block mb-1">Bank Name</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank"
              />
            </div>

            <div>
              <label className="text-sm block mb-1">Branch</label>
              <input
                className="w-full border rounded px-3 py-2 text-sm"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. Velachery"
              />
            </div>

            <div>
              <label className="text-sm block mb-1">
                Expected Amount
              </label>
              <input
                type="number"
                className="w-full border rounded px-3 py-2 text-sm"
                value={expectedAmount}
                onChange={(e) =>
                  setExpectedAmount(Number(e.target.value))
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {[
                ["denom_2000", 2000],
                ["denom_500", 500],
                ["denom_200", 200],
                ["denom_100", 100],
                ["denom_50", 50],
                ["denom_20", 20],
                ["denom_10", 10],
              ].map(([key, label]) => (
                <div key={key}>
                  <label className="text-xs">{label}</label>
                  <input
                    type="number"
                    min={0}
                    className="w-full border rounded px-2 py-1 text-sm"
                    value={(form as any)[key]}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        [key]: Number(e.target.value),
                      })
                    }
                  />
                </div>
              ))}
            </div>

            <div className="text-sm font-semibold">
              Total Amount: ₹{totalAmount.toLocaleString()}
            </div>

            <div
              className={`text-sm font-semibold ${
                variance === 0
                  ? "text-green-600"
                  : "text-red-600"
              }`}
            >
              Variance: ₹{variance.toLocaleString()}
            </div>

            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-primary text-white py-2 rounded text-sm"
            >
              {loading ? "Saving..." : "Save Cash Pickup"}
            </button>

            {message && (
              <p className="text-xs text-center text-slate-700">
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
