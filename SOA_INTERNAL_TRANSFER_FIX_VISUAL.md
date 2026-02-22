# SOA Internal Transfer Fix - Visual Guide

## Flow Diagram: Before vs After

### BEFORE (BROKEN) ❌

```
┌─────────────────────────────────────────────────────────────┐
│                    CASH PICKUPS                              │
├─────────────────────────────────────────────────────────────┤
│ BANK Source: ₹42,00,000                                      │
│   └─ Denominations from bank branch                          │
│                                                              │
│ ATM_INTERNAL Source: ₹60,000                                 │
│   └─ Picked from ATM-A to load ATM-B                         │
│                                                              │
│ (internal_source_metadata in BANK pickup): ₹60,000          │
│   └─ Same ₹60K counted AGAIN!                               │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                 SOA CALCULATIONS                             │
├─────────────────────────────────────────────────────────────┤
│ cash_picked = ₹42L + ₹60K + ₹60K = ₹1,02,000 ⚠️ INFLATED   │
│ cash_loaded = ₹42L + ₹60K = ₹1,02,000 ⚠️ INFLATED          │
│ final_net = ₹1,02,000 - ₹1,02,000 = ₹0                     │
│             (correct by accident!)                           │
└─────────────────────────────────────────────────────────────┘
```

### AFTER (FIXED) ✅

```
┌─────────────────────────────────────────────────────────────┐
│                    CASH PICKUPS                              │
├─────────────────────────────────────────────────────────────┤
│ BANK Source: ₹42,00,000 ──────────────────┐                 │
│   └─ Denominations from bank branch        │                 │
│      (excluding internal metadata)         │                 │
│                                            │                 │
│ ATM_INTERNAL Source: ₹60,000 ─────────┐   │                 │
│   └─ Picked from ATM-A to load ATM-B   │   │                 │
│                                        │   │                 │
│ (internal_source_metadata): ₹60,000 ──┤   │                 │
│   └─ Counted in internal flow only     │   │                 │
└────────────────────────────────────────┼───┼─────────────────┘
                                        │   │
                          ┌─────────────┘   └─────────────┐
                          │                               │
                    INTERNAL FLOW                   BANK FLOW
                     (Neutral)                (Affects Cash-in-Hand)
                          │                               │
                          ▼                               ▼
         ┌─────────────────────────────┐  ┌─────────────────────────────┐
         │   internal_picked: ₹60,000  │  │  bank_picked: ₹42,00,000    │
         │   internal_loaded: ₹60,000  │  │  bank_loaded: ₹42,00,000    │
         │   internal_net: ₹0          │  │  bank_net: ₹0               │
         │   (visible but neutral)     │  │  (affects final position)   │
         └─────────────────────────────┘  └─────────────────────────────┘
                                                         │
                                                         ▼
                          ┌─────────────────────────────────────────────┐
                          │          SOA CALCULATIONS                   │
                          ├─────────────────────────────────────────────┤
                          │ cash_picked = ₹42,00,000 ✅ CORRECT        │
                          │ cash_loaded = ₹42,00,000 ✅ CORRECT        │
                          │ final_net = ₹42L - ₹42L = ₹0 ✅ CORRECT   │
                          └─────────────────────────────────────────────┘
```

## Data Structure Breakdown

### cash_pickups Table
```
┌─────────────┬──────────────┬──────────────┬─────────────────────────┐
│ assignment  │ pickup_source│ denominations│ internal_source_metadata│
│     _id     │              │    (total)   │        (JSON)           │
├─────────────┼──────────────┼──────────────┼─────────────────────────┤
│ 123         │ BANK         │ ₹42,00,000   │ {"total": "60000"}      │ ← Split here!
│ 123         │ ATM_INTERNAL │ ₹60,000      │ null                    │
└─────────────┴──────────────┴──────────────┴─────────────────────────┘
           │                      │                     │
           │                      │                     │
           ▼                      ▼                     ▼
     bank_picked             internal_picked      internal_picked
     (₹42L only)            (₹60K pickup)       (₹60K metadata)
```

