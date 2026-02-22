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

  // Removal plan for intelligent source matching
  const [assignmentRemovalPlan, setAssignmentRemovalPlan] = useState<{
    denom_100: number;
    denom_200: number;
    denom_500: number;
    denom_2000: number;
  } | null>(null);

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

  /* ---------------- Load assignment & sites & removal plan ---------------- */

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

      // Fetch ATM removal plan for this assignment (for intelligent source matching)
      const { data: removalPlan } = await supabase
        .from("atm_removal_plans")
        .select("denom_100, denom_200, denom_500, denom_2000")
        .eq("assignment_id", assignment.id)
        .maybeSingle();

      if (removalPlan) {
        setAssignmentRemovalPlan({
          denom_100: removalPlan.denom_100 || 0,
          denom_200: removalPlan.denom_200 || 0,
          denom_500: removalPlan.denom_500 || 0,
          denom_2000: removalPlan.denom_2000 || 0,
        });
      }
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
      const DENOMS: (keyof typeof DENOM_VALUES)[] = ["denom_100", "denom_200", "denom_500", "denom_2000"];

      // Fetch pickups (with pickup_time for chronological ordering)
      const { data: pickups, error: pickupError } = await supabase
        .from("cash_pickups")
        .select(
          "denom_2000, denom_500, denom_200, denom_100, pickup_source, internal_source_metadata, pickup_time"
        )
        .eq("assignment_id", assignmentId)
        .order("pickup_time", { ascending: true });

      if (pickupError) {
        console.warn("[ATMLoad] Failed to fetch pickups:", pickupError);
        setCashLoadingError("Failed to load cash availability");
        setCashLoading(false);
        return;
      }

      // Fetch previous loads (with time_in for chronological ordering)
      const { data: loads, error: loadError } = await supabase
        .from("atm_replenishments")
        .select("denom_2000, denom_500, denom_200, denom_100, time_in")
        .eq("assignment_id", assignmentId)
        .order("time_in", { ascending: true });

      if (loadError) {
        console.warn("[ATMLoad] Failed to fetch previous loads:", loadError);
        setCashLoadingError("Failed to load cash availability");
        setCashLoading(false);
        return;
      }

      // Fetch denomination exchanges (only affects bank cash)
      const { data: exchanges, error: exchangeError } = await supabase
        .from("soa_adjustments")
        .select("exchange_metadata")
        .eq("assignment_id", assignmentId)
        .eq("adjustment_type", "EXCHANGE");

      if (exchangeError) {
        console.warn("[ATMLoad] Failed to fetch exchanges:", exchangeError);
      }


      // ── Step 1: Build bank pickup pool (all non-ATM_INTERNAL pickups) ──
      // ATM removal plans are audit-only and excluded from availability totals.
      const bankPool: Record<string, number> = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 };

      (pickups || []).forEach((p: any) => {
        const source = p.pickup_source || "BANK";
        if (source !== "ATM_INTERNAL") {
          // Bank pickup contributes full denoms to bank pool
          DENOMS.forEach((d) => { bankPool[d] += (p[d] || 0); });

          // But subtract any internal_source_metadata portion (those go to internal pool)
          if (p.internal_source_metadata?.sources) {
            p.internal_source_metadata.sources.forEach((s: any) => {
              const sDenoms = s.denominations || {};
              DENOMS.forEach((d) => { bankPool[d] -= Number(sDenoms[d] || 0); });
            });
          }
        }
      });

      // Ensure no negatives in bank pool
      DENOMS.forEach((d) => { bankPool[d] = Math.max(0, bankPool[d]); });

      // Apply exchange deltas to bank pool
      (exchanges || []).forEach((row: any) => {
        const from = row?.exchange_metadata?.from_denominations || {};
        const to = row?.exchange_metadata?.to_denominations || {};
        DENOMS.forEach((d) => {
          bankPool[d] += (to[d] || 0) - (from[d] || 0);
        });
      });
      DENOMS.forEach((d) => { bankPool[d] = Math.max(0, bankPool[d]); });

      // ── Step 2: Chronological denomination pool matching ──
      // Merge pickups + loads into a timeline, sorted by time (pickups before loads at same ts)
      type CashEvt = { kind: "pickup" | "load"; ts: number; raw: any };
      const events: CashEvt[] = [];

      (pickups || []).forEach((p: any) => {
        const ts = p.pickup_time ? new Date(p.pickup_time).getTime() : 0;
        events.push({ kind: "pickup", ts, raw: p });
      });
      (loads || []).forEach((l: any) => {
        const ts = l.time_in ? new Date(l.time_in).getTime() : 0;
        events.push({ kind: "load", ts, raw: l });
      });

      events.sort((a, b) => {
        const diff = a.ts - b.ts;
        if (diff !== 0) return diff;
        return (a.kind === "pickup" ? 0 : 1) - (b.kind === "pickup" ? 0 : 1);
      });

      // Live internal (ATM removal) denomination pool — accumulated chronologically
      const removalPool: Record<string, number> = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 };

      // Track how much bank vs internal cash has been consumed by completed loads
      let bankUsed: Record<string, number> = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 };
      let internalUsed: Record<string, number> = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 };

      events.forEach((evt) => {
        if (evt.kind === "pickup") {
          const p = evt.raw;
          const source = p.pickup_source || "BANK";

          if (source === "ATM_INTERNAL") {
            // ATM_INTERNAL pickup → feeds the internal removal pool
            DENOMS.forEach((d) => { removalPool[d] += (p[d] || 0); });
          } else {
            // Bank pickup may contain internal_source_metadata
            if (p.internal_source_metadata?.sources) {
              p.internal_source_metadata.sources.forEach((s: any) => {
                const sDenoms = s.denominations || {};
                DENOMS.forEach((d) => { removalPool[d] += Number(sDenoms[d] || 0); });
              });
            }
          }
        } else {
          // Load event — consume from internal pool first, remainder from bank
          const l = evt.raw;
          DENOMS.forEach((d) => {
            const loadCount = (l[d] || 0) as number;
            const poolCount = removalPool[d] || 0;
            const fromInternal = Math.min(loadCount, poolCount);
            const fromBank = loadCount - fromInternal;

            removalPool[d] = poolCount - fromInternal;
            internalUsed[d] += fromInternal;
            bankUsed[d] += fromBank;
          });
        }
      });

      // ── Step 3: Calculate remaining available per source ──
      const availableBank: Record<string, number> = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 };
      const availableInternal: Record<string, number> = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 };

      DENOMS.forEach((d) => {
        availableBank[d] = Math.max(0, bankPool[d] - bankUsed[d]);
        availableInternal[d] = Math.max(0, removalPool[d]); // whatever is left in the pool
      });

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
      setAvailableBankCash(availableBank as typeof availableBankCash);
      setAvailableBankTotal(totalAvailableBank);
      setAvailableInternalCash(availableInternal as typeof availableInternalCash);
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

  // Calculate source breakdown for ATM load (internal pool first, then bank)
  // AUTHORITATIVE: Reconstructs chronological internal pool from database events at save time
  /**
   * Source allocation strategy:
   * - Fetch all historical pickups and loads for this assignment
   * - Rebuild internal pool chronologically (ATM_INTERNAL pickups add, loads consume)
   * - Allocate current load from reconstructed internal pool first, remainder from bank
   * - This ensures 100% accuracy regardless of UI state, race conditions, or edge cases
   *
   * Example: Loading 10x₹2000 + 5x₹500
   * Reconstructed internal pool: 8x₹2000 + 3x₹500
   * Available bank: 50x₹2000 + 20x₹500
   * Result: internal_source: {8x₹2000, 3x₹500}, bank_source: {2x₹2000, 2x₹500}
   */
  async function calculateSourceBreakdown(loadDenoms: typeof denoms) {
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

    if (!assignmentId) {
      // Fallback: all from bank if no assignment context
      Object.entries(DENOM_VALUES).forEach(([key]) => {
        bankSource[key as keyof typeof bankSource] = loadDenoms[key as keyof typeof loadDenoms];
      });
      
      bankSource.total_amount =
        bankSource.denom_100 * 100 +
        bankSource.denom_200 * 200 +
        bankSource.denom_500 * 500 +
        bankSource.denom_2000 * 2000;

      return {
        bank_source: bankSource,
        internal_source: internalSource,
        combined_total: bankSource.total_amount,
      };
    }

    try {
      const DENOMS: (keyof typeof DENOM_VALUES)[] = ["denom_100", "denom_200", "denom_500", "denom_2000"];

      // ── Step 1: Fetch historical events for this assignment ──
      const { data: pickups, error: pickupError } = await supabase
        .from("cash_pickups")
        .select("denom_2000, denom_500, denom_200, denom_100, pickup_source, internal_source_metadata, pickup_time")
        .eq("assignment_id", assignmentId)
        .order("pickup_time", { ascending: true });

      if (pickupError) {
        console.warn("[calculateSourceBreakdown] Failed to fetch pickups:", pickupError);
        throw pickupError;
      }

      const { data: loads, error: loadError } = await supabase
        .from("atm_replenishments")
        .select("denom_2000, denom_500, denom_200, denom_100, time_in")
        .eq("assignment_id", assignmentId)
        .order("time_in", { ascending: true });

      if (loadError) {
        console.warn("[calculateSourceBreakdown] Failed to fetch loads:", loadError);
        throw loadError;
      }

      // ── Step 2: Merge events into chronological timeline ──
      type CashEvt = { kind: "pickup" | "load"; ts: number; raw: any };
      const events: CashEvt[] = [];

      (pickups || []).forEach((p: any) => {
        const ts = p.pickup_time ? new Date(p.pickup_time).getTime() : 0;
        events.push({ kind: "pickup", ts, raw: p });
      });

      (loads || []).forEach((l: any) => {
        const ts = l.time_in ? new Date(l.time_in).getTime() : 0;
        events.push({ kind: "load", ts, raw: l });
      });

      // Sort chronologically: pickups before loads at same timestamp
      events.sort((a, b) => {
        const diff = a.ts - b.ts;
        if (diff !== 0) return diff;
        return (a.kind === "pickup" ? 0 : 1) - (b.kind === "pickup" ? 0 : 1);
      });

      // ── Step 3: Rebuild internal pool chronologically ──
      const internalPool: Record<string, number> = { 
        denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0 
      };

      events.forEach((evt) => {
        if (evt.kind === "pickup") {
          const p = evt.raw;
          const source = p.pickup_source || "BANK";

          if (source === "ATM_INTERNAL") {
            // ATM_INTERNAL pickup → add to internal pool
            DENOMS.forEach((d) => { internalPool[d] += (p[d] || 0); });
          } else {
            // Bank pickup may contain internal_source_metadata → add those to internal pool
            if (p.internal_source_metadata?.sources) {
              p.internal_source_metadata.sources.forEach((s: any) => {
                const sDenoms = s.denominations || {};
                DENOMS.forEach((d) => { internalPool[d] += Number(sDenoms[d] || 0); });
              });
            }
          }
        } else {
          // Load event → consume from internal pool first
          const l = evt.raw;
          DENOMS.forEach((d) => {
            const loadCount = (l[d] || 0) as number;
            const availableInternal = internalPool[d] || 0;
            const fromInternal = Math.min(loadCount, availableInternal);
            internalPool[d] = availableInternal - fromInternal;
          });
        }
      });

      // ── Step 4: Classify current load using reconstructed pool ──
      DENOMS.forEach((d) => {
        const loadCount = loadDenoms[d];
        const availableInternal = internalPool[d] || 0;
        
        // Take from internal pool first (up to available)
        const fromInternal = Math.min(loadCount, availableInternal);
        // Remainder comes from bank pool
        const fromBank = loadCount - fromInternal;

        internalSource[d] = fromInternal;
        bankSource[d] = fromBank;
      });

    } catch (error) {
      console.error("[calculateSourceBreakdown] Error reconstructing internal pool:", error);
      // Fallback: allocate all from bank on error
      Object.entries(DENOM_VALUES).forEach(([key]) => {
        bankSource[key as keyof typeof bankSource] = loadDenoms[key as keyof typeof loadDenoms];
        internalSource[key as keyof typeof internalSource] = 0;
      });
    }

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
    // This reconstructs the authoritative internal pool from database events
    const sourceBreakdown = await calculateSourceBreakdown(denoms);

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

        {/* Source Matching Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p className="text-xs font-semibold text-blue-900 flex items-center gap-2">
            💡 Automatic Source Detection
          </p>
          <p className="text-xs text-blue-800">
            System matches ATM load denoms to removal plan:
          </p>
          <ul className="text-xs text-blue-800 space-y-1 ml-4">
            <li>✓ Denoms matching removal plan = Internal ATM Transfer</li>
            <li>✓ Excess beyond plan = Bank source</li>
            <li>✓ No plan = Bank source</li>
          </ul>
        </div>

        {/* Planned vs Live comparison */}
        {hasPlan && plannedDenoms ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500 font-semibold">
                    Planned Denominations (Reference)
                  </p>
                  <p className="text-xs text-slate-500">
                    For reference. Enter actual ATM load below.
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
                  Use Plan Values
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
