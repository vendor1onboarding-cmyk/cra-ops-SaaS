# ⚙️ DATABASE TRIGGERS & SOA WORKFLOW

## Overview

This document explains the automated business logic that runs on the database to maintain data integrity and calculate SOA (Statement of Accounts) records.

---

## 🔄 SOA CALCULATION WORKFLOW

### Step 1: Assignment Created

When a custodian is assigned:

```sql
INSERT INTO assignments (
  custodian_id,
  vehicle_id,
  route_id,
  assignment_date,
  status
) VALUES (
  'custodian-id',
  'vehicle-id',
  'route-id',
  '2026-01-26',
  'active'
);
```

**Trigger Actions**:
- ✅ Set created_at = NOW()
- ✅ Set updated_at = NOW()
- ✅ Initialize status = 'active'
- ✅ Create empty v_soa_effective record

---

### Step 2: Cash Picked

When custodian picks up cash:

```sql
INSERT INTO cash_pickups (
  assignment_id,
  location_id,
  cash_picked,
  pickup_time
) VALUES (
  'assignment-id',
  'location-id',
  5000.00,
  NOW()
);
```

**Trigger Actions**:
- ✅ Validate amount > 0
- ✅ Set pickup_time = NOW()
- ✅ Update v_soa_effective (cash_picked column)
- ✅ Recalculate final_net_cash_position

**Calculation**:
```
cash_picked = 5000.00
current_position = 5000.00
```

---

### Step 3: Cash Loaded

When custodian loads cash into vehicle:

```sql
INSERT INTO cash_loaded (
  assignment_id,
  vehicle_id,
  cash_loaded,
  load_time
) VALUES (
  'assignment-id',
  'vehicle-id',
  3000.00,
  NOW()
);
```

**Trigger Actions**:
- ✅ Validate amount > 0
- ✅ Validate cash_loaded <= cash_picked
- ✅ Set load_time = NOW()
- ✅ Update v_soa_effective (cash_loaded column)
- ✅ Recalculate final_net_cash_position

**Calculation**:
```
cash_picked = 5000.00
cash_loaded = 3000.00
difference = 5000 - 3000 = 2000.00
current_position = 2000.00
```

---

### Step 4: Travel Tracking

When travel is recorded:

```sql
INSERT INTO travel_tracking (
  assignment_id,
  travel_km,
  travel_allowance,
  from_location,
  to_location
) VALUES (
  'assignment-id',
  50.00,
  250.00,
  'Location A',
  'Location B'
);
```

**Trigger Actions**:
- ✅ Validate travel_km > 0
- ✅ Calculate travel_allowance (if not provided)
- ✅ Update v_soa_effective (travel columns)
- ✅ No impact on cash position

---

### Step 5: Admin Records Operational Adjustment

When admin records an operational adjustment (exchange or transfer):

```sql
INSERT INTO soa_adjustments (
  soa_id,
  assignment_id,
  custodian_id,
  adjustment_type,
  adjustment_amount,
  reason,
  reference,
  created_by
) VALUES (
  'assignment-id',
  'assignment-id',
  'custodian-id',
  'EXCHANGE',
  0,
  'Denomination exchange',
  'EMAIL-REF-123',
  'admin-id'
);
```

**Trigger Actions**:
- ✅ Validate adjustment_type IN ('EXCHANGE', 'INTER_SITE_TRANSFER')
- ✅ Validate reason is not empty
- ✅ Set created_by = current_user
- ✅ Set created_at = NOW()
- ✅ Operational adjustment is stored for audit
- ✅ No impact on SOA net position

**Note**:
Legacy CREDIT/DEBIT records are historical only and are excluded from SOA net.

---

### Step 6: Excess Reported

When custodian reports excess cash:

```sql
INSERT INTO excess_cash (
  assignment_id,
  excess_reported,
  reason,
  reported_at
) VALUES (
  'assignment-id',
  500.00,
  'Excess found during verification',
  NOW()
);
```

**Trigger Actions**:
- ✅ Validate excess_reported > 0
- ✅ Set reported_at = NOW()
- ✅ Update v_soa_effective (excess_reported column)
- ✅ Recalculate final_net_cash_position

