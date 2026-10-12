BEGIN;
-- Additive, metadata-only. UTC provider windows never change the organization policy.
ALTER TABLE team_copilot_daily_facts ADD COLUMN IF NOT EXISTS github_user_id BIGINT;
ALTER TABLE team_copilot_daily_facts ADD COLUMN IF NOT EXISTS provider_account_id BIGINT;
CREATE TABLE IF NOT EXISTS team_copilot_day_manifests (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 day DATE NOT NULL, revision BIGINT NOT NULL CHECK(revision>0), fingerprint TEXT NOT NULL,
 observed_at TIMESTAMPTZ NOT NULL DEFAULT now(), disposition TEXT NOT NULL,
 PRIMARY KEY(organization_id,day)
);
CREATE TABLE IF NOT EXISTS team_copilot_report_policies (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 timezone TEXT NOT NULL DEFAULT 'UTC' CHECK(timezone='UTC'), locked_at TIMESTAMPTZ
);
ALTER TABLE team_weekly_publications ADD COLUMN IF NOT EXISTS report_family TEXT;
ALTER TABLE team_weekly_publications ADD COLUMN IF NOT EXISTS window_start TIMESTAMPTZ;
ALTER TABLE team_weekly_publications ADD COLUMN IF NOT EXISTS window_end TIMESTAMPTZ;
ALTER TABLE team_weekly_publications ADD COLUMN IF NOT EXISTS calculation_version TEXT;
ALTER TABLE team_weekly_publications ADD COLUMN IF NOT EXISTS source_revisions JSONB;
ALTER TABLE team_weekly_publications ADD COLUMN IF NOT EXISTS projection JSONB;
CREATE TABLE IF NOT EXISTS team_copilot_membership_intervals (
 id BIGSERIAL PRIMARY KEY, organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, team_id UUID,
 valid_from TIMESTAMPTZ NOT NULL, valid_to TIMESTAMPTZ,
 CHECK(valid_to IS NULL OR valid_to>=valid_from)
);
CREATE UNIQUE INDEX IF NOT EXISTS team_copilot_org_open_membership ON team_copilot_membership_intervals(organization_id,user_id) WHERE valid_to IS NULL AND team_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS team_copilot_team_open_membership ON team_copilot_membership_intervals(organization_id,user_id,team_id) WHERE valid_to IS NULL AND team_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS team_copilot_membership_lookup ON team_copilot_membership_intervals(organization_id,user_id,valid_from);
-- Existing roster proves membership now, not an uninterrupted historical interval.
-- Seed once only; repeated migration must not resurrect a closed/deleted interval.
INSERT INTO team_copilot_membership_intervals(organization_id,user_id,valid_from)
 SELECT m.organization_id,m.user_id,now() FROM organization_members m
 WHERE m.deactivated_at IS NULL AND m.seat_type='developer' AND m.role<>'viewer'
 AND NOT EXISTS(SELECT 1 FROM team_copilot_membership_intervals h WHERE h.organization_id=m.organization_id AND h.user_id=m.user_id AND h.team_id IS NULL);
INSERT INTO team_copilot_membership_intervals(organization_id,user_id,team_id,valid_from)
 SELECT t.organization_id,m.user_id,m.team_id,now() FROM team_members m JOIN teams t ON t.id=m.team_id
 AND NOT EXISTS(SELECT 1 FROM team_copilot_membership_intervals h WHERE h.organization_id=t.organization_id AND h.user_id=m.user_id AND h.team_id=m.team_id);
CREATE OR REPLACE FUNCTION team_copilot_membership_observed() RETURNS TRIGGER AS $$
DECLARE org UUID; person UUID; scope UUID; eligible BOOLEAN;
BEGIN
 IF TG_TABLE_NAME='organization_members' THEN
  IF TG_OP='UPDATE' AND (OLD.organization_id,OLD.user_id,OLD.deactivated_at,OLD.seat_type,OLD.role) IS NOT DISTINCT FROM (NEW.organization_id,NEW.user_id,NEW.deactivated_at,NEW.seat_type,NEW.role) THEN RETURN NEW; END IF;
  org:=CASE WHEN TG_OP='DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  person:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  scope:=NULL;
  eligible:=TG_OP<>'DELETE';
  IF eligible THEN eligible:=NEW.deactivated_at IS NULL AND NEW.seat_type='developer' AND NEW.role<>'viewer'; END IF;
 ELSE
  scope:=CASE WHEN TG_OP='DELETE' THEN OLD.team_id ELSE NEW.team_id END;
  person:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  SELECT organization_id INTO org FROM teams WHERE id=scope;
  eligible:=TG_OP<>'DELETE';
 END IF;
 IF org IS NULL THEN RETURN NULL; END IF;
 -- Same publication authority; roster changes are already generation-triggered.
 PERFORM generation FROM team_rollouts WHERE organization_id=org FOR UPDATE;
 UPDATE team_copilot_membership_intervals SET valid_to=now() WHERE organization_id=org AND user_id=person AND team_id IS NOT DISTINCT FROM scope AND valid_to IS NULL;
 IF eligible THEN INSERT INTO team_copilot_membership_intervals(organization_id,user_id,team_id,valid_from) VALUES(org,person,scope,now()); END IF;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_copilot_membership_observed ON organization_members;
