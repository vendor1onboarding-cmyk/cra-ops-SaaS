# Bank Accounts Master Data – Implementation Guide

## Overview

This document outlines the implementation of a **bank account master data system** to replace manual bank details entry in the Cash Pickup form.

---

## Design Decision: New Table

### Rationale
- **cash_pickups** currently stores `bank_name` and `branch` as text fields
- Creating a **new `bank_accounts` table** provides:
  - ✅ **Data normalization** – Eliminate duplicates
  - ✅ **Centralized management** – Admin-driven onboarding
  - ✅ **Backward compatibility** – Existing cash_pickups records remain unchanged
  - ✅ **Extensibility** – Easy to add new bank details later
  - ✅ **Audit trail** – Track who added/modified banks

### Alternative Rejected
- Migrating existing `bank_name` from cash_pickups would require ETL and risk breaking existing records
- Extending cash_pickups would mix transaction and master data

---

## Database Schema

### New Table: bank_accounts

```sql
CREATE TABLE public.bank_accounts (
  id UUID NOT NULL PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifiers
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  ifsc_code TEXT NOT NULL,
  
  -- Branch Details
  branch_code TEXT,
  branch_name TEXT,
  
  -- Contact & Address
  branch_phone TEXT,
  branch_email TEXT,
  branch_address TEXT,
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Audit
  created_by UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT bank_accounts_account_unique UNIQUE (account_number, ifsc_code),
  CONSTRAINT bank_accounts_bank_name_not_empty CHECK (length(trim(bank_name)) > 0),
  CONSTRAINT bank_accounts_account_not_empty CHECK (length(trim(account_number)) > 0),
  CONSTRAINT bank_accounts_ifsc_not_empty CHECK (length(trim(ifsc_code)) > 0),
  CONSTRAINT bank_accounts_ifsc_format CHECK (ifsc_code ~ '^[A-Z0-9]{11}$')
);

-- Indexes for fast lookups
CREATE INDEX bank_accounts_bank_name_idx ON bank_accounts(bank_name);
CREATE INDEX bank_accounts_account_number_idx ON bank_accounts(account_number);
CREATE INDEX bank_accounts_is_active_idx ON bank_accounts(is_active);
CREATE INDEX bank_accounts_created_by_idx ON bank_accounts(created_by);
CREATE INDEX bank_accounts_created_at_idx ON bank_accounts(created_at);

-- Trigger to auto-update updated_at
CREATE TRIGGER update_bank_accounts_timestamp
BEFORE UPDATE ON bank_accounts
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();
```

### RLS Policies

```sql
-- Admins can view all banks
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_view_all_banks"
ON bank_accounts FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
);

-- All authenticated users can view active banks (for dropdown)
CREATE POLICY "user_view_active_banks"
ON bank_accounts FOR SELECT
USING (is_active = true);

-- Only admins can insert/update
CREATE POLICY "admin_insert_banks"
ON bank_accounts FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
);

CREATE POLICY "admin_update_banks"
ON bank_accounts FOR UPDATE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
)
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
);

CREATE POLICY "admin_delete_banks"
ON bank_accounts FOR DELETE
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) IN ('admin', 'supervisor')
);
```

---

## Data Flow

### Custodian (Cash Pickup Form)
```
1. Load Active Banks
   └─ Query: SELECT * FROM bank_accounts WHERE is_active = true
   └─ Order: bank_name ASC
   └─ Display: [Bank Name] [Account #] [IFSC]

2. User Selects Bank
   └─ Auto-populate:
      - account_number
      - ifsc_code
      - branch_name
      - branch_phone
      - branch_address

3. User Submits
   └─ Store: assignment_id, bank_account_id, ...
   └─ cash_pickups.bank_account_id (NEW COLUMN)
```

### Admin (Bank Onboarding)
```
1. Form Inputs
   ├─ Bank Name (required)
   ├─ Account Number (required, unique with IFSC)
   ├─ IFSC Code (required, format: ^[A-Z0-9]{11}$)
   ├─ Branch Code (optional)
   ├─ Branch Name (optional)
   ├─ Branch Phone (optional)
   ├─ Branch Email (optional)
   ├─ Branch Address (optional)
   └─ Is Active (toggle)

2. Validation (Client + Server)
   ├─ All required fields filled
   ├─ IFSC format valid (11 alphanumeric, uppercase)
   ├─ Duplicate check (account_number + ifsc_code)
   └─ Bank name not empty/spaces only

3. Submit
   └─ INSERT into bank_accounts
   └─ Show success + back to list

4. Edit (Future)
   └─ UPDATE bank_accounts SET ...
   └─ Audit trail via created_by + timestamps
```

