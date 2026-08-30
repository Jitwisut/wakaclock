use anyhow::{anyhow, Context, Result};
use chrono::Utc;
use std::path::Path;
use std::sync::Arc;
use uuid::Uuid;

use crate::model::heartbeat::HeartbeatRow;
use crate::model::wakatime_import::{WakaTimeDump, WakaTimeHeartbeat};
use crate::repository::heartbeat::HeartbeatRepository;
use wakaclock_core::heartbeat::{resolve_attribution, AttributionInput};

pub struct WakaTimeImportResult {
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

    pub async fn run(&self, user_id: Uuid, file_path: &str) -> Result<WakaTimeImportResult> {
        validate_file_path(file_path)?;

        let raw = tokio::fs::read_to_string(file_path)
            .await
            .with_context(|| format!("Failed to read WakaTime dump: {file_path}"))?;
        let dump: WakaTimeDump =
            serde_json::from_str(&raw).context("Failed to parse WakaTime dump JSON")?;

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

        for day in dump.days {
            let day_date = day.date;
            let Some(heartbeats) = day.heartbeats else {
                continue;
            };

            for heartbeat in heartbeats {
                match map_heartbeat(
                    user_id,
                    heartbeat,
                    &editor,
                    &operating_system,
                    &user_agent,
                    &day_date,
                ) {
                    Some(row) => rows.push(row),
                    None => skipped += 1,
                }
            }
        }

        let imported = rows.len();
        self.heartbeat_repo.insert_batch(rows).await?;

        Ok(WakaTimeImportResult {
            imported_heartbeats: imported,
            skipped_heartbeats: skipped,
        })
    }
}

fn validate_file_path(file_path: &str) -> Result<()> {
    if file_path.trim().is_empty() {
        anyhow::bail!("file_path cannot be empty");
    }

    let path = Path::new(file_path);
    if !path.exists() {
        anyhow::bail!("WakaTime dump file not found: {file_path}");
    }
    if !path.is_file() {
        anyhow::bail!("file_path must point to a file");
    }

    Ok(())
}

fn validate_dump(dump: &WakaTimeDump) -> Result<()> {
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
    day_date: &str,
) -> Option<HeartbeatRow> {
    if heartbeat.entity.trim().is_empty() || heartbeat.time <= 0.0 {
        return None;
    }

    let entity_type = normalize_entity_type(&heartbeat.entity_type)?;
    let date = (heartbeat.time as i64 / 86400).max(0) as u16;
    let created_at = parse_created_at(heartbeat.created_at.as_deref(), day_date);
    let category = normalize_category(heartbeat.category.as_deref());
    let legacy_ai_generated = is_ai_generated(&heartbeat);
    let ai_event_id = heartbeat.ai_session.clone();
    let ai_lines_added = to_positive_u32(heartbeat.ai_line_changes);
    let ai_lines_deleted = to_negative_u32(heartbeat.ai_line_changes);
    let human_lines_added = to_positive_u32(heartbeat.human_line_changes);
    let human_lines_deleted = to_negative_u32(heartbeat.human_line_changes);
    let attribution = resolve_attribution(AttributionInput {
        legacy_is_ai_generated: Some(legacy_ai_generated),
        ai_agent: legacy_ai_generated.then_some("wakatime"),
        ai_source: legacy_ai_generated.then_some("wakatime_import"),
        ai_confidence: legacy_ai_generated.then_some("verified"),
        ai_event_id: heartbeat.ai_session.as_deref(),
        ai_lines_added,
        ai_lines_deleted,
        human_lines_added,
        human_lines_deleted,
        chars_added: human_lines_added,
        chars_deleted: human_lines_deleted,
        positive_editor_evidence: heartbeat.is_write,
        ..Default::default()
    })
    .ok()?;
    let is_ai_generated = attribution.actor_type.is_ai();
    let ai_agent = is_ai_generated.then(|| "wakatime".to_string());

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
        ai_agent,
        ai_provider: is_ai_generated.then(|| "wakatime".to_string()),
        ai_model: None,
        ai_source: is_ai_generated.then(|| "wakatime_import".to_string()),
        ai_confidence: is_ai_generated.then(|| "verified".to_string()),
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
        actor_type: attribution.actor_type.to_string(),
        actor_confidence: attribution.confidence,
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

fn parse_created_at(created_at: Option<&str>, day_date: &str) -> u32 {
    created_at
        .and_then(|value| chrono::DateTime::parse_from_rfc3339(value).ok())
        .map(|dt| dt.timestamp().max(0) as u32)
        .or_else(|| {
            chrono::NaiveDate::parse_from_str(day_date, "%Y-%m-%d")
                .ok()
                .and_then(|date| date.and_hms_opt(0, 0, 0))
                .map(|midnight| midnight.and_utc().timestamp().max(0) as u32)
        })
        .unwrap_or_else(|| Utc::now().timestamp().max(0) as u32)
}

fn is_ai_generated(heartbeat: &WakaTimeHeartbeat) -> bool {
    heartbeat
        .category
        .as_deref()
        .map(|value| value.eq_ignore_ascii_case("AI Coding"))
        .unwrap_or(false)
        || heartbeat.ai_line_changes.is_some()
        || heartbeat.ai_session.is_some()
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
