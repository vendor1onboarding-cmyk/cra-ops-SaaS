# Sruthi CRA Ops - Project Documentation

## 📋 Project Overview

**Sruthi CRA Ops** is a comprehensive Cash Replenishment & ATM Operations management system designed for banking field operations. It enables custodians (field officers) to manage daily cash operations, track ATM replenishments, handle cash pickups, and submit end-of-day (EOD) summaries for admin approval.

### Key Objectives
- Streamline daily cash operations for field custodians
- Provide real-time visibility to admins on cash movements
- Ensure accurate cash reconciliation at ATM level
- Enable digital signatures and audit trails for all transactions
- Support offline-first PWA (Progressive Web App) for field operations

---

## 🏗️ Technology Stack

### Frontend
- **React 18.3.1** - UI framework
- **TypeScript 5.6.3** - Type-safe development
- **Vite 7.2.7** - Build tool & dev server
- **React Router DOM 6.28** - Client-side routing
- **Tailwind CSS 3.4.1** - Utility-first CSS framework

### Backend & Database
- **Supabase** - Backend-as-a-Service (PostgreSQL, Auth, Storage)
- **@supabase/supabase-js 2.48** - Supabase client library

### Additional Libraries
- **Leaflet 1.9.4** - Interactive maps for route tracking
- **React Leaflet 4.2.1** - React wrapper for Leaflet
- **React Signature Canvas 1.1** - Digital signature capture
- **TanStack React Query 5.59** - Data fetching (optional, installed)
- **Vite PWA Plugin 1.2** - Progressive Web App support

### Development Tools
- **Autoprefixer 10.4** - CSS vendor prefixes
- **PostCSS 8.4** - CSS transformations
- **Tailwind CSS IntelliSense** - IDE support (recommended)

---

## 📁 Project Structure

```
sruthi-cra/
├── src/
│   ├── api/
│   │   └── supabaseClient.ts          # Supabase client initialization
│   │
│   ├── components/
│   │   ├── Layout.tsx                  # Main app layout with navigation
│   │   ├── DenominationFields.tsx       # Reusable denomination input fields
│   │   ├── FileUpload.tsx               # File upload component
│   │   └── RequireAdmin.tsx             # Admin-only route guard
│   │
│   ├── context/
│   │   └── AuthContext.tsx              # Authentication state & management
│   │
│   ├── pages/
│   │   ├── Login.tsx                    # Authentication page
│   │   │
│   │   ├── // CUSTODIAN PAGES //
│   │   ├── Dashboard.tsx                # Custodian dashboard (cash summary)
│   │   ├── DenominationPlan.tsx         # Plan cash distribution to ATMs
│   │   ├── CashPickup.tsx               # Record cash pickup from bank
│   │   ├── ATMReplenishment.tsx         # Load cash into ATMs
│   │   ├── ATMExcessCash.tsx            # Handle excess cash withdrawals
│   │   ├── ATMCashAdjustment.tsx        # Manual cash adjustments
│   │   ├── TechnicalIssues.tsx          # Report technical issues
│   │   ├── TravelTracking.tsx           # Track travel routes & KM
│   │   ├── StatementOfAccounts.tsx      # View SOA records
│   │   ├── EODSummary.tsx               # End of day summary & signing
│   │   │
│   │   ├── // ADMIN PAGES //
│   │   ├── AdminDashboard.tsx           # Admin dashboard (KPIs & stats)
│   │   ├── AdminApprovals.tsx           # List pending EOD approvals
│   │   ├── AdminEODDetail.tsx           # Detailed EOD review & approval
│   │   ├── AdminRouteAssignment.tsx     # Assign routes to custodians
│   │   ├── AdminSOAAdjustments.tsx      # Adjust statement of accounts
│   │   │
│   │   └── EODSummary_Prod_BKP.tsx      # Backup of production EOD
│   │
│   ├── styles/
│   │   └── global.css                   # Global styles
│   │
│   ├── utils/
│   │   ├── getActiveAssignment.ts       # Fetch active assignment utility
│   │   ├── getActiveAssignmentWithSites.ts # Assignment with route sites
│   │   ├── leafletFix.ts                # Leaflet rendering fixes
│   │   └── time.ts                      # Time utility functions
│   │
│   ├── App.tsx                          # Main app routing
│   ├── main.tsx                         # React entry point
│   └── vite-env.d.ts                    # Vite environment types
│
├── public/
│   └── icons/                           # PWA icons (192x192, 512x512)
│
├── vite.config.ts                       # Vite config with PWA plugin
├── tailwind.config.js                   # Tailwind CSS configuration
├── tsconfig.json                        # TypeScript configuration
├── postcss.config.js                    # PostCSS configuration
├── package.json                         # Dependencies & scripts
└── index.html                           # HTML entry point
```

---

## 👥 User Roles & Permissions

### 1. **Custodian** (Field Officer)
- **Access Level**: Full custodian operations
- **Pages Available**:
  - Dashboard (main operations center)
  - Denomination Plan
  - Cash Pickup
  - ATM Replenishment
  - ATM Excess Cash Handling
  - ATM Cash Adjustment
  - Technical Issues Reporting
  - Travel Tracking
  - Statement of Accounts
  - EOD Summary & Signing
