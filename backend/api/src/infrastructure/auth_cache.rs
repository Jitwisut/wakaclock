use std::collections::{HashMap, HashSet};
use std::sync::Arc;

use anyhow::{Context, Result};
use clickhouse::Row;
use parking_lot::RwLock;
use serde::Deserialize;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;
use crate::infrastructure::postgres::PostgresClient;

/// In-memory index of `sha256(api_key) -> user_id`, refreshed from ClickHouse.
///
/// `wakaclock.users` is a `ReplacingMergeTree` ordered by `user_id` — looking up a key by
/// hash directly against the table would be a full scan, and a revoked/rotated key would
/// keep authenticating until ClickHouse merges away the old row (no `FINAL` bound). Holding
/// the mapping in memory and rebuilding it on every mutation avoids both problems.
#[derive(Debug, Default)]
pub struct AuthKeyCache {
    by_hash: RwLock<HashMap<String, Uuid>>,
    oauth_expirations: RwLock<HashMap<String, i64>>,
    /// OAuth scopes are kept only for opaque OAuth access tokens. API keys and
    /// dashboard session JWTs intentionally do not have an entry here and keep
    /// their existing full-account behavior.
    oauth_scopes: RwLock<HashMap<String, HashSet<String>>>,
}

#[derive(Debug, Deserialize, Row)]
struct KeyRow {
    #[serde(with = "clickhouse::serde::uuid")]
    user_id: Uuid,
    api_key: String,
}

impl AuthKeyCache {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    /// Rebuild the whole map from the current (FINAL) state of `wakaclock.users`.
    /// Called once at startup and after every key generate/revoke.
    pub async fn refresh(&self, clickhouse: &ClickHouseClient) -> Result<()> {
        let rows = clickhouse
            .get_client()
            .query(
                "SELECT user_id, api_key FROM wakaclock.users FINAL WHERE api_key != '' AND is_active",
            )
            .fetch_all::<KeyRow>()
            .await
            .context("failed to refresh auth key cache from ClickHouse")?;

        let mut map = HashMap::with_capacity(rows.len());
        for row in rows {
            map.insert(row.api_key, row.user_id);
        }

        *self.by_hash.write() = map;
        self.oauth_expirations.write().clear();
        self.oauth_scopes.write().clear();
        Ok(())
    }

    /// Add active OAuth access-token hashes from PostgreSQL to the same fast lookup used by
    /// API keys. The cache is intentionally rebuilt at startup so a server restart does not
    /// invalidate still-live OAuth tokens.
    pub async fn refresh_from_postgres(&self, postgres: &PostgresClient) -> Result<()> {
        let api_key_rows = postgres
            .client()
            .query(
                "SELECT user_id, key_hash
                 FROM api_keys
                 WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())",
                &[],
            )
            .await
            .context("failed to refresh API key cache from PostgreSQL")?;
        {
            let mut map = self.by_hash.write();
            for row in api_key_rows {
                let user_id: Uuid = row.get("user_id");
                let key_hash: String = row.get("key_hash");
                map.insert(key_hash, user_id);
            }
        }

