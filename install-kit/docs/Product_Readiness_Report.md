# CRA OPS Product Readiness Report

Date of analysis: 2026-07-18

## Scope

This report reviews the repository as a deployable product surface, including:

- React/Vite application code
- Supabase edge functions
- SQL/migration artifacts
- static branding assets
- deployment configuration

No application logic was modified while preparing this report.

## Executive Summary

CRA OPS is structurally close to a commercial multi-vendor platform, but it is
not fully white-label ready yet. The biggest remaining readiness gaps are:

- hardcoded product/company branding in the UI and print flows
- fixed logo and favicon assets
- vendor-specific certificate language and validation URL
- hardcoded theme and chart colors
- storage bucket names that are part of product behavior
- vendor/user-management assumptions in the Supabase functions

The core operational model is solid. The main remaining work is to move
identity-specific strings, asset paths, and tenant assumptions into a
configuration layer.

## 1. Hardcoded Company Names

| File path | Line number | Current value | Recommended configurable replacement |
|---|---:|---|---|
| `index.html` | 7 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `vite.config.ts` | 11 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/components/Layout.tsx` | 130 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/Login.tsx` | 65 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/Dashboard.tsx` | 526 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/StatementOfAccounts.tsx` | 1174 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/AdminEODDetail.tsx` | 554 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/AdminEODDetail.tsx` | 1095 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 200 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 451 | `Sruthi CRA Ops` | `${PRODUCT_NAME}` |
| `src/pages/EODSummary.tsx` | 1038 | `SRUTHI CRA OPERATIONS` | `${PRODUCT_NAME_UPPER}` |
| `src/pages/EODSummary.tsx` | 1905 | `Sruthi CRA Operations` | `${PRODUCT_NAME}` |
| `src/pages/Dashboard.tsx` | 1149 | `This is a system-generated report from Sruthi CRA Ops.` | `This is a system-generated report from ${PRODUCT_NAME}.` |
| `src/pages/StatementOfAccounts.tsx` | 2248 | `This is a system-generated report from Sruthi CRA Ops.` | `This is a system-generated report from ${PRODUCT_NAME}.` |
| `src/pages/AdminDashboard.tsx` | 260 | `This is a system-generated report from Sruthi CRA Ops. Any discrepancy must be reported within RBI-prescribed timelines.` | Vendor-neutral report footer |
| `src/pages/AdminEODDetail.tsx` | 1104 | `This is a system-generated report from Sruthi CRA Ops. Any discrepancy must be reported within RBI-prescribed timelines.` | Vendor-neutral report footer |

Notes:

- The exact string `Sruthi Tech Services` was not found in runtime code.
- The repository still uses several `Sruthi`-family names in UI text and print
  outputs, which are the primary white-label blockers.

## 2. Branding Assets

| File path | Line number | Current value | Recommended generic replacement |
|---|---:|---|---|
| `index.html` | 5 | `<link rel="icon" type="image/svg+xml" href="/favicon.svg" />` | Tenant-configured favicon path |
| `public/favicon.svg` | 2-3 | Blue/yellow branded SVG marks | Neutral or tenant-specific favicon asset |
| `public/bank-logo.png` | n/a | Bank logo image asset | Tenant-specific logo or neutral brand mark |
| `src/assets/india1-logo.png` | n/a | India1 ATM logo image asset | Tenant-specific logo or neutral brand mark |
| `src/assets/india1-logo.txt` | 1-2 | Placeholder note for `india1-logo.png` and `India1 ATM logo` | Replace with neutral asset guidance |
| `src/pages/Dashboard.tsx` | 520 | `src="/bank-logo.png"` | Tenant-configured logo asset path |
| `src/pages/StatementOfAccounts.tsx` | 182 | `const bankLogoSrc = \`${import.meta.env.BASE_URL}bank-logo.png\`;` | Tenant-configured logo asset path |
| `src/pages/AdminEODDetail.tsx` | 552 | `<img src="/bank-logo.png" alt="Bank Logo" ... />` | Tenant-configured logo asset path |
| `src/pages/analytics/AdvancedAnalytics.tsx` | 199 | `<img src="/bank-logo.png" alt="" ... />` | Tenant-configured logo asset path |
| `src/pages/EODSummary.tsx` | 1036 | `<img src="/bank-logo.png" alt="Bank Logo" ... />` | Tenant-configured logo asset path |
| `src/pages/CashTransitCertificate.tsx` | 6 | `import india1Logo from "../assets/india1-logo.png";` | Tenant-configured logo import |
| `src/pages/CashTransitCertificate.tsx` | 268 | `alt="India1 ATM Logo"` | Generic alt text |
| `src/pages/CashTransitCertificate.tsx` | 419 | `alt="India1 ATM Logo"` | Generic alt text |

