# Copilot / AI Agent Instructions

This file gives focused, actionable guidance for AI coding agents working in this repo so they are immediately productive.

## Big picture architecture
- Single-page React app (Vite + TypeScript). Entry is `src/main.tsx`, which wires `AuthProvider` and `QueryClientProvider`.
- Routes are defined in `src/App.tsx`. Use `PrivateRoute` for auth-protected pages and `src/components/RequireAdmin.tsx` for admin/supervisor-only routes.
- Supabase is the backend (auth + Postgres). Client setup is in `src/api/supabaseClient.ts`.

## Role-aware behavior
- Roles: custodian, supervisor, admin. Use `profile.role` from `src/context/AuthContext.tsx`.
- Custodians see only their records; admins/supervisors can see all data and access admin pages.

## SOA data flow (core feature)
- Statement of Accounts page: `src/pages/StatementOfAccounts.tsx` queries `v_soa_effective` with date range filters; custodian filter is `eq("custodian_id", profile.id)`.
- Admin adjustments page: `src/pages/AdminSOAAdjustments.tsx` is read-only and shows operational adjustments (EXCHANGE/INTER_SITE_TRANSFER), with an optional legacy CREDIT/DEBIT view for audit only.

## UI and formatting conventions
- Currency is shown in Indian format with `₹` and 2 decimals (e.g., `toLocaleString("en-IN")`).
- Dates display as `DD/MM/YYYY`.
- Mobile breakpoint is < 768px (stacked cards, full-width buttons, table scroll).

## Developer workflow
- Install deps: `npm install`.
- Create `.env.local` with Supabase URL + anon key (see README + Development Guide for exact var names).
- Run dev server: `npm run dev` (expected local URL is http://localhost:5175).

## Project conventions
- Page-level data fetching and business logic live in `src/pages/*`.
- Reuse shared pieces from `src/components/*` (e.g., `Layout.tsx`, `FileUpload.tsx`, `DenominationFields.tsx`) instead of creating ad-hoc UI.
- Map features use `leaflet`/`react-leaflet`; keep `src/utils/leafletFix.ts` imported once in `src/main.tsx`.
- PWA registration happens in `src/main.tsx` via `registerSW()`.

## Docs to consult
- Start here: START_HERE.md and DOCUMENTATION_INDEX.md.
- SOA architecture/details: SOA_TECHNICAL_GUIDE.md and DATABASE_TRIGGERS_SOA_WORKFLOW.md.
