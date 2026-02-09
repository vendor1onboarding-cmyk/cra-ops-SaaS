import { useEffect, useState } from "react";
import { supabase } from "../../api/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import ConfirmationModal from "../../components/ConfirmationModal";

interface BankAccount {
  id: string;
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_code: string | null;
  branch_name: string | null;
  branch_phone: string | null;
  branch_email: string | null;
  branch_address: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_active: boolean;
  created_at: string;
  created_by: string;
}

interface FormData {
  bank_name: string;
  account_number: string;
  ifsc_code: string;
  branch_code: string;
  branch_name: string;
  branch_phone: string;
  branch_email: string;
  branch_address: string;
  latitude: string;
  longitude: string;
  is_active: boolean;
}

type ValidationError = {
  [key: string]: string | null;
};

export default function BankAccountOnboarding() {
  const { profile } = useAuth();

  const [view, setView] = useState<"list" | "form">("list");
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageType, setMessageType] = useState<"success" | "error">("success");
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  const [form, setForm] = useState<FormData>({
    bank_name: "",
    account_number: "",
    ifsc_code: "",
    branch_code: "",
    branch_name: "",
    branch_phone: "",
    branch_email: "",
    branch_address: "",
    latitude: "",
    longitude: "",
    is_active: true,
  });

  const [errors, setErrors] = useState<ValidationError>({});

  // Load all bank accounts
  useEffect(() => {
    loadBankAccounts();
  }, []);

  async function loadBankAccounts() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("bank_name", { ascending: true });

      if (error) {
        console.error(error);
        setMessage("Failed to load bank accounts");
        setMessageType("error");
      } else {
        setBankAccounts(data || []);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error loading bank accounts");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  // Validation
  function validateForm(): boolean {
    const newErrors: ValidationError = {};

    // Required fields
    if (!form.bank_name.trim()) {
      newErrors.bank_name = "Bank name is required";
    }

    if (!form.account_number.trim()) {
      newErrors.account_number = "Account number is required";
    }

    if (!form.ifsc_code.trim()) {
      newErrors.ifsc_code = "IFSC code is required";
    }

    // IFSC format validation: exactly 11 characters, uppercase alphanumeric
    if (form.ifsc_code && !/^[A-Z0-9]{11}$/.test(form.ifsc_code.toUpperCase())) {
      newErrors.ifsc_code = "IFSC must be 11 alphanumeric characters (e.g., CUB0000085)";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  // Check for duplicates
  async function checkDuplicate(): Promise<boolean> {
    const { data, error } = await supabase
      .from("bank_accounts")
      .select("id")
      .eq("account_number", form.account_number.trim())
      .eq("ifsc_code", form.ifsc_code.toUpperCase().trim())
      .maybeSingle();

    if (error) {
      console.error(error);
      return false;
    }

    if (data) {
      setErrors((prev) => ({
        ...prev,
        account_number: "This account number + IFSC combination already exists",
      }));
      return true;
    }

    return false;
  }

  // Handle form submission
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (submitLocked || loading) return;

    if (!validateForm()) {
      return;
    }

    if (await checkDuplicate()) {
      return;
    }

    if (!profile) {
      setMessage("User profile not available");
      setMessageType("error");
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const { error } = await supabase.from("bank_accounts").insert({
        bank_name: form.bank_name.trim(),
        account_number: form.account_number.trim(),
        ifsc_code: form.ifsc_code.toUpperCase().trim(),
        branch_code: form.branch_code.trim() || null,
        branch_name: form.branch_name.trim() || null,
        branch_phone: form.branch_phone.trim() || null,
        branch_email: form.branch_email.trim() || null,
        branch_address: form.branch_address.trim() || null,
        latitude: form.latitude ? Number(form.latitude) : null,
        longitude: form.longitude ? Number(form.longitude) : null,
        is_active: form.is_active,
        created_by: profile.id,
      });

      if (error) {
        console.error(error);
        setMessage("Failed to save bank account");
        setMessageType("error");
      } else {
        setMessageType("success");
        setSubmitLocked(true);
        setConfirmMessage(
          `Bank account added successfully for ${form.bank_name.trim() || "bank"}.`
        );
        setShowConfirm(true);
      }
    } catch (err) {
      console.error(err);
      setMessage("Error saving bank account");
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  }

  async function resetFormAfterSave() {
    setForm({
      bank_name: "",
      account_number: "",
      ifsc_code: "",
      branch_code: "",
      branch_name: "",
      branch_phone: "",
      branch_email: "",
      branch_address: "",
      latitude: "",
      longitude: "",
      is_active: true,
    });
    setErrors({});
    await loadBankAccounts();
    setView("list");
    setSubmitLocked(false);
  }

  // Handle toggle is_active
  async function handleToggleActive(id: string, currentStatus: boolean) {
    const { error } = await supabase
      .from("bank_accounts")
      .update({ is_active: !currentStatus })
      .eq("id", id);

    if (error) {
      console.error(error);
      setMessage("Failed to update status");
      setMessageType("error");
    } else {
      setMessage("✅ Bank status updated");
      setMessageType("success");
      await loadBankAccounts();
    }
  }

  // Format IFSC as user types
  function handleIFSCChange(value: string) {
    setForm({ ...form, ifsc_code: value.toUpperCase() });
    if (errors.ifsc_code) {
      setErrors({ ...errors, ifsc_code: null });
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-3">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-primary mb-1">
            🏦 Bank Account Management
          </h1>
          <p className="text-sm sm:text-base text-slate-600">
            Manage bank accounts available for cash pickup operations
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`p-4 rounded-lg border text-sm sm:text-base ${
              messageType === "success"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message}
          </div>
        )}

        {/* View Toggle */}
        <div className="flex gap-3">
          <button
            onClick={() => setView("list")}
            className={`px-4 py-2.5 rounded-lg font-semibold transition-all ${
              view === "list"
                ? "bg-primary text-white"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            📋 Bank List
          </button>
          <button
            onClick={() => setView("form")}
            className={`px-4 py-2.5 rounded-lg font-semibold transition-all ${
              view === "form"
                ? "bg-primary text-white"
                : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            }`}
          >
            ➕ Add Bank Account
          </button>
        </div>

        {/* LIST VIEW */}
        {view === "list" && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h2 className="text-lg font-semibold text-slate-800">
                Active Bank Accounts ({bankAccounts.filter((b) => b.is_active).length})
              </h2>
            </div>

            {loading ? (
              <div className="p-8 text-center text-slate-500">Loading...</div>
            ) : bankAccounts.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-slate-600 mb-4">No bank accounts yet</p>
                <button
                  onClick={() => setView("form")}
                  className="text-primary font-semibold hover:underline"
                >
                  Add your first bank account →
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Bank Name
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Account Number
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        IFSC Code
                      </th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700">
                        Branch
                      </th>
                      <th className="px-4 py-3 text-center font-semibold text-slate-700">
                        Status
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {bankAccounts.map((bank) => (
                      <tr
                        key={bank.id}
                        className="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">
                            {bank.bank_name}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {bank.account_number}
                        </td>
                        <td className="px-4 py-3 text-slate-600 font-mono">
                          {bank.ifsc_code}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {bank.branch_name || bank.branch_code || "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() =>
                              handleToggleActive(bank.id, bank.is_active)
                            }
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                              bank.is_active
                                ? "bg-green-100 text-green-800 hover:bg-green-200"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                            }`}
                          >
                            {bank.is_active ? "✅ Active" : "❌ Inactive"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* FORM VIEW */}
        {view === "form" && (
          <div className="bg-white border border-slate-200 rounded-lg p-5 sm:p-6">
            <h2 className="text-lg font-semibold text-slate-800 mb-5">
              Add New Bank Account
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Bank Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Bank Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.bank_name}
                  onChange={(e) =>
                    setForm({ ...form, bank_name: e.target.value })
                  }
                  placeholder="e.g., CITY UNION BANK"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.bank_name && (
                  <p className="text-red-600 text-xs mt-1">{errors.bank_name}</p>
                )}
              </div>

              {/* Account Number */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Account Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.account_number}
                  onChange={(e) =>
                    setForm({ ...form, account_number: e.target.value })
                  }
                  placeholder="e.g., 510909010242049"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {errors.account_number && (
                  <p className="text-red-600 text-xs mt-1">
                    {errors.account_number}
                  </p>
                )}
              </div>

              {/* IFSC Code */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  IFSC Code <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.ifsc_code}
                  onChange={(e) => handleIFSCChange(e.target.value)}
                  placeholder="e.g., CUB0000085 (11 chars)"
                  maxLength={11}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono"
                />
                {errors.ifsc_code && (
                  <p className="text-red-600 text-xs mt-1">{errors.ifsc_code}</p>
                )}
              </div>

              {/* Branch Code */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Branch Code
                </label>
                <input
                  type="text"
                  value={form.branch_code}
                  onChange={(e) =>
                    setForm({ ...form, branch_code: e.target.value })
                  }
                  placeholder="e.g., 085"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Branch Name */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Branch Name
                </label>
                <input
                  type="text"
                  value={form.branch_name}
                  onChange={(e) =>
                    setForm({ ...form, branch_name: e.target.value })
                  }
                  placeholder="e.g., Thoothukudi Main"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Branch Phone */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Branch Phone
                </label>
                <input
                  type="tel"
                  value={form.branch_phone}
                  onChange={(e) =>
                    setForm({ ...form, branch_phone: e.target.value })
                  }
                  placeholder="e.g., 9363311438"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Branch Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Branch Email
                </label>
                <input
                  type="email"
                  value={form.branch_email}
                  onChange={(e) =>
                    setForm({ ...form, branch_email: e.target.value })
                  }
                  placeholder="e.g., info@bank.com"
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* Branch Address */}
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Branch Address
                </label>
                <textarea
                  value={form.branch_address}
                  onChange={(e) =>
                    setForm({ ...form, branch_address: e.target.value })
                  }
                  placeholder="e.g., VOC Road, Thoothukudi – 628003"
                  rows={3}
                  className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              {/* GPS Coordinates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Latitude
                  </label>
                  <input
                    type="number"
                    value={form.latitude}
                    onChange={(e) =>
                      setForm({ ...form, latitude: e.target.value })
                    }
                    placeholder="e.g., 8.7642"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Longitude
                  </label>
                  <input
                    type="number"
                    value={form.longitude}
                    onChange={(e) =>
                      setForm({ ...form, longitude: e.target.value })
                    }
                    placeholder="e.g., 78.1348"
                    className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Is Active */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={form.is_active}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.checked })
                  }
                  className="w-4 h-4 rounded border-slate-300 accent-primary"
                />
                <label
                  htmlFor="is_active"
                  className="text-sm font-medium text-slate-700"
                >
                  ✅ Make this account active (visible in dropdowns)
                </label>
              </div>

              {/* Buttons */}
              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={loading || submitLocked}
                  className="flex-1 bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 transition-all"
                >
                  {loading ? "Saving..." : "✅ Save Bank Account"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setView("list");
                    setForm({
                      bank_name: "",
                      account_number: "",
                      ifsc_code: "",
                      branch_code: "",
                      branch_name: "",
                      branch_phone: "",
                      branch_email: "",
                      branch_address: "",
                      is_active: true,
                    });
                    setErrors({});
                  }}
                  className="px-6 py-2.5 border border-slate-300 rounded-lg font-semibold text-slate-700 hover:bg-slate-50 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Bank Account Saved"
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
          resetFormAfterSave();
        }}
      />
    </div>
  );
}
