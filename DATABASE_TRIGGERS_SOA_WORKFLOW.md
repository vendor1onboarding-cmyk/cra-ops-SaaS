# 🔔 Database Triggers & SOA Workflow Reference

**Version**: 1.0  
**Status**: Complete Reference  
**Purpose**: Quick lookup for triggers, workflow, and data flow

---

## 📍 Triggers in the System

### 1. Trigger: `trg_post_soa_on_assignment_approval`
**Table**: `assignments`  
**Event**: `AFTER UPDATE OF status`  
**Condition**: When status changes to 'approved'  
**Action**: Creates or updates SOA posting record

```sql
AFTER UPDATE OF status ON assignments FOR EACH ROW
EXECUTE FUNCTION post_soa_on_approval();
```

**Workflow**:
1. Admin approves assignment (status → 'approved')
2. Trigger fires automatically
3. Function creates soa_postings record with:
   - Sums cash_picked from cash_pickups
   - Sums cash_loaded from atm_replenishments
   - Sums cash_adjusted from atm_cash_adjustments
   - Sums excess_reported from atm_excess_cash
   - Sums travel_allowance from travel_logs
   - Calculates net_cash_position

---

### 2. Trigger: `after_cash_pickup_insert`
**Table**: `cash_pickups`  
**Event**: `AFTER INSERT`  
**Action**: Creates ledger entry for cash received

```sql
AFTER INSERT ON cash_pickups FOR EACH ROW
EXECUTE FUNCTION trg_cash_pickups_soa();
```

**Ledger Entry Created**:
```
soa_ledger entry:
- event_type: 'PICKUP'
- source_table: 'cash_pickups'
- source_id: NEW.id
- amount: NEW.total_amount
- direction: 'CREDIT' (cash received)
- remarks: '{bank_name} - {branch}'
```

**Data Impact**: ✅ Immediate, increases running balance

---

### 3. Trigger: `after_atm_replenishments_insert`
**Table**: `atm_replenishments`  
**Event**: `AFTER INSERT`  
**Action**: Creates ledger entry for cash loaded + calculates allowance

```sql
AFTER INSERT ON atm_replenishments FOR EACH ROW
EXECUTE FUNCTION trg_atm_replenishments_soa();
```

**Ledger Entry Created**:
```
soa_ledger entry:
- event_type: 'LOAD'
- source_table: 'atm_replenishments'
- source_id: NEW.id
- amount: NEW.total_amount (calculated from denoms)
- direction: 'DEBIT' (cash deployed)
- remarks: 'ATM {site_code}'
```

**Plus - Travel Allowance Calculation**:
```
IF NEW.distance_meters <= 50m:
  allowance = 0 (within acceptable range)
ELSE:
  km = NEW.distance_meters / 1000
  rate = vehicle_rates.rate_per_km (for vehicle_type)
  allowance = km * rate
```

**Data Impact**: ✅ Decreases running balance, updates travel allowance

---

### 4. Trigger: `after_atm_cash_adjustments_insert`
**Table**: `atm_cash_adjustments`  
**Event**: `AFTER INSERT`  
**Action**: Creates ledger entry for manual adjustment

```sql
AFTER INSERT ON atm_cash_adjustments FOR EACH ROW
EXECUTE FUNCTION trg_atm_cash_adjustments_soa();
```

**Ledger Entry Created**:
```
soa_ledger entry:
- event_type: 'ADJUST'
- source_table: 'atm_cash_adjustments'
- source_id: NEW.id
- amount: ABS(NEW.total_amount)
- direction: NEW.adjustment_type (DEBIT if withdrawal, CREDIT if deposit)
- remarks: '{reason}'
```

**Logic**:
- If adjustment_type = 'withdrawal' → DEBIT (cash reduced)
- If adjustment_type = 'deposit' → CREDIT (cash increased)

**Data Impact**: ✅ Updates running balance based on adjustment direction

---

### 5. Trigger: `after_atm_excess_cash_insert`
**Table**: `atm_excess_cash`  
**Event**: `AFTER INSERT`  
**Action**: Creates ledger entry for excess cash

