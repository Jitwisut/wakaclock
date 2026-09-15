-- Make AI-usage verification audits idempotent without exposing tenant or event
-- identifiers. Older rows keep their legacy event hash and a NULL identity_hash;
-- new writes use the tenant+event framed hash as their replay key.
BEGIN;

ALTER TABLE ai_usage_verification_audits
    ADD COLUMN IF NOT EXISTS identity_hash TEXT;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'ai_usage_verification_audits_identity_unique'
    ) THEN
        ALTER TABLE ai_usage_verification_audits
            ADD CONSTRAINT ai_usage_verification_audits_identity_unique
            UNIQUE (identity_hash);
    END IF;
END $$;

INSERT INTO schema_migrations (version, name)
VALUES (18, 'ai_usage_verification_identity')
ON CONFLICT (version) DO NOTHING;

COMMIT;
