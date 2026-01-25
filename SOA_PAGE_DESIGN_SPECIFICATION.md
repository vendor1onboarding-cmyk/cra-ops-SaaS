# 📐 SOA PAGE DESIGN SPECIFICATION

## Overview

This document contains the complete UI/UX design specifications for the Statement of Accounts pages, including wireframes, user flows, design patterns, and acceptance criteria.

---

## 📋 TABLE OF CONTENTS

1. [Design Overview](#design-overview)
2. [Custodian SOA View](#custodian-soa-view)
3. [Admin SOA Adjustments](#admin-soa-adjustments)
4. [User Flows](#user-flows)
5. [Design System](#design-system)
6. [Acceptance Criteria](#acceptance-criteria)
7. [Responsive Design](#responsive-design)

---

## 🎨 DESIGN OVERVIEW

### Design Goals

1. **Clarity**: Easy to understand financial data
2. **Efficiency**: Minimal clicks to accomplish tasks
3. **Safety**: Prevent accidental changes
4. **Accessibility**: WCAG AA compliance
5. **Mobile-First**: Works great on phones

### Design Principles

- **Clear hierarchy**: Most important info first
- **Progressive disclosure**: Show details on demand
- **Consistent patterns**: Familiar to users
- **Error prevention**: Validate before submission
- **Feedback**: Clear confirmation of actions

---

## 📱 CUSTODIAN SOA VIEW

### Page Purpose

Allow custodians to:
- View their daily Statement of Accounts
- Track cash movements and balances
- Export data for records
- Print for archival

### Page Layout

```
┌─────────────────────────────────────────────────────────┐
│  Statement of Accounts                         🏠 Menu   │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  📊 Key Metrics                                          │
│  ┌───────────┬───────────┬───────────┬───────────┐      │
│  │ 📦 Picked │ 🚗 Loaded │ 🎁 Allow  │ 💰 Net    │      │
│  │ ₹50,000   │ ₹30,000   │ ₹500      │ ₹20,500   │      │
│  └───────────┴───────────┴───────────┴───────────┘      │
│                                                           │
│  🔍 Filters                                              │
│  From: [01/01/2026    ▼] To: [26/01/2026    ▼]         │
│                                                           │
│  📥 Import   📤 Export   🖨️ Print                        │
│                                                           │
│  📋 SOA Records                                          │
│  ┌─────┬──────────┬────────┬────────┬─────────┬────────┐│
│  │ ID  │   Date   │ Picked │ Loaded │ Adjust  │  Net   ││
│  ├─────┼──────────┼────────┼────────┼─────────┼────────┤│
│  │ SOA │ 26/01/26 │ 50,000 │ 30,000 │ 1,000   │ 21,000 ││
│  │ 001 │          │        │        │         │        ││
│  ├─────┼──────────┼────────┼────────┼─────────┼────────┤│
│  │ SOA │ 25/01/26 │ 45,000 │ 28,000 │ 0       │ 17,000 ││
│  │ 002 │          │        │        │         │        ││
│  └─────┴──────────┴────────┴────────┴─────────┴────────┘│
│                                                           │
│  Total Picked: ₹95,000    Loaded: ₹58,000    Net: ₹38,000
│                                                           │
└─────────────────────────────────────────────────────────┘
```

### Components

#### 1. Header Section
```
┌─────────────────────────────────────────────────────┐
│  📊 Statement of Accounts                           │
│  Last updated: Today at 2:30 PM                     │
└─────────────────────────────────────────────────────┘
```

**Content**:
- Page title
- "My SOA" or "View SOA"
- Last update timestamp

#### 2. KPI Cards
```
┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ 📦 Cash       │  │ 🚗 Cash       │  │ 🎁 Travel     │  │ 💰 Net        │
│ Picked        │  │ Loaded        │  │ Allowance     │  │ Position      │
├───────────────┤  ├───────────────┤  ├───────────────┤  ├───────────────┤
│ ₹ 50,000      │  │ ₹ 30,000      │  │ ₹ 500         │  │ ₹ 20,500      │
│ (Green)       │  │ (Blue)        │  │ (Orange)      │  │ (Purple)      │
└───────────────┘  └───────────────┘  └───────────────┘  └───────────────┘
```

**Design**:
- Card with icon + title + amount
- Color coding: Green (picked), Blue (loaded), Orange (allowance), Purple (net)
- Large, easy-to-read numbers
- Indian format with ₹ symbol

#### 3. Filter Section
```
┌─────────────────────────────────────────────────────┐
│ 🔍 Filter by Date                                  │
│ ┌──────────────────────┐  ┌──────────────────────┐ │
│ │ From: [01/01/2026  ▼] │ │ To: [26/01/2026    ▼]│ │
│ └──────────────────────┘  └──────────────────────┘ │
│ [Reset Filters]                                     │
└─────────────────────────────────────────────────────┘
```

**Design**:
- Two date inputs (From, To)
- Calendar picker UI
- Reset button to clear filters
- Auto-apply on change
- Default: Current month

#### 4. Action Buttons
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 📤 Export CSV│ │ 🖨️  Print     │ │ 📋 Copy Link │
└──────────────┘ └──────────────┘ └──────────────┘
```

**Design**:
- Grouped together above table
- Icons + text
- Primary color for export
- Secondary color for print
- Success feedback on click

#### 5. Data Table
```
┌──────┬────────────┬──────────┬──────────┬──────────┬──────────┬─────────┐
│ Sel. │ Date       │ Picked   │ Loaded   │ Adjusted │ Excess   │ Net     │
├──────┼────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ ☐    │ 26/01/2026 │ 50,000   │ 30,000   │ 1,000    │ 0        │ 21,000  │
├──────┼────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ ☐    │ 25/01/2026 │ 45,000   │ 28,000   │ 0        │ 0        │ 17,000  │
├──────┼────────────┼──────────┼──────────┼──────────┼──────────┼─────────┤
│ ☐    │ 24/01/2026 │ 48,000   │ 32,000   │ -2,000   │ 500      │ 13,500  │
└──────┴────────────┴──────────┴──────────┴──────────┴──────────┴─────────┘
├──────────────────────────────────────────────────────────────────────────┤
│ Total │ 3 records │ 143,000  │ 90,000   │ -1,000   │ 500      │ 51,500  │
└──────────────────────────────────────────────────────────────────────────┘
```

**Design**:
- **Striped rows**: Alternating white/light gray for readability
- **Hover effect**: Row highlights on hover
- **Right-aligned**: Numbers are right-aligned for scanning
- **Thousand separators**: ₹50,000 (not ₹50000)
- **Scrollable**: Horizontal scroll on mobile
- **Column sizing**: Auto-sized with overflow
- **Footer row**: Shows totals for each column

#### 6. Empty State
```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                    📭                               │
│            No SOA records found                     │
│                                                      │
│        Try adjusting your date filters or          │
│        check back later for new records.           │
│                                                      │
│              [← Back] [Try Again]                   │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Design**:
- Large icon (📭)
- Friendly message
- Helpful suggestion
- Action buttons

#### 7. Loading State
```
┌─────────────────────────────────────────────────────┐
│                                                      │
│                  ⌛ Loading...                       │
│              Fetching your records...              │
│                                                      │
│                (Spinner animation)                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Design**:
- Centered loading animation
- Friendly message
- Transparent overlay (for in-page loading)

#### 8. Error State
```
┌─────────────────────────────────────────────────────┐
│  ⚠️  Unable to load records                         │
│                                                      │
│  Error: Network timeout                            │
│                                                      │
│  [Retry]  [Contact Support]                        │
│                                                      │
└─────────────────────────────────────────────────────┘
```

**Design**:
- Warning icon (⚠️)
- Error message (user-friendly)
- Technical details (collapsed)
- Retry button
- Support link

---

## 🔧 ADMIN SOA ADJUSTMENTS

### Page Purpose

Allow admins to:
- View SOA records
- Make manual adjustments
- Add reason for audit trail
- Preview impact before submit

### Page Layout

```
┌─────────────────────────────────────────────────────┐
│  SOA Adjustments                            🏠 Menu  │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Make corrections to Statement of Accounts          │
│  Adjust cash positions for any discrepancies       │
│                                                      │
│  📋 Select SOA Record                              │
│  ┌─────────────────────────────────────────────┐   │
│  │ Select SOA...                          🔽   │   │
│  └─────────────────────────────────────────────┘   │
│                                                      │
│  Selected Details                                   │
│  ┌────────────────────────────────────────────┐   │
│  │ Custodian: John Doe                        │   │
│  │ Date: 26/01/2026                           │   │
│  │ Current Position: ₹20,500                  │   │
│  └────────────────────────────────────────────┘   │
│                                                      │
│  ✏️ Enter Adjustment                               │
│  ┌──────────────────────────────────────────────┐  │
│  │ Amount:      [________] ₹                    │  │
│  │ Type:        ◉ Credit  ◯ Debit              │  │
│  │ Reason:      [_______________________]     │  │
│  │ Reference:   [_______________________]     │  │
│  │              (Optional - Email/Ticket)      │  │
│  └──────────────────────────────────────────────┘  │
│                                                      │
│  👁️  Preview                                       │
│  ┌────────────────────────────────────────────┐   │
│  │ Current Position:   ₹20,500                │   │
│  │ Adjustment:         +₹1,000 (CREDIT)       │   │
│  │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │   │
│  │ New Position:       ₹21,500                │   │
│  └────────────────────────────────────────────┘   │
│                                                      │
│  [Reset]  [Submit Adjustment]                      │
│                                                      │
└─────────────────────────────────────────────────────┘
```

### Components

#### 1. Header
```
┌─────────────────────────────────────────────────────┐
│  ✏️ SOA Adjustments                                │
│  Make manual corrections to cash positions         │
└─────────────────────────────────────────────────────┘
```

#### 2. SOA Selection Dropdown
```
┌────────────────────────────────────────────────┐
│ Select SOA...                              🔽  │
├────────────────────────────────────────────────┤
│ John Doe - 26/01/2026 - ₹20,500             │
│ Jane Smith - 26/01/2026 - ₹15,300           │
│ Mike Johnson - 25/01/2026 - ₹18,200         │
│ Sarah Williams - 25/01/2026 - ₹22,100       │
└────────────────────────────────────────────────┘
```

**Design**:
- Shows custodian name, date, current position
- Searchable by name or ID
- Sorted by date (newest first)
- Shows up to 50 recent records

#### 3. Selected Details Card
```
┌──────────────────────────────────────────────┐
│ SOA Details                                  │
├──────────────────────────────────────────────┤
│ Custodian:    John Doe                       │
│ Assignment:   26/01/2026                     │
│ Current Pos:  ₹ 20,500                       │
│ Cash Picked:  ₹ 50,000                       │
│ Cash Loaded:  ₹ 30,000                       │
└──────────────────────────────────────────────┘
```

**Design**:
- Shows key info about selected SOA
- Read-only info
- Light background color
- Clear labels

#### 4. Adjustment Form
```
Amount:
┌──────────────────┐
│ 1000             │
└──────────────────┘
Error (if invalid): ⚠️ Please enter a positive number

Adjustment Type:
◉ Credit (Add money)    ◯ Debit (Subtract money)

Reason (Required):
┌──────────────────────────────────────────────┐
│ Correction for overcounting in cash load     │
└──────────────────────────────────────────────┘
Error (if empty): ⚠️ Reason is required

Reference (Optional):
┌──────────────────────────────────────────────┐
│ EMAIL-REF-123456                             │
└──────────────────────────────────────────────┘
(For email/ticket tracking)
```

**Design**:
- **Amount field**: Large input, right-aligned, ₹ symbol
- **Type toggle**: Radio buttons (visual clarity)
- **Reason field**: Larger text area (multi-line)
- **Reference field**: Optional, gray placeholder
- **Error messages**: Red, icon (⚠️), under field
- **Real-time validation**: Shows errors as you type

#### 5. Preview Section
```
┌──────────────────────────────────────────────┐
│ 👁️ Preview Impact                            │
├──────────────────────────────────────────────┤
│                                              │
│ Current Position ......... ₹ 20,500         │
│                                              │
│ Adjustment Type: CREDIT                    │
│ Amount .................. + ₹ 1,000         │
│                                              │
│ ──────────────────────────────────────────  │
│                                              │
│ New Position ............ ₹ 21,500         │
│                                              │
└──────────────────────────────────────────────┘
```

**Design**:
- Shows calculation step-by-step
- Uses +/- signs for clarity
- Larger font for new position
- Dashed line separator
- Only visible if amount entered
- Auto-updates on change

#### 6. Action Buttons
```
[Reset Form]  [Submit Adjustment]
```

**Design**:
- **Reset**: Secondary button (gray)
- **Submit**: Primary button (blue), disabled if form invalid
- Both have hover effects
- Submit shows loading spinner when submitting

#### 7. Success Message
```
┌──────────────────────────────────────────────┐
│ ✅ Adjustment posted successfully!           │
│                                              │
│ Position updated: ₹20,500 → ₹21,500        │
│ Redirecting...                               │
└──────────────────────────────────────────────┘
```

**Design**:
- Green background
- Success icon (✅)
- Shows before/after position
- Auto-dismisses after 3 seconds
- User returns to page

#### 8. Help Section
```
┌──────────────────────────────────────────────┐
│ ❓ Help & Information                        │
├──────────────────────────────────────────────┤
│                                              │
│ Q: When should I create an adjustment?      │
│ A: When there's a discrepancy between       │
│    cash picked/loaded vs position           │
│                                              │
│ Q: Can I undo an adjustment?                │
│ A: No, but you can create an opposite       │
│    adjustment (DEBIT if original was CREDIT)│
│                                              │
│ Q: What's the difference between types?     │
│ A: CREDIT adds money, DEBIT subtracts       │
│                                              │
│ Q: Why is reason required?                  │
│ A: For audit trail and compliance           │
│                                              │
└──────────────────────────────────────────────┘
```

**Design**:
- Collapsible section
- Q&A format
- Clear, friendly language
- Located below form

---

## 👥 USER FLOWS

### Flow 1: Custodian Views SOA (Happy Path)

```
START: User clicks "Statement of Accounts"
  ↓
Load page (show spinner)
  ↓
Fetch SOA data from database
  ↓
Display KPI cards (Picked, Loaded, Allowance, Net)
  ↓
Display data table with records
  ↓
Show footer with totals
  ↓
Ready for user interaction
  ↓
USER: Can now:
  - Filter by date
  - Export as CSV
  - Print/Save as PDF
  - View details
  ↓
END: User has information needed
```

### Flow 2: Custodian Exports SOA

```
START: User on SOA view page
  ↓
USER: Clicks "Export CSV" button
  ↓
Show spinner (brief)
  ↓
Generate CSV file:
  - Include all visible columns
  - Format: Indian locale
  - Filename: SOA_2026-01-26.csv
  ↓
Download file to computer
  ↓
Show success message
  ↓
END: File saved to Downloads
```

### Flow 3: Admin Makes Adjustment (Happy Path)

```
START: Admin clicks "SOA Adjustments"
  ↓
Load page with empty form
  ↓
USER: Clicks dropdown to select SOA
  ↓
Dropdown opens with recent SOAs
  ↓
USER: Selects one SOA
  ↓
Show SOA details card (custodian, date, position)
  ↓
USER: Enters adjustment details:
  - Amount: 1000
  - Type: Credit
  - Reason: Correction for overcounting
  ↓
Form validates in real-time:
  ✓ Amount is positive number
  ✓ Type is selected
  ✓ Reason is not empty
  ↓
Preview updates automatically
  ↓
Submit button becomes enabled
  ↓
USER: Reviews preview
  ↓
USER: Clicks "Submit Adjustment"
  ↓
Show spinner on button
  ↓
Send to database:
  - Validate again server-side
  - Create audit record
  - Calculate new position
  ↓
Success message shown
  ↓
Form resets
  ↓
END: Adjustment posted, audit trail created
```

### Flow 4: Admin Sees Validation Error

```
START: Admin on adjustment form
  ↓
USER: Enters invalid data
  - Amount: "abc" (not a number)
  - Amount: 0 (not positive)
  - Reason: (empty)
  ↓
Real-time validation checks
  ↓
Error messages appear under fields:
  ⚠️ "Please enter a positive number"
  ⚠️ "Reason is required"
  ↓
Preview doesn't update (stays blank)
  ↓
Submit button remains DISABLED
  ↓
USER: Sees visual feedback
  ↓
USER: Corrects errors
  ↓
Error messages disappear
  ↓
Preview updates
  ↓
Submit button becomes ENABLED
  ↓
USER: Can now submit
  ↓
END: Form is valid and ready
```

---

## 🎨 DESIGN SYSTEM

### Color Palette

#### Primary Colors
- **Blue (#3b82f6)**: Primary actions, CTA buttons
- **Indigo (#6366f1)**: Highlights, accents

#### Semantic Colors
- **Green (#10b981)**: Success, cash in, positive
- **Red (#ef4444)**: Error, warning, danger
- **Amber (#f59e0b)**: Caution, attention needed
- **Orange (#f97316)**: Travel allowance, special

#### Neutral Colors
- **Slate-900 (#0f172a)**: Text headings
- **Slate-700 (#374151)**: Text body
- **Slate-300 (#cbd5e1)**: Borders, dividers
- **Slate-50 (#f8fafc)**: Backgrounds, subtle

#### Data Colors
- **Cash Picked**: Green (#10b981)
- **Cash Loaded**: Blue (#3b82f6)
- **Travel Allowance**: Orange (#f97316)
- **Net Position**: Purple/Indigo (#6366f1)
- **Adjustment**: Teal (#14b8a6)

### Typography

#### Headings
- **H1**: 32px, bold (600), slate-900
- **H2**: 24px, bold (600), slate-900
- **H3**: 20px, bold (600), slate-900

#### Body Text
- **Large**: 16px, regular (400), slate-700
- **Base**: 14px, regular (400), slate-700
- **Small**: 12px, regular (400), slate-600
- **Tiny**: 11px, regular (400), slate-500

#### Special
- **Monospace** (for amounts): Courier, 16px
- **Bold** (for emphasis): 600 weight

### Spacing

#### Padding
- Component padding: 16px (standard), 12px (compact)
- Section padding: 24px
- Page padding: 32px (desktop), 16px (mobile)

#### Margins
- Between sections: 24px
- Between form fields: 16px
- Between list items: 12px

#### Gaps
- Grid gap: 12px
- Button group gap: 8px

### Buttons

#### Primary Button
```
Background: Blue (#3b82f6)
Text: White, bold
Padding: 12px 24px
Radius: 8px
Hover: Darker blue (#2563eb)
Active: Even darker (#1d4ed8)
Disabled: Gray (#9ca3af), cursor: not-allowed
```

#### Secondary Button
```
Background: Slate-100 (#f1f5f9)
Text: Slate-900, medium weight
Border: Slate-200 (#e2e8f0)
Hover: Slate-200
Active: Slate-300
```

#### Danger Button
```
Background: Red (#ef4444)
Text: White, bold
Hover: Darker red (#dc2626)
```

### Cards

#### Standard Card
```
Background: White
Border: 1px solid #e2e8f0
Radius: 8px
Padding: 16px
Shadow: 0 1px 3px rgba(0,0,0,0.1)
Hover: Shadow increased
```

#### KPI Card
```
Background: White
Border: 2px solid color (depends on metric)
Radius: 12px
Padding: 20px
Font size: Large (24px for amount)
Icon: 32px
```

### Forms

#### Input Field
```
Background: White
Border: 1px solid #d1d5db
Radius: 6px
Padding: 10px 12px
Font: 14px, slate-700
Focus: Blue border (#3b82f6), shadow
Placeholder: Gray (#9ca3af)
Error: Red border (#ef4444), red text below
```

#### Textarea
```
Same as input but:
Min height: 100px
Resize: Vertical only
```

#### Label
```
Font: 14px, bold (600), slate-700
Margin bottom: 6px
Required indicator: Red asterisk (*)
```

### Tables

#### Header Row
```
Background: Slate-100 (#f1f5f9)
Text: Slate-900, bold (600), 14px
Border-bottom: 1px solid #d1d5db
Padding: 12px
```

#### Data Row
```
Background: Alternate white and #f8fafc
Text: Slate-700, 14px
Border-bottom: 1px solid #e2e8f0
Padding: 12px
Hover: Background: #eff6ff (light blue)
```

#### Footer Row
```
Background: Slate-50 (#f8fafc)
Text: Slate-900, bold (600), 14px
Border: 1px solid #e2e8f0
Font-weight: Bold
```

---

## ✅ ACCEPTANCE CRITERIA

### Functional Acceptance Criteria

#### Statement of Accounts View

**AC1: Display KPI Cards**
- [ ] Shows 4 KPI cards: Picked, Loaded, Allowance, Net
- [ ] Each card displays icon, title, and formatted amount
- [ ] Cards use correct color coding
- [ ] Numbers use Indian format (₹ symbol, thousand separators)
- [ ] Updates when filters change

**AC2: Date Range Filtering**
- [ ] Has "From" and "To" date inputs
- [ ] Defaults to current month
- [ ] Calendar picker opens on click
- [ ] Filters table when dates change
- [ ] Shows "Reset Filters" button
- [ ] Reset button clears dates to default

**AC3: Data Table Display**
- [ ] Shows columns: Date, Picked, Loaded, Adjusted, Excess, Net
- [ ] Shows up to 50 records per page
- [ ] Rows alternate white/light gray
- [ ] Numbers are right-aligned
- [ ] Hover effect highlights row
- [ ] Footer shows totals for each numeric column

**AC4: Export CSV**
- [ ] Export button downloads CSV file
- [ ] Filename: SOA_YYYY-MM-DD.csv
- [ ] Includes all visible columns
- [ ] Uses Indian number format
- [ ] Shows success message after export

**AC5: Print Functionality**
- [ ] Print button opens print dialog
- [ ] Print preview shows full page
- [ ] Page breaks handled correctly
- [ ] Headers and footers show on each page
- [ ] Colors/borders print correctly

**AC6: Empty State**
- [ ] Shows "No records found" with icon when no data
- [ ] Shows helpful message with suggestions
- [ ] Shows action buttons (Reset, Back)

**AC7: Loading State**
- [ ] Shows spinner while fetching data
- [ ] Shows "Loading..." message
- [ ] Prevents interaction while loading
- [ ] Clears after data loads

**AC8: Error Handling**
- [ ] Shows error message if query fails
- [ ] Shows "Retry" button
- [ ] Logs error to console
- [ ] Shows user-friendly message (not technical)

#### Admin SOA Adjustments

**AC9: SOA Selection**
- [ ] Dropdown shows all recent SOA records
- [ ] Shows custodian name, date, current position
- [ ] Can search by name
- [ ] Sorted by date (newest first)
- [ ] Selection highlights in different color

**AC10: Details Display**
- [ ] Shows custodian name
- [ ] Shows assignment date (DD/MM/YYYY format)
- [ ] Shows current net position (₹ format)
- [ ] Shows all key cash amounts

**AC11: Amount Input**
- [ ] Input field accepts positive numbers only
- [ ] Shows error if non-numeric input
- [ ] Shows error if zero or negative
- [ ] Real-time validation feedback
- [ ] Cursor in input field

**AC12: Type Selection**
- [ ] Radio buttons for Credit/Debit
- [ ] Only one can be selected at a time
- [ ] Credit is default
- [ ] Visual difference between selected/unselected
- [ ] Labels are clickable

**AC13: Reason Field**
- [ ] Text input/textarea for reason
- [ ] Required field (cannot be empty)
- [ ] Shows error if empty on submit
- [ ] Shows character count (optional)
- [ ] Validates on blur or change

**AC14: Reference Field**
- [ ] Optional text input
- [ ] Shows placeholder "Email/Ticket ID"
- [ ] No validation (optional)
- [ ] Shows help text below field

**AC15: Preview Calculation**
- [ ] Shows current position
- [ ] Shows adjustment amount with sign (+/-)
- [ ] Shows adjustment type (CREDIT/DEBIT)
- [ ] Shows calculated new position
- [ ] Updates in real-time as amount changes
- [ ] Uses dashed line separator
- [ ] Large font for new position
- [ ] Only visible if amount entered

**AC16: Form Validation**
- [ ] Submit button disabled if amount empty
- [ ] Submit button disabled if amount invalid
- [ ] Submit button disabled if reason empty
- [ ] Submit button enabled when all valid
- [ ] Shows validation errors as tooltip or below field
- [ ] All errors clear when field is corrected

**AC17: Form Submission**
- [ ] Submit button shows loading spinner
- [ ] Button is disabled during submission
- [ ] Sends data to database
- [ ] Shows success message after submission
- [ ] Success message includes before/after position
- [ ] Form resets after success
- [ ] Error message shown if submission fails
- [ ] User can retry after error

**AC18: Reset Button**
- [ ] Clears all form fields
- [ ] Clears all validation errors
- [ ] Deselects SOA selection
- [ ] Does not require confirmation

**AC19: Help Section**
- [ ] Shows collapsible "Help" section
- [ ] Contains FAQ format
- [ ] Shows common questions and answers
- [ ] Helps user understand adjustment process
- [ ] Can be expanded/collapsed

### Non-Functional Acceptance Criteria

**AC20: Performance**
- [ ] Page loads in < 3 seconds
- [ ] Table renders < 500ms for 100 rows
- [ ] Export generates < 2 seconds
- [ ] Filters apply < 500ms
- [ ] Validation checks < 100ms

**AC21: Accessibility**
- [ ] WCAG AA compliant
- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Color not sole indicator
- [ ] Focus indicators visible
- [ ] Form labels associated with inputs

**AC22: Browser Compatibility**
- [ ] Works in Chrome (latest)
- [ ] Works in Firefox (latest)
- [ ] Works in Safari (latest)
- [ ] Works in Edge (latest)
- [ ] Works on Safari iOS
- [ ] Works on Chrome Android

**AC23: Responsive Design**
- [ ] Mobile: < 480px width
- [ ] Tablet: 480px - 1024px width
- [ ] Desktop: > 1024px width
- [ ] Layout adjusts for each breakpoint
- [ ] Touch targets > 48px on mobile
- [ ] Text readable on all sizes

**AC24: Data Security**
- [ ] Custodians only see own data
- [ ] Admins can see all data
- [ ] Role-based access enforced
- [ ] No sensitive data in logs
- [ ] HTTPS only (no HTTP)
- [ ] CSRF protection enabled
- [ ] XSS protection enabled

**AC25: Data Validation**
- [ ] Client-side validation prevents bad input
- [ ] Server-side validation prevents bad data
- [ ] Audit trail created for all changes
- [ ] Calculation accuracy verified
- [ ] No data loss on error

---

## 📱 RESPONSIVE DESIGN

### Mobile (< 480px)

```
┌──────────────────────────────────┐
│ ≡ Menu                           │
├──────────────────────────────────┤
│ Statement of Accounts            │
│                                  │
│ 📊 KPI Cards (Stacked)          │
│ ┌──────────────────────────────┐│
│ │ Picked: ₹50,000              ││
│ └──────────────────────────────┘│
│ ┌──────────────────────────────┐│
│ │ Loaded: ₹30,000              ││
│ └──────────────────────────────┘│
│ (Etc...)                         │
│                                  │
│ 🔍 Filters                       │
│ [From] [To]                      │
│ [↓ Reset] [↓ Export]            │
│                                  │
│ 📋 Table (Scrollable)            │
│ ┌──────────────────────────────┐│
│ │ Date │Picked│Loaded│ Net      ││
│ ├──────────────────────────────┤│
│ │26/01 │50K   │30K   │20.5K   ││
│ │25/01 │45K   │28K   │17K     ││
│ └──────────────────────────────┘│
│ (Swipe left for more columns)   │
│                                  │
└──────────────────────────────────┘
```

**Changes**:
- Single column layout
- KPI cards stacked vertically
- Smaller font sizes (12-14px)
- Full-width inputs
- Buttons stacked
- Table scrollable horizontally
- Touch-friendly (larger tap targets)

### Tablet (480px - 1024px)

```
┌──────────────────────────────────────────────┐
│ ≡ Menu     Statement of Accounts   Settings │
├──────────────────────────────────────────────┤
│                                              │
│ 📊 KPI Cards (2 columns)                   │
│ ┌─────────────────┐ ┌─────────────────┐   │
│ │ Picked: ₹50,000 │ │ Loaded: ₹30,000 │   │
│ └─────────────────┘ └─────────────────┘   │
│ ┌─────────────────┐ ┌─────────────────┐   │
│ │ Allow: ₹500     │ │ Net: ₹20,500    │   │
│ └─────────────────┘ └─────────────────┘   │
│                                              │
│ 🔍 Filters                                  │
│ [From ▼] [To ▼]                            │
│ [Reset] [Export]                           │
│                                              │
│ 📋 Table                                    │
│ ┌──────────────────────────────────────┐   │
│ │ Date │ Picked │ Loaded │ Adj │ Net   │   │
│ ├──────────────────────────────────────┤   │
│ │26/01 │ 50,000 │ 30,000 │ 1K  │ 21K  │   │
│ │25/01 │ 45,000 │ 28,000 │ 0   │ 17K  │   │
│ └──────────────────────────────────────┘   │
│                                              │
└──────────────────────────────────────────────┘
```

**Changes**:
- 2-column layout for KPI cards
- Medium font sizes (14-16px)
- Side-by-side inputs/buttons
- Table has all visible columns
- Touch targets still large (> 44px)

### Desktop (> 1024px)

```
┌────────────────────────────────────────────────────────────────┐
│ Logo    Dashboard | SOA | Admin     Search...     👤 Profile │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Statement of Accounts                                          │
│                                                                 │
│ 📊 KPI Cards (4 columns)                                      │
│ ┌─────────┬─────────┬─────────┬─────────┐                     │
│ │Picked   │ Loaded  │ Allow   │  Net    │                     │
│ │₹50,000  │₹30,000  │₹500     │₹20,500  │                     │
│ └─────────┴─────────┴─────────┴─────────┘                     │
│                                                                 │
│ 🔍 Filters                                                     │
│ [From: ▼] [To: ▼]  [Reset] [📤 Export] [🖨️ Print]          │
│                                                                 │
│ 📋 Data Table                                                  │
│ ┌─────┬────────┬────────┬────────┬────────┬────────┐          │
│ │Date │ Picked │ Loaded │ Adjust │ Excess │  Net   │          │
│ ├─────┼────────┼────────┼────────┼────────┼────────┤          │
│ │26/01│ 50,000 │ 30,000 │  1,000 │    0   │ 21,000 │          │
│ │25/01│ 45,000 │ 28,000 │      0 │    0   │ 17,000 │          │
│ │24/01│ 48,000 │ 32,000 │ -2,000 │  500   │ 13,500 │          │
│ └─────┴────────┴────────┴────────┴────────┴────────┘          │
│                                                                 │
│ Total: ₹143,000  │ ₹90,000  │ -₹1,000 │ ₹500  │ ₹51,500      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

**Changes**:
- 4-column KPI card layout
- Large font sizes (16-18px for body)
- All action buttons visible
- Full table with all columns
- Side navigation visible
- Optimal reading line length maintained

---

## 📋 DESIGN HANDOFF

### Design Files
- Figma wireframes: [Link to design]
- Color specs: [Tailwind config]
- Typography specs: [Font stacks]

### Development Notes
- Use Tailwind CSS utility classes
- Follow responsive design breakpoints
- Test on real devices
- Verify color contrast (WCAG AA)
- Test keyboard navigation
- Test with screen readers

---

**Last Updated**: January 26, 2026  
**Version**: 1.0  
**Status**: Approved for Development

See [SOA_TECHNICAL_GUIDE.md](SOA_TECHNICAL_GUIDE.md) for implementation details.

