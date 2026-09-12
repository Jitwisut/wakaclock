-- R3 worker ownership and durable outbox failure metadata.
--
-- A lease token fences a worker after its lease expires: every state transition
-- must match the token that claimed the row. Outbox failure fields let the relay
-- retire an invalid payload instead of fetching it forever and eventually
-- starving valid rows behind it.
BEGIN;

ALTER TABLE async_jobs
    ADD COLUMN IF NOT EXISTS lease_owner UUID;

ALTER TABLE outbox_events
    ADD COLUMN IF NOT EXISTS delivery_target TEXT NOT NULL DEFAULT 'primary',
    ADD COLUMN IF NOT EXISTS retry_delay_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ADD COLUMN IF NOT EXISTS publish_attempts INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS failed_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failure_code TEXT;

CREATE INDEX IF NOT EXISTS outbox_pending_delivery_idx
    ON outbox_events (available_at, created_at)
    WHERE published_at IS NULL AND failed_at IS NULL;

INSERT INTO schema_migrations (version, name)
VALUES (8, 'job_worker_state')
ON CONFLICT (version) DO NOTHING;

COMMIT;
