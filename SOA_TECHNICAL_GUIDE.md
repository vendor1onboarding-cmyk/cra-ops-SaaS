# 🛠️ SOA Pages - Technical Implementation Guide

## 📦 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    APP.TSX (Routing)                        │
├─────────────────────────────────────────────────────────────┤
│  /soa (PrivateRoute)          /admin/soa-adjustments        │
│  ↓                            ↓                             │
│  StatementOfAccounts          AdminSOAAdjustments           │
│  (Shared Page)                (Admin Only)                  │
└─────────────────────────────────────────────────────────────┘
         ↓                              ↓
    ┌─────────────┐            ┌──────────────────┐
    │ v_soa_      │            │ v_soa_effective  │
    │ effective   │            │ (select) +       │
    │ (view)      │            │ soa_adjustments  │
    └─────────────┘            │ (insert)         │
         ↓                      └──────────────────┘
    Supabase                         Supabase
    PostgreSQL                       PostgreSQL
```

---

## 📁 File Structure

```
src/
├── pages/
│   ├── StatementOfAccounts.tsx       (534 lines)
│   └── AdminSOAAdjustments.tsx        (492 lines)
├── context/
│   └── AuthContext.tsx               (profile + role)
├── components/
│   ├── Layout.tsx                    (navigation + menus)
│   └── RequireAdmin.tsx               (role guard)
├── api/
│   └── supabaseClient.ts             (database client)
└── App.tsx                           (routing)
```

---

## 🔄 Data Flow

### StatementOfAccounts Page

```
Component Mount
    ↓
useEffect triggers
    ↓
Profile loaded?
    ├─ No → Return empty
    └─ Yes → Continue
    ↓
Build query
    ├─ Base: v_soa_effective view
    ├─ Filter: date range (fromDate → toDate)
    ├─ Admin? Add custodian:custodian_id(full_name) to select
    └─ Custodian? Add eq("custodian_id", profile.id)
    ↓
Execute query
    ├─ Error? → Show error message
    └─ Success? → Process data
    ↓
Process Response
    ├─ Map custodian relationship to full_name
    └─ Set state with processed data
    ↓
Calculate Totals (useMemo)
    ├─ Sum: cash_picked
    ├─ Sum: cash_loaded
    ├─ Sum: travel_allowance
    └─ Sum: final_net_cash_position
    ↓
Render
    ├─ KPI Cards (totals)
    └─ Table (individual records)
```

### AdminSOAAdjustments Page

```
Component Mount
    ↓
useEffect triggers
    ↓
Is Admin/Supervisor?
    ├─ No → Show access denied
    └─ Yes → Continue
    ↓
Load SOA List
    ├─ Query: v_soa_effective
    ├─ Join: custodian relationship for names
    └─ Order: assignment_date DESC
    ↓
User Interaction
    ├─ Select SOA from dropdown
    ├─ Review adjustment history (EXCHANGE, INTER_SITE_TRANSFER)
    └─ Optionally include legacy CREDIT/DEBIT (read-only audit)
```

---

## 💾 Database Queries

### StatementOfAccounts - Query Structure

```typescript
// Base query for all users
supabase
  .from("v_soa_effective")
  .select(`
    soa_id,
    assignment_date,
    cash_picked,
    cash_loaded,
    excess_reported,
    travel_km,
    travel_allowance,
    final_net_cash_position,
    posted_at,
    custodian_id
    ${isAdmin ? ",custodian:custodian_id(full_name)" : ""}
  `)
  .gte("assignment_date", fromDate)        // From date filter
  .lte("assignment_date", toDate)          // To date filter
  .order("assignment_date", { ascending: false })

// If Custodian: Add isolation
if (profile.role === "custodian") {
  query = query.eq("custodian_id", profile.id);
}
```

### AdminSOAAdjustments - Query Structure

```typescript
// Load available SOA records
supabase
  .from("v_soa_effective")
  .select(`
    id,
    assignment_id,
    custodian_id,
    assignment_date,
    final_net_cash_position,
    custodian:custodian_id(full_name)
  `)
  .order("assignment_date", { ascending: false })

// Load adjustment history (operational only, legacy optional)
supabase
  .from("soa_adjustments")
  .select(`
    id,
    assignment_id,
    custodian_id,
    adjustment_type,
    adjustment_amount,
    reason,
    reference,
    created_at,
    created_by,
    exchange_metadata,
    transfer_metadata
  `)
  .in("adjustment_type", ["EXCHANGE", "INTER_SITE_TRANSFER"])
  .order("created_at", { ascending: false })
