# 🎯 SOA Pages - Quick Reference Guide

## 📱 For Custodians

### Access
- **URL**: `/soa`
- **Menu**: "Statement of Accounts"
- **Access**: Automatic after login

### What You Can Do
✅ View your personal SOA records
✅ Filter records by date range
✅ See monthly cash flow summary
✅ Export SOA data as CSV
✅ Print/Save as PDF with signatures

### Key Metrics You See
- **Total Picked**: Cash amount picked up
- **Total Loaded**: Cash amount loaded to ATMs
- **Travel Allowance**: Your travel reimbursement
- **Net Position**: Your final cash balance

### How to Use
1. Open "Statement of Accounts" from menu
2. Select date range (defaults to current month)
3. View your records in the table
4. Click "Export CSV" to download data
5. Click "Print / PDF" to save for records

---

## 👨‍💼 For Admins/Supervisors

### Pages Access

#### 1. Statement of Accounts
- **URL**: `/soa`
- **Menu**: "Statement of Accounts" (Custodian menu) or View from Dashboard
- **What's Different**: See ALL custodian records with names

#### 2. SOA Adjustments
- **URL**: `/admin/soa-adjustments`
- **Menu**: "SOA Adjustments" (Admin menu)
- **Purpose**: Manually adjust SOA records when needed

### Statement of Accounts (Admin View)
✅ See all custodian SOA records
✅ Filter by date range
✅ Identify custodians by name in table
✅ Export all records as CSV
✅ Print for compliance and audit

### SOA Adjustments (Admin Only)
✅ Select any custodian's SOA record
✅ Make manual adjustments (corrections)
✅ Add detailed reason for adjustment
✅ Add reference number for tracking
✅ Preview adjustment before submitting
✅ See impact on final net position

### When to Review Adjustments
- Audit operational movements (exchanges, transfers)
- Investigate reconciliation mismatches
- Validate transfer metadata

---

## 🔧 Adjustment Workflow

### Step 1: Select Record
```
1. Open "SOA Adjustments" from admin menu
2. Click dropdown "Select Assignment/SOA"
3. Choose custodian's record by:
   - Date (📅)
   - Assignment ID (#)
   - Custodian name
```

### Step 2: Review Operational History
```
Filter by type:
  - Exchange
  - Inter-site Transfer
- Optional: Include legacy Credit/Debit (read-only)

Open any record to review metadata
```

---

## 📊 Key Features

### Data Validation ✅
- Operational adjustments are system-generated
- Legacy credit/debit are read-only for audit

### Error Messages 📢
- Clear error descriptions
- Helpful guidance
- Visual indicators (red borders, warning icons)
- Recovery instructions

### Loading & Feedback 🔄
- Spinner during load
- Clear empty states when no adjustments exist

### Responsive Design 📱
- Works on desktop (full view)
- Works on tablets
- Works on phones (scrollable)
- Touch-friendly buttons

---

## 💾 Data Display

### Number Formatting
All amounts shown in Indian format:
- ₹500.50 (not 500.50)
- ₹1,00,000.00 (comma as thousands separator)
- Always 2 decimal places

### Date Formatting
- Displayed as: DD/MM/YYYY
- Default range: 1st to last day of current month
- Adjustable: Click date fields

### Table Columns (Admin View)
| Date | Custodian | Picked | Loaded | Excess | KM | Allowance | Final Net |
|------|-----------|--------|--------|--------|----|-----------|-----------|

---

## 🎨 Visual Indicators

### Colors
- **Blue**: Picked amount (base transactions)
- **Green**: Loaded amount (replenishment)
- **Amber**: Travel allowance (miscellaneous)
- **Indigo**: Final net position (summary)
- **Red**: Excess amounts (exceptions)

### States
- **Highlight**: Important net position value
- **Pills/Badges**: Custodian names (admin view)
- **Hover Effect**: Table rows highlight on hover
- **Icons**: Emoji for quick scanning

---

## 📋 Error Messages & Solutions

### "Failed to load SOA records"
- **Cause**: Connection issue or view not available
- **Solution**: Refresh page, check internet connection

### "Please select an SOA"
- **Cause**: No record selected before adjustment
- **Solution**: Click dropdown and select a record

### "No adjustments found"
- **Cause**: No operational records match filters
- **Solution**: Clear filters or select a different assignment

### "Unable to load adjustments"
- **Cause**: Database or network issue
- **Solution**: Refresh and try again, contact support if persists

---

## 🔐 Security & Audit

### What Gets Recorded
- Exchange and inter-site transfer metadata
- Assignment and custodian references
- Timestamps and creator
- Legacy credit/debit for historical audit only

### Access Control
- Custodians: See only own records
- Admins: See all records + review operational adjustments
- Non-admins: Cannot access adjustment page

### Data Integrity
- Operational adjustments are non-financial and net-neutral
- Original values never deleted
- All changes tracked with user ID
- Complete audit trail maintained

---

## 📞 Troubleshooting

### Page Won't Load
- Clear browser cache
- Refresh the page (F5)
- Check internet connection
- Try different browser

### Dropdown Empty
- Wait for data to load (spinner visible)
- Check if SOA records exist for date
- Try different date range

### Number Shows Incorrectly
- Check decimal places
- Verify currency symbol (₹)
- Refresh page

### No Adjustments Displayed
- Clear filters and refresh
- Verify the assignment has exchanges/transfers

---

## 📈 Best Practices

### For Custodians
✅ Review SOA regularly (weekly/monthly)
✅ Check for discrepancies early
✅ Keep travel KM accurate
✅ Verify cash counts match SOA
✅ Print SOA for your records

### For Admins
✅ Review flagged records promptly
✅ Use reference numbers for tracking
✅ Audit SOA adjustments weekly
✅ Keep audit trail clean and clear

---

## 📎 Related Pages & Documents

- [Database Documentation](./DATABASE_SOA_DOCUMENTATION_INDEX.md)
- [SOA Workflow Triggers](./DATABASE_TRIGGERS_SOA_WORKFLOW.md)
- [Design Specifications](./SOA_PAGE_DESIGN_SPECIFICATION.md)

---

**Last Updated**: January 26, 2026
**Version**: 1.0
**Status**: Production Ready ✅
