BEGIN;
CREATE TABLE IF NOT EXISTS team_report_policies (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 timezone TEXT NOT NULL DEFAULT 'Asia/Bangkok', locked_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS team_weekly_publications (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 week_start DATE NOT NULL, view_key TEXT NOT NULL, generation BIGINT NOT NULL,
 fingerprint TEXT NOT NULL, contributors UUID[] NOT NULL,
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), invalidated_at TIMESTAMPTZ,
 PRIMARY KEY(organization_id, week_start, view_key)
);
CREATE TABLE IF NOT EXISTS team_webhook_dispositions (
 provider TEXT NOT NULL, delivery_id TEXT NOT NULL, payload_hash TEXT NOT NULL,
 reason TEXT NOT NULL, disposed_at TIMESTAMPTZ NOT NULL,
 PRIMARY KEY(provider,delivery_id)
);
CREATE TABLE IF NOT EXISTS team_privacy_markers (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 retention_before TIMESTAMPTZ, changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS team_cleanup_jobs (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 cutoff TIMESTAMPTZ, phase INTEGER NOT NULL DEFAULT 0, lease_token UUID, lease_until TIMESTAMPTZ,
 attempts INTEGER NOT NULL DEFAULT 0, retry_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 completed_at TIMESTAMPTZ, error_code TEXT
);
-- Keep one durable registry independent of the data copied into a backup. Never expire
-- privacy markers until the operator can prove all older backup copies have expired.
CREATE TABLE IF NOT EXISTS team_restore_checkpoints (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 ledger_hash TEXT NOT NULL, verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION team_bump_generation(org UUID) RETURNS VOID AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM organizations WHERE id=org) THEN RETURN; END IF;
 INSERT INTO team_rollouts(organization_id,generation) VALUES(org,1)
 ON CONFLICT(organization_id) DO UPDATE SET generation=team_rollouts.generation+1, updated_at=now();
 UPDATE team_weekly_publications SET invalidated_at=COALESCE(invalidated_at,now()) WHERE organization_id=org;
 INSERT INTO team_cleanup_jobs(organization_id) VALUES(org) ON CONFLICT(organization_id)
 DO UPDATE SET phase=0, completed_at=NULL, retry_at=now();
 DELETE FROM team_restore_checkpoints WHERE organization_id=org;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION team_policy_locked() RETURNS TRIGGER AS $$
BEGIN
 IF OLD.locked_at IS NOT NULL AND NEW.timezone IS DISTINCT FROM OLD.timezone THEN
  RAISE EXCEPTION 'Team report timezone is locked';
 END IF;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_policy_locked ON team_report_policies;
CREATE TRIGGER team_policy_locked BEFORE UPDATE ON team_report_policies FOR EACH ROW EXECUTE FUNCTION team_policy_locked();
CREATE OR REPLACE FUNCTION team_record_consent() RETURNS TRIGGER AS $$
BEGIN
    -- ON CONFLICT runs BEFORE INSERT before its UPDATE arm. Do not record a phantom version.
    IF TG_OP = 'INSERT' AND EXISTS (SELECT 1 FROM organization_analytics_consents
       WHERE organization_id=NEW.organization_id AND user_id=NEW.user_id) THEN RETURN NEW; END IF;
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
CREATE TABLE IF NOT EXISTS team_store_cleanup (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 generation BIGINT, cutoff TIMESTAMPTZ, completed_at TIMESTAMPTZ,
 lease_token UUID, lease_until TIMESTAMPTZ, error_code TEXT
);
ALTER TABLE team_release_evidence ADD COLUMN IF NOT EXISTS evidence_scope TEXT NOT NULL DEFAULT 'external';
ALTER TABLE team_release_evidence ADD COLUMN IF NOT EXISTS build TEXT;
COMMIT;