```

---

## 🎯 State Management

### StatementOfAccounts State

```typescript
// Data
const [rows, setRows] = useState<SOARow[]>([]);        // Records
const [fromDate, setFromDate] = useState(string);      // Filter start
const [toDate, setToDate] = useState(string);          // Filter end

// UI
const [loading, setLoading] = useState(true);          // Loading state
const [error, setError] = useState<string | null>      // Error message

// Computed
const totals = useMemo(() => {
  // Calculate sums from rows
}, [rows]);

// Derived
const isAdmin = profile?.role === "admin" || "supervisor";
```

### AdminSOAAdjustments State

```typescript
// Data
const [soaList, setSoaList] = useState<SOA[]>([]);     // Available SOAs
const [selectedSOA, setSelectedSOA] = useState(null);  // Selected record

// Form
const [amount, setAmount] = useState("");              // Adjustment amount
const [reason, setReason] = useState("");              // Reason text
const [reference, setReference] = useState("");        // Reference ID

// UI
const [loading, setLoading] = useState(false);         // Submitting
const [initialLoad, setInitialLoad] = useState(true);  // Loading data
const [error, setError] = useState<string | null>      // Error message
const [successMessage, setSuccessMessage] = useState(null); // Success
const [showPreview, setShowPreview] = useState(false);  // Preview mode

// Computed
const parsedAmount = Number(amount || 0);              // Parsed number
const isValidAmount = (...);                           // Validation
const isValidReason = (...);                           // Validation
const canSubmit = (...);                               // Can submit?
const previewNetPosition = useMemo(() => {...}, ...);  // Calculate new position
```

---

## ✅ Validation Rules

### Filter Validation
```typescript
// Valid: Type filter matches allowed values
const allowedTypes = ["ALL", "EXCHANGE", "INTER_SITE_TRANSFER", "CREDIT", "DEBIT"];
const isValidType = allowedTypes.includes(typeFilter);

// Legacy visibility
// CREDIT/DEBIT are only shown when includeLegacyAdjustments === true
```

---

## 🎨 Component Structure

### KPI Component (StatementOfAccounts)
```typescript
<KPI
  label="Cash Picked"
  value={totals.cashPicked}
  subtext="₹"
  color="blue"
  highlight={false}
/>

// Props
interface KPIProps {
  label: string;           // "Cash Picked"
  value: number;           // 50000
  subtext?: string;        // "₹"
  color?: keyof typeof colorClasses;  // "blue"
  highlight?: boolean;     // false
}

