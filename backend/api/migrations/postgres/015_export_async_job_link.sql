-- Link an export request to the durable async job that owns its execution. The
-- relation lets cancellation fence queued work before an artifact is produced.
BEGIN;

ALTER TABLE export_jobs
    ADD COLUMN IF NOT EXISTS async_job_id UUID REFERENCES async_jobs(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS export_jobs_async_job_idx
    ON export_jobs (async_job_id)
    WHERE async_job_id IS NOT NULL;

INSERT INTO schema_migrations (version, name)
VALUES (15, 'export_async_job_link')
ON CONFLICT (version) DO NOTHING;

COMMIT;
