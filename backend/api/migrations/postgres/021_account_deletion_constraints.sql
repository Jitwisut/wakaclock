-- Make account deletion complete for PostgreSQL-only identity and credential rows.
--
-- The ingestion identity ledger intentionally has no payload, but its stable
-- usage id and payload hash are still account data. Credential migration
-- markers are also account-scoped and must not prevent the final user delete.
BEGIN;

-- Clean up rows created before the identity table had a foreign key. This is
-- safe because an identity without a user can no longer participate in an
-- authenticated ingest or a fact-sink replay.
DELETE FROM ai_usage_ingest_identities identities
WHERE NOT EXISTS (
    SELECT 1
    FROM users
    WHERE users.id = identities.user_id
);

ALTER TABLE ai_usage_ingest_identities
    DROP CONSTRAINT IF EXISTS ai_usage_ingest_identities_user_id_fkey;

ALTER TABLE ai_usage_ingest_identities
    ADD CONSTRAINT ai_usage_ingest_identities_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE credential_migrations
    DROP CONSTRAINT IF EXISTS credential_migrations_user_id_fkey;

ALTER TABLE credential_migrations
    ADD CONSTRAINT credential_migrations_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

INSERT INTO schema_migrations (version, name)
VALUES (21, 'account_deletion_constraints')
ON CONFLICT (version) DO NOTHING;

COMMIT;
