# 📸 SOA Pages - Visual Guide & Examples

## 🎨 StatementOfAccounts Page Layout

### 1. Page Header
```
═════════════════════════════════════════════════════════════
    Statement of Accounts
    
    [Custodian View]: View your personal statement of accounts
    [Admin View]: View and manage all custodian statements
═════════════════════════════════════════════════════════════
```

### 2. Filter Section
```
┌─────────────────────────────────────────────────────────────┐
│  From Date: [YYYY-MM-DD]  To Date: [YYYY-MM-DD]           │
│                                                             │
│  [📥 Export CSV]  [🖨️ Print / PDF]                        │
│                                                             │
│  💡 Tip: To filter by custodian, use admin dashboard      │
└─────────────────────────────────────────────────────────────┘
```

### 3. KPI Cards (4 columns on desktop, 2 on mobile)
```
┌──────────────────┬──────────────────┬──────────────────┬──────────────────┐
│ Total Picked     │ Total Loaded     │ Travel Allowance │ Net Position ⭐ │
│ ₹                │ ₹                │ ₹                │ ₹                │
│ 50,00,000.00     │ 45,00,000.00     │ 12,500.00        │ 5,12,500.00      │
│ (blue)           │ (green)          │ (amber)          │ (indigo, highlight)
└──────────────────┴──────────────────┴──────────────────┴──────────────────┘
```

### 4. Data Table (with scrollbar on mobile)
```
┌────────────┬──────────┬────────┬────────┬──────────┬────────┬────┬──────────┬──────────┐
│ Date       │Custodian │ Picked │Loaded  │ Adjusted │ Excess │ KM │Allowance │Final Net │
│            │(Admin)   │ (₹)    │ (₹)    │ (₹)      │ (₹)    │    │ (₹)      │ (₹)      │
├────────────┼──────────┼────────┼────────┼──────────┼────────┼────┼──────────┼──────────┤
│25/01/2026  │ John     │50,000  │45,000  │  500     │ 0      │ 45 │  250     │  5,250   │
│24/01/2026  │ John     │52,000  │47,000  │ -1,000   │ 500 ⚠️ │ 48 │  250     │  3,250   │
│23/01/2026  │ Sarah    │60,000  │55,000  │    0     │ 0      │ 50 │  300     │  5,300   │
├────────────┼──────────┼────────┼────────┼──────────┼────────┼────┼──────────┼──────────┤
│ Total      │          │162,000 │147,000 │  -500    │  500   │143 │  800     │ 13,800   │
│(3 records) │          │        │        │          │        │    │          │          │
└────────────┴──────────┴────────┴────────┴──────────┴────────┴────┴──────────┴──────────┘

Colors:
- Date: Black text
- Custodian: Gray pill/badge (Admin only)
- Adjusted: Bold if non-zero
- Excess: Red if > 0
- Final Net: Indigo/highlight background
```

### 5. Empty States

#### Loading State
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                     ⟳ Loading SOA records…                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### No Records
```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  No SOA records found for the selected period.            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Error State
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Failed to load SOA records. Please try again.           │
│                                                             │
│ [Retry]                                                     │
└─────────────────────────────────────────────────────────────┘
```

### 6. Print View
```
┌─────────────────────────────────────────────────────────────┐
│                 STATEMENT OF ACCOUNTS                       │
│            Period: 2026-01-01 to 2026-01-31               │
│                                                             │
│ [Table with all data]                                      │
│                                                             │
│                                                             │
│ Custodian Signature:        Authorized Signatory:          │
│ _____________________       _____________________           │
│ Date & Time                 Date & Time                    │
│                                                             │
│ This is a computer-generated document.                     │
│ No signature required for digital records.                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 AdminSOAAdjustments Page Layout

### 1. Page Header
```
═════════════════════════════════════════════════════════════
    SOA Manual Adjustments
    
    Make corrections to Statement of Accounts records
    when needed
═════════════════════════════════════════════════════════════
```

### 2. SOA Selection Section
```
┌─────────────────────────────────────────────────────────────┐
│ Select Assignment / SOA *                                  │
│                                                             │
│ [▼ -- Select an Assignment --                          ]   │
│     📅 01/01/2026 | Assignment #1 | John Doe               │
│     📅 02/01/2026 | Assignment #2 | Sarah Smith            │
│     📅 03/01/2026 | Assignment #3 | Mike Johnson           │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3. Selected SOA Details (Blue Info Box)
```
┌─────────────────────────────────────────────────────────────┐
│ Assignment ID         Current Net Position                 │
│ #123                  ₹50,000.00                           │
│                                                             │
│ Custodian             Assignment Date                      │
│ John Doe              25/01/2026                          │
└─────────────────────────────────────────────────────────────┘
```

