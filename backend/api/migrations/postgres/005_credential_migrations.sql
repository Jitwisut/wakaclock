-- One-way migration marker prevents retired ClickHouse credentials returning at boot.
BEGIN;
CREATE TABLE IF NOT EXISTS credential_migrations (
    user_id UUID PRIMARY KEY REFERENCES users(id),
    migrated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO schema_migrations (version, name) VALUES (5, 'credential_migrations')
ON CONFLICT (version) DO NOTHING;
COMMIT;
