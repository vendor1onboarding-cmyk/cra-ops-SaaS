# 📱 Unified ATM Loading - User Workflow Guide

## Visual Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED ATM LOADING WORKFLOW                  │
└─────────────────────────────────────────────────────────────────┘

STEP 1: CASH PICKUP (Multi-Source)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌──────────────────┐
│ Custodian Opens  │
│  Cash Pickup     │
└────────┬─────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Select Source Mode:              │
│  ○ Bank Only                     │
│  ● Bank + Internal ATM           │ ← NEW!
└────────┬─────────────────────────┘
         │
         ├─────────────────────────┐
         │                         │
         ▼                         ▼
┌──────────────────┐     ┌──────────────────────┐
│ Bank Source      │     │ Internal ATM Source  │ ← NEW!
│                  │     │                      │
│ ₹2000: 50 notes  │     │ Select Sites:        │
│ ₹500: 100 notes  │     │  ✓ Site ABC          │
│                  │     │    ₹500: 30 notes    │
│ Total: ₹150,000  │     │  ✓ Site XYZ          │
└────────┬─────────┘     │    ₹500: 20 notes    │
         │               │                      │
         │               │ Total: ₹25,000       │
         │               └──────────┬───────────┘
         │                          │
         └──────────┬───────────────┘
                    │
                    ▼
         ┌────────────────────────┐
         │  Combined Summary      │
         │                        │
         │  Bank:     ₹150,000    │
         │  Internal: ₹25,000     │
         │  ──────────────────    │
         │  TOTAL:    ₹175,000    │
         └────────────────────────┘
                    │
                    ▼
         ┌────────────────────────┐
         │   Save Cash Pickup     │
         │                        │
         │  Metadata saved:       │
         │  • Bank denoms         │
         │  • Internal sources    │
         └────────────────────────┘


STEP 2: ATM REPLENISHMENT (Unified Loading)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         │
         ▼
┌────────────────────────────────────┐
│  Open ATM Replenishment            │
│  Select ATM Site to Load           │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Available Cash Display:           │
│                                    │
│  🔵 From Bank: ₹150,000           │ ← SOA Impact
│  🟢 From Internal: ₹25,000        │ ← Neutral
│  ──────────────────────            │
│  Total Available: ₹175,000         │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Enter Load Denominations:         │
│                                    │
│  ₹2000: 40 notes                   │
│  ₹500: 120 notes                   │
│                                    │
│  System Auto-Allocates:            │
│   • Uses bank source first         │
│   • Then internal if needed        │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Source Breakdown Calculated:      │
│                                    │
│  Bank Source:                      │
│   ₹2000: 40 (₹80,000)             │
│   ₹500: 100 (₹50,000)             │
│   Subtotal: ₹130,000              │ ← For SOA
│                                    │
│  Internal Source:                  │
│   ₹500: 20 (₹10,000)              │
│   Subtotal: ₹10,000               │ ← Neutral
│                                    │
│  Combined: ₹140,000               │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  GPS Verification                  │
│  Photo (if needed)                 │
│  Save ATM Load                     │
│                                    │
│  source_breakdown saved to DB      │
└────────────────────────────────────┘


STEP 3: SOA REPORTING (Accurate Accounting)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
         │
         ▼
┌────────────────────────────────────┐
│  Statement of Accounts             │
│                                    │
│  KPI Cards (5):                    │
│  ┌────────┬────────┬────────┐     │
│  │ Picked │ Loaded │Internal│     │
│  │ 150K   │ 130K   │  10K   │     │
│  │ (Bank) │ (Bank) │ (Neut) │     │
│  └────────┴────────┴────────┘     │
│  ┌────────┬────────┐              │
│  │ Travel │  Net   │              │
│  │  5K    │  15K   │              │
│  └────────┴────────┘              │
└────────┬───────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Detailed Table:                   │
│                                    │
│  Date    | Loaded | Internal      │
│  ────────┼────────┼────────       │
│  2/8/26  | 130K   | 10K           │
│          | 🟢     | ⚪           │
└────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────┐
│  Breakdown Card (When > 0):        │
│                                    │
│  💡 Cash Load Breakdown            │
│  Total: ₹140,000                   │
│   ├─ Bank: ₹130,000 (in SOA)      │
│   └─ Internal: ₹10,000 (neutral)   │
└────────────────────────────────────┘


ACCOUNTING FORMULAS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cash-in-Hand:
  Bank Cash = Σ(bank pickups) - Σ(bank loads) + Σ(exchanges)
  Internal Cash = Σ(internal pickups) - Σ(internal loads)
  
SOA Net Position:
  Net = Cash Picked - Bank Loaded - Excess - Travel
        ↑              ↑
        Bank only      EXCLUDES internal
                       (neutral to SOA)

Vendor Reconciliation:
  Uses ONLY "Bank Loaded" figure
  Internal transfers invisible to vendor
  Accurate accounting maintained
