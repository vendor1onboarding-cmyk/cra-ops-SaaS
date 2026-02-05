import { useEffect, useMemo, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import { DenominationFields } from "../components/DenominationFields";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { getISTDateString } from "../utils/time";

const GPS_RADIUS_METERS = 100;

type Site = {
  id: number;
  bank_name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
};

type Denoms = {
  denom_100: number;
  denom_200: number;
  denom_500: number;
  denom_2000: number;
};

type GPSState = {
  status: "unknown" | "verified" | "mismatch" | "no_gps";
  message: string | null;
  lat: number | null;
  lng: number | null;
  distance: number | null;
  timestamp: string | null;
};

type Destination = {
  id: string;
  siteId: number | null;
  denoms: Denoms;
  gps: GPSState;
  photo: File | null;
};

const EMPTY_DENOMS: Denoms = {
  denom_100: 0,
  denom_200: 0,
  denom_500: 0,
  denom_2000: 0,
};

const EMPTY_GPS: GPSState = {
  status: "unknown",
  message: null,
  lat: null,
  lng: null,
  distance: null,
  timestamp: null,
};

const DENOM_KEYS: (keyof Denoms)[] = [
  "denom_100",
  "denom_200",
  "denom_500",
  "denom_2000",
];

function denomTotal(denoms: Denoms) {
  return (
    denoms.denom_100 * 100 +
    denoms.denom_200 * 200 +
    denoms.denom_500 * 500 +
    denoms.denom_2000 * 2000
  );
}

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

export default function InterSiteTransfer() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [soaId, setSoaId] = useState<number | null>(null);
  const [sites, setSites] = useState<Site[]>([]);

  const [sourceSiteId, setSourceSiteId] = useState<number | null>(null);
  const [sourceDenoms, setSourceDenoms] = useState<Denoms>(EMPTY_DENOMS);
  const [sourceGps, setSourceGps] = useState<GPSState>(EMPTY_GPS);
  const [sourcePhoto, setSourcePhoto] = useState<File | null>(null);
  const [availableSource, setAvailableSource] = useState<Denoms>(EMPTY_DENOMS);
  const [availableLoading, setAvailableLoading] = useState(false);

  const [destinations, setDestinations] = useState<Destination[]>([]);

  const [reason, setReason] = useState("Inter-site transfer");
  const [reference, setReference] = useState("");

  const [step, setStep] = useState<"source" | "destinations" | "review">(
    "source"
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");

  useEffect(() => {
    if (!profile) return;

    async function loadAssignment() {
      setLoading(true);
      setError(null);

      const today = getISTDateString();

      const { data: assignment, error: assignmentError } = await supabase
        .from("assignments")
        .select("id")
        .eq("custodian_id", profile.id)
        .eq("assignment_date", today)
        .maybeSingle();

      if (assignmentError || !assignment) {
        setError("No active assignment found for today.");
        setAssignmentId(null);
        setLoading(false);
        return;
      }

      setAssignmentId(assignment.id);

      const { data: siteData, error: siteError } = await supabase
        .from("route_sites")
        .select("site:sites(id, bank_name, address, latitude, longitude)")
        .eq("assignment_id", assignment.id);

      if (siteError) {
        setError("Unable to load sites for this assignment.");
        setSites([]);
      } else {
        setSites((siteData || []).map((r: any) => r.site));
      }

      const { data: soaData, error: soaError } = await supabase
        .from("v_soa_effective")
        .select("soa_id")
        .eq("assignment_id", assignment.id)
        .maybeSingle();

      if (soaError || !soaData) {
        setWarning(
          "SOA view not available yet for this assignment. Using assignment ID for posting."
        );
        setSoaId(assignment.id);
        setLoading(false);
        return;
      }

      setSoaId(soaData.soa_id);
      setWarning(null);
      setLoading(false);
    }

    loadAssignment();
  }, [profile]);

  useEffect(() => {
    async function loadSourceAvailability() {
      if (!assignmentId || !sourceSiteId) return;
      setAvailableLoading(true);

      const { data, error: loadError } = await supabase
        .from("atm_replenishments")
        .select("denom_2000, denom_500, denom_200, denom_100")
        .eq("assignment_id", assignmentId)
        .eq("site_id", sourceSiteId);

      if (loadError) {
        setAvailableSource(EMPTY_DENOMS);
        setAvailableLoading(false);
        return;
      }

      const totals = (data || []).reduce(
        (acc: Denoms, row: any) => {
          acc.denom_100 += row.denom_100 || 0;
          acc.denom_200 += row.denom_200 || 0;
          acc.denom_500 += row.denom_500 || 0;
          acc.denom_2000 += row.denom_2000 || 0;
          return acc;
        },
        { ...EMPTY_DENOMS }
      );

      setAvailableSource(totals);
      setAvailableLoading(false);
    }

    loadSourceAvailability();
  }, [assignmentId, sourceSiteId]);

  const sourceSite = sites.find((s) => s.id === sourceSiteId) || null;

  const sourceTotal = useMemo(() => denomTotal(sourceDenoms), [sourceDenoms]);
  const destinationTotals = useMemo(() => {
    return destinations.reduce(
      (acc, dest) => {
        DENOM_KEYS.forEach((key) => {
          acc[key] += dest.denoms[key];
        });
        return acc;
      },
      { ...EMPTY_DENOMS }
    );
  }, [destinations]);

  const destinationsTotalAmount = useMemo(
    () => denomTotal(destinationTotals),
    [destinationTotals]
  );

  const denomMismatch = DENOM_KEYS.some(
    (key) => destinationTotals[key] !== sourceDenoms[key]
  );

  const sourceExceedsAvailable = DENOM_KEYS.some(
    (key) => sourceDenoms[key] > availableSource[key]
  );

  const allDestinationsValid =
    destinations.length > 0 &&
    destinations.every(
      (dest) => dest.siteId && denomTotal(dest.denoms) > 0
    );

  const sourceGpsOk =
    sourceGps.status === "verified" ||
    (sourceGps.status !== "unknown" && !!sourcePhoto);

  const destinationsGpsOk =
    destinations.length > 0 &&
    destinations.every(
      (dest) =>
        dest.gps.status === "verified" ||
        (dest.gps.status !== "unknown" && !!dest.photo)
    );

  const allGpsVerified =
    sourceGps.status === "verified" &&
    destinations.length > 0 &&
    destinations.every((dest) => dest.gps.status === "verified");

  const sourceNeedsPhoto =
    sourceGps.status !== "verified" && sourceGps.status !== "unknown";
  const destinationsMissingPhotos = destinations.filter(
    (dest) =>
      dest.gps.status !== "verified" &&
      dest.gps.status !== "unknown" &&
      !dest.photo
  );

  const canSubmit =
    !saving &&
    !submitLocked &&
    assignmentId &&
    soaId &&
    sourceSiteId &&
    sourceTotal > 0 &&
    !sourceExceedsAvailable &&
    allDestinationsValid &&
    !denomMismatch &&
    sourceGpsOk &&
    destinationsGpsOk &&
    reason.trim().length > 0;

  function addDestination() {
    setDestinations((prev) => [
      ...prev,
      {
        id: `dest-${Date.now()}-${prev.length}`,
        siteId: null,
        denoms: { ...EMPTY_DENOMS },
        gps: { ...EMPTY_GPS },
        photo: null,
      },
    ]);
  }

  function updateDestination(id: string, updates: Partial<Destination>) {
    setDestinations((prev) =>
      prev.map((dest) => (dest.id === id ? { ...dest, ...updates } : dest))
    );
  }

  function removeDestination(id: string) {
    setDestinations((prev) => prev.filter((dest) => dest.id !== id));
  }

  async function verifyGpsForSite(site: Site, setGps: (gps: GPSState) => void) {
    setError(null);

    try {
      const g = await getGPS();

      if (!site.latitude || !site.longitude) {
        setGps({
          status: "no_gps",
          message: "ATM GPS not configured.",
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
        setGps({
          status: "verified",
          message: `GPS verified (${d.toFixed(1)} m)`,
          lat: g.lat,
          lng: g.lng,
          distance: d,
          timestamp: new Date().toISOString(),
        });
      } else {
        setGps({
          status: "mismatch",
          message: `GPS mismatch (${d.toFixed(1)} m). Move closer and retry.`,
          lat: g.lat,
          lng: g.lng,
          distance: d,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      setGps({
        status: "no_gps",
        message: "Unable to fetch GPS. Ensure location is enabled.",
        lat: null,
        lng: null,
        distance: null,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async function uploadPhoto(file: File, path: string) {
    const { error: uploadError } = await supabase.storage
      .from("issue-photos")
      .upload(path, file, { upsert: true });

    if (uploadError) {
      throw new Error("Photo upload failed");
    }

    return path;
  }

  function resetForm() {
    setSourceSiteId(null);
    setSourceDenoms(EMPTY_DENOMS);
    setSourceGps(EMPTY_GPS);
    setSourcePhoto(null);
    setDestinations([]);
    setReason("Inter-site transfer");
    setReference("");
    setStep("source");
    setSubmitLocked(false);
  }

  async function handleSubmit() {
    if (!canSubmit || !profile || !sourceSite || submitLocked) return;

    if (sourceNeedsPhoto && !sourcePhoto) {
      setError("Source photo required due to GPS mismatch.");
      return;
    }

    if (destinationsMissingPhotos.length > 0) {
      setError("Destination photo required for GPS mismatch.");
      return;
    }

    setSaving(true);
    setError(null);
    setSuccess(null);

    let uploadedSourcePhoto: string | null = null;
    const uploadedDestinationPhotos: Record<string, string | null> = {};

    try {
      if (sourcePhoto) {
        const path = `inter-site/source-${assignmentId}-${sourceSiteId}-${Date.now()}.jpg`;
        uploadedSourcePhoto = await uploadPhoto(sourcePhoto, path);
      }

      for (const dest of destinations) {
        if (dest.photo) {
          const path = `inter-site/destination-${assignmentId}-${dest.siteId}-${dest.id}-${Date.now()}.jpg`;
          uploadedDestinationPhotos[dest.id] = await uploadPhoto(dest.photo, path);
        }
      }

      const destinationPayload = destinations.map((dest) => {
        const site = sites.find((s) => s.id === dest.siteId);
        return {
          site_id: dest.siteId,
          site_name: site ? `${site.bank_name} – ${site.address}` : "",
          denominations: dest.denoms,
          total_amount: denomTotal(dest.denoms),
          gps: {
            status: dest.gps.status,
            message: dest.gps.message,
            lat: dest.gps.lat,
            lng: dest.gps.lng,
            distance_meters: dest.gps.distance,
            timestamp: dest.gps.timestamp,
          },
          photo_url: uploadedDestinationPhotos[dest.id] || null,
        };
      });

      const { error: insertError } = await supabase
        .from("soa_adjustments")
        .insert({
          soa_id: assignmentId,
          assignment_id: assignmentId,
          custodian_id: profile.id,
          adjustment_type: "INTER_SITE_TRANSFER",
          adjustment_amount: 0,
          reason: reason.trim(),
          reference: reference.trim() || null,
          created_by: profile.id,
          transfer_metadata: {
            source_site_id: sourceSiteId,
            source_site_name: `${sourceSite.bank_name} – ${sourceSite.address}`,
            source_denominations: sourceDenoms,
            source_total_amount: sourceTotal,
            source_gps: {
              status: sourceGps.status,
              message: sourceGps.message,
              lat: sourceGps.lat,
              lng: sourceGps.lng,
              distance_meters: sourceGps.distance,
              timestamp: sourceGps.timestamp,
            },
            source_photo_url: uploadedSourcePhoto,
            destinations: destinationPayload,
            total_amount: sourceTotal,
            transfer_time: new Date().toISOString(),
          },
        });

      if (insertError) {
        setError(insertError.message || "Failed to record transfer.");
        setSaving(false);
        return;
      }

      setSuccess("Inter-site transfer recorded successfully.");
      setSubmitLocked(true);
      setConfirmMessage(
        `Inter-site transfer recorded successfully from ${
          sourceSite.bank_name || "source"
        }.`
      );
      setShowConfirm(true);
      setSaving(false);
    } catch (err) {
      setError("Photo upload failed. Please retry.");
      setSaving(false);
    }
  }

  return (
    <AppLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">
            ATM Inter-Site Transfer
          </h1>
          <p className="text-sm text-slate-600">
            Move cash between ATMs without impacting cash-in-hand.
          </p>
        </div>

        {loading && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
            Loading assignment details…
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {warning && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            ⚠️ {warning}
          </div>
        )}

        {success && (
          <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm text-green-700">
            ✅ {success}
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col sm:flex-row gap-2">
          {(
            [
              { key: "source", label: "1. Source ATM" },
              { key: "destinations", label: "2. Destinations" },
              { key: "review", label: "3. Review" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setStep(item.key)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors ${
                step === item.key
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {step === "source" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Source ATM <span className="text-red-600">*</span>
                </label>
                <select
                  className="input w-full"
                  value={sourceSiteId ?? ""}
                  onChange={(e) => {
                    setSourceSiteId(Number(e.target.value) || null);
                    setSourceGps(EMPTY_GPS);
                    setSourceDenoms(EMPTY_DENOMS);
                    setSourcePhoto(null);
                  }}
                >
                  <option value="">-- Select source ATM --</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.bank_name} – {site.address}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Source GPS Validation <span className="text-red-600">*</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    sourceSite &&
                    verifyGpsForSite(sourceSite, (gps) => setSourceGps(gps))
                  }
                  disabled={!sourceSite}
                  className="btn-secondary"
                >
                  Verify GPS at Source
                </button>
                {sourceGps.message && (
                  <p
                    className={`text-xs ${
                      sourceGps.status === "verified"
                        ? "text-emerald-600"
                        : "text-amber-600"
                    }`}
                  >
                    {sourceGps.message}
                  </p>
                )}
                {sourceNeedsPhoto && (
                  <div className="space-y-1">
                    <label className="block text-xs text-slate-600">
                      Source Photo (required)
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      className="w-full text-xs"
                      onChange={(e) =>
                        setSourcePhoto(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Source Denominations</span>
                <span className="font-semibold text-slate-700">
                  ₹{sourceTotal.toLocaleString("en-IN")}
                </span>
              </div>
              <DenominationFields
                values={sourceDenoms}
                onChange={(name, value) =>
                  setSourceDenoms({
                    ...sourceDenoms,
                    [name]: value,
                  })
                }
              />

              {sourceSiteId && (
                <div className="text-xs text-slate-600 bg-slate-50 border border-slate-200 rounded p-3">
                  <p className="font-semibold text-slate-700 mb-1">
                    Available (from today’s ATM loads)
                  </p>
                  {availableLoading ? (
                    <p>Loading availability…</p>
                  ) : (
                    <p>
                      ₹100×{availableSource.denom_100}, ₹200×
                      {availableSource.denom_200}, ₹500×
                      {availableSource.denom_500}, ₹2000×
                      {availableSource.denom_2000}
                    </p>
                  )}
                  {sourceExceedsAvailable && (
                    <p className="text-amber-600 mt-1">
                      Entered denominations exceed available at source.
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                className="btn-primary"
                onClick={() => setStep("destinations")}
                disabled={!sourceSiteId || sourceTotal === 0}
              >
                Next: Destinations
              </button>
            </div>
          </div>
        )}

        {step === "destinations" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Destination ATMs
              </h2>
              <button type="button" className="btn-secondary" onClick={addDestination}>
                + Add Destination
              </button>
            </div>

            {destinations.length === 0 && (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600">
                Add at least one destination site to proceed.
              </div>
            )}

            <div className="space-y-4">
              {destinations.map((dest, index) => {
                const site = sites.find((s) => s.id === dest.siteId) || null;
                return (
                  <div
                    key={dest.id}
                    className="border border-slate-200 rounded-lg p-4 space-y-3"
                  >
                    <div className="flex flex-wrap justify-between gap-2">
                      <h3 className="text-sm font-semibold text-slate-800">
                        Destination {index + 1}
                      </h3>
                      <button
                        type="button"
                        className="text-xs text-red-600"
                        onClick={() => removeDestination(dest.id)}
                      >
                        Remove
                      </button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Destination ATM <span className="text-red-600">*</span>
                        </label>
                        <select
                          className="input w-full"
                          value={dest.siteId ?? ""}
                          onChange={(e) =>
                            updateDestination(dest.id, {
                              siteId: Number(e.target.value) || null,
                              gps: { ...EMPTY_GPS },
                              photo: null,
                            })
                          }
                        >
                          <option value="">-- Select ATM --</option>
                          {sites
                            .filter((s) => s.id !== sourceSiteId)
                            .map((siteOption) => (
                              <option key={siteOption.id} value={siteOption.id}>
                                {siteOption.bank_name} – {siteOption.address}
                              </option>
                            ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-2">
                        <label className="block text-xs font-semibold text-slate-700">
                          Destination GPS <span className="text-red-600">*</span>
                        </label>
                        <button
                          type="button"
                          className="btn-secondary"
                          disabled={!site}
                          onClick={() =>
                            site &&
                            verifyGpsForSite(site, (gps) =>
                              updateDestination(dest.id, { gps })
                            )
                          }
                        >
                          Verify GPS at Destination
                        </button>
                        {dest.gps.message && (
                          <p
                            className={`text-xs ${
                              dest.gps.status === "verified"
                                ? "text-emerald-600"
                                : "text-amber-600"
                            }`}
                          >
                            {dest.gps.message}
                          </p>
                        )}
                        {dest.gps.status !== "verified" &&
                          dest.gps.status !== "unknown" && (
                            <div className="space-y-1">
                              <label className="block text-xs text-slate-600">
                                Destination Photo (required)
                              </label>
                              <input
                                type="file"
                                accept="image/*"
                                className="w-full text-xs"
                                onChange={(e) =>
                                  updateDestination(dest.id, {
                                    photo: e.target.files?.[0] || null,
                                  })
                                }
                              />
                            </div>
                          )}
                      </div>
                    </div>

                    <div>
                      <DenominationFields
                        values={dest.denoms}
                        onChange={(name, value) =>
                          updateDestination(dest.id, {
                            denoms: {
                              ...dest.denoms,
                              [name]: value,
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between">
              <button
                className="btn-secondary"
                onClick={() => setStep("source")}
              >
                Back
              </button>
              <button
                className="btn-primary"
                onClick={() => setStep("review")}
                disabled={destinations.length === 0}
              >
                Next: Review
              </button>
            </div>
          </div>
        )}

        {step === "review" && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-900">Review</h2>

            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2 text-sm">
              <p>
                <strong>Source:</strong> {sourceSite?.bank_name} –{" "}
                {sourceSite?.address}
              </p>
              <p>
                <strong>Source Total:</strong> ₹{sourceTotal.toLocaleString("en-IN")}
              </p>
              <p>
                <strong>Destinations Total:</strong> ₹
                {destinationsTotalAmount.toLocaleString("en-IN")}
              </p>
              {denomMismatch && (
                <p className="text-amber-700">
                  Denomination mismatch detected. Totals must match per denomination.
                </p>
              )}
              {!(sourceGpsOk && destinationsGpsOk) && (
                <p className="text-amber-700">
                  GPS verification is required at source and destinations, or
                  upload photos for GPS mismatch/no GPS.
                </p>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {destinations.map((dest) => {
                const site = sites.find((s) => s.id === dest.siteId);
                return (
                  <div
                    key={dest.id}
                    className="border border-slate-200 rounded-lg p-4 text-sm"
                  >
                    <p className="font-semibold text-slate-800">
                      {site?.bank_name} – {site?.address}
                    </p>
                    <p className="text-slate-600">
                      Total: ₹{denomTotal(dest.denoms).toLocaleString("en-IN")}
                    </p>
                    <p className="text-xs text-slate-500">
                      GPS: {dest.gps.status}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Reason <span className="text-red-600">*</span>
                </label>
                <input
                  className="input w-full"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">
                  Reference (Optional)
                </label>
                <input
                  className="input w-full"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between">
              <button
                className="btn-secondary"
                onClick={() => setStep("destinations")}
              >
                Back
              </button>
              <button
                className="btn-primary"
                disabled={!canSubmit}
                onClick={handleSubmit}
              >
                {saving ? "Saving…" : "Submit Transfer"}
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="Inter-Site Transfer Saved"
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
