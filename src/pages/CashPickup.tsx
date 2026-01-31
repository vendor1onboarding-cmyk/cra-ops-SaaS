import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import { getISTDateString } from "../utils/time";

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

  const today = getISTDateString();

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
    form.denom_100 * 100;

  const variance = totalAmount - expectedAmount;

  // --------------------------------------------------
  // Save (UPSERT – one pickup per bank per day)
  // --------------------------------------------------
  async function handleSave() {
    if (loading) return;
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
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            Cash Pickup
          </h2>
          <p className="text-sm text-slate-600">
            Record cash pickup details from banks
          </p>
        </div>

        {!assignmentId && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <span className="font-semibold">ℹ️ No assignment available</span> for today.
          </div>
        )}

        {assignmentId && (
          <>
            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="e.g. HDFC Bank"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Branch
                </label>
                <input
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. Velachery"
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Expected Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={expectedAmount}
                  onChange={(e) =>
                    setExpectedAmount(Number(e.target.value))
                  }
                  placeholder="0"
                />
              </div>
            </div>

            <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-800 mb-4">
                  Denomination Details
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  ["denom_2000", 2000],
                  ["denom_500", 500],
                  ["denom_200", 200],
                  ["denom_100", 100],
                ].map(([key, label]) => (
                  <div key={key} className="form-group">
                    <label className="text-sm font-medium text-slate-700">
                      ₹{label}
                    </label>
                    <input
                      type="number"
                      min={0}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      value={(form as any)[key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          [key]: Number(e.target.value),
                        })
                      }
                      placeholder="0"
                    />
                  </div>
                ))}
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <span className="text-xs text-slate-600">Total Amount</span>
                  <div className="text-xl font-bold text-primary">
                    ₹{totalAmount.toLocaleString()}
                  </div>
                </div>

                <div className={`rounded-lg p-4 ${
                  variance === 0
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}>
                  <span className="text-xs text-slate-600">Variance</span>
                  <div className={`text-xl font-bold ${
                    variance === 0 ? "text-green-600" : "text-red-600"
                  }`}>
                    ₹{variance.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleSave}
                disabled={loading}
                className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
              >
                {loading ? "Saving..." : "Save Cash Pickup"}
              </button>
            </div>

            {message && (
              <p className={`text-sm text-center p-3 rounded-lg ${
                message.includes("success")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {message}
              </p>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
