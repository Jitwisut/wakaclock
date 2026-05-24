use async_trait::async_trait;
use redis::aio::MultiplexedConnection;
use redis::{streams::StreamRangeReply, AsyncCommands, Value};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::instrument;

use crate::infrastructure::sync::{
    IdempotencyKey, LockKey, ProgressEntry, ProgressKey, ProgressRecord, RunStatus, RunStatusKey,
    SyncStateManager, SyncStats, SyncStatsKey,
};

/// Redis implementation of SyncStateManager
pub struct RedisSyncStateManagerImpl {
    connection: Arc<tokio::sync::Mutex<MultiplexedConnection>>,
    ttl_secs: u64,
}

impl RedisSyncStateManagerImpl {
    pub async fn new(redis_url: &str, ttl_secs: Option<u64>) -> anyhow::Result<Self> {
        let client = redis::Client::open(redis_url)?;
        let connection = client.get_multiplexed_tokio_connection().await?;

        Ok(Self {
            connection: Arc::new(tokio::sync::Mutex::new(connection)),
            ttl_secs: ttl_secs.unwrap_or(86400), // 24 hours default
        })
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

#[async_trait]
impl SyncStateManager for RedisSyncStateManagerImpl {
    #[instrument(skip(self, stats))]
    async fn update_sync_stats(&self, key: &SyncStatsKey, stats: &SyncStats) -> anyhow::Result<()> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // Serialize stats to JSON
        let stats_json = serde_json::to_string(stats)?;

        // Set with TTL
        let _: () = redis::cmd("SET")
            .arg(&redis_key)
            .arg(&stats_json)
            .arg("EX")
            .arg(self.ttl_secs)
            .query_async(&mut *conn)
            .await?;

        Ok(())
    }

    #[instrument(skip(self))]
    async fn get_sync_stats(&self, key: &SyncStatsKey) -> anyhow::Result<Option<SyncStats>> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        let result: Option<String> = conn.get(&redis_key).await?;

        match result {
            Some(json_str) => {
                let stats = serde_json::from_str(&json_str)?;
                Ok(Some(stats))
            }
            None => Ok(None),
        }
    }

    #[instrument(skip(self, product_ids))]
    async fn check_processed(
        &self,
        key: &IdempotencyKey,
        product_ids: &[String],
    ) -> anyhow::Result<Vec<bool>> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        let mut results = Vec::with_capacity(product_ids.len());

        for product_id in product_ids {
            let exists: bool = conn.sismember(&redis_key, product_id).await?;
            results.push(exists);
        }