- **Key Actions**:
  - Record daily operations
  - Plan cash distribution
  - Load ATMs with denominations
  - Submit EOD reports
  - Digitally sign EOD reports
  - Track travel distance (KM)

### 2. **Admin** (System Administrator)
- **Access Level**: Full system access + approvals
- **Pages Available**:
  - Admin Dashboard (KPIs & stats)
  - EOD Approvals (review submissions)
  - EOD Details (detailed review)
  - Route Assignment (assign custodians to routes)
  - SOA Adjustments (modify statement of accounts)
- **Key Actions**:
  - Approve/reject EOD submissions
  - Assign routes to custodians
  - Monitor daily operations KPIs
  - Manage account adjustments
  - View all custodian reports

### 3. **Supervisor** (Intermediate)
- **Access Level**: Admin functions + validation
- **Pages Available**: Same as Admin
- **Difference**: May have additional validation/approval workflows

---

## 🗄️ Database Schema (Complete DDL Reference)

### Master Data Tables

#### 1. `profiles` - User Master Data
**Purpose**: Store user information and roles  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | UUID | PK, FK (auth.users.id) | Synced with Supabase Auth |
| `full_name` | TEXT | nullable | User's full name |
| `role` | TEXT | Default 'custodian', CHECK (admin\|supervisor\|custodian) | User role for access control |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Account creation time |

**Relationships**: Referenced by assignments, soa_postings, soa_adjustments, travel_logs, soa_ledger  
**Indexes**: Primary key only

---

#### 2. `sites` - ATM/Bank Sites Master
**Purpose**: Central repository of all ATM and bank branch locations  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Unique site identifier |
| `site_code` | TEXT | UNIQUE NOT NULL | Unique site code for easy reference |
| `atm_id` | TEXT | nullable | ATM machine ID if applicable |
| `bank_name` | TEXT | nullable | Bank name or branch |
| `address` | TEXT | nullable | Physical location address |
| `city` | TEXT | nullable | City name |
| `latitude` | NUMERIC(9,6) | nullable | GPS latitude for geolocation |
| `longitude` | NUMERIC(9,6) | nullable | GPS longitude for geolocation |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation time |

**Relationships**: Referenced by route_sites, denomination_plans, atm_replenishments, atm_cash_adjustments, technical_issues, atm_excess_cash, soa_ledger  
**Indexes**: `site_code` (UNIQUE)

---

#### 3. `banks` - Bank Branch Master
**Purpose**: Store bank and branch information  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Bank identifier |
| `name` | TEXT | NOT NULL | Bank name |
| `branch` | TEXT | NOT NULL | Branch name |
| `short_code` | TEXT | nullable | Bank short code for reports |
| `is_active` | BOOLEAN | Default true | Active/inactive status |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation time |

**Relationships**: Reference data for cash_pickups  
**Indexes**: Primary key only

---

#### 4. `vehicle_rates` - Vehicle Rate Master
**Purpose**: Store travel allowance rates by vehicle type  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `vehicle_type` | TEXT | PK | Vehicle type (Car, Van, Bike, etc.) |
| `rate_per_km` | NUMERIC | NOT NULL | Rate per kilometer in rupees |
| `active` | BOOLEAN | Default true | Whether rate is active |

**Relationships**: Referenced by travel_logs for allowance calculations  
**Indexes**: Primary key only

---

### Operational Transaction Tables

#### 5. `assignments` - Daily Custodian Assignments
**Purpose**: Main assignment record linking custodian to a day's operations  
**Triggers**: `trg_post_soa_on_assignment_approval` (AFTER UPDATE OF status)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Unique assignment ID |
| `assignment_date` | DATE | NOT NULL | Date of assignment |
| `custodian_id` | UUID | FK (profiles.id) NOT NULL | Assigned custodian |
| `title` | TEXT | nullable | Assignment title/description |
| `status` | TEXT | Default 'open', CHECK (open\|submitted\|approved\|rejected) | Workflow status |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Creation timestamp |
| `approved_at` | TIMESTAMP WITH TZ | nullable | Approval timestamp |
| `approved_by` | UUID | FK (profiles.id), nullable | Approver's user ID |
| `rejected_at` | TIMESTAMP WITH TZ | nullable | Rejection timestamp |
| `rejected_by` | UUID | FK (profiles.id), nullable | Rejector's user ID |
| `rejection_reason` | TEXT | nullable | Reason for rejection |
| `eod_signed` | BOOLEAN | Default false | Whether custodian signed EOD |
| `eod_signed_at` | TIMESTAMP WITH TZ | nullable | EOD signature timestamp |
| `eod_signature_url` | TEXT | nullable | URL to signature image in storage |

