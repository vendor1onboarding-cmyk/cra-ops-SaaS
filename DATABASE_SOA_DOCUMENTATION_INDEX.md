# 🗄️ DATABASE SOA DOCUMENTATION INDEX

## Quick Navigation

**Need answers about...**
- [How to view SOA records?](#how-to-view-soa-records) → v_soa_effective view
- [How to edit SOA records?](#how-to-edit-soa-records) → soa_adjustments table
- [What data is in SOA?](#soa-data-structure) → Column descriptions
- [How are custodians connected?](#custodian-relationship) → profiles table
- [What triggers update SOA?](#database-triggers) → Automation rules

---

## 📚 Documentation Organization

### By Role
- **Custodians**: Can view SOA records [Read here](#custodian-access)
- **Admins**: Can view and adjust SOA [Read here](#admin-access)
- **Supervisors**: Same as Admins [Read here](#admin-access)
- **Developers**: Need full schema [Read DATABASE_SOA_DOCUMENTATION_COMPLETE_SUMMARY.md]

### By Task
- **View SOA**: Use v_soa_effective view
- **Edit SOA**: Use soa_adjustments table
- **Track changes**: Use adjustment audit columns
- **Calculate totals**: Use SQL views

### By Topic
- [Database Tables](#database-tables)
- [Views & Calculations](#views--calculations)
- [Data Relationships](#data-relationships)
- [Access Control](#access-control)
- [Common Queries](#common-queries)

---

## 🔑 Key Database Elements

### Primary Tables
| Table | Purpose | Records |
|-------|---------|---------|
| v_soa_effective | View SOA records | Read-only view |
| soa_adjustments | Store adjustments | ~100s per year |
| profiles | User information | ~100-500 users |
| assignments | Assignment data | Ongoing |

### Data Flow
```
User logs in
    ↓
profiles table (get role)
    ↓
If Admin: show all SOA records
If Custodian: show only their SOA
    ↓
Can view from v_soa_effective view
    ↓
If Admin: can also edit via soa_adjustments
```

---

## 📊 HOW TO VIEW SOA RECORDS

### For Custodians
```sql
SELECT *
FROM v_soa_effective
WHERE custodian_id = [CURRENT_USER_ID]
ORDER BY assignment_date DESC;
```

### For Admins
```sql
SELECT *
FROM v_soa_effective
ORDER BY assignment_date DESC;
```

### View Columns
- **soa_id**: Unique SOA record identifier
- **assignment_date**: Date of assignment
- **cash_picked**: Amount picked from location
- **cash_loaded**: Amount loaded into vehicle
- **cash_adjusted**: Amount adjusted by admin
- **excess_reported**: Excess cash reported
- **final_net_cash_position**: Net cash after adjustments
- **custodian_id**: Reference to custodian
- **custodian.full_name**: Custodian's name (admin only)

---

## ✏️ HOW TO EDIT SOA RECORDS

### Add Adjustment
```sql
INSERT INTO soa_adjustments (
  soa_id,
  assignment_id,
  custodian_id,
  adjustment_type,
  adjustment_amount,
  reason,
  reference,
  created_by,
  created_at
) VALUES (
  'soa-uuid',
  'assignment-uuid',
  'custodian-uuid',
  'CREDIT',
  1000.00,
  'Correction for overcounting',
  'EMAIL-REF-123',
  'admin-uuid',
  NOW()
);
```

### Adjustment Fields
- **adjustment_type**: CREDIT or DEBIT
- **adjustment_amount**: Positive number (sign determines CREDIT/DEBIT)
- **reason**: Why adjustment was made (required)
- **reference**: Email, ticket, or memo number (optional)

---

## 🔗 DATA RELATIONSHIPS

### Table Relationships
```
profiles
  ├─ id (UUID)
  ├─ full_name (text)
  └─ role (admin, supervisor, custodian)

assignments
  ├─ id (UUID)
  ├─ custodian_id → profiles.id
  ├─ vehicle_id
  └─ assignment_date

v_soa_effective (VIEW)
  ├─ soa_id
  ├─ assignment_id → assignments.id
  ├─ custodian_id → profiles.id
  └─ [20+ calculation columns]

soa_adjustments
  ├─ id (UUID)
  ├─ soa_id
  ├─ assignment_id → assignments.id
  ├─ custodian_id → profiles.id
  ├─ created_by → profiles.id
  └─ [adjustment details]
```

### Foreign Key Lookups
- `custodian_id` → Full name from profiles
- `assignment_id` → Assignment details from assignments
- `created_by` → Admin name from profiles

---

## 🔐 ACCESS CONTROL

### By Role

#### Custodian
✅ Can view: Own SOA records  
❌ Cannot: View others' SOA  
❌ Cannot: Edit any SOA  

#### Supervisor
✅ Can view: All SOA records  
✅ Can edit: All SOA records  
✅ Can see: All custodian names  

#### Admin
✅ Can view: All SOA records  
✅ Can edit: All SOA records  
✅ Can see: All custodian names  

### Implementation
```typescript
// Filter by role
if (profile.role === "custodian") {
  query = query.eq("custodian_id", profile.id);
} else if (profile.role === "admin" || profile.role === "supervisor") {
  // No filter - see all
}

// Show custodian names only to admins
if (profile.role === "admin" || profile.role === "supervisor") {
  query = query.select("..., custodian:custodian_id(full_name)");
} else {
  query = query.select("... [without custodian name]");
}
```

---

## 🔍 SOA DATA STRUCTURE

### View: v_soa_effective

**What it is**: Calculated view showing SOA records with all calculations

**Data Categories**:

#### Identity
- soa_id: Record ID
- assignment_id: Link to assignment
- custodian_id: Link to custodian
- assignment_date: When assignment occurred

#### Picked & Loaded
- cash_picked: Picked from location
- cash_loaded: Loaded into vehicle
- difference: picked - loaded

#### Adjustments
- cash_adjusted: Admin adjustments
- excess_reported: Excess cash reported
- manual_adjustments: Previous adjustments

#### Final Calculation
- final_net_cash_position: Calculated position after all adjustments

#### Travel
- travel_km: Kilometers traveled
- travel_allowance: Travel allowance amount

#### Status
- posted_at: When finalized
- status: Current status

---

## 📝 COMMON QUERIES

### View all SOA for one custodian (current month)
```sql
SELECT 
  soa_id,
  assignment_date,
  cash_picked,
  cash_loaded,
  final_net_cash_position
FROM v_soa_effective
WHERE custodian_id = 'custodian-id'
  AND assignment_date >= CURRENT_DATE - INTERVAL '1 month'
ORDER BY assignment_date DESC;
```

### View SOA with adjustments
```sql
SELECT 
  soa.soa_id,
  soa.assignment_date,
  soa.final_net_cash_position,
  COUNT(adj.id) as adjustment_count,
  SUM(CASE 
    WHEN adj.adjustment_type = 'CREDIT' THEN adj.adjustment_amount
    WHEN adj.adjustment_type = 'DEBIT' THEN -adj.adjustment_amount
  END) as total_adjustments
FROM v_soa_effective soa
LEFT JOIN soa_adjustments adj ON soa.soa_id = adj.soa_id
WHERE soa.assignment_date >= CURRENT_DATE - INTERVAL '3 months'
GROUP BY soa.soa_id, soa.assignment_date, soa.final_net_cash_position
ORDER BY soa.assignment_date DESC;
```

### Find SOA with recent adjustments (last 7 days)
```sql
SELECT DISTINCT
  soa.soa_id,
  soa.assignment_date,
  soa.custodian_id,
  p.full_name,
  COUNT(adj.id) as adjustment_count
FROM v_soa_effective soa
JOIN soa_adjustments adj ON soa.soa_id = adj.soa_id
JOIN profiles p ON soa.custodian_id = p.id
WHERE adj.created_at >= NOW() - INTERVAL '7 days'
ORDER BY adj.created_at DESC;
```

### Check for missing SOA adjustments (this month)
```sql
SELECT 
  soa.soa_id,
  soa.assignment_date,
  soa.custodian_id,
  p.full_name,
  soa.final_net_cash_position,
  CASE 
    WHEN ABS(soa.cash_picked - soa.cash_loaded) > 100 THEN '⚠️ NEEDS REVIEW'
    ELSE '✓ OK'
  END as status
FROM v_soa_effective soa
JOIN profiles p ON soa.custodian_id = p.id
WHERE soa.assignment_date >= DATE_TRUNC('month', NOW())
  AND ABS(soa.cash_picked - soa.cash_loaded) > 100
ORDER BY soa.assignment_date DESC;
```

---

## 📊 CUSTODIAN RELATIONSHIP

### profiles Table
```
id (UUID) - Primary key
  ↑
  └─ Multiple assignments, SOAs point here
  └─ Store full_name, role
  └─ Used for access control
```

### How to get custodian name in SOA query
```typescript
// Simple join
const { data } = await supabase
  .from("v_soa_effective")
  .select(`*, custodian:custodian_id(full_name)`)
  .eq("custodian_id", custodianId);

// Result structure
{
  soa_id: "...",
  custodian_id: "abc-123",
  custodian: {
    full_name: "John Doe"
  }
}
```

---

## 🔄 DATABASE TRIGGERS

### Automatic Actions
When SOA record is created:
- ✅ Automatically calculate final_net_cash_position
- ✅ Set assignment_date to assignment date
- ✅ Initialize status

When adjustment is added:
- ✅ Update soa_adjustments table
- ✅ Create audit trail (created_by, created_at)
- ✅ Increment adjustment count

When SOA is viewed:
- ✅ Apply role-based filtering
- ✅ Fetch custodian name (if admin)
- ✅ Calculate all running totals

See DATABASE_TRIGGERS_SOA_WORKFLOW.md for detailed trigger logic.

---

## 📱 FRONTEND INTEGRATION

### StatementOfAccounts.tsx
Queries the v_soa_effective view with:
- Role-based filtering
- Date range filtering
- Custodian name lookup (admin only)
- Total calculations

### AdminSOAAdjustments.tsx
Performs operations on:
- v_soa_effective (to list SOA)
- soa_adjustments (to add adjustment)
- Includes audit trail (created_by, created_at)

---

## ⚡ Performance Notes

### Query Optimization
- v_soa_effective is a view (pre-calculated)
- custodian_id is indexed for quick lookup
- assignment_date is indexed for range queries
- soa_id is primary key

### Typical Query Times
- View all SOA (1 month): < 100ms
- Add adjustment: < 50ms
- Calculate totals: < 200ms

---

## 🔗 Related Documentation

- **Complete Schema**: DATABASE_SOA_DOCUMENTATION_COMPLETE_SUMMARY.md
- **Triggers & Logic**: DATABASE_TRIGGERS_SOA_WORKFLOW.md
- **Code Implementation**: SOA_TECHNICAL_GUIDE.md
- **User Guide**: SOA_PAGES_QUICK_GUIDE.md

---

## ❓ Frequently Asked Questions

**Q: Can custodians see other custodians' SOA?**  
A: No, filtered by `custodian_id = current_user_id`

**Q: Can custodians edit their own SOA?**  
A: No, only admins/supervisors can edit

**Q: What happens when I make an adjustment?**  
A: Added to soa_adjustments table with audit trail

**Q: Can I undo an adjustment?**  
A: No, but you can create opposite adjustment (DEBIT if CREDIT)

**Q: How long is adjustment history kept?**  
A: Indefinitely - full audit trail maintained

---

## 📞 Getting Help

- **User Question**: See QUICK_REFERENCE.md
- **Admin Question**: See SOA_PAGES_QUICK_GUIDE.md
- **Developer Question**: See DATABASE_SOA_DOCUMENTATION_COMPLETE_SUMMARY.md
- **Code Question**: See SOA_TECHNICAL_GUIDE.md

---

**Last Updated**: January 26, 2026  
**Database**: Supabase (PostgreSQL)  
**Version**: 1.0

