# 🔧 SOA Source Attribution Correction - Execution Guide

## ⚠️ Important: Manual Execution Required

Due to security constraints, this database correction script must be executed manually via **Supabase Dashboard** or **Supabase CLI with service key**.

---

## 📋 What This Script Does

Fixes 7 assignments where **ATM internal pickups were incorrectly attributed to bank loads**:
- **Assignment 114**: ₹200 correction
- **Assignment 123**: ₹10,00,000 correction  
- **Assignment 129**: ₹40,000 correction
- **Assignment 131**: ₹10,000 correction
- **Assignment 141**: ₹8,20,000 correction
- **Assignment 185**: ₹10,000 correction
- **Assignment 210**: Already fixed (included for verification)

**Total Correction**: ₹19,80,200 across 6 assignments

---

## 🟢 OPTION 1: Via Supabase Dashboard (RECOMMENDED)

### Step 1: Open Supabase Dashboard
1. Go to: https://app.supabase.com
2. Login if needed
3. Select project: **ejszqwmmpspvhtuhodsa**

### Step 2: Open SQL Editor
1. In left sidebar, click **"SQL Editor"**
2. Click **"New Query"** button (top right)

### Step 3: Copy the SQL Script
1. Open file: `SOA_SOURCE_ATTRIBUTION_CORRECTION.sql`
2. Select **ALL** content (Ctrl+A)
3. Copy (Ctrl+C)

### Step 4: Paste & Execute
1. In Supabase SQL Editor, paste the SQL (Ctrl+V)
2. Review the script contents
3. Click the blue **"Run"** button (top right)
4. Wait for success message

### Step 5: Verify Results
The script will show two queries at the end:
1. **Assignment balance check** - All 7 assignments should show `final_net_cash_position = 0`
2. **Load verification** - All 10 corrected loads should display correct source breakdown

**Expected Success Output**:
```
(7 rows in 50ms)    -- First query result
(10 rows in 45ms)   -- Second query result
```

---

## 🔵 OPTION 2: Via Supabase CLI (ADVANCED)

### Prerequisites
- Supabase CLI installed: `supabase --version`
- Service Role Key (from Supabase Dashboard → Settings → API)

### Step 1: Get Service Role Key
1. Go to: https://app.supabase.com
2. Select your project
3. Settings (bottom) → API
4. Copy **"service_role"** key (NOT the anon key)

### Step 2: Set Environment Variable
**Windows PowerShell:**
```powershell
$env:SUPABASE_DB_PASSWORD = "your_service_role_key_here"
```

**Linux/Mac:**
```bash
export SUPABASE_DB_PASSWORD="your_service_role_key_here"
```

### Step 3: Create & Run Migration
```bash
# Authenticate if not already done
supabase login

# Link your project
supabase link --project-ref ejszqwmmpspvhtuhodsa

# Create a new migration
supabase migration new soa_source_attribution_correction

# Edit the migration file and add the SQL content
# Then apply it
supabase db push
```

---

## 🔴 OPTION 3: Via Direct psql (REQUIRES LOCAL SETUP)

*(Skip if you don't have psql installed)*

```bash
# Get connection string from Supabase Dashboard
# Settings → Database → Connections → psql

psql "postgresql://[user]:[password]@[host]:[port]/[database]" -f SOA_SOURCE_ATTRIBUTION_CORRECTION.sql
```

---

## ✅ Post-Execution Validation

### 1. Verify All Assignments Balance
Run this query in Supabase SQL Editor:
```sql
SELECT 
  assignment_id,
  assignment_date,
  bank_picked,
  internal_picked,
  bank_loaded,
  internal_loaded,
  final_net_cash_position
FROM v_soa_effective
WHERE assignment_id IN (114, 123, 129, 131, 141, 185, 210)
ORDER BY assignment_id;
```

**Expected Result**: All rows should have `final_net_cash_position = 0`

### 2. Verify Specific Loads
```sql
SELECT 
  ar.id,
  ar.assignment_id,
  (COALESCE(ar.denom_100, 0) * 100 + 
   COALESCE(ar.denom_200, 0) * 200 + 
   COALESCE(ar.denom_500, 0) * 500 + 
   COALESCE(ar.denom_2000, 0) * 2000) as total_amount,
  (ar.source_breakdown->'bank_source'->>'total_amount')::bigint as bank_portion,
  (ar.source_breakdown->'internal_source'->>'total_amount')::bigint as internal_portion
FROM atm_replenishments ar
WHERE ar.id IN (407, 408, 428, 429, 430, 455, 465, 490, 491, 540)
ORDER BY ar.assignment_id, ar.id;
```

**Expected Result**: Bank & internal portions should correctly distribute the load amounts

### 3. Verify Front-End Impact
After execution, the affected assignments should show:
- ✅ Correct SOA balance (net cash position = 0)
- ✅ Dashboard KPIs updated
- ✅ Internal transfer balances corrected

---

## 📊 Detailed Changes by Assignment

### Assignment 141: ₹8,20,000 (ALL internal)
```
Changes:
  Load 490: Bank 0 → Internal ₹8,20,000
  Load 491: Bank 0 → Internal remaining
```

### Assignment 123: ₹10,00,000 (Split across 3 loads)
```
Changes:
  Load 428: Bank ₹5,00,000 → Internal ₹5,00,000
  Load 429: Bank ₹1,70,000 → Internal ₹1,70,000
  Load 430: Bank ₹3,30,000 → Internal ₹3,30,000
```

### Assignment 129: ₹40,000 (Partial load)
```
Changes:
  Load 455: Bank ₹1,00,000 → Split: Bank ₹60,000 + Internal ₹40,000
```

### Assignment 131: ₹10,000 (Partial load)
```
Changes:
  Load 465: Bank ₹1,60,000 → Split: Bank ₹1,50,000 + Internal ₹10,000
```

### Assignment 185: ₹10,000 (Partial load)
```
Changes:
  Load 540: Bank ₹7,30,000 → Split: Bank ₹7,20,000 + Internal ₹10,000
```

### Assignment 114: ₹200 (Two loads)
```
Changes:
  Load 407: Bank ₹100 → Internal ₹100
  Load 408: Bank ₹100 → Internal ₹100
```

---

## 🚨 Rollback Instructions (If Needed)

If you need to revert this correction:

```sql
-- Restore from backup (if available)
-- Backup was taken before running the correction script

BEGIN;
-- Contact support for original source_breakdown values
-- Manual ROLLBACK may be required
ROLLBACK;
```

**Note**: Always backup before performing data corrections.

---

## 📞 Support / Issues

If you encounter errors:
1. **Verify script syntax**: The SQL file should have 259 lines and start with `BEGIN;`
2. **Check permissions**: Ensure you're logged in as project admin
3. **Review error message**: SQL Editor will show specific error with line number
4. **Contact Supabase Support**: https://app.supabase.com/support (if persistent)

---

## 📝 References

- Supabase SQL Editor: https://app.supabase.com
- Supabase Documentation: https://supabase.com/docs
- PostgreSQL Manual: https://www.postgresql.org/docs/

---

**Status**: Ready for manual execution  
**Date**: March 15, 2026  
**Related Fix**: ATMReplenishment.tsx - Cash availability calculation
