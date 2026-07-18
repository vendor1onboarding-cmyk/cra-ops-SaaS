# CRA OPS Database Object Inventory

Analysis date: 2026-07-18

## Scope

This inventory was built by inspecting:

- `src/`
- `supabase/`
- SQL migrations and standalone SQL files
- Supabase storage usage
- React API and RPC calls

The report focuses on the objects needed for a fresh vendor installation.
Where multiple SQL files define the same object, the latest or most complete
definition is noted.

## 1. Tables

The project owns the following public tables. Column lists below are the union
of the base schema and later migration additions.

| Table | Columns | Primary key | Foreign keys | Defaults / notes | Source |
|---|---|---|---|---|---|
| `assignments` | `id`, `assignment_date`, `custodian_id`, `title`, `status`, `created_at`, `approved_at`, `approved_by`, `rejected_at`, `rejected_by`, `rejection_reason`, `eod_signed`, `eod_signed_at`, `eod_signature_url` | `id` | `custodian_id -> auth.users(id)` | `id` uses `nextval`, `status` defaults `open`, `created_at` defaults `now()`, `eod_signed` defaults `false` | `Public_Table_DDL.sql:4` |
| `atm_cash_adjustments` | `id`, `assignment_id`, `site_id`, `adjustment_type`, `denom_100`, `denom_200`, `denom_500`, `denom_2000`, `reason`, `created_at`, `created_by`, `geo_lat`, `geo_lng`, `distance_meters`, `photo_url` | `id` | `assignment_id -> assignments(id)`, `site_id -> sites(id)`, `created_by -> auth.users(id)` | `adjustment_type` defaults `withdrawal`, denomination columns default `0`, `created_at` defaults `now()` | `Public_Table_DDL.sql:22` |
| `atm_excess_cash` | `id`, `assignment_id`, `site_id`, `detected_date`, `denom_100`, `denom_200`, `denom_500`, `denom_2000`, `total_excess_amount`, `atm_receipt_url`, `reported_to_vendor`, `vendor_ticket_no`, `bank_notified`, `bank_reference_no`, `remarks`, `created_at`, `gps_status`, `gps_lat`, `gps_lng`, `gps_distance_meters`, `gps_photo_url`, `gps_verified_at`, `excess_date`, `recon_communication_date` | `id` | `assignment_id -> assignments(id)`, `site_id -> sites(id)` | `detected_date` defaults `CURRENT_DATE`, `reported_to_vendor` defaults `false`, `bank_notified` defaults `false`, `created_at` defaults `now()` | `Public_Table_DDL.sql:43`, `ATM_EXCESS_CASH_SCHEMA_UPDATE.sql:1` |
| `atm_removal_plans` | `id`, `assignment_id`, `denom_2000`, `denom_500`, `denom_200`, `denom_100`, `denom_50`, `denom_20`, `denom_10`, `remarks`, `has_source_report`, `created_at`, `updated_at` | `id` | `assignment_id -> assignments(id)` | `id` defaults `gen_random_uuid()`, `has_source_report` defaults `true`, `created_at` / `updated_at` default `now()`, `assignment_id` is unique | `Public_Table_DDL.sql:72`, `ATM_REMOVAL_PLANS_MIGRATION.sql:1` |
| `atm_replenishments` | `id`, `assignment_id`, `site_id`, `time_in`, `time_out`, `denom_2000`, `denom_500`, `denom_200`, `denom_100`, `denom_50`, `denom_20`, `denom_10`, `closing_balance`, `remarks`, `receipt_url`, `created_at`, `load_lat`, `load_lng`, `distance_meters`, `geo_status`, `photo_required`, `photo_url`, `source_breakdown` | `id` | `assignment_id -> assignments(id)`, `site_id -> sites(id)` | `geo_status` defaults `unknown`, `photo_required` defaults `false`, `created_at` defaults `now()` | `Public_Table_DDL.sql:89`, `UNIFIED_ATM_LOADING_MIGRATION.sql:1` |
| `audit_logs` | `id`, `entity`, `entity_id`, `action`, `actor`, `created_at` | `id` | none | `id` defaults `nextval`, `created_at` defaults `now()` | `Public_Table_DDL.sql:117` |
| `bank_accounts` | `id`, `bank_name`, `account_number`, `ifsc_code`, `branch_code`, `branch_name`, `branch_phone`, `branch_email`, `branch_address`, `is_active`, `created_by`, `created_at`, `updated_at`, `latitude`, `longitude` | `id` | `created_by -> profiles(id)` | `id` defaults `gen_random_uuid()`, `is_active` defaults `true`, `created_at` / `updated_at` default `now()` | `Public_Table_DDL.sql:126`, `BANK_ACCOUNTS_MIGRATION.sql:1` |
| `bank_denomination_plans` | `id`, `assignment_id`, `bank_account_id`, `denom_2000`, `denom_500`, `denom_200`, `denom_100`, `denom_50`, `denom_20`, `denom_10`, `remarks`, `has_source_report`, `created_at` | `id` | `assignment_id -> assignments(id)`, `bank_account_id -> bank_accounts(id)` | `id` defaults `nextval`, `has_source_report` defaults `true`, `created_at` defaults `now()` | `Public_Table_DDL.sql:145`, `migrations/BANK_DENOMINATION_PLANS.sql:1` |
| `banks` | `id`, `name`, `branch`, `short_code`, `is_active`, `created_at` | `id` | none | `id` defaults `nextval`, `is_active` defaults `true`, `created_at` defaults `now()` | `Public_Table_DDL.sql:163` |
| `cash_pickups` | `id`, `assignment_id`, `bank_name`, `branch`, `bank_account_id`, `pickup_time`, `denom_2000`, `denom_500`, `denom_200`, `denom_100`, `denom_50`, `denom_20`, `denom_10`, `expected_amount`, `total_amount`, `variance`, `slip_url`, `created_at`, `internal_source_metadata`, `pickup_source`, `source_site_id`, `gps_metadata`, `gps_photo_url`, `cheque_number`, `cheque_image_url`, `cheque_verified`, `cheque_verified_by`, `cheque_verified_at`, `cheque_status`, `cheque_metadata` | `id` | `assignment_id -> assignments(id)`, `source_site_id -> sites(id)`, `bank_account_id -> bank_accounts(id) ON DELETE SET NULL` | `pickup_time` defaults `now()`, `pickup_source` defaults `BANK`, `cheque_verified` defaults `false`, `cheque_status` defaults `PENDING`, `created_at` defaults `now()`, unique `(assignment_id, bank_account_id)` | `Public_Table_DDL.sql:172`, `UNIFIED_ATM_LOADING_MIGRATION.sql:1`, `ADD_BANK_ACCOUNT_ID_TO_CASH_PICKUPS.sql:1`, `CHEQUE_CAPTURE_MIGRATION.sql:1` |
| `cheque_audit_log` | `id`, `pickup_id`, `old_status`, `new_status`, `old_verified_by`, `new_verified_by`, `change_reason`, `metadata`, `updated_by`, `updated_at` | `id` | `pickup_id -> cash_pickups(id)` | `old_status` defaults `PENDING`, `updated_at` defaults `now()` | `Public_Table_DDL.sql:209`, `CHEQUE_CAPTURE_MIGRATION.sql:1` |
| `denomination_plans` | `id`, `assignment_id`, `site_id`, `has_source_report`, `remarks`, `denom_2000`, `denom_500`, `denom_200`, `denom_100`, `denom_50`, `denom_20`, `denom_10`, `created_at` | `id` | `assignment_id -> assignments(id)`, `site_id -> sites(id)` | `has_source_report` defaults `true`, denomination counts default `0`, `created_at` defaults `now()` | `Public_Table_DDL.sql:223` |
| `profiles` | `id`, `full_name`, `role`, `created_at`, `first_login`, `email`, `mobile_number`, `deleted_at`, `deleted_by`, `deletion_reason` | `id` | `id -> auth.users(id)` | `role` defaults `custodian`, `created_at` defaults `now()`, `first_login` defaults `true` | `Public_Table_DDL.sql:241`, `USER_MANAGEMENT_SUPABASE_MIGRATION.sql:1`, `USER_MANAGEMENT_MOBILE_SUPPORT_MIGRATION.sql:1` |
| `route_sites` | `id`, `assignment_id`, `site_id`, `sequence_no`, `created_at` | `id` | `assignment_id -> assignments(id)`, `site_id -> sites(id)` | `id` defaults `nextval`, `created_at` defaults `now()` | `Public_Table_DDL.sql:255` |
| `sites` | `id`, `site_code`, `atm_id`, `bank_name`, `address`, `city`, `created_at`, `latitude`, `longitude` | `id` | none | `id` defaults `nextval`, `site_code` is unique, `created_at` defaults `now()` | `Public_Table_DDL.sql:265` |
| `soa_adjustments` | `id`, `soa_id`, `assignment_id`, `custodian_id`, `adjustment_type`, `adjustment_amount`, `reason`, `reference`, `created_at`, `created_by`, `exchange_metadata`, `transfer_metadata`, `requires_custodian_confirmation`, `custodian_confirmed`, `custodian_confirmed_at`, `custodian_signature_url`, `original_reference_snapshot` | `id` | `assignment_id -> assignments(id)`, `soa_id -> assignments(id)`, `custodian_id -> auth.users(id)` | `adjustment_type` checks `CREDIT`, `DEBIT`, `EXCHANGE`, `INTER_SITE_TRANSFER`; `requires_custodian_confirmation` defaults `true`; `custodian_confirmed` defaults `false`; `created_at` defaults `now()` | `Public_Table_DDL.sql:277`, `migrations/SOA_V2_MIGRATION.sql:1`, `migrations/ADMIN_ADJUSTMENT_CONFIRMATION.sql:1` |
| `soa_ledger` | `id`, `assignment_id`, `custodian_id`, `entry_date`, `entry_time`, `source_table`, `source_id`, `event_type`, `site_id`, `amount`, `direction`, `running_balance`, `remarks`, `created_at` | `id` | `assignment_id -> assignments(id)`, `custodian_id -> auth.users(id)`, `site_id -> sites(id)` | `entry_time` defaults `now()`, `direction` checks `DEBIT` / `CREDIT`, `created_at` defaults `now()` | `Public_Table_DDL.sql:300` |
| `soa_postings` | `id`, `assignment_id`, `custodian_id`, `assignment_date`, `cash_picked`, `cash_loaded`, `cash_adjusted`, `excess_reported`, `travel_km`, `travel_allowance`, `net_cash_position`, `eod_signed`, `eod_signed_at`, `eod_signature_url`, `posted_at`, `posted_by`, `source` | `id` | `assignment_id -> assignments(id)`, `custodian_id -> auth.users(id)` | numeric totals default `0`, `eod_signed` defaults `false`, `posted_at` defaults `now()`, `source` defaults `eod_approval` | `Public_Table_DDL.sql:320` |
| `system_settings` | `key`, `value`, `updated_at` | `key` | none | `updated_at` defaults `now()` | `Public_Table_DDL.sql:342` |
| `technical_issues` | `id`, `assignment_id`, `site_id`, `issue_type`, `error_code`, `description`, `status`, `photo_url`, `created_at`, `resolved_at` | `id` | `assignment_id -> assignments(id)`, `site_id -> sites(id)` | `status` defaults `new`, `created_at` defaults `now()` | `Public_Table_DDL.sql:348` |
| `travel_logs` | `id`, `assignment_id`, `site_id`, `custodian_id`, `start_time`, `end_time`, `odometer_start`, `odometer_end`, `km_covered`, `gps_start_lat`, `gps_start_lng`, `gps_end_lat`, `gps_end_lng`, `status`, `created_at`, `vehicle_type`, `source`, `allowance_amount`, `updated_at`, `rate_per_km` | `id` | `assignment_id -> assignments(id)`, `site_id -> sites(id)`, `custodian_id -> auth.users(id)` | `status` defaults `in_progress`, `created_at` defaults `now()`, `updated_at` defaults `now()`, `source` checks `gps` / `odometer` | `Public_Table_DDL.sql:363` |
| `vehicle_rates` | `vehicle_type`, `rate_per_km`, `active` | `vehicle_type` | none | `active` defaults `true` | `Public_Table_DDL.sql:389` |

