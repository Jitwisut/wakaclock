use anyhow::{anyhow, Result};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::middleware::auth;
use crate::model::auth::AuthData;
use crate::model::user::{
    CredentialsRow, ExistingUserRow, GenerateApiKeyData, GenerateApiKeyResponse,
    RevokeApiKeyResponse, UserData, UserResponse, UserRow,
};

pub struct UserService {
    clickhouse: Arc<ClickHouseClient>,
}

impl UserService {
    pub fn new(clickhouse: Arc<ClickHouseClient>) -> Self {
        Self { clickhouse }
    }

    /// คืนข้อมูล user ปัจจุบัน — ถ้ายังไม่เคย register (ตาราง users ว่าง)
    /// จะคืนค่า default แทนการ error เพราะ resolve_user_id() อาจคืน uuid ที่ไม่เคย register จริง
    pub async fn get_current(&self, user_id: Uuid) -> Result<UserResponse> {
        let row = self
            .clickhouse
            .get_client()
            .query(
                "SELECT username, email, is_active
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
            },
            None => UserData {
                id: user_id,
                username: format!("user-{}", &user_id.to_string()[..8]),
                email: String::new(),
                is_active: true,
            },
        };

        Ok(UserResponse { data })
    }

    /// Create an account: username must be unique, password is hashed with argon2 (a
    /// slow KDF is correct here — unlike an API key, a password is a low-entropy secret
    /// a human chose). Returns a session JWT so the frontend is logged in immediately.
    pub async fn register(&self, username: &str, password: &str, jwt_secret: &str) -> Result<AuthData> {
        if self.find_user_id_by_username(username).await?.is_some() {
            return Err(anyhow!("username already taken"));
        }

        let salt = SaltString::generate(&mut OsRng);
        let password_hash = Argon2::default()
            .hash_password(password.as_bytes(), &salt)
            .map_err(|error| anyhow!("failed to hash password: {error}"))?
            .to_string();

        let user_id = Uuid::new_v4();

        self.clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.users
                    (user_id, username, email, api_key, is_active, password_hash)
                 VALUES (?, ?, '', '', true, ?)",
            )
            .bind(user_id)
            .bind(username)
            .bind(&password_hash)
            .execute()
            .await
            .map_err(|error| anyhow!("ClickHouse users insert error: {error}"))?;

        let token = auth::issue_session_token(user_id, jwt_secret)
            .map_err(|error| anyhow!("failed to issue session token: {error}"))?;

        Ok(AuthData {
            user_id,
            username: username.to_string(),
            token,
        })
    }

    /// Verify username/password and issue a fresh session JWT.
    pub async fn login(&self, username: &str, password: &str, jwt_secret: &str) -> Result<AuthData> {
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
            .map_err(|error| anyhow!("ClickHouse users query error: {error}"))?
            .ok_or_else(|| anyhow!("invalid username or password"))?;

        if row.password_hash.is_empty() {
            return Err(anyhow!("invalid username or password"));
        }

        let parsed_hash = PasswordHash::new(&row.password_hash)
            .map_err(|error| anyhow!("stored password hash is corrupt: {error}"))?;
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed_hash)
            .map_err(|_| anyhow!("invalid username or password"))?;

        let token = auth::issue_session_token(row.user_id, jwt_secret)
            .map_err(|error| anyhow!("failed to issue session token: {error}"))?;

        Ok(AuthData {
            user_id: row.user_id,
            username: username.to_string(),
            token,
        })
    }

    /// Generate a new API key for `user_id`, replacing any previous one. Only the
    /// SHA-256 hash is persisted; the plaintext key is returned once and cannot be
    /// recovered afterwards — losing it means calling this again to rotate.
    ///
    /// `wakaclock.users` is `ReplacingMergeTree(updated_at)`, so this INSERT becomes the
    /// new "current" row once ClickHouse merges; callers must also update the in-memory
    /// `AuthKeyCache` themselves (this method has no reference to it, to keep the
    /// repository layer free of auth concerns).
    pub async fn generate_api_key(&self, user_id: Uuid) -> Result<GenerateApiKeyResponse> {
        let identity = self.existing_identity(user_id).await?;
        let plaintext_key = auth::generate_key();
        let key_hash = auth::hash_key(&plaintext_key);

        self.clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.users
                    (user_id, username, email, api_key, is_active, password_hash)
                 VALUES (?, ?, ?, ?, true, ?)",
            )
            .bind(user_id)
            .bind(&identity.username)
            .bind(&identity.email)
            .bind(&key_hash)
            .bind(&identity.password_hash)
            .execute()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse users insert error: {error}"))?;

        Ok(GenerateApiKeyResponse {
            data: GenerateApiKeyData {
                user_id,
                api_key: plaintext_key,
            },
        })
    }

    /// Revoke the current key for `user_id` by writing a new row with an empty `api_key`.
    /// Callers must also remove the old hash from `AuthKeyCache`.
    pub async fn revoke_api_key(&self, user_id: Uuid) -> Result<RevokeApiKeyResponse> {
        let identity = self.existing_identity(user_id).await?;

        self.clickhouse
            .get_client()
            .query(
                "INSERT INTO wakaclock.users
                    (user_id, username, email, api_key, is_active, password_hash)
                 VALUES (?, ?, ?, '', true, ?)",
            )
            .bind(user_id)
            .bind(&identity.username)
            .bind(&identity.email)
            .bind(&identity.password_hash)
            .execute()
            .await
            .map_err(|error| anyhow::anyhow!("ClickHouse users insert error: {error}"))?;

        Ok(RevokeApiKeyResponse {
            status: "ok".to_string(),
        })
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

        Ok(row.map(|r| r.user_id))
    }

    /// Preserve username/email/password_hash across key rotation instead of clobbering
    /// them with the synthesized placeholder every time a key is generated or revoked —
    /// `wakaclock.users` replaces the whole row on merge, not just the changed columns.
    async fn existing_identity(&self, user_id: Uuid) -> Result<ExistingUserRow> {
        let row = self
            .clickhouse
            .get_client()
            .query(
                "SELECT username, email, password_hash FROM wakaclock.users FINAL
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
        }))
    }
}
