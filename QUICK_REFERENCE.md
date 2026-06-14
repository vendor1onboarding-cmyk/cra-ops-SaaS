# 📋 QUICK REFERENCE - All Features at a Glance

## For Everyone

### Pages Available
```
Custodian Menu:
├── 📊 Dashboard - Overview of activities
├── 💰 Denomination Plan - Cash denomination planning
├── 🏦 Cash Pickup - Request cash pickup
├── 🏧 ATM Load - Load cash to ATM
├── 🧾 ATM Excess Cash - Report excess cash
├── 🔄 ATM Cash Adjustment - Adjust ATM cash
├── ⚠️ Tech Issues - Report technical issues
├── 🧾 EOD - End of day summary
├── 📑 Statement of Accounts - View SOA records
└── 🚗 Travel Log - Track travel

Admin Menu:
├── 📊 Admin Dashboard - System overview
├── ✅ EOD Approvals - Approve EOD submissions
├── 🗺️ Route Assignment - Assign routes to custodians
└── 🧮 SOA Adjustments - Make manual adjustments
```

---

## 🔐 Roles & Access

| Feature | Custodian | Supervisor | Admin |
|---------|-----------|-----------|-------|
| View Own SOA | ✅ | ✅ | ✅ |
| View All SOA | ❌ | ✅ | ✅ |
| Make Adjustments | ❌ | ❌ | ✅ |
| Approve EOD | ❌ | ✅ | ✅ |
| Assign Routes | ❌ | ❌ | ✅ |
| View Dashboard | ✅ | ✅ | ✅ |

---

## 📑 Statement of Accounts (SOA)

### What is SOA?
Financial statement showing:
- Cash picked up
- Cash loaded to ATMs
- Cash adjustments
- Travel allowance
- Net cash position

### For Custodians
```
View My SOA:
1. Click "📑 Statement of Accounts"
2. See default month (1st-today)
3. Adjust dates if needed
4. View records in table
5. Export CSV or Print PDF
```

**Features**:
- ✅ View records
- ✅ Filter by date
- ✅ See 4 metrics (Picked, Loaded, Allowance, Net)
- ✅ Export as CSV
- ✅ Print as PDF
- ❌ Cannot edit

### For Admins
```
Manage SOA:
1. View All Records - See all custodian SOA
2. Make Adjustments - Fix errors or discrepancies
3. Track Changes - See audit trail
4. Export Data - Get reports
```

**Features**:
- ✅ View all records
- ✅ See custodian names
- ✅ Make adjustments (CREDIT/DEBIT)
- ✅ Add reason for audit
- ✅ Add reference number
- ✅ Preview before submit
- ✅ Track all changes

---

## 🧮 SOA Adjustments (Admin Only)

### When to Adjust
- Cash count discrepancy
- Bank reconciliation error
- Receipt correction
- System data fix
- Compliance adjustment

### How to Adjust
```
Step 1: Select SOA Record
- Choose from dropdown
- See current net position

Step 2: Enter Adjustment
- Amount: +500 (credit) or -250 (debit)
- Reason: Detailed explanation (required)
- Reference: Invoice/Check number (optional)

Step 3: Preview
- Click "Show Preview"
- See calculation impact
- Verify everything correct

Step 4: Submit
- Click "Post Adjustment"
- See success message
- Page auto-reloads
```

---

## 💰 Number Formatting

All amounts show in Indian format:
```
₹500.50        (Not: 500.50)
₹1,00,000.00   (Not: 100000.00)
Always 2 decimals
Currency symbol included
```

---

## 📅 Date Formatting

All dates show as:
```
DD/MM/YYYY
25/01/2026
Not: 2026-01-25
```

---

## ⚠️ Error Messages & Solutions

| Message | Cause | Solution |
|---------|-------|----------|
| "Failed to load SOA records" | Connection issue | Refresh page, check internet |
| "Please select an SOA" | No record selected | Click dropdown and select |
| "Enter a valid amount" | Zero or invalid | Use +500 or -250 format |
| "Reason is mandatory" | Reason field empty | Type explanation |
| "Failed to post adjustment" | Database error | Check values, retry |