Notes:

- `atm_excess_cash.total_excess_amount` is an expression default, not a generated
  column.
- `profiles`, `cash_pickups`, `soa_adjustments`, and `travel_logs` are the main
  tables whose column sets were expanded by later migrations.
- `banks` and `audit_logs` exist in the base schema but are lightly used by the
  current app.

## 2. Primary Keys

Primary keys are listed in the table inventory above. In summary:

- bigint identity/sequence keys are used for most operational tables
- `bank_accounts.id` and `atm_removal_plans.id` are UUID keys
- `profiles.id` mirrors `auth.users.id`
- `vehicle_rates.vehicle_type` is the natural primary key
- `system_settings.key` is the natural primary key

## 3. Foreign Keys

Key foreign key relationships used by the app:

- `assignments.custodian_id -> auth.users.id`
- `atm_cash_adjustments.assignment_id -> assignments.id`
- `atm_cash_adjustments.site_id -> sites.id`
- `atm_cash_adjustments.created_by -> auth.users.id`
- `atm_excess_cash.assignment_id -> assignments.id`
- `atm_excess_cash.site_id -> sites.id`
- `atm_removal_plans.assignment_id -> assignments.id`
- `atm_replenishments.assignment_id -> assignments.id`
- `atm_replenishments.site_id -> sites.id`
- `bank_accounts.created_by -> profiles.id`
- `bank_denomination_plans.assignment_id -> assignments.id`
- `bank_denomination_plans.bank_account_id -> bank_accounts.id`
- `cash_pickups.assignment_id -> assignments.id`
- `cash_pickups.source_site_id -> sites.id`
- `cash_pickups.bank_account_id -> bank_accounts.id`
- `cheque_audit_log.pickup_id -> cash_pickups.id`
- `denomination_plans.assignment_id -> assignments.id`
- `denomination_plans.site_id -> sites.id`
- `profiles.id -> auth.users.id`
- `route_sites.assignment_id -> assignments.id`
- `route_sites.site_id -> sites.id`
- `soa_adjustments.assignment_id -> assignments.id`
- `soa_adjustments.soa_id -> assignments.id`
- `soa_adjustments.custodian_id -> auth.users.id`
- `soa_ledger.assignment_id -> assignments.id`
- `soa_ledger.custodian_id -> auth.users.id`
- `soa_ledger.site_id -> sites.id`
- `soa_postings.assignment_id -> assignments.id`
- `soa_postings.custodian_id -> auth.users.id`
- `technical_issues.assignment_id -> assignments.id`
- `technical_issues.site_id -> sites.id`
- `travel_logs.assignment_id -> assignments.id`
- `travel_logs.site_id -> sites.id`
- `travel_logs.custodian_id -> auth.users.id`