**Relationships**: Referenced by route_sites, denomination_plans, cash_pickups, atm_replenishments, atm_cash_adjustments, atm_excess_cash, technical_issues, travel_logs, soa_postings, soa_adjustments, soa_ledger  
**Indexes**: `idx_assignments_date`, `idx_assignments_custodian`  
**Cascade Behavior**: ON DELETE CASCADE for route_sites, denomination_plans, cash_pickups, atm_replenishments, atm_cash_adjustments, technical_issues, travel_logs

---

#### 6. `route_sites` - Route Site Mapping
**Purpose**: Map sites to an assignment route in sequence  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Record ID |
| `assignment_id` | BIGINT | FK (assignments.id) NOT NULL | Parent assignment |
| `site_id` | BIGINT | FK (sites.id) NOT NULL | Site in route |
| `sequence_no` | INTEGER | nullable | Order in route (1, 2, 3...) |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Creation timestamp |

**Relationships**: Links assignments to sites  
**Indexes**: `idx_route_sites_assignment`, `idx_route_sites_site`

---

#### 7. `denomination_plans` - Planned Cash Distribution
**Purpose**: Plan how cash will be distributed to each site  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Plan ID |
| `assignment_id` | BIGINT | FK (assignments.id) | Parent assignment |
| `site_id` | BIGINT | FK (sites.id) | Target site |
| `has_source_report` | BOOLEAN | Default true | Whether source report exists |
| `remarks` | TEXT | nullable | Planning remarks |
| `denom_2000` | INTEGER | Default 0 | 2000 note count |
| `denom_500` | INTEGER | Default 0 | 500 note count |
| `denom_200` | INTEGER | Default 0 | 200 note count |
| `denom_100` | INTEGER | Default 0 | 100 note count |
| `denom_50` | INTEGER | Default 0 | 50 note count |
| `denom_20` | INTEGER | Default 0 | 20 note count |
| `denom_10` | INTEGER | Default 0 | 10 note count |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Creation timestamp |

**Unique Constraint**: UNIQUE(assignment_id, site_id)  
**Relationships**: One per assignment per site  
**Indexes**: `idx_denomination_plans_assignment`, `idx_denomination_plans_site`

---

#### 8. `cash_pickups` - Bank Cash Pickup Records
**Purpose**: Record cash picked up from banks at start of day  
**Triggers**: `after_cash_pickup_insert` (updates SOA ledger)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Pickup ID |
| `assignment_id` | BIGINT | FK (assignments.id) | Parent assignment |
| `bank_name` | TEXT | nullable | Bank name |
| `branch` | TEXT | nullable | Branch name |
| `pickup_time` | TIMESTAMP WITH TZ | Default now() | Time of pickup |
| `denom_2000` to `denom_10` | INTEGER | Default 0 | Denomination counts |
| `expected_amount` | NUMERIC | nullable | Expected amount from bank |
| `total_amount` | NUMERIC | nullable | Actual total picked up |
| `variance` | NUMERIC | nullable | Difference (expected - actual) |
| `slip_url` | TEXT | nullable | Bank slip image URL |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation time |

**Unique Constraint**: UNIQUE(assignment_id, bank_name) - One pickup per bank per day  
**Relationships**: Source of cash for the assignment  
**Indexes**: `idx_cash_pickups_assignment`

---

#### 9. `atm_replenishments` - ATM Cash Loading
**Purpose**: Record cash loaded into each ATM  
**Triggers**: `after_atm_replenishments_insert` (updates SOA ledger & calculates allowance)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Replenishment ID |
| `assignment_id` | BIGINT | FK (assignments.id) | Parent assignment |
| `site_id` | BIGINT | FK (sites.id) | Target ATM site |
| `time_in` | TIMESTAMP WITH TZ | nullable | Time started loading |
| `time_out` | TIMESTAMP WITH TZ | nullable | Time finished loading |
| `denom_2000` to `denom_10` | INTEGER | Default 0 | Denomination counts |
| `closing_balance` | NUMERIC | nullable | ATM closing balance |
| `remarks` | TEXT | nullable | Replenishment remarks |
| `receipt_url` | TEXT | nullable | ATM receipt image |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation time |
| `load_lat` | NUMERIC(9,6) | nullable | GPS latitude at loading |
| `load_lng` | NUMERIC(9,6) | nullable | GPS longitude at loading |
| `distance_meters` | NUMERIC | nullable | Distance from planned location |
| `geo_status` | TEXT | Default 'unknown' | Geolocation verification status |
| `photo_required` | BOOLEAN | Default false | Whether photo evidence required |
| `photo_url` | TEXT | nullable | Actual photo evidence URL |

**Relationships**: Records actual cash loaded per site  
**Indexes**: `idx_atm_repl_assignment`, `idx_atm_repl_site`

---