```

---

## Key Visual Elements

### Color Coding
- 🔵 **Blue Badge** = Bank-sourced cash (affects SOA)
- 🟢 **Green Badge** = Internal ATM cash (neutral to SOA)
- ⚪ **Gray Badge** = Informational display

### Icons
- 🏦 **Bank** = Bank withdrawal source
- 🏧 **ATM** = Internal ATM source
- 💡 **Info** = Breakdown/explanation cards
- ✅ **Success** = Operation completed
- ⚠️ **Warning** = Validation alert

---

## Mobile UI Flow

### Cash Pickup Screen
```
┌─────────────────────────┐
│ 📱 Cash Pickup          │
├─────────────────────────┤
│ Source Mode             │
│ ┌─────────────────────┐ │
│ │ Bank Only           │ │
│ │ Bank + Internal ATM │●│
│ └─────────────────────┘ │
├─────────────────────────┤
│ Bank Denominations      │
│ ₹2000 [___50___]        │
│ ₹500  [___100__]        │
├─────────────────────────┤
│ Internal Sources (2)    │
│ ┌─────────────────────┐ │
│ │ Site ABC            │ │
│ │ ₹500: 30 | ₹15,000  │ │
│ │         [Remove]    │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Site XYZ            │ │
│ │ ₹500: 20 | ₹10,000  │ │
│ │         [Remove]    │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ Combined Total          │
│ Bank:     ₹150,000     │
│ Internal: ₹25,000      │
│ ────────────────────   │
│ TOTAL:    ₹175,000     │
├─────────────────────────┤
│  [  Save Cash Pickup  ] │
└─────────────────────────┘
```

### ATM Replenishment Screen
```
┌─────────────────────────┐
│ 📱 ATM Load             │
├─────────────────────────┤
│ Available Cash          │
│ 🔵 Bank: ₹150,000      │
│ 🟢 Internal: ₹25,000   │
├─────────────────────────┤
│ Load Denominations      │
│ ₹2000 [___40___]        │
│ ₹500  [___120__]        │
├─────────────────────────┤
│ Auto-Allocated:         │
│ Bank:     ₹130,000     │
│ Internal: ₹10,000      │
│ ────────────────────   │
│ Total:    ₹140,000     │
├─────────────────────────┤
│ GPS ✅ Verified         │
│  [  Save ATM Load  ]    │
└─────────────────────────┘
```

### SOA Screen (Mobile)
```
┌─────────────────────────┐
│ 📱 SOA                  │
├─────────────────────────┤
│ ┌─────────────────────┐ │
│ │ Total Picked        │ │
│ │ ₹150,000           │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Loaded (Bank) 🟢   │ │
│ │ ₹130,000           │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Internal Transfers  │ │
│ │ ₹10,000            │ │
│ └─────────────────────┘ │
│ ┌─────────────────────┐ │
│ │ Net Position        │ │
│ │ ₹15,000            │ │
│ └─────────────────────┘ │
├─────────────────────────┤
│ 💡 Breakdown            │
│ Bank: ₹130K (in SOA)   │
│ Internal: ₹10K (neut)  │
└─────────────────────────┘
```

---

## Quick Reference Card

### For Custodians
**"How do I load an ATM with mixed cash?"**

1. **Cash Pickup**: Select "Bank + Internal ATM"
2. Enter bank denoms + add ATM sites
3. **ATM Load**: See split availability, enter load
4. System auto-allocates (bank first, then internal)
5. **SOA**: View breakdown for transparency

### For Admins
**"How do I interpret SOA with internal transfers?"**

- **Loaded (Bank)** ← This is vendor reconciliation amount
- **Internal Transfers** ← Informational only (neutral)
- **Net Position** ← Correct accounting (excludes internal)

### Key Principle
> **Internal ATM transfers are cash movements, not new cash.**
> They don't affect cash-in-hand or SOA net position.
> They're visible for operational transparency.

---

## Examples

### Example 1: Simple Mixed Load
```
Pickup:
  Bank: ₹100,000
  ATM Site A: ₹50,000
  Total: ₹150,000

Load to ATM Site B: ₹120,000
  Auto-allocated:
    Bank: ₹100,000
    Internal: ₹20,000

SOA Impact:
  Bank Loaded: ₹100,000 ✅ (affects SOA)
  Internal: ₹20,000 ⚪ (neutral)
  Net: Picked - Bank Loaded = correct
```

### Example 2: Multiple Internal Sources
```
Pickup:
  Bank: ₹200,000
  ATM Site A: ₹30,000
  ATM Site B: ₹40,000
  ATM Site C: ₹20,000
  Total: ₹290,000

Load to ATM Site D: ₹250,000
  Auto-allocated:
    Bank: ₹200,000
    Internal: ₹50,000 (from A+B+C)

SOA Impact:
  Bank Loaded: ₹200,000 ✅
  Internal: ₹50,000 ⚪
```

---

**Document Version**: 1.0
**Last Updated**: February 8, 2026
**For**: Sruthi CRA Unified ATM Loading Enhancement