        Ok(results)
    }

    async fn mark_processed(
        &self,
        key: &IdempotencyKey,
        product_ids: &[String],
    ) -> anyhow::Result<()> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // Add all product IDs to set
        if !product_ids.is_empty() {
            conn.sadd::<_, _, ()>(&redis_key, product_ids).await?;
            // Set TTL on the set
            conn.expire::<_, ()>(&redis_key, self.ttl_secs as i64)
                .await?;
        }

        Ok(())
    }

    async fn update_run_status(
        &self,
        key: &RunStatusKey,
        status: &RunStatus,
    ) -> anyhow::Result<()> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // Convert status to hash fields
        let mut fields: Vec<(String, String)> = vec![
            ("state".to_string(), serde_json::to_string(&status.state)?),
            ("run_id".to_string(), status.run_id.clone()),
            ("worker_id".to_string(), status.worker_id.clone()),
            ("page_seq".to_string(), status.page_seq.to_string()),
            ("items_total".to_string(), status.items_total.to_string()),
            (
                "items_list_only".to_string(),
                status.items_list_only.to_string(),
            ),
            (
                "items_detail_enqueued".to_string(),
                status.items_detail_enqueued.to_string(),
            ),
            (
                "items_detail_skipped".to_string(),
                status.items_detail_skipped.to_string(),
            ),
            (
                "lag_detail_consumer".to_string(),
                status.lag_detail_consumer.to_string(),
            ),
            (
                "backoff_seconds".to_string(),
                status.backoff_seconds.to_string(),
            ),
            ("started_at".to_string(), status.started_at.to_string()),
            ("updated_at".to_string(), status.updated_at.to_string()),
            ("heartbeat_ts".to_string(), status.heartbeat_ts.to_string()),
        ];

        // Add optional fields
        if let Some(ref lower) = status.lower_ts {
            fields.push(("lower_ts".to_string(), lower.clone()));
        }
        if let Some(ref upper) = status.upper_ts {
            fields.push(("upper_ts".to_string(), upper.clone()));
        }
        if let Some(ref cursor) = status.current_cursor {
            fields.push(("current_cursor".to_string(), cursor.clone()));
        }
        if let Some(ref offset) = status.current_offset {
            fields.push(("current_offset".to_string(), offset.to_string()));
        }
        if let Some(ref code) = status.last_error_code {
            fields.push(("last_error_code".to_string(), code.clone()));
        }
        if let Some(ref msg) = status.last_error_msg {
            fields.push(("last_error_msg".to_string(), msg.clone()));
        }

        // Use HSET to update all fields
        conn.hset_multiple::<_, _, _, ()>(&redis_key, &fields)
            .await?;
        conn.expire::<_, ()>(&redis_key, self.ttl_secs as i64)
            .await?;

        Ok(())
    }

    #[instrument(skip(self))]
    async fn get_run_status(&self, key: &RunStatusKey) -> anyhow::Result<Option<RunStatus>> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // Get all hash fields
        let result: Option<HashMap<String, String>> = conn.hgetall(&redis_key).await?;

        match result {
            Some(fields) if !fields.is_empty() => {
                // Parse fields into RunStatus
                let status = RunStatus {
                    state: serde_json::from_str(
                        fields
                            .get("state")
                            .ok_or_else(|| anyhow::anyhow!("Missing state field"))?,
                    )?,
                    run_id: fields
                        .get("run_id")
                        .ok_or_else(|| anyhow::anyhow!("Missing run_id"))?
                        .clone(),
                    worker_id: fields
                        .get("worker_id")
                        .ok_or_else(|| anyhow::anyhow!("Missing worker_id"))?
                        .clone(),
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
            _ => Ok(None),
        }
    }

    #[instrument(skip(self))]
    async fn acquire_lock(&self, key: &LockKey, token: &str, ttl_ms: u64) -> anyhow::Result<bool> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // SET NX PX - set if not exists with millisecond expiry
        let result: Option<String> = redis::cmd("SET")
            .arg(&redis_key)
            .arg(token)
            .arg("NX")
            .arg("PX")
            .arg(ttl_ms)
            .query_async(&mut *conn)
            .await?;

        Ok(result.is_some())
    }

    #[instrument(skip(self))]
    async fn renew_lock(&self, key: &LockKey, token: &str, ttl_ms: u64) -> anyhow::Result<bool> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // Check if we own the lock
        let current_token: Option<String> = conn.get(&redis_key).await?;

        if current_token.as_deref() == Some(token) {
            // Renew the TTL
            let result: bool = conn.pexpire(&redis_key, ttl_ms as i64).await?;
            Ok(result)
        } else {
            Ok(false)
        }
    }

    #[instrument(skip(self))]
    async fn release_lock(&self, key: &LockKey, token: &str) -> anyhow::Result<bool> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // Use Lua script to ensure atomic check-and-delete
        let script = r#"
            if redis.call("get", KEYS[1]) == ARGV[1] then
                return redis.call("del", KEYS[1])
            else
                return 0
            end
        "#;

        let result: i32 = redis::Script::new(script)
            .key(&redis_key)
            .arg(token)
            .invoke_async(&mut *conn)
            .await?;

        Ok(result == 1)
    }

    async fn add_progress_entry(
        &self,
        key: &ProgressKey,
        entry: &ProgressEntry,
    ) -> anyhow::Result<()> {
        let mut conn = self.connection.lock().await;
        let redis_key = key.to_key();

        // Convert entry to field-value pairs
        let fields: Vec<(&str, String)> = vec![
            ("page_seq", entry.page_seq.to_string()),
            ("items_emitted", entry.items_emitted.to_string()),
            ("cursor", entry.cursor.clone().unwrap_or_default()),
            (
                "offset",
                entry.offset.map(|o| o.to_string()).unwrap_or_default(),
            ),
            ("duration_ms", entry.duration_ms.to_string()),
            ("detail_enqueued", entry.detail_enqueued.to_string()),
            ("snapshot_upserts", entry.snapshot_upserts.to_string()),
            ("errors", entry.errors.to_string()),
        ];

        // XADD with max length limit
        redis::cmd("XADD")
            .arg(&redis_key)
            .arg("MAXLEN")
            .arg("~")
            .arg(10000)
            .arg("*")
            .arg(&fields)
            .query_async::<()>(&mut *conn)
            .await?;

        Ok(())
    }

    async fn list_progress_entries(
        &self,
        key: &ProgressKey,
        limit: usize,
        cursor: Option<String>,
    ) -> anyhow::Result<Vec<ProgressRecord>> {
        let mut conn = self.connection.lock().await;
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
            .query_async(&mut *conn)
            .await?;

        let mut records = Vec::with_capacity(reply.ids.len());
        for id in reply.ids {
            let mut entry = ProgressEntry {
                page_seq: 0,
                items_emitted: 0,
                cursor: None,
                offset: None,
                duration_ms: 0,
                detail_enqueued: 0,
                snapshot_upserts: 0,
                errors: 0,
            };

            for (field, value) in id.map.iter() {
                let value_str = redis_value_to_string(value);
                match field.as_str() {
                    "page_seq" => entry.page_seq = value_str.parse().unwrap_or_default(),
                    "items_emitted" => entry.items_emitted = value_str.parse().unwrap_or_default(),
                    "cursor" => {
                        if !value_str.is_empty() {
                            entry.cursor = Some(value_str.to_string())
                        }
                    }
                    "offset" => {
                        if !value_str.is_empty() {
                            entry.offset = value_str.parse().ok();
                        }
                    }
                    "duration_ms" => entry.duration_ms = value_str.parse().unwrap_or_default(),
                    "detail_enqueued" => {
                        entry.detail_enqueued = value_str.parse().unwrap_or_default()
                    }
                    "snapshot_upserts" => {
                        entry.snapshot_upserts = value_str.parse().unwrap_or_default()
                    }
                    "errors" => entry.errors = value_str.parse().unwrap_or_default(),
                    _ => {}
                }
            }

            records.push(ProgressRecord { id: id.id, entry });
        }

        Ok(records)
    }
}
