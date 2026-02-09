import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { getISTDateString } from "../utils/time";
import { travelLogService, TravelContext } from "../utils/travelLogService";

const GPS_RADIUS_METERS = 100;

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

export default function ATMExcessCash() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const site = sites.find((s) => s.id === siteId);

  const [denoms, setDenoms] = useState({
    denom_100: 0,
    denom_200: 0,
    denom_500: 0,
    denom_2000: 0,
  });

  const [receipt, setReceipt] = useState<File | null>(null);
  const [gpsPhoto, setGpsPhoto] = useState<File | null>(null);
  const [remarks, setRemarks] = useState("");
  const [gpsStatus, setGpsStatus] = useState<
    "unknown" | "verified" | "mismatch" | "no_gps"
  >("unknown");
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [gpsLat, setGpsLat] = useState<number | null>(null);
  const [gpsLng, setGpsLng] = useState<number | null>(null);
  const [gpsDistance, setGpsDistance] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  /* ---------------- Load assignment & sites ---------------- */

  useEffect(() => {
    if (!profile) return;

    async function loadData() {
      const today = getISTDateString();

      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .single();

      if (!assignment) return;

      setAssignmentId(assignment.id);

      const { data } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address, latitude, longitude)")
        .eq("assignment_id", assignment.id);

      setSites((data || []).map((r: any) => r.site));
    }

    loadData();
  }, [profile]);

  /* ---------------- Save Excess Cash ---------------- */

  function resetForm() {
    setSiteId(null);
    setDenoms({
      denom_100: 0,
      denom_200: 0,
      denom_500: 0,
      denom_2000: 0,
    });
    setReceipt(null);
    setGpsPhoto(null);
    setRemarks("");
    setGpsStatus("unknown");
    setGpsMsg(null);
    setGpsLat(null);
    setGpsLng(null);
    setGpsDistance(null);
    setSubmitLocked(false);
  }

  async function acquireGPS() {
    setGpsMsg("Acquiring GPS signal… please wait");
    setGpsStatus("unknown");
    setGpsLat(null);
    setGpsLng(null);
    setGpsDistance(null);

    try {
      const g = await getGPS();
      setGpsLat(g.lat);
      setGpsLng(g.lng);

      if (!site?.latitude || !site?.longitude) {
        setGpsStatus("no_gps");
        setGpsMsg("ATM GPS not configured. Upload photo to continue.");
        return;
      }

      const d = distanceMeters(
        g.lat,
        g.lng,
        Number(site.latitude),
        Number(site.longitude)
      );

      setGpsDistance(d);

      if (d <= GPS_RADIUS_METERS) {
        setGpsStatus("verified");
        setGpsMsg(`GPS verified (${d.toFixed(1)} m)`);
      } else {
        setGpsStatus("mismatch");
        setGpsMsg(`GPS mismatch (${d.toFixed(1)} m). Move closer and retry.`);
      }
    } catch (err) {
      setGpsStatus("no_gps");
      setGpsMsg("Unable to fetch GPS. Ensure location is enabled.");
    }
  }

  async function handleSave() {
    if (saving || submitLocked) return;
    setError(null);
    setSaving(true);

    const totalNotes =
      denoms.denom_100 +
      denoms.denom_200 +
      denoms.denom_500 +
      denoms.denom_2000;

    if (!siteId) {
      setError("Please select ATM site.");
      setSaving(false);
      return;
    }

    if (totalNotes === 0) {
      setError("Enter at least one excess denomination.");
      setSaving(false);
      return;
    }

    const gpsOk = gpsStatus === "verified" || (gpsStatus !== "unknown" && !!gpsPhoto);
    if (!gpsOk) {
      setError("Verify GPS or upload a photo to continue.");
      setSaving(false);
      return;
    }

    if (!receipt) {
      setError("ATM receipt upload is mandatory.");
      setSaving(false);
      return;
    }

    const filePath = `atm-excess/${assignmentId}-${siteId}-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from("issue-photos")
      .upload(filePath, receipt, { upsert: true });

    if (uploadError) {
      setError("Receipt upload failed.");
      setSaving(false);
      return;
    }

    let gpsPhotoPath: string | null = null;
    if (gpsPhoto) {
      const gpsPath = `atm-excess-gps/${assignmentId}-${siteId}-${Date.now()}.jpg`;
      const { error: gpsUploadError } = await supabase.storage
        .from("issue-photos")
        .upload(gpsPath, gpsPhoto, { upsert: true });

      if (gpsUploadError) {
        setError("GPS photo upload failed.");
        setSaving(false);
        return;
      }
      gpsPhotoPath = gpsPath;
    }

    const { error } = await supabase.from("atm_excess_cash").insert({
      assignment_id: assignmentId,
      site_id: siteId,
      ...denoms,
      atm_receipt_url: filePath,
      remarks,
      gps_status: gpsStatus,
      gps_lat: gpsLat,
      gps_lng: gpsLng,
      gps_distance_meters: gpsDistance,
      gps_photo_url: gpsPhotoPath,
      gps_verified_at: gpsStatus === "verified" ? new Date().toISOString() : null,
    });

    if (error) {
      setError("Failed to save excess cash record.");
      setSaving(false);
      return;
    }

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
      console.warn("[ATMExcessCash] Travel log trigger failed:", err);
    }

    setSaving(false);
    setSubmitLocked(true);
    setConfirmMessage(
      `ATM excess cash recorded successfully for ${
        sites.find((s) => s.id === siteId)?.bank_name || "site"
      }.`
    );
    setShowConfirm(true);
  }

  /* ---------------- UI ---------------- */

  return (
    <AppLayout>
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">
            ATM Excess Cash Entry
          </h2>
          <p className="text-sm text-slate-600">
            Record excess cash left after ATM loading with receipt proof
          </p>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ATM Site <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={siteId ?? ""}
              onChange={(e) => setSiteId(Number(e.target.value))}
            >
              <option value="">-- Select ATM --</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.bank_name} – {s.address}
                </option>
              ))}
            </select>
          </div>

          <div className="border border-slate-200 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">GPS Verification</p>
                <p className="text-xs text-slate-500">
                  Verify you are at the ATM. If GPS fails, upload a photo.
                </p>
              </div>
              <button
                type="button"
                onClick={acquireGPS}
                disabled={!siteId}
                className="px-3 py-1.5 rounded-md text-xs font-semibold bg-slate-900 text-white disabled:opacity-50"
              >
                Verify GPS
              </button>
            </div>

            {gpsStatus !== "unknown" && (
              <div
                className={`text-xs px-3 py-2 rounded border ${
                  gpsStatus === "verified"
                    ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                    : "bg-amber-50 border-amber-200 text-amber-700"
                }`}
              >
                {gpsMsg || "GPS checked"}
              </div>
            )}

            {gpsStatus !== "verified" && gpsStatus !== "unknown" && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  Upload GPS Photo (Required)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setGpsPhoto(e.target.files?.[0] || null)}
                  className="w-full text-xs"
                />
                {gpsPhoto && (
                  <div className="mt-1 text-[11px] text-emerald-700">
                    Selected: {gpsPhoto.name}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              Excess Denominations
            </h3>
            <p className="text-xs text-slate-500">
              Enter the count of excess notes for each denomination.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(["100", "200", "500", "2000"] as const).map((d) => (
              <div key={d} className="form-group">
                <label className="text-sm font-medium text-slate-700">
                  ₹{d} Excess Notes
                </label>
                <input
                  type="number"
                  min={0}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={(denoms as any)[`denom_${d}`]}
                  onChange={(e) =>
                    setDenoms({
                      ...denoms,
                      [`denom_${d}`]: Number(e.target.value),
                    })
                  }
                  placeholder="0"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ATM Receipt <span className="text-red-500">*</span>
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
              <input
                type="file"
                accept="image/*"
                onChange={(e) => setReceipt(e.target.files?.[0] || null)}
                className="hidden"
                id="excess-receipt"
              />
              <label htmlFor="excess-receipt" className="cursor-pointer block">
                <div className="text-3xl mb-2">🧾</div>
                <p className="text-sm font-medium text-slate-700">
                  {receipt ? receipt.name : "Click to upload ATM receipt"}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  PNG, JPG up to 10MB
                </p>
              </label>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Remarks
            </label>
            <textarea
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any notes about the excess cash..."
            />
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSave}
            disabled={saving || submitLocked}
            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "Saving…" : "Save Excess Cash Record"}
          </button>
        </div>
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Excess Cash Saved"
        message={confirmMessage}
        confirmLabel="Done"
        onConfirm={() => {
          setShowConfirm(false);
          resetForm();
        }}
      />
    </AppLayout>
  );
}
