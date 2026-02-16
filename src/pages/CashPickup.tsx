import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { useAuth } from "../context/AuthContext";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { getISTDateString } from "../utils/time";
import { travelLogService, TravelContext } from "../utils/travelLogService";

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
}

interface ATMSite {
  id: number;
  bank_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  atm_id?: string | null;
}

type GPSState = {
  status: "unknown" | "verified" | "mismatch" | "no_gps";
  message: string | null;
  lat: number | null;
  lng: number | null;
  distance: number | null;
  timestamp: string | null;
};

const GPS_RADIUS_METERS = 100;

const EMPTY_GPS: GPSState = {
  status: "unknown",
  message: null,
  lat: null,
  lng: null,
  distance: null,
  timestamp: null,
};

function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

async function getGPS() {
  return new Promise<{ lat: number; lng: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      reject,
      { enableHighAccuracy: true, timeout: 20000 }
    );
  });
}

export default function CashPickup() {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<'bank' | 'atm'>('bank');
  // Bank Pickup State
  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [expectedAmount, setExpectedAmount] = useState<number>(0);
  const [form, setForm] = useState({
    denom_2000: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
  });
  const [bankGps, setBankGps] = useState<GPSState>(EMPTY_GPS);
  const [bankPhoto, setBankPhoto] = useState<File | null>(null);
  const [bankSubmitLocked, setBankSubmitLocked] = useState(false);
  const [plannedDenoms, setPlannedDenoms] = useState<
    | {
        denom_100: number;
        denom_200: number;
        denom_500: number;
        denom_2000: number;
      }
    | null
  >(null);
  const [plannedLoading, setPlannedLoading] = useState(false);
  const [plannedError, setPlannedError] = useState<string | null>(null);
  const [banksLoading, setBanksLoading] = useState(false);
  const [banksError, setBanksError] = useState<string | null>(null);
  // ATM Pickup State
  const [atmSites, setAtmSites] = useState<ATMSite[]>([]);
  const [selectedAtmSiteId, setSelectedAtmSiteId] = useState<number | null>(null);
  const [atmDenoms, setAtmDenoms] = useState({
    denom_2000: 0,
    denom_500: 0,
    denom_200: 0,
    denom_100: 0,
  });
  const [atmGps, setAtmGps] = useState<GPSState>(EMPTY_GPS);
  const [atmPhoto, setAtmPhoto] = useState<File | null>(null);
  const [atmSubmitLocked, setAtmSubmitLocked] = useState(false);
  // Shared
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"bank" | "atm" | null>(null);
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

  useEffect(() => {
    if (!assignmentId) {
      setAtmSites([]);
      return;
    }

    async function loadAtmSites() {
      const { data } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address, latitude, longitude, atm_id)")
        .eq("assignment_id", assignmentId);

      setAtmSites((data || []).map((r: any) => r.site));
    }

    loadAtmSites();
  }, [assignmentId]);

  // --------------------------------------------------
  // Load bank accounts
  // --------------------------------------------------
  useEffect(() => {
    loadBankAccounts();
  }, []);

  async function loadBankAccounts() {
    setBanksLoading(true);
    setBanksError(null);

    try {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .eq("is_active", true)
        .order("bank_name", { ascending: true });

      if (error) {
        console.error("Error loading banks:", error);
        setBanksError("Could not load bank list. Please refresh.");
        setBankAccounts([]);
      } else {
        setBankAccounts(data || []);
      }
    } catch (err) {
      console.error("Error:", err);
      setBanksError("Error loading bank accounts");
      setBankAccounts([]);
    } finally {
      setBanksLoading(false);
    }
  }

  // Get selected bank details
  const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

  // --------------------------------------------------
  // Load planned bank denominations (for comparison)
  // --------------------------------------------------
  useEffect(() => {
    if (!assignmentId || !selectedBankId) {
      setPlannedDenoms(null);
      setPlannedError(null);
      return;
    }

    async function loadPlannedDenoms() {
      setPlannedLoading(true);
      setPlannedError(null);

      const { data, error } = await supabase
        .from("bank_denomination_plans")
        .select("denom_2000, denom_500, denom_200, denom_100")
        .eq("assignment_id", assignmentId)
        .eq("bank_account_id", selectedBankId)
        .maybeSingle();

      if (error) {
        console.warn("[CashPickup] Failed to load bank plan:", error);
        setPlannedError("Failed to load planned denominations");
        setPlannedDenoms(null);
        setPlannedLoading(false);
        return;
      }

      if (data) {
        setPlannedDenoms({
          denom_100: data.denom_100 || 0,
          denom_200: data.denom_200 || 0,
          denom_500: data.denom_500 || 0,
          denom_2000: data.denom_2000 || 0,
        });
      } else {
        setPlannedDenoms(null);
      }

      setPlannedLoading(false);
    }

    loadPlannedDenoms();
  }, [assignmentId, selectedBankId]);

  // --------------------------------------------------
  // Calculate totals
  // --------------------------------------------------
  const bankAmount =
    form.denom_2000 * 2000 +
    form.denom_500 * 500 +
    form.denom_200 * 200 +
    form.denom_100 * 100;

  const atmAmount =
    atmDenoms.denom_2000 * 2000 +
    atmDenoms.denom_500 * 500 +
    atmDenoms.denom_200 * 200 +
    atmDenoms.denom_100 * 100;

  const variance = bankAmount - expectedAmount;

  const plannedTotal = plannedDenoms
    ? plannedDenoms.denom_2000 * 2000 +
      plannedDenoms.denom_500 * 500 +
      plannedDenoms.denom_200 * 200 +
      plannedDenoms.denom_100 * 100
    : 0;

  // --------------------------------------------------
  // Save (UPSERT – one pickup per bank per day)
  // --------------------------------------------------
  function resetBankForm() {
    setSelectedBankId("");
    setExpectedAmount(0);
    setForm({
      denom_2000: 0,
      denom_500: 0,
      denom_200: 0,
      denom_100: 0,
    });
    setBankGps(EMPTY_GPS);
    setBankPhoto(null);
    setBankSubmitLocked(false);
  }
  function resetAtmForm() {
    setAtmDenoms({
      denom_2000: 0,
      denom_500: 0,
      denom_200: 0,
      denom_100: 0,
    });
    setSelectedAtmSiteId(null);
    setAtmGps(EMPTY_GPS);
    setAtmSubmitLocked(false);
  }

  function buildGpsMetadata(gps: GPSState, target: string) {
    return {
      target,
      status: gps.status,
      gps_lat: gps.lat,
      gps_lng: gps.lng,
      distance_meters: gps.distance,
      verified_at: gps.timestamp,
    };
  }

  async function verifyBankGps() {
    if (!selectedBank) return;

    try {
      const g = await getGPS();

      if (selectedBank.latitude == null || selectedBank.longitude == null) {
        setBankGps({
          status: "no_gps",
          message: "Bank GPS not configured. Upload photo to continue.",
          lat: g.lat,
          lng: g.lng,
          distance: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const d = distanceMeters(
        g.lat,
        g.lng,
        Number(selectedBank.latitude),
        Number(selectedBank.longitude)
      );

      if (d <= GPS_RADIUS_METERS) {
        setBankGps({
          status: "verified",
          message: `GPS verified (${d.toFixed(1)} m)`,
          lat: g.lat,
          lng: g.lng,
          distance: d,
          timestamp: new Date().toISOString(),
        });
      } else {
        setBankGps({
          status: "mismatch",
          message: `GPS mismatch (${d.toFixed(1)} m). Move closer and retry.`,
          lat: g.lat,
          lng: g.lng,
          distance: d,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      setBankGps({
        status: "no_gps",
        message: "Unable to fetch GPS. Ensure location is enabled.",
        lat: null,
        lng: null,
        distance: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async function verifyAtmGps() {
    const site = atmSites.find((s) => s.id === selectedAtmSiteId);
    if (!site) return;

    try {
      const g = await getGPS();

      if (site.latitude == null || site.longitude == null) {
        setAtmGps({
          status: "no_gps",
          message: "ATM GPS not configured. Upload photo to continue.",
          lat: g.lat,
          lng: g.lng,
          distance: null,
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const d = distanceMeters(
        g.lat,
        g.lng,
        Number(site.latitude),
        Number(site.longitude)
      );

      if (d <= GPS_RADIUS_METERS) {
        setAtmGps({
          status: "verified",
          message: `GPS verified (${d.toFixed(1)} m)`,
          lat: g.lat,
          lng: g.lng,
          distance: d,
          timestamp: new Date().toISOString(),
        });
      } else {
        setAtmGps({
          status: "mismatch",
          message: `GPS mismatch (${d.toFixed(1)} m). Move closer and retry.`,
          lat: g.lat,
          lng: g.lng,
          distance: d,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      setAtmGps({
        status: "no_gps",
        message: "Unable to fetch GPS. Ensure location is enabled.",
        lat: null,
        lng: null,
        distance: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async function uploadGpsPhoto(file: File, prefix: string) {
    const path = `cash-pickup/${prefix}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("issue-photos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      throw new Error("Photo upload failed");
    }

    return path;
  }

  async function saveBankPickup() {
    if (loading || bankSubmitLocked) return;
    if (!assignmentId || !selectedBankId) {
      setMessage("Assignment or Bank selection missing");
      return;
    }

    const totalNotes =
      form.denom_2000 +
      form.denom_500 +
      form.denom_200 +
      form.denom_100;

    if (totalNotes === 0) {
      setMessage("Enter at least one denomination for bank pickup");
      return;
    }

    const gpsOk = bankGps.status === "verified" || (bankGps.status !== "unknown" && !!bankPhoto);
    if (!gpsOk) {
      setMessage("Verify bank GPS or upload photo to continue");
      return;
    }

    setLoading(true);
    setMessage(null);

    let bankPhotoPath: string | null = null;
    if (bankPhoto) {
      try {
        bankPhotoPath = await uploadGpsPhoto(bankPhoto, `bank-${assignmentId}-${selectedBankId}`);
      } catch (err) {
        setMessage("Failed to upload bank photo");
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("cash_pickups")
      .upsert(
        {
          assignment_id: assignmentId,
          bank_name: selectedBank?.bank_name || "",
          branch: selectedBank?.branch_name || selectedBank?.branch_code || "",
          pickup_time: new Date().toISOString(),
          expected_amount: expectedAmount,
          total_amount: bankAmount,
          variance,
          pickup_source: "BANK",
          gps_metadata: buildGpsMetadata(bankGps, "BANK"),
          gps_photo_url: bankPhotoPath,
          ...form,
        },
        {
          onConflict: "assignment_id,bank_name",
        }
      );

    if (error) {
      console.error(error);
      setMessage("Failed to save bank pickup");
    } else {
      try {
        if (assignmentId && profile?.id) {
          await travelLogService.triggerCheckpoint({
            assignmentId,
            custodianId: profile.id,
            vehicleType: "bike",
            context: TravelContext.MANUAL,
          });
        }
      } catch (err) {
        console.warn("[CashPickup] Travel log trigger failed:", err);
      }
      setBankSubmitLocked(true);
      setConfirmMessage(
        `Bank pickup saved successfully for ${selectedBank?.bank_name || "bank"}.`
      );
      setConfirmType("bank");
      setShowConfirm(true);
    }

    setLoading(false);
  }

  async function saveAtmPickup() {
    if (loading || atmSubmitLocked) return;
    if (!assignmentId || !selectedAtmSiteId) {
      setMessage("Assignment or ATM selection missing");
      return;
    }

    const totalNotes =
      atmDenoms.denom_2000 +
      atmDenoms.denom_500 +
      atmDenoms.denom_200 +
      atmDenoms.denom_100;

    if (totalNotes === 0) {
      setMessage("Enter at least one denomination for ATM pickup");
      return;
    }

    const gpsOk = atmGps.status === "verified" || (atmGps.status !== "unknown" && !!atmPhoto);
    if (!gpsOk) {
      setMessage("Verify ATM GPS or upload photo to continue");
      return;
    }

    setLoading(true);
    setMessage(null);

    let atmPhotoPath: string | null = null;
    if (atmPhoto) {
      try {
        atmPhotoPath = await uploadGpsPhoto(atmPhoto, `atm-${assignmentId}-${selectedAtmSiteId}`);
      } catch (err) {
        setMessage("Failed to upload ATM photo");
        setLoading(false);
        return;
      }
    }

    const { error } = await supabase
      .from("cash_pickups")
      .insert({
        assignment_id: assignmentId,
        pickup_source: "ATM_INTERNAL",
        source_site_id: selectedAtmSiteId,
        pickup_time: new Date().toISOString(),
        total_amount: atmAmount,
        variance: null,
        gps_metadata: buildGpsMetadata(atmGps, "ATM_INTERNAL"),
        gps_photo_url: atmPhotoPath,
        denom_2000: atmDenoms.denom_2000,
        denom_500: atmDenoms.denom_500,
        denom_200: atmDenoms.denom_200,
        denom_100: atmDenoms.denom_100,
        denom_50: 0,
        denom_20: 0,
        denom_10: 0,
      });

    if (error) {
      console.error(error);
      setMessage("Failed to save ATM pickup");
    } else {
      try {
        if (assignmentId && profile?.id) {
          await travelLogService.triggerCheckpoint({
            assignmentId,
            custodianId: profile.id,
            vehicleType: "bike",
            context: TravelContext.MANUAL,
          });
        }
      } catch (err) {
        console.warn("[CashPickup] Travel log trigger failed:", err);
      }
      setAtmSubmitLocked(true);
      setConfirmMessage("ATM pickup saved successfully.");
      setConfirmType("atm");
      setShowConfirm(true);
    }

    setLoading(false);
  }

  // --------------------------------------------------
  // UI
  // --------------------------------------------------
  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5 pb-6">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            Cash Pickup
          </h2>
          <p className="text-sm text-slate-600">
            Record bank and internal ATM cash pickups independently
          </p>
        </div>

        {!assignmentId && (
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <span className="font-semibold">ℹ️ No assignment available</span> for today.
          </div>
        )}

        {assignmentId && (
          <>
            {/* Tab Navigation */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
              <div className="grid grid-cols-2">
                <button
                  onClick={() => setActiveTab('bank')}
                  className={`px-6 py-4 text-sm font-semibold transition-all ${
                    activeTab === 'bank'
                      ? 'bg-blue-600 text-white border-b-4 border-blue-700'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-b-2 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">🏦</span>
                    <span>Bank Pickup</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('atm')}
                  className={`px-6 py-4 text-sm font-semibold transition-all ${
                    activeTab === 'atm'
                      ? 'bg-indigo-600 text-white border-b-4 border-indigo-700'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border-b-2 border-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="text-xl">🏧</span>
                    <span>Internal ATM</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Bank Pickup Tab */}
            {activeTab === 'bank' && (
              <div className="space-y-5">
                <div className="bg-gradient-to-br from-blue-50 to-white rounded-lg border-2 border-blue-200 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">🏦</div>
                    <div>
                      <h3 className="text-lg font-bold text-blue-900">Bank Cash Pickup</h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Record cash collected from bank account below
                      </p>
                    </div>
                  </div>

                  {banksError && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                      <span className="font-semibold">⚠️ {banksError}</span>
                    </div>
                  )}

                  {/* Bank Selection */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Bank Account <span className="text-red-500">*</span>
                    </label>
                    {banksLoading ? (
                      <div className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm text-slate-500">
                        Loading banks...
                      </div>
                    ) : bankAccounts.length === 0 ? (
                      <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
                        <p className="font-semibold mb-2">ℹ️ No bank accounts available</p>
                        <p className="text-xs">Contact admin to onboard bank accounts</p>
                      </div>
                    ) : (
                      <select
                        value={selectedBankId}
                        onChange={(e) => setSelectedBankId(e.target.value)}
                        className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">-- Select a bank account --</option>
                        {bankAccounts.map((bank) => (
                          <option key={bank.id} value={bank.id}>
                            {bank.bank_name} ({bank.account_number})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Auto-filled Bank Details */}
                  {selectedBank && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                      <h3 className="text-sm font-semibold text-slate-800">
                        Account Details
                      </h3>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-xs font-semibold text-slate-600">
                            Account Number
                          </span>
                          <div className="font-mono text-slate-800">
                            {selectedBank.account_number}
                          </div>
                        </div>

                        <div>
                          <span className="text-xs font-semibold text-slate-600">
                            IFSC Code
                          </span>
                          <div className="font-mono text-slate-800">
                            {selectedBank.ifsc_code}
                          </div>
                        </div>

                        {selectedBank.branch_name && (
                          <div>
                            <span className="text-xs font-semibold text-slate-600">
                              Branch
                            </span>
                            <div className="text-slate-800">
                              {selectedBank.branch_name}
                            </div>
                          </div>
                        )}

                        {selectedBank.branch_phone && (
                          <div>
                            <span className="text-xs font-semibold text-slate-600">
                              Branch Phone
                            </span>
                            <div className="text-slate-800">
                              {selectedBank.branch_phone}
                            </div>
                          </div>
                        )}
                      </div>

                      {selectedBank.branch_address && (
                        <div>
                          <span className="text-xs font-semibold text-slate-600">
                            Address
                          </span>
                          <div className="text-sm text-slate-800 mt-1">
                            {selectedBank.branch_address}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Expected Amount <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={expectedAmount}
                      onChange={(e) =>
                        setExpectedAmount(Number(e.target.value))
                      }
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Bank Denomination Details */}
                <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      Enter Actual Denominations
                    </h3>
                    <p className="text-xs text-slate-600">
                      Count and enter the cash denominations received
                    </p>
                  </div>

                  {plannedLoading ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-600">
                      Loading planned denominations...
                    </div>
                  ) : plannedError ? (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-xs text-amber-800">
                      ⚠️ {plannedError}
                    </div>
                  ) : plannedDenoms ? (
                    <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">
                            Planned Denominations (Bank)
                          </p>
                          <p className="text-xs text-slate-600 mt-1">
                            Compare plan vs actual pickup while entering values.
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-indigo-900 bg-indigo-100 px-2 py-1 rounded">
                          ₹{plannedTotal.toLocaleString("en-IN")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {[
                          ["denom_100", 100],
                          ["denom_200", 200],
                          ["denom_500", 500],
                          ["denom_2000", 2000],
                        ].map(([key, value]) => (
                          <div
                            key={key}
                            className="rounded-md border border-indigo-200 bg-white px-3 py-2"
                          >
                            <div className="text-xs text-slate-500">₹{value}</div>
                            <div className="text-sm font-semibold text-indigo-900">
                              {(plannedDenoms as any)[key] || 0}
                            </div>
                            <div className="text-xs text-slate-500">
                              ₹{(((plannedDenoms as any)[key] || 0) * Number(value)).toLocaleString(
                                "en-IN"
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      ["denom_100", 100],
                      ["denom_200", 200],
                      ["denom_500", 500],
                      ["denom_2000", 2000],
                    ].map(([key, label]) => (
                      <div key={key} className="form-group">
                        <label className="text-sm font-medium text-slate-700">
                          ₹{label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      <span className="text-xs text-slate-600">
                        Bank Amount
                      </span>
                      <div className="text-xl font-bold text-blue-600">
                        ₹{bankAmount.toLocaleString("en-IN")}
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
                        ₹{variance.toLocaleString("en-IN")}
                      </div>
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">Bank GPS Verification</p>
                        <p className="text-xs text-slate-500">
                          Verify you are at the bank. If GPS fails, upload a photo.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={verifyBankGps}
                        disabled={!selectedBankId}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white disabled:opacity-50 hover:bg-slate-800"
                      >
                        Verify GPS
                      </button>
                    </div>

                    {bankGps.status !== "unknown" && (
                      <div
                        className={`text-xs px-3 py-2 rounded border ${
                          bankGps.status === "verified"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        {bankGps.message || "GPS checked"}
                      </div>
                    )}

                    {bankGps.status !== "verified" && bankGps.status !== "unknown" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Upload GPS Photo (Required)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setBankPhoto(e.target.files?.[0] || null)}
                          className="w-full text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* Bank Save Button */}
                  <button
                    onClick={saveBankPickup}
                    disabled={loading || bankSubmitLocked || !selectedBankId}
                    className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold text-base hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                  >
                    {loading ? "Saving Bank Pickup..." : bankSubmitLocked ? "✓ Bank Pickup Saved" : "💾 Save Bank Pickup"}
                  </button>
                </div>
              </div>
            )}

            {/* ATM Pickup Tab */}
            {activeTab === 'atm' && (
              <div className="space-y-5">
                <div className="bg-gradient-to-br from-indigo-50 to-white rounded-lg border-2 border-indigo-200 p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">🏧</div>
                    <div>
                      <h3 className="text-lg font-bold text-indigo-900">Internal ATM Cash Pickup</h3>
                      <p className="text-xs text-slate-600 mt-1">
                        Select the ATM site and record cash removed from that ATM
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      ATM Site <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={selectedAtmSiteId ?? ""}
                      onChange={(e) => setSelectedAtmSiteId(Number(e.target.value) || null)}
                      className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select ATM site --</option>
                      {atmSites.map((site) => (
                        <option key={site.id} value={site.id}>
                          {site.bank_name} - {site.address}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ATM Denomination Details */}
                <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800 mb-1">
                      Enter ATM Denominations
                    </h3>
                    <p className="text-xs text-slate-600">
                      Count and enter the cash removed from the ATM
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {([
                      ["denom_100", 100],
                      ["denom_200", 200],
                      ["denom_500", 500],
                      ["denom_2000", 2000],
                    ] as const).map(([key, label]) => (
                      <div key={key} className="form-group">
                        <label className="text-sm font-medium text-slate-700">
                          ₹{label}
                        </label>
                        <input
                          type="number"
                          min={0}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          value={(atmDenoms as any)[key]}
                          onChange={(e) =>
                            setAtmDenoms({
                              ...atmDenoms,
                              [key]: Number(e.target.value),
                            })
                          }
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <span className="text-xs text-slate-600">ATM Pickup Amount</span>
                    <div className="text-xl font-bold text-indigo-900">
                      ₹{atmAmount.toLocaleString("en-IN")}
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">ATM GPS Verification</p>
                        <p className="text-xs text-slate-500">
                          Verify you are at the ATM site. If GPS fails, upload a photo.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={verifyAtmGps}
                        disabled={!selectedAtmSiteId}
                        className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white disabled:opacity-50 hover:bg-slate-800"
                      >
                        Verify GPS
                      </button>
                    </div>

                    {atmGps.status !== "unknown" && (
                      <div
                        className={`text-xs px-3 py-2 rounded border ${
                          atmGps.status === "verified"
                            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                            : "bg-amber-50 border-amber-200 text-amber-700"
                        }`}
                      >
                        {atmGps.message || "GPS checked"}
                      </div>
                    )}

                    {atmGps.status !== "verified" && atmGps.status !== "unknown" && (
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-2">
                          Upload GPS Photo (Required)
                        </label>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => setAtmPhoto(e.target.files?.[0] || null)}
                          className="w-full text-xs"
                        />
                      </div>
                    )}
                  </div>

                  {/* ATM Save Button */}
                  <button
                    onClick={saveAtmPickup}
                    disabled={loading || atmSubmitLocked || !selectedAtmSiteId}
                    className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold text-base hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md"
                  >
                    {loading ? "Saving ATM Pickup..." : atmSubmitLocked ? "✓ ATM Pickup Saved" : "💾 Save ATM Pickup"}
                  </button>
                </div>
              </div>
            )}

            {message && (
              <div className={`text-sm text-center p-4 rounded-lg font-medium ${
                message.includes("success")
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-red-50 text-red-800 border border-red-200"
              }`}>
                {message}
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Cash Pickup Saved"
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
          if (confirmType === "bank") {
            resetBankForm();
          }
          if (confirmType === "atm") {
            resetAtmForm();
          }
          setConfirmType(null);
        }}
      />
    </AppLayout>
  );
}
