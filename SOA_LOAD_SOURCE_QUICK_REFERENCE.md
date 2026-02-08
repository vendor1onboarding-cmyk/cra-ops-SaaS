# SOA Load Source Split - Quick Reference

## At a Glance
**Feature**: Separate display of bank-sourced vs internal ATM-sourced loads in SOA
**Purpose**: Accurate vendor reconciliation (internal transfers don't inflate SOA)
**Impact**: SOA Net Position only includes bank-sourced loads

## Key Concepts

### Load Types
| Type | Source | SOA Impact | Display |
|------|--------|------------|---------|
| **Bank Load** | Cash from bank | ✅ Included | Green text |
| **Internal Transfer** | Cash from ATM sites | ❌ Neutral | Gray badge |

### SOA Formula
```
Final Net = Picked - Bank_Loaded - Excess - Travel
           (Internal transfers NOT included)
```

## UI Changes

### KPI Cards (Summary View)
```
┌─────────────┬─────────────┬─────────────┬─────────────┬─────────────┐
│ Total       │ Loaded      │ Internal    │ Travel      │ Net         │
│ Picked      │ (Bank)      │ Transfers   │ Allowance   │ Position    │
│ ₹100,000    │ ₹75,000     │ ₹15,000     │ ₹500        │ ₹24,500     │
└─────────────┴─────────────┴─────────────┴─────────────┴─────────────┘
```

### Table Columns
- **Picked**: Total cash collected
- **Bank Loaded**: From bank (green, affects SOA)
- **Internal**: From ATM sites (gray, informational)
- **Final Net**: Should be ~0

### Info Card (when internal > 0)
```
💡 Cash Load Breakdown
Total Cash Loaded: ₹90,000
  ├─ From Bank: ₹75,000 (included in SOA)
  └─ Internal Transfers: ₹15,000 (neutral)
```

## Data Model

### Database View
```sql
v_atm_load_sources
├─ bank_total_amount     → SOA "Loaded (Bank)"
└─ internal_total_amount → SOA "Internal Transfers"
```

### Source Breakdown
```json
{
  "bank_source": { "total_amount": 75000 },
  "internal_source": { "total_amount": 15000 }
}
```

## User Guide

### For Custodians
1. View your SOA in Statement of Accounts page
2. "Loaded (Bank)" = cash from bank pickups
3. "Internal" = cash moved from other ATM sites
4. Final Net should be near ₹0

### For Admins
1. See all custodians' load breakdowns
2. Filter by custodian, date range, status
3. Export CSV includes both columns
4. Use for vendor reconciliation

## CSV Export Format
```csv
Date,Custodian,Status,Cash Picked,Bank Loaded,Internal Transferred,Travel KM,Allowance,Final Net
2025-02-08,John Doe,approved,100000,75000,15000,50,500,24500
```

## Backward Compatibility
- **NULL source_breakdown**: Treated as 100% bank-sourced
- **Legacy loads**: Show only in "Bank Loaded"
- **No migration needed**: Works with existing data

## Mobile View
```
┌──────────────────────────┐
│ 08/02/2025   [approved]  │
│ Custodian: John Doe      │
├──────────────────────────┤
│ Picked:       ₹100,000   │
│ Bank Loaded:   ₹75,000   │
│ Internal:      ₹15,000   │
│ KM: 50                   │
│ Allowance:        ₹500   │
├──────────────────────────┤
│ Final Net: ₹24,500       │
└──────────────────────────┘
```

## Quick Troubleshooting

| Issue | Likely Cause | Solution |
|-------|--------------|----------|
| No internal transfers showing | NULL source_breakdown | Check ATM load data entry |
| Totals don't add up | View aggregation error | Refresh page, verify data |
| Missing in CSV export | Browser cache | Clear cache, re-export |
| Final Net not zero | Missing loads/pickups | Review assignment records |

## Related Pages
- **Statement of Accounts**: Main SOA view
- **ATM Replenishment**: Record loads with source
- **Cash Pickup**: Record bank + internal sources
- **Admin SOA Adjustments**: View operational records

## Key Files
- `src/pages/StatementOfAccounts.tsx` - UI implementation
- `migrations/UNIFIED_ATM_LOADING_MIGRATION.sql` - Schema
- `SOA_LOAD_SOURCE_SPLIT_IMPLEMENTATION.md` - Full guide

## Version
**v1.0** - February 8, 2026