---

## 🔍 Validation Rules

### SOA Adjustment Amount
- ✅ Non-zero (+500 or -250)
- ✅ Can be decimal (500.50)
- ❌ Zero not allowed
- ❌ Empty not allowed
- ❌ Text not allowed

### SOA Adjustment Reason
- ✅ At least 1 character
- ✅ Clear explanation
- ❌ Empty not allowed
- ❌ Spaces only not allowed

---

## 🎨 Visual Indicators

### Colors
- 🔵 Blue: Picked amount
- 🟢 Green: Loaded amount
- 🟡 Amber: Allowance
- 🟣 Indigo: Net position (highlight)
- 🔴 Red: Excess or errors

### Icons
- 📊 Dashboard
- ✅ Approved/Checked
- ⚠️ Warning/Error
- 📑 Document
- 🧮 Calculation
- 💰 Money

---

## 📱 Mobile vs Desktop

### Mobile (< 768px)
- KPI cards: Stacked (2 columns)
- Buttons: Full width
- Table: Horizontal scroll
- Filters: Stacked vertical

### Desktop (> 768px)
- KPI cards: 4 columns
- Buttons: Side by side
- Table: All columns visible
- Filters: Single row

---

## 🖨️ Export & Print

### CSV Export
```
1. Click "📥 Export CSV"
2. File downloads: SOA_from_to.csv
3. Open in Excel or Google Sheets
4. Contains: Date, Picked, Loaded, Adjusted, Excess, KM, Allowance, Net
```

### Print/PDF
```
1. Click "🖨️ Print / PDF"
2. Browser print dialog opens
3. Select "Save as PDF"
4. File saves with date range
5. Includes signature lines
```

---

## 🔐 Security Features

### Access Control
- ✅ Only authenticated users access
- ✅ Custodians see only own data
- ✅ Admins see all data
- ✅ Role-based menu

### Audit Trail
- ✅ Who made changes (user ID)
- ✅ When changes made (timestamp)
- ✅ What changed (amount & type)
- ✅ Why changed (reason field)
- ✅ Reference documentation

---

## ✅ Data Validation

### What Gets Checked
- ✅ Amount is valid number
- ✅ Amount is not zero
- ✅ Reason has text
- ✅ Required fields filled
- ✅ Date range valid

### Where It Happens
- ✅ Client-side (real-time feedback)
- ✅ Server-side (data validation)
- ✅ Database (constraints)

---

## 🚀 Performance

### Load Times
- Page load: < 2 seconds
- Data query: < 1 second
- Form submission: < 2 seconds

### Optimization
- ✅ Efficient database queries
- ✅ Memoized calculations
- ✅ Minimal re-renders
- ✅ Responsive design

---

## 📞 Support

### For Users
1. Check menu for relevant page
2. Use filters to find data
3. Export or print as needed
4. Contact admin for adjustments

### For Admins
1. Use "SOA Adjustments" for corrections
2. Add detailed reason for audit
3. Track all changes
4. Review audit trail

### For Developers
1. See [Development Guide](DEVELOPMENT_GUIDE.md)
2. Check [Technical Guide](SOA_TECHNICAL_GUIDE.md)
3. Review [Database Documentation](DATABASE_SOA_DOCUMENTATION_INDEX.md)

---

## 🎯 Common Tasks

### Task: View My SOA
```
Path: /soa
Menu: "📑 Statement of Accounts"
Time: 30 seconds
```

### Task: Export SOA as CSV
```
1. Go to /soa
2. Adjust dates if needed
3. Click "📥 Export CSV"
4. Open file in Excel
Time: 1 minute
```

### Task: Adjust SOA (Admin Only)
```
1. Go to /admin/soa-adjustments
2. Select SOA record
3. Enter amount & reason
4. Click "Show Preview"
5. Click "Post Adjustment"
Time: 3 minutes
```

### Task: Print SOA
```
1. Go to /soa
2. Click "🖨️ Print / PDF"
3. Select "Save as PDF"
4. Choose save location
Time: 1 minute
```

---

**Version**: 1.0  
**Created**: January 26, 2026  
**Status**: ✅ Ready to use
