-- Prevent multiple open travel logs per custodian/assignment
CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_travel_log
ON travel_logs (custodian_id, assignment_id)
WHERE status = 'in_progress';