CREATE TRIGGER team_copilot_membership_observed AFTER INSERT OR UPDATE OR DELETE ON organization_members FOR EACH ROW EXECUTE FUNCTION team_copilot_membership_observed();
DROP TRIGGER IF EXISTS team_copilot_membership_observed ON team_members;
CREATE TRIGGER team_copilot_membership_observed AFTER INSERT OR DELETE ON team_members FOR EACH ROW EXECUTE FUNCTION team_copilot_membership_observed();
CREATE OR REPLACE FUNCTION team_copilot_config_changed() RETURNS TRIGGER AS $$
BEGIN
 IF TG_OP='DELETE' THEN PERFORM team_bump_generation(OLD.organization_id);
 ELSIF TG_OP='INSERT' THEN PERFORM team_bump_generation(NEW.organization_id);
 ELSIF (OLD.installation_id,OLD.start_day,OLD.enabled) IS DISTINCT FROM (NEW.installation_id,NEW.start_day,NEW.enabled) THEN PERFORM team_bump_generation(NEW.organization_id); END IF;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_copilot_config_changed ON team_copilot_daily_integrations;
CREATE TRIGGER team_copilot_config_changed AFTER INSERT OR UPDATE OR DELETE ON team_copilot_daily_integrations FOR EACH ROW EXECUTE FUNCTION team_copilot_config_changed();

-- Provider identity and installation changes are durable privacy changes, not only read fences.
CREATE OR REPLACE FUNCTION team_copilot_identity_changed() RETURNS TRIGGER AS $$
DECLARE org UUID;
BEGIN
 IF TG_OP='UPDATE' AND (OLD.github_user_id,OLD.verified_at,OLD.revoked_at) IS NOT DISTINCT FROM (NEW.github_user_id,NEW.verified_at,NEW.revoked_at) THEN RETURN NULL; END IF;
 FOR org IN SELECT organization_id FROM organization_members WHERE user_id=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END LOOP
  PERFORM team_bump_generation(org);
 END LOOP;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_copilot_identity_changed ON team_github_identities;
CREATE TRIGGER team_copilot_identity_changed AFTER INSERT OR UPDATE OR DELETE ON team_github_identities FOR EACH ROW EXECUTE FUNCTION team_copilot_identity_changed();
CREATE OR REPLACE FUNCTION team_copilot_installation_changed() RETURNS TRIGGER AS $$
BEGIN
 IF TG_OP='UPDATE' AND (OLD.account_id,OLD.organization_id,OLD.status,OLD.generation) IS NOT DISTINCT FROM (NEW.account_id,NEW.organization_id,NEW.status,NEW.generation) THEN RETURN NULL; END IF;
 IF TG_OP='DELETE' THEN PERFORM team_bump_generation(OLD.organization_id);
 ELSE PERFORM team_bump_generation(NEW.organization_id); END IF;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_copilot_installation_changed ON team_github_installations;
CREATE TRIGGER team_copilot_installation_changed AFTER INSERT OR UPDATE OR DELETE ON team_github_installations FOR EACH ROW EXECUTE FUNCTION team_copilot_installation_changed();
CREATE OR REPLACE FUNCTION team_copilot_user_privacy_changed() RETURNS TRIGGER AS $$
DECLARE org UUID;
BEGIN
 IF TG_OP='UPDATE' AND (OLD.is_active,OLD.deleted_at) IS NOT DISTINCT FROM (NEW.is_active,NEW.deleted_at) THEN RETURN NEW; END IF;
 FOR org IN SELECT organization_id FROM organization_members WHERE user_id=OLD.id LOOP PERFORM team_bump_generation(org); END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_copilot_user_privacy_changed ON users;
CREATE TRIGGER team_copilot_user_privacy_changed BEFORE UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION team_copilot_user_privacy_changed();
-- Derived numeric snapshots close immediately on privacy change. Keep only
-- minimal contributor/fact publication barriers for independent restore proof.
CREATE OR REPLACE FUNCTION team_bump_generation(org UUID) RETURNS VOID AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM organizations WHERE id=org) THEN RETURN; END IF;
 INSERT INTO team_rollouts(organization_id,generation) VALUES(org,1)
 ON CONFLICT(organization_id) DO UPDATE SET generation=team_rollouts.generation+1,updated_at=now();
 UPDATE team_weekly_publications SET invalidated_at=COALESCE(invalidated_at,now()),projection=NULL WHERE organization_id=org;
 INSERT INTO team_cleanup_jobs(organization_id) VALUES(org) ON CONFLICT(organization_id)
 DO UPDATE SET phase=0,completed_at=NULL,retry_at=now();
 DELETE FROM team_restore_checkpoints WHERE organization_id=org;
END;
$$ LANGUAGE plpgsql;
-- Ledger access schema changes close old publications once. Old heads can then
-- advance monotonically; repeated migrations do not bump generations again.
CREATE TABLE IF NOT EXISTS team_copilot_schema_versions (version INTEGER PRIMARY KEY);
DO $$
DECLARE org UUID;
BEGIN
 INSERT INTO team_copilot_schema_versions(version) VALUES(1) ON CONFLICT DO NOTHING;
 IF FOUND THEN FOR org IN SELECT organization_id FROM team_rollouts LOOP PERFORM team_bump_generation(org); END LOOP; END IF;
END;
$$;
COMMIT;
