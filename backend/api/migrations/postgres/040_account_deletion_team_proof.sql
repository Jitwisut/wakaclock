BEGIN;
-- A cross-store deletion is not acknowledged until the independent Team ledger
-- records its action tombstones. This checkpoint survives deletion of users.
ALTER TABLE account_deletion_requests ADD COLUMN IF NOT EXISTS postgres_purged_at TIMESTAMPTZ;
ALTER TABLE account_deletion_requests ADD COLUMN IF NOT EXISTS team_action_ledger_required BOOLEAN NOT NULL DEFAULT FALSE;
-- Minimal deletion-proof requirement, not an analytics contributor inventory.
-- No users FK: it must survive removal of account/action/history and old backups.
CREATE TABLE IF NOT EXISTS team_action_account_proof_requirements (
 account_id UUID PRIMARY KEY, recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO team_action_account_proof_requirements(account_id)
 SELECT account_id FROM (
  SELECT owner_id AS account_id FROM team_improvement_actions
  UNION SELECT created_by FROM team_improvement_actions
  UNION SELECT changed_by FROM team_improvement_actions
  UNION SELECT changed_by FROM team_improvement_action_history
  UNION SELECT (snapshot->>'owner_id')::uuid FROM team_improvement_action_history
  UNION SELECT (snapshot->>'created_by')::uuid FROM team_improvement_action_history
  UNION SELECT (snapshot->>'changed_by')::uuid FROM team_improvement_action_history
 ) participants WHERE account_id IS NOT NULL ON CONFLICT DO NOTHING;
-- Existing installations receive the same minimal independent mapping as new
-- writes. It contains identities/proof only, never title or captured content.
INSERT INTO team_webhook_dispositions(provider,delivery_id,payload_hash,reason,disposed_at)
 SELECT 'team_action_participant',account_id::text||':'||organization_id::text||':'||action_id::text,
  encode(sha256(convert_to(account_id::text||':'||organization_id::text||':'||action_id::text,'UTF8')),'hex'),'workflow_participant',now()
 FROM (
  SELECT organization_id,id AS action_id,owner_id AS account_id FROM team_improvement_actions
  UNION SELECT organization_id,id,created_by FROM team_improvement_actions
  UNION SELECT organization_id,id,changed_by FROM team_improvement_actions
  UNION SELECT organization_id,action_id,changed_by FROM team_improvement_action_history
  UNION SELECT organization_id,action_id,(snapshot->>'owner_id')::uuid FROM team_improvement_action_history
  UNION SELECT organization_id,action_id,(snapshot->>'created_by')::uuid FROM team_improvement_action_history
  UNION SELECT organization_id,action_id,(snapshot->>'changed_by')::uuid FROM team_improvement_action_history
 ) participants WHERE account_id IS NOT NULL ON CONFLICT DO NOTHING;
COMMIT;
