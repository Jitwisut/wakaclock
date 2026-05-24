use anyhow::Result;
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;
use wakaclock_core::heartbeat::Heartbeat;

use crate::model::heartbeat::HeartbeatRow;
use crate::repository::heartbeat::HeartbeatRepository;

pub struct HeartbeatService {
    repo: Arc<HeartbeatRepository>,
}

impl HeartbeatService {
    pub fn new(repo: Arc<HeartbeatRepository>) -> Self {
        Self { repo }
    }

    /// Process incoming heartbeats และ insert ลง repository
    pub async fn process_heartbeats(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
    ) -> Result<()> {
        let mut rows = Vec::with_capacity(heartbeats.len());

        for mut hb in heartbeats {
            if !machine.is_empty() {
                hb.machine = machine.clone();
            }

            let date = (hb.time as i64 / 86400).max(0) as u16;
            let created_at = parse_created_at(&hb.created_at);

            let row = HeartbeatRow {
                user_id,
                entity: hb.entity,
                entity_type: format!("{:?}", hb.entity_type).to_lowercase(),
                time: hb.time,
                date,
                project: hb.project,
                branch: hb.branch,
                language: hb.language,
                dependencies: hb.dependencies,
                lines: hb.lines,
                line_number: hb.line_number,
                cursor_position: hb.cursor_position,
                is_write: hb.is_write,
                category: format!("{:?}", hb.category).to_lowercase(),
                editor: hb.editor,
                operating_system: hb.operating_system,
                machine: hb.machine,
                user_agent: hb.user_agent,
                ast_language: hb.ast_language,
                ast_confidence: hb.ast_confidence,
                keystrokes: hb.keystrokes,
                chars_added: hb.chars_added,
                chars_deleted: hb.chars_deleted,
                active_seconds: hb.active_seconds,
                is_ai_generated: hb.is_ai_generated,
                ai_agent: hb.ai_agent,
                ai_lines_added: hb.ai_lines_added,
                ai_lines_deleted: hb.ai_lines_deleted,
                created_at,
            };

            rows.push(row);
        }

        self.repo.insert_batch(rows).await?;
        Ok(())
    }

    /// ดึง heartbeats ตามวันที่ "YYYY-MM-DD"
    pub async fn get_by_date(&self, user_id: Uuid, date: &str) -> Result<Vec<HeartbeatRow>> {
        self.repo.get_by_date(user_id, date).await
    }
}

fn parse_created_at(created_at: &str) -> u32 {
    chrono::DateTime::parse_from_rfc3339(created_at)
        .map(|dt| dt.timestamp().max(0) as u32)
        .unwrap_or_else(|_| Utc::now().timestamp().max(0) as u32)
}
