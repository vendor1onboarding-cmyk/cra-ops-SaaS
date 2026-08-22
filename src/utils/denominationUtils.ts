/**
 * Denomination Utilities
 * 
 * Handles calculation, validation, and normalization of denomination inputs.
 * Supports both "Notes" and "Bundles" input modes while maintaining backward compatibility.
 * 
 * Business Rule:
 * - 1 bundle = 100 notes
 * - User must enter EITHER notes OR bundles, NOT both
 * - Frontend normalizes to effective note count before persistence
 * - Database always stores note counts (unchanged)
 */

/**
 * Denomination validation result
 */
export interface DenominationValidation {
  valid: boolean;
  error?: string;
  effectiveNotes?: number;
}

/**
 * Validate and calculate effective notes from either notes or bundles input
 * 
 * Rules:
 * - If notes is entered: effective_notes = notes
 * - If bundles is entered: effective_notes = bundles * 100
 * - If both are entered: INVALID (return error)
 * - If neither: effective_notes = 0
 * 
 * @param notes - Number of individual notes (or 0/undefined if using bundles)
 * @param bundles - Number of bundles (or 0/undefined if using notes)
 * @returns Validation result with effective note count
 */
export function validateDenominationInput(
  notes: number | string | undefined | null,
  bundles: number | string | undefined | null
): DenominationValidation {
  // Convert to numbers safely
  const notesNum = parseFloat(String(notes || 0));
  const bundlesNum = parseFloat(String(bundles || 0));

  // Check for invalid values
  if (isNaN(notesNum) || isNaN(bundlesNum)) {
    return {
      valid: false,
      error: "Invalid number entered",
    };
  }

  // Check for negative values
  if (notesNum < 0 || bundlesNum < 0) {
    return {
      valid: false,
      error: "Notes and bundles must be non-negative",
    };
  }

  // Check for decimal values (must be whole numbers)
  if (!Number.isInteger(notesNum) || !Number.isInteger(bundlesNum)) {
    return {
      valid: false,
      error: "Notes and bundles must be whole numbers",
    };
  }

  // Check for both entered simultaneously
  if (notesNum > 0 && bundlesNum > 0) {
    return {
      valid: false,
      error: "Enter either Notes or Bundles, not both",
    };
  }

  // Calculate effective notes
  const effectiveNotes = notesNum > 0 ? notesNum : bundlesNum * 100;

  return {
    valid: true,
    effectiveNotes,
  };
}

/**
 * Calculate effective notes from notes and bundles
 * Returns 0 if both are 0 or if input is invalid
 * Throws or returns 0 on error (doesn't validate strictly like validateDenominationInput)
 * 
 * @param notes - Number of individual notes
 * @param bundles - Number of bundles
 * @returns Effective note count (always >= 0)
 */
export function calculateEffectiveNotes(
  notes: number | string | undefined | null,
  bundles: number | string | undefined | null
): number {
  const notesNum = Math.max(0, parseInt(String(notes || 0), 10) || 0);
  const bundlesNum = Math.max(0, parseInt(String(bundles || 0), 10) || 0);
  
  // Return notes if provided, otherwise bundles * 100
  return notesNum > 0 ? notesNum : bundlesNum * 100;
}

/**
 * Convert effective notes back to bundles for display
 * Returns the bundle count if the effective notes are divisible by 100
 * 
 * @param effectiveNotes - Total note count
 * @returns Bundle count, or 0 if not evenly divisible
 */
export function convertNotesToBundles(effectiveNotes: number): number {
  return effectiveNotes % 100 === 0 ? effectiveNotes / 100 : 0;
}

/**
 * Format denomination amount for display
 * 
 * @param count - Number of notes
 * @param denomination - Denomination value (100, 200, 500, 2000)
 * @returns Formatted currency string (e.g., "₹5,000")
 */
export function formatDenominationAmount(count: number, denomination: number): string {
  const amount = count * denomination;
  return `₹${amount.toLocaleString("en-IN")}`;
}

/**
 * Helper to get display representation of denomination input
 * Shows either "X notes" or "Y bundles" based on which was entered
 * 
 * @param effectiveNotes - The calculated effective note count
 * @param userInputNotes - What the user entered in notes field (for display preference)
 * @param userInputBundles - What the user entered in bundles field (for display preference)
 * @returns Display string
 */
export function getDenominationDisplayLabel(
  effectiveNotes: number,
  userInputNotes?: number | null,
  userInputBundles?: number | null
): string {
  if (!effectiveNotes) return "—";
  
  // If user entered bundles, show bundles representation
  if ((userInputBundles ?? 0) > 0) {
    const bundles = convertNotesToBundles(effectiveNotes);
    return bundles > 0 ? `${bundles} bundle${bundles !== 1 ? 's' : ''}` : `${effectiveNotes} notes`;
  }
  
  // Otherwise show notes
  return `${effectiveNotes} notes`;
}

/**
 * Normalize denomination values for database storage
 * Converts any representation to effective note count
 * 
 * @param input - Raw denomination value (already in notes format)
 * @returns Normalized note count
 */
export function normalizeDenominationForDB(input: number | string | null | undefined): number {
  const val = parseInt(String(input || 0), 10);
  return Math.max(0, isNaN(val) ? 0 : val);
}