```sql
AFTER INSERT ON atm_excess_cash FOR EACH ROW
EXECUTE FUNCTION trg_atm_excess_cash_soa();
```

**Ledger Entry Created**:
```
soa_ledger entry:
- event_type: 'EXCESS'
- source_table: 'atm_excess_cash'
- source_id: NEW.id
- amount: NEW.total_excess_amount (COMPUTED FIELD)
- direction: 'CREDIT' (cash recovered from ATM)
- remarks: 'Excess reported from ATM {site_code}'
```

**Total Amount Calculation** (GENERATED ALWAYS):
```
total_excess_amount = (denom_100 * 100) + 
                      (denom_200 * 200) + 
                      (denom_500 * 500) + 
                      (denom_2000 * 2000)
```

**Data Impact**: ✅ Increases running balance (cash recovery)

---

### 6. Trigger: `after_travel_logs_update`
**Table**: `travel_logs`  
**Event**: `AFTER UPDATE WHEN end_time transitions from NULL to NOT NULL`  
**Action**: Creates ledger entry for travel allowance deduction

```sql
AFTER UPDATE ON travel_logs FOR EACH ROW
WHEN OLD.end_time IS NULL AND NEW.end_time IS NOT NULL
EXECUTE FUNCTION trg_travel_logs_soa();
```

**Ledger Entry Created**:
```
soa_ledger entry:
- event_type: 'TRAVEL'
- source_table: 'travel_logs'
- source_id: NEW.id
- amount: NEW.allowance_amount (pre-calculated)
- direction: 'DEBIT' (allowance deduction)
- remarks: 'Travel allowance - {km_covered} KM'
```

**Data Impact**: ✅ Decreases running balance (allowance deduction)

---

## 🔄 Complete SOA Workflow

### Timeline: A Complete Day