**Calculation**:
```
position_before = 3000.00
excess = -500.00
position_after = 3000.00 - 500.00 = 2500.00
```

---

### Final State: SOA Summary

**View Query**:
```sql
SELECT * FROM v_soa_effective
WHERE soa_id = 'assignment-id';
```

**Result**:
```
soa_id:                    assignment-id
assignment_date:           2026-01-26
cash_picked:               5000.00
cash_loaded:               3000.00
difference:                2000.00
cash_adjusted:             1000.00
excess_reported:           500.00
travel_km:                 50.00
travel_allowance:          250.00
final_net_cash_position:   2500.00
```

**Breakdown**:
- Picked: $5,000
- Loaded in vehicle: $3,000
- Remaining: $2,000
- Adjusted +$1,000: $3,000
- Excess -$500: $2,500
- **Final Position: $2,500**

---

## 🔧 DATABASE TRIGGERS

### Trigger 1: Update Timestamp on assignments

**When**: Before any UPDATE on assignments table  
**Action**: Set updated_at = NOW()

```sql
CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

**Example**:
```sql
UPDATE assignments
SET status = 'completed'
WHERE id = 'assignment-id';

-- Trigger automatically sets updated_at = NOW()
```

---

### Trigger 2: Validate Cash Loaded <= Cash Picked

**When**: Before INSERT on cash_loaded  
**Action**: Check cash_loaded doesn't exceed cash_picked

```sql
CREATE OR REPLACE FUNCTION validate_cash_loaded()
RETURNS TRIGGER AS $$
DECLARE
  picked_amount DECIMAL;
BEGIN
  -- Get cash picked for this assignment
  SELECT COALESCE(SUM(cash_picked), 0) INTO picked_amount
  FROM cash_pickups
  WHERE assignment_id = NEW.assignment_id;
  
  -- Validate
  IF NEW.cash_loaded > picked_amount THEN
    RAISE EXCEPTION 'Cash loaded (%) cannot exceed cash picked (%)',
      NEW.cash_loaded, picked_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validate_cash_loaded_before_insert
BEFORE INSERT ON cash_loaded
FOR EACH ROW
EXECUTE FUNCTION validate_cash_loaded();
```

---

### Trigger 3: Calculate Travel Allowance

**When**: Before INSERT on travel_tracking  
**Action**: Calculate travel_allowance if not provided

```sql
CREATE OR REPLACE FUNCTION calculate_travel_allowance()
RETURNS TRIGGER AS $$
BEGIN
  -- If allowance not provided, calculate it
  IF NEW.travel_allowance IS NULL OR NEW.travel_allowance = 0 THEN
    -- Assuming ₹5 per km
    NEW.travel_allowance := NEW.travel_km * 5;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_travel_allowance_before_insert
BEFORE INSERT ON travel_tracking
FOR EACH ROW
EXECUTE FUNCTION calculate_travel_allowance();
```

---

### Trigger 4: Audit Trail for Adjustments

**When**: Before INSERT on soa_adjustments  
**Action**: Validate and set audit fields

```sql
CREATE OR REPLACE FUNCTION audit_adjustment()
RETURNS TRIGGER AS $$
BEGIN
  -- Validate amount > 0
  IF NEW.adjustment_amount <= 0 THEN
    RAISE EXCEPTION 'Adjustment amount must be positive';
  END IF;
  
  -- Validate reason not empty
  IF NEW.reason IS NULL OR TRIM(NEW.reason) = '' THEN
    RAISE EXCEPTION 'Reason is required';
  END IF;
  
  -- Set created_by if not provided
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  
  -- Set created_at
  NEW.created_at := NOW();
  
  -- Validate user is admin
  IF (SELECT role FROM profiles WHERE id = auth.uid()) 
     NOT IN ('admin', 'supervisor') THEN
    RAISE EXCEPTION 'Only admins can create adjustments';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_adjustment_before_insert
BEFORE INSERT ON soa_adjustments
FOR EACH ROW
EXECUTE FUNCTION audit_adjustment();
```

---

## 📊 CALCULATION LOGIC

### Core Formula

```
final_net_cash_position = 
  cash_picked
  - cash_loaded
  + adjustments
  - excess_reported
