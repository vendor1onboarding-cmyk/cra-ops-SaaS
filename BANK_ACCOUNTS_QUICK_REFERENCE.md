# Bank Accounts Master Data – Quick Reference

## 🚀 One-Page Guide for Developers

### What Changed?

**Cash Pickup form** now uses **bank dropdown** instead of manual text entry.

**Admin interface** added for bank account management.

---

## 📊 Quick Stats

| Item | Details |
|------|---------|
| **New Table** | `bank_accounts` (UUID, bank_name, account_number, ifsc_code, ...) |
| **New Page** | `src/pages/admin/BankAccountOnboarding.tsx` |
| **Modified Pages** | `CashPickup.tsx`, `AdminOperations.tsx`, `App.tsx` |
| **New Route** | `/admin/bank-accounts` |
| **RLS Enabled** | Yes – Admins manage, custodians view active only |
| **Backward Compat** | ✅ Full – cash_pickups table unchanged |

---

## 🔧 For Admins

### Add a Bank Account
1. Navigate to **Admin Operations** → **Bank Account Management**
2. Click **➕ Add Bank Account**
3. Fill required fields:
   - **Bank Name**: e.g., `CITY UNION BANK`
   - **Account Number**: e.g., `510909010242049`
   - **IFSC Code**: e.g., `CUB0000085` (11 chars, alphanumeric)
4. Optional: Branch code, name, phone, email, address
5. Toggle **✅ Active** checkbox
6. Click **✅ Save Bank Account**

### Edit a Bank Account
- Click **📋 Bank List**
- Toggle **✅ Active** / **❌ Inactive** to manage status
- (Full edit coming in future version)

---

## 👤 For Custodians

### Select a Bank (Cash Pickup)
1. Go to **💰 Cash Pickup**
2. See **Bank Account** dropdown
3. Select bank: `[Bank Name] [Account #] [IFSC]`
4. **All details auto-populate** (no manual entry needed!)
5. Enter expected amount + denominations
6. Click **Save Cash Pickup**

### Auto-Populated Details
When you select a bank, these are filled automatically:
- Account Number
- IFSC Code
- Branch Name
- Branch Phone
- Branch Address

---

## 🗄️ Database Info

### bank_accounts Table
```
id (UUID, PK)
bank_name (TEXT, NOT NULL)
account_number (TEXT, NOT NULL)
ifsc_code (TEXT, NOT NULL, 11 chars alphanumeric, format checked)
branch_code (TEXT)
branch_name (TEXT)
branch_phone (TEXT)
branch_email (TEXT)
branch_address (TEXT)
is_active (BOOLEAN, default true)
created_by (UUID, FK to profiles)
created_at (TIMESTAMP)
updated_at (TIMESTAMP)

UNIQUE: (account_number, ifsc_code)
```

### RLS Policies
- **Custodians**: See active banks only (dropdown use)
- **Admins**: See all banks (for management)
- **Insert/Update/Delete**: Admins only

---

## 🧪 Testing Checklist

### Admin Testing
- [ ] Add new bank → appears in list
- [ ] Try duplicate account + IFSC → error shown
- [ ] IFSC validation: "CUB000008" (10 chars) → rejected
- [ ] Toggle active/inactive → status changes

### Custodian Testing
- [ ] Load cash pickup → bank dropdown populated
- [ ] Select bank → account, IFSC, branch auto-fill
- [ ] Save pickup → stored successfully
- [ ] Mobile → dropdown full-width, details card responsive

### Backward Compat
- [ ] Existing cash pickup records still work
- [ ] No data loss from old manual entries
- [ ] Denomination form unchanged
- [ ] Save functionality preserved

---

## ⚙️ Setup / Deployment

### Step 1: Run SQL Migration
```sql
-- Copy from BANK_ACCOUNTS_MIGRATION.sql
-- Paste in Supabase SQL Editor
-- Execute
```

### Step 2: Insert Sample Data (Optional)
```sql
INSERT INTO bank_accounts (...)
VALUES ('CITY UNION BANK', '510909010242049', 'CUB0000085', ...);
-- See BANK_ACCOUNTS_IMPLEMENTATION_COMPLETE.md for full script
```

### Step 3: Deploy Code
```bash
git add src/pages/admin/BankAccountOnboarding.tsx
git add src/pages/CashPickup.tsx
git add src/App.tsx
git add src/pages/AdminOperations.tsx
git commit -m "feat: Bank account master data management"
git push
```

### Step 4: Test in Production
1. Admin: `/admin/operations` → **Bank Account Management**
2. Add test bank
3. Custodian: `/cash-pickup` → verify dropdown shows bank
4. Select bank → verify auto-populate

---

## 🐛 Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| No banks in dropdown | No active banks in DB | Admin adds banks at `/admin/bank-accounts` |
| Duplicate error | Account + IFSC combo exists | Check for existing bank or use different branch |
| IFSC validation fails | Wrong format | Must be exactly 11 chars: `CUB0000085` |
| Can't save as custodian | Wrong role | Verify user is 'admin' or 'supervisor' |
| Bank details don't fill | JavaScript error | Check browser console, reload |

---

## 📁 File References

| File | Purpose |
|------|---------|
| `BANK_ACCOUNTS_MIGRATION.sql` | Database schema + RLS |
| `src/pages/admin/BankAccountOnboarding.tsx` | Admin bank management page |
| `src/pages/CashPickup.tsx` | Updated with dropdown |
| `src/App.tsx` | Route added |
| `src/pages/AdminOperations.tsx` | Menu updated |

---

## 🔗 Related Docs

- `BANK_ACCOUNTS_IMPLEMENTATION.md` – Full design doc
- `BANK_ACCOUNTS_IMPLEMENTATION_COMPLETE.md` – Complete guide with deployment
- `QUICK_REFERENCE.md` – General app reference

---

## 💡 Key Points

1. ✅ **No manual bank entry** – Dropdown only
2. ✅ **Auto-populate** – All details fill automatically
3. ✅ **Admin-managed** – Only admins can add/edit banks
4. ✅ **Safe** – Unique constraints prevent duplicates
5. ✅ **Backward compatible** – Existing records work
6. ✅ **Mobile-friendly** – Responsive on all devices

---

**Status**: ✅ Ready for Production

