BEGIN;
CREATE TABLE IF NOT EXISTS team_improvement_actions (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 id UUID NOT NULL, team_id UUID REFERENCES teams(id), owner_id UUID NOT NULL REFERENCES users(id),
 title TEXT NOT NULL CHECK(length(title) BETWEEN 1 AND 160),
 focus TEXT NOT NULL CHECK(focus IN ('review_flow','tool_evaluation','measurement_coverage','delivery_reliability','work_linking')),
 family TEXT NOT NULL CHECK(family IN ('team_cost','copilot')),
 baseline_week DATE NOT NULL, followup_week DATE NOT NULL CHECK(followup_week>baseline_week),
 timezone TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('planned','active','completed','cancelled')),
 created_by UUID NOT NULL REFERENCES users(id), changed_by UUID NOT NULL REFERENCES users(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 revision BIGINT NOT NULL DEFAULT 1, state_hash TEXT NOT NULL DEFAULT '',
 request_id UUID NOT NULL, request_hash TEXT NOT NULL,
 deleted BOOLEAN NOT NULL DEFAULT FALSE, blocked BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(organization_id,id)
);
CREATE TABLE IF NOT EXISTS team_improvement_action_history (
 organization_id UUID NOT NULL, action_id UUID NOT NULL, revision BIGINT NOT NULL,
 changed_at TIMESTAMPTZ NOT NULL, changed_by UUID NOT NULL, request_id UUID NOT NULL,
 request_hash TEXT NOT NULL, snapshot JSONB NOT NULL,
 PRIMARY KEY(organization_id,action_id,revision), UNIQUE(organization_id,request_id)
);
CREATE INDEX IF NOT EXISTS team_actions_scope ON team_improvement_actions(organization_id,team_id,id);
CREATE OR REPLACE FUNCTION team_action_hash(a team_improvement_actions) RETURNS TEXT AS $$
 SELECT encode(sha256(convert_to(((to_jsonb(a)-'state_hash'-'created_at'-'updated_at')||
  jsonb_build_object('created_at',to_char(a.created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US'),
   'updated_at',to_char(a.updated_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US')))::text,'UTF8')),'hex');
$$ LANGUAGE SQL STABLE;
CREATE OR REPLACE FUNCTION team_action_revision() RETURNS TRIGGER AS $$
DECLARE head BIGINT; why TEXT; terminal BOOLEAN;
BEGIN
 SELECT COALESCE(max(split_part(delivery_id,':',3)::bigint),0),COALESCE(bool_or(reason IN ('action_deleted','action_retention_expired')),FALSE)
 INTO head,terminal FROM team_webhook_dispositions WHERE provider='team_improvement_action'
 AND split_part(delivery_id,':',1)=NEW.organization_id::text AND split_part(delivery_id,':',2)=NEW.id::text;
 IF terminal THEN RAISE EXCEPTION 'action identity permanently closed'; END IF;
 IF TG_OP='UPDATE' THEN
  IF NEW.organization_id<>OLD.organization_id OR NEW.id<>OLD.id OR NEW.team_id IS DISTINCT FROM OLD.team_id
   OR NEW.created_at<>OLD.created_at OR NEW.created_by<>OLD.created_by THEN RAISE EXCEPTION 'action scope immutable'; END IF;
  IF OLD.deleted OR OLD.blocked THEN RAISE EXCEPTION 'action closed'; END IF;
  NEW.revision:=GREATEST(OLD.revision,head)+1;
 ELSE
  IF head>0 THEN RAISE EXCEPTION 'action identity already recorded'; END IF;
  NEW.revision:=1;
 END IF;
 NEW.updated_at:=now();
 NEW.state_hash:=team_action_hash(NEW);
 why:=CASE WHEN NEW.deleted THEN 'action_deleted' WHEN NEW.blocked THEN 'action_restore_blocked' ELSE 'action_revision' END;
 INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at)
 VALUES('team_improvement_action',NEW.organization_id::text||':'||NEW.id::text||':'||NEW.revision::text,NEW.state_hash,why,NEW.updated_at);
 INSERT INTO team_improvement_action_history(organization_id,action_id,revision,changed_at,changed_by,request_id,request_hash,snapshot)
 VALUES(NEW.organization_id,NEW.id,NEW.revision,NEW.updated_at,NEW.changed_by,NEW.request_id,NEW.request_hash,to_jsonb(NEW));
 INSERT INTO team_action_account_proof_requirements(account_id)
 SELECT person FROM unnest(ARRAY[NEW.owner_id,NEW.created_by,NEW.changed_by]) person ON CONFLICT DO NOTHING;
 INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at)
 SELECT 'team_action_participant',person::text||':'||NEW.organization_id::text||':'||NEW.id::text,
  encode(sha256(convert_to(person::text||':'||NEW.organization_id::text||':'||NEW.id::text,'UTF8')),'hex'),'workflow_participant',now()
 FROM unnest(ARRAY[NEW.owner_id,NEW.created_by,NEW.changed_by]) person ON CONFLICT DO NOTHING;
 RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_action_revision ON team_improvement_actions;
CREATE TRIGGER team_action_revision BEFORE INSERT OR UPDATE ON team_improvement_actions
 FOR EACH ROW EXECUTE FUNCTION team_action_revision();
-- Hard account deletion must not be blocked by an action reassigned to another
-- member. Atomically close every affected identity, including historical actors,
-- before removing its metadata and the user's FK references.
CREATE OR REPLACE FUNCTION team_actions_delete_account() RETURNS TRIGGER AS $$
DECLARE a RECORD; head BIGINT;
BEGIN
 PERFORM pg_advisory_xact_lock(74103031);
 FOR a IN SELECT organization_id,id FROM (
  SELECT x.organization_id,x.id FROM team_improvement_actions x WHERE
   x.owner_id=OLD.id OR x.created_by=OLD.id OR x.changed_by=OLD.id OR EXISTS(
    SELECT 1 FROM team_improvement_action_history h WHERE h.organization_id=x.organization_id AND h.action_id=x.id
     AND (h.changed_by=OLD.id OR h.snapshot->>'owner_id'=OLD.id::text OR h.snapshot->>'created_by'=OLD.id::text OR h.snapshot->>'changed_by'=OLD.id::text))
  UNION SELECT split_part(delivery_id,':',2)::uuid,split_part(delivery_id,':',3)::uuid
   FROM team_webhook_dispositions WHERE provider='team_action_participant' AND split_part(delivery_id,':',1)=OLD.id::text
 ) affected ORDER BY organization_id,id LOOP
  IF NOT EXISTS(SELECT 1 FROM team_webhook_dispositions d WHERE d.provider='team_improvement_action'
    AND split_part(d.delivery_id,':',1)=a.organization_id::text AND split_part(d.delivery_id,':',2)=a.id::text AND d.reason IN ('action_deleted','action_retention_expired')) THEN
   SELECT COALESCE(max(split_part(delivery_id,':',3)::bigint),0)+1 INTO head FROM team_webhook_dispositions
    WHERE provider='team_improvement_action' AND split_part(delivery_id,':',1)=a.organization_id::text AND split_part(delivery_id,':',2)=a.id::text;
   INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at)
    VALUES('team_improvement_action',a.organization_id::text||':'||a.id::text||':'||head::text,
     encode(sha256(convert_to(a.organization_id::text||':'||a.id::text||':account_removed','UTF8')),'hex'),'action_deleted',now());
  END IF;
  DELETE FROM team_improvement_action_history WHERE organization_id=a.organization_id AND action_id=a.id;
  DELETE FROM team_improvement_actions WHERE organization_id=a.organization_id AND id=a.id;
 END LOOP;
 -- Already purged actions can still have old history rows in a partial restore.
 DELETE FROM team_improvement_action_history WHERE changed_by=OLD.id OR snapshot->>'owner_id'=OLD.id::text
  OR snapshot->>'created_by'=OLD.id::text OR snapshot->>'changed_by'=OLD.id::text;
 RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS team_actions_delete_account ON users;
CREATE TRIGGER team_actions_delete_account BEFORE DELETE ON users FOR EACH ROW EXECUTE FUNCTION team_actions_delete_account();
COMMIT;
