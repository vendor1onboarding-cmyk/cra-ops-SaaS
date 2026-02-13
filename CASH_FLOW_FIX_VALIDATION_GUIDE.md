# CASH FLOW LOGIC FIX - VALIDATION GUIDE

## Quick Test Scenario

### Setup Test Data

1. **Bank Pickup**: ₹500
   - Create a bank cash pickup with ₹500

2. **Bank Load (ATM1)**: ₹300
   - Load ₹300 into ATM1 using bank source

3. **ATM Internal Removal (ATM2)**: ₹200
   - Remove ₹200 from ATM2 (internal pickup)

4. **Internal Load (ATM3)**: ₹200
   - Load ₹200 into ATM3 using internal source (from ATM2)

---

## Expected Results Across All Pages

### 1. Dashboard (`/`)
```
Cash Summary:
├─ Picked: ₹500
├─ Loaded: ₹300
├─ In Hand: ₹200 ✅
└─ Internal Transfers: ₹200

Denomination-wise:
├─ Picked: (bank only)
├─ Loaded: (bank only)
└─ In Hand: (bank - bank)
```

**Validation Points**:
- [ ] "Picked" shows ₹500 (bank only)
- [ ] "Loaded" shows ₹300 (bank only, NOT ₹500)
- [ ] "In Hand" shows ₹200 (positive, NOT negative)
- [ ] "Internal Transfers" shows ₹200 (informational)

---

### 2. EOD Summary (`/eod-summary`)
```
Cash Reconciliation:
├─ Bank Picked: ₹500
├─ Bank Loaded: ₹300
├─ Cash in Hand: ₹200 ✅
└─ Internal Transfer Total: ₹200 (neutral)

Closing Status:
└─ Unbalanced: NO (₹200 in hand is expected)
```

**Validation Points**:
- [ ] "Bank Picked" shows ₹500
- [ ] "Bank Loaded" shows ₹300 (NOT ₹500)
- [ ] "Cash in Hand" shows ₹200 (NOT -₹200)
- [ ] Internal transfers shown separately
- [ ] No false "unbalanced" warning

---

### 3. Statement of Accounts (`/soa`)
```
Summary View:
├─ Total Picked: ₹500
├─ Bank Loaded: ₹300
├─ Internal Transfers: ₹200
└─ Final Net: ₹0 (after submitting remaining cash)

Totals Row:
├─ Bank Picked: ₹500
├─ Bank Loaded: ₹300
├─ Internal Picked: ₹200
├─ Internal Loaded: ₹200
└─ Net Position: ₹200 ✅
```

**Validation Points**:
- [ ] "Bank Loaded" column shows ₹300 (NOT ₹500)
- [ ] "Internal Loaded" shown separately
- [ ] Final net calculation uses bank cash only
- [ ] Totals row excludes internal from net

---

### 4. Admin EOD Detail (`/admin/eod/<id>`)
```
Summary:
├─ Total Picked: ₹500
├─ Total Loaded: ₹300
├─ Cash in Hand: ₹200 ✅
└─ Closing Unbalanced: NO

Transaction Log:
├─ Bank Pickup: ₹500 (Credit)
├─ ATM Load (bank): ₹300 (Debit)
├─ ATM Internal Pickup: ₹200 (Credit)
└─ ATM Load (internal): ₹200 (Debit)
```

**Validation Points**:
- [ ] "Total Picked" shows ₹500 (bank only)
- [ ] "Total Loaded" shows ₹300 (bank only)
- [ ] "Cash in Hand" shows ₹200 (NOT -₹200)
- [ ] Internal transactions visible but separate

---

### 5. Advanced Analytics (`/analytics`)
```
KPI Metrics:
├─ Cash Picked: ₹500
├─ Cash Loaded: ₹300 ✅ (bank only, NOT ₹500)
├─ Avg Net Position: ₹200
└─ Total Loads: 2 sites (physical count)
```