#### 10. `atm_cash_adjustments` - Cash Adjustments
**Purpose**: Record manual adjustments (withdrawals/deposits) at ATMs  
**Triggers**: `after_atm_cash_adjustments_insert` (updates SOA ledger)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Adjustment ID |
| `assignment_id` | BIGINT | FK (assignments.id) NOT NULL | Parent assignment |
| `site_id` | BIGINT | FK (sites.id) NOT NULL | Adjusted ATM |
| `adjustment_type` | TEXT | Default 'withdrawal', CHECK (withdrawal\|deposit) | Type of adjustment |
| `denom_100` to `denom_2000` | INTEGER | Default 0 | Denomination counts adjusted |
| `reason` | TEXT | NOT NULL | Reason for adjustment |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation time |
| `created_by` | UUID | FK (profiles.id) | User making adjustment |
| `geo_lat` | NUMERIC(9,6) | nullable | GPS latitude |
| `geo_lng` | NUMERIC(9,6) | nullable | GPS longitude |
| `distance_meters` | NUMERIC | nullable | Distance verification |
| `photo_url` | TEXT | nullable | Evidence photo |

**Relationships**: Records corrections to cash at sites  
**Indexes**: None

---

#### 11. `atm_excess_cash` - Excess Cash Management
**Purpose**: Record when ATMs have excess cash exceeding limits  
**Triggers**: `after_atm_excess_cash_insert` (updates SOA ledger)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Excess cash record ID |
| `assignment_id` | BIGINT | FK (assignments.id) NOT NULL | Parent assignment |
| `site_id` | BIGINT | FK (sites.id) NOT NULL | ATM site with excess |
| `detected_date` | DATE | Default CURRENT_DATE | Date excess detected |
| `denom_100` to `denom_2000` | INTEGER | Default 0 | Denomination counts |
| `total_excess_amount` | NUMERIC | GENERATED ALWAYS (calculated) | Computed total amount |
| `atm_receipt_url` | TEXT | NOT NULL | ATM receipt image |
| `reported_to_vendor` | BOOLEAN | Default false | Vendor notification status |
| `vendor_ticket_no` | TEXT | nullable | Vendor reference number |
| `bank_notified` | BOOLEAN | Default false | Bank notification status |
| `bank_reference_no` | TEXT | nullable | Bank reference number |
| `remarks` | TEXT | nullable | Additional remarks |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation time |

**Special Calculation**: `total_excess_amount` is computed as: (denom_100*100) + (denom_200*200) + (denom_500*500) + (denom_2000*2000)  
**Relationships**: Records excess cash incidents  
**Indexes**: None

---

#### 12. `technical_issues` - Problem Reporting
**Purpose**: Log technical issues encountered at sites  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Issue ID |
| `assignment_id` | BIGINT | FK (assignments.id) | Parent assignment |
| `site_id` | BIGINT | FK (sites.id) | Problem site |
| `issue_type` | TEXT | nullable | Type of issue |
| `error_code` | TEXT | nullable | Error code from ATM/system |
| `description` | TEXT | nullable | Detailed description |
| `status` | TEXT | Default 'new', CHECK (new\|in_progress\|resolved) | Issue status |
| `photo_url` | TEXT | nullable | Evidence photo |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Reported time |
| `resolved_at` | TIMESTAMP WITH TZ | nullable | Resolution time |

**Relationships**: Tracks issues for support and analysis  
**Indexes**: `idx_tech_issues_assignment`, `idx_tech_issues_site`

---

#### 13. `travel_logs` - Travel Distance Tracking
**Purpose**: Track custodian's travel distance for allowance calculation  
**Triggers**: `after_travel_logs_update` (WHEN end_time transitions from NULL to value, updates SOA ledger)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Log ID |
| `assignment_id` | BIGINT | FK (assignments.id) NOT NULL | Parent assignment |
| `site_id` | BIGINT | FK (sites.id) ON DELETE SET NULL | Current site |
| `custodian_id` | UUID | FK (profiles.id) ON DELETE SET NULL | Traveling custodian |
| `start_time` | TIMESTAMP WITH TZ | nullable | Travel start |
| `end_time` | TIMESTAMP WITH TZ | nullable | Travel end |
| `odometer_start` | NUMERIC(10,2) | nullable | Starting odometer reading |
| `odometer_end` | NUMERIC(10,2) | nullable | Ending odometer reading |
| `km_covered` | NUMERIC(10,2) | nullable | Total KM computed |
| `gps_start_lat` | NUMERIC(9,6) | nullable | Starting latitude |
| `gps_start_lng` | NUMERIC(9,6) | nullable | Starting longitude |
| `gps_end_lat` | NUMERIC(9,6) | nullable | Ending latitude |
| `gps_end_lng` | NUMERIC(9,6) | nullable | Ending longitude |
| `status` | TEXT | Default 'in_progress', CHECK (in_progress\|completed) | Travel status |
| `vehicle_type` | TEXT | nullable | Vehicle used (Car, Van, Bike) |
| `source` | TEXT | nullable, CHECK (gps\|odometer) | Source of distance data |
| `rate_per_km` | NUMERIC(10,2) | nullable | Applicable rate |
| `allowance_amount` | NUMERIC | nullable | Computed allowance |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation |
| `updated_at` | TIMESTAMP WITH TZ | Default now() | Last update |

