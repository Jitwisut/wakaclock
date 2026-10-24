BEGIN;
-- Operational cost dependencies use a monotonic revision, independently of
-- analytics privacy generation. Normal workflow edits must not invalidate every week.
CREATE TABLE IF NOT EXISTS team_cost_source_revisions (
 organization_id UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
 revision BIGINT NOT NULL DEFAULT 0 CHECK(revision>=0)
);
INSERT INTO team_cost_source_revisions(organization_id)
 SELECT id FROM organizations ON CONFLICT DO NOTHING;
CREATE OR REPLACE FUNCTION team_advance_cost_source(org UUID) RETURNS VOID AS $$
DECLARE v BIGINT;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM organizations WHERE id=org) THEN RETURN; END IF;
 INSERT INTO team_cost_source_revisions(organization_id,revision) VALUES(org,1)
 ON CONFLICT(organization_id) DO UPDATE SET revision=team_cost_source_revisions.revision+1
 RETURNING revision INTO v;
 INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at)
 VALUES('team_cost_source',org::text||':'||v::text,
   encode(sha256(convert_to(org::text||':'||v::text,'UTF8')),'hex'),'cost_source_advanced',now())
 ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;
CREATE OR REPLACE FUNCTION team_cost_source_changed() RETURNS TRIGGER AS $$
DECLARE org UUID; current_org UUID; person UUID; session TEXT; old_person UUID; old_session TEXT; previous_org UUID;
BEGIN
 IF TG_OP='UPDATE' AND OLD IS NOT DISTINCT FROM NEW THEN RETURN NULL; END IF;
 IF TG_TABLE_NAME='team_work_items' THEN
  IF TG_OP='UPDATE' THEN
   IF (OLD.organization_id,OLD.repository_id,OLD.external_id,OLD.kind,OLD.merged_at) IS NOT DISTINCT FROM
      (NEW.organization_id,NEW.repository_id,NEW.external_id,NEW.kind,NEW.merged_at) THEN RETURN NULL; END IF;
  END IF;
 END IF;
 IF TG_TABLE_NAME='team_session_links' THEN
  person:=CASE WHEN TG_OP='DELETE' THEN OLD.user_id ELSE NEW.user_id END;
  session:=CASE WHEN TG_OP='DELETE' THEN OLD.session_id ELSE NEW.session_id END;
  IF TG_OP='UPDATE' THEN old_person:=OLD.user_id; old_session:=OLD.session_id; previous_org:=OLD.organization_id; END IF;
  -- Unique allocation is global. A link in another organization changes the
  -- target count of all surviving links for this user/session, not just its org.
  FOR org IN SELECT id FROM organizations WHERE id IN (
    SELECT organization_id FROM team_session_links WHERE
     (user_id=person AND session_id=session) OR (user_id=old_person AND session_id=old_session)
    UNION SELECT CASE WHEN TG_OP='DELETE' THEN OLD.organization_id ELSE NEW.organization_id END
    UNION SELECT previous_org WHERE previous_org IS NOT NULL
  ) ORDER BY id LOOP PERFORM team_advance_cost_source(org); END LOOP;
 ELSE
  current_org:=CASE WHEN TG_OP='DELETE' THEN OLD.organization_id ELSE NEW.organization_id END;
  IF TG_OP='UPDATE' THEN previous_org:=OLD.organization_id; END IF;
  FOR org IN SELECT id FROM organizations WHERE id IN(current_org,previous_org) ORDER BY id LOOP
   PERFORM team_advance_cost_source(org);
  END LOOP;
 END IF;
 RETURN NULL;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_cost_source_changed ON team_work_items;
CREATE TRIGGER team_cost_source_changed AFTER INSERT OR UPDATE OR DELETE ON team_work_items
 FOR EACH ROW EXECUTE FUNCTION team_cost_source_changed();
DROP TRIGGER IF EXISTS team_cost_source_changed ON team_session_links;
CREATE TRIGGER team_cost_source_changed AFTER INSERT OR UPDATE OR DELETE ON team_session_links
 FOR EACH ROW EXECUTE FUNCTION team_cost_source_changed();
DROP TRIGGER IF EXISTS team_cost_source_changed ON team_repository_scopes;
CREATE TRIGGER team_cost_source_changed AFTER INSERT OR UPDATE OR DELETE ON team_repository_scopes
 FOR EACH ROW EXECUTE FUNCTION team_cost_source_changed();
DROP TRIGGER IF EXISTS team_cost_source_changed ON team_member_project_bindings;
CREATE TRIGGER team_cost_source_changed AFTER INSERT OR UPDATE OR DELETE ON team_member_project_bindings
 FOR EACH ROW EXECUTE FUNCTION team_cost_source_changed();
COMMIT;
