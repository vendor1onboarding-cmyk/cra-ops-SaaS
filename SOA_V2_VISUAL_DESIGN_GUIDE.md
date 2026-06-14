# 🎨 SOA V2 - VISUAL DESIGN GUIDE
## UI/UX Mockups & Design Specifications

**Version**: 2.0  
**Date**: February 5, 2026  
**Status**: Design Complete  

---

## 📱 MOBILE-FIRST DESIGN PRINCIPLES

### Core Philosophy
- **Primary Users**: Custodians on mobile devices
- **Secondary Users**: Admins on desktop
- **Approach**: Mobile-first, responsive, progressive enhancement

### Design System
- **Framework**: Tailwind CSS
- **Icons**: Emoji + Unicode symbols
- **Typography**: System fonts (sans-serif)
- **Layout**: Cards, stacked on mobile, grid on desktop

---

## 🎨 COLOR PALETTE

### Semantic Colors

**Primary (Blue)**
```
bg-blue-50     #eff6ff   Light background
bg-blue-100    #dbeafe   Panels
bg-blue-600    #2563eb   Buttons, links
text-blue-700  #1d4ed8   Text
text-blue-800  #1e40af   Headers
```

**Success (Green)**
```
bg-green-50    #f0fdf4   Light background
bg-green-100   #dcfce7   Success messages
bg-green-600   #16a34a   Buttons
text-green-700 #15803d   Inflows, positive
text-green-800 #166534   Headers
```

**Warning (Yellow/Amber)**
```
bg-yellow-50   #fefce8   Light background
bg-amber-100   #fef3c7   Warning panels
text-yellow-800 #854d0e  Warning text
text-amber-900  #78350f  Headers
```

**Danger (Red)**
```
bg-red-50      #fef2f2   Light background
bg-red-100     #fee2e2   Error messages
bg-red-600     #dc2626   Buttons
text-red-700   #b91c1c   Outflows, negative
text-red-800   #991b1b   Headers
```

**Neutral (Slate)**
```
bg-slate-50    #f8fafc   Backgrounds
bg-slate-100   #f1f5f9   Panels
bg-slate-200   #e2e8f0   Borders
text-slate-600 #475569   Body text
text-slate-700 #334155   Labels
text-slate-800 #1e293b   Headers
```

---

## 📐 COMPONENT LIBRARY

### 1. Denomination Input Card

```
┌─────────────────────────────────────┐
│ Denomination Details                │
├─────────────────────────────────────┤
│                                     │
│ ┌───────────────────────────────┐  │
│ │ ₹2000                         │  │
│ │ [      0      ]               │  │
│ └───────────────────────────────┘  │
│                                     │
│ ┌───────────────────────────────┐  │
│ │ ₹500                          │  │
│ │ [      0      ]               │  │
│ └───────────────────────────────┘  │
│                                     │
│ ┌───────────────────────────────┐  │
│ │ ₹200                          │  │
│ │ [      0      ]               │  │
│ └───────────────────────────────┘  │
│                                     │
│ ┌───────────────────────────────┐  │
│ │ ₹100                          │  │
│ │ [      0      ]               │  │
│ └───────────────────────────────┘  │
│                                     │
├─────────────────────────────────────┤
│ Total Amount         ₹ 0.00        │
└─────────────────────────────────────┘
```

**CSS Classes**:
```css
.card {
  @apply bg-white rounded-lg border border-slate-200 p-5 space-y-4;
}

.denom-input {
  @apply w-full px-3 py-2 border border-slate-300 rounded-lg 
         text-sm focus:outline-none focus:ring-2 focus:ring-primary;
}

.denom-label {
  @apply text-sm font-medium text-slate-700;
}

.total-row {
  @apply flex justify-between font-bold text-primary 
         border-t border-slate-200 pt-2;
}
```

---

### 2. KPI Card

```
┌─────────────────────────────┐
│ 💰 Cash Picked             │
│                            │
│      ₹50,000.00           │
│                            │
│ From 2 locations          │
└─────────────────────────────┘
```

**Variants**:

**Success State** (Green):
```css
.kpi-card-success {
  @apply bg-green-50 border-2 border-green-200 rounded-lg p-4;
}
.kpi-value-success {
  @apply text-2xl font-bold text-green-700;
}
```