**Validation Points**:
- [ ] "Cash Loaded" KPI shows ₹300 (bank deployment only)
- [ ] KPI does NOT show ₹500 (no inflation from internal transfers)
- [ ] Monthly totals use bank cash only

---

## Critical Validation Checks

### ✅ PASS Criteria

1. **Cash-in-Hand is NEVER negative** when:
   - Bank picked = Bank loaded: Cash-in-Hand = 0
   - Bank picked > Bank loaded: Cash-in-Hand = positive
   - Internal transfers exist: Does NOT affect Cash-in-Hand

2. **Internal Transfer Net = 0**:
   - Internal Picked = Internal Loaded
   - No net impact on financial position

3. **KPI "Total Loaded" = Bank Loads Only**:
   - Does NOT include internal ATM-to-ATM movements
   - Reflects actual bank cash deployment

4. **SOA Closing Balance = Bank Cash Flow**:
   - Opening + Bank Picked - Bank Loaded = Closing
   - Internal transfers excluded

### ❌ FAIL Indicators

- Cash-in-Hand showing negative when it shouldn't be
- "Total Loaded" showing inflated values (e.g., ₹700 instead of ₹500)
- Internal transfers affecting financial reconciliation
- SOA closing balance incorrect due to internal movement

---

## Console Debugging

Open browser console and check for these logs:

```javascript
// Dashboard.tsx
[Dashboard] computeCash → 
  bankPicked: 500
  bankLoaded: 300
  cashUtil.inHand: 200

// EODSummary.tsx
[EOD] bankPicked: 500, bankLoaded: 300, cashInHand: 200
[EOD] internalPicked: 200, internalLoaded: 200, net: 0

// ATMReplenishment.tsx
[ATMLoad] availableBankCash: { total: 200, denoms: {...} }
[ATMLoad] availableInternalCash: { total: 200, denoms: {...} }
```

---

## Database View Verification

Run this query in Supabase SQL Editor:

```sql
SELECT 
  assignment_id,
  bank_picked,
  bank_loaded,
  internal_picked,
  internal_loaded,
  cash_picked,
  cash_loaded,
  (bank_picked - bank_loaded) as cash_in_hand
FROM v_soa_effective
WHERE assignment_date = CURRENT_DATE;
```

**Expected**:
- `bank_picked` = 500
- `bank_loaded` = 300
- `internal_picked` = 200
- `internal_loaded` = 200
- `cash_in_hand` = 200 (calculated)

---

## Comparison: Before vs After

| Metric | Before (WRONG) | After (CORRECT) |
|--------|---------------|-----------------|
| Bank Picked | ₹500 | ₹500 |
| Total Loaded | ₹700 ❌ | ₹300 ✅ |
| Cash-in-Hand | -₹200 ❌ | ₹200 ✅ |
| Internal Transfer Net | ₹200 ❌ | ₹0 ✅ |
| KPI Total Loaded | ₹700 ❌ | ₹300 ✅ |

---

## Files Changed Summary

1. ✅ `src/pages/Dashboard.tsx` - Fixed `computeCash()` and `computeDenoms()`
2. ✅ `src/pages/EODSummary.tsx` - Fixed cash aggregation logic
3. ✅ `src/pages/StatementOfAccounts.tsx` - Fixed `getFinalNet()`
4. ✅ `src/pages/AdminEODDetail.tsx` - Fixed aggregation logic
5. ✅ `src/pages/analytics/AdvancedAnalytics.tsx` - Fixed KPI calculation

**No database changes required** - Views already support bank/internal separation.

---

## Sign-off Checklist

- [ ] All test scenario results match expectations
- [ ] No negative Cash-in-Hand values
- [ ] Internal transfer net = 0 across all views
- [ ] KPI metrics show bank cash only
- [ ] SOA closing balance correct
- [ ] Console logs show correct calculations
- [ ] Database view query returns expected values

**Status**: ✅ Ready for Testing  
**Risk**: Low (calculation logic only)  
**Rollback**: Simple (git revert)