---

## Frontend Architecture

### Components

#### 1. BankAccountOnboarding.tsx (Admin Page)
- Location: `src/pages/admin/BankAccountOnboarding.tsx`
- Features:
  - Form to add new banks
  - Validation with real-time feedback
  - Duplicate detection
  - Success/error messages
  - Mobile-friendly layout

#### 2. Updated CashPickup.tsx
- Bank selection dropdown (instead of text input)
- Auto-populate bank details
- Graceful fallback if banks unavailable
- Maintain existing denomination logic

---

## Migration Strategy

### Step 1: Create bank_accounts Table
- SQL migration in Supabase (no schema changes to cash_pickups)

### Step 2: Create Admin Page
- Build BankAccountOnboarding.tsx
- Add route in App.tsx
- Update Admin Operations menu

### Step 3: Update CashPickup Form
- Replace bank_name text input with dropdown
- Fetch banks on component mount
- Auto-populate fields on selection
- Handle graceful fallback

### Step 4: Testing
- Custodian selects bank → fields auto-populate
- Admin adds bank → appears in custodian dropdown
- Mobile layout verified
- No breaking changes to existing cash pickups

---

## Backward Compatibility

### Existing Cash Pickup Records
- ✅ No schema changes to cash_pickups
- ✅ Old records with manual bank_name still valid
- ✅ New records use bank_account_id (optional field)

### Fallback Strategy
- If bank fetch fails → show error, allow manual entry (temporary)
- If bank not found → show warning, auto-load to manual mode
- Legacy records continue to work

---

## Sample Data (For Testing)

```sql
INSERT INTO bank_accounts (
  bank_name, account_number, ifsc_code, branch_code, branch_name, 
  branch_phone, branch_email, branch_address, created_by
) VALUES
(
  'CITY UNION BANK',
  '510909010242049',
  'CUB0000085',
  '085',
  'Thoothukudi Main',
  '9363311438',
  'info@cityunion.com',
  'VOC Road, Thoothukudi – 628003',
  (SELECT id FROM profiles WHERE email = 'admin@example.com' LIMIT 1)
),
(
  'STATE BANK OF INDIA',
  '43251238405',
  'SBINO000943',
  '943',
  'Beach Road Branch',
  '8925947320',
  'sbi.00943@sbi.co.in',
  '306 Beach Road, Thoothukudi – 628001',
  (SELECT id FROM profiles WHERE email = 'admin@example.com' LIMIT 1)
),
(
  'TAMILNAD MERCANTILE BANK',
  '106150050801354',
  'TMBL0000106',
  '106',
  'Thoothukudi South',
  '9876543210',
  'thoothukudi_south@tmbank.in',
  '283 W.G.C Road, Thoothukudi – 628003',
  (SELECT id FROM profiles WHERE email = 'admin@example.com' LIMIT 1)
);
```

---

## Success Criteria

- ✅ Custodian selects bank from dropdown
- ✅ Bank details auto-populate correctly
- ✅ Admin can add new banks via UI
- ✅ Mobile layout is clean and functional
- ✅ No regression to existing cash pickup flow
- ✅ Graceful error handling
- ✅ IFSC format validated
- ✅ Duplicate detection works

---

## Files Modified/Created

| File | Action | Purpose |
|------|--------|---------|
| `BANK_ACCOUNTS_MIGRATION.sql` | CREATE | Database schema & RLS |
| `src/pages/admin/BankAccountOnboarding.tsx` | CREATE | Admin bank management |
| `src/pages/CashPickup.tsx` | MODIFY | Add dropdown + auto-fill |
| `src/App.tsx` | MODIFY | Add route for bank onboarding |
| `src/pages/AdminOperations.tsx` | MODIFY | Add bank-account-onboarding action |

---

## Timeline

- **Phase 1**: Database schema + RLS (1 hour)
- **Phase 2**: Admin page (2 hours)
- **Phase 3**: CashPickup form update (1.5 hours)
- **Phase 4**: Testing & documentation (1 hour)
- **Total**: ~5.5 hours

---

## Future Enhancements

- [ ] Bank list with edit/delete (admin dashboard)
- [ ] Bulk import banks from CSV
- [ ] Bank deactivation (soft delete)
- [ ] Search/filter for large bank lists
- [ ] Bank-to-site mapping for smarter suggestions

