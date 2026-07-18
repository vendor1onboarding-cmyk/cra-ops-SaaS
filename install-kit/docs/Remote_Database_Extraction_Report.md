# Remote Database Extraction Report

## Scope

This report captures the verified database extraction for the CRA OPS linked Supabase project.

- Project ref: `ejszqwmmpspvhtuhodsa`
- Export artifact: `install-kit/database/remote_schema_dump.sql`
- Exported schema: `public`
- Export method: direct `pg_dump` against the linked Supabase pooler, with role elevation to `postgres`

The `auth` and `storage` schemas are Supabase-managed. They are part of the platform, but they are not exported in this dump because the linked role does not have direct object-level dump access to those schemas in this environment.

## What Was Extracted

The remote `public` schema export contains the application-owned database objects required for a fresh vendor clone:

- 22 tables
- 16 views
- 15 functions
- 7 triggers
- 35 RLS policies
- 41 explicit indexes
- 27 constraints
- 17 sequences

## Core Tables

- `assignments`
- `atm_cash_adjustments`
- `atm_excess_cash`
- `atm_removal_plans`
- `atm_replenishments`
- `audit_logs`
- `bank_accounts`
- `bank_denomination_plans`
- `banks`
- `cash_pickups`
- `cheque_audit_log`
- `denomination_plans`
- `profiles`
- `route_sites`
- `sites`
- `soa_adjustments`
- `soa_ledger`
- `soa_postings`
- `system_settings`
- `technical_issues`
- `travel_logs`
- `vehicle_rates`

## Views

The dump includes the operational and analytics views used by the product:

- `v_atm_load_sources`
- `v_soa_effective`
- `v_soa_detailed`
- `v_statement_of_accounts`
- `v_cheque_verifications`
- `v_bank_pickup_trends`
- `v_atm_load_utilization`
- `v_internal_transfer_efficiency`
- `v_cash_recycling_rate`
- `v_cash_variance_analytics`
- `v_atm_load_frequency`
- `v_cash_flow_intelligence`
- `v_atm_performance_score`
- `v_rolling_pickup_trends`
- `v_cash_risk_indicators`
- `v_soa_kpi_safe`

## Functions

The export includes the stored procedures and trigger functions required by the app:

- `approve_eod_assignment(bigint, uuid)`
- `auto_assign_route_by_district(bigint, text)`
- `calculate_closing_balance(uuid)`
- `calculate_daily_allowance(date)`
- `create_daily_assignments()`
- `get_profile_names(uuid[])`
- `log_cheque_status_change()`
- `post_soa_entry(bigint, text, bigint, text, bigint, numeric, text, text)`
- `post_soa_on_approval()`
- `trg_atm_cash_adjustments_soa()`
- `trg_atm_excess_cash_soa()`
- `trg_atm_replenishments_soa()`
- `trg_soa_adjustment_ledger()`
- `trg_travel_logs_soa()`
- `update_timestamp()`

## Triggers

- `after_atm_cash_adjustments_insert`
- `after_atm_excess_cash_insert`
- `after_atm_replenishments_insert`
- `update_bank_accounts_timestamp`
- `trigger_log_cheque_status_change`
- `after_soa_adjustment_insert`
- `after_travel_logs_update`

## Policies And Access Model

The remote export confirms row-level security is enabled on the operational tables, including:

- `assignments`
- `atm_removal_plans`
- `atm_replenishments`
- `bank_accounts`
- `banks`
- `cash_pickups`
- `denomination_plans`
- `profiles`
- `route_sites`
- `sites`
- `technical_issues`
- `travel_logs`

The policy set covers admin, supervisor, custodian, and authenticated access patterns, with self-read and self-update rules for profile data and admin-only rules for operational tables.

## Authentication And Storage Dependencies

The application still depends on Supabase-managed platform objects that are not owned by the app schema:

- `auth.users`
- `auth.uid()`
- `service_role` edge-function access for user provisioning, deletion, and password resets
- `storage.buckets`
- `storage.objects`
- buckets referenced by the app: `issue-photos`, `eod-signatures`

## Recommended Vendor Clone Flow

1. Create a new Supabase project for the vendor.
2. Apply the application-owned schema and seed scripts from the install kit.
3. Recreate the required storage buckets and bucket policies.
4. Configure the edge-function environment variables for the new project.
5. Provision initial admin users and verify `profiles.role`.
6. Run the verification checklist against the new project before go-live.

## Notes For Future Exports

- The CLI link succeeded for the remote project, but the standard Supabase CLI dump path required Docker on this Windows workstation.
- The final export was completed with local `pg_dump` against the linked pooler connection.
- The resulting SQL file is the canonical schema snapshot for vendor bootstrap work.