### v_atm_load_sources View
```
┌─────────────┬───────────┬──────────────┬──────────────────┬──────────────────────┐
│ assignment  │  site_id  │ total_denoms │ bank_total_amount│ internal_total_amount│
│     _id     │           │              │                  │                      │
├─────────────┼───────────┼──────────────┼──────────────────┼──────────────────────┤
│ 123         │ ATM-A     │ ₹20,00,000   │ ₹20,00,000       │ ₹0                   │
│ 123         │ ATM-B     │ ₹22,00,000   │ ₹22,00,000       │ ₹0                   │
│ 123         │ ATM-C     │ ₹60,000      │ ₹0               │ ₹60,000              │ ← Internal!
└─────────────┴───────────┴──────────────┴──────────────────┴──────────────────────┘
                                                   │                    │
                                                   ▼                    ▼
                                            bank_loaded          internal_loaded
                                            (₹42L total)         (₹60K total)
```

## UI Display: Statement of Accounts

### Desktop View
```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Statement of Accounts - January 2025                                           │
├────────────────────────────────────────────────────────────────────────────────┤
│ Date       │ Status  │ Bank Picked │ ATM Picked │ Bank Loaded │ Internal  │ Net│
│            │         │             │            │             │ Movement  │    │
├────────────┼─────────┼─────────────┼────────────┼─────────────┼───────────┼────┤
│ 26/01/2025 │ Approved│ ₹42,00,000  │ ₹60,000    │ ₹42,00,000  │ (+₹60,000)│ ₹0 │
└────────────┴─────────┴─────────────┴────────────┴─────────────┴───────────┴────┘
               │              │            │             │             │        │
               │              │            │             │             │        │
         assignment      bank_picked  internal_   bank_loaded  internal_   final_net
           status                      picked                   loaded
```

### Calculation Flow
```
Bank Flow (Affects Cash-in-Hand):
  ┌─────────────────────┐
  │ Bank Picked         │ ₹42,00,000
  └─────────────────────┘
           │
           ▼
  ┌─────────────────────┐
  │ Bank Loaded         │ ₹42,00,000
  └─────────────────────┘
           │
           ▼
  ┌─────────────────────┐
  │ Final Net           │ ₹0 (42L - 42L)
  └─────────────────────┘

Internal Flow (Neutral, Audit Only):
  ┌─────────────────────┐
  │ ATM Picked          │ ₹60,000
  └─────────────────────┘
           │
           ▼
  ┌─────────────────────┐
  │ Internal Movement   │ ₹60,000
  └─────────────────────┘
           │
           ▼
  ┌─────────────────────┐
  │ (Not in final net)  │ Visible but neutral
  └─────────────────────┘
```

## Query Logic Comparison

### OLD QUERY (cash_picked) ❌
```sql
-- WRONG: Summing all three sources
cash_picked = 
  (SELECT SUM(...) FROM cash_pickups WHERE source = 'BANK') +           -- ₹42L
  (SELECT SUM(...) FROM cash_pickups WHERE source = 'ATM_INTERNAL') +   -- ₹60K
  (SELECT SUM(internal_metadata) FROM cash_pickups WHERE source = 'BANK') -- ₹60K again!
-- Result: ₹42,60,000 (INFLATED by ₹60K double-count)
```

### NEW QUERY (cash_picked) ✅
```sql
-- CORRECT: Only bank source
cash_picked = 
  (SELECT SUM(...) FROM cash_pickups WHERE source = 'BANK')  -- ₹42L only
-- Result: ₹42,00,000 (ACCURATE)
```

### OLD QUERY (cash_loaded) ❌
```sql
-- WRONG: Summing both flows
cash_loaded = 
  (SELECT SUM(bank_total_amount) FROM v_atm_load_sources) +      -- ₹42L
  (SELECT SUM(internal_total_amount) FROM v_atm_load_sources)    -- ₹60K
-- Result: ₹42,60,000 (INFLATED)
```

### NEW QUERY (cash_loaded) ✅
```sql
-- CORRECT: Only bank flow
cash_loaded = 
  (SELECT SUM(bank_total_amount) FROM v_atm_load_sources)  -- ₹42L only
-- Result: ₹42,00,000 (ACCURATE)
```

