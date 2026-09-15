-- Bind Idempotency-Key to the complete JSON job parameters. A key reused for a
-- different operation must be a conflict, not a silent alias of the first job.
BEGIN;

ALTER TABLE async_jobs
    ADD COLUMN IF NOT EXISTS idempotency_params_hash TEXT;

-- pgcrypto is installed by the earlier foundation migrations. Backfill legacy
-- rows before the application starts enforcing the comparison for new requests.
UPDATE async_jobs
SET idempotency_params_hash = encode(digest(params::text, 'sha256'), 'hex')
WHERE idempotency_params_hash IS NULL;

INSERT INTO schema_migrations (version, name)
VALUES (14, 'async_job_params_hash')
ON CONFLICT (version) DO NOTHING;

COMMIT;