## 4. Indexes

### Canonical and required indexes

- `assignments_unique_custodian_date` on `(custodian_id, assignment_date)`
- `bank_accounts_bank_name_idx`
- `bank_accounts_account_number_idx`
- `bank_accounts_is_active_idx`
- `bank_accounts_created_by_idx`
- `bank_accounts_created_at_idx`
- `bank_denomination_plans_unique` on `(assignment_id, bank_account_id)`
- `cash_pickups_bank_account_id_idx`
- `cash_pickups_assignment_bank_unique` on `(assignment_id, bank_account_id)`
- `idx_cash_pickups_pickup_source`
- `idx_cash_pickups_source_site_id`
- `idx_cash_pickups_internal_source`
- `idx_atm_replenishments_source_breakdown`
- `idx_cheque_audit_pickup`
- `idx_cheque_audit_status`
- `idx_cheque_audit_updated`
- `idx_profiles_mobile_number_unique`
- `idx_profiles_mobile_number`
- `idx_profiles_first_login`
- `idx_profiles_email`
- `idx_soa_adjustments_type`
- `idx_soa_adjustments_exchange_metadata`
- `idx_soa_adjustments_transfer_metadata`
- `idx_soa_adjustments_assignment_type`
- `uniq_active_travel_log` partial unique index on `travel_logs(custodian_id, assignment_id)` where `status = 'in_progress'`