## 3. Hardcoded Email Addresses

### Runtime and application code

| File path | Line number | Current value | Recommended replacement |
|---|---:|---|---|
| `src/pages/admin/UserOnboarding.tsx` | 313 | `john.doe@example.com` | Example-only placeholder or remove |
| `src/pages/admin/BankAccountOnboarding.tsx` | 627 | `info@bank.com` | Example-only placeholder or remove |

### Notes

- I did not find live production email identities hardcoded in the Supabase
  user-management functions.
- The repo contains many documentation-only sample addresses such as
  `admin@example.com`, `john@company.com`, `jane@company.com`, and
  `test@example.com`. Those are examples, but they should still be reviewed if
  the goal is a fully vendor-neutral public documentation set.

## 4. Hardcoded Phone Numbers

### Runtime and application code

| File path | Line number | Current value | Recommended replacement |
|---|---:|---|---|
| `src/pages/admin/BankAccountOnboarding.tsx` | 611 | `9363311438` | Example-only placeholder or remove |
| `src/pages/admin/UserOnboarding.tsx` | 335 | `9876543210` | Example-only placeholder or remove |
| `src/pages/Login.tsx` | 122 | `9876543210` | Example-only placeholder or remove |

### Notes

- I did not find fixed production phone numbers inside the Supabase functions.
- Documentation also contains sample phone numbers such as `8925947320`,
  `9363311438`, and `9876543210`.

## 5. Environment Variables Currently Used

| Variable | Where used | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | `src/api/supabaseClient.ts:3`, `src/pages/admin/AdminChequeVerification.tsx:384` | Front-end Supabase endpoint and public storage URL construction |
| `VITE_SUPABASE_ANON_KEY` | `src/api/supabaseClient.ts:4` | Front-end anonymous Supabase key |
| `SUPABASE_URL` | `supabase/functions/create-user/index.ts:34`, `supabase/functions/delete-user/index.ts:9`, `supabase/functions/reset-user-password/index.ts:34` | Edge-function Supabase endpoint |
| `SUPABASE_SERVICE_ROLE_KEY` | `supabase/functions/create-user/index.ts:35`, `supabase/functions/delete-user/index.ts:10`, `supabase/functions/reset-user-password/index.ts:35` | Admin/service-role access for edge functions |
| `SUPABASE_ANON_KEY` | `supabase/functions/create-user/index.ts:36` | Passed to edge function helper client |
| `import.meta.env.BASE_URL` | `src/pages/StatementOfAccounts.tsx:182` | Vite base path for logo asset resolution |

## 6. Supabase Storage Buckets Referenced

| Bucket | Where referenced | Purpose | Configurability risk |
|---|---|---|---|
| `eod-signatures` | `src/components/SignatureImage.tsx:73, 212`, `src/pages/EODSummary.tsx:1776, 1782`, `src/pages/CustodianAdjustmentConfirm.tsx:195, 201` | Signature images for EOD and confirmation flows | Medium |
| `issue-photos` | `src/pages/ATMExcessCash.tsx:162, 251, 264`, `src/pages/ATMReplenishment.tsx:962`, `src/pages/CashPickup.tsx:613, 627`, `src/pages/InterSiteTransfer.tsx:380`, `src/pages/TechnicalIssues.tsx:121, 131`, `src/pages/admin/AdminChequeVerification.tsx:384` | Photo evidence and cheque verification images | Medium |

