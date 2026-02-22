// =====================================
// TIMEZONE CONSTANTS
// =====================================
const IST_TIMEZONE = "Asia/Kolkata"; // UTC+5:30, no DST
const IST_OFFSET_HOURS = 5.5; // 5 hours 30 minutes
const IST_OFFSET_MS = IST_OFFSET_HOURS * 60 * 60 * 1000;

// =====================================
// DATABASE LAYER (Always UTC)
// =====================================

/**
 * Get current date in IST and return as YYYY-MM-DD string for database queries
 * Database stores dates in UTC, but assignments are date-only
 * This function returns the date in IST timezone for correct date-based filtering
 *
 * @returns Date string in YYYY-MM-DD format (IST timezone)
 */
export function getISTDateString(): string {
  const now = new Date();
  const istDate = new Date(now.getTime() + IST_OFFSET_MS);
  return istDate.toISOString().split("T")[0];
}

/**
 * Get first day of current month in IST as YYYY-MM-DD string
 * @returns Date string in YYYY-MM-DD format
 */
export function getISTMonthStart(): string {
  const istDate = new Date(new Date().getTime() + IST_OFFSET_MS);
  const year = istDate.getUTCFullYear();
  const month = istDate.getUTCMonth();
  const firstDay = new Date(year, month, 1);
  const istFirstDay = new Date(firstDay.getTime() + IST_OFFSET_MS);
  return istFirstDay.toISOString().split("T")[0];
}

/**
 * Convert UTC timestamp to IST Date object
 * Useful for date arithmetic and display
 *
 * @param utcDate - Date string or Date object in UTC
 * @returns Date object adjusted to IST
 */
export function convertUTCToIST(utcDate: string | Date): Date {
  const date = typeof utcDate === "string" ? new Date(utcDate) : utcDate;
  return new Date(date.getTime() + IST_OFFSET_MS);
}

/**
 * Convert IST Date to UTC timestamp for database storage
 * Database always stores timestamps in UTC
 *
 * @param istDate - Date object in IST
 * @returns ISO string in UTC for database
 */
export function convertISTToUTC(istDate: Date): string {
  return new Date(istDate.getTime() - IST_OFFSET_MS).toISOString();
}

// =====================================
// DISPLAY LAYER (IST Timezone)
// =====================================

/**
 * Format timestamp for display (Full date + time with timezone)
 * Shows: "26 Jan 2026, 02:30 PM IST"
 * Used for: adjustment times, audit trails, exact timestamps
 *
 * @param date - Date string or Date object
 * @returns Formatted string with date and time
 */