```
06:00 AM - CUSTODIAN RECEIVES ASSIGNMENT
┌─────────────────────────────────────────┐
│ assignments table created:              │
│ - custodian_id = assigned user          │
│ - assignment_date = today               │
│ - status = 'open'                       │
│ - route_sites linked (ATM list)         │
└─────────────────────────────────────────┘

08:00 AM - CASH PICKUP FROM BANK
┌─────────────────────────────────────────┐
│ INSERT cash_pickups record:             │
│ - bank_name, branch                     │
│ - denom_2000, denom_500, etc.           │
│ - total_amount = ₹45,00,000             │
└─────────────────────────────────────────┘
    │
    ▼ TRIGGER: after_cash_pickups_insert
┌─────────────────────────────────────────┐
│ INSERT soa_ledger entry:                │
│ - event_type = 'PICKUP'                 │
│ - amount = 45,00,000                    │
│ - direction = 'CREDIT'                  │
│ - running_balance = 45,00,000           │
└─────────────────────────────────────────┘

09:00 AM - ATM REPLENISHMENT #1
┌─────────────────────────────────────────┐
│ INSERT atm_replenishments record:       │
│ - site_id = ATM001                      │
│ - denom amounts → total = ₹20,00,000    │
│ - distance_meters = 30m (within range)  │
└─────────────────────────────────────────┘
    │
    ▼ TRIGGER: after_atm_replenishments_insert
┌─────────────────────────────────────────┐
│ INSERT soa_ledger entry:                │
│ - event_type = 'LOAD'                   │
│ - amount = 20,00,000                    │
│ - direction = 'DEBIT'                   │
│ - running_balance = 25,00,000 (45-20)   │
│                                         │
│ + UPDATE travel_allowance = 0 (< 50m)   │
└─────────────────────────────────────────┘

10:00 AM - ATM REPLENISHMENT #2
┌─────────────────────────────────────────┐
│ INSERT atm_replenishments record:       │
│ - site_id = ATM002                      │
│ - denom amounts → total = ₹15,00,000    │
│ - distance_meters = 45m                 │
└─────────────────────────────────────────┘
    │
    ▼ TRIGGER: after_atm_replenishments_insert
┌─────────────────────────────────────────┐
│ INSERT soa_ledger entry:                │
│ - event_type = 'LOAD'                   │
│ - amount = 15,00,000                    │
│ - direction = 'DEBIT'                   │
│ - running_balance = 10,00,000 (25-15)   │
│                                         │
│ + UPDATE travel_allowance = 0 (< 50m)   │
└─────────────────────────────────────────┘

11:00 AM - MANUAL CASH ADJUSTMENT
┌─────────────────────────────────────────┐
│ INSERT atm_cash_adjustments record:     │
│ - site_id = ATM005                      │
│ - adjustment_type = 'withdrawal'        │
│ - amount = ₹5,000 (due to damage)       │
│ - reason = "Damaged notes in hopper"    │
└─────────────────────────────────────────┘
    │
    ▼ TRIGGER: after_atm_cash_adjustments_insert
┌─────────────────────────────────────────┐
│ INSERT soa_ledger entry:                │
│ - event_type = 'ADJUST'                 │
│ - amount = 5,000                        │
│ - direction = 'DEBIT'                   │
│ - running_balance = 9,95,000 (10L - 5K) │
└─────────────────────────────────────────┘

14:00 PM - ATM EXCESS CASH DETECTED
┌─────────────────────────────────────────┐
│ INSERT atm_excess_cash record:          │
│ - site_id = ATM007                      │
│ - denom amounts → total = ₹50,000       │
│ - reported_to_vendor = false            │
│ - bank_notified = false                 │
└─────────────────────────────────────────┘
    │
    ▼ TRIGGER: after_atm_excess_cash_insert
┌─────────────────────────────────────────┐
│ INSERT soa_ledger entry:                │
│ - event_type = 'EXCESS'                 │
│ - amount = 50,000                       │
│ - direction = 'CREDIT'                  │
│ - running_balance = 10,45,000 (9.95L+50K) │
└─────────────────────────────────────────┘

16:00 PM - TRAVEL LOG COMPLETED
┌─────────────────────────────────────────┐
│ UPDATE travel_logs record:              │
│ - end_time = 16:00 (was NULL)           │
│ - km_covered = 85 KM                    │
│ - allowance_amount = 85 * ₹30/KM = ₹2,550 │
└─────────────────────────────────────────┘
    │
    ▼ TRIGGER: after_travel_logs_update (end_time NULL→NOT NULL)
┌─────────────────────────────────────────┐
│ INSERT soa_ledger entry:                │
│ - event_type = 'TRAVEL'                 │
│ - amount = 2,550                        │
│ - direction = 'DEBIT'                   │
│ - running_balance = 10,42,450           │
└─────────────────────────────────────────┘

17:00 PM - EOD SUMMARY & SIGNING
┌─────────────────────────────────────────┐
│ UPDATE assignments record:              │
│ - eod_signed = true                     │
│ - eod_signed_at = 17:00                 │
│ - eod_signature_url = storage/sig.png   │
│ - status = 'submitted'                  │
└─────────────────────────────────────────┘

18:00 PM - ADMIN APPROVES (NEXT DAY)
┌─────────────────────────────────────────┐
│ UPDATE assignments record:              │
│ - status = 'approved' (was 'submitted') │
│ - approved_at = 18:00                   │
│ - approved_by = admin_user_id           │
└─────────────────────────────────────────┘
    │
    ▼ TRIGGER: trg_post_soa_on_assignment_approval (FIRES!)
┌─────────────────────────────────────────┐
│ INSERT soa_postings record:             │
│ - assignment_id = 12345                 │
│ - cash_picked = 45,00,000 (SUM pickup)  │
│ - cash_loaded = 35,00,000 (SUM replen)  │
│ - cash_adjusted = -5,000 (adjustment)   │
│ - excess_reported = 50,000              │
│ - travel_allowance = -2,550             │
│ - net_cash_position = CALCULATED:       │
│   = picked(45,00,000)                   │
│   - loaded(35,00,000)                   │
│   + adjusted(-5,000)                    │
│   + excess(50,000)                      │
│   - allowance(2,550)                    │
│   = 10,42,450                           │
│ - posted_at = 18:00                     │
│ - posted_by = admin_user_id             │
└─────────────────────────────────────────┘

STATEMENT OF ACCOUNTS READY FOR REVIEW
┌─────────────────────────────────────────┐
│ SELECT from soa_ledger:                 │
│ Shows 7 line items:                     │
│ 1. PICKUP     +45,00,000  = 45,00,000   │
│ 2. LOAD       -20,00,000  = 25,00,000   │
│ 3. LOAD       -15,00,000  = 10,00,000   │
│ 4. ADJUST      -5,000     =  9,95,000   │
│ 5. EXCESS     +50,000     = 10,45,000   │
│ 6. TRAVEL     -2,550      = 10,42,450   │
│ 7. (blank)    (final)     = 10,42,450   │
│                                         │
│ SELECT from soa_postings:               │
│ Shows summary with all totals           │
└─────────────────────────────────────────┘

[OPTIONAL] ADMIN ADDS ADJUSTMENT
┌─────────────────────────────────────────┐
│ INSERT soa_adjustments record:          │
│ - soa_id = (posting id)                 │
│ - adjustment_type = 'CREDIT'            │
│ - adjustment_amount = 10,000            │
│ - reason = "Bank discrepancy resolved"  │
│ - created_by = admin_user_id            │
└─────────────────────────────────────────┘
    │
    ▼ (No trigger, but view updates)
┌─────────────────────────────────────────┐
│ SELECT from v_soa_effective:            │
│ Shows:                                  │
│ - net_cash_position = 10,42,450         │
│ - total_adjustments = +10,000           │
│ - final_net_cash_position = 10,52,450   │
└─────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

```
CUSTODIAN OPERATIONS
├── cash_pickups (INSERT)
│   └──► TRIGGER: after_cash_pickups_insert
│        └──► soa_ledger (INSERT PICKUP entry)
│
├── atm_replenishments (INSERT)
│   └──► TRIGGER: after_atm_replenishments_insert
│        ├──► soa_ledger (INSERT LOAD entry)
│        └──► travel_logs (UPDATE allowance)
│
├── atm_cash_adjustments (INSERT)
│   └──► TRIGGER: after_atm_cash_adjustments_insert
│        └──► soa_ledger (INSERT ADJUST entry)
│
├── atm_excess_cash (INSERT)
│   └──► TRIGGER: after_atm_excess_cash_insert
│        └──► soa_ledger (INSERT EXCESS entry)
│
└── travel_logs (UPDATE end_time)
    └──► TRIGGER: after_travel_logs_update
         └──► soa_ledger (INSERT TRAVEL entry)

