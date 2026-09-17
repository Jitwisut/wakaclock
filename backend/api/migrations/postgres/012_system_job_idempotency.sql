-- System jobs (pricing, account deletion and billing reconciliation) have no
-- user_id because some of them must remove the user row itself. PostgreSQL's
-- normal unique index treats NULL user_ids as distinct, so add a separate
-- partial index to make their Idempotency-Key effective.
BEGIN;

-- The pre-R5 schema did not enforce idempotency for system jobs, so a deployment
-- may already contain multiple legitimate jobs with the same key. Preserve every
-- row, but give all rows after the deterministic first one a legacy-suffixed key
-- before adding the constraint. This makes the migration retryable without
-- silently dropping accepted work.
WITH ranked AS (
    SELECT id,
           idempotency_key,
           row_number() OVER (
               PARTITION BY kind, idempotency_key
               ORDER BY requested_at, id
           ) AS duplicate_number
    FROM async_jobs
    WHERE user_id IS NULL AND idempotency_key IS NOT NULL
)
UPDATE async_jobs AS jobs
SET idempotency_key = ranked.idempotency_key || ':legacy:' || ranked.id::text
FROM ranked
WHERE jobs.id = ranked.id AND ranked.duplicate_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS async_jobs_system_idempotency_idx
    ON async_jobs (kind, idempotency_key)
    WHERE user_id IS NULL AND idempotency_key IS NOT NULL;

INSERT INTO schema_migrations (version, name)
VALUES (12, 'system_job_idempotency')
ON CONFLICT (version) DO NOTHING;

COMMIT;
