-- Store a sealed copy of the dashboard API key so GET /users/current/api_key can
-- return it after the tab closed. Bytes are AES-256-GCM ciphertext under
-- ATOAXIS_KMS_KEY_ID (see src/infrastructure/secret_box.rs); a NULL ciphertext
-- means the key predates this column or the master key was unset at issue time,
-- and the read endpoint reports no displayable key.
BEGIN;

ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS secret_ciphertext BYTEA;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS secret_key_version TEXT;

INSERT INTO schema_migrations (version, name)
VALUES (6, 'api_key_readback')
ON CONFLICT (version) DO NOTHING;

COMMIT;
