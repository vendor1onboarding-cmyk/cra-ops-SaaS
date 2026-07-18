# Release Process

This document defines the release process for CRA OPS commercial deployments.

## Versioning

- Use semantic versioning for both application and database changes.
- Application releases and database releases should stay aligned when possible.
- The current product baseline is `CRA OPS v1.0.0`.
- Record the application version and database version for every release.

## Release checklist

- [ ] Confirm the target release version.
- [ ] Review the code and database change set.
- [ ] Update `VERSION` if the release is approved.
- [ ] Update `CHANGELOG.md` with user-facing and database changes.
- [ ] Apply database install or upgrade scripts in the correct order.
- [ ] Verify Supabase Auth, Storage, and RLS behavior.
- [ ] Deploy the application to Vercel.
- [ ] Run smoke tests against a staging vendor project.
- [ ] Confirm backups are completed before production cutover.
- [ ] Record the release date, operator, and project ref.

## Database version

- The database version must be tracked separately from the application build.
- Use the install and upgrade scripts under `scripts/install` and `scripts/upgrade`
  to reproduce the exact database state for a vendor.
- The database version should be documented in the release notes and in the
  product metadata files.

## Application version

- The application version identifies the deployed front-end and edge-function
  release.
- Increment the application version when UI, workflow, or edge-function behavior
  changes.
- Keep the application version in sync with the release notes and deployment
  tags.

## Release flow

1. Prepare the release candidate.
2. Validate the database upgrade path on a staging clone.
3. Update metadata files.
4. Deploy the new application build.
5. Apply any database upgrade scripts.
6. Run the verification checklist.
7. Publish the release notes.
8. Capture the final version in the release log.