### Notes

- `atm_removal_plans.assignment_id` is also unique at the table/constraint level.
- `sites.site_code` is unique at the table/constraint level.

## 5. Views

### Core operational views

| View | Purpose | Source |
|---|---|---|
| `v_atm_load_sources` | Separates bank-sourced and internal ATM load amounts | `v_atm_load_sources.sql:1`, `migrations/UNIFIED_ATM_LOADING_MIGRATION.sql:130` |
| `v_soa_effective` | SOA summary used by the app and reporting | `v_soa_effective.sql:1`, `migrations/SOA_V2_MIGRATION.sql:236`, `FIX_SOA_NEGATIVE_CASH_MIGRATION.sql:23` |
| `v_soa_detailed` | Detailed SOA breakdown with transfers/exchanges/adjustments | `v_soa_detailed.sql:1`, `migrations/SOA_V2_MIGRATION.sql:133`, `FIX_SOA_NEGATIVE_CASH_MIGRATION.sql:214` |
| `v_statement_of_accounts` | Ledger-style SOA report view | `v_statement_of_accounts.sql:1` |
| `v_cheque_verifications` | Cheque verification audit/reporting | `CHEQUE_CAPTURE_MIGRATION.sql:85` |

### Analytics views

| View | Purpose | Source |
|---|---|---|
| `v_bank_pickup_trends` | Pickup volume and variance by bank/branch/time | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:12` |
| `v_atm_load_utilization` | Load counts and total loaded per ATM site | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:40` |
| `v_internal_transfer_efficiency` | Bank vs internal pickup efficiency | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:75` |
| `v_cash_recycling_rate` | ATM cash recycling efficiency | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:103` |
| `v_cash_variance_analytics` | Variance detection across pickups | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:139` |
| `v_atm_load_frequency` | Load frequency by site and period | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:168` |
| `v_cash_flow_intelligence` | Comprehensive cash flow metrics | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:189` |
| `v_atm_performance_score` | Per-ATM performance score | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:229` |
| `v_rolling_pickup_trends` | Rolling pickup averages for forecasting | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:284` |
| `v_cash_risk_indicators` | Risk flags derived from analytics views | `ADVANCED_ANALYTICS_VIEWS_MIGRATION.sql:322` |

### Notes

- `v_soa_effective` and `v_soa_detailed` have multiple versions in the repo.
  For a fresh install, use the corrected logic from the latest migration chain
  rather than the earliest simplified version.
- The analytics views are read-only and safe for shared multi-vendor installs.

## 6. Trigger Functions

| Function | Type | Source |
|---|---|---|
| `update_timestamp()` | trigger function | `BANK_ACCOUNTS_MIGRATION.sql:118` |
| `log_cheque_status_change()` | trigger function | `CHEQUE_CAPTURE_MIGRATION.sql:49` |

## 7. Triggers

| Trigger | Table | Timing | Function | Source |
|---|---|---|---|---|
| `update_bank_accounts_timestamp` | `bank_accounts` | `BEFORE UPDATE` | `update_timestamp()` | `BANK_ACCOUNTS_MIGRATION.sql:129` |
| `trigger_log_cheque_status_change` | `cash_pickups` | `AFTER UPDATE` | `log_cheque_status_change()` | `CHEQUE_CAPTURE_MIGRATION.sql:80` |

## 8. Stored Procedures

No `CREATE PROCEDURE` objects were found.

## 9. RPC Functions

| RPC / callable function | Purpose | Source |
|---|---|---|
| `approve_eod_assignment(bigint, uuid)` | Safe approval path used by admin EOD flow | `FIX_EOD_APPROVAL_TRIGGER.sql:42`, called from `src/pages/AdminEODDetail.tsx:971-973` |
| `calculate_closing_balance(UUID)` | Helper calculation for closing balance | `migrations/SOA_V2_MIGRATION.sql:329` |

## 10. Storage Buckets

| Bucket | Where referenced | Purpose |
|---|---|---|
| `issue-photos` | `src/pages/ATMExcessCash.tsx:162,251,264`, `src/pages/ATMReplenishment.tsx:962`, `src/pages/CashPickup.tsx:613,627`, `src/pages/InterSiteTransfer.tsx:380`, `src/pages/TechnicalIssues.tsx:121,131`, `src/pages/admin/AdminChequeVerification.tsx:384` | Photo evidence and cheque/issue attachments |
| `eod-signatures` | `src/components/SignatureImage.tsx:73,212`, `src/pages/EODSummary.tsx:1776,1782`, `src/pages/CustodianAdjustmentConfirm.tsx:195,201` | EOD signatures and confirmation signatures |

## 11. RLS Policies

| Table | Policy | Effect |
|---|---|---|
| `bank_accounts` | `bank_accounts_admin_view_all` | Admin/supervisor can view all bank accounts |
| `bank_accounts` | `bank_accounts_user_view_active` | Authenticated users can view active bank accounts |
| `bank_accounts` | `bank_accounts_admin_insert` | Admin/supervisor can insert |
| `bank_accounts` | `bank_accounts_admin_update` | Admin/supervisor can update |
| `bank_accounts` | `bank_accounts_admin_delete` | Admin/supervisor can delete |
| `atm_removal_plans` | `Custodian can manage own atm_removal_plans` | Custodian can manage own rows |
| `atm_removal_plans` | `Admin/Supervisor can view atm_removal_plans` | Admin/supervisor can view all rows |

### RLS notes

- `bank_accounts` explicitly enables RLS.
- `atm_removal_plans` explicitly enables RLS.
- Other tables rely on the repo's broader Supabase setup and/or implicit
  authorization checks in the app layer; no additional policy definitions were
  found in the workspace.

## 12. Auth Dependencies

Required Supabase auth/runtime dependencies:

- `auth.users` is the root identity table for `profiles`, `assignments`,
  `soa_adjustments`, `soa_ledger`, `soa_postings`, and `travel_logs`
- `auth.uid()` is used in RLS and trigger logic
- `supabaseAdmin.auth.getUser(token)` is used by edge functions
- `supabaseAdmin.auth.admin.createUser()`, `updateUserById()`, and
  `deleteUser()` are used by user-management edge functions
- `profiles.role` is the application RBAC source of truth
- `profiles.first_login` drives forced password reset flows

## 13. Seed Data

No mandatory seed data rows were found.

Optional or example seed material exists in comments:

- `BANK_ACCOUNTS_MIGRATION.sql:140` contains sample bank accounts and contacts
- Some docs mention example users, emails, and phone numbers for onboarding and
  QA, but those are not mandatory production seed rows

## 14. Enum Types

No custom `CREATE TYPE ... AS ENUM` objects were found in the workspace.

Instead, the schema uses:

- `CHECK` constraints for `profiles.role`
- `CHECK` constraints for `assignments.status`
- `CHECK` constraints for `cash_pickups.pickup_source`
- `CHECK` constraints for `cash_pickups.cheque_status`
- `CHECK` constraints for `soa_adjustments.adjustment_type`
- `CHECK` constraints for `technical_issues.status`
- `CHECK` constraints for `travel_logs.source`

Supabase auth internals expose some `USER-DEFINED` types in `Public_Table_DDL.sql`,
but those are managed by Supabase auth and are not app-defined enum types.

## 15. Extensions Required

| Extension | Why it is needed | Evidence |
|---|---|---|
| `pgcrypto` | `gen_random_uuid()` is used by `atm_removal_plans` and `bank_accounts` | `Public_Table_DDL.sql:73`, `Public_Table_DDL.sql:127`, `BANK_ACCOUNTS_MIGRATION.sql:14` |

No explicit `CREATE EXTENSION` statements were found in the workspace.

## 16. Default Values

Common defaults that matter for a fresh install:

- `assignments.status = 'open'`
- `assignments.created_at = now()`
- `assignments.eod_signed = false`
- `atm_cash_adjustments.adjustment_type = 'withdrawal'`
- `atm_cash_adjustments.denom_* = 0`
- `atm_excess_cash.detected_date = CURRENT_DATE`
- `atm_excess_cash.reported_to_vendor = false`
- `atm_excess_cash.bank_notified = false`
- `atm_removal_plans.has_source_report = true`
- `atm_removal_plans.created_at / updated_at = now()`
- `atm_replenishments.geo_status = 'unknown'`
- `atm_replenishments.photo_required = false`
- `bank_accounts.is_active = true`
- `bank_accounts.created_at / updated_at = now()`
- `bank_denomination_plans.has_source_report = true`
- `cash_pickups.pickup_time = now()`
- `cash_pickups.pickup_source = 'BANK'`
- `cash_pickups.cheque_verified = false`
- `cash_pickups.cheque_status = 'PENDING'`
- `cheque_audit_log.old_status = 'PENDING'`
- `denomination_plans.has_source_report = true`
- `profiles.role = 'custodian'`
- `profiles.created_at = now()`
- `profiles.first_login = true`
- `soa_adjustments.requires_custodian_confirmation = true`
- `soa_adjustments.custodian_confirmed = false`
- `soa_adjustments.created_at = now()`
- `soa_postings.cash_picked / cash_loaded / cash_adjusted / excess_reported / travel_km / travel_allowance = 0`
- `soa_postings.eod_signed = false`
- `soa_postings.posted_at = now()`
- `soa_postings.source = 'eod_approval'`
- `system_settings.updated_at = now()`
- `technical_issues.status = 'new'`
- `travel_logs.status = 'in_progress'`
- `travel_logs.created_at / updated_at = now()`
- `vehicle_rates.active = true`

## 17. Generated Columns

No `GENERATED ALWAYS AS` or `GENERATED BY DEFAULT` columns were found.

The main computed monetary fields are implemented in views and query logic
rather than as generated table columns.

## 18. Fresh Install Notes

If you are building a vendor bootstrap kit, the minimum install order should be:

1. Base tables and constraints
2. Required indexes
3. RLS policies
4. Trigger functions and triggers
5. Views
6. RPC/helper functions
7. Storage buckets
8. Seed rows, if any

For this repository, the highest-risk install items are:

- `profiles` and `auth.users` dependency
- `bank_accounts` RLS and permissions
- `cash_pickups` / `atm_replenishments` source attribution logic
- `v_soa_effective` / `v_soa_detailed` consistency
- `eod-signatures` and `issue-photos` storage buckets
- the `approve_eod_assignment` RPC path used by admin approval flow

