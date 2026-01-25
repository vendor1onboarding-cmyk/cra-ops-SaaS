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

### When to Make Adjustments
- Cash count discrepancies
- Bank reconciliation corrections
- Receipt errors
- System data corrections
- Compliance adjustments

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

### Step 2: Enter Adjustment Details
```
Amount: 
  - Positive (+500) = Add cash
  - Negative (-250) = Reduce cash

Reason: (REQUIRED)
  - Explain why the adjustment is needed
  - Be specific and detailed
  - Helps with audit trail

Reference: (OPTIONAL)
  - Invoice number, Check number, etc.
  - Any supporting documentation ID
```

### Step 3: Review Preview
```
Click "Show Preview" to see:
- Current Net Position
- Adjustment Amount
- New Resulting Position
- Impact visualization
```

### Step 4: Submit
```
Click "Post Adjustment"
- System validates all fields
- Adjustment is recorded
- Creates audit trail
- Success notification shown
- Page auto-refreshes
```

---

## 📊 Key Features

### Data Validation ✅
- Amount cannot be zero
- Reason cannot be empty
- Amount must be valid number
- Character counter on reason field

### Error Messages 📢
- Clear error descriptions
- Helpful guidance
- Visual indicators (red borders, warning icons)
- Recovery instructions

### Loading & Feedback 🔄
- Spinner during load
- "Processing..." while submitting
- Success message after submission
- Auto-reload after 2 seconds

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
| Date | Custodian | Picked | Loaded | Adjusted | Excess | KM | Allowance | Final Net |
|------|-----------|--------|--------|----------|--------|----|-----------|-----------| 

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

### "Enter a valid adjustment amount"
- **Cause**: Amount is zero, empty, or invalid
- **Solution**: Enter non-zero number (+500 or -250)

### "Reason is mandatory"
- **Cause**: Reason field is empty
- **Solution**: Type explanation in reason field

### "Failed to post SOA adjustment"
- **Cause**: Database or network issue
- **Solution**: Check values, retry, contact support if persists

---

## 🔐 Security & Audit

### What Gets Recorded
- Who made the adjustment (Admin ID)
- When it was made (timestamp)
- What amount and type (CREDIT/DEBIT)
- Reason for adjustment (audit trail)
- Reference number if provided

### Access Control
- Custodians: See only own records
- Admins: See all records + can make adjustments
- Non-admins: Cannot access adjustment page

### Data Integrity
- Adjustment amount stored separately
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

### Adjustment Not Posted
- Review all error messages
- Ensure all required fields filled
- Check character limits
- Retry submission

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
✅ Document all adjustments with reasons
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
