# 🗄️ DATABASE SOA DOCUMENTATION - COMPLETE SUMMARY

## Overview

This is the comprehensive database schema documentation for the Sruthi CRA Operations Platform. All table definitions, relationships, indexes, and constraints are documented below.

---

## 📑 TABLE OF CONTENTS

1. [Core Tables](#core-tables)
2. [Views](#views)
3. [Indexes](#indexes)
4. [Constraints & Relationships](#constraints--relationships)
5. [Triggers & Automation](#triggers--automation)
6. [Data Types](#data-types)
7. [Query Examples](#query-examples)
8. [Performance Notes](#performance-notes)

---

## 🗂️ CORE TABLES

### Table: profiles

**Purpose**: Store user information and roles  
**Size**: ~200-500 rows  
**Update Frequency**: Low  

```sql
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'custodian',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT profiles_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_email_key UNIQUE (email),
  CONSTRAINT profiles_role_check CHECK (
    role IN ('admin', 'supervisor', 'custodian')
  )
);
```

**Columns**:
| Column | Type | Required | Unique | Default | Notes |
|--------|------|----------|--------|---------|-------|
| id | UUID | Yes | Yes | gen_random_uuid() | Primary key |
| email | TEXT | Yes | Yes | None | User email, unique |
| full_name | TEXT | Yes | No | None | Display name |
| role | TEXT | Yes | No | 'custodian' | admin / supervisor / custodian |
| created_at | TIMESTAMP | Yes | No | NOW() | Account creation |
| updated_at | TIMESTAMP | Yes | No | NOW() | Last update |

**Indexes**:
- `profiles_pkey` on id (PRIMARY KEY)
- `profiles_email_key` on email (UNIQUE)
- `profiles_role_idx` on role (for filtering by role)

**Constraints**:
- Role must be: 'admin', 'supervisor', or 'custodian'
- Email must be unique
- Email format: Valid email address

---

### Table: assignments

**Purpose**: Daily assignment of custodians to vehicles/routes  
**Size**: ~1,000-5,000 rows  
**Update Frequency**: Daily  

```sql
CREATE TABLE public.assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  custodian_id UUID NOT NULL,
  vehicle_id UUID,
  route_id UUID,
  assignment_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT assignments_pkey PRIMARY KEY (id),
  CONSTRAINT assignments_custodian_id_fkey FOREIGN KEY (custodian_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT assignments_status_check CHECK (
    status IN ('active', 'completed', 'cancelled')
  )
);
```

**Columns**:
| Column | Type | Required | Unique | Default | Notes |
|--------|------|----------|--------|---------|-------|
| id | UUID | Yes | Yes | gen_random_uuid() | Primary key |
| custodian_id | UUID | Yes | No | None | FK to profiles |
| vehicle_id | UUID | No | No | None | Vehicle assigned |
| route_id | UUID | No | No | None | Route assigned |
| assignment_date | DATE | Yes | No | None | Date of assignment |
| start_time | TIME | No | No | None | Start time |
| end_time | TIME | No | No | None | End time |
| status | TEXT | No | No | 'active' | active / completed / cancelled |
| created_at | TIMESTAMP | Yes | No | NOW() | Record creation |
| updated_at | TIMESTAMP | Yes | No | NOW() | Last update |

**Indexes**:
- `assignments_pkey` on id
- `assignments_custodian_id_idx` on custodian_id (for filtering)
- `assignments_assignment_date_idx` on assignment_date (for range queries)
- `assignments_custodian_date_idx` on (custodian_id, assignment_date) (composite)

**Foreign Keys**:
- custodian_id → profiles(id) ON DELETE CASCADE

**Constraints**:
- Status must be: 'active', 'completed', or 'cancelled'
- assignment_date must be valid date

---

### Table: v_soa_effective (VIEW)

**Purpose**: Calculate and display SOA records with all computations  
**Type**: Database VIEW (read-only, calculated)  
**Update Frequency**: Real-time (calculated on query)  

```sql
CREATE OR REPLACE VIEW public.v_soa_effective AS
SELECT
  a.id as soa_id,
  a.id as assignment_id,
  a.custodian_id,
  a.assignment_date,
  
  -- Cash movements
  COALESCE(cp.cash_picked, 0) as cash_picked,
  COALESCE(cl.cash_loaded, 0) as cash_loaded,
  (COALESCE(cp.cash_picked, 0) - COALESCE(cl.cash_loaded, 0)) as difference,
  
  -- Adjustments
  COALESCE(adj.total_adjustments, 0) as cash_adjusted,
  COALESCE(excess.excess_reported, 0) as excess_reported,
  
  -- Travel
  COALESCE(travel.travel_km, 0) as travel_km,
  COALESCE(travel.travel_allowance, 0) as travel_allowance,
  
  -- Final calculation
  (COALESCE(cp.cash_picked, 0) 
   - COALESCE(cl.cash_loaded, 0)
   + COALESCE(adj.total_adjustments, 0)
   - COALESCE(excess.excess_reported, 0)) as final_net_cash_position,
  
  a.created_at,
  (SELECT MAX(created_at) FROM soa_adjustments WHERE soa_id = a.id) as posted_at,
  a.status
FROM assignments a
LEFT JOIN cash_pickups cp ON a.id = cp.assignment_id
LEFT JOIN cash_loaded cl ON a.id = cl.assignment_id
LEFT JOIN (
  SELECT soa_id, SUM(
    CASE 
      WHEN adjustment_type = 'CREDIT' THEN adjustment_amount
      WHEN adjustment_type = 'DEBIT' THEN -adjustment_amount
    END
  ) as total_adjustments
  FROM soa_adjustments
  GROUP BY soa_id
) adj ON a.id = adj.soa_id
LEFT JOIN excess_cash excess ON a.id = excess.assignment_id
LEFT JOIN travel_tracking travel ON a.id = travel.assignment_id;
```

**Columns** (same as above + relationships):
| Column | Type | Source | Notes |
|--------|------|--------|-------|
| soa_id | UUID | assignments.id | Record ID |
| assignment_id | UUID | assignments.id | Alias for soa_id |
| custodian_id | UUID | assignments.custodian_id | User ID |
| assignment_date | DATE | assignments.assignment_date | Date |
| cash_picked | DECIMAL | cash_pickups | Picked amount |
| cash_loaded | DECIMAL | cash_loaded | Loaded amount |
| difference | DECIMAL | Calculated | picked - loaded |
| cash_adjusted | DECIMAL | soa_adjustments | Manual adjustments |
| excess_reported | DECIMAL | excess_cash | Excess amount |
| travel_km | DECIMAL | travel_tracking | Kilometers |
| travel_allowance | DECIMAL | travel_tracking | Allowance |
| final_net_cash_position | DECIMAL | Calculated | Final position |
| created_at | TIMESTAMP | assignments | Created time |
| posted_at | TIMESTAMP | soa_adjustments | Posted time |
| status | TEXT | assignments | Record status |

**Performance**:
- Uses LEFT JOINs to handle missing data
- Indexes on foreign keys ensure fast joins
- Aggregate functions pre-calculate totals
- View is materialized for performance

---

### Table: soa_adjustments

**Purpose**: Store manual adjustments made by admins  
**Size**: ~100-500 rows  
**Update Frequency**: As needed  

```sql
CREATE TABLE public.soa_adjustments (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  soa_id UUID NOT NULL,
  assignment_id UUID NOT NULL,
  custodian_id UUID NOT NULL,
  adjustment_type TEXT NOT NULL,
  adjustment_amount DECIMAL(12, 2) NOT NULL,
  reason TEXT NOT NULL,
  reference TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT soa_adjustments_pkey PRIMARY KEY (id),
  CONSTRAINT soa_adjustments_soa_id_fkey FOREIGN KEY (soa_id)
    REFERENCES public.assignments(id) ON DELETE CASCADE,
  CONSTRAINT soa_adjustments_assignment_id_fkey FOREIGN KEY (assignment_id)
    REFERENCES public.assignments(id) ON DELETE CASCADE,
  CONSTRAINT soa_adjustments_custodian_id_fkey FOREIGN KEY (custodian_id)
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  CONSTRAINT soa_adjustments_created_by_fkey FOREIGN KEY (created_by)
    REFERENCES public.profiles(id) ON DELETE RESTRICT,
  CONSTRAINT soa_adjustments_type_check CHECK (
    adjustment_type IN ('CREDIT', 'DEBIT')
  ),
  CONSTRAINT soa_adjustments_amount_check CHECK (
    adjustment_amount > 0
  )
);
```

**Columns**:
| Column | Type | Required | Unique | Default | Notes |
|--------|------|----------|--------|---------|-------|
| id | UUID | Yes | Yes | gen_random_uuid() | Primary key |
| soa_id | UUID | Yes | No | None | FK to assignments |
| assignment_id | UUID | Yes | No | None | FK to assignments |
| custodian_id | UUID | Yes | No | None | FK to profiles |
| adjustment_type | TEXT | Yes | No | None | CREDIT / DEBIT |
| adjustment_amount | DECIMAL(12, 2) | Yes | No | None | Positive amount |
| reason | TEXT | Yes | No | None | Why adjusted |
| reference | TEXT | No | No | None | Email/ticket ref |
| created_by | UUID | Yes | No | None | FK to profiles (admin) |
| created_at | TIMESTAMP | Yes | No | NOW() | When created |

**Indexes**:
- `soa_adjustments_pkey` on id
- `soa_adjustments_soa_id_idx` on soa_id
- `soa_adjustments_custodian_id_idx` on custodian_id
- `soa_adjustments_created_by_idx` on created_by
- `soa_adjustments_created_at_idx` on created_at

**Foreign Keys**:
- soa_id → assignments(id) ON DELETE CASCADE
- assignment_id → assignments(id) ON DELETE CASCADE
- custodian_id → profiles(id) ON DELETE CASCADE
- created_by → profiles(id) ON DELETE RESTRICT

**Constraints**:
- adjustment_type must be: 'CREDIT' or 'DEBIT'
- adjustment_amount must be > 0
- reason must be non-empty

---

### Table: cash_pickups

**Purpose**: Record cash picked from locations  
**Size**: ~1,000-5,000 rows  
**Update Frequency**: Daily  

```sql
CREATE TABLE public.cash_pickups (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  location_id UUID,
  cash_picked DECIMAL(12, 2) NOT NULL DEFAULT 0,
  pickup_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT cash_pickups_pkey PRIMARY KEY (id),
  CONSTRAINT cash_pickups_assignment_id_fkey FOREIGN KEY (assignment_id)
    REFERENCES public.assignments(id) ON DELETE CASCADE,
  CONSTRAINT cash_pickups_amount_check CHECK (cash_picked >= 0)
);
```

**Key Columns**:
- id: UUID primary key
- assignment_id: Reference to assignment
- cash_picked: Amount picked (non-negative)
- pickup_time: When picked
- created_at: Record creation

---

### Table: cash_loaded

**Purpose**: Record cash loaded into vehicles  
**Size**: ~1,000-5,000 rows  
**Update Frequency**: Daily  

```sql
CREATE TABLE public.cash_loaded (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  vehicle_id UUID,
  cash_loaded DECIMAL(12, 2) NOT NULL DEFAULT 0,
  load_time TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT cash_loaded_pkey PRIMARY KEY (id),
  CONSTRAINT cash_loaded_assignment_id_fkey FOREIGN KEY (assignment_id)
    REFERENCES public.assignments(id) ON DELETE CASCADE,
  CONSTRAINT cash_loaded_amount_check CHECK (cash_loaded >= 0)
);
```

**Key Columns**:
- id: UUID primary key
- assignment_id: Reference to assignment
- cash_loaded: Amount loaded (non-negative)
- load_time: When loaded
- created_at: Record creation

---

### Table: travel_tracking

**Purpose**: Record travel details for per-km allowance  
**Size**: ~500-2,000 rows  
**Update Frequency**: Daily  

```sql
CREATE TABLE public.travel_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  travel_km DECIMAL(10, 2) DEFAULT 0,
  travel_allowance DECIMAL(12, 2) DEFAULT 0,
  from_location TEXT,
  to_location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT travel_tracking_pkey PRIMARY KEY (id),
  CONSTRAINT travel_tracking_assignment_id_fkey FOREIGN KEY (assignment_id)
    REFERENCES public.assignments(id) ON DELETE CASCADE
);
```

**Key Columns**:
- id: UUID primary key
- assignment_id: Reference to assignment
- travel_km: Kilometers traveled
- travel_allowance: Calculated allowance
- from_location, to_location: Route description

---

### Table: excess_cash

**Purpose**: Record excess cash reported by custodians  
**Size**: ~100-500 rows  
**Update Frequency**: As reported  

```sql
CREATE TABLE public.excess_cash (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  assignment_id UUID NOT NULL,
  excess_reported DECIMAL(12, 2) NOT NULL DEFAULT 0,
  reason TEXT,
  reported_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  CONSTRAINT excess_cash_pkey PRIMARY KEY (id),
  CONSTRAINT excess_cash_assignment_id_fkey FOREIGN KEY (assignment_id)
    REFERENCES public.assignments(id) ON DELETE CASCADE
);
```

**Key Columns**:
- id: UUID primary key
- assignment_id: Reference to assignment
- excess_reported: Amount of excess
- reason: Why excess occurred
- reported_at: When reported

---

## 👁️ VIEWS

### View: v_soa_effective

**Purpose**: Calculated SOA view with all adjustments  
**Type**: DATABASE VIEW (real-time calculation)  
**Used By**: StatementOfAccounts.tsx, AdminSOAAdjustments.tsx  

**Calculation Logic**:
```
final_net_cash_position = 
  cash_picked
  - cash_loaded
  + cash_adjustments (CREDIT - DEBIT)
  - excess_reported
```

**Example Query**:
```sql
-- Get all SOA for custodian
SELECT * FROM v_soa_effective
WHERE custodian_id = 'abc-123'
AND assignment_date >= '2026-01-01';
```

---

## 🔗 CONSTRAINTS & RELATIONSHIPS

### Primary Key-Foreign Key Relationships

```
profiles (1)
  ↑
  ├─ (Many) assignments.custodian_id
  ├─ (Many) soa_adjustments.custodian_id
  └─ (Many) soa_adjustments.created_by

assignments (1)
  ↑
  ├─ (Many) cash_pickups.assignment_id
  ├─ (Many) cash_loaded.assignment_id
  ├─ (Many) travel_tracking.assignment_id
  ├─ (Many) excess_cash.assignment_id
  └─ (Many) soa_adjustments.soa_id
```

### Cascade Rules

```
profiles deleted
  → assignments also deleted (ON DELETE CASCADE)
  → soa_adjustments also deleted (cascade)

assignments deleted
  → cash_pickups, cash_loaded, etc. deleted
  → soa_adjustments deleted

soa_adjustments has RESTRICT on created_by
  → Can't delete admin if they created adjustments
```

---

## 🔐 ROW-LEVEL SECURITY

### RLS Policies (if enabled)

```sql
-- Custodian can see only own SOA
CREATE POLICY "custodian_own_soa"
ON v_soa_effective FOR SELECT
USING (custodian_id = auth.uid());

-- Admin can see all SOA
CREATE POLICY "admin_all_soa"
ON v_soa_effective FOR SELECT
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) 
  IN ('admin', 'supervisor')
);

-- Only admin can insert adjustments
CREATE POLICY "admin_only_adjustments"
ON soa_adjustments FOR INSERT
WITH CHECK (
  (SELECT role FROM profiles WHERE id = auth.uid()) 
  IN ('admin', 'supervisor')
);
```

---

## 📊 INDEXES

### All Indexes

```sql
-- Primary Keys (Automatic)
profiles_pkey on profiles(id)
assignments_pkey on assignments(id)
soa_adjustments_pkey on soa_adjustments(id)
cash_pickups_pkey on cash_pickups(id)
cash_loaded_pkey on cash_loaded(id)
travel_tracking_pkey on travel_tracking(id)
excess_cash_pkey on excess_cash(id)

-- Unique Constraints
profiles_email_key on profiles(email)

-- Foreign Key Indexes
assignments_custodian_id_idx on assignments(custodian_id)
soa_adjustments_soa_id_idx on soa_adjustments(soa_id)
soa_adjustments_custodian_id_idx on soa_adjustments(custodian_id)
soa_adjustments_created_by_idx on soa_adjustments(created_by)
cash_pickups_assignment_id_idx on cash_pickups(assignment_id)
cash_loaded_assignment_id_idx on cash_loaded(assignment_id)
travel_tracking_assignment_id_idx on travel_tracking(assignment_id)
excess_cash_assignment_id_idx on excess_cash(assignment_id)

-- Range Query Indexes
assignments_assignment_date_idx on assignments(assignment_date)
soa_adjustments_created_at_idx on soa_adjustments(created_at)

-- Composite Indexes
assignments_custodian_date_idx on assignments(custodian_id, assignment_date)
```

---

## 🎯 TRIGGERS

### Trigger: Update assignments.updated_at

```sql
CREATE TRIGGER update_assignments_updated_at
BEFORE UPDATE ON assignments
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Function
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

---

## 📈 PERFORMANCE NOTES

### Query Performance

**Fast Queries** (< 100ms):
- Select by assignment_date
- Select by custodian_id
- Count records by date
- Join with custodian name

**Medium Queries** (100-500ms):
- Calculate totals for date range
- Join multiple tables
- Aggregate by custodian

**Slow Queries** (> 500ms):
- Full table scan without filters
- Complex aggregations
- Multiple nested joins

### Optimization Tips

1. **Always filter by custodian_id** when possible
2. **Use assignment_date for range queries** (indexed)
3. **Avoid SELECT ** - fetch only needed columns
4. **Use LIMIT** when not need all rows
5. **Combine conditions** in WHERE clause
6. **Use indexes** for JOINs

---

## 📝 QUERY EXAMPLES

### Example 1: Get SOA for custodian (this month)
```sql
SELECT * FROM v_soa_effective
WHERE custodian_id = 'abc-123'
AND assignment_date >= DATE_TRUNC('month', NOW())
ORDER BY assignment_date DESC;
```

### Example 2: Find all adjustments for SOA
```sql
SELECT * FROM soa_adjustments
WHERE soa_id = 'soa-uuid'
ORDER BY created_at DESC;
```

### Example 3: Calculate total adjustments by type
```sql
SELECT 
  adjustment_type,
  COUNT(*) as count,
  SUM(adjustment_amount) as total
FROM soa_adjustments
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY adjustment_type;
```

### Example 4: Find SOA with discrepancies
```sql
SELECT 
  soa_id,
  assignment_date,
  cash_picked,
  cash_loaded,
  (cash_picked - cash_loaded) as difference,
  CASE 
    WHEN ABS(cash_picked - cash_loaded) > 100 THEN 'NEEDS_REVIEW'
    ELSE 'OK'
  END as status
FROM v_soa_effective
WHERE assignment_date >= CURRENT_DATE - INTERVAL '30 days'
HAVING ABS(cash_picked - cash_loaded) > 100;
```

---

## 🔍 DATA VALIDATION

### Column Constraints

```
profiles:
  - email: UNIQUE, valid format
  - role: IN ('admin', 'supervisor', 'custodian')
  - full_name: NOT NULL

assignments:
  - custodian_id: FOREIGN KEY, NOT NULL
  - assignment_date: NOT NULL, valid date
  - status: IN ('active', 'completed', 'cancelled')

soa_adjustments:
  - adjustment_amount: > 0, DECIMAL(12,2)
  - adjustment_type: IN ('CREDIT', 'DEBIT')
  - reason: NOT NULL, text
  - custodian_id: NOT NULL, FOREIGN KEY
  - created_by: NOT NULL, FOREIGN KEY
```

---

## 📦 BACKUP & RECOVERY

### Regular Backups
- **Frequency**: Daily automated
- **Retention**: 30 days
- **Location**: Supabase managed

### Recovery Procedure
```
1. Contact Supabase support
2. Specify recovery point
3. Restore from backup
4. Verify data integrity
```

---

## 🚀 MIGRATION NOTES

### Adding New Columns

```sql
-- Add column
ALTER TABLE assignments ADD COLUMN notes TEXT;

-- Add with default
ALTER TABLE assignments ADD COLUMN is_approved BOOLEAN DEFAULT FALSE;

-- Add with constraint
ALTER TABLE assignments ADD COLUMN approval_date DATE CHECK (approval_date >= assignment_date);
```

### Modifying Columns

```sql
-- Change type (with backup)
ALTER TABLE soa_adjustments 
ALTER COLUMN adjustment_amount TYPE DECIMAL(15, 2);

-- Add NOT NULL
ALTER TABLE profiles ALTER COLUMN full_name SET NOT NULL;
```

---

## 📞 DATABASE SUPPORT

**Issues**:
- Check Supabase status: https://status.supabase.io
- Review error messages carefully
- Check row-level security policies
- Verify foreign key constraints
- Review index usage

**For Help**:
- Supabase Docs: https://supabase.io/docs
- GitHub Issues: Report problems
- Email: Support team

---

**Database**: PostgreSQL via Supabase  
**Last Updated**: January 26, 2026  
**Version**: 1.0  

For UI integration, see [SOA_TECHNICAL_GUIDE.md](SOA_TECHNICAL_GUIDE.md)

