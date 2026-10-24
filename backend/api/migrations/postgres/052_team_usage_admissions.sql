-- An immutable Team admission receipt references personal facts; it never copies cost/content.
-- No migration enrolls an organization or starts a trial.
CREATE TABLE IF NOT EXISTS team_usage_admissions (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_event_id TEXT NOT NULL CHECK (length(usage_event_id) BETWEEN 1 AND 1024),
    context_hash TEXT NOT NULL CHECK (length(context_hash)=64),
    project_id UUID NOT NULL,
    event_time TIMESTAMPTZ NOT NULL,
    source_revision BIGINT NOT NULL CHECK (source_revision>=0),
    payload_hash TEXT,
    consent_version BIGINT NOT NULL,
    consent_from TIMESTAMPTZ NOT NULL,
    entitlement_revision BIGINT NOT NULL,
    privacy_generation BIGINT NOT NULL,
    admitted_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (organization_id,user_id,usage_event_id)
);
CREATE INDEX IF NOT EXISTS team_usage_admissions_retention_idx
    ON team_usage_admissions(organization_id,event_time,user_id,usage_event_id);