        let rows = postgres
            .client()
            .query(
                "SELECT t.user_id, t.token_hash, t.scopes,
                        extract(epoch from t.expires_at)::bigint AS expires_epoch
                 FROM oauth_access_tokens t
                 JOIN oauth_apps a ON a.id = t.app_id
                 WHERE t.revoked_at IS NULL AND t.expires_at > now()
                   AND a.revoked_at IS NULL",
                &[],
            )
            .await
            .context("failed to refresh OAuth token cache from PostgreSQL")?;
        let previous_oauth_hashes = self
            .oauth_scopes
            .read()
            .keys()
            .cloned()
            .collect::<HashSet<_>>();
        let mut map = self.by_hash.write();
        map.retain(|hash, _| !previous_oauth_hashes.contains(hash));
        let mut expirations = self.oauth_expirations.write();
        expirations.clear();
        let mut scopes_by_hash = self.oauth_scopes.write();
        scopes_by_hash.clear();
        for row in rows {
            let user_id: Uuid = row.get("user_id");
            let token_hash: String = row.get("token_hash");
            let scopes: Vec<String> = row.get("scopes");
            let expires_at: i64 = row.get("expires_epoch");
            map.insert(token_hash.clone(), user_id);
            expirations.insert(token_hash.clone(), expires_at);
            scopes_by_hash.insert(token_hash, scopes.into_iter().collect());
        }
        Ok(())
    }

    pub fn lookup(&self, key_hash: &str) -> Option<Uuid> {
        let user_id = self.by_hash.read().get(key_hash).copied().filter(|_| {
            self.oauth_expirations
                .read()
                .get(key_hash)
                .is_none_or(|expires_at| *expires_at > chrono::Utc::now().timestamp())
        });
        if user_id.is_none() {
            self.remove_hash(key_hash);
        }
        user_id
    }

    pub fn insert(&self, key_hash: String, user_id: Uuid) {
        self.by_hash.write().insert(key_hash, user_id);
    }

    pub fn insert_with_expiry_and_scopes(
        &self,
        key_hash: String,
        user_id: Uuid,
        expires_at: i64,
        scopes: &[String],
    ) {
        self.by_hash.write().insert(key_hash.clone(), user_id);
        self.oauth_expirations
            .write()
            .insert(key_hash.clone(), expires_at);
        if !scopes.is_empty() {
            self.oauth_scopes
                .write()
                .insert(key_hash, scopes.iter().cloned().collect());
        }
    }

    /// Check an OAuth scope for a verified opaque token. A missing scope entry
    /// means the credential is an API key (API keys retain the v1 behavior of
    /// being account-scoped), while a present entry is an OAuth grant.
    pub fn has_scope(&self, key_hash: &str, scope: &str) -> bool {
        if self.lookup(key_hash).is_none() {
            return false;
        }
        self.oauth_scopes
            .read()
            .get(key_hash)
            .is_none_or(|scopes| scopes.contains(scope) || scopes.contains("*"))
    }

    pub fn remove_hash(&self, key_hash: &str) {
        self.by_hash.write().remove(key_hash);
        self.oauth_expirations.write().remove(key_hash);
        self.oauth_scopes.write().remove(key_hash);
    }

    /// Drop the user's API-key credentials after rotation/revocation. OAuth access tokens are
    /// deliberately retained: they have a separate revocation lifecycle and are identified by
    /// the scope entry in `oauth_scopes`.
    pub fn remove_for_user(&self, user_id: Uuid) {
        let oauth_hashes = self
            .oauth_scopes
            .read()
            .keys()
            .cloned()
            .collect::<HashSet<_>>();
        let mut removed = Vec::new();
        self.by_hash.write().retain(|hash, uid| {
            let keep = *uid != user_id || oauth_hashes.contains(hash);
            if !keep {
                removed.push(hash.clone());
            }
            keep
        });
        let mut expirations = self.oauth_expirations.write();
        for hash in &removed {
            expirations.remove(hash);
        }
        let mut scopes = self.oauth_scopes.write();
        for hash in &removed {
            scopes.remove(hash);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn oauth_entries_expire_without_a_database_round_trip() {
        let cache = AuthKeyCache::default();
        let user_id = Uuid::now_v7();
        cache.insert_with_expiry_and_scopes(
            "live".to_string(),
            user_id,
            chrono::Utc::now().timestamp() + 60,
            &[],
        );
        assert_eq!(cache.lookup("live"), Some(user_id));

        cache.insert_with_expiry_and_scopes(
            "expired".to_string(),
            user_id,
            chrono::Utc::now().timestamp() - 1,
            &[],
        );
        assert_eq!(cache.lookup("expired"), None);
        assert!(!cache.by_hash.read().contains_key("expired"));
    }

    #[test]
    fn api_key_entries_have_no_expiration_metadata() {
        let cache = AuthKeyCache::default();
        let user_id = Uuid::now_v7();
        cache.insert("api-key".to_string(), user_id);
        assert_eq!(cache.lookup("api-key"), Some(user_id));
        assert!(!cache.oauth_expirations.read().contains_key("api-key"));
        assert!(cache.has_scope("api-key", "export_data"));
    }

    #[test]
    fn oauth_entries_require_their_granted_scope() {
        let cache = AuthKeyCache::default();
        let user_id = Uuid::now_v7();
        cache.insert_with_expiry_and_scopes(
            "oauth".to_string(),
            user_id,
            chrono::Utc::now().timestamp() + 60,
            &["read_goals".to_string()],
        );
        assert!(cache.has_scope("oauth", "read_goals"));
        assert!(!cache.has_scope("oauth", "export_data"));
        cache.remove_for_user(user_id);
        assert!(cache.has_scope("oauth", "read_goals"));
    }
}