```

### Adjustment Calculation

```
IF adjustment_type = 'CREDIT':
  position += adjustment_amount
ELSE IF adjustment_type = 'DEBIT':
  position -= adjustment_amount
```

### Step-by-Step Example

**Starting**: No data
```
Position = 0
```

**After Cash Pickup** (pick ₹5,000):
```
Position = 5,000
```

**After Cash Load** (load ₹3,000):
```
Position = 5,000 - 3,000 = 2,000
```

**After Adjustment** (CREDIT ₹1,000):
```
Position = 2,000 + 1,000 = 3,000
```

**After Excess Report** (excess ₹500):
```
Position = 3,000 - 500 = 2,500
```

**Final**: ₹2,500

---

## 🔐 VALIDATION RULES

### On Cash Pickup
```
✅ assignment_id exists
✅ cash_picked > 0
✅ location_id valid
✅ pickup_time not in future
```

### On Cash Load
```
✅ assignment_id exists
✅ cash_loaded > 0
✅ cash_loaded <= total_cash_picked
✅ load_time >= pickup_time
✅ vehicle_id valid
```

### On Travel Tracking
```
✅ assignment_id exists
✅ travel_km > 0
✅ travel_allowance >= 0
✅ from_location not empty
✅ to_location not empty
```

### On SOA Adjustment
```
✅ soa_id exists
✅ adjustment_amount > 0
✅ adjustment_type IN ('CREDIT', 'DEBIT')
✅ reason not empty
✅ custodian_id exists
✅ created_by is admin/supervisor
```

### On Excess Report
```
✅ assignment_id exists
✅ excess_reported > 0
✅ excess_reported <= cash_picked
✅ reason provided
✅ reported_at not in future
```

---

## 🚨 ERROR HANDLING

### Trigger Errors

When a trigger fails:

```sql
-- Error: Cash loaded exceeds cash picked
ERROR: Cash loaded (5000) cannot exceed cash picked (3000)

-- Action: INSERT is rejected
-- Data is not saved
-- Transaction rolls back
```

### User Action

If insert fails:

1. **Custodian sees**: "Operation failed. Please verify amounts."
2. **Admin sees**: Detailed error message
3. **Error is logged**: For troubleshooting
4. **Retry available**: Can fix and resubmit

---

## 📈 PERFORMANCE IMPACT

### Trigger Overhead

| Operation | Time | Overhead |
|-----------|------|----------|
| Cash pickup | ~10ms | ~2ms (validation) |
| Cash load | ~15ms | ~5ms (validation + calc) |
| Travel | ~10ms | ~1ms (calculation) |
| Adjustment | ~20ms | ~10ms (audit + validation) |
| View query | ~50ms | ~10ms (aggregation) |

### Optimization

- ✅ Indexes prevent full table scans
- ✅ Cached calculations in view
- ✅ Batch operations allowed
- ✅ Lazy loading where appropriate

---

## 🔄 WORKFLOW SEQUENCE DIAGRAM

```
Day 1: Assignment Created
├─ Custodian assigned to vehicle
├─ Status = 'active'
└─ v_soa_effective created (empty)

Day 2: Cash Pickup
├─ Custodian picks up cash: ₹5,000
├─ Trigger validates amount
├─ v_soa_effective updated
└─ Position = ₹5,000

Day 2: Cash Loading
├─ Custodian loads cash: ₹3,000
├─ Trigger validates ≤ picked
├─ v_soa_effective updated
└─ Position = ₹2,000

Day 2: Travel Recorded
├─ Travel distance: 50 km
├─ Allowance calculated: ₹250
├─ v_soa_effective updated
└─ Position = ₹2,000 (not changed)

Day 3: Admin Review
├─ Admin notices discrepancy
├─ Makes adjustment: +₹1,000 (CREDIT)
├─ Sets reason: "Correction"
├─ Trigger validates & audits
├─ v_soa_effective updated
└─ Position = ₹3,000

Day 3: Excess Report
├─ Excess reported: ₹500
├─ Trigger validates
├─ v_soa_effective updated
└─ Position = ₹2,500

