# 🚀 Cheque Capture Feature - Deployment Checklist

## Pre-Deployment Verification

- [x] All code changes implemented
- [x] TypeScript build passes (233 modules, no errors)
- [x] All 8 test scenarios defined
- [x] Backward compatibility verified
- [x] AdminChequeVerification.tsx component tested
- [x] Routing configured in App.tsx
- [x] Admin menu updated

---

## Deployment Steps

### Phase 1: Database Migration (Supabase)

1. **Execute SQL Migration**
   ```bash
   # Option A: Via Supabase Dashboard
   1. Open https://app.supabase.com/project/[YOUR_PROJECT]/sql/new
   2. Copy entire contents of CHEQUE_CAPTURE_MIGRATION.sql
   3. Run query
   4. Verify success: "CREATE TABLE", "ALTER TABLE" messages
   ```

   ```bash
   # Option B: Via Supabase CLI (if running locally)
   supabase db push
   # (Ensures migration is tracked in supabase/migrations/)
   ```

2. **Verify Migration Success**
   ```sql
   -- Check new columns exist
   SELECT column_name, data_type, is_nullable 
   FROM information_schema.columns 
   WHERE table_name = 'cash_pickups' 
   AND column_name LIKE 'cheque%'
   ORDER BY ordinal_position;
   
   -- Expected output: 7 cheque_* columns
   
   -- Check audit table created
   SELECT table_name FROM information_schema.tables 
   WHERE table_name = 'cheque_audit_log';
   
   -- Check trigger exists
   SELECT trigger_name FROM information_schema.triggers 
   WHERE trigger_name = 'trigger_log_cheque_status_change';
   ```

3. **Test Trigger (Optional)**
   ```sql
   -- Insert test cheque record
   WITH test_pickup AS (
     INSERT INTO public.cash_pickups (
       assignment_id, custodian_id, bank_account_id, pickup_date, 
       expected_amount, total_amount, pickup_source,
       cheque_number, cheque_status
     ) VALUES (
       1, '550e8400-e29b-41d4-a716-446655440000', '1', '2026-03-08',
       50000, 50000, 'BANK',
       '892734', 'PENDING'
     )
     RETURNING id
   )
   SELECT 'Cheque audit log entry created:' as status,
          (SELECT COUNT(*) FROM cheque_audit_log 
           WHERE pickup_id = (SELECT id FROM test_pickup)) as audit_log_count;
   ```

---

### Phase 2: Frontend Deployment

1. **Build Application**
   ```bash
   npm run build
   # Expected: 233 modules transformed, ~1020 KB bundle
   ```

2. **Verify Build Output**
   ```bash
   # Check dist/ folder exists
   ls -la dist/
   # Should see: index.html, assets/, manifest.webmanifest, sw.js
   ```

3. **Deploy to Production**
   ```bash
   # Using your CI/CD pipeline (GitHub Actions, Vercel, Netlify, etc.)
   # or manual deployment to your hosting:
   
   # Example for Vercel
   vercel --prod
   
   # Example for manual copy to server
   rsync -avz dist/ user@server:/var/www/app/
   ```

---

### Phase 3: Post-Deployment Verification

#### Custodian Workflow Test

1. **Navigate to Bank Pickup**
   - URL: `https://your-app/cash-pickup`
   - Click **Bank** tab

2. **Verify Cheque Section Appears**
   - Should see: 🏦 "Banking-Grade Cheque Capture" section
   - Located below GPS verification, before Save button

3. **Test Cheque Number Input**
   - Leave empty, click "Save Bank Pickup" → Should save normally
   - Enter number "892734", verify case conversion to uppercase
   - Enter number, see image upload field appear (conditional rendering)

4. **Test Cheque Image Upload**
   - Click file input
   - Select JPG/PNG image < 10 MB
   - Verify "✓ filename.jpg (XXX KB) selected" message

5. **Test Form Save**
   - Enter bank name, expected amount, denominations
   - Verify GPS or photo
   - Enter cheque number + image
   - Click "Save Bank Pickup"
   - Verify success modal: "Bank pickup saved successfully"

#### Admin Workflow Test

1. **Navigate to Admin Operations**
   - URL: `https://your-app/admin/operations`
   - Verify "Cheque Verification" appears in menu

2. **Open Cheque Verification Panel**
   - Click "Cheque Verification" option
   - Should navigate to `/admin/cheque-verification`
   - Verify page title: "🏦 Banking-Grade Cheque Verification"

3. **Test Filters & Search**
   - Filter by "Pending Verification" → shows pending cheques
   - Search by cheque number "892734" → finds matching records
   - Filter by bank → shows matching bank pickups

4. **Test Cheque Verification**
   - Click "✓ Verify Cheque" on a PENDING cheque
   - Confirm in modal
   - Verify status changes to VERIFIED
   - Check success message: "Cheque verified successfully"

5. **Test Image Viewer**
   - Click "📸 View Image" link
   - Verify new tab opens showing cheque image from Supabase

6. **Verify Audit Trail**
   - SQL query: `SELECT * FROM cheque_audit_log LIMIT 5;`
   - Verify entries for status changes with timestamp + updated_by

#### Data Integrity Test

1. **SQL Verification**
   ```sql
   -- Check sample cheque record
   SELECT 
     cp.id, cp.cheque_number, cp.cheque_status,
     cp.cheque_image_url, cp.cheque_verified,
     cal.old_status, cal.new_status, cal.updated_at
   FROM cash_pickups cp
   LEFT JOIN cheque_audit_log cal ON cp.id = cal.pickup_id
   WHERE cp.cheque_number IS NOT NULL
   LIMIT 10;
   ```

