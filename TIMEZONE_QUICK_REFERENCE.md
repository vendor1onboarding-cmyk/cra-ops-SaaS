# Timezone Utilities Quick Reference

**For Developers**: Quick guide to using timezone functions in the Sruthi CRA project.

## 🚀 Quick Start

### Import the utilities
```typescript
import { 
  getISTDateString, 
  getISTMonthStart, 
  formatIST, 
  formatISTDate 
} from "../utils/time";
```

---

## 📍 When to Use Each Function

### For Database Queries (Filtering by Date)

**Get Today's Date** (for today's assignment)
```typescript
const today = getISTDateString();
.eq("assignment_date", today)
```

**Get Month Start** (for SOA reports, monthly summaries)
```typescript
const fromDate = getISTMonthStart();
.gte("assignment_date", fromDate)
```

---

### For Displaying Dates to Users

**Date Only** (short format)
```typescript
{formatISTDate(row.assignment_date, "short")}
// Output: "26/01/2026"
```

**Date Only** (long format)
```typescript
{formatISTDate(row.date, "long")}
// Output: "26 Jan 2026"
```

**Full Timestamp with Time and Timezone**
```typescript
{formatIST(record.created_at)}
// Output: "26 Jan 2026, 02:30 PM IST"
```

**Audit Trail Format**
```typescript
{formatISTAudit(record.created_at)}
// Output: "26 Jan 2026 at 02:30 PM"
```

**Relative Time** (activity feed)
```typescript
{getRelativeTime(record.created_at)}
// Output: "2 hours ago", "5 minutes ago"
```

---

### For Comparisons and Logic

**Check if Date is Today**
```typescript
if (isTodayIST(record.date)) {
  // Record is from today
}
```

**Check if Two Dates are Same Day**
```typescript
if (isSameDayIST(date1, date2)) {
  // Same day in IST timezone
}
```

**Get Timezone Info String** (for UI)
```typescript
<small>All times shown in {getTimeZoneInfo()}</small>
// Output: "IST (UTC+5:30)"
```

---

## ⚠️ Important Rules

### ✅ DO
- ✅ Use `getISTDateString()` when querying by date
- ✅ Use `formatIST()` when displaying timestamps
- ✅ Use `formatISTDate()` when displaying dates
- ✅ Store dates as `new Date().toISOString()` in database (UTC)
- ✅ Use utility functions in all new code

### ❌ DON'T
- ❌ Use `new Date().toISOString().slice(0, 10)` for date queries
- ❌ Use `toLocaleDateString()` for date display
- ❌ Use `toLocaleString()` for timestamp display
- ❌ Do manual date calculations (month, year, etc.)
- ❌ Forget to import timezone utilities

---

## 📚 Complete Function List

| Function | Returns | Use Case |
|----------|---------|----------|
| `getISTDateString()` | "2026-01-26" | Query today's assignments |
| `getISTMonthStart()` | "2026-01-01" | Query month-based data |
| `formatIST()` | "26 Jan 2026, 02:30 PM IST" | Display timestamps |
| `formatISTDate()` | "26/01/2026" or "26 Jan 2026" | Display dates only |
| `formatISTTime()` | "02:30 PM IST" | Display time only |
| `formatISTAudit()` | "26 Jan 2026 at 02:30 PM" | Audit logs |
| `getRelativeTime()` | "2 hours ago" | Activity feeds |
| `isTodayIST()` | true/false | Check if date is today |
| `isSameDayIST()` | true/false | Compare two dates |
| `getTimeZoneInfo()` | "IST (UTC+5:30)" | Show timezone context |
| `convertUTCToIST()` | Date object | Internal calculations |
| `convertISTToUTC()` | ISO string | Convert for storage |

---

## 🎯 Real-World Examples

### Example 1: Load Today's Assignment
```typescript
import { getISTDateString } from "../utils/time";

async function loadAssignment() {
  const today = getISTDateString();
  const { data: assignment } = await supabase
    .from("assignments")
    .select("*")
    .eq("custodian_id", userId)
    .eq("assignment_date", today)
    .maybeSingle();
  
  return assignment;
}
```

### Example 2: Display Assignment with Date
```typescript
import { formatISTDate } from "../utils/time";

export function AssignmentRow({ assignment }: { assignment: any }) {
  return (
    <tr>
      <td>{formatISTDate(assignment.assignment_date, "short")}</td>
      <td>{assignment.custodian_name}</td>
      <td>{assignment.route_name}</td>
    </tr>
  );
}
```

### Example 3: Show Created Timestamp with Timezone
```typescript
import { formatIST } from "../utils/time";

export function AuditTrail({ record }: { record: any }) {
  return (
    <div className="text-sm text-gray-600">
      Created by {record.created_by.name} on {formatIST(record.created_at)}
    </div>
  );
}
```

### Example 4: Month-Based Report
```typescript
import { getISTDateString, getISTMonthStart } from "../utils/time";

async function getMonthlyReport() {
  const today = getISTDateString();
  const monthStart = getISTMonthStart();
  
  const { data: records } = await supabase
    .from("assignments")
    .select("*")
    .gte("assignment_date", monthStart)
    .lte("assignment_date", today);
  
  return records;
}
```

### Example 5: Highlight Today's Items
```typescript
import { isTodayIST, formatISTDate } from "../utils/time";

export function ItemList({ items }: { items: any[] }) {
  return (
    <div>
      {items.map(item => (
        <div key={item.id} className={isTodayIST(item.date) ? 'bg-blue-50' : ''}>
          <span>{formatISTDate(item.date, "long")}</span>
          {isTodayIST(item.date) && <Badge>Today</Badge>}
        </div>
      ))}
    </div>
  );
}
```

---

## 🔧 Troubleshooting

### Problem: Date is off by one day
```typescript
// ❌ WRONG
const today = new Date().toISOString().slice(0, 10);
// Might show wrong date if browser is not in IST

// ✅ CORRECT
const today = getISTDateString();
// Always IST regardless of browser timezone
```

### Problem: Timestamp doesn't show timezone
```typescript
// ❌ WRONG
{new Date(timestamp).toLocaleString()}
// Output: "26/1/2026, 2:30:45 PM" (no timezone)

// ✅ CORRECT
{formatIST(timestamp)}
// Output: "26 Jan 2026, 02:30 PM IST"
```

### Problem: Inconsistent date formats across pages
```typescript
// ❌ WRONG
Page 1: {record.date}  // Shows "2026-01-26"
Page 2: {new Date(record.date).toLocaleDateString()}  // Shows "1/26/2026"
Page 3: {new Date(record.date).toLocaleString()}  // Shows "1/26/2026, 12:00:00 AM"

// ✅ CORRECT
All pages: {formatISTDate(record.date, "short")}  // Shows "26/01/2026"
```

---

## 📞 Help & Support

**For more details**: See [TIMEZONE_FIX_IMPLEMENTATION_SUMMARY.md](TIMEZONE_FIX_IMPLEMENTATION_SUMMARY.md)

**For utility documentation**: See [src/utils/time.ts](src/utils/time.ts)

**For implementation examples**: Check any of these pages:
- [src/pages/StatementOfAccounts.tsx](src/pages/StatementOfAccounts.tsx)
- [src/pages/AdminSOAAdjustments.tsx](src/pages/AdminSOAAdjustments.tsx)
- [src/pages/AdminDashboard.tsx](src/pages/AdminDashboard.tsx)
- [src/pages/EODSummary.tsx](src/pages/EODSummary.tsx)

---

**Keep these rules in mind and you'll always have correct timezone handling! 🎯**
