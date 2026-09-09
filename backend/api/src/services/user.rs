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

    /// Ensure an authenticated legacy/ClickHouse identity exists in PostgreSQL before a
    /// PostgreSQL-backed feature writes a foreign key to it. Accounts created before the
    /// transactional store was enabled will not have gone through `register()`'s sync path.
    pub async fn ensure_postgres_identity(&self, user_id: Uuid) -> Result<()> {
        let Some(postgres) = &self.postgres else {
            return Ok(());
        };

        let exists = postgres
            .client()
            .query_opt("SELECT 1 FROM users WHERE id = $1", &[&user_id])
            .await
            .context("failed to check PostgreSQL user identity")?
            .is_some();
        if exists {
            return Ok(());
        }

        let identity = self.existing_identity(user_id).await?;
        self.sync_postgres_identity(
            postgres,
            user_id,
            &identity.username,
            &identity.password_hash,
        )
        .await
    }

    async fn issue_session(&self, user_id: Uuid, jwt_secret: &str) -> Result<String> {
        let token = auth::issue_session_token(user_id, jwt_secret)?;
        if let Some(postgres) = &self.postgres {
            postgres.client().execute(
                "INSERT INTO sessions (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, now() + interval '24 hours')",
                &[&Uuid::now_v7(), &user_id, &auth::hash_key(&token)],
            ).await?;
        }
        Ok(token)
    }

    pub async fn migrate_legacy_credentials(&self) -> Result<()> {
        let Some(postgres) = &self.postgres else {
            return Ok(());
        };
        #[derive(Deserialize, Row)]
        struct LegacyUser {
            #[serde(with = "clickhouse::serde::uuid")]
            user_id: Uuid,
            api_key: String,
            is_active: bool,
        }
        let rows = self
            .clickhouse
            .get_client()
            .query("SELECT user_id, api_key, is_active FROM wakaclock.users FINAL")
            .fetch_all::<LegacyUser>()
            .await?;
        for row in rows {
            if !row.is_active {
                continue;
            }
            self.ensure_postgres_identity(row.user_id).await?;
            let mut client = postgres.transaction_client().await?;
            let tx = client.transaction().await?;
            tx.query_one(
                "SELECT id FROM users WHERE id = $1 FOR UPDATE",
                &[&row.user_id],
            )
            .await?;
            let first = tx.execute(
                "INSERT INTO credential_migrations (user_id) VALUES ($1) ON CONFLICT DO NOTHING", &[&row.user_id]
            ).await? == 1;
            if first && !row.api_key.is_empty() {
                tx.execute(
                    "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes)
                     SELECT $1, $2, 'legacy', $3, $4, ARRAY['*'] WHERE NOT EXISTS (SELECT 1 FROM api_keys WHERE user_id = $2)
                     ON CONFLICT (key_hash) DO NOTHING",
                    &[&Uuid::now_v7(), &row.user_id, &row.api_key, &&row.api_key[..row.api_key.len().min(12)]],
                ).await?;
            }
            tx.commit().await?;
        }
        Ok(())
    }

    async fn ensure_clickhouse_identity(
        &self,
        user_id: Uuid,
        username: &str,
        password_hash: &str,
    ) -> Result<()> {
        self.clickhouse.get_client().query(
            "INSERT INTO wakaclock.users (user_id, username, email, api_key, is_active, password_hash)
             SELECT ?, ?, '', '', true, ? WHERE NOT EXISTS (SELECT 1 FROM wakaclock.users FINAL WHERE user_id = ?)"
        ).bind(user_id).bind(username).bind(password_hash).bind(user_id).execute().await?;
        Ok(())
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

        let password = password.to_owned();
        let password_hash = tokio::task::spawn_blocking(move || {
            let salt = SaltString::generate(&mut OsRng);
            Argon2::default()
                .hash_password(password.as_bytes(), &salt)
                .map(|hash| hash.to_string())
                .map_err(|error| anyhow!("failed to hash password: {error}"))
        })
        .await
        .context("password hashing task failed")??;

        let user_id = Uuid::now_v7();

        let postgres = self
            .postgres
            .as_deref()
            .context("PostgreSQL is required to register an account")?;
        self.sync_postgres_identity(postgres, user_id, username, &password_hash)
            .await?;
        self.ensure_clickhouse_identity(user_id, username, &password_hash)
            .await?;

        let token = self.issue_session(user_id, jwt_secret).await?;

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
        let pg_credentials = if let Some(postgres) = &self.postgres {
            postgres.client().query_opt(
                "SELECT u.id, c.password_hash, u.is_active AND u.deleted_at IS NULL AS active
                 FROM users u LEFT JOIN password_credentials c ON c.user_id = u.id WHERE u.username = $1",
                &[&username],
            ).await?
        } else {
            None
        };
        let (user_id, password_hash): (Uuid, String) = if let Some(row) = pg_credentials {
            if !row.get::<_, bool>("active") {
                anyhow::bail!("invalid username or password");
            }
            (
                row.get("id"),
                row.get::<_, Option<String>>("password_hash")
                    .context("password login unavailable")?,
            )
        } else {
            let row = self.clickhouse.get_client().query(
                "SELECT user_id, password_hash FROM wakaclock.users FINAL WHERE username = ? AND is_active LIMIT 1"
            ).bind(username).fetch_optional::<CredentialsRow>().await?
                .context("invalid username or password")?;
            (row.user_id, row.password_hash)
        };

        if password_hash.is_empty() {
            return Err(anyhow!("invalid username or password"));
        }

        let password = password.to_owned();
        let hash = password_hash.clone();
        tokio::task::spawn_blocking(move || {
            let parsed =
                PasswordHash::new(&hash).map_err(|_| anyhow!("invalid stored credential"))?;
            Argon2::default()
                .verify_password(password.as_bytes(), &parsed)
                .map_err(|_| anyhow!("invalid username or password"))
        })
        .await
        .context("password verification task failed")??;

        self.ensure_postgres_identity(user_id).await?;
        self.ensure_clickhouse_identity(user_id, username, &password_hash)
            .await?;

        let token = self.issue_session(user_id, jwt_secret).await?;

        Ok(AuthData {
            user_id,
            username: username.to_string(),
            token,
        })
    }

    /// Generate a key once. PostgreSQL owns its lifecycle when configured; the
    /// compatibility store never contains a retrievable plaintext credential.
    pub async fn generate_api_key(&self, user_id: Uuid) -> Result<GenerateApiKeyResponse> {
        let plaintext_key = auth::generate_key();
        let key_hash = auth::hash_key(&plaintext_key);
        if let Some(postgres) = &self.postgres {
            self.sync_postgres_api_key(postgres, user_id, &key_hash)
                .await?;
        } else {
            let identity = self.existing_identity(user_id).await?;
            self.upsert_preserving_identity(user_id, &identity, &key_hash)
                .await?;
        }
        Ok(GenerateApiKeyResponse {
            data: GenerateApiKeyData {
                user_id,
                api_key: plaintext_key,
            },
        })
    }

    pub async fn current_api_key(&self, _user_id: Uuid) -> Result<Option<String>> {
        Ok(None)
    }

    /// Revoke current keys in the authoritative store.
    pub async fn revoke_api_key(&self, user_id: Uuid) -> Result<RevokeApiKeyResponse> {
        if let Some(postgres) = &self.postgres {
            let mut client = postgres.transaction_client().await?;
            let transaction = client.transaction().await?;
            transaction
                .query_one("SELECT id FROM users WHERE id = $1 FOR UPDATE", &[&user_id])
                .await?;
            transaction.execute("UPDATE api_keys SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", &[&user_id]).await?;
            transaction.commit().await?;
        } else {
            let identity = self.existing_identity(user_id).await?;
            self.upsert_preserving_identity(user_id, &identity, "")
                .await?;
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
            .bind("")
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
        let mut client = postgres.transaction_client().await?;
        let transaction = client.transaction().await?;
        transaction
            .execute(
                "INSERT INTO users (id, username, is_active)
                 VALUES ($1, $2, TRUE)
                 ON CONFLICT (id) DO UPDATE SET username = EXCLUDED.username, updated_at = now()",
                &[&user_id, &username],
            )
            .await
            .context("failed to upsert PostgreSQL user")?;
        transaction
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
        transaction
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
        let organization_id = transaction
            .query_one("SELECT id FROM organizations WHERE slug = $1", &[&slug])
            .await
            .context("failed to resolve personal PostgreSQL organization")?
            .get::<_, Uuid>("id");
        transaction
            .execute(
                "INSERT INTO organization_members (organization_id, user_id, role, seat_type)
                 VALUES ($1, $2, 'owner', 'developer')
                 ON CONFLICT (organization_id, user_id)
                 DO UPDATE SET role = 'owner', seat_type = 'developer', deactivated_at = NULL",
                &[&organization_id, &user_id],
            )
            .await
            .context("failed to add user to personal PostgreSQL organization")?;
        transaction.commit().await?;
        Ok(())
    }

    async fn sync_postgres_api_key(
        &self,
        postgres: &PostgresClient,
        user_id: Uuid,
        key_hash: &str,
    ) -> Result<()> {
        let mut client = postgres.transaction_client().await?;
        let transaction = client.transaction().await?;
        transaction.query_one("SELECT id FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL FOR UPDATE", &[&user_id]).await?;
        let id = Uuid::now_v7();
        let key_prefix = &key_hash[..key_hash.len().min(12)];
        transaction
            .execute(
                "UPDATE api_keys SET revoked_at = now()
                 WHERE user_id = $1 AND revoked_at IS NULL",
                &[&user_id],
            )
            .await
            .context("failed to retire previous PostgreSQL API key")?;
        transaction
            .execute(
                "INSERT INTO api_keys (id, user_id, name, key_hash, key_prefix, scopes)
                 VALUES ($1, $2, 'default', $3, $4, ARRAY['write_logged_time'])",
                &[&id, &user_id, &key_hash, &key_prefix],
            )
            .await
            .context("failed to persist PostgreSQL API key")?;
        transaction.commit().await?;
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
                "SELECT username, email, password_hash, api_key,
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
            subscription_status: "trialing".to_string(),
            trial_ends_at: default_trial_ends_at(),
            subscription_period_end: None,
        }))
    }

    /// Compatibility writes preserve identity and keep only the key hash.
    async fn upsert_preserving_identity(
        &self,
        user_id: Uuid,
        identity: &ExistingUserRow,
        api_key: &str,
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
            .bind("")
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
