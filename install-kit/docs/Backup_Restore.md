# Backup and Restore Guide

This guide describes the backup strategy for vendor-specific CRA OPS deployments
and the expected restore approach if a rollback is required.

## System Overview

Each vendor uses a separate Supabase project, so backups should be handled at the
project level rather than as shared global state.

## Architecture

A complete recovery plan should include:

- database backup
- storage backup
- edge function and configuration references
- release version tracking

## Backup Strategy

Recommended backup posture:

1. Take a backup before every production upgrade.
2. Keep a known-good backup from the current release.
3. Retain restore instructions alongside the backup artifacts.
4. Verify that storage and database backups are aligned.
5. Track the version, time, and vendor project for every backup.

## Restore Process

1. Identify the target vendor project and recovery point.
2. Restore the database from the selected backup.
3. Restore the relevant storage objects if required.
4. Reapply configuration values and access settings.
5. Validate the application in a non-public environment first.
6. Confirm the restored environment before resuming service.

## Supabase Setup

For each vendor project, confirm the backup plan includes:

- database export or snapshot
- storage bucket export or archive
- migration history
- service and auth configuration references

## Vercel Deployment

If a rollback is required, redeploy the previously approved front-end version
and reconnect it to the restored Supabase project state.

## Environment Variables

Keep a copy of the environment values used for each release so the app can be
reconnected to the correct vendor project after restore or rollback.

## Release Process

Backups should be part of the release checklist, not an afterthought. The
minimum release rule is:

- backup first
- deploy second
- verify third
- restore only when required
