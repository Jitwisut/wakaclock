-- Metadata-only audit state for the K3 shadow verifier.
--
-- This table deliberately stores no heartbeat payload, entity or path.  The
-- verifier may record only the stable event identity and a bounded set of field
-- names so operators can investigate parity without turning PostgreSQL into a
-- second telemetry store.
BEGIN;

CREATE TABLE IF NOT EXISTS heartbeat_verification_audits (
    audit_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id TEXT NOT NULL,
    mismatch_category TEXT NOT NULL,
    field_flags TEXT[] NOT NULL DEFAULT '{}',
    attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
    received_at TIMESTAMPTZ NOT NULL,
    last_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    UNIQUE (tenant_id, event_id)
);

CREATE INDEX IF NOT EXISTS heartbeat_verification_audits_open_idx
    ON heartbeat_verification_audits (last_attempt_at DESC)
    WHERE resolved_at IS NULL;

COMMIT;
