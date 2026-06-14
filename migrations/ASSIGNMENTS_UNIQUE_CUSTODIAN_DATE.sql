-- Prevent duplicate assignments per custodian per day
-- NOTE: If duplicates already exist, resolve them before applying this index.
create unique index if not exists assignments_unique_custodian_date
  on assignments (custodian_id, assignment_date);
