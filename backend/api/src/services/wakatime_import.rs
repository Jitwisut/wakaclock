use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use std::sync::Arc;
use uuid::Uuid;

use crate::model::heartbeat::HeartbeatRow;
use crate::model::wakatime_import::{WakaTimeDump, WakaTimeHeartbeat};
use crate::repository::heartbeat::HeartbeatRepository;

pub struct WakaTimeImportResult {
    pub import_id: String,
    pub imported_heartbeats: usize,
    pub skipped_heartbeats: usize,
}

pub struct WakaTimeImportService {
    heartbeat_repo: Arc<HeartbeatRepository>,
}

impl WakaTimeImportService {
    pub fn new(heartbeat_repo: Arc<HeartbeatRepository>) -> Self {
        Self { heartbeat_repo }
    }

    pub async fn run(&self, user_id: Uuid, raw: &str) -> Result<WakaTimeImportResult> {
        if raw.len() > 1024 * 1024 {
            anyhow::bail!(
                "dump exceeds the 1 MiB upload limit; split the export into smaller files"
            );
        }
        let json: serde_json::Value =
            serde_json::from_str(raw).context("invalid WakaTime dump JSON")?;
        let import_id = crate::middleware::auth::hash_key(&serde_json::to_string(&json)?);
        let dump: WakaTimeDump =
            serde_json::from_value(json).context("invalid WakaTime dump format")?;
        validate_dump(&dump)?;

        let editor = infer_editor(&dump.user.last_plugin_name, &dump.user.last_plugin);
        let operating_system = infer_operating_system(dump.user.last_plugin.as_deref());
        let user_agent = dump
            .user
            .last_plugin
            .clone()
            .unwrap_or_else(|| "wakatime-import".to_string());

        let mut rows = Vec::new();
        let mut skipped = 0usize;
        let mut record_index = 0usize;

        for day in dump.days {
            let Some(heartbeats) = day.heartbeats else {
                continue;
            };

            for heartbeat in heartbeats {
                match map_heartbeat(user_id, heartbeat, &editor, &operating_system, &user_agent) {
                    Some(mut row) => {
                        row.heartbeat_id = Some(format!("import:{import_id}:{record_index}"));
                        rows.push(row);
                    }
                    None => skipped += 1,
                }
                record_index += 1;
            }
        }

        let ids: Vec<String> = rows
            .iter()
            .filter_map(|row| row.heartbeat_id.clone())
            .collect();
        let existing = self
            .heartbeat_repo
            .existing_heartbeat_revisions(user_id, &ids)
            .await?;
        rows.retain(|row| !existing.contains_key(row.heartbeat_id.as_deref().unwrap_or_default()));
        let imported = rows.len();
        self.heartbeat_repo.insert_batch(rows).await?;

        Ok(WakaTimeImportResult {
            import_id,
            imported_heartbeats: imported,
            skipped_heartbeats: skipped,
        })
    }
}

fn validate_dump(dump: &WakaTimeDump) -> Result<()> {
    let count: usize = dump
        .days
        .iter()
        .filter_map(|day| day.heartbeats.as_ref())
        .map(Vec::len)
        .sum();
    if count > 10_000 {
        anyhow::bail!("at most 10000 heartbeats per import");
    }
    if dump.days.is_empty() {
        anyhow::bail!("WakaTime dump does not contain any days");
    }

    let first_day = dump
        .days
        .first()
        .ok_or_else(|| anyhow!("WakaTime dump does not contain any days"))?;

    if first_day.heartbeats.is_none() && first_day.grand_total.is_some() {
        anyhow::bail!("This WakaTime dump contains summaries, not raw heartbeats");
    }

    if dump.days.iter().all(|day| day.heartbeats.is_none()) {
        anyhow::bail!("This WakaTime dump does not contain raw heartbeats");
    }

    Ok(())
}

