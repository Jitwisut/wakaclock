-- Durable account-deletion tombstone and audit trail.
--
-- The account is marked inactive before any cross-store cleanup. The tombstone
-- survives the final PostgreSQL DELETE so Kafka consumers can reject records
-- that were already in flight when the account deletion began.
BEGIN;

-- Accepted user-scoped jobs must not disappear through a foreign-key cascade
-- while account deletion is draining them. They remain as terminal/auditable
-- rows after the user row is removed.
ALTER TABLE async_jobs
    DROP CONSTRAINT IF EXISTS async_jobs_user_id_fkey;

ALTER TABLE async_jobs
    ADD CONSTRAINT async_jobs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS account_deletion_requests (
    account_id UUID PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'requested'
        CHECK (status IN ('requested', 'running', 'succeeded', 'failed', 'dead_lettered')),
    async_job_id UUID REFERENCES async_jobs(id) ON DELETE SET NULL,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ,
    error_code TEXT,
    verification JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS account_deletion_async_job_idx
    ON account_deletion_requests(async_job_id)
    WHERE async_job_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS account_deletion_audits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID NOT NULL,
    stage TEXT NOT NULL,
    outcome TEXT NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS account_deletion_audits_account_idx
    ON account_deletion_audits(account_id, created_at DESC);

INSERT INTO schema_migrations (version, name)
VALUES (20, 'account_deletion')
ON CONFLICT (version) DO NOTHING;

COMMIT;
