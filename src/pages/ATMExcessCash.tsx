import { useEffect, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { getISTDateString, getISTMonthStart } from "../utils/time";
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

  const [activeTab, setActiveTab] = useState<"entry" | "report">("entry");
  const [excessDate, setExcessDate] = useState(getISTDateString());

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
  const [dateNotice, setDateNotice] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  const [reportFromDate, setReportFromDate] = useState(getISTMonthStart());
  const [reportToDate, setReportToDate] = useState(getISTDateString());
  const [reportSiteId, setReportSiteId] = useState<number | "ALL">("ALL");
  const [reportSites, setReportSites] = useState<any[]>([]);
  const [reportRows, setReportRows] = useState<any[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [receiptPreviewUrl, setReceiptPreviewUrl] = useState<string | null>(null);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);
  const [reconDrafts, setReconDrafts] = useState<Record<number, string>>({});
  const [reconSaving, setReconSaving] = useState<Record<number, boolean>>({});

  /* ---------------- Load assignment & sites ---------------- */

  useEffect(() => {
    if (!profile) return;

    async function loadData(selectedDate: string) {
      setDateNotice(null);
      setAssignmentId(null);
      setSites([]);
      setSiteId(null);

      const { data: assignment } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", selectedDate)
        .single();

      if (!assignment) {
        setDateNotice("No assignment found for the selected date.");
        return;
      }

      setAssignmentId(assignment.id);

      const { data } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address, latitude, longitude)")
        .eq("assignment_id", assignment.id);

      setSites((data || []).map((r: any) => r.site));
    }

    loadData(excessDate);
  }, [profile, excessDate]);

  useEffect(() => {
    async function loadReportSites() {
      const { data } = await supabase
        .from("sites")
        .select("id, bank_name, address")
        .order("bank_name", { ascending: true });
      setReportSites(data || []);
    }

    loadReportSites();
  }, []);

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

  function handleExcessDateChange(value: string) {
    setError(null);
    setDateNotice(null);
    const today = getISTDateString();
    if (value > today) {
      setError("Excess date cannot be in the future.");
      return;
    }
    setExcessDate(value);
  }

  function getPublicReceiptUrl(path?: string | null) {
    if (!path) return null;
    const { data } = supabase.storage.from("issue-photos").getPublicUrl(path);
    return data.publicUrl;
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

    if (!assignmentId) {
      setError("No assignment found for the selected date.");
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
      excess_date: excessDate,
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

  async function loadReport() {
    setReportLoading(true);
    setReportError(null);

    if (reportFromDate > reportToDate) {
      setReportError("From Date cannot be after To Date.");
      setReportLoading(false);
      return;
    }

    let query = supabase
      .from("atm_excess_cash")
      .select(
        "id, site_id, assignment_id, excess_date, remarks, atm_receipt_url, gps_status, gps_distance_meters, recon_communication_date, created_at, site:site_id(bank_name, address), assignment:assignment_id(assignment_date)"
      )
      .gte("excess_date", reportFromDate)
      .lte("excess_date", reportToDate)
      .order("excess_date", { ascending: false });

    if (reportSiteId !== "ALL") {
      query = query.eq("site_id", reportSiteId);
    }

    const { data, error } = await query;

    if (error) {
      setReportError("Failed to load excess report.");
      setReportLoading(false);
      return;
    }

    const rows = (data || []).map((row: any) => {
      const receiptUrl = getPublicReceiptUrl(row.atm_receipt_url);
      return {
        ...row,
        receiptUrl,
      };
    });

    const draftMap: Record<number, string> = {};
    rows.forEach((row: any) => {
      if (row.recon_communication_date) {
        draftMap[row.id] = row.recon_communication_date;
      }
    });

    setReconDrafts(draftMap);
    setReportRows(rows);
    setReportLoading(false);
  }

  async function updateReconDate(id: number) {
    const value = reconDrafts[id] || "";
    setReconSaving((prev) => ({ ...prev, [id]: true }));

    const { error } = await supabase
      .from("atm_excess_cash")
      .update({ recon_communication_date: value || null })
      .eq("id", id);

    if (error) {
      setReportError("Failed to update recon communication date.");
    }

    setReconSaving((prev) => ({ ...prev, [id]: false }));
  }

  /* ---------------- UI ---------------- */

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("entry")}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
              activeTab === "entry"
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            Excess Entry
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("report")}
            className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
              activeTab === "report"
                ? "bg-primary text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            Excess Report
          </button>
        </div>
      </div>

      {activeTab === "entry" && (
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
              Excess Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={excessDate}
              onChange={(e) => handleExcessDateChange(e.target.value)}
              max={getISTDateString()}
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
            {dateNotice && (
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-200 rounded p-2">
                {dateNotice}
              </p>
            )}
          </div>
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
      )}

      {activeTab === "report" && (
        <div className="max-w-5xl mx-auto space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-primary mb-1">ATM Excess Report</h2>
            <p className="text-sm text-slate-600">
              Historical excess cash entries (not part of SOA)
            </p>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={reportFromDate}
                  onChange={(e) => setReportFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={reportToDate}
                  onChange={(e) => setReportToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">ATM Site</label>
                <select
                  className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
                  value={reportSiteId}
                  onChange={(e) =>
                    setReportSiteId(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
                  }
                >
                  <option value="ALL">All Sites</option>
                  {reportSites.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.bank_name} – {s.address}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadReport}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-900 text-white"
              >
                {reportLoading ? "Loading..." : "Load Report"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setReportRows([]);
                  setReportError(null);
                }}
                className="px-4 py-2 rounded-md text-sm font-semibold bg-slate-100 text-slate-600"
              >
                Clear
              </button>
            </div>
          </div>

          {reportError && (
            <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
              ⚠️ {reportError}
            </div>
          )}

          {reportRows.length === 0 && !reportLoading && !reportError && (
            <div className="text-sm text-slate-500">No excess records for the selected filters.</div>
          )}

          {reportRows.length > 0 && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-x-auto">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="text-left px-3 py-2">Date</th>
                    <th className="text-left px-3 py-2">ATM Site</th>
                    <th className="text-left px-3 py-2">Remarks</th>
                    <th className="text-left px-3 py-2">Receipt Preview</th>
                    <th className="text-left px-3 py-2">Recon Communication Date</th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row: any) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-3 py-2">
                        {row.excess_date || row.assignment?.assignment_date || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.site?.bank_name || "ATM"}
                        <div className="text-[10px] text-slate-500">
                          {row.site?.address || ""}
                        </div>
                      </td>
                      <td className="px-3 py-2">{row.remarks || "-"}</td>
                      <td className="px-3 py-2">
                        {row.receiptUrl ? (
                          <button
                            type="button"
                            onClick={() => {
                              setReceiptPreviewUrl(row.receiptUrl);
                              setShowReceiptPreview(true);
                            }}
                            className="text-primary text-xs font-semibold underline"
                          >
                            View Receipt
                          </button>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            className="border border-slate-300 rounded px-2 py-1 text-xs"
                            value={reconDrafts[row.id] || ""}
                            onChange={(e) =>
                              setReconDrafts((prev) => ({
                                ...prev,
                                [row.id]: e.target.value,
                              }))
                            }
                          />
                          <button
                            type="button"
                            onClick={() => updateReconDate(row.id)}
                            className="px-2 py-1 rounded text-xs bg-slate-900 text-white"
                            disabled={!!reconSaving[row.id]}
                          >
                            {reconSaving[row.id] ? "Saving..." : "Save"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showReceiptPreview && receiptPreviewUrl && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">ATM Receipt Preview</h3>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 text-xl"
                onClick={() => setShowReceiptPreview(false)}
              >
                ✕
              </button>
            </div>
            <img
              src={receiptPreviewUrl}
              alt="ATM Receipt"
              className="w-full max-h-[70vh] object-contain"
            />
            <div className="flex justify-end">
              <a
                href={receiptPreviewUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-primary underline"
              >
                Open in new tab
              </a>
            </div>
          </div>
        </div>
      )}

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