fn map_heartbeat(
    user_id: Uuid,
    heartbeat: WakaTimeHeartbeat,
    editor: &str,
    operating_system: &str,
    user_agent: &str,
) -> Option<HeartbeatRow> {
    if heartbeat.entity.trim().is_empty()
        || heartbeat.entity.len() > 4096
        || !heartbeat.time.is_finite()
        || heartbeat.time <= 0.0
        || heartbeat.time > u32::MAX as f64
    {
        return None;
    }

    let entity_type = normalize_entity_type(&heartbeat.entity_type)?;
    let date = (heartbeat.time as i64 / 86400).max(0) as u16;
    let created_at = parse_created_at(heartbeat.created_at.as_deref());
    let category = normalize_category(heartbeat.category.as_deref());
    let is_ai_generated = is_ai_generated(&heartbeat);
    let ai_event_id = None;
    let ai_lines_added = to_positive_u32(heartbeat.ai_line_changes);
    let ai_lines_deleted = to_negative_u32(heartbeat.ai_line_changes);
    let human_lines_added = to_positive_u32(heartbeat.human_line_changes);
    let human_lines_deleted = to_negative_u32(heartbeat.human_line_changes);

    Some(HeartbeatRow {
        user_id,
        entity: heartbeat.entity,
        entity_type,
        time: heartbeat.time,
        date,
        project: heartbeat.project,
        // Imports bypass the live resolve path, so identity is left unresolved here and
        // picked up by the PR 9.9 backfill along with the rest of the history — rather
        // than minting identities from another tool's project names at import time.
        project_id: None,
        branch: heartbeat.branch,
        head_revision: None,
        repository_id: None,
        language: heartbeat.language,
        dependencies: heartbeat.dependencies,
        lines: heartbeat.lines,
        line_number: heartbeat.line_number,
        cursor_position: heartbeat.cursor_position,
        is_write: heartbeat.is_write,
        category,
        editor: editor.to_string(),
        operating_system: operating_system.to_string(),
        machine: heartbeat
            .machine_name_id
            .unwrap_or_else(|| "wakatime-import".to_string()),
        user_agent: user_agent.to_string(),
        machine_name_hash: None,
        hostname_hash: None,
        timezone: None,
        feature_id: None,
        feature_name: None,
        heartbeat_id: None,
        ast_language: None,
        ast_confidence: None,
        keystrokes: None,
        chars_added: human_lines_added,
        chars_deleted: human_lines_deleted,
        active_seconds: None,
        active_seconds_claimed: None,
        activity_segments: "[]".to_string(),
        is_ai_generated,
        // A WakaTime export can tell us that a heartbeat was marked AI-assisted,
        // but it cannot prove which local tool authored the edit. Preserve the
        // AI totals while keeping the identity explicitly unattributed.
        ai_agent: None,
        ai_provider: None,
        ai_model: None,
        ai_source: is_ai_generated.then(|| "observer".to_string()),
        ai_confidence: is_ai_generated.then(|| "inferred".to_string()),
        ai_event_id,
        ai_change_id: None,
        prompt_character_count: None,
        input_tokens: None,
        output_tokens: None,
        cache_read_tokens: None,
        cache_write_tokens: None,
        ai_subscription_plan: None,
        token_source: None,
        attribution_source: None,
        attribution_confidence: None,
        ai_event_fingerprint: None,
        ai_lines_added,
        ai_lines_deleted,
        human_lines_added,
        human_lines_deleted,
        unattributed_lines_added: Some(0),
        unattributed_lines_deleted: Some(0),
        created_at,
        // WakaTime's AI fields are positive evidence that an AI was involved, but do
        // not identify the local tool. Keep that distinction explicit: this is
        // unattributed/inferred AI, not genuinely unknown authorship.
        actor_type: if is_ai_generated {
            "ai_inferred"
        } else {
            "human"
        }
        .to_string(),
        actor_confidence: if is_ai_generated { 0.6 } else { 1.0 },
        clipboard_tracking_version: None,
        copy_actions: None,
        paste_actions: None,
        copied_chars: None,
        copied_lines: None,
        pasted_chars: None,
        pasted_lines: None,
        paste_same_file_actions: None,
        paste_same_workspace_actions: None,
        paste_external_or_unknown_actions: None,
        revision: 0,
    })
}

fn normalize_entity_type(value: &str) -> Option<String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "file" => Some("file".to_string()),
        "domain" => Some("domain".to_string()),
        "url" => Some("url".to_string()),
        "app" => Some("app".to_string()),
        _ => None,
    }
}

fn normalize_category(value: Option<&str>) -> String {
    match value
        .unwrap_or("Coding")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "coding" | "writing docs" | "ai coding" => "coding".to_string(),
        "building" => "building".to_string(),
        "debugging" => "debugging".to_string(),
        "designing" => "designing".to_string(),
        "modeling" => "modeling".to_string(),
        "meeting" => "meeting".to_string(),
        "communicating" => "communicating".to_string(),
        "browsing" => "browsing".to_string(),
        _ => "coding".to_string(),
    }
}

