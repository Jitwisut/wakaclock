-- Each accepted integration sync advances a durable generation. The generation is
-- part of the async-job idempotency key, so an HTTP retry of the same in-flight
-- request cannot create a second job while a later sync request is still allowed
-- to create a new generation after the first one completes.
BEGIN;

ALTER TABLE integration_connections
    ADD COLUMN IF NOT EXISTS sync_generation BIGINT NOT NULL DEFAULT 0;

ALTER TABLE integration_connections
    DROP CONSTRAINT IF EXISTS integration_connections_sync_generation_check;

ALTER TABLE integration_connections
    ADD CONSTRAINT integration_connections_sync_generation_check
    CHECK (sync_generation >= 0);

INSERT INTO schema_migrations (version, name)
VALUES (13, 'integration_sync_generation')
ON CONFLICT (version) DO NOTHING;

COMMIT;