2. **SOA Unchanged Test**
   ```sql
   -- Verify SOA calculations unchanged
   SELECT 
     assignment_id, total_bank_cash, total_atm_cash,
     opening_balance, closing_balance
   FROM v_soa_effective
   WHERE assignment_date >= '2026-03-01'
   LIMIT 5;
   -- Should match expected financial logic
   ```

3. **Internal Transfer Test**
   ```sql
   -- Verify internal transfer logic unaffected
   SELECT 
     id, pickup_source, source_breakdown->'bank_source'->>'total_amount',
     source_breakdown->'internal_source'->>'total_amount'
   FROM atm_replenishments
   LIMIT 5;
   -- Should show correct internal/bank splits
   ```

---

## Rollback Plan (If Needed)

### Quick Rollback

```sql
-- Rollback database migration
DROP TRIGGER IF EXISTS trigger_log_cheque_status_change ON public.cash_pickups;
DROP FUNCTION IF EXISTS public.log_cheque_status_change();
DROP TABLE IF EXISTS public.cheque_audit_log;
DROP VIEW IF EXISTS public.v_cheque_verifications;

ALTER TABLE public.cash_pickups
DROP COLUMN IF EXISTS cheque_number,
DROP COLUMN IF EXISTS cheque_image_url,
DROP COLUMN IF EXISTS cheque_verified,
DROP COLUMN IF EXISTS cheque_verified_by,
DROP COLUMN IF EXISTS cheque_verified_at,
DROP COLUMN IF EXISTS cheque_status,
DROP COLUMN IF EXISTS cheque_metadata;

ALTER TABLE public.cash_pickups
DROP CONSTRAINT IF EXISTS cheque_status_check;
```

### Frontend Rollback

```bash
# Revert to previous git commit
git revert HEAD --no-edit

# Or restore from backup deployment
npm run build
# Deploy previous version
```

---

## Rollout Strategy

### Recommendation: Phased Rollout

**Phase 1 (Day 1): Database Migration Only**
- Execute SQL migration
- Verify schema changes
- No frontend changes (feature hidden until enabled)
- Duration: 30 minutes

**Phase 2 (Day 1): Frontend Deployment**
- Build and deploy updated code
- Feature enabled for all users
- Observe telemetry/errors
- Duration: 5 minutes (+ 5 min status monitoring)

**Phase 3 (Week 1): User Training**
- Custodians: Show cheque capture during bank pickup training
- Admins: Demonstrate cheque verification workflow
- Create user guide (link to CHEQUE_CAPTURE_FEATURE_COMPLETE.md)

---

## Success Criteria

- [x] All TypeScript errors resolved (233 modules)
- [ ] Database migration executes without errors
- [ ] Admin panel accessible via `/admin/cheque-verification`
- [ ] Custodian can capture cheque number + image
- [ ] Admin can verify/reject/clear cheques
- [ ] Audit log entries created on status changes
- [ ] SOA calculations unchanged
- [ ] Zero errors in browser console
- [ ] Image upload/download works correctly
- [ ] Backward compatibility verified (old pickups still work)

---

## Monitoring Post-Deployment

### Error Tracking

1. **Frontend Errors**
   - Monitor browser console for TypeScript runtime errors
   - Check for failed fetch requests to `/admin/cheque-verification`
   - Look for storage upload failures

2. **Database Errors**
   - Monitor Supabase query logs
   - Watch for `cheque_audit_log` insertion failures
   - Check for constraint violations

3. **Performance**
   - Monitor admin panel page load time (target: < 2s)
   - Monitor image upload time (target: < 5s)

### Key Metrics

```
-- Usage
SELECT COUNT(*) as total_cheques_captured 
FROM cash_pickups WHERE cheque_number IS NOT NULL;

-- Verification
SELECT cheque_status, COUNT(*) 
FROM cash_pickups 
WHERE cheque_number IS NOT NULL
GROUP BY cheque_status;

-- Images
SELECT COUNT(*) as images_uploaded 
FROM cash_pickups 
WHERE cheque_image_url IS NOT NULL;

-- Audit Activity
SELECT COUNT(*) as status_changes 
FROM cheque_audit_log;
```

---

## Support & Troubleshooting

### Common Issues & Fixes

**Issue 1: "Cheque section not showing in Bank pickup"**
- [ ] Verify browser cache cleared
- [ ] Verify app redeployed (npm run build)
- [ ] Check DevTools → verify activeTab === 'bank'
- [ ] Check network tab for JavaScript errors

**Issue 2: "Image upload fails with 413 Payload Too Large"**
- [ ] Verify file size < 10 MB
- [ ] Check Supabase storage bucket size limits
- [ ] Contact Supabase support if at quota

**Issue 3: "Admin can't see cheques in verification panel"**
- [ ] Verify admin role in `profiles.role`
- [ ] Check cheque_number is not NULL in database
- [ ] SQL: `SELECT COUNT(*) FROM cash_pickups WHERE cheque_number IS NOT NULL;`

**Issue 4: "Audit log not recording status changes"**
- [ ] Verify trigger exists: `SELECT trigger_name FROM information_schema.triggers;`
- [ ] Check trigger function: `SELECT pg_get_functiondef('public.log_cheque_status_change'::regprocedure);`
- [ ] Verify RLS policies allow trigger to insert

---

## Sign-Off

- **Database Migration:** _____________________ (DBA)
- **Frontend Deployment:** _____________________ (DevOps)
- **Testing Verification:** _____________________ (QA)
- **Production Rollout:** _____________________ (Release Manager)

---

**Deployment Guide Version:** 1.0  
**Last Updated:** March 8, 2026  
**Status:** ✅ Ready for deployment