fn infer_editor(last_plugin_name: &Option<String>, last_plugin: &Option<String>) -> String {
    if let Some(name) = last_plugin_name {
        let normalized = name.trim().to_ascii_lowercase();
        if normalized.contains("visual studio code") || normalized.contains("vs code") {
            return "vscode".to_string();
        }
        if normalized.contains("zed") {
            return "zed".to_string();
        }
        if normalized.contains("cursor") {
            return "cursor".to_string();
        }
        if !normalized.is_empty() {
            return normalized.replace(' ', "-");
        }
    }

    if let Some(plugin) = last_plugin {
        let normalized = plugin.to_ascii_lowercase();
        if normalized.contains("vscode") {
            return "vscode".to_string();
        }
        if normalized.contains("zed") {
            return "zed".to_string();
        }
    }

    "wakatime".to_string()
}

fn infer_operating_system(last_plugin: Option<&str>) -> String {
    let normalized = last_plugin.unwrap_or_default().to_ascii_lowercase();
    if normalized.contains("windows") {
        "windows".to_string()
    } else if normalized.contains("linux") {
        "linux".to_string()
    } else if normalized.contains("darwin") || normalized.contains("mac") {
        "macos".to_string()
    } else {
        "unknown".to_string()
    }
}

fn parse_created_at(created_at: Option<&str>) -> u32 {
    created_at
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|dt| dt.timestamp().max(0) as u32)
        .unwrap_or_else(|| Utc::now().timestamp().max(0) as u32)
}

fn is_ai_generated(heartbeat: &WakaTimeHeartbeat) -> bool {
    heartbeat
        .category
        .as_deref()
        .map(|value| value.trim().eq_ignore_ascii_case("AI Coding"))
        .unwrap_or(false)
        || heartbeat.ai_line_changes.is_some_and(|value| value != 0)
        || heartbeat
            .ai_session
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
        || heartbeat.ai_input_tokens.unwrap_or_default() > 0
        || heartbeat.ai_output_tokens.unwrap_or_default() > 0
}

fn to_positive_u32(value: Option<i32>) -> Option<u32> {
    value
        .filter(|current| *current > 0)
        .and_then(|current| u32::try_from(current).ok())
}

fn to_negative_u32(value: Option<i32>) -> Option<u32> {
    value
        .filter(|current| *current < 0)
        .map(|current| current.unsigned_abs())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn imported_ai_activity_is_unattributed() {
        let heartbeat: WakaTimeHeartbeat = serde_json::from_value(serde_json::json!({
            "entity": "src/main.rs",
            "type": "file",
            "time": 1_700_000_000.0,
            "category": "AI Coding",
            "ai_line_changes": 3,
            "ai_session": "session-1"
        }))
        .unwrap();
        let row =
            map_heartbeat(Uuid::nil(), heartbeat, "vscode", "macos", "wakatime-import").unwrap();

        assert!(row.is_ai_generated);
        assert!(row.ai_agent.is_none());
        assert!(row.ai_provider.is_none());
        assert_eq!(row.ai_source.as_deref(), Some("observer"));
        assert_eq!(row.ai_confidence.as_deref(), Some("inferred"));
        assert_eq!(row.actor_type, "ai_inferred");
        assert_eq!(row.actor_confidence, 0.6);
    }

    #[test]
    fn empty_or_zero_ai_fields_do_not_create_ai_evidence() {
        let heartbeat: WakaTimeHeartbeat = serde_json::from_value(serde_json::json!({
            "entity": "src/main.rs",
            "type": "file",
            "time": 1_700_000_000.0,
            "category": "Coding",
            "ai_line_changes": 0,
            "ai_session": "  ",
            "ai_input_tokens": 0,
            "ai_output_tokens": 0
        }))
        .unwrap();
        let row =
            map_heartbeat(Uuid::nil(), heartbeat, "vscode", "macos", "wakatime-import").unwrap();

        assert!(!row.is_ai_generated);
        assert_eq!(row.actor_type, "human");
        assert_eq!(row.actor_confidence, 1.0);
        assert!(row.ai_source.is_none());
        assert!(row.ai_event_id.is_none());
    }

    #[test]
    fn mixed_import_keeps_both_line_counters_with_inferred_actor() {
        let heartbeat: WakaTimeHeartbeat = serde_json::from_value(serde_json::json!({
            "entity": "src/main.rs",
            "type": "file",
            "time": 1_700_000_000.0,
            "category": "AI Coding",
            "ai_line_changes": 3,
            "human_line_changes": 4
        }))
        .unwrap();
        let row =
            map_heartbeat(Uuid::nil(), heartbeat, "vscode", "macos", "wakatime-import").unwrap();

        assert_eq!(row.actor_type, "ai_inferred");
        assert_eq!(row.ai_lines_added, Some(3));
        assert_eq!(row.human_lines_added, Some(4));
    }
}
