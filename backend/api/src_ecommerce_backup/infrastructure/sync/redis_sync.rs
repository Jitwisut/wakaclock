use super::*;
use crate::infrastructure::logger::Logger;
use async_trait::async_trait;
use redis::{
    aio::ConnectionManager, streams::StreamRangeReply, AsyncCommands, Client, Script, Value,
};
use serde_json;
use std::collections::HashMap;
use std::sync::Arc;

/// Redis implementation of sync state manager
pub struct RedisSyncStateManager {
    client: Arc<redis::Client>,
    connection: Arc<tokio::sync::RwLock<Option<ConnectionManager>>>,
    config: SyncConfig,
}

impl RedisSyncStateManager {
    pub async fn new(redis_url: &str, config: SyncConfig, _logger: Logger) -> anyhow::Result<Self> {
        let client = Client::open(redis_url)?;
        let connection_manager = client.get_connection_manager().await?;

        Ok(Self {
            client: Arc::new(client),
            connection: Arc::new(tokio::sync::RwLock::new(Some(connection_manager))),
            config,
        })
    }

    async fn get_connection(&self) -> anyhow::Result<ConnectionManager> {
        let mut conn_lock = self.connection.write().await;

        if conn_lock.is_none() {
            *conn_lock = Some(self.client.get_connection_manager().await?);
        }

        Ok(conn_lock.as_ref().unwrap().clone())
    }

    /// Lua script for lock operations
    fn lock_acquire_script() -> Script {
        Script::new(
            r#"
            if redis.call("SET", KEYS[1], ARGV[1], "NX", "PX", ARGV[2]) then
                return 1
            else
                return 0
            end
        "#,
        )
    }

    fn lock_renew_script() -> Script {
        Script::new(
            r#"
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                redis.call("PEXPIRE", KEYS[1], ARGV[2])
                return 1
            else
                return 0
            end
        "#,
        )
    }

    fn lock_release_script() -> Script {
        Script::new(
            r#"
            if redis.call("GET", KEYS[1]) == ARGV[1] then
                redis.call("DEL", KEYS[1])
                return 1
            else
                return 0
            end
        "#,
        )
    }
}

#[async_trait]
impl SyncStateManager for RedisSyncStateManager {
    async fn update_sync_stats(&self, key: &SyncStatsKey, stats: &SyncStats) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        // Build hash map for HSET
        let mut fields = Vec::new();

        if let Some(ref lower) = stats.last_committed_lower {
            fields.push(("last_committed_lower", lower.as_str()));
        }
        if let Some(ref upper) = stats.last_committed_upper {
            fields.push(("last_committed_upper", upper.as_str()));
        }
        if let Some(ref cursor) = stats.current_cursor {
            fields.push(("current_cursor", cursor.as_str()));
        }

        let page_seq_str = stats.page_seq.to_string();
        let total_items_str = stats.total_items.to_string();
        let version_str = stats.version.to_string();
        let updated_at_str = stats.updated_at.to_string();

        fields.extend([
            ("page_seq", page_seq_str.as_str()),
            ("status", &stats.status),
            ("total_items", total_items_str.as_str()),
            ("version", version_str.as_str()),
            ("resource", &stats.resource),
            ("updated_at", updated_at_str.as_str()),
        ]);

        // Convert offset if present and add to fields before hset_multiple
        let offset_str;
        if let Some(offset) = stats.current_offset {
            offset_str = offset.to_string();
            fields.push(("current_offset", offset_str.as_str()));
        }

