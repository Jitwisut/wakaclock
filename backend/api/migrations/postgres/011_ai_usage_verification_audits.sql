-- K5.5: metadata-only shadow verification audit.
-- Never store the original provider id, prompt, transcript, source path or
-- response. The event identity is hashed by the verifier before insert.
BEGIN;

CREATE TABLE IF NOT EXISTS ai_usage_verification_audits (
    id UUID PRIMARY KEY,
    event_id_hash TEXT NOT NULL,
    mismatch_category TEXT NOT NULL,
    field_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    received_at TIMESTAMPTZ NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_usage_verification_audits_event_idx
    ON ai_usage_verification_audits (event_id_hash, checked_at DESC);

INSERT INTO schema_migrations (version, name)
VALUES (11, 'ai_usage_verification_audits')
ON CONFLICT (version) DO NOTHING;

COMMIT;