**Relationships**: Tracks daily travel for the assignment  
**Indexes**: `idx_travel_logs_assignment`, `idx_travel_logs_custodian`, `idx_travel_logs_start_time`

---

### Statement of Accounts (SOA) Tables

#### 14. `soa_ledger` - Complete SOA Transaction Ledger
**Purpose**: Complete audit trail of all cash transactions affecting SOA  
**Triggers**: None (populated by other table triggers)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Ledger entry ID |
| `assignment_id` | BIGINT | FK (assignments.id) ON DELETE CASCADE NOT NULL | Associated assignment |
| `custodian_id` | UUID | FK (profiles.id) NOT NULL | Custodian for entry |
| `entry_date` | DATE | NOT NULL | Date of transaction |
| `entry_time` | TIMESTAMP WITH TZ | Default now() | Exact transaction time |
| `source_table` | TEXT | NOT NULL | Source table (cash_pickups, atm_replenishments, etc.) |
| `source_id` | BIGINT | NOT NULL | ID in source table |
| `event_type` | TEXT | NOT NULL | Event type (PICKUP, LOAD, ADJUST, EXCESS, TRAVEL) |
| `site_id` | BIGINT | FK (sites.id) | Related site, if applicable |
| `amount` | NUMERIC(14,2) | NOT NULL | Transaction amount |
| `direction` | TEXT | CHECK (DEBIT\|CREDIT) NOT NULL | Debit or Credit |
| `running_balance` | NUMERIC(14,2) | nullable | Balance after transaction |
| `remarks` | TEXT | nullable | Transaction remarks |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Record creation time |

**Unique Constraint**: UNIQUE(source_table, source_id) - Prevents duplicate ledger entries  
**Relationships**: Complete audit trail for reporting  
**Indexes**: `idx_soa_assignment`, `idx_soa_custodian`, `idx_soa_entry_date`

---

#### 15. `soa_postings` - Daily SOA Summary
**Purpose**: Summary SOA posting for each assignment (one record per custodian per day)  
**Triggers**: None (populated by approval workflow)  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | SOA posting ID |
| `assignment_id` | BIGINT | FK (assignments.id) ON DELETE RESTRICT NOT NULL | Parent assignment |
| `custodian_id` | UUID | FK (profiles.id) ON DELETE RESTRICT NOT NULL | Custodian |
| `assignment_date` | DATE | NOT NULL | Date of operations |
| `cash_picked` | NUMERIC(14,2) | Default 0 | Total cash picked from bank |
| `cash_loaded` | NUMERIC(14,2) | Default 0 | Total cash loaded to ATMs |
| `cash_adjusted` | NUMERIC(14,2) | Default 0 | Total manual adjustments |
| `excess_reported` | NUMERIC(14,2) | Default 0 | Excess cash amount |
| `travel_km` | NUMERIC(10,2) | Default 0 | Total KM traveled |
| `travel_allowance` | NUMERIC(14,2) | Default 0 | Travel allowance earned |
| `net_cash_position` | NUMERIC(14,2) | NOT NULL | Final position: picked - loaded - adjusted + excess - allowance |
| `eod_signed` | BOOLEAN | Default false | EOD signed status |
| `eod_signed_at` | TIMESTAMP WITH TZ | nullable | EOD signature time |
| `eod_signature_url` | TEXT | nullable | Signature image URL |
| `posted_at` | TIMESTAMP WITH TZ | Default now() NOT NULL | Posting timestamp |
| `posted_by` | UUID | NOT NULL | User who posted (admin) |
| `source` | TEXT | Default 'eod_approval' | Source of posting |

**Unique Constraint**: UNIQUE(assignment_id) - Only one SOA per assignment  
**Relationships**: Summary record for daily operations  
**Indexes**: `uniq_soa_assignment`, `idx_soa_custodian_date`, `idx_soa_posted_at`  
**Cascade Behavior**: ON DELETE RESTRICT (cannot delete assignment with SOA posting)

---

#### 16. `soa_adjustments` - SOA Corrections/Adjustments
**Purpose**: Record adjustments made to SOA by admin after posting  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Adjustment ID |
| `soa_id` | BIGINT | FK (soa_postings.id) ON DELETE RESTRICT NOT NULL | SOA being adjusted |
| `assignment_id` | BIGINT | FK (assignments.id) ON DELETE RESTRICT NOT NULL | For audit trail |
| `custodian_id` | UUID | FK (profiles.id) ON DELETE RESTRICT NOT NULL | Affected custodian |
| `adjustment_type` | TEXT | NOT NULL | Type (DEBIT, CREDIT, CORRECTION) |
| `adjustment_amount` | NUMERIC(14,2) | NOT NULL | Amount adjusted |
| `reason` | TEXT | NOT NULL | Why adjustment made |
| `reference` | TEXT | nullable | Reference document/ticket |
| `created_at` | TIMESTAMP WITH TZ | Default now() NOT NULL | Adjustment time |
| `created_by` | UUID | NOT NULL | Admin making adjustment |

**Relationships**: Post-approval adjustments for SOA corrections  
**Indexes**: `idx_soa_adjustments_soa`

