BEGIN;
CREATE TABLE IF NOT EXISTS team_github_identities (
 user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 github_user_id BIGINT NOT NULL UNIQUE CHECK(github_user_id>0), login TEXT NOT NULL,
 credentials BYTEA, expires_at TIMESTAMPTZ, verified_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 revoked_at TIMESTAMPTZ, refresh_lease UUID, refresh_until TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS team_github_oauth_attempts (
 state_hash TEXT PRIMARY KEY, user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 verifier BYTEA NOT NULL, expires_at TIMESTAMPTZ NOT NULL, consumed_at TIMESTAMPTZ
);
ALTER TABLE team_github_oauth_attempts ADD COLUMN IF NOT EXISTS session_hash TEXT NOT NULL DEFAULT 'legacy_unbound';
CREATE TABLE IF NOT EXISTS team_github_installations (
 installation_id BIGINT PRIMARY KEY CHECK(installation_id>0),
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 account_id BIGINT NOT NULL, account_login TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('active','suspended','removed','auth_required')),
 generation BIGINT NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_github_repositories (
 organization_id UUID NOT NULL, repository_id UUID NOT NULL, full_name TEXT NOT NULL,
 node_id TEXT NOT NULL, default_branch TEXT, observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,repository_id),
 FOREIGN KEY(organization_id,repository_id) REFERENCES team_repository_scopes(organization_id,repository_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS team_member_project_bindings (
 organization_id UUID NOT NULL, user_id UUID NOT NULL, project_id UUID NOT NULL,
 repository_id UUID NOT NULL, confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,user_id,project_id),
 FOREIGN KEY(organization_id,user_id) REFERENCES organization_members(organization_id,user_id) ON DELETE CASCADE,
 FOREIGN KEY(organization_id,repository_id) REFERENCES team_repository_scopes(organization_id,repository_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS team_session_contexts (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 event_id TEXT NOT NULL, payload_hash TEXT NOT NULL, session_id TEXT NOT NULL,
 collector_id UUID NOT NULL, project_id UUID NOT NULL, repository_id UUID NOT NULL,
 occurred_at TIMESTAMPTZ NOT NULL, branch TEXT, commit_sha TEXT, provenance TEXT NOT NULL,
 received_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(user_id,event_id),
 FOREIGN KEY(organization_id,repository_id) REFERENCES team_repository_scopes(organization_id,repository_id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS team_github_sync_jobs (
 id UUID PRIMARY KEY, installation_id BIGINT NOT NULL REFERENCES team_github_installations(installation_id) ON DELETE CASCADE,
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 repository_id UUID, generation BIGINT NOT NULL, kind TEXT NOT NULL,
 checkpoint JSONB NOT NULL DEFAULT '{}', attempts INTEGER NOT NULL DEFAULT 0,
 retry_at TIMESTAMPTZ NOT NULL DEFAULT now(), lease_token UUID, lease_until TIMESTAMPTZ,
 completed_at TIMESTAMPTZ, dead_letter_at TIMESTAMPTZ, error_code TEXT,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_github_ready_jobs ON team_github_sync_jobs(retry_at) WHERE completed_at IS NULL AND dead_letter_at IS NULL;
ALTER TABLE team_github_sync_jobs ADD COLUMN IF NOT EXISTS target_key TEXT NOT NULL DEFAULT 'repository';
CREATE UNIQUE INDEX IF NOT EXISTS team_github_active_target ON team_github_sync_jobs(installation_id,repository_id,generation,kind,target_key) WHERE completed_at IS NULL AND dead_letter_at IS NULL;
CREATE TABLE IF NOT EXISTS team_github_checkpoints (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 installation_id BIGINT NOT NULL, repository_id UUID NOT NULL, last_success_at TIMESTAMPTZ,
 sweep_at TIMESTAMPTZ, coverage TEXT NOT NULL DEFAULT 'initial_sync', error_code TEXT,
 PRIMARY KEY(organization_id,repository_id)
);
CREATE TABLE IF NOT EXISTS team_github_facts (
 organization_id UUID NOT NULL, repository_id UUID NOT NULL, kind TEXT NOT NULL,
 external_id TEXT NOT NULL, work_item_id BIGINT, occurred_at TIMESTAMPTZ NOT NULL,
 metadata JSONB NOT NULL, observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 PRIMARY KEY(organization_id,repository_id,kind,external_id),
 FOREIGN KEY(organization_id,repository_id) REFERENCES team_repository_scopes(organization_id,repository_id) ON DELETE CASCADE
);
ALTER TABLE team_work_items ADD COLUMN IF NOT EXISTS head_sha TEXT;
ALTER TABLE team_work_items ADD COLUMN IF NOT EXISTS head_repository_id BIGINT;
ALTER TABLE team_work_items ADD COLUMN IF NOT EXISTS draft BOOLEAN;
ALTER TABLE team_work_items ADD COLUMN IF NOT EXISTS lifecycle_coverage TEXT NOT NULL DEFAULT 'unconfirmed';
-- Changing scope/identity is a privacy change; a successful polling tick is not.
DROP TRIGGER IF EXISTS team_member_project_changed ON team_member_project_bindings;
CREATE TRIGGER team_member_project_changed AFTER INSERT OR UPDATE OR DELETE ON team_member_project_bindings
 FOR EACH ROW EXECUTE FUNCTION team_scope_changed();
ALTER TABLE team_github_installations ADD COLUMN IF NOT EXISTS lease_token UUID;
ALTER TABLE team_github_installations ADD COLUMN IF NOT EXISTS lease_until TIMESTAMPTZ;
CREATE TABLE IF NOT EXISTS team_github_delivery_recovery (
 delivery_id BIGINT PRIMARY KEY, installation_id BIGINT NOT NULL, delivery_guid TEXT NOT NULL,
 delivered_at TIMESTAMPTZ NOT NULL, retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 attempts INTEGER NOT NULL DEFAULT 0, requested_at TIMESTAMPTZ, error_code TEXT
);
CREATE TABLE IF NOT EXISTS team_github_app_checkpoint (
 app_id TEXT PRIMARY KEY, next_url TEXT, last_success_at TIMESTAMPTZ,
 retry_at TIMESTAMPTZ NOT NULL DEFAULT now(), lease_token UUID, lease_until TIMESTAMPTZ, error_code TEXT
);
ALTER TABLE team_github_repositories ADD COLUMN IF NOT EXISTS metadata_etag TEXT;
ALTER TABLE team_github_delivery_recovery ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;
COMMIT;
