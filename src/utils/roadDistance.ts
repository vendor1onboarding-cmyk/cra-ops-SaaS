/**
 * Road Distance Calculator using OSRM (Open Source Routing Machine)
 * 
 * OSRM provides free, open-source routing based on OpenStreetMap data.
 * This service calculates realistic road distances instead of straight-line GPS distances.
 * 
 * Features:
 * - Uses public OSRM demo instance (free, no API key required)
 * - Timeout protection (5 seconds)
 * - Automatic fallback to Haversine on failure
 * - Silent error handling (never blocks travel log)
 * 
 * Public OSRM Instance: https://router.project-osrm.org
 * Documentation: http://project-osrm.org/docs/v5.24.0/api/
 */

const OSRM_BASE_URL = "https://router.project-osrm.org";
const OSRM_TIMEOUT_MS = 5000; // 5 seconds

interface OSRMResponse {
  code: string;
  routes: Array<{
    distance: number; // meters
    duration: number; // seconds
  }>;
}

/**
 * Calculate road distance between two GPS coordinates using OSRM
 * 
 * @param lat1 Start latitude
 * @param lon1 Start longitude
 * @param lat2 End latitude
 * @param lon2 End longitude
 * @returns Distance in kilometers, or null on failure
 */
export async function calculateRoadDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<number | null> {
  try {
    // Validate coordinates
    if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
      console.warn("[RoadDistance] Invalid coordinates provided");
      return null;
    }

    // OSRM format: {lon},{lat};{lon},{lat}
    // Note: OSRM uses lon,lat (not lat,lon)
    const coordinates = `${lon1},${lat1};${lon2},${lat2}`;
    const url = `${OSRM_BASE_URL}/route/v1/driving/${coordinates}?overview=false&alternatives=false&steps=false`;

    // Fetch with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

    const response = await fetch(url, {
      method: "GET",
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.warn("[RoadDistance] OSRM API returned non-OK status:", response.status);
      return null;
    }

    const data: OSRMResponse = await response.json();

    if (data.code !== "Ok" || !data.routes || data.routes.length === 0) {
      console.warn("[RoadDistance] OSRM returned no routes");
      return null;
    }

    // Convert meters to kilometers
    const distanceKm = data.routes[0].distance / 1000;

    console.log(`[RoadDistance] Calculated: ${distanceKm.toFixed(2)} km`);
    return distanceKm;
  } catch (error: any) {
    // Silent failure - don't block travel log
    if (error.name === "AbortError") {
      console.warn("[RoadDistance] Request timeout (> 5s)");
    } else {
      console.warn("[RoadDistance] Failed to calculate road distance:", error.message);
    }
    return null;
  }
}

/**
 * Calculate distance with intelligent fallback strategy
 * 
 * Strategy:
 * 1. Try OSRM road distance (best accuracy)
 * 2. If OSRM fails, use Haversine air distance (fallback)
 * 3. Never return null (always returns a distance)
 * 
 * @param lat1 Start latitude
 * @param lon1 Start longitude
 * @param lat2 End latitude
 * @param lon2 End longitude
 * @returns Object with distance, method used, and accuracy indicator
 */
export async function calculateDistanceWithFallback(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): Promise<{
  distance: number;
  method: "road" | "air";
  accuracy: "high" | "medium";
}> {
  // Try road distance first
  const roadDistance = await calculateRoadDistance(lat1, lon1, lat2, lon2);

  if (roadDistance !== null && roadDistance > 0) {
    return {
      distance: roadDistance,
      method: "road",
      accuracy: "high",
    };
  }

  // Fallback to air distance
  console.warn("[RoadDistance] Using Haversine fallback");
  const airDistance = calculateHaversineDistance(lat1, lon1, lat2, lon2);

  return {
    distance: airDistance,
    method: "air",
    accuracy: "medium",
  };
}

/**
 * Haversine formula for straight-line distance (fallback)
 * 
 * @param lat1 Start latitude
 * @param lon1 Start longitude
 * @param lat2 End latitude
 * @param lon2 End longitude
 * @returns Distance in kilometers
 */
function calculateHaversineDistance(
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
 * Validate GPS coordinates
 */
function isValidCoordinate(lat: number, lon: number): boolean {
  return (
    typeof lat === "number" &&
    typeof lon === "number" &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180
  );
}

/**
 * Calculate estimated road distance multiplier based on urban vs rural
 * This is a heuristic approach when OSRM is unavailable
 * 
 * Typical road distance vs air distance:
 * - Urban areas: 1.3x - 1.5x (many turns, one-way streets)
 * - Rural areas: 1.1x - 1.2x (straighter roads)
 * 
 * This function applies a conservative 1.25x multiplier to air distance
 * 
 * @param airDistance Air distance in km
 * @returns Estimated road distance in km
 */
export function estimateRoadDistanceFromAir(airDistance: number): number {
  const ROAD_MULTIPLIER = 1.25; // Conservative estimate
  return airDistance * ROAD_MULTIPLIER;
}