**Danger State** (Red):
```css
.kpi-card-danger {
  @apply bg-red-50 border-2 border-red-200 rounded-lg p-4;
}
.kpi-value-danger {
  @apply text-2xl font-bold text-red-700;
}
```

**Info State** (Blue):
```css
.kpi-card-info {
  @apply bg-blue-50 border-2 border-blue-200 rounded-lg p-4;
}
.kpi-value-info {
  @apply text-2xl font-bold text-blue-700;
}
```

---

### 3. SOA Section Card (Detailed View)

```
┌─────────────────────────────────────────────┐
│ 📅 January 26, 2026                        │
│ Rajesh Kumar                               │
├─────────────────────────────────────────────┤
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ Opening Balance        ₹ 0.00       │   │ ← Blue background
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 💰 Cash Inflows (+)                 │   │ ← Green header
│ ├─────────────────────────────────────┤   │
│ │   Bank Withdrawals  +₹50,000.00    │   │ ← Green text
│ │   Travel Allowance  +₹   500.00    │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ⚙️ Operations (No Net Impact)       │   │ ← Yellow background
│ ├─────────────────────────────────────┤   │
│ │   Exchanges (2)  [View Details]     │   │ ← Blue link
│ │   Transfers (1)  [View Details]     │   │
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ 📤 Cash Outflows (-)                │   │ ← Red header
│ ├─────────────────────────────────────┤   │
│ │   ATM Loads         -₹50,000.00    │   │ ← Red text
│ └─────────────────────────────────────┘   │
│                                             │
│ ┌─────────────────────────────────────┐   │
│ │ ✓ Closing Balance      ₹ 0.00       │   │ ← Green border (balanced)
│ │   Status: Balanced                  │   │    OR Red (unbalanced)
│ └─────────────────────────────────────┘   │
│                                             │
│ [Show Calculation] [Export] [Print]       │
└─────────────────────────────────────────────┘
```

**CSS Structure**:
```css
.soa-card {
  @apply bg-white rounded-lg shadow-lg p-6 mb-4 space-y-4;
}

.section-header {
  @apply font-semibold text-sm uppercase tracking-wide mb-2;
}

.section-header-green {
  @apply text-green-700;
}

.section-header-red {
  @apply text-red-700;
}

.section-header-yellow {
  @apply text-yellow-800;
}

.amount-green {
  @apply font-mono text-green-600;
}

.amount-red {
  @apply font-mono text-red-600;
}

.closing-balanced {
  @apply bg-green-50 border-2 border-green-500 rounded p-4;
}

.closing-unbalanced {
  @apply bg-red-50 border-2 border-red-500 rounded p-4;
}
```

---

### 4. Exchange Detail Modal

```
┌─────────────────────────────────────────┐
│ Exchange Details                    [×] │
├─────────────────────────────────────────┤
│                                         │
│ Exchange Type: Bank to Bank            │
│ Time: Jan 26, 2026 10:30 AM           │
│                                         │
│ ┌─────────────┐     ┌─────────────┐  │
│ │ FROM        │ ⇄   │ TO          │  │
│ ├─────────────┤     ├─────────────┤  │
│ │ Bank A      │     │ Bank B      │  │
│ │             │     │             │  │
│ │ ₹2000 × 5   │     │ ₹500 × 20   │  │
│ │ = ₹10,000   │     │ = ₹10,000   │  │
│ └─────────────┘     └─────────────┘  │
│                                         │
│ ✓ Amounts Match                        │
│                                         │
│ Reason: Bank requested smaller notes   │
│                                         │
│ [Close]                                │
└─────────────────────────────────────────┘
```

**CSS**:
```css
.modal-overlay {
  @apply fixed inset-0 bg-black bg-opacity-50 
         flex items-center justify-center z-50;
}

.modal-content {
  @apply bg-white rounded-lg shadow-xl p-6 
         max-w-2xl w-full mx-4;
}

.exchange-card {
  @apply grid grid-cols-1 md:grid-cols-2 gap-4 
         border border-slate-200 rounded-lg p-4;
}

.exchange-arrow {
  @apply text-4xl text-blue-600 
         flex items-center justify-center;
}
```

