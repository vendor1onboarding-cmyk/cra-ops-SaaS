# Print Format Standardization Guide

**Date**: January 26, 2026  
**Purpose**: Ensure consistent print headers and footers across all pages in the Sruthi CRA application  
**Standard Source**: Dashboard.tsx (Custodian Dashboard)  

---

## 📋 Overview

All printable pages in the Sruthi CRA application should use the same standardized header and footer format. This ensures:
- Professional appearance for printed documents
- Consistent branding with bank logo
- Clear document identification and date
- Signature sections for official records
- RBI compliance messaging

---

## 🎨 Standard Print Header

The header should appear **only in print mode** and contain:
1. Bank logo (left side)
2. Application name and description (left side)
3. Report title, period/date, and user info (right side)

### Header Code Template

```jsx
{/* ===== PRINT HEADER WITH LOGO ===== */}
<div className="print-only mb-4 border-b pb-3">
  <div className="flex justify-between items-start">
    <div className="flex items-center gap-3">
      {/* Bank Logo */}
      <img
        src="/bank-logo.png"
        alt="Bank Logo"
        className="h-10 w-auto"
      />

      <div>
        <h1 className="text-xl font-bold">Sruthi CRA Ops</h1>
        <p className="text-xs text-slate-600">
          Cash Replenishment & ATM Operations
        </p>
      </div>
    </div>

    <div className="text-right text-xs">
      <p className="font-semibold">[REPORT_TITLE]</p>
      <p>[REPORT_DETAILS_LINE_1]</p>
      <p>Date: {new Date().toLocaleDateString("en-IN")}</p>
      {profile?.full_name && (
        <p>[USER_TITLE]: {profile.full_name}</p>
      )}
    </div>
  </div>
</div>
```

### Header Classes Explained

| Class | Purpose |
|-------|---------|
| `print-only` | Only visible in print mode |
| `mb-4` | Margin bottom for spacing |
| `border-b pb-3` | Bottom border separator with padding |
| `flex justify-between items-start` | Layout: logo on left, info on right |
| `text-xs` | Small font for right section |
| `text-right` | Align right-side content to right |

---

## 🖊️ Standard Print Footer

The footer should appear **only in print mode** and contain:
1. Two-column signature section (Custodian and Officer)
2. RBI compliance message

### Footer Code Template

```jsx
{/* ===== PRINT FOOTER – SIGNATURES ===== */}
<div className="print-only mt-10 pt-6 border-t text-xs text-slate-700">
  <div className="grid grid-cols-2 gap-12">
    <div>
      <p className="font-semibold">Custodian Signature</p>
      <div className="mt-6 border-b w-48"></div>
      <p className="mt-1">Name & Date</p>
    </div>

    <div className="text-right">
      <p className="font-semibold">Supervisor / Bank Officer</p>
      <div className="mt-6 border-b w-48 ml-auto"></div>
      <p className="mt-1">Name, Seal & Date</p>
    </div>
  </div>

  <p className="mt-6 text-[10px] text-slate-500">
    This is a system-generated report from Sruthi CRA Ops.
    Any discrepancy must be reported within RBI-prescribed timelines.
  </p>
</div>
```

### Footer Classes Explained

| Class | Purpose |
|-------|---------|
| `print-only` | Only visible in print mode |
| `mt-10 pt-6` | Top margin and padding for spacing |
| `border-t` | Top border separator |
| `text-xs` | Small font size |
| `grid grid-cols-2 gap-12` | Two-column layout with spacing |
| `border-b w-48` | Signature line (width 48 units) |
| `text-[10px]` | Smaller font for disclaimer |

---

## 🔄 Implementation Checklist

When adding print functionality to a page, follow this checklist:

### Step 1: Add Print Button
```jsx
<button
  onClick={() => window.print()}
  className="btn-primary"
>
  🖨️ Print / PDF
</button>
```

### Step 2: Add Print Header
- Copy the header template above
- Replace `[REPORT_TITLE]` with actual title (e.g., "Statement of Accounts Report")
- Replace `[REPORT_DETAILS_LINE_1]` with relevant info (e.g., "Period: 2026-01-01 to 2026-01-26")
- Replace `[USER_TITLE]` with appropriate role (e.g., "Custodian")

### Step 3: Add Print Footer
- Copy the footer template above
- Use exact text for signature lines (standardized across all pages)

### Step 4: Hide UI Elements on Print
```jsx
// Add print:hidden to buttons, filters, etc.
<div className="flex gap-2 print:hidden">
  <button>Export CSV</button>
  <button>Print</button>
</div>
```

### Step 5: Optimize Table for Print
```jsx
// Add print-specific classes to table
<table className="w-full text-sm">
  <thead className="bg-slate-100 border-b border-slate-200">
    {/* Headers */}
  </thead>
  {/* Content */}
</table>
```

---

## 📄 Pages with Print Implementation

### ✅ Implemented (Standard Format)

**1. Dashboard.tsx** (Custodian Dashboard)
- ✅ Print header with logo (REFERENCE PAGE)
- ✅ Print footer with signatures
- ✅ Status badge indicators
- ✅ Hides UI controls on print

