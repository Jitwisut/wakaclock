-- Make repeated export requests converge on one export row before the public
-- endpoint is enabled. The unique key belongs to the export request, not only
-- the async job, because the job payload contains the export row ID.
BEGIN;

ALTER TABLE export_jobs
    ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS export_jobs_user_idempotency_idx
    ON export_jobs (user_id, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

INSERT INTO schema_migrations (version, name)
VALUES (16, 'export_idempotency')
ON CONFLICT (version) DO NOTHING;

COMMIT;
