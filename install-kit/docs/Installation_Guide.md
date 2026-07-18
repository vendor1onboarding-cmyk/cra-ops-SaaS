# Installation Guide

This guide describes how to install CRA OPS for a new vendor using a dedicated
Supabase project while keeping the application codebase shared.

## System Overview

CRA OPS is a commercial field-operations product for cash movement, operational
tracking, approvals, statements, and analytics. The application is delivered as
a PWA and uses Supabase for authentication, database access, storage, and
server-side workflows.

## Architecture

The installation model is built around separation of concerns:

- the React application is shared across all vendors
- each vendor receives a separate Supabase project
- environment variables define which vendor instance the app targets
- install scripts provision schema, access control, storage, and seed data

This keeps deployment repeatable while preserving strict tenant isolation.

## Technology Stack

- React
- TypeScript
- Vite
- Tailwind CSS
- React Router
- TanStack React Query
- Supabase Auth and Postgres
- Supabase Edge Functions
- Vercel

## Folder Structure

- `install-kit/` - deployment framework and operational documentation
- `scripts/install/` - ordered SQL install scripts
- `scripts/upgrade/` - versioned upgrade scripts
- `scripts/seed/` - bootstrap data scripts
- `scripts/backup/` - backup and restore helpers
- `supabase/` - migrations and edge functions

## New Vendor Setup

1. Confirm vendor name, contacts, and operating scope.
2. Provision a new Supabase project for the vendor.
3. Set the project-specific environment variables.
4. Run the install scripts in the documented sequence.
5. Seed initial data needed for the vendor.
6. Validate the authentication and operational flows.
7. Deploy the app to Vercel and point it at the new Supabase project.

## Supabase Setup

For each vendor project:

1. Enable Supabase Auth and confirm the login flow.
2. Apply the schema required by CRA OPS.
3. Create indexes and database functions used by reporting and workflows.
4. Add triggers and row-level security policies.
5. Configure required storage buckets and access rules.
6. Deploy any needed edge functions.

## Environment Variables

At minimum, the application requires:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Recommended practice:

- keep values in a vendor-specific secret store
- use separate values for local, staging, and production
- never reuse one vendor's project keys for another vendor

## Release Process

1. Prepare the release notes and version identifier.
2. Validate the database scripts in a non-production environment.
3. Confirm the app build completes successfully.
4. Deploy to staging and run smoke tests.
5. Approve the release after operational sign-off.
6. Promote to production during the agreed change window.

