use anyhow::Result;
use chrono::Utc;
use sha2::{Digest, Sha256};
use std::collections::HashSet;
use std::sync::Arc;
use uuid::Uuid;
use wakaclock_core::heartbeat::Heartbeat;

use crate::model::heartbeat::HeartbeatRow;
use crate::repository::heartbeat::HeartbeatRepository;
use crate::services::project_identity::ProjectIdentityService;

pub struct HeartbeatService {
    repo: Arc<HeartbeatRepository>,
    project_identity_service: Arc<ProjectIdentityService>,
}

impl HeartbeatService {
    pub fn new(
        repo: Arc<HeartbeatRepository>,
        project_identity_service: Arc<ProjectIdentityService>,
    ) -> Self {
        Self {
            repo,
            project_identity_service,
        }
    }

    /// Process incoming heartbeats และ insert ลง repository
    pub async fn process_heartbeats(
        &self,
        user_id: Uuid,
        machine: String,
        heartbeats: Vec<Heartbeat>,
    ) -> Result<usize> {
        let mut rows = Vec::with_capacity(heartbeats.len());
        let mut batch_event_ids = HashSet::new();
        let candidate_event_ids: Vec<String> = heartbeats
            .iter()
            .filter_map(|heartbeat| heartbeat.ai_event_id.clone())
            .collect();
        let existing_event_ids: HashSet<String> = self
            .repo
            .existing_ai_event_ids(user_id, &candidate_event_ids)
            .await?
            .into_iter()
            .collect();
        let candidate_fingerprints: Vec<String> =
            heartbeats.iter().filter_map(ai_event_fingerprint).collect();
        let existing_fingerprints: HashSet<String> = self
            .repo
            .existing_ai_fingerprints(user_id, &candidate_fingerprints)
            .await?
            .into_iter()
            .collect();
        let mut batch_fingerprints = HashSet::new();

        for mut hb in heartbeats {
            // Bulk retries can contain the same AI event twice. De-duplicate within
            // the request before it reaches ClickHouse; the opaque id is supplied by
            // the agent hook and is not derived from source content.
            if let Some(event_id) = hb.ai_event_id.as_ref() {
                if existing_event_ids.contains(event_id)
                    || !batch_event_ids.insert(event_id.clone())
                {
                    continue;
                }
            }

            let fingerprint = ai_event_fingerprint(&hb);
            if let Some(fingerprint) = fingerprint.as_ref() {
                if existing_fingerprints.contains(fingerprint)
                    || !batch_fingerprints.insert(fingerprint.clone())
                {
                    continue;
                }
            }

            if !machine.is_empty() {
                hb.machine = machine.clone();
            }

            // Project identity belongs on the raw heartbeat at write time. Project-detail
            // projections can then group by a stable ID even when a display name is renamed
            // later; historical NULL rows remain explicitly backfillable in PR 9.9.
            hb.project_id = self
                .project_identity_service
                .resolve_project_id(user_id, hb.project.as_deref(), None)
                .await?;

            let date = (hb.time as i64 / 86400).max(0) as u16;
            let created_at = parse_created_at(&hb.created_at);
            // An AI-marked heartbeat with no provable AI line delta is not a human edit.
            // Preserve any buffered line counters as explicitly unattributed so the
            // dashboard can show uncertainty instead of inflating Human.
            let (
                human_lines_added,
                human_lines_deleted,
                unattributed_lines_added,
                unattributed_lines_deleted,
            ) = if hb.is_ai_generated
                && hb.ai_lines_added.unwrap_or(0) == 0
                && hb.ai_lines_deleted.unwrap_or(0) == 0
                && (hb.human_lines_added.unwrap_or(0) > 0
                    || hb.human_lines_deleted.unwrap_or(0) > 0
                    || hb.unattributed_lines_added.unwrap_or(0) > 0
                    || hb.unattributed_lines_deleted.unwrap_or(0) > 0)
            {
                (
                    None,
                    None,
                    Some(hb.human_lines_added.unwrap_or(0)),
                    Some(hb.human_lines_deleted.unwrap_or(0)),
                )
            } else {
                (
                    hb.human_lines_added,
                    hb.human_lines_deleted,
                    Some(hb.unattributed_lines_added.unwrap_or(0)),
                    Some(hb.unattributed_lines_deleted.unwrap_or(0)),
                )
            };

            let row = HeartbeatRow {
                user_id,
                entity: hb.entity,
                entity_type: format!("{:?}", hb.entity_type).to_lowercase(),
                time: hb.time,
                date,
                project: hb.project,
                project_id: hb.project_id,
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
                ai_provider: hb.ai_provider,
                ai_model: hb.ai_model,
                ai_source: hb.ai_source,
                ai_confidence: hb.ai_confidence,
                ai_event_id: hb.ai_event_id,
                ai_event_fingerprint: fingerprint,
                ai_lines_added: hb.ai_lines_added,
                ai_lines_deleted: hb.ai_lines_deleted,
                human_lines_added,
                human_lines_deleted,
                unattributed_lines_added,
                unattributed_lines_deleted,
                created_at,
            };

            rows.push(row);
        }

        let inserted = rows.len();
        self.repo.insert_batch(rows).await?;
        Ok(inserted)
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

/// Stable privacy-safe bridge between hook and transcript transports. It contains only
/// derived metadata (not a patch or source body) and uses a five-second bucket matching
/// the editor correlation window. The file path is included only as a one-way hash input.
fn ai_event_fingerprint(heartbeat: &Heartbeat) -> Option<String> {
    if !heartbeat.is_ai_generated {
        return None;
    }
    let bucket = (heartbeat.time / 5.0).floor() as i64;
    let mut hasher = Sha256::new();
    let comparable_entity = comparable_entity_key(&heartbeat.entity);
    let values = [
        comparable_entity.as_str(),
        heartbeat.project.as_deref().unwrap_or_default(),
        heartbeat.branch.as_deref().unwrap_or_default(),
        &bucket.to_string(),
        &heartbeat.ai_lines_added.unwrap_or_default().to_string(),
        &heartbeat.ai_lines_deleted.unwrap_or_default().to_string(),
        heartbeat.ai_agent.as_deref().unwrap_or_default(),
        heartbeat.ai_provider.as_deref().unwrap_or_default(),
        heartbeat.ai_model.as_deref().unwrap_or_default(),
    ];
    for value in values {
        hasher.update(value.as_bytes());
        hasher.update([0]);
    }
    Some(format!("v1:{:x}", hasher.finalize()))
}

/// Hook payloads commonly carry an absolute path while transcript replay carries a
/// workspace-relative path. Keep only the final two lexical components as a hash input so
/// those transports can converge without storing or logging the path itself. The project and
/// branch are included separately to keep same-named files in different workspaces apart.
fn comparable_entity_key(entity: &str) -> String {
    let normalized = entity.replace('\\', "/");
    let mut tail = normalized
        .split('/')
        .filter(|part| !part.is_empty() && *part != ".")
        .rev()
        .take(2)
        .collect::<Vec<_>>();
    tail.reverse();
    if tail.is_empty() {
        "unknown".to_string()
    } else {
        tail.join("/")
    }
}

#[cfg(test)]
mod tests {
    use super::{ai_event_fingerprint, comparable_entity_key};
    use wakaclock_core::heartbeat::{EntityType, Heartbeat};

    #[test]
    fn fingerprint_is_stable_for_the_same_derived_event() {
        let mut heartbeat = Heartbeat::new(
            uuid::Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        heartbeat.time = 100.1;
        heartbeat.is_ai_generated = true;
        heartbeat.ai_lines_added = Some(3);
        assert_eq!(
            ai_event_fingerprint(&heartbeat),
            ai_event_fingerprint(&heartbeat)
        );
    }

    #[test]
    fn manual_heartbeats_have_no_ai_fingerprint() {
        let heartbeat = Heartbeat::new(
            uuid::Uuid::nil(),
            "src/main.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        assert!(ai_event_fingerprint(&heartbeat).is_none());
    }

    #[test]
    fn fingerprint_path_key_bridges_absolute_and_relative_transport_paths() {
        assert_eq!(
            comparable_entity_key("/Users/alice/workspace/src/main.rs"),
            comparable_entity_key("src/main.rs")
        );
        assert_eq!(
            comparable_entity_key(r"C:\workspace\src\main.rs"),
            comparable_entity_key("src/main.rs")
        );
    }
}
