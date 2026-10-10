BEGIN;
ALTER TABLE team_session_links ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE team_link_history ADD COLUMN IF NOT EXISTS revision BIGINT;
ALTER TABLE team_session_contexts ADD COLUMN IF NOT EXISTS verification TEXT NOT NULL DEFAULT 'verified';
ALTER TABLE team_session_contexts ADD COLUMN IF NOT EXISTS verification_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE team_session_contexts ADD COLUMN IF NOT EXISTS verification_retry_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE team_session_contexts ADD COLUMN IF NOT EXISTS verification_lease UUID;
ALTER TABLE team_session_contexts ADD COLUMN IF NOT EXISTS verification_until TIMESTAMPTZ;
ALTER TABLE team_session_contexts ADD COLUMN IF NOT EXISTS verification_reason TEXT;
CREATE INDEX IF NOT EXISTS team_context_pending ON team_session_contexts(verification_retry_at) WHERE verification='pending';
CREATE TABLE IF NOT EXISTS team_github_relation_history (
 organization_id UUID NOT NULL, repository_id UUID NOT NULL, work_item_id BIGINT NOT NULL,
 related_repository_id BIGINT NOT NULL, related_item_id BIGINT NOT NULL,
 relation_kind TEXT NOT NULL CHECK(relation_kind IN ('closing','reference')),
 event_id TEXT NOT NULL, source_at TIMESTAMPTZ, observed_at TIMESTAMPTZ NOT NULL,
 action TEXT NOT NULL CHECK(action IN ('present','removed')),
 PRIMARY KEY(organization_id,repository_id,event_id),
 FOREIGN KEY(organization_id,repository_id) REFERENCES team_repository_scopes(organization_id,repository_id) ON DELETE CASCADE
);
COMMIT;