### 4. Adjustment Details Form
```
┌─────────────────────────────────────────────────────────────┐
│ Adjustment Details                                          │
│                                                             │
│ Adjustment Amount *                                         │
│ [₹|____________|] (+500 or -250)                           │
│                                                             │
│ Reason for Adjustment *                                    │
│ [____________________________________________]  0/200     │
│ Describe the reason for this adjustment                   │
│                                                             │
│ Reference (Optional)                                       │
│ [____________________________________________]             │
│ e.g., Invoice #12345, Check #5678                         │
│                                                             │
│ [Show Preview]  [Reset Form]  [Post Adjustment]           │
│ (disabled)      (enabled)     (disabled until valid)       │
└─────────────────────────────────────────────────────────────┘
```

### 5. Preview Section (Toggleable)
```
┌─────────────────────────────────────────────────────────────┐
│ 👁️ Adjustment Preview                                      │
│                                                             │
│ Current Net Position:      ₹50,000.00                      │
│ Adjustment Amount:         +₹5,000.00 (green for credit)   │
│ ─────────────────────────────────────────                  │
│ Resulting Net Position:    ₹55,000.00 (bold/highlight)    │
│                                                             │
│ 💡 Reason: Cash count discrepancy found during audit      │
│ 📎 Reference: INV-12345                                    │
└─────────────────────────────────────────────────────────────┘
```

### 6. Messages

#### Success Message
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ SOA adjustment posted successfully!                      │
│    New net position: ₹55,000.00                            │
└─────────────────────────────────────────────────────────────┘
(Auto-disappears after 2 seconds, page reloads)
```

#### Error Message
```
┌─────────────────────────────────────────────────────────────┐
│ ⚠️ Failed to post SOA adjustment. Please try again.        │
└─────────────────────────────────────────────────────────────┘
```

#### Validation Errors
```
Amount field with error:
[₹|____________|] (red border)
⚠️ Please enter a valid non-zero amount

Reason field with error:
[_____________________] (red border)
⚠️ Please provide a valid reason
```

### 7. Access Denied (Non-Admin)
```
┌─────────────────────────────────────────────────────────────┐
│ ⛔ Access Denied.                                           │
│    Only administrators can adjust SOA records.             │
└─────────────────────────────────────────────────────────────┘
```

### 8. Help Section (When no SOA selected)
```
┌─────────────────────────────────────────────────────────────┐
│ 📝 How to use this tool:                                   │
│                                                             │
│  • Select an SOA record from the dropdown above             │
│  • Enter the adjustment amount (positive for credit,        │
│    negative for debit)                                      │
│  • Provide a detailed reason for the adjustment             │
│  • Optionally add a reference number                        │
│  • Review the preview and submit the adjustment             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔢 Data Examples

### Example SOA Record (Custodian View)
```
Date: 25/01/2026
Cash Picked: ₹50,000.00
Cash Loaded: ₹45,000.00
Cash Adjusted: ₹0.00
Excess Reported: ₹0.00
Travel KM: 45
Travel Allowance: ₹250.00
Final Net Position: ₹5,250.00
```

### Example SOA Record (Admin View - Added)
```
Custodian: John Doe
Date: 25/01/2026
Cash Picked: ₹50,000.00
Cash Loaded: ₹45,000.00
Cash Adjusted: ₹0.00
Excess Reported: ₹0.00
Travel KM: 45
Travel Allowance: ₹250.00
Final Net Position: ₹5,250.00
```

### Example Adjustment
```
Type: CREDIT
Amount: ₹5,000.00
Reason: Cash count discrepancy found during audit
Reference: INV-12345
Created By: admin@company.com
Created At: 2026-01-25 14:30:00 UTC

Result:
Before: ₹50,000.00
After: ₹55,000.00 (5,000 added)
```

---

## 📱 Mobile View (< 768px)

