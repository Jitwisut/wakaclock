BEGIN;
-- Daily provider facts never enter session usage/heartbeat or cost allocation.
CREATE TABLE IF NOT EXISTS team_copilot_daily_integrations (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 installation_id BIGINT NOT NULL REFERENCES team_github_installations(installation_id),
 enabled BOOLEAN NOT NULL DEFAULT FALSE, start_day DATE NOT NULL,
 revision BIGINT NOT NULL DEFAULT 1, confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_copilot_daily_jobs (
 id UUID PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 installation_id BIGINT NOT NULL, installation_generation BIGINT NOT NULL,
 configuration_revision BIGINT NOT NULL, day DATE NOT NULL,
 checkpoint JSONB NOT NULL DEFAULT '{}', attempts INTEGER NOT NULL DEFAULT 0,
 retry_at TIMESTAMPTZ NOT NULL DEFAULT now(), lease_token UUID, lease_until TIMESTAMPTZ,
 completed_at TIMESTAMPTZ, dead_letter_at TIMESTAMPTZ, error_code TEXT,
 last_success_at TIMESTAMPTZ, UNIQUE(organization_id,day,configuration_revision)
);
CREATE TABLE IF NOT EXISTS team_copilot_daily_facts (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 installation_id BIGINT NOT NULL, day DATE NOT NULL, feature TEXT NOT NULL,
 metrics JSONB NOT NULL, payload_hash TEXT NOT NULL,
 consent_version BIGINT NOT NULL, consent_from TIMESTAMPTZ NOT NULL,
 observed_at TIMESTAMPTZ NOT NULL DEFAULT now(), blocked BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(organization_id,user_id,installation_id,day,feature)
);
CREATE TABLE IF NOT EXISTS team_copilot_daily_staging (
 job_id UUID NOT NULL REFERENCES team_copilot_daily_jobs(id) ON DELETE CASCADE,
 github_user_id BIGINT NOT NULL, feature TEXT NOT NULL, metadata JSONB NOT NULL,
 payload_hash TEXT NOT NULL,
 PRIMARY KEY(job_id,github_user_id,feature)
);
CREATE TABLE IF NOT EXISTS team_copilot_daily_rejections (
 job_id UUID NOT NULL REFERENCES team_copilot_daily_jobs(id) ON DELETE CASCADE,
 reason TEXT NOT NULL, record_hash TEXT NOT NULL, rejected_rows BIGINT NOT NULL DEFAULT 1,
 PRIMARY KEY(job_id,reason,record_hash)
);
CREATE INDEX IF NOT EXISTS team_copilot_daily_ready ON team_copilot_daily_jobs(retry_at) WHERE completed_at IS NULL AND dead_letter_at IS NULL;
CREATE TABLE IF NOT EXISTS team_copilot_daily_conflicts (
 job_id UUID NOT NULL REFERENCES team_copilot_daily_jobs(id) ON DELETE CASCADE,
 github_user_id BIGINT NOT NULL, feature TEXT NOT NULL, PRIMARY KEY(job_id,github_user_id,feature)
);
COMMIT;
