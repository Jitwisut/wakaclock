-- Kafka ingest request-path state (plan K0.5).
--
-- This migration is intentionally additive.  ClickHouse remains the compatibility
-- source until ATOAXIS_INGEST_STATE_SOURCE=postgres is selected, so existing
-- deployments can apply it before any cutover.
BEGIN;

CREATE TABLE IF NOT EXISTS user_ingest_access (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    trial_ends_at TIMESTAMPTZ,
    subscription_period_end TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT user_ingest_access_status_check
        CHECK (status IN ('active', 'trialing', 'canceled', 'inactive', 'past_due'))
);

CREATE INDEX IF NOT EXISTS user_ingest_access_active_idx
    ON user_ingest_access (user_id, status, trial_ends_at, subscription_period_end);

CREATE TABLE IF NOT EXISTS project_rules (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rule_id UUID NOT NULL,
    pattern TEXT NOT NULL,
    project_name TEXT NOT NULL,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, rule_id)
);

CREATE INDEX IF NOT EXISTS project_rules_active_priority_idx
    ON project_rules (user_id, priority DESC, updated_at DESC, rule_id)
    WHERE is_active;

COMMIT;