## 7. SQL Objects Expected by the Application

### Tables

`assignments`, `atm_cash_adjustments`, `atm_excess_cash`, `atm_removal_plans`,
`atm_replenishments`, `audit_logs`, `bank_accounts`,
`bank_denomination_plans`, `banks`, `cash_pickups`, `cheque_audit_log`,
`denomination_plans`, `profiles`, `route_sites`, `sites`, `soa_adjustments`,
`soa_ledger`, `soa_postings`, `system_settings`, `technical_issues`,
`travel_logs`, `vehicle_rates`

### Views

Directly referenced in `src/`:

`v_atm_load_sources`, `v_atm_load_utilization`, `v_cash_recycling_rate`,
`v_cash_risk_indicators`, `v_cash_variance_analytics`,
`v_cheque_verifications`, `v_internal_transfer_efficiency`, `v_soa_detailed`,
`v_soa_effective`

Defined in SQL artifacts and used by the broader product docs / analytics pack:

`v_atm_load_frequency`, `v_atm_performance_score`, `v_bank_pickup_trends`,
`v_cash_flow_intelligence`, `v_rolling_pickup_trends`,
`v_statement_of_accounts`

### Functions

`approve_eod_assignment`, `calculate_closing_balance`,
`log_cheque_status_change`, `update_timestamp`

### Evidence

- `src/pages/AdminEODDetail.tsx:971-973` calls the `approve_eod_assignment`
  RPC.
- `migrations/SOA_V2_MIGRATION.sql:329` defines
  `calculate_closing_balance`.
- `CHEQUE_CAPTURE_MIGRATION.sql:49` defines `log_cheque_status_change`.
- `BANK_ACCOUNTS_MIGRATION.sql:118` and
  `DATABASE_SOA_DOCUMENTATION_COMPLETE_SUMMARY.md:543` define
  `update_timestamp`.

## 8. Routes / Pages

| Route | Page / component | Evidence |
|---|---|---|
| `/login` | `Login` | `src/App.tsx:60` |
| `/` | `Dashboard` | `src/App.tsx:64-68` |
| `/admin` | `AdminDashboard` | `src/App.tsx:73-77` |
| `/denomination-plan` | `DenominationPlan` | `src/App.tsx:82-86` |
| `/cash-pickup` | `CashPickup` | `src/App.tsx:91-95` |
| `/atm-replenishment` | `ATMReplenishment` | `src/App.tsx:100-104` |
| `/atm-excess-cash` | `ATMExcessCash` | `src/App.tsx:109-113` |
| `/denomination-exchange` | `DenominationExchange` | `src/App.tsx:118-122` |
| `/inter-site-transfer` | `InterSiteTransfer` | `src/App.tsx:127-131` |
| `/technical-issues` | `TechnicalIssues` | `src/App.tsx:136-140` |
| `/eod-summary` | `EODSummary` | `src/App.tsx:145-149` |
| `/travel-log` | `TravelTracking` | `src/App.tsx:154-158` |
| `/soa` | `StatementOfAccounts` | `src/App.tsx:163-167` |
| `/adjustments/confirm` | `CustodianAdjustmentConfirm` | `src/App.tsx:172-176` |
| `/password-change` | `PasswordChange` | `src/App.tsx:181-185` |
| `/first-login-reset` | `FirstLoginPasswordReset` | `src/App.tsx:190` |
| `/analytics` | `AdvancedAnalytics` | `src/App.tsx:193-197` |
| `/analytics/advanced` | `AdvancedAnalytics` | `src/App.tsx:202-206` |
| `/admin/approvals` | `AdminApprovals` | `src/App.tsx:212-216` |
| `/admin/approvals/:assignmentId` | `AdminEODDetail` | `src/App.tsx:222-226` |
| `/admin/route-assignment` | `AdminRouteAssignment` | `src/App.tsx:232-236` |
| `/admin/soa-adjustments` | `AdminSOAAdjustments` | `src/App.tsx:240-244` |
| `/admin/operations` | `AdminOperations` | `src/App.tsx:248-252` |
| `/admin/bank-accounts` | `BankAccountOnboarding` | `src/App.tsx:257-261` |
| `/admin/cheque-verification` | `AdminChequeVerification` | `src/App.tsx:266-270` |
| `/cash-transit-certificate` | `CashTransitCertificate` | `src/App.tsx:275-279` |
| `/validate-cash-transit-certificate` | `ValidateCashTransitCertificate` | `src/App.tsx:284` |

