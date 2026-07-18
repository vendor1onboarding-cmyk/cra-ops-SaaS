# CRA OPS

CRA OPS is a production-grade React + Vite + TypeScript PWA for cash replenishment,
field operations, end-of-day reporting, and admin workflows. The product is
designed to run as a single shared codebase while serving multiple vendors, each
with its own isolated Supabase project.

## System Overview

CRA OPS supports operational users and administrators across the full daily
workflow:

- route assignment and field execution
- cash pickup and ATM replenishment
- denomination planning and exchange
- inter-site transfer and travel tracking
- technical issue logging
- end-of-day summary and approvals
- statement of accounts and operational analytics
- certificate generation and validation

The application is deployed as a web PWA and connects to vendor-specific
Supabase projects for authentication, data storage, and database-backed
business logic.

## Architecture

The solution follows a three-layer model:

1. Presentation layer: React pages and reusable UI components
2. Application layer: routing, auth guards, state management, and query orchestration
3. Data layer: Supabase Auth, Postgres tables, views, RPC/functions, storage, and edge functions

Each vendor gets a separate Supabase project, which gives strong data isolation
while preserving one maintainable application codebase.

## Technology Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack React Query
- Supabase Auth and Postgres
- Supabase Edge Functions
- Vite PWA plugin
- Vercel hosting

## Folder Structure

Key project areas:

- `src/` - application source code
- `public/` - static assets served by Vite
- `supabase/` - migrations, edge functions, and database artifacts
- `install-kit/` - commercial product packaging, deployment, and onboarding docs
- `scripts/` - install, upgrade, seed, backup, and verification scripts

## New Vendor Setup

For a new vendor, the recommended process is:

1. Create a dedicated Supabase project.
2. Apply the install scripts in the documented order.
3. Configure the environment variables for the vendor.
4. Load any vendor-specific seed data.
5. Deploy the shared CRA OPS build to Vercel.
6. Verify authentication, dashboard access, reporting, and admin flows.

See [install-kit/docs/Vendor_Onboarding.md](install-kit/docs/Vendor_Onboarding.md)
for the detailed onboarding workflow.

## Documentation

- [Installation Guide](install-kit/docs/Installation_Guide.md)
- [Deployment Guide](install-kit/docs/Deployment_Guide.md)
- [Upgrade Guide](install-kit/docs/Upgrade_Guide.md)
- [Backup and Restore](install-kit/docs/Backup_Restore.md)

## Environment Variables

Local development and Vercel deployment should be configured with vendor-
specific values such as:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Additional environment variables may be required for future vendor-specific
features, but the application should remain codebase-shared.