---

### System & Audit Tables

#### 17. `audit_logs` - Audit Trail
**Purpose**: Generic audit trail for compliance and debugging  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `id` | BIGSERIAL | PK | Log ID |
| `entity` | TEXT | nullable | Entity type (assignments, soa_postings, etc.) |
| `entity_id` | BIGINT | nullable | Entity ID |
| `action` | TEXT | nullable | Action performed (CREATE, UPDATE, DELETE) |
| `actor` | UUID | nullable | User performing action |
| `created_at` | TIMESTAMP WITH TZ | Default now() | Action timestamp |

**Relationships**: Flexible audit trail  
**Indexes**: None (consider adding for performance)

---

#### 18. `system_settings` - Configuration
**Purpose**: Store system-wide configuration settings  
**Triggers**: None  

| Column | Type | Constraints | Notes |
|--------|------|-----------|-------|
| `key` | TEXT | PK | Setting key |
| `value` | TEXT | NOT NULL | Setting value |
| `updated_at` | TIMESTAMP WITH TZ | Default now() | Last update |

**Relationships**: Reference data  
**Indexes**: Primary key only

---

### Database Views

#### 19. `v_soa_effective` - Effective SOA with Adjustments
**Purpose**: View showing final SOA position after all adjustments  
**Type**: Read-only view (no triggers)

```sql
SELECT
  s.id as soa_id,
  s.assignment_id,
  s.custodian_id,
  s.assignment_date,
  s.cash_picked,
  s.cash_loaded,
  s.cash_adjusted,
  s.excess_reported,
  s.travel_km,
  s.travel_allowance,
  COALESCE(SUM(a.adjustment_amount), 0) as total_adjustments,
  s.net_cash_position + COALESCE(SUM(a.adjustment_amount), 0) as final_net_cash_position,
  s.posted_at,
  s.source
FROM soa_postings s
LEFT JOIN soa_adjustments a ON a.soa_id = s.id
GROUP BY s.id;
```

**Key Calculations**:
- Aggregates all SOA adjustments
- Shows final position after all corrections
- Use for reconciliation and reporting

---

#### 20. `v_statement_of_accounts` - SOA Line-by-Line Ledger
**Purpose**: View for detailed SOA reporting showing every transaction  
**Type**: Read-only view (used for SOA page display)

```sql
SELECT
  l.assignment_id,
  a.assignment_date,
  l.entry_date,
  l.entry_time,
  p.full_name as custodian_name,
  l.event_type,
  l.source_table,
  l.source_id,
  s.site_code,
  s.bank_name,
  s.address,
  l.amount,
  l.direction,
  l.running_balance,
  l.remarks
FROM soa_ledger l
JOIN assignments a ON a.id = l.assignment_id
JOIN profiles p ON p.id = l.custodian_id
LEFT JOIN sites s ON s.id = l.site_id
ORDER BY l.entry_date, l.entry_time;
```

**Key Features**:
- Shows every transaction in order
- Includes custodian name and site details
- Shows running balance for reconciliation
- Use for detailed SOA page display

---

### Schema Statistics & Performance Notes

**Total Tables**: 18 core + 2 views  
**Total Indexes**: 20 indexes for optimal query performance  
**Referential Integrity**: Full foreign key constraints with appropriate cascade behaviors  
**Data Validation**: CHECK constraints on status fields, amount fields  
**Audit Trail**: Complete via soa_ledger and audit_logs  

**Key Design Patterns**:
1. **Normalization**: 3NF for data consistency
2. **Audit Trail**: Every transaction recorded in soa_ledger
3. **Cascading Deletes**: Transactions cascade when assignment deleted
4. **Cascade Restrictions**: SOA postings restrict deletion for integrity
5. **Computed Fields**: total_excess_amount is GENERATED ALWAYS STORED
6. **Geolocation**: Latitude/longitude stored as NUMERIC(9,6) for precision
7. **Amounts**: NUMERIC(14,2) for financial accuracy (no floating point)
8. **Timestamps**: TIMESTAMP WITH TIME ZONE for multi-timezone support

---

## 🔄 Key Workflows

### Daily Custodian Workflow
```
1. Login → Authenticate with email/password
2. Dashboard → View today's route & cash summary
3. Create Assignment → System creates daily assignment
4. Denomination Plan → Plan ATM distributions
5. Cash Pickup → Record bank pickup
6. ATM Operations → 
   - Replenish ATMs with cash
   - Handle excess cash
   - Make adjustments if needed
7. Technical Issues → Log any issues encountered
8. Travel Tracking → Track route & kilometers
9. EOD Summary → Review day's operations
10. Digital Signature → Sign EOD report
11. Submit → Submit for admin approval
```

### Admin Approval Workflow
```
1. Admin Dashboard → View KPIs (submissions, approvals, rejections)
2. EOD Approvals → List of pending submissions
3. EOD Detail → Review custodian's full report
4. Decisions → Approve or Reject with reason
5. Notifications → Custodian receives feedback
```

---

## 🎨 UI/UX Features

