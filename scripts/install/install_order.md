# CRA OPS Install Order

Run the SQL files in this exact order for a new vendor installation.

1. `00_extensions.sql`
   - Enables required database extensions and establishes the base schema.

2. `01_tables.sql`
   - Creates tables, sequences, defaults, and table-level comments.

3. `02_constraints.sql`
   - Applies primary keys, unique constraints, and foreign keys.

4. `03_indexes.sql`
   - Creates performance indexes after the tables exist.

5. `04_functions.sql`
   - Creates stored procedures and trigger functions used by the application.

6. `05_triggers.sql`
   - Attaches triggers to tables after their functions exist.

7. `06_views.sql`
   - Creates the application views after tables and functions are available.

8. `07_rls.sql`
   - Enables row-level security and applies policies after dependent objects exist.

9. `08_storage.sql`
   - Creates and verifies required Supabase Storage buckets.

10. `09_seed.sql`
    - Inserts any seed or bootstrap data.

11. `10_permissions.sql`
    - Applies explicit grants and database permissions.

12. `11_database_version.sql`
    - Records the database version and acts as a version guard.

13. `12_verify.sql`
    - Runs verification queries to confirm the installation is complete.

## Notes

- Do not skip the dependency order.
- If you rerun the installer, tables and indexes should remain safe because the scripts are written to be idempotent where PostgreSQL supports it.
- Storage and authentication still require Supabase dashboard configuration in addition to SQL execution.

