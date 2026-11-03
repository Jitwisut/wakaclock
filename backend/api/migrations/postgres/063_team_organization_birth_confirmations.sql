-- Immutable explicit Owner approval of existing birth evidence. A row means
-- requested, not independent confirmation. Keep alongside minimal birth proof;
-- analytics/audit retention must not erase backup-protection evidence.
CREATE TABLE IF NOT EXISTS team_organization_birth_confirmations (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL,
    actor_id UUID NOT NULL,
    creation_id UUID NOT NULL,
    requested_at TIMESTAMPTZ NOT NULL,
    metadata_hash TEXT NOT NULL CHECK (metadata_hash ~ '^[0-9a-f]{64}$'),
    metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object'),
    UNIQUE (organization_id, actor_id, creation_id)
);