ADMIN APPROVAL
└── assignments (UPDATE status='approved')
    └──► TRIGGER: trg_post_soa_on_assignment_approval
         └──► soa_postings (INSERT with calculations)

ADMIN ADJUSTMENTS
└── soa_adjustments (INSERT)
    └──► (No trigger, but v_soa_effective view includes)

REPORTING
├── soa_ledger (SELECT all entries for day)
├── soa_postings (SELECT summary for day)
├── soa_adjustments (SELECT if any)
└── v_soa_effective (SELECT final position)
    └──► Statement of Accounts Page
```

---

## 🧮 Calculation Logic

### SOA Posting Calculation (AUTO in Trigger)

```
WHEN assignment.status → 'approved':

cash_picked = SUM(cash_pickups.total_amount)
             WHERE assignment_id = assignment.id

cash_loaded = SUM(atm_replenishments total)
             WHERE assignment_id = assignment.id
             (calculated from denoms)

cash_adjusted = SUM(atm_cash_adjustments)
               WHERE assignment_id = assignment.id
               (negative if withdrawal, positive if deposit)

excess_reported = SUM(atm_excess_cash.total_excess_amount)
                 WHERE assignment_id = assignment.id

travel_km = SUM(travel_logs.km_covered)
           WHERE assignment_id = assignment.id
           AND status = 'completed'

travel_allowance = SUM(travel_logs.allowance_amount)
                  WHERE assignment_id = assignment.id

net_cash_position = 
    cash_picked         (credit)
    - cash_loaded       (debit)
    + cash_adjusted     (can be +/-)
    + excess_reported   (credit)
    - travel_allowance  (debit)