---

## 📱 RESPONSIVE LAYOUTS

### Mobile (<768px)

**Stack Layout**:
```
┌─────────────────────┐
│ Header              │
├─────────────────────┤
│ Card 1              │
│ (Full width)        │
├─────────────────────┤
│ Card 2              │
│ (Full width)        │
├─────────────────────┤
│ Card 3              │
│ (Full width)        │
└─────────────────────┘
```

**Button Layout**:
```
┌─────────────────────┐
│ [Full Width Button] │
├─────────────────────┤
│ [Full Width Button] │
└─────────────────────┘
```

---

### Tablet (768px - 1024px)

**2-Column Grid**:
```
┌─────────────────────────────────┐
│ Header                          │
├──────────────┬──────────────────┤
│ Card 1       │ Card 2           │
│              │                  │
├──────────────┼──────────────────┤
│ Card 3       │ Card 4           │
│              │                  │
└──────────────┴──────────────────┘
```

---

### Desktop (>1024px)

**Multi-Column Grid**:
```
┌─────────────────────────────────────────────┐
│ Header                                      │
├─────────┬─────────┬─────────┬───────────────┤
│ KPI 1   │ KPI 2   │ KPI 3   │ KPI 4         │
├─────────┴─────────┴─────────┴───────────────┤
│                                             │
│ Main Content Area                           │
│ (Full width or split)                       │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🎯 PAGE MOCKUPS

### 1. Denomination Exchange Page (Mobile)

```
┌────────────────────────────────────┐
│ ← Denomination Exchange            │
├────────────────────────────────────┤
│                                    │
│ ┌────────────────────────────────┐│
│ │ Exchange Type *                ││
│ │ ○ Bank to Bank                 ││
│ │ ○ ATM to Bank                  ││
│ └────────────────────────────────┘│
│                                    │
│ ┌────────────────────────────────┐│
│ │ FROM Denominations             ││
│ ├────────────────────────────────┤│
│ │ ₹2000      [  5  ]             ││
│ │ ₹500       [  0  ]             ││
│ │ ₹200       [  0  ]             ││
│ │ ₹100       [  0  ]             ││
│ ├────────────────────────────────┤│
│ │ Total:     ₹10,000.00          ││
│ └────────────────────────────────┘│
│                                    │
│             ⇄                      │
│                                    │
│ ┌────────────────────────────────┐│
│ │ TO Denominations               ││
│ ├────────────────────────────────┤│
│ │ ₹2000      [  0  ]             ││
│ │ ₹500       [ 20  ]             ││
│ │ ₹200       [  0  ]             ││
│ │ ₹100       [  0  ]             ││
│ ├────────────────────────────────┤│
│ │ Total:     ₹10,000.00          ││
│ └────────────────────────────────┘│
│                                    │
│ ✓ Amounts Match                   │
│                                    │
│ ┌────────────────────────────────┐│
│ │ Location / Reason *            ││
│ │ [Bank B - Main Branch      ]   ││
│ └────────────────────────────────┘│
│                                    │
│ [Save Exchange]                    │
│                                    │
└────────────────────────────────────┘
```

---

### 2. Inter-Site Transfer Page (Mobile)

```
┌────────────────────────────────────┐
│ ← Inter-Site Transfer              │
├────────────────────────────────────┤
│                                    │
│ ┌────────────────────────────────┐│
│ │ FROM Site *                    ││
│ │ [▼ ATM Site 1 - ICICI      ]   ││
│ └────────────────────────────────┘│
│                                    │
│             ↓                      │
│                                    │
│ ┌────────────────────────────────┐│
│ │ TO Site *                      ││
│ │ [▼ ATM Site 5 - HDFC       ]   ││
│ └────────────────────────────────┘│
│                                    │
│ ┌────────────────────────────────┐│
│ │ Denominations Being Moved      ││
│ ├────────────────────────────────┤│
│ │ ₹2000      [  0  ]             ││
│ │ ₹500       [ 10  ]             ││
│ │ ₹200       [  0  ]             ││
│ │ ₹100       [  0  ]             ││
│ ├────────────────────────────────┤│
│ │ Total:     ₹5,000.00           ││
│ └────────────────────────────────┘│
│                                    │
│ ┌────────────────────────────────┐│
│ │ Reason *                       ││
│ │ [Rebalancing inventory     ]   ││
│ └────────────────────────────────┘│
│                                    │
│ [Save Transfer]                    │
│                                    │
└────────────────────────────────────┘
```

---

### 3. SOA Detailed View (Mobile)

```
┌────────────────────────────────────┐
│ Statement of Accounts              │
│ [Summary] [Detailed] ← Active      │
├────────────────────────────────────┤
│ From: [01/01/2026] To: [31/01/2026]│
│ [Apply Filter]                     │
├────────────────────────────────────┤
│                                    │
│ ┌────────────────────────────────┐│
│ │ 📅 Jan 26, 2026                ││
│ ├────────────────────────────────┤│
│ │ Opening Balance                ││
│ │             ₹ 0.00             ││
│ └────────────────────────────────┘│
│                                    │
│ ┌────────────────────────────────┐│
│ │ 💰 Inflows (+)                 ││
│ │   Withdrawals   +₹50,000.00    ││
│ │   Allowance     +₹   500.00    ││
│ └────────────────────────────────┘│
│                                    │
│ ┌────────────────────────────────┐│
│ │ ⚙️ Operations                  ││
│ │   Exchanges (2) [View]         ││
│ │   Transfers (1) [View]         ││
│ └────────────────────────────────┘│
│                                    │
│ ┌────────────────────────────────┐│
│ │ 📤 Outflows (-)                ││
│ │   ATM Loads     -₹50,000.00    ││
│ └────────────────────────────────┘│
│                                    │
│ ┌────────────────────────────────┐│
│ │ ✓ Closing           ₹ 500.00   ││ ← Red if not zero
│ │ ⚠️ Unreconciled                ││
│ └────────────────────────────────┘│
│                                    │
│ [Export CSV] [Print PDF]           │
│                                    │
│ ─────────────────────────────────  │
│                                    │
│ (More records...)                  │
│                                    │
└────────────────────────────────────┘
```

---

### 4. Admin Adjustment History (Desktop)

```
┌────────────────────────────────────────────────────────────┐
│ SOA Adjustments - Admin                                    │
├────────────────────────────────────────────────────────────┤
│ [Adjustment Form Section]                                  │
│ (Existing functionality)                                   │
├────────────────────────────────────────────────────────────┤
│                                                            │
│ Recent Adjustments                                         │
│                                                            │
│ [All] [Credits (5)] [Debits (3)] [Exchanges (2)] [Transfers (1)]
│                                                            │
│ ┌────────────────────────────────────────────────────────┐│
│ │ [EXCHANGE] Jan 26, 2026 10:30 AM       ₹0.00     ⇄   ││ ← Yellow badge
│ │ Exchange: Bank A → Bank B                            ││
│ │ By: Admin User                                       ││
│ │ [Show Exchange Details ▼]                            ││
│ │                                                      ││
│ │   ┌──────────────┬──────────────┐                   ││
│ │   │ FROM         │ TO           │                   ││
│ │   │ ₹2000 × 5    │ ₹500 × 20    │                   ││
│ │   │ = ₹10,000    │ = ₹10,000    │                   ││
│ │   └──────────────┴──────────────┘                   ││
│ └────────────────────────────────────────────────────────┘│
│                                                            │
│ ┌────────────────────────────────────────────────────────┐│
│ │ [CREDIT] Jan 25, 2026 14:00 PM        +₹500.00      ││ ← Green badge
│ │ Correction for missing pickup                        ││
│ │ By: Supervisor                                       ││
│ │ Ref: #TICK-12345                                     ││
│ └────────────────────────────────────────────────────────┘│
│                                                            │
│ ┌────────────────────────────────────────────────────────┐│
│ │ [INTER_SITE_TRANSFER] Jan 24, 2026     ₹0.00       →││ ← Blue badge
│ │ Transfer: Site 1 → Site 5 (₹5,000)                   ││
│ │ By: Custodian                                        ││
│ │ Reason: Rebalancing inventory                        ││
│ └────────────────────────────────────────────────────────┘│
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🎨 INTERACTION STATES

