BEGIN;
-- User confirmations are a separate stream: never substitute for native Git evidence.
CREATE TABLE IF NOT EXISTS team_session_repository_bindings (
 organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
 user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 session_id TEXT NOT NULL CHECK(session_id ~ '^[a-f0-9]{64}$'),
 repository_id UUID, revision BIGINT NOT NULL CHECK(revision > 0),
 request_id UUID NOT NULL, effective_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 provenance TEXT NOT NULL DEFAULT 'user_confirmed' CHECK(provenance='user_confirmed'),
 blocked BOOLEAN NOT NULL DEFAULT FALSE,
 PRIMARY KEY(organization_id,user_id,session_id),
 FOREIGN KEY(organization_id,repository_id) REFERENCES team_repository_scopes(organization_id,repository_id)
);
CREATE TABLE IF NOT EXISTS team_session_repository_binding_history (
 organization_id UUID NOT NULL, user_id UUID NOT NULL, session_id TEXT NOT NULL,
 repository_id UUID, revision BIGINT NOT NULL, request_id UUID NOT NULL,
 effective_at TIMESTAMPTZ NOT NULL, provenance TEXT NOT NULL DEFAULT 'user_confirmed',
 PRIMARY KEY(organization_id,user_id,session_id,revision),
 UNIQUE(organization_id,user_id,request_id),
 FOREIGN KEY(organization_id,user_id,session_id) REFERENCES team_session_repository_bindings(organization_id,user_id,session_id) ON DELETE CASCADE
);
COMMIT;