// Renders
<div className="rounded-lg border p-4 bg-blue-50 border-blue-200">
  <p className="text-xs text-slate-600 mb-1 font-medium">
    {label}
  </p>
  <div className="flex items-baseline gap-1">
    {subtext && <span className="text-xs text-blue-700">₹</span>}
    <p className="text-lg sm:text-xl font-bold text-blue-700">
      {value.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
    </p>
  </div>
</div>
```

---

## 📱 Responsive Breakpoints

### Mobile (< 768px)
- KPI Grid: 2 columns → 1 column (stacked)
- Buttons: Full width
- Table: Horizontal scroll
- Filters: Stacked vertically

### Tablet (768px - 1024px)
- KPI Grid: 2-4 columns dynamic
- Buttons: Side by side (wrap)
- Table: Responsive columns
- Filters: Multi-line layout

### Desktop (> 1024px)
- KPI Grid: 4 columns
- Buttons: Full width row
- Table: All columns visible
- Filters: Single row

---

## 🔐 Access Control

### Route Guards

```typescript
// StatementOfAccounts
<Route path="/soa" element={
  <PrivateRoute>
    <StatementOfAccounts />
  </PrivateRoute>
}/>

// PrivateRoute checks:
✓ User is authenticated
✓ Profile is loaded
✓ Redirects to /login if not


// AdminSOAAdjustments
<Route path="/admin/soa-adjustments" element={
  <RequireAdmin>
    <AdminSOAAdjustments />
  </RequireAdmin>
}/>

// RequireAdmin checks:
✓ User role is "admin" OR "supervisor"
✓ Redirects to "/" if not admin
```

### Data Isolation

```typescript
// Custodian sees only own data
if (profile.role === "custodian") {
  query = query.eq("custodian_id", profile.id);
}

// Admin sees all data
// (no custodian_id filter added)
```

---

## 🚨 Error Handling Strategy

### Try-Catch Blocks
```typescript
try {
  // Main logic
  const { data, error } = await query;
  
  if (error) {
    setError("User-friendly message");
    console.error("Query Error:", error);
    setRows([]);
  } else {
    // Process success
  }
} catch (err) {
  setError("An unexpected error occurred.");
  console.error("Unexpected Error:", err);
  setRows([]);
} finally {
  setLoading(false);
}
```

### Error States in UI
```typescript
{error && (
  <div className="rounded-lg bg-red-50 border border-red-200 p-4">
    <p className="text-sm text-red-700 font-medium">⚠️ {error}</p>
  </div>
)}
```

---

## 💡 Performance Optimizations

### useMemo for Calculations
```typescript
// Only recalculate when rows change
const totals = useMemo(() => {
  return rows.reduce((acc, r) => {
    acc.cashPicked += r.cash_picked;
    // ... more calculations
    return acc;
  }, { ... });
}, [rows]);  // Only dependency
```

### useEffect Dependencies
```typescript
useEffect(() => {
  // Load SOA when profile or dates change
  loadSOA();
}, [profile, fromDate, toDate, isAdmin]);  // Specific deps
```

### No Unnecessary Re-renders
- State is minimal
- Derived values use useMemo
- Callbacks are inline (simple functions)

---

## 🧪 Testing Scenarios

### StatementOfAccounts Tests

```typescript
describe("StatementOfAccounts", () => {
  // Load & Display
  test("Should load SOA for custodian");
  test("Should load SOA for admin");
  test("Should filter by date range");
  test("Should show error on load failure");
  
  // Role Isolation
  test("Custodian should see only own records");
  test("Admin should see all records");
  test("Admin should see custodian names");
  
  // Calculations
  test("Should calculate correct totals");
  test("Should format numbers in INR");
  
  // Export
  test("Should export CSV with correct data");
  test("CSV should have correct headers");
  
  // Print
  test("Should display print format");
  test("Should show signature lines");
  
  // Responsive
  test("Should be mobile responsive");
  test("Should show table scroll on mobile");
});
```

### AdminSOAAdjustments Tests

```typescript
describe("AdminSOAAdjustments", () => {
  // Access Control
  test("Should deny access to non-admins");
  test("Should allow access to admins");
  test("Should allow access to supervisors");
  
  // Loading
  test("Should load SOA records");
  test("Should show custodian names");
  
  // Selection
  test("Should update on SOA selection");
  test("Should show selected SOA details");
  
  // Validation
  test("Amount should validate as non-zero");
  test("Reason should validate as non-empty");
  test("Submit should be disabled when invalid");
  
  // Preview
  test("Should calculate new position correctly");
  test("Should show preview on click");
  test("Should hide preview on click");
  
  // Submission
  test("Should submit valid adjustment");
  test("Should show success message");
  test("Should handle submission error");
  test("Should reload page after success");
});
```

---

## 📋 Deployment Checklist

- [ ] Code compiles without TypeScript errors
- [ ] All imports are correct
- [ ] Database queries use correct table/view names
- [ ] Foreign key relationships are correct
- [ ] Error messages are user-friendly
- [ ] Loading states are visible
- [ ] Mobile responsive design works
- [ ] Print layout looks good
- [ ] CSV export has correct format
- [ ] Number formatting uses INR locale
- [ ] Access control rules are enforced
- [ ] Role isolation works correctly
- [ ] Success/error messages display properly
- [ ] Page reloads work correctly
- [ ] No console errors on page load
- [ ] No console errors on user interaction

---

## 📞 Troubleshooting Guide

### "ParserError: Unexpected input"
- **Cause**: Malformed select string in Supabase query
- **Solution**: Check quote matching, proper syntax
- **Prevention**: Use single template string with conditional

### "Cannot read property 'full_name'"
- **Cause**: Custodian relationship returns null
- **Solution**: Map data: `row.custodian?.full_name`
- **Prevention**: Use optional chaining (?.)

### "amount is not defined"
- **Cause**: setAmount not called before using
- **Solution**: Initialize state with empty string
- **Prevention**: Always initialize all state

### Button stays disabled after filling form
- **Cause**: canSubmit dependencies incomplete
- **Solution**: Check all validation conditions
- **Prevention**: Review all state dependencies

### Page doesn't reload after submission
- **Cause**: setTimeout not called or timing wrong
- **Solution**: Set timeout to 2000ms (2 seconds)
- **Prevention**: Add sufficient delay for user feedback

---

**Version**: 1.0
**Last Updated**: January 26, 2026
**Status**: Production Ready ✅
