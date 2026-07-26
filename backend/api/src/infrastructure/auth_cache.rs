use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use anyhow::{Context, Result};
use clickhouse::Row;
use serde::Deserialize;
use uuid::Uuid;

use crate::infrastructure::database::ClickHouseClient;

/// In-memory index of `sha256(api_key) -> user_id`, refreshed from ClickHouse.
///
/// `wakaclock.users` is a `ReplacingMergeTree` ordered by `user_id` — looking up a key by
/// hash directly against the table would be a full scan, and a revoked/rotated key would
/// keep authenticating until ClickHouse merges away the old row (no `FINAL` bound). Holding
/// the mapping in memory and rebuilding it on every mutation avoids both problems.
#[derive(Debug, Default)]
pub struct AuthKeyCache {
    by_hash: RwLock<HashMap<String, Uuid>>,
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

        *self.by_hash.write().expect("auth cache lock poisoned") = map;
        Ok(())
    }

    pub fn lookup(&self, key_hash: &str) -> Option<Uuid> {
        self.by_hash
            .read()
            .expect("auth cache lock poisoned")
            .get(key_hash)
            .copied()
    }

    pub fn insert(&self, key_hash: String, user_id: Uuid) {
        self.by_hash
            .write()
            .expect("auth cache lock poisoned")
            .insert(key_hash, user_id);
    }

    /// Drop every key currently mapped to this user (used on revoke — a user should only
    /// ever have one live key, but this stays correct even if that invariant is ever relaxed).
    pub fn remove_for_user(&self, user_id: Uuid) {
        self.by_hash
            .write()
            .expect("auth cache lock poisoned")
            .retain(|_, uid| *uid != user_id);
    }
}
