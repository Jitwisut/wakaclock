-- Minimal identity/anti-rollback evidence, separate from analytics and the
-- twelve-month administrative audit. No name, slug, credential or content.
-- Deliberately no cascading foreign keys: deletion must not erase the proof
-- needed to reject an older database backup. Retain with the independent ledger
-- until the supported backup horizon has expired, under an explicit policy.
CREATE TABLE IF NOT EXISTS team_organization_birth_receipts (
    organization_id UUID PRIMARY KEY,
    namespace UUID NOT NULL,
    intent_id UUID NOT NULL UNIQUE,
    creation_id UUID NOT NULL UNIQUE,
    creator_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    metadata_hash TEXT NOT NULL CHECK (metadata_hash ~ '^[0-9a-f]{64}$'),
    metadata JSONB NOT NULL CHECK (jsonb_typeof(metadata) = 'object')
);
CREATE TABLE IF NOT EXISTS team_organization_birth_audit (
    id UUID PRIMARY KEY,
    organization_id UUID NOT NULL UNIQUE,
    creation_id UUID NOT NULL UNIQUE,
    metadata_hash TEXT NOT NULL CHECK (metadata_hash ~ '^[0-9a-f]{64}$'),
    created_at TIMESTAMPTZ NOT NULL
);
