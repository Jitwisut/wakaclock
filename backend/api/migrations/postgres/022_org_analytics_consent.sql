-- Consent is scoped to one active organization membership. No row means no sharing.
CREATE TABLE IF NOT EXISTS organization_analytics_consents (
    organization_id UUID NOT NULL,
    user_id UUID NOT NULL,
    share_aggregate BOOLEAN NOT NULL DEFAULT FALSE,
    share_individual BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, user_id),
    FOREIGN KEY (organization_id, user_id)
        REFERENCES organization_members(organization_id, user_id) ON DELETE CASCADE,
    CONSTRAINT individual_requires_aggregate CHECK (NOT share_individual OR share_aggregate)
);

CREATE INDEX IF NOT EXISTS organization_analytics_consents_shared_idx
    ON organization_analytics_consents (organization_id, user_id)
    WHERE share_aggregate = TRUE;
