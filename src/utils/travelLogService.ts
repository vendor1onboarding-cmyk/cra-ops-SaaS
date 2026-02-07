import { supabase } from "../api/supabaseClient";
import { calculateDistanceWithFallback } from "./roadDistance";

/**
 * TravelLogService - Safe, isolated service for travel log operations
 * 
 * CRITICAL: This service is designed to NEVER block the calling flow.
 * All methods use try/catch with silent failure to prevent disruption
 * to primary business operations (e.g., ATM loads).
 * 
 * ENHANCED: Now uses road-based distance calculation (OSRM) with fallback to air distance.
 */

// Travel context: who initiated the travel session
export enum TravelContext {
  ATM = "ATM_TRAVEL",
  MANUAL = "MANUAL_TRAVEL",
}

const CONTEXT_STORAGE_KEY = "sruthi_travel_context";

interface GPSCoordinates {
  lat: number;
  lng: number;
}

interface TravelLogServiceOptions {
  assignmentId: number;
  custodianId: string;
  vehicleType?: string;
  ratePerKm?: number;
  odometerStart?: string;
  odometerEnd?: string;
  context?: TravelContext; // Who initiated this travel
}

class TravelLogService {
  /**
   * Get the current travel context (ATM vs MANUAL)
   */
  getTravelContext(): TravelContext | null {
    try {
      const stored = localStorage.getItem(CONTEXT_STORAGE_KEY);
      return stored as TravelContext | null;
    } catch {
      return null;
    }
  }

  /**
   * Set the travel context
   */
  private setTravelContext(context: TravelContext | null): void {
    try {
      if (context) {
        localStorage.setItem(CONTEXT_STORAGE_KEY, context);
      } else {
        localStorage.removeItem(CONTEXT_STORAGE_KEY);
      }
    } catch (error) {
      console.warn("[TravelLog] Failed to set context:", error);
    }
  }

  /**
   * Check if there's an active travel session for the given custodian
   * Returns true if active, false otherwise (or on error)
   */
  async hasActiveTravel(custodianId: string): Promise<boolean> {
    try {
      const { data } = await supabase
        .from("travel_logs")
        .select("id")
        .eq("custodian_id", custodianId)
        .eq("status", "in_progress")
        .maybeSingle();

      return !!data;
    } catch (error) {
      console.warn("[TravelLog] Failed to check active travel:", error);
      return false; // Assume no active travel on error (safe default)
    }
  }

