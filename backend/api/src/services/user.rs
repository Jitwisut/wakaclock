use anyhow::{anyhow, Context, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use clickhouse::Row;
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::infrastructure::postgres::PostgresClient;
use crate::middleware::auth;
use crate::model::auth::AuthData;
use crate::model::user::{
    CredentialsRow, ExistingUserRow, GenerateApiKeyData, GenerateApiKeyResponse,
    RevokeApiKeyResponse, UserData, UserResponse, UserRow,
};

pub struct UserService {
    clickhouse: Arc<ClickHouseClient>,
    postgres: Option<Arc<PostgresClient>>,
}

impl UserService {
    pub fn new(clickhouse: Arc<ClickHouseClient>, postgres: Option<Arc<PostgresClient>>) -> Self {
        Self {
            clickhouse,
            postgres,
        }
    }

    /// คืนข้อมูล user ปัจจุบัน — ถ้ายังไม่เคย register (ตาราง users ว่าง)
    /// จะคืนค่า default แทนการ error เพราะ resolve_user_id() อาจคืน uuid ที่ไม่เคย register จริง
    pub async fn get_current(&self, user_id: Uuid) -> Result<UserResponse> {
        let row = self
            .clickhouse
            .get_client()
            .query(
                "SELECT username, email, is_active, subscription_status, trial_ends_at,
                        subscription_period_end
                 FROM wakaclock.users FINAL
                 WHERE user_id = ?
                 LIMIT 1",
            )
            .bind(user_id)
            .fetch_optional::<UserRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse users query error: {error}"))?;

        let data = match row {
            Some(row) => UserData {
                id: user_id,
                username: row.username,
                email: row.email,
                is_active: row.is_active,
                subscription_status: row.subscription_status,
                trial_ends_at: row.trial_ends_at,
                subscription_period_end: row.subscription_period_end,
            },
            None => UserData {
                id: user_id,
                username: format!("user-{}", &user_id.to_string()[..8]),
                email: String::new(),
                is_active: true,
                subscription_status: "trialing".to_string(),
                trial_ends_at: default_trial_ends_at(),
                subscription_period_end: None,
            },
        };

        Ok(UserResponse { data })
    }

    /// Create an account: username must be unique, password is hashed with argon2 (a
    /// slow KDF is correct here — unlike an API key, a password is a low-entropy secret
    /// a human chose). Returns a session JWT so the frontend is logged in immediately.
    /// `subscription_status`/`trial_ends_at` are deliberately left out of this INSERT so
    /// ClickHouse applies their column defaults (`'trialing'`, `now() + 14 days`) — the
    /// one place those defaults are supposed to fire.
    pub async fn register(
        &self,
        username: &str,
        password: &str,
        jwt_secret: &str,
    ) -> Result<AuthData> {
        if self.find_user_id_by_username(username).await?.is_some() {
            return Err(anyhow!("username already taken"));
        }

        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|error| anyhow!("failed to hash password: {error}"))?
            .to_string();

        let user_id = Uuid::now_v7();

        self.clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.users (user_id, username, email, api_key, is_active, password_hash)
                 VALUES (?, ?, '', '', true, ?)",
            )
            .bind(user_id)
            .bind(username)
            .bind(&password_hash)
            .execute()
            .await
            .map_err(|error| anyhow!("ClickHouse users insert error: {error}"))?;

        // During the migration window ClickHouse remains the compatibility write path, while
        // PostgreSQL receives the transactional identity needed by goals, OAuth and future
        // organization features. A failed secondary write is visible in logs and can be
        // repaired by the reconciliation job; it must not silently fabricate a success.
        if let Some(postgres) = &self.postgres {
            if let Err(error) = self
                .sync_postgres_identity(postgres, user_id, username, &password_hash)
                .await
            {
                tracing::error!(%user_id, %error, "failed to sync newly registered user to PostgreSQL");
            }
        }

        let token = auth::issue_session_token(user_id, jwt_secret)
            .map_err(|error| anyhow!("failed to issue session token: {error}"))?;

        Ok(AuthData {
            user_id,
            username: username.to_string(),
            token,
        })
    }

    /// Verify username/password and issue a fresh session JWT.
    pub async fn login(
        &self,
        username: &str,
        password: &str,
        jwt_secret: &str,
    ) -> Result<AuthData> {
        let row = self
            .clickhouse
            .get_client()
            .query(
                "SELECT user_id, password_hash FROM wakaclock.users FINAL
                 WHERE username = ? AND is_active
                 LIMIT 1",
            )
            .bind(username)
            .fetch_optional::<CredentialsRow>()
            .await
            .map_err(|error| anyhow!("ClickHouse users query error: {error}"))?;

        let (user_id, password_hash) = match row {
            Some(row) => (row.user_id, row.password_hash),
            None => {
                let Some(postgres) = &self.postgres else {
                    return Err(anyhow!("invalid username or password"));
                };
                let row = postgres
                    .client()
                    .query_opt(
                        "SELECT u.id, c.password_hash
                         FROM users u
                         JOIN password_credentials c ON c.user_id = u.id
                         WHERE u.username = $1 AND u.is_active",
                        &[&username],
                    )
                    .await
                    .map_err(|error| anyhow!("PostgreSQL users query error: {error}"))?;
                let Some(row) = row else {
                    return Err(anyhow!("invalid username or password"));
                };
                (row.try_get("id")?, row.try_get("password_hash")?)
            }
        };

        if password_hash.is_empty() {
            return Err(anyhow!("invalid username or password"));
        }

        let parsed_hash = PasswordHash::new(&password_hash)
            .map_err(|error| anyhow!("stored password hash is corrupt: {error}"))?;
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .map_err(|_| anyhow!("invalid username or password"))?;

        let token = auth::issue_session_token(user_id, jwt_secret)
            .map_err(|error| anyhow!("failed to issue session token: {error}"))?;

        Ok(AuthData {
            user_id,
            username: username.to_string(),
            token,
        })
    }

    /// Generate a new API key for `user_id`, replacing any previous one. The SHA-256
    /// hash remains the authentication value, while the plaintext is kept in the
    /// retrievable column so the owning dashboard session can show it again later.
    ///
    /// `wakaclock.users` is `ReplacingMergeTree(updated_at)`, so this INSERT becomes the
    /// new "current" row once ClickHouse merges; callers must also update the in-memory
    /// `AuthKeyCache` themselves (this method has no reference to it, to keep the
    /// repository layer free of auth concerns).
    pub async fn generate_api_key(&self, user_id: Uuid) -> Result<GenerateApiKeyResponse> {
        let identity = self.existing_identity(user_id).await?;
        let plaintext_key = auth::generate_key();
        let key_hash = auth::hash_key(&plaintext_key);

        self.upsert_preserving_identity(user_id, &identity, &key_hash, &plaintext_key)
            .await?;

        if let Some(postgres) = &self.postgres {
            if let Err(error) = self
                .sync_postgres_api_key(postgres, user_id, &key_hash)
                .await
            {
                tracing::error!(%user_id, %error, "failed to sync API key to PostgreSQL");
            }
        }

        Ok(GenerateApiKeyResponse {
            data: GenerateApiKeyData {
                user_id,
                api_key: plaintext_key,
            },
        })
    }

    /// Return the caller's current API key in retrievable form for the authenticated
    /// dashboard session. API-key authentication is not accepted by the handler, so a
    /// leaked key cannot use this endpoint to read itself back.
    pub async fn current_api_key(&self, user_id: Uuid) -> Result<Option<String>> {
        let identity = self.existing_identity(user_id).await?;
        if identity.api_key_plain.is_empty() {
            return Ok(None);
        }
        Ok(Some(identity.api_key_plain))
    }

    /// Revoke the current key for `user_id` by writing a new row with an empty `api_key`.
    /// Callers must also remove the old hash from `AuthKeyCache`.
    pub async fn revoke_api_key(&self, user_id: Uuid) -> Result<RevokeApiKeyResponse> {
        let identity = self.existing_identity(user_id).await?;

        self.upsert_preserving_identity(user_id, &identity, "", "")
            .await?;

        if let Some(postgres) = &self.postgres {
            postgres
                .client()
                .execute(
                    "UPDATE api_keys SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL",
                    &[&user_id],
                )
                .await
                .context("failed to revoke PostgreSQL API keys")?;
        }

        Ok(RevokeApiKeyResponse {
            status: "ok".to_string(),
        })
    }

    /// Does `user_id` currently have product access — an unexpired trial or an active
    /// subscription? This is a plain per-call DB read rather than a cache: subscription
    /// state changes rarely (once per billing event, not once per request) and a stale
    /// cache here would either let a lapsed account through or lock out a
    /// just-renewed one, neither of which is an acceptable place to be "eventually
    /// consistent."
    pub async fn has_active_access(&self, user_id: Uuid) -> Result<bool> {
        #[derive(Debug, Deserialize, Row)]
        struct AccessRow {
            subscription_status: String,
            trial_valid: bool,
        }

        let row = self
            .clickhouse
            .get_client()
            .query(
                "SELECT subscription_status, trial_ends_at > now() AS trial_valid
                 FROM wakaclock.users FINAL
                 WHERE user_id = ?
                 LIMIT 1",
            )
            .bind(user_id)
            .fetch_optional::<AccessRow>()
            .await
            .map_err(|error| anyhow!("ClickHouse users query error: {error}"))?;

        Ok(match row {
            Some(row) => {
                row.subscription_status == "active"
                    || (row.subscription_status == "trialing" && row.trial_valid)
            }
            None => false,
        })
    }

    /// Called by POST /internal/subscription — the seam an externally-integrated
    /// payment system writes through. Preserves everything about the account except
    /// the two subscription columns; in particular this must never touch `api_key`,
    /// or every billing event would silently revoke a customer's CLI/extension access.
    pub async fn update_subscription(
        &self,
        username: &str,
        status: &str,
        period_end: Option<u32>,
    ) -> Result<Uuid> {
        let user_id = self
            .find_user_id_by_username(username)
            .await?
            .ok_or_else(|| anyhow!("no account with that username"))?;
        let identity = self.existing_identity(user_id).await?;

        self.clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.users
                    (user_id, username, email, api_key, api_key_plain, is_active,
                     password_hash, subscription_status, trial_ends_at,
                     subscription_period_end)
                 VALUES (?, ?, ?, ?, ?, true, ?, ?, ?, ?)",
            )
            .bind(user_id)
            .bind(&identity.username)
            .bind(&identity.email)
            .bind(&identity.api_key)
            .bind(&identity.api_key_plain)
            .bind(&identity.password_hash)
            .bind(status)
            .bind(identity.trial_ends_at)
            .bind(period_end)
            .execute()
            .await
            .map_err(|error| anyhow!("ClickHouse users insert error: {error}"))?;

        Ok(user_id)
    }

    async fn find_user_id_by_username(&self, username: &str) -> Result<Option<Uuid>> {
        #[derive(Debug, serde::Deserialize, clickhouse::Row)]
        struct IdRow {
            #[serde(with = "clickhouse::serde::uuid")]
            user_id: Uuid,
        }

        let row = self
            .clickhouse
            .get_client()
            .query("SELECT user_id FROM wakaclock.users FINAL WHERE username = ? LIMIT 1")
            .bind(username)
            .fetch_optional::<IdRow>()
            .await
            .map_err(|error| anyhow!("ClickHouse users query error: {error}"))?;

        if let Some(row) = row {
            return Ok(Some(row.user_id));
        }

        let Some(postgres) = &self.postgres else {
            return Ok(None);
        };
        let row = postgres
            .client()
            .query_opt("SELECT id FROM users WHERE username = $1", &[&username])
            .await
            .map_err(|error| anyhow!("PostgreSQL users query error: {error}"))?;
        Ok(row.map(|row| row.get("id")))
    }

    async fn sync_postgres_identity(
        &self,
        postgres: &PostgresClient,
        user_id: Uuid,
        username: &str,
        password_hash: &str,
    ) -> Result<()> {
        postgres
            .client()
            .execute(
                "INSERT INTO users (id, username, is_active)
                 VALUES ($1, $2, TRUE)
                 ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, updated_at = now()",
                &[&user_id, &username],
            )
            .await
            .context("failed to upsert PostgreSQL user")?;
        postgres
            .client()
            .execute(
                "INSERT INTO password_credentials (user_id, password_hash)
                 VALUES ($1, $2)
                 ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()",
                &[&user_id, &password_hash],
            )
            .await
            .context("failed to upsert PostgreSQL password credential")?;
        let organization_id = Uuid::now_v7();
        let slug = format!("personal-{}", user_id.simple());
        postgres
            .client()
            .execute(
                "INSERT INTO organizations (id, slug, name, personal_owner_id)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (slug) DO UPDATE SET updated_at = now()",
                &[
                    &organization_id,
                    &slug,
                    &format!("{username}'s AtoAxis"),
                    &user_id,
                ],
            )
            .await
            .context("failed to create personal PostgreSQL organization")?;
        let organization_id = postgres
            .client()
            .query_one("SELECT id FROM organizations WHERE slug = $1", &[&slug])
            .await
            .context("failed to resolve personal PostgreSQL organization")?
            .get::<_, Uuid>("id");
        postgres
            .client()
            .execute(
                "INSERT INTO organization_members (organization_id, user_id, role, seat_type)
                 VALUES ($1, $2, 'owner', 'developer')
                 ON CONFLICT (organization_id, user_id)
                 DO UPDATE SET role = 'owner', seat_type = 'developer', deactivated_at = NULL",
                &[&organization_id, &user_id],
            )
            .await
            .context("failed to add user to personal PostgreSQL organization")?;
        Ok(())
    }

    async fn sync_postgres_api_key(
        &self,
        postgres: &PostgresClient,
        user_id: Uuid,
        key_hash: &str,
    ) -> Result<()> {
        let id = Uuid::now_v7();
        let key_prefix = &key_hash[..key_hash.len().min(12)];
        postgres
            .client()
            .execute(
                "UPDATE api_keys SET revoked_at = now()
                 WHERE user_id = $1 AND revoked_at IS NULL",
                &[&user_id],
            )
            .await
            .context("failed to retire previous PostgreSQL API key")?;
        postgres
            .client()
            .execute(
                "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes)
                 VALUES ($1, $2, 'default', $3, $4, ARRAY['write_logged_time'])",
                &[&id, &user_id, &key_hash, &key_prefix],
            )
            .await
            .context("failed to persist PostgreSQL API key")?;
        Ok(())
    }

    /// Preserve every column that isn't the one being changed. `wakaclock.users`
    /// replaces the whole row on merge, not just the changed columns, so any field left
    /// out of an INSERT reverts to its schema default — this is what stops a key
    /// rotation from silently resetting someone's trial or subscription status.
    async fn existing_identity(&self, user_id: Uuid) -> Result<ExistingUserRow> {
        let row = self
            .clickhouse
            .get_client()
            .query(
                "SELECT username, email, password_hash, api_key, api_key_plain,
                        subscription_status, trial_ends_at, subscription_period_end
                 FROM wakaclock.users FINAL
                 WHERE user_id = ? LIMIT 1",
            )
            .bind(user_id)
            .fetch_optional::<ExistingUserRow>()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse users query error: {error}"))?;

        Ok(row.unwrap_or_else(|| ExistingUserRow {
            username: format!("user-{}", &user_id.to_string()[..8]),
            email: String::new(),
            password_hash: String::new(),
            api_key: String::new(),
            api_key_plain: String::new(),
            subscription_status: "trialing".to_string(),
            trial_ends_at: default_trial_ends_at(),
            subscription_period_end: None,
        }))
    }

    /// Shared by generate/revoke — every identity field is preserved, while the hash
    /// and retrievable plaintext are supplied by the caller.
    async fn upsert_preserving_identity(
        &self,
        user_id: Uuid,
        identity: &ExistingUserRow,
        api_key: &str,
        api_key_plain: &str,
    ) -> Result<()> {
        self.clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.users
                    (user_id, username, email, api_key, api_key_plain, is_active,
                     password_hash, subscription_status, trial_ends_at,
                     subscription_period_end)
                 VALUES (?, ?, ?, ?, ?, true, ?, ?, ?, ?)",
            )
            .bind(user_id)
            .bind(&identity.username)
            .bind(&identity.email)
            .bind(api_key)
            .bind(api_key_plain)
            .bind(&identity.password_hash)
            .bind(&identity.subscription_status)
            .bind(identity.trial_ends_at)
            .bind(identity.subscription_period_end)
            .execute()
            .await
            .map_err(|error| anyhow!("ClickHouse users insert error: {error}"))?;

        Ok(())
    }
}

/// Fallback trial expiry for the synthesized-user branches (no row exists yet) — 14
/// days from now, matching the schema's own `trial_ends_at` column default so the two
/// never quietly drift apart.
fn default_trial_ends_at() -> u32 {
    (chrono::Utc::now().timestamp() + 14 * 24 * 60 * 60) as u32
}