        conn.hset_multiple::<_, _, _, ()>(&redis_key, &fields)
            .await?;
        Ok(())
    }

    async fn get_sync_stats(&self, key: &SyncStatsKey) -> anyhow::Result<Option<SyncStats>> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        let fields: HashMap<String, String> = conn.hgetall(&redis_key).await?;

        if fields.is_empty() {
            return Ok(None);
        }

        let stats = SyncStats {
            last_committed_lower: fields.get("last_committed_lower").cloned(),
            last_committed_upper: fields.get("last_committed_upper").cloned(),
            current_cursor: fields.get("current_cursor").cloned(),
            current_offset: fields.get("current_offset").and_then(|s| s.parse().ok()),
            page_seq: fields
                .get("page_seq")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            status: fields.get("status").cloned().unwrap_or_default(),
            total_items: fields
                .get("total_items")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            version: fields
                .get("version")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            resource: fields.get("resource").cloned().unwrap_or_default(),
            updated_at: fields
                .get("updated_at")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
        };

        Ok(Some(stats))
    }

    async fn check_processed(
        &self,
        key: &IdempotencyKey,
        product_ids: &[String],
    ) -> anyhow::Result<Vec<bool>> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        let mut results = Vec::new();
        for product_id in product_ids {
            let is_member: bool = conn.sismember(&redis_key, product_id).await?;
            results.push(is_member);
        }

        Ok(results)
    }

    async fn mark_processed(
        &self,
        key: &IdempotencyKey,
        product_ids: &[String],
    ) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        if !product_ids.is_empty() {
            conn.sadd::<_, _, ()>(&redis_key, product_ids).await?;
        }

        Ok(())
    }

    async fn update_run_status(
        &self,
        key: &RunStatusKey,
        status: &RunStatus,
    ) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        // Serialize run status to hash fields
        let mut fields = vec![
            ("state", serde_json::to_string(&status.state)?),
            ("run_id", status.run_id.clone()),
            ("worker_id", status.worker_id.clone()),
            ("page_seq", status.page_seq.to_string()),
            ("items_total", status.items_total.to_string()),
            ("items_list_only", status.items_list_only.to_string()),
            (
                "items_detail_enqueued",
                status.items_detail_enqueued.to_string(),
            ),
            (
                "items_detail_skipped",
                status.items_detail_skipped.to_string(),
            ),
            (
                "lag_detail_consumer",
                status.lag_detail_consumer.to_string(),
            ),
            ("backoff_seconds", status.backoff_seconds.to_string()),
            ("started_at", status.started_at.to_string()),
            ("updated_at", status.updated_at.to_string()),
            ("heartbeat_ts", status.heartbeat_ts.to_string()),
        ];

        if let Some(ref lower_ts) = status.lower_ts {
            fields.push(("lower_ts", lower_ts.clone()));
        }
        if let Some(ref upper_ts) = status.upper_ts {
            fields.push(("upper_ts", upper_ts.clone()));
        }
        if let Some(ref cursor) = status.current_cursor {
            fields.push(("current_cursor", cursor.clone()));
        }
        if let Some(offset) = status.current_offset {
            fields.push(("current_offset", offset.to_string()));
        }
        if let Some(ref error_code) = status.last_error_code {
            fields.push(("last_error_code", error_code.clone()));
        }
        if let Some(ref error_msg) = status.last_error_msg {
            fields.push(("last_error_msg", error_msg.clone()));
        }

        // Set fields and TTL atomically
        let _: () = redis::pipe()
            .hset_multiple(
                &redis_key,
                &fields
                    .iter()
                    .map(|(k, v)| (*k, v.as_str()))
                    .collect::<Vec<_>>(),
            )
            .expire(&redis_key, self.config.status_ttl_secs as i64)
            .query_async(&mut conn)
            .await?;

        Ok(())
    }

    async fn get_run_status(&self, key: &RunStatusKey) -> anyhow::Result<Option<RunStatus>> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        let fields: HashMap<String, String> = conn.hgetall(&redis_key).await?;

        if fields.is_empty() {
            return Ok(None);
        }

        let state = fields
            .get("state")
            .and_then(|s| serde_json::from_str(s).ok())
            .unwrap_or(RunState::Idle);

        let status = RunStatus {
            state,
            run_id: fields.get("run_id").cloned().unwrap_or_default(),
            worker_id: fields.get("worker_id").cloned().unwrap_or_default(),
            lower_ts: fields.get("lower_ts").cloned(),
            upper_ts: fields.get("upper_ts").cloned(),
            page_seq: fields
                .get("page_seq")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            current_cursor: fields.get("current_cursor").cloned(),
            current_offset: fields.get("current_offset").and_then(|s| s.parse().ok()),
            items_total: fields
                .get("items_total")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            items_list_only: fields
                .get("items_list_only")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            items_detail_enqueued: fields
                .get("items_detail_enqueued")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            items_detail_skipped: fields
                .get("items_detail_skipped")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            lag_detail_consumer: fields
                .get("lag_detail_consumer")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            backoff_seconds: fields
                .get("backoff_seconds")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            started_at: fields
                .get("started_at")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            updated_at: fields
                .get("updated_at")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            heartbeat_ts: fields
                .get("heartbeat_ts")
                .and_then(|s| s.parse().ok())
                .unwrap_or(0),
            last_error_code: fields.get("last_error_code").cloned(),
            last_error_msg: fields.get("last_error_msg").cloned(),
        };

        Ok(Some(status))
    }

    async fn acquire_lock(&self, key: &LockKey, token: &str, ttl_ms: u64) -> anyhow::Result<bool> {
        let mut conn = self.get_connection().await?;
        let script = Self::lock_acquire_script();

        let result: i32 = script
            .key(key.to_key())
            .arg(token)
            .arg(ttl_ms)
            .invoke_async(&mut conn)
            .await?;

        Ok(result == 1)
    }

    async fn renew_lock(&self, key: &LockKey, token: &str, ttl_ms: u64) -> anyhow::Result<bool> {
        let mut conn = self.get_connection().await?;
        let script = Self::lock_renew_script();

        let result: i32 = script
            .key(key.to_key())
            .arg(token)
            .arg(ttl_ms)
            .invoke_async(&mut conn)
            .await?;

        Ok(result == 1)
    }

    async fn release_lock(&self, key: &LockKey, token: &str) -> anyhow::Result<bool> {
        let mut conn = self.get_connection().await?;
        let script = Self::lock_release_script();

        let result: i32 = script
            .key(key.to_key())
            .arg(token)
            .invoke_async(&mut conn)
            .await?;

        Ok(result == 1)
    }

    async fn add_progress_entry(
        &self,
        key: &ProgressKey,
        entry: &ProgressEntry,
    ) -> anyhow::Result<()> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        let fields = vec![
            ("page_seq", entry.page_seq.to_string()),
            ("items_emitted", entry.items_emitted.to_string()),
            ("cursor", entry.cursor.clone().unwrap_or_default()),
            (
                "offset",
                entry.offset.map_or(String::new(), |o| o.to_string()),
            ),
            ("duration_ms", entry.duration_ms.to_string()),
            ("detail_enqueued", entry.detail_enqueued.to_string()),
            ("snapshot_upserts", entry.snapshot_upserts.to_string()),
            ("errors", entry.errors.to_string()),
        ];

        // Add to stream with max length
        let _: String = conn
            .xadd_maxlen(
                &redis_key,
                redis::streams::StreamMaxlen::Approx(self.config.stream_maxlen as usize),
                "*",
                &fields
                    .iter()
                    .map(|(k, v)| (*k, v.as_str()))
                    .collect::<Vec<_>>(),
            )
            .await?;

        Ok(())
    }

    async fn list_progress_entries(
        &self,
        key: &ProgressKey,
        limit: usize,
        cursor: Option<String>,
    ) -> anyhow::Result<Vec<ProgressRecord>> {
        let mut conn = self.get_connection().await?;
        let redis_key = key.to_key();

        let start = cursor
            .map(|id| format!("({}", id))
            .unwrap_or_else(|| "+".to_string());

        let reply: StreamRangeReply = redis::cmd("XREVRANGE")
            .arg(&redis_key)
            .arg(start)
            .arg("-")
            .arg("COUNT")
            .arg(limit as isize)
            .query_async(&mut conn)
            .await?;

        let mut records = Vec::with_capacity(reply.ids.len());
        for id in reply.ids {
            let mut map = std::collections::HashMap::new();
            for (field, value) in id.map.iter() {
                map.insert(field.clone(), redis_value_to_string(value));
            }

            let entry = ProgressEntry {
                page_seq: map
                    .get("page_seq")
                    .and_then(|v| v.parse::<u32>().ok())
                    .unwrap_or_default(),
                items_emitted: map
                    .get("items_emitted")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or_default(),
                cursor: map
                    .get("cursor")
                    .map(|v| v.clone())
                    .filter(|v| !v.is_empty()),
                offset: map.get("offset").and_then(|v| {
                    if v.is_empty() {
                        None
                    } else {
                        v.parse::<i64>().ok()
                    }
                }),
                duration_ms: map
                    .get("duration_ms")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or_default(),
                detail_enqueued: map
                    .get("detail_enqueued")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or_default(),
                snapshot_upserts: map
                    .get("snapshot_upserts")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or_default(),
                errors: map
                    .get("errors")
                    .and_then(|v| v.parse::<u64>().ok())
                    .unwrap_or_default(),
            };

            records.push(ProgressRecord { id: id.id, entry });
        }

        Ok(records)
    }
}

