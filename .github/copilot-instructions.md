# Copilot / AI Agent Instructions

This file gives focused, actionable guidance for AI coding agents working in this repo so they are immediately productive.

## Big picture architecture
- Single-page React app (Vite + TypeScript). Entry is `src/main.tsx`, which wires `AuthProvider` and `QueryClientProvider`.
- Routes are defined in `src/App.tsx`. Use `PrivateRoute` for auth-protected pages and `src/components/RequireAdmin.tsx` for admin/supervisor-only routes.
- Supabase is the backend (auth + Postgres). Client setup is `src/api/supabaseClient.ts`.
- Business logic lives in **database triggers**, not application code—see DATABASE_TRIGGERS_SOA_WORKFLOW.md for SOA calculations and data integrity rules.

## Role-aware behavior
- Roles: custodian, supervisor, admin. Use `profile.role` from `src/context/AuthContext.tsx`.
- Custodians see only their records; admins/supervisors can see all data and access admin pages.
- Check role in UI with `profile?.role === 'admin'`; guard routes with `<RequireAdmin>` wrapper component.

## SOA data flow (core feature)
- Statement of Accounts page: `src/pages/StatementOfAccounts.tsx` queries `v_soa_effective` view with date range filters; custodian filter is `eq("custodian_id", profile.id)`.
- Admin adjustments page: `src/pages/AdminSOAAdjustments.tsx` is read-only and shows operational adjustments (EXCHANGE/INTER_SITE_TRANSFER), with an optional legacy CREDIT/DEBIT view for audit only.
- SOA calculations auto-update via database triggers when transactions are inserted/updated—queries read materialized views.

## Data access patterns
- Direct table queries: `supabase.from("table_name").select(...)` for CRUD operations.
- Views for reporting: Query `v_soa_effective`, `v_atm_load_sources` instead of joining tables manually.
- RPCs for complex logic: Call `supabase.rpc("function_name", { params })` for operations like `auto_assign_route_by_district`.
- Edge functions for admin ops: Use `invokeEdgeFunction()` helper from `src/api/supabaseClient.ts` for secure operations (user creation, deletion, password resets). Edge functions live in `supabase/functions/*/index.ts`.

## Error handling conventions
- Check `if (error)` after Supabase queries; display `error.message` to user or log for debugging.
- Edge function helper (`invokeEdgeFunction`) handles session expiration/refresh automatically and throws with clear messages.
- File uploads: Check for `uploadError` from storage operations before inserting DB records.

## UI and formatting conventions
- Currency is shown in Indian format with `₹` and 2 decimals (e.g., `toLocaleString("en-IN")`).
- Dates display as `DD/MM/YYYY`.
- Mobile breakpoint is < 768px (stacked cards, full-width buttons, table scroll).
- Use Tailwind's responsive utilities: `md:` prefix for desktop styles.

## Developer workflow
- Install deps: `npm install`.
- Create `.env.local` with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (see README + Development Guide for setup).
- Run dev server: `npm run dev` (expected local URL is http://localhost:5175).
- Deploy edge functions: See EDGE_FUNCTION_DEPLOYMENT_GUIDE.md (use Supabase CLI with `supabase functions deploy <function-name>`).
- No automated test suite—validation is manual/QA-driven; refer to `*_VALIDATION_GUIDE.md` docs for test scenarios.

## Project conventions
- Page-level data fetching and business logic live in `src/pages/*`.
- Reuse shared pieces from `src/components/*` (e.g., `Layout.tsx`, `FileUpload.tsx`, `DenominationFields.tsx`) instead of creating ad-hoc UI.
- Utility functions in `src/utils/*` handle cross-cutting concerns (travel logging, time formatting, assignment fetching).
- Map features use `leaflet`/`react-leaflet`; keep `src/utils/leafletFix.ts` imported once in `src/main.tsx`.
- PWA registration happens in `src/main.tsx` via `registerSW()` from `vite-plugin-pwa`.

## Database schema understanding
- Check `*.sql` files in root for migrations (e.g., `BANK_ACCOUNTS_MIGRATION.sql`, `USER_MANAGEMENT_MOBILE_SUPPORT_MIGRATION.sql`).
- Views are defined in files like `v_soa_effective.sql`, `v_atm_load_sources.sql`—understand structure before modifying queries.
- Database triggers enforce business rules—don't replicate in app code; trust the DB to maintain consistency.

## Docs to consult
- Start here: START_HERE.md and DOCUMENTATION_INDEX.md.
- SOA architecture/details: SOA_TECHNICAL_GUIDE.md and DATABASE_TRIGGERS_SOA_WORKFLOW.md.
- Feature implementations: Files matching `*_IMPLEMENTATION.md`, `*_QUICK_REFERENCE.md` describe specific features.
- Edge function patterns: EDGE_FUNCTION_DEPLOYMENT_GUIDE.md and example functions in `supabase/functions/*/index.ts`.