## Edge Cases Handled

### Case 1: Pure Bank (No Internal Transfers)
```
Input:
  - Bank pickup: ₹50L
  - No ATM_INTERNAL pickups
  - No internal_source_metadata

Output:
  - bank_picked: ₹50L
  - internal_picked: ₹0
  - cash_picked: ₹50L
  - cash_loaded: ₹50L (if all loaded)
  - final_net: ₹0 (if balanced)
```

### Case 2: Multiple Internal Transfers
```
Input:
  - Bank pickup: ₹100L
  - ATM_INTERNAL pickup 1: ₹50K
  - ATM_INTERNAL pickup 2: ₹30K
  - internal_source_metadata in BANK: ₹80K total

Output:
  - bank_picked: ₹100L (BANK only)
  - internal_picked: ₹1,30,000 (₹50K + ₹30K + ₹50K metadata)
  - cash_picked: ₹100L (bank only, NOT ₹101.3L)
  - internal_loaded: ₹1,30,000 (matched to internal_picked)
  - final_net: ₹100L - ₹100L = ₹0
```

### Case 3: Partial Internal Metadata
```
Input:
  - Bank pickup 1: ₹40L, metadata: ₹20K
  - Bank pickup 2: ₹60L, no metadata
  - No ATM_INTERNAL pickups

Output:
  - bank_picked: ₹100L (₹40L + ₹60L, excluding metadata)
  - internal_picked: ₹20K (from metadata only)
  - cash_picked: ₹100L (NOT ₹100.2L)
  - final_net: based on ₹100L bank flow
```

## Deployment Impact Timeline

```
Before Deployment:
  ┌─────────────────────────────────────┐
  │ KPI Dashboard                       │
  │ Cash Picked: ₹1,02,000 ⚠️          │
  │ Cash Loaded: ₹1,02,000 ⚠️          │
  │ Final Net: ₹0                       │
  └─────────────────────────────────────┘

Deployment (2 seconds):
  ┌─────────────────────────────────────┐
  │ Executing SQL script...              │
  │ DROP VIEW v_soa_effective           │
  │ CREATE VIEW v_soa_effective         │
  │ DROP VIEW v_soa_detailed            │
  │ CREATE VIEW v_soa_detailed          │
  │ ✅ Complete                          │
  └─────────────────────────────────────┘

After Deployment:
  ┌─────────────────────────────────────┐
  │ KPI Dashboard                       │
  │ Cash Picked: ₹42,00,000 ✅         │
  │ Cash Loaded: ₹42,00,000 ✅         │
  │ Final Net: ₹0 ✅                   │
  │                                     │
  │ [View Details] →                    │
  │   Bank: ₹42L picked, ₹42L loaded    │
  │   Internal: ₹60K picked, ₹60K moved │
  └─────────────────────────────────────┘
```

## Quick Reference Card

```
╔═══════════════════════════════════════════════════════════════╗
║            SOA INTERNAL TRANSFER FIX - CHEAT SHEET            ║
╠═══════════════════════════════════════════════════════════════╣
║                                                               ║
║ PROBLEM:    Internal transfers counted TWICE                 ║
║ SOLUTION:   Separate bank vs internal flows                  ║
║ METHOD:     SQL view redesign (DROP/CREATE)                  ║
║ IMPACT:     Lower KPI values (correct bank-only totals)      ║
║ RISK:       LOW (backward compatible, no data changes)       ║
║ TIME:       2 seconds to deploy                              ║
║                                                               ║
║ ─────────────────────────────────────────────────────────────║
║                                                               ║
║ DEPLOY:     1. Open Supabase SQL Editor                      ║
║             2. Copy SOA_INTERNAL_TRANSFER_FIX.sql            ║
║             3. Click "Run"                                   ║
║                                                               ║
║ VERIFY:     cash_picked = bank_picked                        ║
║             cash_loaded = bank_loaded                        ║
║             final_net = (bank_picked - bank_loaded)          ║
║                                                               ║
║ ROLLBACK:   git checkout v_soa_*.sql && redeploy             ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
```