### StatementOfAccounts Mobile
```
┌─────────────────────────────────────────────────────────────┐
│ Statement of Accounts                                       │
│                                                             │
│ View your personal statement of accounts                   │
│                                                             │
│ ⚠️ Failed to load (if error)                               │
│                                                             │
│ From Date: [YYYY-MM-DD]                                    │
│ To Date: [YYYY-MM-DD]                                      │
│                                                             │
│ [📥 Export CSV]  [🖨️ Print/PDF]                           │
│                                                             │
│ ┌──────────────────┐                                        │
│ │ Total Picked     │                                        │
│ │ ₹                │                                        │
│ │ 50,00,000.00     │                                        │
│ └──────────────────┘                                        │
│ ┌──────────────────┐                                        │
│ │ Total Loaded     │                                        │
│ │ ₹                │                                        │
│ │ 45,00,000.00     │                                        │
│ └──────────────────┘                                        │
│                                                             │
│ [Table with horizontal scroll →]                           │
│ Date│Picked│Loaded│Adjusted│...                            │
│ ──────────────────────────────────                         │
│ 25/01│50k│45k│0│...                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### AdminSOAAdjustments Mobile
```
┌─────────────────────────────────────────────────────────────┐
│ SOA Manual Adjustments                                      │
│                                                             │
│ Select Assignment / SOA *                                  │
│ [▼ -- Select an Assignment --]                            │
│                                                             │
│ Selected:                                                   │
│ Assignment #123, John Doe, 25/01/2026                     │
│ Current: ₹50,000.00                                        │
│                                                             │
│ Adjustment Amount *                                         │
│ [₹|__________|]                                            │
│                                                             │
│ Reason *                                                    │
│ [________________] 0/200                                    │
│                                                             │
│ Reference                                                   │
│ [________________]                                          │
│                                                             │
│ [Show Preview]                                             │
│ [Reset Form]                                               │
│ [Post Adjustment]                                          │
│                                                             │
│ Preview:                                                    │
│ Current: ₹50,000.00                                        │
│ Amount: +₹5,000.00                                         │
│ Result: ₹55,000.00                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎯 Color Scheme

### Primary Colors
```
Primary (Blue): #3B82F6       - Action buttons, active states
Secondary (Slate): #64748B   - Text, borders, backgrounds
Success (Green): #22C55E     - Positive values, credit amounts
Warning (Red): #EF4444       - Errors, negative values, alerts
Info (Indigo): #6366F1       - Highlights, net position
```

### Background Colors
```
Blue Background: #EFF6FF (bg-blue-50)         - Blue KPI cards
Green Background: #F0FDF4 (bg-green-50)       - Green KPI cards
Amber Background: #FFFBEB (bg-amber-50)       - Amber KPI cards
Indigo Background: #EEF2FF (bg-indigo-50)     - Indigo KPI cards
Red Background: #FEE2E2 (bg-red-50)           - Error messages
Slate Background: #F8FAFC (bg-slate-50)       - Preview boxes
```

### Text Colors
```
Primary Text: #0F172A (text-slate-900)        - Headings, important
Secondary Text: #475569 (text-slate-700)      - Body text
Subtle Text: #78716C (text-slate-600)         - Labels, hints
Blue Text: #0369A1 (text-blue-700)            - Blue values
Green Text: #15803D (text-green-700)          - Green values
Red Text: #B91C1C (text-red-700)              - Red values, errors
```

---

## 📐 Spacing & Sizing

### Container Width
- Desktop: max-w-2xl (for AdminSOAAdjustments)
- Desktop: container (full for StatementOfAccounts)
- Mobile: full width with padding

### Card Spacing
- Padding: p-4 (mobile) to p-6 (desktop)
- Gap between cards: space-y-6
- Gap between columns: gap-4

### Font Sizes
```
Headings: text-2xl (h1) to text-sm (labels)
Body: text-sm to text-base
Small: text-xs
Numbers: text-lg to text-2xl (KPI values)
```

### Border Radius
```
Cards: rounded-xl (12px)
Buttons: rounded-lg (8px)
Pills: rounded (4px)
Preview: rounded-lg (8px)
```

---

## ✨ Animations & Interactions

### Loading Spinner
```
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
// Rotates continuously
```

### Hover Effects
```
Table Rows: hover:bg-slate-50 transition-colors
Buttons: Active states
Links: Color change on hover
Cards: Shadow on hover (optional)
```

### Button States
```
Enabled: Full opacity, pointer cursor
Disabled: Gray color, opacity-50, not-allowed cursor
Loading: "Processing..." text, disabled state
```

---

**Version**: 1.0
**Created**: January 26, 2026
**Status**: Production Ready ✅