Example:
= 45,00,000 (picked)
- 35,00,000 (loaded)
+ (-5,000)  (adjusted negative)
+ 50,000    (excess)
- 2,550     (allowance)
= 10,42,450
```

### Effective SOA with Adjustments

```
WHEN viewing soa_effective view:

total_adjustments = SUM(soa_adjustments.adjustment_amount)
                   WHERE soa_id = soa_postings.id
                   (CREDIT adds, DEBIT subtracts)

final_net_cash_position = 
    net_cash_position + total_adjustments

Example:
= 10,42,450 (original)
+ 10,000    (adjustment CREDIT)
+ (-5,000)  (adjustment DEBIT)
= 10,47,450
```

---

## ⚠️ Important Notes for Developers

### Trigger Ordering (if multiple fire for one transaction)
1. Triggers fire in order of creation
2. No guaranteed order if created simultaneously
3. **Use BEFORE triggers for validation, AFTER triggers for ledger updates**

### Ledger Entry Uniqueness
```sql
UNIQUE(source_table, source_id)
```
- Prevents duplicate ledger entries for same source record
- If trigger tries to insert duplicate, it fails (add error handling)

### Cascade Deletes
- Deleting assignment → Deletes all route_sites, cash_pickups, replenishments, etc.
- But assignment with soa_postings **CANNOT** be deleted (ON DELETE RESTRICT)
- This protects audit trail

### Amount Precision
- All amounts stored as NUMERIC(14,2)
- Never use FLOAT/DOUBLE (precision loss in financial data)
- Example: 45,00,000.00 (14 digits, 2 decimals)

### Date/Time Handling
- All timestamps are TIMESTAMP WITH TIME ZONE
- Supports multi-timezone operations
- Convert to user's timezone in application layer

---

## 🔍 Querying the SOA

### Get Complete SOA for a Day
```sql
-- All transactions for an assignment
SELECT * FROM soa_ledger
WHERE assignment_id = 12345
ORDER BY entry_date, entry_time;
```

### Get Summary SOA
```sql
-- Summary posting (after approval)
SELECT * FROM soa_postings
WHERE assignment_id = 12345;
```

### Get Effective SOA (with adjustments)
```sql
-- Final position after all adjustments
SELECT * FROM v_soa_effective
WHERE assignment_id = 12345;
```

### Get All Ledger Detail for Statement
```sql
-- Use this view for SOA page display
SELECT * FROM v_statement_of_accounts
WHERE assignment_id = 12345
ORDER BY entry_date, entry_time;
```

### Audit: Who Approved?
```sql
SELECT 
  a.assignment_id,
  a.eod_signed_at,
  a.approved_at,
  p.full_name as approved_by
FROM assignments a
LEFT JOIN profiles p ON p.id = a.approved_by
WHERE a.id = 12345;
```

---

## 🚨 Error Handling

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Duplicate ledger entry | Trigger fired twice | Check constraint UNIQUE(source_table, source_id) |
| SOA posting not created | Status change not to 'approved' | Verify update statement changes status to 'approved' |
| Running balance incorrect | Ledger entries in wrong order | Query should ORDER BY entry_date, entry_time |
| Allowance not calculated | Trigger didn't fire (end_time already set) | Use UPDATE statement with WHERE end_time IS NULL |
| Adjustments not showing | Querying wrong view | Use v_soa_effective, not soa_postings |

---

## 📋 Checklist for New Features

When adding new transaction type:

- [ ] Create table for transaction
- [ ] Add column to soa_postings for total amount (if applicable)
- [ ] Create AFTER INSERT trigger
- [ ] Trigger calculates event amount
- [ ] Trigger determines DEBIT or CREDIT
- [ ] Trigger inserts soa_ledger entry
- [ ] Add entry_type value (e.g., 'REFUND')
- [ ] Update eventTypeToLabel() function in frontend
- [ ] Update SOA page to show new transaction type
- [ ] Test trigger with actual data
- [ ] Document in this file

---

**Last Updated**: January 25, 2026  
**Version**: 1.0  
**Status**: Complete Reference