### Button States

**Normal**:
```css
.btn-primary {
  @apply bg-blue-600 text-white py-2.5 px-6 rounded-lg 
         font-semibold transition-all;
}
```

**Hover**:
```css
.btn-primary:hover {
  @apply bg-blue-700 shadow-md;
}
```

**Active (Pressed)**:
```css
.btn-primary:active {
  @apply scale-95;
}
```

**Disabled**:
```css
.btn-primary:disabled {
  @apply opacity-50 cursor-not-allowed;
}
```

---

### Input States

**Normal**:
```css
.input {
  @apply border border-slate-300 rounded-lg px-3 py-2 
         text-sm focus:outline-none;
}
```

**Focus**:
```css
.input:focus {
  @apply ring-2 ring-primary border-primary;
}
```

**Error**:
```css
.input-error {
  @apply border-red-500 ring-2 ring-red-200;
}
```

**Success**:
```css
.input-success {
  @apply border-green-500 ring-2 ring-green-200;
}
```

---

## ✨ ANIMATIONS

### Fade In
```css
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.fade-in {
  animation: fadeIn 0.3s ease-in;
}
```

### Slide Down
```css
@keyframes slideDown {
  from { 
    opacity: 0;
    transform: translateY(-10px);
  }
  to { 
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-down {
  animation: slideDown 0.3s ease-out;
}
```

