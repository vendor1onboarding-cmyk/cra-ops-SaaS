# Vendor Onboarding Guide

This guide describes the recommended onboarding flow for a new vendor using a
separate Supabase project while sharing the same CRA OPS codebase.

## 1. Confirm vendor scope

Define the vendor name, environments required, support contacts, and any
branding or configuration differences.

## 2. Create the Supabase project

Provision a new Supabase project for the vendor. Keep this project isolated
from all other vendors.

## 3. Prepare configuration values

Collect the vendor-specific values that will be needed during deployment:

- project URL
- anon key
- service role key if required for admin flows
- storage bucket names
- email/auth settings
- branding references

## 4. Apply the database install scripts

Run the SQL scripts in the install order used by your deployment process.
Track which script version has been applied to the vendor project.

## 5. Verify the schema

Confirm that the required tables, indexes, functions, triggers, views, and RLS
policies are present and working as expected.

## 6. Configure storage and permissions

Set up the required storage buckets and the minimum permissions needed by the
application roles.

## 7. Seed initial data

Load any baseline data needed for the vendor, such as default profiles,
configuration rows, or reference records.

## 8. Deploy the application

Point the shared CRA OPS build to the vendor's Supabase project using the
environment-specific configuration layer.

## 9. Run smoke tests

Validate the critical paths:

- login
- dashboard loading
- admin access
- SOA views
- certificate generation and verification
- one end-to-end operational workflow

## 10. Hand over to operations

Document the support contacts, upgrade path, backup expectations, and the
approved rollback procedure before go-live.
