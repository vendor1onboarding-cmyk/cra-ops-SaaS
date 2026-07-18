# Upgrade Guide

This guide describes the recommended upgrade process for an existing vendor
deployment of CRA OPS.

## System Overview

The product is designed so application code can be updated independently of a
vendor's data, provided the database upgrade path is applied correctly.

## Architecture

Upgrades should be treated as two related activities:

- front-end release deployment
- Supabase schema or data migration

Both must be versioned and validated before production rollout.

## Technology Stack

- Vite and React build pipeline
- Supabase database migrations
- Edge functions where applicable
- Vercel deployment

## Folder Structure

- `scripts/upgrade/` - versioned database upgrade scripts
- `scripts/backup/` - pre-upgrade backups and recovery helpers
- `install-kit/docs/` - release and upgrade documentation

## Upgrade Process

1. Review the release notes and target version.
2. Take a backup before changing production data.
3. Apply database upgrades in the documented order.
4. Verify schema changes and permission updates.
5. Deploy the new front-end build.
6. Run smoke tests on the upgraded environment.
7. Confirm data integrity and operational workflows.

## Release Process

For each release:

- assign a version number
- record the change summary in `CHANGELOG.md`
- validate in a non-production vendor project
- promote only after sign-off

## Environment Variables

Upgrades should not change the variable shape unless a new feature requires it.
When environment values change, update them in all deployment targets before the
release is promoted.