Fallback route:

- `*` redirects to `/` at `src/App.tsx:289`

## 9. User Roles

| Role | Where used | Behavior |
|---|---|---|
| `admin` | `src/context/AuthContext.tsx:10`, `src/components/RequireAdmin.tsx:23`, `src/components/Layout.tsx:52`, `supabase/functions/create-user/index.ts:56-68`, `supabase/functions/delete-user/index.ts:46-50`, `supabase/functions/reset-user-password/index.ts:52-66` | Full admin access, user management, approvals, analytics |
| `supervisor` | `src/context/AuthContext.tsx:10`, `src/components/Layout.tsx:52`, `src/pages/Login.tsx:18` | Treated as admin-equivalent in the shell and login redirects |
| `custodian` | `src/context/AuthContext.tsx:10` | Operational field user role |

Additional auth state:

- `first_login` is used to force password reset at `src/App.tsx:48` and is
  loaded from `profiles` in `src/context/AuthContext.tsx:45`.

## 10. Vendor-Specific Logic That Should Be Configurable

| Area | Current hardcoded behavior | Why it should be configurable |
|---|---|---|
| Product identity | `Sruthi CRA Ops`, `Sruthi CRA Operations`, `SRUTHI CRA OPERATIONS` | White-label rollout across vendors |
| Brand assets | `/bank-logo.png`, `public/favicon.svg`, `src/assets/india1-logo.png` | Each vendor will need its own logo/favicon set |
| Theme colors | `#0f172a`, `#1565C0`, `#42A5F5`, `#FFC107`, chart/status palette colors | Vendors will likely need their own visual identity |
| Certificate branding | `India1 ATM`, `INDIA1 ATM`, `India1 ATM Logo` | Vendor or franchise branding should be data-driven |
| Certificate validation fallback | `https://india1atm.com/validate` in `src/pages/CashTransitCertificate.tsx:226` | Must point to the vendor-specific validation domain |
| Print/report footers | `This is a system-generated report from Sruthi CRA Ops` | Must reflect the deployed vendor brand |
| Role assumptions | `admin` and `supervisor` are treated similarly in the shell | Some tenants may need different permission models |
| Storage bucket names | `issue-photos`, `eod-signatures` | Bucket naming may vary per vendor/project |
| Local storage key | `sruthi_travel_context` in `src/utils/travelLogService.ts:20` | Should not encode a vendor name |
| User-management emails | `mobile_${cleanMobile}@system.internal` in edge function logic | Internal identity strategy should be centrally defined |
| Public asset paths | `/bank-logo.png`, `/favicon.svg` | Tenant branding should come from config rather than fixed paths |

## Readiness Assessment

### Ready now

- core route structure
- auth and role gating
- operational reporting flows
- Supabase-backed user management
- PWA deployment support

### Needs configuration before commercial rollout

- branding extraction
- tenant-specific asset mapping
- vendor-specific validation URLs
- theme tokenization
- storage bucket/environment mapping
- documentation cleanup for sample data

### Needs validation before go-live

- storage bucket permissions
- SQL object availability
- edge function deployment
- role boundary review
- print output for all branded reports

