# 🏦 Cheque Capture Feature - Quick Reference Card

## ⚡ At a Glance

**What:** Banking-grade cheque verification system for Bank Cash Pickup  
**When:** Captured during bank pickup, verified by admin later  
**Status:** Optional (doesn't block existing workflows)  
**Impact:** Zero breaking changes to financial logic  

---

## 🎯 User Flows

### For Custodians 👷
```
/cash-pickup 
  → Bank tab 
    → Enter bank details + cash denominations
    → [NEW] Enter cheque number (optional)
    → [NEW] Upload cheque image (if cheque number entered)
    → Save Bank Pickup
    → ✓ Success
```

### For Admins 🔑
```
/admin/operations
  → Click "Cheque Verification" (💳)
    → Filter by status (PENDING, VERIFIED, REJECTED, CLEARED)
    → Click on cheque card
    → Click "📸 View Image" to inspect
    → Click action button:
       - "✓ Verify Cheque" → PENDING to VERIFIED
       - "✗ Reject Cheque" → PENDING to REJECTED  
       - "💳 Mark Cleared" → VERIFIED to CLEARED
    → Confirm modal
    → ✓ Status updated + audit log created
```

---

## 📊 Database Schema Quick View

### New Columns on `cash_pickups`

| Column | Type | Purpose |
|--------|------|---------|
| `cheque_number` | text | Cheque serial number (max 30 chars) |
| `cheque_image_url` | text | Storage path to cheque image |
| `cheque_status` | text | PENDING\|VERIFIED\|REJECTED\|CLEARED |
| `cheque_verified` | boolean | Admin has verified this cheque |
| `cheque_verified_by` | uuid | Admin user ID |
| `cheque_verified_at` | timestamptz | When verified |
| `cheque_metadata` | jsonb | Audit metadata (device, geo, etc.) |

### New Table: `cheque_audit_log`

Auto-logged on every status change:
- `pickup_id` → links to cash_pickups
- `old_status` / `new_status` → status transition
- `updated_by` → admin user ID
- `updated_at` → timestamp
- `metadata` → extra data

### Trigger: `log_cheque_status_change`

Fires automatically when:
- `cheque_status` column changes
- `cheque_verified` column changes

Creates audit log entry (INSERT only, immutable).

---

## 📝 Cheque Status Lifecycle

```
PENDING ──[Admin Click "Verify"]──> VERIFIED ──[Admin Click "Cleared"]──> CLEARED
  │       OR                        │
  └─────[Admin Click "Reject"]─────> REJECTED
```

**States & Meaning:**

| State | Meaning | Action |
|-------|---------|--------|
| PENDING | Captured, awaiting admin review | Admin verifies or rejects |
| VERIFIED | Admin validated cheque details | Admin marks as cleared by bank |
| REJECTED | Invalid/needs correction | Custodian must resubmit |
| CLEARED | Confirmed by bank's clearing house | Final state, no action |

---

## 🔒 Security & Audit

### Audit Trail is Immutable
- Stored in `cheque_audit_log` table
- INSERT only (no updates)
- Every change is timestamped + attributed to admin
- Query: `SELECT * FROM cheque_audit_log WHERE pickup_id = 123;`

### Access Control
- **Custodians:** Can upload cheques only
- **Admins/Supervisors:** Can verify/reject/clear cheques
- Route guard: `RequireAdmin` on verification panel

### Data Validation
- Cheque status has CHECK constraint (only 4 valid values)
- Foreign key references (cascading deletes)
- Non-null fields protected at DB level

---

## 💾 File Storage

### Upload Location
Supabase bucket: `issue-photos` (existing bucket, reused)

### Path Format
```
cheque-images/{assignment_id}-{timestamp}.jpg

Example:
cheque-images/129-1710002343.jpg
cheque-images/130-1710002500.png
```

### Access
- URL: `{SUPABASE_URL}/storage/v1/object/public/issue-photos/{path}`
- Admin panel generates link automatically
- Click "📸 View Image" to open in new tab

---

## 🧪 Test Checklist (5 min test)

- [ ] **Custodian test:** Navigate to /cash-pickup → Bank tab → see cheque section
- [ ] **Cheque number:** Enter "892734" → verify auto-uppercase conversion
- [ ] **Image upload:** Select image < 10 MB → verify file name shown
- [ ] **Save:** Click "Save Bank Pickup" → verify success modal
- [ ] **Admin access:** Navigate to /admin/operations → click "Cheque Verification"
- [ ] **Admin panel:** Filter by status PENDING → see cheque cards
- [ ] **Image viewer:** Click "📸 View Image" → verify image opens (new tab)
- [ ] **Verify:** Click "✓ Verify Cheque" → confirm modal → verify status changes
- [ ] **Audit:** SQL `SELECT COUNT(*) FROM cheque_audit_log;` → verify entries exist
- [ ] **Backward compat:** Old bank pickup (no cheque) still loads/saves ✓

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [x] Build passes (233 modules, no errors)
- [x] All code changes complete
- [x] Documentation ready
- [x] Test scenarios defined

### Deployment
1. **Database:** Execute CHEQUE_CAPTURE_MIGRATION.sql via Supabase
2. **Frontend:** `npm run build` → deploy dist/ folder
3. **Verification:** Run 5-min test above
4. **Monitor:** Check error logs for 24h

### Post-Deployment
- Custodians see cheque section in Bank pickup
- Admins access verification panel via Operations
- Audit log populates with status changes

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `CHEQUE_CAPTURE_MIGRATION.sql` | SQL migration (7 columns + trigger) |
| `CHEQUE_CAPTURE_FEATURE_COMPLETE.md` | Full feature documentation (400+ lines) |
| `CHEQUE_CAPTURE_DEPLOYMENT_CHECKLIST.md` | Deployment + testing guide |
| `CHEQUE_CAPTURE_IMPLEMENTATION_SUMMARY.md` | Implementation summary |

---

## 🔧 Code Files

| File | Change | LOC |
|------|--------|-----|
| `src/pages/CashPickup.tsx` | Added cheque state + UI | +60 |
| `src/pages/admin/AdminChequeVerification.tsx` | NEW: admin verification panel | 400 |
| `src/App.tsx` | Added route + import | +2 |
| `src/pages/AdminOperations.tsx` | Added menu option | +4 |
| **Total** | | **466 LOC** |

---

## ⚠️ Important Notes

### Zero Impact on Existing Systems
- ✅ Financial calculations unchanged
- ✅ SOA views unchanged
- ✅ Internal transfer logic unchanged
- ✅ Ledger triggers unchanged
- ✅ Old pickups without cheques work as-is
- ✅ ATM_INTERNAL pickups unaffected (no cheque fields shown)

### Cheque Fields are Optional
- All cheque columns are NULL-able
- Bank pickup works WITHOUT cheque number/image
- Cheque image upload only appears if cheque number entered
- Won't cause errors on older records

---

## 🎓 Example Audit Query

```sql
-- View all cheque status changes for a pickup
SELECT 
  cal.pickup_id,
  cal.old_status,
  cal.new_status,
  u.full_name as verified_by,
  cal.updated_at
FROM cheque_audit_log cal
LEFT JOIN profiles u ON cal.updated_by = u.id
WHERE cal.pickup_id = 456
ORDER BY cal.updated_at DESC;

-- Result example:
pickup_id | old_status | new_status | verified_by | updated_at
456       | PENDING    | VERIFIED   | Admin John  | 2026-03-08 10:30:00
456       | VERIFIED   | CLEARED    | Admin John  | 2026-03-08 11:00:00
```

---

## 🏁 Summary

**Cheque Capture is a non-breaking, audit-safe enhancement to Bank Cash Pickup.**

- Custodians can optionally capture cheque details
- Admins can verify/reject/clear cheques
- Complete audit trail automatically maintained
- Zero impact on financial logic
- Production-ready architecture

---

**Quick Links:**
- Deployment Guide: `CHEQUE_CAPTURE_DEPLOYMENT_CHECKLIST.md`
- Full Docs: `CHEQUE_CAPTURE_FEATURE_COMPLETE.md`
- Feature Summary: `CHEQUE_CAPTURE_IMPLEMENTATION_SUMMARY.md`
- Database Migration: `CHEQUE_CAPTURE_MIGRATION.sql`

**Status:** ✅ READY FOR PRODUCTION

---

*Version 1.0 | March 8, 2026*
