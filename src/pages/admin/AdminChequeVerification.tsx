import { useState, useEffect } from "react";
import { supabase } from "../../api/supabaseClient";
import { useAuth } from "../../context/AuthContext";
import ConfirmationModal from "../../components/ConfirmationModal";

interface ChequeRecord {
  id: bigint;
  pickup_id: bigint;
  assignment_id: number;
  bank_name: string;
  branch_name: string | null;
  pickup_date: string;
  cheque_number: string;
  cheque_image_url: string;
  cheque_status: string;
  cheque_verified: boolean;
  cheque_verified_by: string | null;
  cheque_verified_at: string | null;
  pickup_amount: number;
  variance: number;
  created_at: string;
}

interface CustodianProfile {
  id: string;
  full_name: string;
}

export default function AdminChequeVerification() {
  const { profile } = useAuth();
  const [cheques, setCheques] = useState<ChequeRecord[]>([]);
  const [filteredCheques, setFilteredCheques] = useState<ChequeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmAction, setConfirmAction] = useState<{
    pickupId: bigint;
    action: "verify" | "reject" | "clear";
  } | null>(null);

  // Filtering
  const [filterStatus, setFilterStatus] = useState<string>("PENDING");
  const [filterBank, setFilterBank] = useState<string>("");
  const [searchCheque, setSearchCheque] = useState<string>("");

  // Unique banks for filter
  const [banks, setBanks] = useState<string[]>([]);

  // Load cheques pending verification
  useEffect(() => {
    loadCheques();
  }, []);

  async function loadCheques() {
    setLoading(true);
    setMessage(null);

    try {
      const { data, error } = await supabase
        .from("v_cheque_verifications")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error loading cheques:", error);
        setMessage({ type: "error", text: "Failed to load cheques" });
        setCheques([]);
      } else {
        setCheques((data as ChequeRecord[]) || []);

        // Extract unique banks
        const uniqueBanks = [
          ...new Set((data as ChequeRecord[])?.map((c) => c.bank_name).filter(Boolean)),
        ];
        setBanks(uniqueBanks as string[]);
      }
    } catch (err) {
      console.error("Error:", err);
      setMessage({ type: "error", text: "Error loading cheques" });
      setCheques([]);
    } finally {
      setLoading(false);
    }
  }

  // Filter cheques based on status, bank, and search
  useEffect(() => {
    let filtered = cheques;

    if (filterStatus) {
      filtered = filtered.filter((c) => c.cheque_status === filterStatus);
    }

    if (filterBank) {
      filtered = filtered.filter((c) => c.bank_name === filterBank);
    }

    if (searchCheque) {
      filtered = filtered.filter(
        (c) =>
          c.cheque_number?.includes(searchCheque.toUpperCase()) ||
          c.bank_name?.toLowerCase().includes(searchCheque.toLowerCase())
      );
    }

    setFilteredCheques(filtered);
  }, [cheques, filterStatus, filterBank, searchCheque]);

  // Verify cheque
  async function handleVerifyCheque(pickupId: bigint) {
    setConfirmMessage("Verify this cheque and mark as valid?");
    setConfirmAction({ pickupId, action: "verify" });
    setShowConfirm(true);
  }

  // Reject cheque
  async function handleRejectCheque(pickupId: bigint) {
    setConfirmMessage(
      "Reject this cheque? Mark as REJECTED for investigation/correction."
    );
    setConfirmAction({ pickupId, action: "reject" });
    setShowConfirm(true);
  }

  // Mark cleared
  async function handleMarkCleared(pickupId: bigint) {
    setConfirmMessage("Mark this cheque as CLEARED by bank?");
    setConfirmAction({ pickupId, action: "clear" });
    setShowConfirm(true);
  }

  // Process confirmation
  async function processConfirmation() {
    if (!confirmAction || !profile?.id) {
      setShowConfirm(false);
      return;
    }

    setProcessing(true);
    setMessage(null);

    try {
      const { pickupId, action } = confirmAction;

      let newStatus = "PENDING";
      if (action === "verify") newStatus = "VERIFIED";
      else if (action === "reject") newStatus = "REJECTED";
      else if (action === "clear") newStatus = "CLEARED";

      const { error } = await supabase
        .from("cash_pickups")
        .update({
          cheque_status: newStatus,
          cheque_verified: action === "verify" || action === "clear",
          cheque_verified_by: profile.id,
          cheque_verified_at: new Date().toISOString(),
        })
        .eq("id", pickupId);

      if (error) {
        console.error("Error updating cheque:", error);
        setMessage({
          type: "error",
          text: `Failed to ${action} cheque: ${error.message}`,
        });
      } else {
        setMessage({
          type: "success",
          text: `Cheque ${newStatus.toLowerCase()} successfully`,
        });
        // Reload cheques
        await loadCheques();
      }
    } catch (err) {
      console.error("Error:", err);
      setMessage({ type: "error", text: "Error processing cheque" });
    } finally {
      setProcessing(false);
      setShowConfirm(false);
      setConfirmAction(null);
    }
  }

  const statusColor = (status: string) => {
    switch (status) {
      case "PENDING":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "VERIFIED":
        return "bg-green-50 border-green-200 text-green-900";
      case "REJECTED":
        return "bg-red-50 border-red-200 text-red-900";
      case "CLEARED":
        return "bg-emerald-50 border-emerald-200 text-emerald-900";
      default:
        return "bg-slate-50 border-slate-200 text-slate-900";
    }
  };

  const statusBadge = (status: string) => {
    const baseClass = "inline-block px-2 py-1 rounded-full text-xs font-semibold";
    switch (status) {
      case "PENDING":
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      case "VERIFIED":
        return `${baseClass} bg-green-100 text-green-800`;
      case "REJECTED":
        return `${baseClass} bg-red-100 text-red-800`;
      case "CLEARED":
        return `${baseClass} bg-emerald-100 text-emerald-800`;
      default:
        return `${baseClass} bg-slate-100 text-slate-800`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-6">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">
            🏦 Banking-Grade Cheque Verification
          </h1>
          <p className="text-slate-600 mt-2">
            Review, verify, and audit bank cash pickup cheques for fraud traceability
          </p>
        </div>

        {/* Messages */}
        {message && (
          <div
            className={`mb-4 px-4 py-3 rounded-lg border ${
              message.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white rounded-lg border border-slate-200 p-4 mb-6 shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending Verification</option>
                <option value="VERIFIED">Verified</option>
                <option value="REJECTED">Rejected</option>
                <option value="CLEARED">Cleared by Bank</option>
              </select>
            </div>

            {/* Bank Filter */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Bank
              </label>
              <select
                value={filterBank}
                onChange={(e) => setFilterBank(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Banks</option>
                {banks.map((bank) => (
                  <option key={bank} value={bank}>
                    {bank}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Cheque */}
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Search Cheque #
              </label>
              <input
                type="text"
                placeholder="e.g., 892734"
                value={searchCheque}
                onChange={(e) => setSearchCheque(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Reset Filters */}
            <div className="flex items-end">
              <button
                onClick={() => {
                  setFilterStatus("PENDING");
                  setFilterBank("");
                  setSearchCheque("");
                }}
                className="w-full px-4 py-2 bg-slate-200 text-slate-800 rounded-lg text-sm font-semibold hover:bg-slate-300 transition-colors"
              >
                Reset Filters
              </button>
            </div>
          </div>
        </div>

        {/* Results Count */}
        <div className="mb-4 text-slate-600 text-sm">
          Showing {filteredCheques.length} of {cheques.length} cheques
        </div>

        {/* Cheques List */}
        {loading ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600">Loading cheques...</p>
          </div>
        ) : filteredCheques.length === 0 ? (
          <div className="bg-white rounded-lg border border-slate-200 p-8 text-center">
            <p className="text-slate-600">No cheques found matching your filters</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredCheques.map((cheque) => (
              <div
                key={cheque.pickup_id}
                className={`border rounded-lg p-5 space-y-3 ${statusColor(
                  cheque.cheque_status
                )}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold">
                      Cheque #{cheque.cheque_number}
                    </h3>
                    <p className="text-xs opacity-75">
                      {cheque.bank_name} {cheque.branch_name && `(${cheque.branch_name})`}
                    </p>
                  </div>
                  <span className={statusBadge(cheque.cheque_status)}>
                    {cheque.cheque_status}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white bg-opacity-50 p-3 rounded">
                  <div>
                    <p className="text-xs opacity-75">Pickup Amount</p>
                    <p className="text-sm font-semibold">
                      ₹{cheque.pickup_amount.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs opacity-75">Variance</p>
                    <p className={`text-sm font-semibold ${
                      cheque.variance === 0 ? "text-green-700" : "text-red-700"
                    }`}>
                      ₹{cheque.variance.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs opacity-75">Pickup Date</p>
                    <p className="text-sm font-semibold">{cheque.pickup_date}</p>
                  </div>
                  <div>
                    <p className="text-xs opacity-75">Captured</p>
                    <p className="text-xs">
                      {new Date(cheque.created_at).toLocaleDateString("en-IN")}
                    </p>
                  </div>
                </div>

                {/* Cheque Image */}
                {cheque.cheque_image_url && (
                  <div className="bg-white bg-opacity-50 p-3 rounded">
                    <p className="text-xs font-semibold mb-2 opacity-75">Cheque Image</p>
                    <a
                      href={`${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/issue-photos/${cheque.cheque_image_url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block text-xs text-blue-600 hover:underline font-semibold"
                    >
                      📸 View Image
                    </a>
                  </div>
                )}

                {/* Verification Info */}
                {cheque.cheque_verified_at && (
                  <div className="bg-white bg-opacity-50 p-3 rounded text-xs">
                    <p className="opacity-75">
                      Verified on{" "}
                      {new Date(cheque.cheque_verified_at).toLocaleDateString(
                        "en-IN"
                      )}
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex flex-wrap gap-2">
                  {cheque.cheque_status === "PENDING" && (
                    <>
                      <button
                        onClick={() => handleVerifyCheque(cheque.pickup_id)}
                        disabled={processing}
                        className="px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓ Verify Cheque
                      </button>
                      <button
                        onClick={() => handleRejectCheque(cheque.pickup_id)}
                        disabled={processing}
                        className="px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50"
                      >
                        ✗ Reject Cheque
                      </button>
                    </>
                  )}
                  {cheque.cheque_status === "VERIFIED" && (
                    <button
                      onClick={() => handleMarkCleared(cheque.pickup_id)}
                      disabled={processing}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50"
                    >
                      💳 Mark Cleared by Bank
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showConfirm}
        title="Confirm Cheque Action"
        message={confirmMessage}
        onConfirm={processConfirmation}
        onCancel={() => setShowConfirm(false)}
        isLoading={processing}
        confirmText="Confirm"
        cancelText="Cancel"
      />
    </div>
  );
}
