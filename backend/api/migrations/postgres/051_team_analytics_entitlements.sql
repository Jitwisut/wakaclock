-- Preparatory commercial evidence only. No migration starts a trial or grants access.
-- Kept outside analytics retention; financial/restore policy must be completed before rollout.
CREATE TABLE IF NOT EXISTS team_analytics_entitlements (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL CHECK (revision > 0),
    state JSONB NOT NULL CHECK (jsonb_typeof(state) = 'object'),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS team_analytics_entitlement_history (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    revision BIGINT NOT NULL CHECK (revision > 0),
    reason TEXT NOT NULL CHECK (reason IN ('trial_started','provider_observed')),
    state JSONB NOT NULL CHECK (jsonb_typeof(state) = 'object'),
    recorded_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (organization_id, revision)
);
