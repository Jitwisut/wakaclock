// crates/wakaclock-core/src/queue.rs

use crate::error::AppError;
use rusqlite::{params, Connection};
use serde_json;
use std::path::PathBuf;

pub struct Queue {
    conn: Connection,
}

impl Queue {
    /// เปิด SQLite database ที่ ~/.wakaclock/queue.db
    pub fn open() -> Result<Self, AppError> {
        let path = Self::db_path();

        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent).map_err(|e| AppError::Io(e))?;
        }

        let conn = Connection::open(&path).map_err(|e| AppError::Queue(e))?;

        // สร้าง table ถ้ายังไม่มี
        conn.execute_batch(
            "
            CREATE TABLE IF NOT EXISTS heartbeat_queue (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                payload     TEXT NOT NULL,        -- JSON ของ heartbeat
                created_at  INTEGER NOT NULL,     -- unix timestamp
                retry_count INTEGER DEFAULT 0
            );

            -- ลบ rows ที่เก่าเกิน 30 วันอัตโนมัติ
            DELETE FROM heartbeat_queue
            WHERE created_at < strftime('%s', 'now') - 2592000;
        ",
        )
        .map_err(|e| AppError::Queue(e))?;

        Ok(Self { conn })
    }

    /// บันทึก heartbeat payload ลง queue
    pub fn push(&self, payload: &serde_json::Value) -> Result<(), AppError> {
        let json = serde_json::to_string(payload).map_err(|e| AppError::Serde(e))?;

        let now = chrono::Utc::now().timestamp();

        self.conn
            .execute(
                "INSERT INTO heartbeat_queue (payload, created_at) VALUES (?1, ?2)",
                params![json, now],
            )
            .map_err(|e| AppError::Queue(e))?;

        Ok(())
    }

    /// ดึง heartbeats ทั้งหมดที่ค้างอยู่
    pub fn pop_all(&self) -> Result<Vec<(i64, serde_json::Value)>, AppError> {
        let mut stmt = self
            .conn
            .prepare("SELECT id, payload FROM heartbeat_queue ORDER BY created_at ASC")
            .map_err(|e| AppError::Queue(e))?;

        let rows = stmt
            .query_map([], |row| {
                let id: i64 = row.get(0)?;
                let json: String = row.get(1)?;
                Ok((id, json))
            })
            .map_err(|e| AppError::Queue(e))?;

        let mut result = vec![];
        for row in rows {
            let (id, json) = row.map_err(|e| AppError::Queue(e))?;
            let value: serde_json::Value =
                serde_json::from_str(&json).map_err(|e| AppError::Serde(e))?;
            result.push((id, value));
        }

        Ok(result)
    }

    /// ลบ heartbeat ที่ส่งสำเร็จแล้วออกจาก queue
    pub fn remove(&self, id: i64) -> Result<(), AppError> {
        self.conn
            .execute("DELETE FROM heartbeat_queue WHERE id = ?1", params![id])
            .map_err(|e| AppError::Queue(e))?;

        Ok(())
    }

    /// จำนวน heartbeats ที่ค้างอยู่
    pub fn len(&self) -> Result<usize, AppError> {
        let count: usize = self
            .conn
            .query_row("SELECT COUNT(*) FROM heartbeat_queue", [], |row| row.get(0))
            .map_err(|e| AppError::Queue(e))?;

        Ok(count)
    }

    fn db_path() -> PathBuf {
        let home = dirs::home_dir().expect("หา home directory ไม่เจอ");
        home.join(".wakaclock").join("queue.db")
    }
}