### Pulse (for loading)
```css
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading {
  animation: pulse 2s ease-in-out infinite;
}
```

---

## 📐 SPACING SYSTEM

### Padding/Margin Scale
```
p-1  = 0.25rem (4px)
p-2  = 0.5rem  (8px)
p-3  = 0.75rem (12px)
p-4  = 1rem    (16px)
p-5  = 1.25rem (20px)
p-6  = 1.5rem  (24px)
p-8  = 2rem    (32px)
```

### Usage Guidelines
- **Card padding**: `p-5` or `p-6`
- **Button padding**: `py-2.5 px-6`
- **Input padding**: `px-3 py-2`
- **Section spacing**: `space-y-4` or `space-y-6`
- **Grid gaps**: `gap-3` or `gap-4`

---

## 🔤 TYPOGRAPHY SCALE

### Font Sizes
```
text-xs   = 0.75rem (12px)
text-sm   = 0.875rem (14px)
text-base = 1rem (16px)
text-lg   = 1.125rem (18px)
text-xl   = 1.25rem (20px)
text-2xl  = 1.5rem (24px)
```

### Usage Guidelines
- **Body text**: `text-sm` or `text-base`
- **Labels**: `text-sm font-medium`
- **Headers**: `text-lg font-bold` or `text-xl font-bold`
- **KPI values**: `text-2xl font-bold`
- **Small print**: `text-xs`

---

## 🎯 ACCESSIBILITY

### Color Contrast
- All text meets WCAG AA standards (4.5:1 ratio)
- Interactive elements have 3:1 contrast with background

### Focus Indicators
- Visible focus rings on all interactive elements
- `focus:ring-2` and `focus:outline-none` pattern

### Touch Targets
- Minimum 44x44px for mobile buttons
- Adequate spacing between interactive elements

### Screen Reader Support
- Semantic HTML (buttons, labels, headings)
- ARIA labels where needed
- Keyboard navigation support

---

## ✅ DESIGN CHECKLIST

### Before Implementation
- [ ] Color palette defined
- [ ] Component library designed
- [ ] Responsive breakpoints planned
- [ ] Mobile mockups created
- [ ] Desktop mockups created

### During Implementation
- [ ] CSS classes match design
- [ ] Colors from palette used
- [ ] Spacing system followed
- [ ] Typography scale applied
- [ ] Responsive tested

### After Implementation
- [ ] Accessibility validated
- [ ] Mobile tested on devices
- [ ] Desktop tested on browsers
- [ ] Dark mode considered (future)
- [ ] Print styles working

---

**Design Status**: ✅ Complete  
**Implementation Ready**: ✅ Yes  
**Figma/Mockup**: ASCII art provided  

**Next Step**: Begin Week 2 of implementation with these designs as reference.