fn redis_value_to_string(value: &Value) -> String {
    if let Ok(s) = redis::from_redis_value::<String>(value) {
        return s;
    }

    match value {
        Value::Nil => String::new(),
        Value::Int(v) => v.to_string(),
        Value::Double(v) => v.to_string(),
        Value::Boolean(v) => v.to_string(),
        Value::BulkString(bytes) => String::from_utf8_lossy(bytes).to_string(),
        Value::SimpleString(s) => s.clone(),
        Value::Array(items) | Value::Set(items) => items
            .iter()
            .map(redis_value_to_string)
            .collect::<Vec<_>>()
            .join(","),
        Value::Map(entries) => entries
            .iter()
            .map(|(k, v)| format!("{}={}", redis_value_to_string(k), redis_value_to_string(v)))
            .collect::<Vec<_>>()
            .join(","),
        Value::Attribute { data, attributes } => {
            let mut base = redis_value_to_string(data);
            if !attributes.is_empty() {
                let attr = attributes
                    .iter()
                    .map(|(k, v)| {
                        format!("{}={}", redis_value_to_string(k), redis_value_to_string(v))
                    })
                    .collect::<Vec<_>>()
                    .join(",");
                if !attr.is_empty() {
                    if !base.is_empty() {
                        base.push(' ');
                    }
                    base.push('[');
                    base.push_str(&attr);
                    base.push(']');
                }
            }
            base
        }
        Value::VerbatimString { text, .. } => text.clone(),
        Value::BigNumber(num) => num.to_string(),
        Value::Push { data, .. } => data
            .iter()
            .map(redis_value_to_string)
            .collect::<Vec<_>>()
            .join(","),
        Value::Okay => "OK".to_string(),
        Value::ServerError(err) => format!("{:?}", err),
    }
}
