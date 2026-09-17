-- Durable identity reservation for the Kafka AI-usage ingress path.
--
-- This table deliberately stores only the authenticated tenant, the caller's
-- stable usage id and a content hash. It is not a copy of the usage payload.
-- Keeping the reservation in PostgreSQL makes the API's 409-before-publish
-- contract independent of ClickHouse availability and closes the direct/Kafka
-- check-then-insert race.
BEGIN;

CREATE TABLE IF NOT EXISTS ai_usage_ingest_identities (
    user_id UUID NOT NULL,
    usage_event_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, usage_event_id),
    CHECK (octet_length(usage_event_id) BETWEEN 1 AND 512),
    CHECK (payload_hash ~ '^[0-9a-f]{64}$')
);

CREATE INDEX IF NOT EXISTS ai_usage_ingest_identities_published_idx
    ON ai_usage_ingest_identities (published_at)
    WHERE published_at IS NOT NULL;

INSERT INTO schema_migrations (version, name)
VALUES (17, 'ai_usage_ingest_identities')
ON CONFLICT (version) DO NOTHING;

COMMIT;
