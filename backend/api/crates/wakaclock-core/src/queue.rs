// crates/wakaclock-core/src/queue.rs

use crate::{
    error::AppError,
    heartbeat::{union_activity_seconds, ActivitySegment},
};
use chrono::{DateTime, TimeZone, Utc};
use chrono_tz::Tz;
use rusqlite::{params, Connection};
use serde_json;
use std::path::PathBuf;
use uuid::Uuid;

pub struct Queue {
    conn: Connection,
}

impl Queue {
    /// เปิด SQLite database ที่ ~/.wakaclock/queue.db
    pub fn open() -> Result<Self, AppError> {
        let path = Self::db_path();

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(AppError::Io)?;
        }

        let conn = Connection::open(&path).map_err(AppError::Queue)?;
        conn.busy_timeout(std::time::Duration::from_secs(2))
            .map_err(AppError::Queue)?;

        // สร้าง table ถ้ายังไม่มี
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS heartbeat_queue (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                heartbeat_id TEXT,
                payload     TEXT NOT NULL,        -- JSON ของ heartbeat
                created_at  INTEGER NOT NULL,     -- unix timestamp
                retry_count INTEGER DEFAULT 0,
                next_retry_at INTEGER DEFAULT 0
            );

            -- ลบ rows ที่เก่าเกิน 30 วันอัตโนมัติ
            DELETE FROM heartbeat_queue
            WHERE created_at < strftime('%s', 'now') - 2592000;
        ",
        )
        .map_err(AppError::Queue)?;

        // Older queue databases predate retry scheduling. Migrate them in place so an
        // upgrade never drops durable heartbeats or hammers a server that is offline.
        let has_retry_column: bool = conn
            .prepare("PRAGMA table_info(heartbeat_queue)")
            .map_err(AppError::Queue)?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(AppError::Queue)?
            .filter_map(Result::ok)
            .any(|name| name == "next_retry_at");
        if !has_retry_column {
            conn.execute(
                "ALTER TABLE heartbeat_queue ADD COLUMN next_retry_at INTEGER DEFAULT 0",
                [],
            )
            .map_err(AppError::Queue)?;
        }

        let has_heartbeat_id: bool = conn
            .prepare("PRAGMA table_info(heartbeat_queue)")
            .map_err(AppError::Queue)?
            .query_map([], |row| row.get::<_, String>(1))
            .map_err(AppError::Queue)?
            .filter_map(Result::ok)
            .any(|name| name == "heartbeat_id");
        if !has_heartbeat_id {
            conn.execute(
                "ALTER TABLE heartbeat_queue ADD COLUMN heartbeat_id TEXT",
                [],
            )
            .map_err(AppError::Queue)?;
        }

        // Backfill identities for rows written by pre-id clients. When the old payload
        // has no identity at all, derive one from the exact JSON bytes and persist it
        // into the payload too. That makes an interrupted flush/restart converge on one
        // queue row without pretending to rewrite the server's raw history.
        let legacy: Vec<(i64, String)> = {
            let mut statement = conn
                .prepare("SELECT id, payload FROM heartbeat_queue WHERE heartbeat_id IS NULL")
                .map_err(AppError::Queue)?;
            let rows = statement
                .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
                .map_err(AppError::Queue)?
                .filter_map(Result::ok)
                .collect();
            rows
        };
        for (id, payload) in legacy {
            let Ok(mut value) = serde_json::from_str::<serde_json::Value>(&payload) else {
                continue;
            };
            let heartbeat_id = value
                .get("heartbeat_id")
                .and_then(|value| value.as_str())
                .filter(|value| !value.trim().is_empty())
                .map(str::to_string)
                .unwrap_or_else(|| {
                    let namespace = Uuid::new_v5(&Uuid::NAMESPACE_OID, payload.as_bytes());
                    format!("legacy:{namespace}")
                });
            if let Some(object) = value.as_object_mut() {
                object.insert(
                    "heartbeat_id".to_string(),
                    serde_json::Value::String(heartbeat_id.clone()),
                );
            }
            let updated_payload = serde_json::to_string(&value).unwrap_or(payload);
            let _ = conn.execute(
                "UPDATE heartbeat_queue SET heartbeat_id = ?1, payload = ?2 WHERE id = ?3 AND heartbeat_id IS NULL",
                params![heartbeat_id, updated_payload, id],
            );
        }
        // A crash in an older client could leave the same payload queued twice. The
        // durable queue is transport state (raw server history is untouched), so retain
        // the oldest copy and make the identity index enforce idempotency from here on.
        conn.execute(
            "DELETE FROM heartbeat_queue
             WHERE heartbeat_id IS NOT NULL
               AND id NOT IN (
                 SELECT MIN(id) FROM heartbeat_queue
                 WHERE heartbeat_id IS NOT NULL GROUP BY heartbeat_id
               )",
            [],
        )
        .map_err(AppError::Queue)?;
        conn.execute("DROP INDEX IF EXISTS heartbeat_queue_heartbeat_id_idx", [])
            .map_err(AppError::Queue)?;
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS heartbeat_queue_heartbeat_id_idx
             ON heartbeat_queue(heartbeat_id) WHERE heartbeat_id IS NOT NULL",
            [],
        )
        .map_err(AppError::Queue)?;

        Ok(Self { conn })
    }

    /// บันทึก heartbeat payload ลง queue
    pub fn push(&self, payload: &serde_json::Value) -> Result<(), AppError> {
        let json = serde_json::to_string(payload).map_err(AppError::Serde)?;

        let now = chrono::Utc::now().timestamp();

        let heartbeat_id = payload
            .get("heartbeat_id")
            .and_then(|value| value.as_str())
            .filter(|value| !value.trim().is_empty());
        if let Some(heartbeat_id) = heartbeat_id {
            let exists: bool = self
                .conn
                .query_row(
                    "SELECT EXISTS(SELECT 1 FROM heartbeat_queue WHERE heartbeat_id = ?1)",
                    params![heartbeat_id],
                    |row| row.get(0),
                )
                .map_err(AppError::Queue)?;
            if exists {
                return Ok(());
            }
        }

        self.conn
            .execute(
                "INSERT OR IGNORE INTO heartbeat_queue (heartbeat_id, payload, created_at) VALUES (?1, ?2, ?3)",
                params![heartbeat_id, json, now],
            )
            .map_err(AppError::Queue)?;

        Ok(())
    }

    /// ดึง heartbeats ทั้งหมดที่ค้างอยู่
    pub fn pop_all(&self) -> Result<Vec<(i64, serde_json::Value)>, AppError> {
        let mut stmt = self
            .conn
            .prepare(
                "SELECT id, payload FROM heartbeat_queue
                 WHERE next_retry_at <= strftime('%s', 'now')
                 ORDER BY created_at ASC",
            )
            .map_err(AppError::Queue)?;

        let rows = stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let json: String = row.get(1)?;
                Ok((id, json))
            })
            .map_err(AppError::Queue)?;

        let mut result = vec![];
        for row in rows {
            let (id, json) = row.map_err(AppError::Queue)?;
            let value: serde_json::Value = serde_json::from_str(&json).map_err(AppError::Serde)?;
            result.push((id, value));
        }

        Ok(result)
    }

    /// Delay a failed row with bounded exponential backoff. The payload remains in
    /// SQLite and is eligible again after 60s, 120s, 240s ... up to one hour.
    pub fn mark_retry(&self, id: i64) -> Result<(), AppError> {
        self.conn
            .execute(
                "UPDATE heartbeat_queue
                 SET retry_count = retry_count + 1,
                     next_retry_at = strftime('%s', 'now') +
                       CASE
                         WHEN retry_count < 1 THEN 60
                         WHEN retry_count < 2 THEN 120
                         WHEN retry_count < 3 THEN 240
                         WHEN retry_count < 4 THEN 480
                         WHEN retry_count < 5 THEN 960
                         WHEN retry_count < 6 THEN 1920
                         ELSE 3600
                       END
                 WHERE id = ?1",
                params![id],
            )
            .map_err(AppError::Queue)?;
        Ok(())
    }

    /// ลบ heartbeat ที่ส่งสำเร็จแล้วออกจาก queue
    pub fn remove(&self, id: i64) -> Result<(), AppError> {
        self.conn
            .execute("DELETE FROM heartbeat_queue WHERE id = ?1", params![id])
            .map_err(AppError::Queue)?;

        Ok(())
    }

    /// จำนวน heartbeats ที่ค้างอยู่
    pub fn len(&self) -> Result<usize, AppError> {
        let count: usize = self
            .conn
            .query_row("SELECT COUNT(*) FROM heartbeat_queue", [], |row| row.get(0))
            .map_err(AppError::Queue)?;

        Ok(count)
    }

    /// Whether the durable heartbeat queue has no pending rows.
    pub fn is_empty(&self) -> Result<bool, AppError> {
        Ok(self.len()? == 0)
    }

    /// Sum the active time in the offline queue for the calendar day in `timezone`.
    /// Queue entries keep the original heartbeat timestamp, so a heartbeat queued just
    /// before midnight is not accidentally shown on the wrong local day after a
    /// restart. Malformed legacy rows are ignored rather than making the status bar
    /// unavailable.
    pub fn queued_seconds_for_day(&self, timezone: Option<&str>) -> Result<f64, AppError> {
        Ok(union_activity_seconds(
            &self.queued_segments_for_day(timezone)?,
        ))
    }

    /// Return the queued intervals for the local day. Keeping intervals (rather than
    /// only a sum) lets the CLI union offline data with server-confirmed intervals
    /// without counting a retry twice while a flush is in flight.
    pub fn queued_segments_for_day(
        &self,
        timezone: Option<&str>,
    ) -> Result<Vec<ActivitySegment>, AppError> {
        let zone: Tz = timezone
            .filter(|value| !value.trim().is_empty())
            .unwrap_or("UTC")
            .parse()
            .map_err(|_| AppError::Validation("invalid timezone".to_string()))?;
        let today = Utc::now().with_timezone(&zone).date_naive();
        let day_start = zone
            .from_local_datetime(&today.and_hms_opt(0, 0, 0).expect("valid midnight"))
            .single()
            .map(|value| value.timestamp() as f64)
            .unwrap_or(0.0);
        let next_day_start = zone
            .from_local_datetime(
                &today
                    .succ_opt()
                    .expect("valid next day")
                    .and_hms_opt(0, 0, 0)
                    .expect("valid midnight"),
            )
            .single()
            .map(|value| value.timestamp() as f64)
            .unwrap_or(day_start + 86_400.0);
        let mut stmt = self
            .conn
            .prepare("SELECT payload FROM heartbeat_queue")
            .map_err(AppError::Queue)?;
        let rows = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(AppError::Queue)?;
        let mut segments_for_day = Vec::new();
        for row in rows {
            let json = row.map_err(AppError::Queue)?;
            let Ok(value) = serde_json::from_str::<serde_json::Value>(&json) else {
                continue;
            };
            let Some(time) = value.get("time").and_then(serde_json::Value::as_f64) else {
                continue;
            };
            if !time.is_finite() {
                continue;
            }
            let seconds = time.floor() as i64;
            let nanos = ((time - time.floor()).max(0.0) * 1_000_000_000.0) as u32;
            let Some(timestamp) = DateTime::<Utc>::from_timestamp(seconds, nanos) else {
                continue;
            };
            if timestamp.with_timezone(&zone).date_naive() == today {
                let mut segments = value
                    .get("activity_segments")
                    .and_then(|value| {
                        serde_json::from_value::<Vec<ActivitySegment>>(value.clone()).ok()
                    })
                    .unwrap_or_default();
                if segments.is_empty() {
                    if let Some(active_seconds) = value
                        .get("active_seconds")
                        .and_then(serde_json::Value::as_f64)
                    {
                        if active_seconds.is_finite()
                            && active_seconds > 0.0
                            && active_seconds <= 120.0
                        {
                            segments.push(ActivitySegment {
                                segment_id: format!(
                                    "legacy:{}",
                                    value
                                        .get("heartbeat_id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("queue")
                                ),
                                start: (time - active_seconds).max(0.0),
                                end: time,
                                source: None,
                            });
                        }
                    }
                }
                for segment in segments {
                    let clipped_start = segment.start.max(day_start);
                    let clipped_end = segment.end.min(next_day_start);
                    if clipped_end > clipped_start {
                        segments_for_day.push(ActivitySegment {
                            start: clipped_start,
                            end: clipped_end,
                            source: Some("queued".to_string()),
                            ..segment
                        });
                    }
                }
            }
        }
        Ok(segments_for_day)
    }

    fn db_path() -> PathBuf {
        let home = dirs::home_dir().expect("หา home directory ไม่เจอ");
        home.join(".wakaclock").join("queue.db")
    }
}