**2. StatementOfAccounts.tsx** (SOA Report)
- ✅ Print header with logo (UPDATED to match standard)
- ✅ Print footer with signatures (UPDATED to match standard)
- ✅ Shows date range in header
- ✅ Hides filters and buttons on print

### 📋 Pages to Check

**Potential pages that might need print functionality:**
- [ ] AdminDashboard.tsx
- [ ] AdminSOAAdjustments.tsx
- [ ] AdminEODDetail.tsx
- [ ] EODSummary.tsx
- [ ] AdminApprovals.tsx
- [ ] TravelTracking.tsx
- [ ] DenominationPlan.tsx

---

## 🎯 Report-Specific Customizations

While the header and footer structure is standardized, customize the header info based on report type:

### Dashboard Report (Daily Cash Operations)
```jsx
<p className="font-semibold">Daily Cash Operations Report</p>
<p>Date: {new Date().toLocaleDateString("en-IN")}</p>
<p>Custodian: {profile?.full_name}</p>
```

### SOA Report (Statement of Accounts)
```jsx
<p className="font-semibold">Statement of Accounts Report</p>
<p>Period: {fromDate} to {toDate}</p>
<p>Date: {new Date().toLocaleDateString("en-IN")}</p>
<p>Custodian: {profile?.full_name}</p>
```

### EOD Report (End of Day)
```jsx
<p className="font-semibold">End of Day Summary Report</p>
<p>Date: {new Date().toLocaleDateString("en-IN")}</p>
<p>Custodian: {profile?.full_name}</p>
```

### Travel Report
```jsx
<p className="font-semibold">Travel Tracking Report</p>
<p>Period: {startDate} to {endDate}</p>
<p>Date: {new Date().toLocaleDateString("en-IN")}</p>
<p>Custodian: {profile?.full_name}</p>
```

---

## 🖨️ CSS Requirements

Ensure the following CSS is present in `styles/global.css`:

```css
/* Print-only elements */
.print-only {
  display: none;
}

@media print {
  .print-only {
    display: block;
  }
  
  .print:hidden {
    display: none;
  }

  /* Hide navbar and sidebars */
  nav {
    display: none;
  }

  /* Optimize for print */
  body {
    background: white;
    color: black;
  }

  /* Avoid page breaks in tables */
  table {
    page-break-inside: avoid;
  }

  tr {
    page-break-inside: avoid;
  }

  /* Ensure proper margins */
  @page {
    margin: 0.5in;
  }
}
```

---

## 📐 Print Layout Best Practices

### Margins and Spacing
- Header margin-bottom: 1rem (`mb-4`)
- Footer margin-top: 2.5rem (`mt-10`)
- Footer padding-top: 1.5rem (`pt-6`)

### Font Sizes
- Header title: `text-xl` (larger, bold)
- Header details: `text-xs` (smaller)
- Footer text: `text-xs` (standard)
- Footer disclaimer: `text-[10px]` (smallest)

### Colors for Print
- Use `text-slate-700` for main content
- Use `text-slate-600` for secondary text
- Use `text-slate-500` for disclaimers
- Use `border-slate-300` for borders

### Spacing Between Sections
```
Header
  |
  border-b pb-3 (3-unit bottom padding)
  |
Content (tables, data)
  |
  mt-10 (10-unit top margin for footer)
  pt-6 (6-unit top padding for footer)
  border-t (top border)
Footer
```

---

## ✅ Quality Checklist

Before printing a report, verify:

- [ ] **Header appears on first page only**: Uses `print-only` class
- [ ] **Header includes bank logo**: Visible and properly sized (`h-10`)
- [ ] **Header shows report title**: Relevant to page content
- [ ] **Header shows date**: Using IST format via `toLocaleDateString("en-IN")`
- [ ] **Header shows user info**: Custodian/user name displayed
- [ ] **Footer appears on last page**: Uses `print-only` class
- [ ] **Footer has signature lines**: Two columns with borders
- [ ] **Footer has disclaimer**: RBI compliance message present
- [ ] **UI buttons hidden**: Print/Export buttons don't show
- [ ] **Filters hidden**: Date filters, search bars not visible
- [ ] **Tables format correctly**: No page breaks mid-table
- [ ] **No blank pages**: Proper spacing and sizing
- [ ] **Color printing works**: Black text, no background colors

---

## 🔄 Update History

| Date | Change | Pages Affected |
|------|--------|-----------------|
| 2026-01-26 | Standardized print format | StatementOfAccounts.tsx |
| 2026-01-26 | Created standardization guide | All pages |

---

## 📞 Support & Questions

For questions about print formatting:
1. Review this guide
2. Check Dashboard.tsx as reference
3. Check StatementOfAccounts.tsx as example
4. Compare CSS classes to this document

---

## 🎓 Remember

**Key Principles:**
- ✅ One standard format across all pages
- ✅ Professional appearance with bank branding
- ✅ Clear document identification
- ✅ Proper signature sections
- ✅ RBI compliance messaging
- ✅ Hidden UI controls on print
- ✅ Optimized table layouts

**When in doubt:** Look at Dashboard.tsx or StatementOfAccounts.tsx for reference implementation.

---

**Standard Enforced**: Yes ✅  
**Reference Pages**: Dashboard.tsx, StatementOfAccounts.tsx  
**Next Review**: As new printable pages are added