### Layout Components
- **Sticky Header**: Navigation, user info, logout
- **Responsive Sidebar**: Menu for desktop (hidden on mobile)
- **Mobile Drawer**: Slide-out menu for mobile devices
- **Offline Banner**: Shows when user is offline
- **PWA Installation**: Installable as native app

### Key UI Elements
- **Color Scheme**:
  - Primary: `#1565C0` (Blue)
  - Primary Light: `#42A5F5`
  - Accent: `#FFC107` (Amber)
  
- **Components**:
  - Form inputs with validation
  - Data tables (responsive design)
  - Progress bars for completion tracking
  - Status badges (open, submitted, approved, rejected)
  - Summary boxes (KPI cards)
  - Modals (full-screen signature canvas)

### Print Support
- Print-only CSS classes for generating PDFs
- Signature section for printed reports
- Bank logo and header

---

## 🔐 Authentication & Security

### Auth Flow
1. **Supabase Auth**: Email/password authentication
2. **Session Management**: Auto-refresh on page load
3. **Profile Loading**: Fetch user role from `profiles` table
4. **Route Guards**: 
   - `PrivateRoute`: Requires authentication
   - `RequireAdmin`: Requires admin/supervisor role

### Protected Routes
- Custodian pages: Protected by `PrivateRoute`
- Admin pages: Protected by `RequireAdmin`
- Public pages: Only `/login`

---

## 📊 Key Features & Modules

### 1. **Cash Management**
- Denomination-wise tracking (₹100, ₹200, ₹500, ₹2000)
- Picked vs. Loaded vs. In-Hand calculation
- Cash variance detection
- Planned vs. Actual loading

### 2. **ATM Operations**
- Multi-site route management
- Replenishment tracking per ATM
- Excess cash handling
- Manual adjustments with reasons

### 3. **End of Day (EOD)**
- Digital signature capture (full-screen canvas)
- Status tracking (open → submitted → approved/rejected)
- Rejection with feedback
- Read-only view after signing
- Locked state prevents modifications

### 4. **Route Management**
- Site sequencing
- Distance tracking (KM)
- Travel time logging
- Route completion percentage

### 5. **Reporting**
- Dashboard KPIs
- CSV export functionality
- PDF print reports
- Statement of Accounts (SOA)

### 6. **Technical Issues**
- Issue logging with status tracking
- Issue categorization
- Resolution workflows

---

## 🔧 Development Setup

### Prerequisites
- Node.js 16+ and npm/yarn
- Supabase account with project
- Environment variables configured