  /**
   * Get GPS coordinates (best-effort)
   * Returns null on failure instead of throwing
   */
  private async getGPS(): Promise<GPSCoordinates | null> {
    try {
      return await new Promise<GPSCoordinates>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => reject(new Error("GPS unavailable")),
          { enableHighAccuracy: true, timeout: 10000 }
        );
      });
    } catch (error) {
      console.warn("[TravelLog] GPS acquisition failed:", error);
      return null;
    }
  }

  /**
   * Get vehicle rate from database (best-effort)
   */
  private async getVehicleRate(vehicleType: string): Promise<number> {
    try {
      const { data } = await supabase
        .from("vehicle_rates")
        .select("rate_per_km")
        .eq("vehicle_type", vehicleType)
        .maybeSingle();

      return data?.rate_per_km || 0;
    } catch (error) {
      console.warn("[TravelLog] Failed to get vehicle rate:", error);
      return 0;
    }
  }

  /**
   * Start a new travel log session
   * SAFE: Returns null on any failure without throwing
   */
  async startTravel(options: TravelLogServiceOptions): Promise<number | null> {
    try {
      const {
        assignmentId,
        custodianId,
        vehicleType = "bike",
        ratePerKm,
        odometerStart,
        context = TravelContext.MANUAL, // Default to manual if not specified
      } = options;

      // Check for existing active travel
      const hasActive = await this.hasActiveTravel(custodianId);
      if (hasActive) {
        console.warn("[TravelLog] Active travel already exists, skipping start");
        return null;
      }

      // Set context for this travel session
      this.setTravelContext(context);

      // Get GPS (best-effort)
      const gps = await this.getGPS();
      if (!gps) {
        console.warn("[TravelLog] Cannot start travel without GPS");
        return null;
      }

      // Get rate if not provided
      const rate = ratePerKm ?? (await this.getVehicleRate(vehicleType));

      const nowUTC = new Date().toISOString();

      const { data, error } = await supabase
        .from("travel_logs")
        .insert({
          assignment_id: assignmentId,
          custodian_id: custodianId,
          start_time: nowUTC,
          gps_start_lat: gps.lat,
          gps_start_lng: gps.lng,
          odometer_start: odometerStart || null,
          status: "in_progress",
          vehicle_type: vehicleType,
          rate_per_km: rate,
        })
        .select("id")
        .single();

      if (error) {
        console.warn("[TravelLog] Failed to insert travel start:", error);
        return null;
      }

      console.log("[TravelLog] Travel started successfully:", data.id);
      return data.id;
    } catch (error) {
      console.warn("[TravelLog] Start travel failed:", error);
      return null;
    }
  }

  /**
   * End the most recent active travel log session
   * SAFE: Returns false on any failure without throwing
   */
  async endTravel(
    custodianId: string,
    options?: { odometerEnd?: string }
  ): Promise<boolean> {
    try {
      // Find the active travel session
      const { data: activeTravel } = await supabase
        .from("travel_logs")
        .select("*")
        .eq("custodian_id", custodianId)
        .eq("status", "in_progress")
        .order("start_time", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!activeTravel) {
        console.warn("[TravelLog] No active travel to end");
        return false;
      }

      // Get GPS for end location (best-effort)
      const gpsEnd = await this.getGPS();
      if (!gpsEnd) {
        console.warn("[TravelLog] Cannot end travel without GPS");
        return false;
      }

      // Calculate distance using road-based routing (OSRM) with fallback to air distance
      const { distance: km, method, accuracy } = await calculateDistanceWithFallback(
        activeTravel.gps_start_lat,
        activeTravel.gps_start_lng,
        gpsEnd.lat,
        gpsEnd.lng
      );

      console.log(
        `[TravelLog] Distance calculated: ${km.toFixed(2)} km (method: ${method}, accuracy: ${accuracy})`
      );

      // Fallback to odometer if distance is too small
      let finalKm = km;
      if (
        km < 0.05 &&
        activeTravel.odometer_start &&
        options?.odometerEnd
      ) {
        finalKm = Number(options.odometerEnd) - Number(activeTravel.odometer_start);
        console.log(`[TravelLog] Using odometer distance: ${finalKm.toFixed(2)} km`);
      }

      // Minimum distance check
      if (finalKm < 0.05) {
        console.warn("[TravelLog] Distance too small, not ending travel");
        return false;
      }

      const allowance = finalKm * (activeTravel.rate_per_km || 0);
      const nowUTC = new Date().toISOString();

      const { error } = await supabase
        .from("travel_logs")
        .update({
          end_time: nowUTC,
          gps_end_lat: gpsEnd.lat,
          gps_end_lng: gpsEnd.lng,
          odometer_end: options?.odometerEnd || null,
          km_covered: finalKm,
          allowance_amount: allowance,
          status: "completed",
        })
        .eq("id", activeTravel.id);

      if (error) {
        console.warn("[TravelLog] Failed to update travel end:", error);
        return false;
      }

      // Clear context when travel ends
      this.setTravelContext(null);

      console.log("[TravelLog] Travel ended successfully:", activeTravel.id);
      return true;
    } catch (error) {
      console.warn("[TravelLog] End travel failed:", error);
      return false;
    }
  }

  /**
   * Calculate distance in kilometers using Haversine formula
   * @deprecated Use roadDistance.ts calculateDistanceWithFallback instead
   * Kept for backward compatibility and reference
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * End current travel and immediately start a new one
   * Useful for transitioning between sites
   * SAFE: Returns new travel ID or null on failure
   */
  async endAndStartTravel(
    custodianId: string,
    newTravelOptions: TravelLogServiceOptions
  ): Promise<number | null> {
    try {
      // Preserve current context before ending
      const currentContext = this.getTravelContext();
      
      // End current travel (this will clear context)
      await this.endTravel(custodianId);

      // Small delay to ensure transaction completes
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Start new travel with preserved context
      return await this.startTravel({
        ...newTravelOptions,
        context: newTravelOptions.context || currentContext || TravelContext.MANUAL,
      });
    } catch (error) {
      console.warn("[TravelLog] End and start travel failed:", error);
      return null;
    }
  }

  /**
   * Trigger a travel checkpoint: start if none active, otherwise chain
   * SAFE: Returns new travel ID or null on failure
   */
  async triggerCheckpoint(
    options: TravelLogServiceOptions
  ): Promise<number | null> {
    try {
      const hasActive = await this.hasActiveTravel(options.custodianId);

      if (!hasActive) {
        return await this.startTravel(options);
      }

      return await this.endAndStartTravel(options.custodianId, options);
    } catch (error) {
      console.warn("[TravelLog] Trigger checkpoint failed:", error);
      return null;
    }
  }
}

// Export singleton instance
export const travelLogService = new TravelLogService();
