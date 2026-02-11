import { useEffect, useRef, useState } from "react";
import { supabase } from "../api/supabaseClient";
import { AppLayout } from "../components/Layout";
import ConfirmationModal from "../components/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { getISTDateString } from "../utils/time";
import { travelLogService, TravelContext } from "../utils/travelLogService";

const GPS_RADIUS_METERS = 100;

const DENOM_VALUES: Record<string, number> = {
  denom_100: 100,
  denom_200: 200,
  denom_500: 500,
  denom_2000: 2000,
};

function toIST(date = new Date()) {
  return new Date(date.getTime() + 5.5 * 60 * 60 * 1000).toISOString();
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

export default function ATMReplenishment() {
  const { profile } = useAuth();

  const [assignmentId, setAssignmentId] = useState<number | null>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [siteId, setSiteId] = useState<number | null>(null);
  const site = sites.find((s) => s.id === siteId);

  const [timeIn, setTimeIn] = useState<string | null>(null);
  const [remarks, setRemarks] = useState("");

  const [denoms, setDenoms] = useState({
    denom_100: 0,
    denom_200: 0,
    denom_500: 0,
    denom_2000: 0,
  });

  const [denomSource, setDenomSource] = useState<"manual" | "plan" | null>(null);
  const [plannedDenoms, setPlannedDenoms] = useState<
    | {
        denom_100: number;
        denom_200: number;
        denom_500: number;
        denom_2000: number;
      }
    | null
  >(null);
  const [hasPlan, setHasPlan] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);

  const [gpsStatus, setGpsStatus] =
    useState<"unknown" | "verified" | "mismatch" | "no_gps">("unknown");
  const [gpsMsg, setGpsMsg] = useState<string | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // Available cash tracking - split by source
  const [availableCash, setAvailableCash] = useState<{
    denom_100: number;
    denom_200: number;
    denom_500: number;
    denom_2000: number;
  }>({ denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 });
  const [availableTotalAmount, setAvailableTotalAmount] = useState(0);
  const [availableBankCash, setAvailableBankCash] = useState<{
    denom_100: number;
    denom_200: number;
    denom_500: number;
    denom_2000: number;
  }>({ denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 });
  const [availableBankTotal, setAvailableBankTotal] = useState(0);
  const [availableInternalCash, setAvailableInternalCash] = useState<{
    denom_100: number;
    denom_200: number;
    denom_500: number;
    denom_2000: number;
  }>({ denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 });
  const [availableInternalTotal, setAvailableInternalTotal] = useState(0);
  const [cashLoadingError, setCashLoadingError] = useState<string | null>(null);
  const [cashLoading, setCashLoading] = useState(false);

  // Validation state
  const [validationErrors, setValidationErrors] = useState<{
    [key: string]: string;
  }>({});
  const [totalCashError, setTotalCashError] = useState<string | null>(null);

  const [photo, setPhoto] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitLocked, setSubmitLocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  // Travel log integration (optional, non-blocking)
  const [captureTravelLog, setCaptureTravelLog] = useState(true);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

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

  /* ---------------- Load denomination plan (read-only preview) ---------------- */

  useEffect(() => {
    if (!assignmentId || !siteId) {
      setDenomSource(null);
      setPlannedDenoms(null);
      setHasPlan(false);
      return;
    }

    async function loadDenominationPlan() {
      setPlanLoading(true);

      try {
        const { data, error } = await supabase
          .from("denomination_plans")
          .select("*")
          .eq("assignment_id", assignmentId)
          .eq("site_id", siteId)
          .maybeSingle();

        if (error) {
          console.warn("[ATMLoad] Failed to fetch denomination plan:", error);
          setPlannedDenoms(null);
          setHasPlan(false);
          setPlanLoading(false);
          return;
        }

        if (data) {
          setPlannedDenoms({
            denom_100: data.denom_100 || 0,
            denom_200: data.denom_200 || 0,
            denom_500: data.denom_500 || 0,
            denom_2000: data.denom_2000 || 0,
          });
          setHasPlan(true);
        } else {
          setPlannedDenoms(null);
          setHasPlan(false);
        }
      } catch (err) {
        console.warn("[ATMLoad] Error loading denomination plan:", err);
        setPlannedDenoms(null);
        setHasPlan(false);
      }

      setPlanLoading(false);
    }

    loadDenominationPlan();
  }, [assignmentId, siteId]);

  /* Load available cash when assignment changes */
  useEffect(() => {
    if (assignmentId) {
      loadAvailableCash();
    }
  }, [assignmentId]);

  /* ---------------- GPS ---------------- */

  async function acquireGPS() {
  setGpsMsg("Acquiring GPS signal… please wait");
  setGpsStatus("unknown");
  setDistance(null);
  setLat(null);
  setLng(null);
  setPhoto(null); // reset photo on every retry

  try {
    const g = await getGPS();
    setLat(g.lat);
    setLng(g.lng);

    if (!site?.latitude || !site?.longitude) {
      setGpsStatus("no_gps");
      setGpsMsg("ATM GPS not configured. Photo required.");
      return;
    }

    const d = distanceMeters(
      g.lat,
      g.lng,
      Number(site.latitude),
      Number(site.longitude)
    );

    setDistance(d);

    if (d <= GPS_RADIUS_METERS) {
      setGpsStatus("verified");
      setGpsMsg(`GPS verified successfully (${d.toFixed(1)} m)`);
    } else {
      setGpsStatus("mismatch");
      setGpsMsg(
        `GPS mismatch (${d.toFixed(1)} m). Move closer to ATM and retry.`
      );
    }
  } catch (err) {
    setGpsStatus("no_gps");
    setGpsMsg("Unable to fetch GPS. Ensure location is enabled.");
  }
}

  /* ====== CASH AVAILABILITY VALIDATION ====== */

  async function loadAvailableCash() {
    if (!assignmentId) return;

    setCashLoading(true);
    setCashLoadingError(null);

    try {
      // Get today's cash pickups for this custodian (with internal_source_metadata)
      const { data: pickups, error: pickupError } = await supabase
        .from("cash_pickups")
        .select("denom_2000, denom_500, denom_200, denom_100, internal_source_metadata")
        .eq("assignment_id", assignmentId);

      if (pickupError) {
        console.warn("[ATMLoad] Failed to fetch pickups:", pickupError);
        setCashLoadingError("Failed to load cash availability");
        setCashLoading(false);
        return;
      }

      // Split pickups into bank-sourced and internal-sourced
      const bankPickups = {
        denom_100: 0,
        denom_200: 0,
        denom_500: 0,
        denom_2000: 0,
      };

      const internalPickups = {
        denom_100: 0,
        denom_200: 0,
        denom_500: 0,
        denom_2000: 0,
      };

      (pickups || []).forEach((p: any) => {
        const pickupSource = p.pickup_source || "BANK";

        if (pickupSource === "ATM_INTERNAL") {
          // ATM_INTERNAL pickups go directly to internal cash
          internalPickups.denom_100 += p.denom_100 || 0;
          internalPickups.denom_200 += p.denom_200 || 0;
          internalPickups.denom_500 += p.denom_500 || 0;
          internalPickups.denom_2000 += p.denom_2000 || 0;
        } else {
          // Bank pickups (pickup_source = "BANK" or null)
          bankPickups.denom_100 += p.denom_100 || 0;
          bankPickups.denom_200 += p.denom_200 || 0;
          bankPickups.denom_500 += p.denom_500 || 0;
          bankPickups.denom_2000 += p.denom_2000 || 0;
        }

        // Internal source metadata contains cash from internal ATM pickups (legacy support)
        if (p.internal_source_metadata?.sources) {
          p.internal_source_metadata.sources.forEach((source: any) => {
            const denoms = source.denominations || {};
            internalPickups.denom_100 += denoms.denom_100 || 0;
            internalPickups.denom_200 += denoms.denom_200 || 0;
            internalPickups.denom_500 += denoms.denom_500 || 0;
            internalPickups.denom_2000 += denoms.denom_2000 || 0;
          });
        }
      });

      // Get all previous ATM loads for this assignment (with source_breakdown)
      const { data: loads, error: loadError } = await supabase
        .from("atm_replenishments")
        .select("denom_2000, denom_500, denom_200, denom_100, source_breakdown")
        .eq("assignment_id", assignmentId);

      if (loadError) {
        console.warn("[ATMLoad] Failed to fetch previous loads:", loadError);
        setCashLoadingError("Failed to load cash availability");
        setCashLoading(false);
        return;
      }

      // Sum up bank-sourced and internal-sourced loads separately
      const bankLoads = {
        denom_100: 0,
        denom_200: 0,
        denom_500: 0,
        denom_2000: 0,
      };

      const internalLoads = {
        denom_100: 0,
        denom_200: 0,
        denom_500: 0,
        denom_2000: 0,
      };

      (loads || []).forEach((l: any) => {
        if (l.source_breakdown) {
          // Load has source breakdown - split accordingly
          const bankSource = l.source_breakdown.bank_source || {};
          const internalSource = l.source_breakdown.internal_source || {};

          bankLoads.denom_100 += bankSource.denom_100 || 0;
          bankLoads.denom_200 += bankSource.denom_200 || 0;
          bankLoads.denom_500 += bankSource.denom_500 || 0;
          bankLoads.denom_2000 += bankSource.denom_2000 || 0;

          internalLoads.denom_100 += internalSource.denom_100 || 0;
          internalLoads.denom_200 += internalSource.denom_200 || 0;
          internalLoads.denom_500 += internalSource.denom_500 || 0;
          internalLoads.denom_2000 += internalSource.denom_2000 || 0;
        } else {
          // No source breakdown - all bank-sourced (backward compatibility)
          bankLoads.denom_100 += l.denom_100 || 0;
          bankLoads.denom_200 += l.denom_200 || 0;
          bankLoads.denom_500 += l.denom_500 || 0;
          bankLoads.denom_2000 += l.denom_2000 || 0;
        }
      });

      // Apply denomination exchanges (only affects bank cash)
      const { data: exchanges, error: exchangeError } = await supabase
        .from("soa_adjustments")
        .select("exchange_metadata")
        .eq("assignment_id", assignmentId)
        .eq("adjustment_type", "EXCHANGE");

      if (exchangeError) {
        console.warn("[ATMLoad] Failed to fetch exchanges:", exchangeError);
      }

      const exchangeDelta = (exchanges || []).reduce(
        (acc: typeof bankPickups, row: any) => {
          const from = row?.exchange_metadata?.from_denominations || {};
          const to = row?.exchange_metadata?.to_denominations || {};

          acc.denom_100 += (to.denom_100 || 0) - (from.denom_100 || 0);
          acc.denom_200 += (to.denom_200 || 0) - (from.denom_200 || 0);
          acc.denom_500 += (to.denom_500 || 0) - (from.denom_500 || 0);
          acc.denom_2000 += (to.denom_2000 || 0) - (from.denom_2000 || 0);
          return acc;
        },
        { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 }
      );

      // Calculate available bank cash = bank pickups - bank loads + exchanges
      const availableBank = {
        denom_100: Math.max(
          0,
          bankPickups.denom_100 - bankLoads.denom_100 + exchangeDelta.denom_100
        ),
        denom_200: Math.max(
          0,
          bankPickups.denom_200 - bankLoads.denom_200 + exchangeDelta.denom_200
        ),
        denom_500: Math.max(
          0,
          bankPickups.denom_500 - bankLoads.denom_500 + exchangeDelta.denom_500
        ),
        denom_2000: Math.max(
          0,
          bankPickups.denom_2000 - bankLoads.denom_2000 + exchangeDelta.denom_2000
        ),
      };

      // Calculate available internal cash = internal pickups - internal loads
      const availableInternal = {
        denom_100: Math.max(0, internalPickups.denom_100 - internalLoads.denom_100),
        denom_200: Math.max(0, internalPickups.denom_200 - internalLoads.denom_200),
        denom_500: Math.max(0, internalPickups.denom_500 - internalLoads.denom_500),
        denom_2000: Math.max(0, internalPickups.denom_2000 - internalLoads.denom_2000),
      };

      // Total available = bank + internal
      const available = {
        denom_100: availableBank.denom_100 + availableInternal.denom_100,
        denom_200: availableBank.denom_200 + availableInternal.denom_200,
        denom_500: availableBank.denom_500 + availableInternal.denom_500,
        denom_2000: availableBank.denom_2000 + availableInternal.denom_2000,
      };

      const totalAvailableBank =
        availableBank.denom_100 * 100 +
        availableBank.denom_200 * 200 +
        availableBank.denom_500 * 500 +
        availableBank.denom_2000 * 2000;

      const totalAvailableInternal =
        availableInternal.denom_100 * 100 +
        availableInternal.denom_200 * 200 +
        availableInternal.denom_500 * 500 +
        availableInternal.denom_2000 * 2000;

      const totalAvailable = totalAvailableBank + totalAvailableInternal;

      setAvailableCash(available);
      setAvailableTotalAmount(totalAvailable);
      setAvailableBankCash(availableBank);
      setAvailableBankTotal(totalAvailableBank);
      setAvailableInternalCash(availableInternal);
      setAvailableInternalTotal(totalAvailableInternal);
    } catch (err) {
      console.error("[ATMLoad] Error loading available cash:", err);
      setCashLoadingError("Failed to load cash availability");
    } finally {
      setCashLoading(false);
    }
  }

  // Validate current denomination inputs against available cash
  function validateCashAvailability(): boolean {
    const errors: { [key: string]: string } = {};
    let totalError: string | null = null;

    // Check each denomination
    Object.entries(DENOM_VALUES).forEach(([key, denomValue]) => {
      const entered = denoms[key as keyof typeof denoms];
      const available = availableCash[key as keyof typeof availableCash];

      if (entered > available) {
        errors[key] = `Available: ${available}, Attempted: ${entered}`;
      }
    });

    // Check total amount
    const loadTotal = Object.entries(DENOM_VALUES).reduce(
      (sum, [key, value]) => sum + denoms[key as keyof typeof denoms] * value,
      0
    );

    if (loadTotal > availableTotalAmount && totalNotes > 0) {
      totalError = `Total load (₹${loadTotal.toLocaleString(
        "en-IN"
      )}) exceeds available cash (₹${availableTotalAmount.toLocaleString(
        "en-IN"
      )})`;
    }

    setValidationErrors(errors);
    setTotalCashError(totalError);

    return Object.keys(errors).length === 0 && !totalError;
  }

  /* ====== END CASH VALIDATION ====== */


  /* ---------------- Amount Calculation ---------------- */

  const denomBreakup = Object.entries(DENOM_VALUES).map(([k, value]) => {
    const count = (denoms as any)[k] as number;
    return {
      key: k,
      value,
      count,
      amount: count * value,
    };
  });

  const totalNotes = denomBreakup.reduce((a, d) => a + d.count, 0);
  const totalAmount = denomBreakup.reduce((a, d) => a + d.amount, 0);

  const plannedBreakup = plannedDenoms
    ? Object.entries(DENOM_VALUES).map(([k, value]) => {
        const count = (plannedDenoms as any)[k] as number;
        return {
          key: k,
          value,
          count,
          amount: count * value,
        };
      })
    : [];

  const plannedTotalNotes = plannedBreakup.reduce((a, d) => a + d.count, 0);
  const plannedTotalAmount = plannedBreakup.reduce((a, d) => a + d.amount, 0);

  const remainingCash = Object.entries(DENOM_VALUES).reduce(
    (acc, [key]) => {
      const available = availableCash[key as keyof typeof availableCash] || 0;
      const entered = denoms[key as keyof typeof denoms] || 0;
      const remaining = Math.max(0, available - entered);
      acc[key as keyof typeof availableCash] = remaining;
      return acc;
    },
    {
      denom_100: 0,
      denom_200: 0,
      denom_500: 0,
      denom_2000: 0,
    } as typeof availableCash
  );

  const remainingTotalAmount =
    remainingCash.denom_100 * 100 +
    remainingCash.denom_200 * 200 +
    remainingCash.denom_500 * 500 +
    remainingCash.denom_2000 * 2000;

  /* Validate on denomination change (after totalNotes is defined) */
  useEffect(() => {
    validateCashAvailability();
  }, [denoms, availableCash, totalNotes]);

  /* ---------------- Save ---------------- */

  // Calculate source breakdown for ATM load (bank vs internal sources)
  function calculateSourceBreakdown(loadDenoms: typeof denoms) {
    const bankSource = {
      denom_100: 0,
      denom_200: 0,
      denom_500: 0,
      denom_2000: 0,
      total_amount: 0,
    };

    const internalSource = {
      denom_100: 0,
      denom_200: 0,
      denom_500: 0,
      denom_2000: 0,
      total_amount: 0,
    };

    // For each denomination, use bank source first, then internal
    Object.entries(DENOM_VALUES).forEach(([key, value]) => {
      const requiredCount = loadDenoms[key as keyof typeof loadDenoms];
      const availableBank = availableBankCash[key as keyof typeof availableBankCash];
      const availableInternal = availableInternalCash[key as keyof typeof availableInternalCash];

      // Use bank source first (up to available)
      const fromBank = Math.min(requiredCount, availableBank);
      bankSource[key as keyof typeof bankSource] = fromBank;

      // Use internal source for the remainder
      const fromInternal = requiredCount - fromBank;
      internalSource[key as keyof typeof internalSource] = fromInternal;
    });

    // Calculate totals
    bankSource.total_amount =
      bankSource.denom_100 * 100 +
      bankSource.denom_200 * 200 +
      bankSource.denom_500 * 500 +
      bankSource.denom_2000 * 2000;

    internalSource.total_amount =
      internalSource.denom_100 * 100 +
      internalSource.denom_200 * 200 +
      internalSource.denom_500 * 500 +
      internalSource.denom_2000 * 2000;

    const combinedTotal = bankSource.total_amount + internalSource.total_amount;

    return {
      bank_source: bankSource,
      internal_source: internalSource,
      combined_total: combinedTotal,
    };
  }

  function resetForm() {
    setSiteId(null);
    setTimeIn(null);
    setRemarks("");
    setDenoms({ denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 });
    setDenomSource(null);
    setGpsStatus("unknown");
    setGpsMsg(null);
    setDistance(null);
    setLat(null);
    setLng(null);
    setPhoto(null);
    setSubmitLocked(false);
  }

  async function saveLoad() {
    if (saving || submitLocked) return;
    setError(null);

    // Validate cash availability before proceeding
    if (!validateCashAvailability()) {
      setError(
        "Cannot load more cash than available. Please adjust denominations."
      );
      return;
    }

    setSaving(true);

    if (!siteId || !assignmentId) {
      setError("Select ATM site");
      setSaving(false);
      return;
    }

    if (!timeIn) {
      setError("Time In not captured");
      setSaving(false);
      return;
    }

    if (totalNotes === 0) {
      setError("Enter at least one denomination");
      setSaving(false);
      return;
    }

    if (gpsStatus !== "verified" && !photo) {
      setError("ATM photo required due to GPS mismatch");
      setSaving(false);
      return;
    }

    let photoPath: string | null = null;

    if (photo) {
      const path = `atm-loads/${assignmentId}-${siteId}-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("issue-photos")
        .upload(path, photo, { upsert: true });

      if (error) {
        setError("Photo upload failed");
        setSaving(false);
        return;
      }
      photoPath = path;
    }

    // Calculate source breakdown (bank vs internal ATM sources)
    const sourceBreakdown = calculateSourceBreakdown(denoms);

    const { error } = await supabase.from("atm_replenishments").insert({
      assignment_id: assignmentId,
      site_id: siteId,
      time_in: timeIn,
      time_out: toIST(),
      ...denoms,
      remarks,
      load_lat: lat,
      load_lng: lng,
      distance_meters: distance,
      geo_status: gpsStatus,
      photo_required: gpsStatus !== "verified",
      photo_url: photoPath,
      source_breakdown: sourceBreakdown,
    });

    if (error) {
      setError("Failed to save ATM Load");
      setSaving(false);
      return;
    }

    let isLastSiteLoad = false;
    if (captureTravelLog && sites.length > 0) {
      try {
        const { data: loads, error: loadError } = await supabase
          .from("atm_replenishments")
          .select("site_id")
          .eq("assignment_id", assignmentId);

        if (loadError) {
          console.warn("[ATMLoad] Failed to check last site:", loadError);
        } else {
          const uniqueSiteIds = new Set((loads || []).map((l: any) => l.site_id));
          isLastSiteLoad = uniqueSiteIds.size >= sites.length;
        }
      } catch (err) {
        console.warn("[ATMLoad] Error checking last site:", err);
      }
    }

    // TRAVEL LOG INTEGRATION (SAFE, NON-BLOCKING)
    // This runs AFTER ATM load is saved, so it never blocks the primary flow
    if (captureTravelLog) {
      try {
        const isAtmContext = travelLogService.getTravelContext() === TravelContext.ATM;

        if (isLastSiteLoad && isAtmContext) {
          const ended = await travelLogService.endTravelToStartOfDay(
            assignmentId,
            profile!.id
          );
          if (ended) {
            const siteLabel = site
              ? `${site.bank_name}${site.address ? `, ${site.address}` : ""}`
              : "last site";
            setToastMessage(
              `Travel ended automatically after ${siteLabel}. ` +
                "End location set to the start-of-day point."
            );
            if (toastTimerRef.current) {
              window.clearTimeout(toastTimerRef.current);
            }
            toastTimerRef.current = window.setTimeout(() => {
              setToastMessage(null);
            }, 3500);
          }
        } else {
          await travelLogService.triggerCheckpoint({
            assignmentId: assignmentId,
            custodianId: profile!.id,
            vehicleType: "bike",
            context: TravelContext.ATM,
          });
        }
      } catch (err) {
        // Silent failure - travel log errors never affect ATM load
        console.warn("[ATMLoad] Travel log trigger failed (non-critical):", err);
      }
    }

    setSaving(false);
    setSubmitLocked(true);
    setConfirmMessage(
      `ATM Load completed successfully for ${site?.bank_name || "site"}.`
    );
    setShowConfirm(true);
  }

  /* ---------------- UI ---------------- */

  return (
    <AppLayout>
      {toastMessage && (
        <div className="fixed top-4 right-4 z-50 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900 shadow-lg">
          {toastMessage}
        </div>
      )}
      <div className="max-w-2xl mx-auto space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-primary mb-1">ATM Load</h2>
          <p className="text-sm text-slate-600">
            Record cash loading at ATM locations with GPS verification
          </p>
        </div>

        {/* GPS Status Message */}
        {gpsMsg && (
          <div
            className={`text-sm px-4 py-3 rounded-lg border font-medium ${
              gpsStatus === "verified"
                ? "bg-green-50 text-green-800 border-green-200"
                : gpsStatus === "no_gps"
                ? "bg-red-50 text-red-800 border-red-200"
                : "bg-yellow-50 text-yellow-800 border-yellow-200"
            }`}
          >
            {gpsStatus === "verified" && "✓ "}
            {gpsStatus === "no_gps" && "⚠️ "}
            {gpsStatus === "mismatch" && "⚠️ "}
            {gpsMsg}
          </div>
        )}

        {/* ATM Selection */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              ATM Site <span className="text-red-500">*</span>
            </label>
            <select
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={siteId ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                setSiteId(id);
                setTimeIn(id ? toIST() : null);
                setGpsStatus("unknown");
                setGpsMsg(null);
              }}
            >
              <option value="">-- Select an ATM --</option>
              {sites.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.bank_name} – {s.address}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={acquireGPS}
            disabled={!siteId || saving}
            className="w-full bg-primary text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            📍 Acquire GPS Location
          </button>
        </div>

        {/* Photo upload when GPS fails */}
        {(gpsStatus === "mismatch" || gpsStatus === "no_gps") && (
          <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                ATM Photo <span className="text-red-500">*</span>
              </label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhoto(e.target.files?.[0] || null)}
                  className="hidden"
                  id="photo-input"
                />
                <label htmlFor="photo-input" className="cursor-pointer block">
                  <div className="text-3xl mb-2">📷</div>
                  <p className="text-sm font-medium text-slate-700">
                    {photo ? photo.name : "Click to upload ATM photo"}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    PNG, JPG up to 10MB
                  </p>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Denomination Fields */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-800 mb-4">
              Denomination Details
            </h3>
            {planLoading && (
              <p className="text-xs text-slate-500 italic mt-1">
                Checking for denomination plan...
              </p>
            )}
          </div>

          {/* ===== AVAILABLE CASH PANEL (Enterprise Control) ===== */}
          {cashLoading ? (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center">
              <p className="text-sm text-amber-800">
                Loading available cash...
              </p>
            </div>
          ) : cashLoadingError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800 font-medium">
                {cashLoadingError}
              </p>
            </div>
          ) : (
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-indigo-700 font-semibold">
                    ✓ Available Cash (Enterprise Control)
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    Maximum cash you can load today based on pickups, exchanges,
                    and previous loads.
                  </p>
                </div>
                <span className="text-xs font-semibold text-indigo-900 bg-indigo-100 px-2 py-1 rounded">
                  ₹{availableTotalAmount.toLocaleString("en-IN")}
                </span>
              </div>

              {/* Source breakdown */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2">
                  <div className="text-blue-700 font-semibold">From Bank</div>
                  <div className="text-blue-900 font-bold">
                    ₹{availableBankTotal.toLocaleString("en-IN")}
                  </div>
                  <div className="text-blue-600 text-xs">For SOA</div>
                </div>
                <div className="bg-green-50 border border-green-200 rounded-md px-3 py-2">
                  <div className="text-green-700 font-semibold">From Internal ATM</div>
                  <div className="text-green-900 font-bold">
                    ₹{availableInternalTotal.toLocaleString("en-IN")}
                  </div>
                  <div className="text-green-600 text-xs">Not for SOA</div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {Object.entries(DENOM_VALUES).map(([key, value]) => {
                  const available =
                    availableCash[key as keyof typeof availableCash];
                  return (
                    <div
                      key={key}
                      className="rounded-md border border-indigo-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs text-slate-500">₹{value}</div>
                      <div className="text-sm font-semibold text-indigo-900">
                        {available}
                      </div>
                      <div className="text-xs text-slate-500">
                        ₹{(available * value).toLocaleString("en-IN")}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ===== VALIDATION ERROR BANNER ===== */}
          {(totalCashError || Object.keys(validationErrors).length > 0) && (
            <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4 space-y-2">
              <p className="text-sm font-semibold text-red-900 flex items-center gap-2">
                ⚠️ Cash Availability Violation
              </p>
              {totalCashError && (
                <p className="text-sm text-red-800">{totalCashError}</p>
              )}
              {Object.entries(validationErrors).length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-semibold text-red-800">
                    Denomination-wise shortfall:
                  </p>
                  {Object.entries(validationErrors).map(([key, msg]) => {
                    const denomValue =
                      DENOM_VALUES[key as keyof typeof DENOM_VALUES];
                    return (
                      <p key={key} className="text-xs text-red-800">
                        • ₹{denomValue}: {msg}
                      </p>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Planned vs Live comparison */}
          {hasPlan && plannedDenoms ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                      Planned Denominations (Read-Only)
                    </p>
                    <p className="text-xs text-slate-500">
                      Review the plan and apply if needed.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="px-3 py-1.5 text-xs font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-700 active:scale-95 transition-all"
                    onClick={() => {
                      if (!plannedDenoms) return;
                      setDenoms({ ...plannedDenoms });
                      setDenomSource("plan");
                    }}
                  >
                    Apply Planned
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {plannedBreakup.map((d) => (
                    <div
                      key={d.key}
                      className="rounded-md border border-slate-200 bg-white px-3 py-2"
                    >
                      <div className="text-xs text-slate-500">₹{d.value}</div>
                      <div className="text-sm font-semibold text-slate-800">
                        {d.count}
                      </div>
                      <div className="text-xs text-slate-500">
                        ₹{d.amount.toLocaleString("en-IN")}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200 pt-2">
                  <span>Total Planned Notes: {plannedTotalNotes}</span>
                  <span className="font-semibold text-slate-800">
                    Planned Total: ₹{plannedTotalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-green-200 bg-green-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-green-700 font-semibold">
                      Remaining Cash-in-Hand (Live)
                    </p>
                    <p className="text-xs text-slate-500">
                      Updates instantly as you edit the load.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-slate-600">
                    Remaining Total: ₹{remainingTotalAmount.toLocaleString("en-IN")}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {denomBreakup.map((d) => {
                    const remaining =
                      remainingCash[d.key as keyof typeof remainingCash];
                    const isZero = remaining === 0;
                    return (
                    <div
                      key={d.key}
                      className={`rounded-md border px-3 py-2 ${
                        isZero
                          ? "border-amber-200 bg-amber-50"
                          : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="text-xs text-slate-500">₹{d.value}</div>
                      <div
                        className={`text-sm font-semibold ${
                          isZero ? "text-amber-900" : "text-slate-800"
                        }`}
                      >
                        {remaining}
                      </div>
                      <div className="text-xs text-slate-500">
                        ₹{(remaining * d.value).toLocaleString("en-IN")}
                      </div>
                    </div>
                  );
                  })}
                </div>

                <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200 pt-2">
                  <span>Remaining Total</span>
                  <span className="font-semibold text-slate-800">
                    ₹{remainingTotalAmount.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    Remaining Cash-in-Hand (Live)
                  </p>
                  <p className="text-xs text-slate-500">
                    Updates instantly as you edit the ATM load denominations.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-600">
                  Remaining Total: ₹{remainingTotalAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {denomBreakup.map((d) => {
                  const remaining =
                    remainingCash[d.key as keyof typeof remainingCash];
                  const isZero = remaining === 0;
                  return (
                  <div
                    key={d.key}
                    className={`rounded-md border px-3 py-2 ${
                      isZero
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="text-xs text-slate-500">₹{d.value}</div>
                    <div
                      className={`text-sm font-semibold ${
                        isZero ? "text-amber-900" : "text-slate-800"
                      }`}
                    >
                      {remaining}
                    </div>
                    <div className="text-xs text-slate-500">
                      ₹{(remaining * d.value).toLocaleString("en-IN")}
                    </div>
                  </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600 border-t border-slate-200 pt-2">
                <span>Remaining Total</span>
                <span className="font-semibold text-slate-800">
                  ₹{remainingTotalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {denomBreakup.map((d) => (
              <div key={d.key} className="form-group">
                <label className="text-sm font-medium text-slate-700">
                  ₹{d.value}
                </label>
                <input
                  type="number"
                  min={0}
                  className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary transition-all ${
                    denomSource === "plan"
                      ? "border-blue-300 bg-blue-50"
                      : "border-slate-300"
                  }`}
                  value={d.count}
                  onChange={(e) => {
                    setDenoms({ ...denoms, [d.key]: Number(e.target.value) });
                    // User is overriding - mark as manual
                    if (denomSource === "plan") {
                      setDenomSource("manual");
                    }
                  }}
                  placeholder="0"
                  disabled={planLoading}
                />
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="text-sm text-slate-700 space-y-1">
              {denomBreakup
                .filter((d) => d.count > 0)
                .map((d) => (
                  <div
                    key={d.key}
                    className="flex justify-between text-slate-600"
                  >
                    <span>{d.count} × ₹{d.value}</span>
                    <span className="font-medium">
                      ₹{d.amount.toLocaleString("en-IN")}
                    </span>
                  </div>
                ))}
            </div>

            <div className="border-t border-blue-300 pt-2 flex justify-between font-bold text-primary">
              <span>Total Amount</span>
              <span>₹{totalAmount.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div className="bg-white rounded-lg border border-slate-200 p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Remarks
            </label>
            <textarea
              className="w-full px-4 py-2.5 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[100px]"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any notes about this ATM load..."
            />
          </div>
        </div>

        {/* Travel Log Capture Option */}
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200 p-5">
          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="capture-travel-log"
              checked={captureTravelLog}
              onChange={(e) => setCaptureTravelLog(e.target.checked)}
              className="mt-0.5 h-4 w-4 text-primary border-slate-300 rounded focus:ring-2 focus:ring-primary"
            />
            <div className="flex-1">
              <label
                htmlFor="capture-travel-log"
                className="text-sm font-semibold text-slate-800 cursor-pointer"
              >
                Capture Travel Log from ATM Load
              </label>
              <p className="text-xs text-slate-600 mt-1">
                Automatically track travel between ATM sites. First site starts travel,
                subsequent sites create segments. Uncheck to use Travel Log menu instead.
                {captureTravelLog && (
                  <span className="block mt-1 text-blue-700">
                    ℹ️ ATM-initiated travel will chain across sites. Manual Travel Log remains independent.
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* Save Button */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={saveLoad}
            disabled={
              saving ||
              submitLocked ||
              Object.keys(validationErrors).length > 0 ||
              totalCashError !== null ||
              totalNotes === 0
            }
            className="flex-1 bg-green-600 text-white py-2.5 rounded-lg font-semibold hover:bg-green-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            title={
              Object.keys(validationErrors).length > 0 ||
              totalCashError !== null
                ? "Resolve cash availability issues before saving"
                : totalNotes === 0
                ? "Enter at least one denomination"
                : ""
            }
          >
            {saving
              ? "Saving…"
              : Object.keys(validationErrors).length > 0 ||
                  totalCashError !== null
              ? "❌ Cannot Save - Resolve Errors"
              : "Save ATM Load"}
          </button>
        </div>
      </div>

      <ConfirmationModal
        open={showConfirm}
        title="ATM Load Saved"
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
