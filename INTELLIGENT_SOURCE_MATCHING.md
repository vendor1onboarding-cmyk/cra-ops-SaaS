# Intelligent ATM Load Source Matching

## Overview

The ATM replenishment system now **automatically determines the source of money** (Bank vs Internal ATM) by intelligently matching the loaded denominations to the ATM removal plan. No manual source selection required.

## How It Works

### Workflow

1. **Custodian enters ATM load** with denomination breakdown (e.g., 10x₹2000 + 5x₹500)
2. **System fetches the assignment's ATM removal plan** (denominations removed from ATM in the morning)
3. **Intelligent matching algorithm compares** loaded denoms vs removed denoms
4. **Automatic classification**:
   - Denominations matching removal plan → **Internal ATM Transfer** source
   - Denominations exceeding removal plan → **Bank source**
   - No removal plan → **Bank source** (default)

### Matching Algorithm

For each denomination:
```
If removal_plan[denom] exists:
  internal_count = min(load_count, removal_plan[denom])
  bank_count = max(0, load_count - removal_plan[denom])
Else:
  bank_count = load_count
  internal_count = 0
```

### Example

**Morning Scenario:**
- ATM removal plan: 5x₹2000 + 3x₹500
- Custodian loads ATM with: 5x₹2000 + 5x₹500

**System categorizes as:**
- Internal ATM transfer: 5x₹2000 + 3x₹500 (matched to removal plan)
- Bank source: 2x₹500 (excess beyond plan)

**Result in SOA:**
- Bank Loaded KPI: Amount from bank source only
- Internal ATM Movement: Amount from internal source (neutral, nets to zero)

## Code Changes

### File: `src/pages/ATMReplenishment.tsx`

#### 1. **New State (Line ~78)**
```tsx
const [assignmentRemovalPlan, setAssignmentRemovalPlan] = useState<{
  denom_100: number;
  denom_200: number;
  denom_500: number;
  denom_2000: number;
} | null>(null);
```

#### 2. **Fetching Removal Plan (useEffect, Line ~120)**
```tsx
useEffect(() => {
  // ... existing code ...
  
  // Fetch ATM removal plan for this assignment
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
}, [profile]);
```

#### 3. **Intelligent Matching Function (Line ~577)**
```tsx
function calculateSourceBreakdown(loadDenoms: typeof denoms) {
  const bankSource = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0, total_amount: 0 };
  const internalSource = { denom_100: 0, denom_200: 0, denom_500: 0, denom_2000: 0, total_amount: 0 };

  // Match each denom to removal plan
  Object.entries(DENOM_VALUES).forEach(([key, value]) => {
    const loadCount = loadDenoms[key as keyof typeof loadDenoms];
    const removalCount = assignmentRemovalPlan
      ? (assignmentRemovalPlan[key as keyof typeof assignmentRemovalPlan] || 0)
      : 0;

    if (assignmentRemovalPlan && removalCount > 0) {
      // Intelligent matching: up to removal plan → internal, excess → bank
      const fromInternal = Math.min(loadCount, removalCount);
      const fromBank = Math.max(0, loadCount - removalCount);

      internalSource[key as keyof typeof internalSource] = fromInternal;
      bankSource[key as keyof typeof bankSource] = fromBank;
    } else {
      // No removal plan → all bank source
      bankSource[key as keyof typeof bankSource] = loadCount;
    }
  });

  // Calculate totals...
  return { bank_source: bankSource, internal_source: internalSource, combined_total };
}
```

#### 4. **UI Update (Line ~1010)**
- Added "Automatic Source Detection" info box explaining the matching process
- Changed "Apply Planned" button to "Use Plan Values" (clarifies it's optional reference)
- Updated "Planned Denominations" label to "Reference" (not mandatory)

## Benefits

✅ **No Manual Selection:** Custodian doesn't need to choose source; system auto-detects

✅ **Audit Trail:** Removal plan denominations are matched, creating clear, traceable transactions

✅ **Flexible Handling:**
- Partial matches (some denoms from removal, some from bank) handled correctly
- Excess loading (more than plan) attributed to bank source
- No removal plan defaults to bank source

✅ **SOA Integrity:**
- Bank Loaded KPI reflects only bank-withdrawn cash
- Internal transfers show as neutral (same amount removed + loaded = net zero)
- Prevents cash source misclassification across assignments

## Example Scenarios

### Scenario 1: Perfect Match
- Removal plan: 5x₹2000
- Load: 5x₹2000
- Result: 100% Internal ATM Transfer (net zero impact on SOA)

### Scenario 2: Partial Load
- Removal plan: 5x₹2000
- Load: 3x₹2000
- Result: 3x₹2000 internal, 2x₹2000 still in removal (for next load)

### Scenario 3: Excess Load
- Removal plan: 5x₹2000
- Load: 8x₹2000
- Result: 5x₹2000 internal (matches plan), 3x₹2000 from bank (excess)

### Scenario 4: No Removal Plan
- Removal plan: None
- Load: 10x₹2000
- Result: 100% Bank source

## Integration with EOD/SOA

The `source_breakdown` saved in `atm_replenishments` table contains:
```json
{
  "bank_source": {
    "denom_100": 0,
    "denom_200": 0,
    "denom_500": 0,
    "denom_2000": 8,
    "total_amount": 16000
  },
  "internal_source": {
    "denom_100": 0,
    "denom_200": 0,
    "denom_500": 0,
    "denom_2000": 5,
    "total_amount": 10000
  },
  "combined_total": 26000
}
```

**EODSummary & AdminEODDetail** use this breakdown to:
- Separate bank-loaded vs internal-transferred amounts
- Show debit (removal) and credit (load) for each transaction
- Calculate correct KPI totals excluding internal transfers

**StatementOfAccounts** uses this to:
- Include only `bank_loaded` in "Total ATM Cash Loaded (SOA)" KPI
- Show `internal_loaded` separately as neutral information
- Net internal transfers to zero in monthly reconciliation

## Files Modified

- **`src/pages/ATMReplenishment.tsx`** ✓ Intelligent matching + UI update
- **`src/pages/EODSummary.tsx`** (already uses source_breakdown)
- **`src/pages/AdminEODDetail.tsx`** (already uses source_breakdown)
- **`src/pages/StatementOfAccounts.tsx`** (already uses source_breakdown)

## Testing Checklist

- [ ] Create assignment with ATM removal plan
- [ ] Load ATM with exact removal plan denoms → Verify all captured as internal
- [ ] Load ATM with more denoms than plan → Verify excess is bank source
- [ ] Load ATM with no removal plan → Verify all is bank source
- [ ] Verify SOA shows correct "Bank Loaded" KPI (stack internal transfers don't inflate it)
- [ ] Verify EOD print shows debit/credit for internal movements, netting to zero

## Benefits for Custodians

✅ **Simpler Form:** No dropdown to select bank vs ATM
✅ **Faster Entry:** Just enter what you loaded
✅ **Auto-Smart:** System figures out the source
✅ **Transparent:** Built-in help text explains the logic
✅ **Correct:**  Prevents accidental cash source misclassification
