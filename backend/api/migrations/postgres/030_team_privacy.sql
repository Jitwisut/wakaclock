-- Team is opt-in per organization. Never migrate private history into a shared ledger.
BEGIN;
CREATE TABLE IF NOT EXISTS team_rollouts (
    organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    generation BIGINT NOT NULL DEFAULT 0 CHECK (generation >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE organization_analytics_consents
    ADD COLUMN IF NOT EXISTS consent_version BIGINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS aggregate_from TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS individual_from TIMESTAMPTZ;
-- Existing opt-ins have no recorded effective time. Start at migration, never backfill.
UPDATE organization_analytics_consents SET aggregate_from = now()
 WHERE share_aggregate AND aggregate_from IS NULL;
UPDATE organization_analytics_consents SET individual_from = now()
 WHERE share_individual AND individual_from IS NULL;

CREATE TABLE IF NOT EXISTS team_consent_history (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    version BIGINT NOT NULL,
    share_aggregate BOOLEAN NOT NULL,
    share_individual BOOLEAN NOT NULL,
    effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, user_id, version)
);

CREATE OR REPLACE FUNCTION team_bump_generation(org UUID) RETURNS VOID AS $$
BEGIN
    -- Organization hard deletion cascades membership triggers. Do not recreate
    -- a generation row pointing at the organization being deleted.
    IF NOT EXISTS (SELECT 1 FROM organizations WHERE id = org) THEN RETURN; END IF;
    INSERT INTO team_rollouts (organization_id, generation) VALUES (org, 1)
    ON CONFLICT (organization_id) DO UPDATE
      SET generation = team_rollouts.generation + 1, updated_at = now();
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION team_record_consent() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.share_aggregate = NEW.share_aggregate
       AND OLD.share_individual = NEW.share_individual THEN
        NEW.consent_version := OLD.consent_version;
        NEW.aggregate_from := OLD.aggregate_from;
        NEW.individual_from := OLD.individual_from;
        RETURN NEW;
    END IF;
    NEW.consent_version := CASE WHEN TG_OP = 'UPDATE' THEN OLD.consent_version + 1 ELSE 1 END;
    NEW.aggregate_from := CASE WHEN NOT NEW.share_aggregate THEN NULL
      WHEN TG_OP = 'UPDATE' AND OLD.share_aggregate THEN OLD.aggregate_from ELSE now() END;
    NEW.individual_from := CASE WHEN NOT NEW.share_individual THEN NULL
      WHEN TG_OP = 'UPDATE' AND OLD.share_individual THEN OLD.individual_from ELSE now() END;
    NEW.updated_at := now();
    INSERT INTO team_consent_history
      (organization_id, user_id, version, share_aggregate, share_individual)
      VALUES (NEW.organization_id, NEW.user_id, NEW.consent_version,
        NEW.share_aggregate, NEW.share_individual);
    PERFORM team_bump_generation(NEW.organization_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_consent_changed ON organization_analytics_consents;
CREATE TRIGGER team_consent_changed BEFORE INSERT OR UPDATE
 ON organization_analytics_consents FOR EACH ROW EXECUTE FUNCTION team_record_consent();

-- Rejoining is a fresh opt-in. Membership removal cannot leave consent dormant.
CREATE OR REPLACE FUNCTION team_membership_changed() RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        PERFORM team_bump_generation(OLD.organization_id);
        RETURN OLD;
    END IF;
    IF TG_OP = 'UPDATE' AND (NEW.deactivated_at IS DISTINCT FROM OLD.deactivated_at
       OR NEW.seat_type IS DISTINCT FROM OLD.seat_type
       OR (NEW.role IS DISTINCT FROM OLD.role AND (NEW.role = 'viewer' OR OLD.role = 'viewer'))) THEN
        UPDATE organization_analytics_consents SET share_aggregate = FALSE,
          share_individual = FALSE WHERE organization_id = NEW.organization_id
          AND user_id = NEW.user_id;
    END IF;
    PERFORM team_bump_generation(NEW.organization_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_membership_changed ON organization_members;
CREATE TRIGGER team_membership_changed AFTER INSERT OR UPDATE OR DELETE
 ON organization_members FOR EACH ROW EXECUTE FUNCTION team_membership_changed();

CREATE UNIQUE INDEX IF NOT EXISTS teams_tenant_identity_idx ON teams(organization_id, id);
CREATE TABLE IF NOT EXISTS team_repository_scopes (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    repository_id UUID NOT NULL,
    github_repository_id BIGINT NOT NULL CHECK (github_repository_id > 0),
    github_installation_id BIGINT NOT NULL CHECK (github_installation_id > 0),
    project_id UUID NOT NULL,
    team_id UUID,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (organization_id, repository_id),
    UNIQUE (organization_id, github_repository_id),
    UNIQUE (organization_id, project_id),
    FOREIGN KEY (organization_id, team_id) REFERENCES teams(organization_id, id) ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION team_scope_changed() RETURNS TRIGGER AS $$
DECLARE org UUID;
BEGIN
    IF TG_TABLE_NAME = 'team_members' THEN
        SELECT organization_id INTO org FROM teams WHERE id =
          CASE WHEN TG_OP = 'DELETE' THEN OLD.team_id ELSE NEW.team_id END;
    ELSE
        org := CASE WHEN TG_OP = 'DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
    END IF;
    IF org IS NOT NULL THEN PERFORM team_bump_generation(org); END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_roster_changed ON team_members;
CREATE TRIGGER team_roster_changed AFTER INSERT OR UPDATE OR DELETE
 ON team_members FOR EACH ROW EXECUTE FUNCTION team_scope_changed();
DROP TRIGGER IF EXISTS team_repo_scope_changed ON team_repository_scopes;
CREATE TRIGGER team_repo_scope_changed AFTER INSERT OR UPDATE OR DELETE
 ON team_repository_scopes FOR EACH ROW EXECUTE FUNCTION team_scope_changed();

CREATE TABLE IF NOT EXISTS team_work_items (
    organization_id UUID NOT NULL,
    repository_id UUID NOT NULL,
    external_id BIGINT NOT NULL CHECK (external_id > 0),
    kind TEXT NOT NULL CHECK (kind IN ('pull_request', 'issue')),
    number INTEGER NOT NULL CHECK (number > 0),
    state TEXT NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
    head_branch TEXT,
    author_github_id BIGINT,
    opened_at TIMESTAMPTZ NOT NULL,
    ready_at TIMESTAMPTZ,
    first_review_at TIMESTAMPTZ,
    merged_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    provider_updated_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, repository_id, external_id),
    FOREIGN KEY (organization_id, repository_id)
      REFERENCES team_repository_scopes(organization_id, repository_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS team_session_links (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    repository_id UUID NOT NULL,
    work_item_id BIGINT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id TEXT NOT NULL CHECK (session_id ~ '^[0-9a-f]{64}$'),
    status TEXT NOT NULL CHECK (status IN ('proposed', 'confirmed', 'rejected', 'withdrawn')),
    evidence TEXT NOT NULL CHECK (evidence IN ('repository_branch', 'owner_confirmation')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (organization_id, repository_id, work_item_id)
      REFERENCES team_work_items(organization_id, repository_id, external_id) ON DELETE CASCADE,
    UNIQUE (organization_id, user_id, session_id, repository_id, work_item_id)
);
CREATE TABLE IF NOT EXISTS team_link_history (
    id UUID PRIMARY KEY,
    link_id UUID NOT NULL REFERENCES team_session_links(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    status TEXT NOT NULL,
    changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Allocation stores identity, not a cost copy. Corrections remain canonical in ClickHouse.
CREATE TABLE IF NOT EXISTS team_usage_allocations (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    usage_identity TEXT NOT NULL CHECK (usage_identity ~ '^[0-9a-f]{64}$'),
    link_id UUID NOT NULL REFERENCES team_session_links(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, usage_identity)
);

CREATE TABLE IF NOT EXISTS team_webhook_inbox (
    provider TEXT NOT NULL CHECK (provider IN ('github', 'stripe')),
    delivery_id TEXT NOT NULL CHECK (length(delivery_id) BETWEEN 1 AND 200),
    payload_hash TEXT NOT NULL,
    metadata JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts INTEGER NOT NULL DEFAULT 0,
    lease_token UUID,
    lease_until TIMESTAMPTZ,
    processed_at TIMESTAMPTZ,
    error_code TEXT,
    dead_letter_at TIMESTAMPTZ,
    PRIMARY KEY (provider, delivery_id)
);
CREATE INDEX IF NOT EXISTS team_webhook_ready_idx ON team_webhook_inbox(retry_at)
 WHERE processed_at IS NULL AND dead_letter_at IS NULL;

CREATE TABLE IF NOT EXISTS team_release_evidence (
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    gate TEXT NOT NULL,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    evidence_ref TEXT NOT NULL,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (organization_id, gate)
);

COMMIT;
