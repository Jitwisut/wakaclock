-- Owner-triggered background jobs (plans/plan-kafka-rabbitmq-adoption.md, R2).
--
-- State is authoritative in this table. Creating a job also writes one row into
-- outbox_events in the same transaction; the dedicated job-worker relay
-- (src/infrastructure/job_relay.rs) turns that row into a RabbitMQ message. A job
-- never depends on the broker being reachable at create time.
BEGIN;

CREATE TABLE IF NOT EXISTS async_jobs (
    id UUID PRIMARY KEY,
    -- NULL for system jobs (pricing/account delete/billing reconcile); every other kind names the
    -- account it acts on so a worker never infers scope from the payload.
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    -- The JobKind routing key, e.g. 'analytics.reprocess'.
    kind TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'succeeded', 'failed', 'dead_lettered', 'cancelled')),
    -- Bumped by both the RabbitMQ retry path and the lease sweeper; capped at the
    -- length of JOB_RETRY_DELAYS before the job is dead-lettered.
    attempt SMALLINT NOT NULL DEFAULT 0 CHECK (attempt >= 0),
    idempotency_key TEXT,
    params JSONB NOT NULL DEFAULT '{}'::jsonb,
    result JSONB,
    -- Sanitized failure code only, never a message that could echo user data.
    error_code TEXT,
    -- Written by the worker runtime (R3) while it holds the job. The relay's sweeper
    -- re-enqueues a job whose lease elapsed without the worker finishing it.
    lease_expires_at TIMESTAMPTZ,
    requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    started_at TIMESTAMPTZ,
    finished_at TIMESTAMPTZ
);

-- One job per (account, kind, Idempotency-Key). System jobs (user_id IS NULL) gain
-- their separate kind/key index in migration 012 because PostgreSQL NULL semantics
-- make the account-scoped index inapplicable to them.
CREATE UNIQUE INDEX IF NOT EXISTS async_jobs_idempotency_idx
    ON async_jobs (user_id, kind, idempotency_key)
    WHERE idempotency_key IS NOT NULL;

-- The sweeper's scan: jobs still 'running' past their lease.
CREATE INDEX IF NOT EXISTS async_jobs_expired_lease_idx
    ON async_jobs (lease_expires_at)
    WHERE status = 'running';

INSERT INTO schema_migrations (version, name)
VALUES (7, 'async_jobs')
ON CONFLICT (version) DO NOTHING;

COMMIT;
