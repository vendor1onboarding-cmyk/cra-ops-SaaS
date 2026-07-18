# Deployment Guide

This guide explains how to deploy CRA OPS to Vercel for a vendor-specific
Supabase project.

## System Overview

CRA OPS is a multi-tenant commercial product delivered as a single codebase.
Each vendor is isolated at the Supabase project level, while the front-end is
deployed from one shared repository.

## Architecture

Deployment has three moving parts:

- the static front-end build hosted on Vercel
- the vendor-specific Supabase project
- the supporting install and upgrade scripts

The app should always be deployed against the correct vendor environment
variables before release.

## Technology Stack

- Vite build output
- Vercel hosting
- Supabase backend
- React PWA front end

## Folder Structure

- `install-kit/deployment/` - deployment runbooks
- `install-kit/configuration/` - environment and vendor configuration notes
- `scripts/install/` - initial database setup
- `scripts/upgrade/` - patch and version upgrade scripts
- `scripts/backup/` - rollback and export helpers

## New Vendor Setup

Before deployment, confirm:

- vendor name and production contact
- Supabase project URL
- Supabase anon key
- storage bucket names
- any vendor branding requirements

## Supabase Setup

Deployment assumes the vendor Supabase project has already been prepared with:

- auth configuration
- database schema
- required views and policies
- storage buckets
- edge functions

If any of those items are missing, complete the installation guide before
deploying the application.

## Vercel Deployment

1. Connect the repository to Vercel.
2. Set the production and preview environment variables.
3. Verify the build command and output directory.
4. Deploy the application.
5. Open the deployed site and test login, dashboard loading, and core workflows.
6. Confirm the deployed environment is pointing at the intended vendor project.

## Environment Variables

Configure the following values in Vercel:

```env
VITE_SUPABASE_URL=YOUR_SUPABASE_URL
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Operational guidance:

- use preview-specific values for test deployments
- keep production secrets separate from local development
- rotate keys according to your internal policy

## Release Process

1. Merge the release branch.
2. Run the build and smoke tests.
3. Deploy to preview or staging.
4. Validate the vendor instance.
5. Approve the release and deploy to production.

