# Upgrade Scripts

This folder contains the database upgrade framework for CRA OPS vendor
installations.

Use these scripts to move a customer database from one supported release to the
next without changing application source code.

## How upgrades should be written

- Make each script represent one target version only.
- Keep each upgrade small, explicit, and easy to review.
- Prefer additive changes over destructive changes.
- Use idempotent SQL wherever PostgreSQL supports it.
- Include comments for every non-obvious change.
- Avoid mixing unrelated schema, data, and permission changes in the same file
  unless they are part of one release unit.

## Version numbering

- Use semantic-style release numbers: `VMAJOR.MINOR.PATCH.sql`.
- Example: `V1.0.1.sql`, `V1.1.0.sql`.
- `PATCH` releases should be small fixes or compatibility updates.
- `MINOR` releases should include backward-compatible enhancements.
- `MAJOR` releases should be reserved for breaking schema or workflow changes.

## Rollback strategy

- Every upgrade should have a documented rollback plan.
- Favor reversible SQL where possible.
- For destructive changes, create a migration path that preserves the old data
  until the new release is verified.
- When a rollback is not safe in SQL, document the manual rollback steps in the
  release notes and backup the database first.
- Never assume a rollback can be applied after dependent application code has
  already changed.

## Transaction handling

- Keep each upgrade script atomic when the change set is compatible with a
  single transaction.
- Use `BEGIN; ... COMMIT;` for normal schema and metadata changes.
- Do not wrap commands that PostgreSQL does not allow inside a transaction.
- If a script needs non-transactional steps, split those steps into their own
  file and document the reason clearly.
- Validate the script on a staging clone before running it in production.

## Naming conventions

- Use the exact version tag in the filename, for example `V1.1.0.sql`.
- Keep filenames uppercase `V`, followed by major, minor, and patch numbers.
- Add a short comment block at the top describing what the upgrade does.
- If a script introduces a new helper object, name it using the same
  application schema and existing naming style.

## Recommended execution pattern

1. Take a backup.
2. Review the change set.
3. Apply the upgrade file for the target version.
4. Run verification queries.
5. Record the installed version in release notes.