### Installation
```bash
# Install dependencies
npm install

# Create .env.local with Supabase credentials
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key

# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

---

## 📱 PWA Features

### Service Worker
- Offline support via Vite PWA plugin
- Auto-updates enabled
- Installation prompt on mobile

### Manifest
```json
{
  "name": "Sruthi CRA Ops",
  "short_name": "CRA Ops",
  "description": "Cash Replenishment & Field Operations",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0f172a",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192" },
    { "src": "/icons/icon-512.png", "sizes": "512x512" }
  ]
}
```

---

## 🐛 Known Issues & Fixes Applied

### Issue #1: Admin Dashboard Infinite Loading ✅ FIXED
**Problem**: When admin logs in, the page kept loading indefinitely instead of showing the dashboard.

**Root Cause**: 
- Login redirected all users to `/` (custodian Dashboard)
- Dashboard queried custodian-specific data
- Admin's queries failed silently

**Solution Applied**:
- Modified Login.tsx to redirect based on role
- Added role check in Dashboard.tsx with access denied message
- Optimized AdminDashboard queries to use count flags

### Issue #2: EOD Summary Form Errors ✅ FIXED
**Problem**: JSX code outside return statements, duplicate functions, missing state variables

**Root Cause**: 
- Incorrect code structure with floating JSX
- Duplicate `submitSignature` function definitions
- Missing state variables in component

**Solution Applied**:
- Fixed JSX placement in return statements
- Removed duplicate functions
- Added missing state variables
- Implemented read-only signature display after signing

### Issue #3: Signature Not Persisting ✅ FIXED
**Problem**: After signing EOD, the page didn't show the locked state properly

**Root Cause**: 
- Component state not updating after database save
- No callback mechanism to refresh parent state

**Solution Applied**:
- Added `onSignatureComplete` callback
- Updated parent assignment state after successful signature
- Added read-only signature display with timestamp

---

## 🚀 Recent Enhancements

### EOD Summary Improvements (v1.1)
1. **Digital Signature Capture**
   - Full-screen modal for signing
   - Preview canvas
   - Clear button for retries

2. **Read-Only After Signing**
   - All fields become disabled
   - Signature visible in read-only mode
   - Timestamp of signing shown
   - Submit button hidden
   - Visual locked indicator

3. **Admin Workflow**
   - Review signed EODs
   - Approve or reject with reasons
   - Send feedback to custodian

### Admin Dashboard
1. **Improved Query Performance**
   - Using count flags instead of fetching all rows
   - Parallel queries with Promise.all
   - Error handling with try-catch

2. **Role-Based Redirect**
   - Immediate navigation to `/admin` for admins
   - Prevents dashboard loading issues

---

## 📈 Future Enhancements

### Phase 2 (Planned)
1. **Analytics & Reporting**
   - Daily/weekly/monthly reports
   - Cash variance analysis
   - Custodian performance metrics
   - ATM utilization rates

2. **Geolocation Features**
   - Real-time GPS tracking
   - Route optimization
   - Geofencing alerts
   - Map-based route visualization

3. **Notifications**
   - Push notifications (PWA)
   - SMS alerts for critical issues
   - Email summaries
   - In-app notifications

4. **Advanced Approvals**
   - Multi-level approvals
   - Escalation workflows
   - Batch approvals
   - Approval audit trail

5. **Mobile Enhancements**
   - Biometric authentication
   - Camera integration (ID/ATM photos)
   - Barcode scanning
   - Offline form caching

6. **Inventory Management**
   - Opening balance tracking
   - Closing balance validation
   - Denomination reorder levels
   - Stock alerts

7. **Audit & Compliance**
   - Complete audit trail
   - Digital signatures with timestamps
   - Compliance reports
   - RBI regulatory support

8. **Integration**
   - Bank core systems integration
   - ATM management systems
   - Email/SMS gateways
   - Payment gateway APIs

### Phase 3 (Long-term)
1. Machine learning for:
   - Cash demand forecasting
   - Anomaly detection
   - Route optimization
   - Custodian performance prediction

2. Advanced security:
   - Two-factor authentication
   - Role-based access control (RBAC) enhancements
   - Encryption for sensitive data
   - Session management improvements

---

## 📚 API Documentation

### Authentication Endpoints
- `POST /auth/sign-in` - Email/password login
- `POST /auth/sign-out` - Logout
- `GET /auth/session` - Get current session

### Assignment Endpoints
- `GET /assignments?custodian_id=X&date=Y` - Get assignments
- `POST /assignments` - Create assignment
- `PATCH /assignments/:id` - Update assignment status
- `POST /assignments/:id/sign` - Digital signature

### Data Endpoints
- `GET /denomination-plans` - List plans
- `POST /denomination-plans` - Create plan
- `GET /cash-pickups` - List pickups
- `POST /cash-pickups` - Record pickup
- `GET /atm-replenishments` - List replenishments
- `POST /atm-replenishments` - Record replenishment

---

## 🧪 Testing Checklist

### Custodian Tests
- [ ] Login with custodian credentials
- [ ] View dashboard with correct cash calculations
- [ ] Create denomination plan
- [ ] Record cash pickup
- [ ] Load ATMs with cash
- [ ] Handle excess cash
- [ ] Make adjustments
- [ ] Report technical issues
- [ ] Track travel KM
- [ ] Submit EOD with signature
- [ ] View read-only signed EOD

### Admin Tests
- [ ] Login with admin credentials
- [ ] View admin dashboard KPIs
- [ ] Review pending EOD approvals
- [ ] Approve EOD submission
- [ ] Reject EOD with reason
- [ ] Assign routes to custodians
- [ ] Adjust statement of accounts
- [ ] Print/export reports

### Security Tests
- [ ] Non-authenticated user redirected to login
- [ ] Admin can't access custodian pages
- [ ] Custodian can't access admin pages
- [ ] Session persists on page refresh
- [ ] Logout clears session
- [ ] Offline mode works

### Performance Tests
- [ ] Dashboard loads in < 2 seconds
- [ ] Large data sets handled efficiently
- [ ] PWA installs successfully
- [ ] Offline operations work smoothly

---

## 📞 Support & Troubleshooting

### Common Issues

**Q: Admin page keeps loading**
A: Check that the `profile.role` is set correctly in Supabase. Verify the query in AdminDashboard returns data.

**Q: Signature not saving**
A: Ensure Supabase storage bucket "eod-signatures" exists and has public access. Check file upload permissions.

**Q: Dashboard shows "No assignment for today"**
A: Create an assignment in the database for today's date with status='open' and custodian_id matching the user.

**Q: Offline mode not working**
A: Clear browser cache, reinstall PWA, check service worker registration in DevTools.

---

## 📄 License & Credits

**Project**: Sruthi CRA Ops
**Version**: 1.1.0
**Last Updated**: January 2026
**Status**: Production Ready

---

## 🔄 Version History

### v1.1.0 (January 2026)
- Fixed admin dashboard loading issue
- Implemented read-only EOD signature display
- Optimized database queries for admin dashboard
- Added role-based login redirects

### v1.0.0 (December 2025)
- Initial release with all core features
- Custodian operations module
- Admin approval workflow
- PWA support

---

## 📞 Contact & Support

For bugs, feature requests, or questions:
1. Check this documentation first
2. Review the troubleshooting section
3. Contact the development team
4. Create an issue in the project repository

---

**Last Updated**: January 25, 2026  
**Maintained By**: Development Team  
**Status**: ✅ Production Ready