Status: COMPLETE ✅
├─ Final position: ₹2,500
├─ Full audit trail
└─ Ready for settlement
```

---

## 📝 AUDIT TRAIL

### What Gets Logged

Every adjustment creates an audit record:

```sql
INSERT INTO soa_adjustments (...) VALUES (...)
-- Automatically logs:
-- ✅ What was adjusted (soa_id, amount)
-- ✅ Who made the change (created_by)
-- ✅ When it was made (created_at)
-- ✅ Why it was made (reason)
-- ✅ Reference info (reference)
```

### Audit Query

To see all adjustments for a custodian:

```sql
SELECT 
  sadj.created_at,
  sadj.adjustment_type,
  sadj.adjustment_amount,
  sadj.reason,
  sadj.reference,
  p.full_name as admin_name
FROM soa_adjustments sadj
JOIN profiles p ON sadj.created_by = p.id
WHERE sadj.custodian_id = 'custodian-id'
  AND sadj.created_at >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY sadj.created_at DESC;
```

---

## 🔄 REVERSION RULES

### Can You Undo an Adjustment?

**Policy**: No direct undo, but...

**Option 1**: Create opposite adjustment
```sql
-- Original: CREDIT ₹1,000
-- Created: DEBIT ₹1,000
-- Net effect: ₹0 change
-- Audit trail preserved
```

**Option 2**: Create new adjustment
```sql
-- Make any correction needed
-- Document in reason why
-- Maintains full audit trail
```

### Example

```sql
-- Original adjustment
INSERT INTO soa_adjustments (
  soa_id, adjustment_type, adjustment_amount,
  reason, created_by
) VALUES (
  'soa-id', 'CREDIT', 1000,
  'Correction for overcounting', 'admin-id'
);

-- Reversal adjustment
INSERT INTO soa_adjustments (
  soa_id, adjustment_type, adjustment_amount,
  reason, created_by
) VALUES (
  'soa-id', 'DEBIT', 1000,
  'Reversal of previous adjustment (was incorrect)', 'admin-id'
);

-- Result: Position unchanged, but fully audited
```

---

## 📊 MONITORING TRIGGERS

### Check Trigger Status

```sql
-- List all triggers
SELECT trigger_name, table_name, event_manipulation
FROM information_schema.triggers
WHERE table_schema = 'public';

-- Check trigger function
SELECT pg_get_functiondef('function_name'::regprocedure);
```

### Common Issues

**Issue**: Trigger not firing  
**Solution**: Check if trigger is enabled
```sql
-- Re-enable trigger
ALTER TABLE table_name ENABLE TRIGGER trigger_name;
```

**Issue**: Slow inserts  
**Solution**: Check trigger performance
```sql
-- Review trigger logic
-- Add indexes to referenced tables
-- Consider materialized view instead
```

---

## 🎯 KEY TAKEAWAYS

1. **SOA Position = Picked - Loaded + Adjustments - Excess**
2. **All changes are validated** by triggers
3. **Full audit trail is maintained** for compliance
4. **No direct "undo"** - use reverse adjustments instead
5. **Errors prevent data inconsistency** by rejecting bad data
6. **View is real-time calculated** - always current
7. **Triggers are automatic** - no manual intervention needed

---

## 📞 TROUBLESHOOTING

### Common Issues

**Q: Why did my insert fail?**  
A: Check error message - likely validation failed

**Q: Can I modify an adjustment?**  
A: No - create reverse adjustment with reason

**Q: What if calculation seems wrong?**  
A: Check v_soa_effective view - it shows all calculations

**Q: Can admin see other custodians' adjustments?**  
A: Yes, admins see all adjustments via RLS policies

**Q: How often is SOA updated?**  
A: Real-time - view calculates on query

---

**Last Updated**: January 26, 2026  
**Database**: PostgreSQL via Supabase  
**Version**: 1.0  

See [DATABASE_SOA_DOCUMENTATION_COMPLETE_SUMMARY.md](DATABASE_SOA_DOCUMENTATION_COMPLETE_SUMMARY.md) for full schema details.

