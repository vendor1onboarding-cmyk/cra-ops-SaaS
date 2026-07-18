# Vendor Onboarding Checklist

Use this checklist when provisioning CRA OPS for a new vendor on a fresh Supabase project.

## 1. Create Supabase project

- [ ] Create a new Supabase project for the vendor.
- [ ] Record the project ref and dashboard URL.
- [ ] Confirm the region and database password policy.

## 2. Enable required extensions

- [ ] Verify the target database is PostgreSQL 17-compatible.
- [ ] Enable required extensions from `scripts/install/00_extensions.sql`.
- [ ] Confirm `pgcrypto` is available for UUID defaults.

## 3. Execute `scripts/install` in sequence

- [ ] Run `scripts/install/00_extensions.sql`
- [ ] Run `scripts/install/01_tables.sql`
- [ ] Run `scripts/install/02_constraints.sql`
- [ ] Run `scripts/install/03_indexes.sql`
- [ ] Run `scripts/install/04_functions.sql`
- [ ] Run `scripts/install/05_triggers.sql`
- [ ] Run `scripts/install/06_views.sql`
- [ ] Run `scripts/install/07_rls.sql`
- [ ] Run `scripts/install/08_storage.sql`
- [ ] Run `scripts/install/09_seed.sql`
- [ ] Run `scripts/install/10_permissions.sql`
- [ ] Run `scripts/install/11_database_version.sql`
- [ ] Run `scripts/install/12_verify.sql`

## 4. Create Storage buckets

- [ ] Confirm `issue-photos` exists.
- [ ] Confirm `eod-signatures` exists.
- [ ] Verify bucket privacy settings.
- [ ] Apply any bucket policies required by the vendor workflow.

## 5. Configure Authentication

- [ ] Confirm Supabase Auth is enabled.
- [ ] Configure login settings for the vendor.
- [ ] Ensure email-based sign-in or approved identifier flow is working.
- [ ] Verify first-login password reset behavior.
- [ ] Create the initial admin profile in `profiles`.

## 6. Configure Environment Variables

- [ ] Set `VITE_SUPABASE_URL`
- [ ] Set `VITE_SUPABASE_ANON_KEY`
- [ ] Set `SUPABASE_URL` for edge functions
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY` for edge functions
- [ ] Set any vendor-specific branding or routing variables

## 7. Deploy Vercel

- [ ] Connect the repository to Vercel.
- [ ] Set the production environment variables.
- [ ] Confirm the build command and output directory.
- [ ] Deploy a production preview and validate the app.

## 8. Create first Admin user

- [ ] Create the first admin user in Supabase Auth.
- [ ] Insert or update the matching `profiles` row.
- [ ] Set `role = 'admin'`.
- [ ] Set `first_login = true` if the user must reset password on first sign-in.
- [ ] Share temporary credentials securely.

## 9. Verify application

- [ ] Log in as admin.
- [ ] Verify route access and role-based navigation.
- [ ] Confirm CRUD operations on core business screens.
- [ ] Confirm uploads to required storage buckets.
- [ ] Confirm edge functions execute successfully.
- [ ] Confirm analytics, approvals, and password flows work.

## 10. Record installed version

- [ ] Record the application release version.
- [ ] Record the database schema version from `scripts/install/11_database_version.sql`.
- [ ] Record the deployment date and operator name.
- [ ] Store the release notes and rollback path.

## 11. Go-live checklist

- [ ] Backup the vendor database before cutover.
- [ ] Verify all core tables exist.
- [ ] Verify RLS policies are active.
- [ ] Verify storage buckets are present.
- [ ] Verify Vercel deployment is live.
- [ ] Verify auth sign-in and password reset.
- [ ] Verify admin workflows end-to-end.
- [ ] Obtain business sign-off before production use.