export function formatIST(date: string | Date): string {
  if (!date) return "";
  
  // Parse UTC date properly if it's a string
  let dateObj: Date;
  if (typeof date === "string") {
    const parsed = parseUTCDate(date);
    if (!parsed) return "";
    dateObj = parsed;
  } else {
    dateObj = date;
  }
  
  return dateObj.toLocaleString("en-IN", {
    timeZone: IST_TIMEZONE,
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Normalize a UTC timestamp string into a Date object.
 * Handles Postgres-style timestamps like "YYYY-MM-DD HH:MM:SS+00".
 */
export function parseUTCDate(value: string | Date): Date | null {
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  let normalized = raw.includes("T") ? raw : raw.replace(" ", "T");

  // Normalize timezone offsets: +00 -> +00:00, +0000 -> +00:00
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`;
  } else if (/[+-]\d{4}$/.test(normalized)) {
    normalized = normalized.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  }

  const hasTzSuffix = /[zZ]|[+-]\d{2}:\d{2}$/.test(normalized);
  if (!hasTzSuffix) {
    normalized = `${normalized}Z`;
  }

  const parsed = new Date(normalized);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Format a UTC timestamp for IST display, even if the input has no timezone.
 * If the string lacks a timezone suffix, treat it as UTC.
 */
export function formatISTFromUTC(date: string | Date): string {
  const parsed = parseUTCDate(date);
  if (!parsed) return "";
  return formatIST(parsed);
}

/**
 * Format timestamps that are stored as IST values but encoded as UTC (Z).
 * Use for ATM load times captured on the client with IST offset applied.
 */
export function formatISTFromISTEncodedUTC(date: string | Date): string {
  if (!date) return "";
  const parsed = parseUTCDate(date);
  if (!parsed) return "";
  return parsed.toLocaleString("en-IN", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format date only for display (without time)
 * Shows: "26 Jan 2026" or "26/01/2026"
 * Used for: assignment_date, transaction dates, date-only displays
 *
 * @param date - Date string or Date object
 * @param format - "long" for "26 Jan 2026" or "short" for "26/01/2026"
 * @returns Formatted date string
 */
export function formatISTDate(
  date: string | Date,
  format: "long" | "short" = "long"
): string {
  if (!date) return "";
  
  // Parse UTC date properly if it's a string
  let dateObj: Date;
  if (typeof date === "string") {
    const parsed = parseUTCDate(date);
    if (!parsed) return "";
    dateObj = parsed;
  } else {
    dateObj = date;
  }
  
  if (format === "short") {
    return dateObj.toLocaleDateString("en-IN", {
      timeZone: IST_TIMEZONE,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  return dateObj.toLocaleDateString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Format time only for display
 * Shows: "02:30 PM IST"
 * Used for: pickup_time, load_time, timestamp displays
 *
 * @param date - Date string or Date object
 * @returns Formatted time string
 */
export function formatISTTime(date: string | Date): string {
  if (!date) return "";
  
  // Parse UTC date properly if it's a string
  let dateObj: Date;
  if (typeof date === "string") {
    const parsed = parseUTCDate(date);
    if (!parsed) return "";
    dateObj = parsed;
  } else {
    dateObj = date;
  }
  
  return dateObj.toLocaleString("en-IN", {
    timeZone: IST_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format for audit log display
 * Shows: "26 Jan 2026 at 02:30 PM"
 * Used for: "Posted by Admin on 26 Jan 2026 at 02:30 PM"
 *
 * @param date - Date string or Date object
 * @returns Formatted audit log string
 */
export function formatISTAudit(date: string | Date): string {
  if (!date) return "";
  
  // Parse UTC date properly if it's a string
  let dateObj: Date;
  if (typeof date === "string") {
    const parsed = parseUTCDate(date);
    if (!parsed) return "";
    dateObj = parsed;
  } else {
    dateObj = date;
  }
  
  return dateObj.toLocaleString("en-IN", {
    timeZone: IST_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Get relative time display
 * Shows: "2 hours ago", "Yesterday", "3 days ago"
 * Used for: quick status indicators
 *
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function getRelativeTime(date: string | Date): string {
  const dateObj = new Date(date);
  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
  return formatISTDate(dateObj, "short");
}

// =====================================
// COMPARISON & FILTERING (Date-only)
// =====================================

/**
 * Check if two dates are the same day (in IST)
 * Used for: date-based filtering, comparing assignment dates
 *
 * @param date1 - First date
 * @param date2 - Second date
 * @returns true if both dates are the same day in IST
 */
export function isSameDayIST(date1: string | Date, date2: string | Date): boolean {
  const d1 = formatISTDate(date1, "short");
  const d2 = formatISTDate(date2, "short");
  return d1 === d2;
}

/**
 * Check if date is today (in IST)
 * Used for: "today's transactions", EOD validation
 *
 * @param date - Date to check
 * @returns true if date is today in IST
 */
export function isTodayIST(date: string | Date): boolean {
  return isSameDayIST(date, new Date());
}

/**
 * Format time offset display
 * Shows: "IST (UTC+5:30)"
 * Used for: informational displays, time zone indicators
 *
 * @returns Timezone offset string
 */
export function getTimeZoneInfo(): string {
  return "IST (UTC+5:30)";
}