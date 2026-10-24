-- Immutable commercial proof; mutable provider counters remain in daily_facts.
-- Enrollment never backfills receipts from existing facts.
CREATE TABLE IF NOT EXISTS team_copilot_admissions (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    installation_id BIGINT NOT NULL,
    day DATE NOT NULL,
    feature TEXT NOT NULL,
    provider_account_id BIGINT NOT NULL,
    github_user_id BIGINT NOT NULL,
    consent_version BIGINT NOT NULL,
    consent_from TIMESTAMPTZ NOT NULL,
    entitlement_revision BIGINT NOT NULL,
    privacy_generation BIGINT NOT NULL,
    admitted_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (organization_id,user_id,installation_id,day,feature)
);
CREATE INDEX IF NOT EXISTS team_copilot_admissions_day_idx
    ON team_copilot_admissions(organization_id,installation_id,day);

-- Necessary commercial proof only. Callers ALSO enforce live privacy, scopes,
-- retention and identity. Expiry stops new admission, not historical reads.
CREATE OR REPLACE VIEW team_copilot_admitted_facts AS
SELECT f.* FROM team_copilot_daily_facts f
WHERE NOT EXISTS(SELECT 1 FROM team_webhook_dispositions d
    WHERE d.provider='copilot_daily'
      AND d.delivery_id=f.organization_id::text||':'||f.user_id::text||':'||f.installation_id::text||':'||f.day::text||':'||f.feature)
AND (NOT EXISTS(SELECT 1 FROM team_analytics_entitlements e WHERE e.organization_id=f.organization_id)
 OR EXISTS(SELECT 1 FROM team_copilot_admissions a
    WHERE a.organization_id=f.organization_id AND a.user_id=f.user_id
      AND a.installation_id=f.installation_id AND a.day=f.day AND a.feature=f.feature
      AND a.provider_account_id=f.provider_account_id AND a.github_user_id=f.github_user_id
      AND a.consent_from=f.consent_from));

-- One bounded scheduler cursor, separate from provider report checkpoints. It
-- prevents permanently starving organizations beyond the first page.
CREATE TABLE IF NOT EXISTS team_copilot_schedule_cursor (
    singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK(singleton),
    after_organization UUID
);
INSERT INTO team_copilot_schedule_cursor(singleton) VALUES(TRUE) ON CONFLICT DO NOTHING;
