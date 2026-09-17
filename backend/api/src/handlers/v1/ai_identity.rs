//! Metadata-only repair for AI identity attribution.
//!
//! A repair request names an already-ingested `ai_event_id` and supplies a
//! provider/model tuple proven by the local transcript parser.  The handler
//! copies the canonical heartbeat into the next revision and changes identity
//! columns only.  Measured time, activity segments, and line counters are
//! therefore preserved byte-for-byte; no new activity is created.

use axum::{
    extract::{Json, State},
    http::{HeaderMap, StatusCode},
};
use serde_json::json;
use std::{
    collections::{HashMap, HashSet},
    sync::Arc,
};
use uuid::Uuid;
use wakaclock_core::{
    ai::{
        is_known_agent_id, is_safe_event_id, normalize_identity_agent, normalize_identity_model,
        normalize_identity_provider, normalize_identity_reference, normalize_identity_source,
        resolve_identity, IdentityStatus, IDENTITY_SCHEMA_VERSION,
    },
    api_client::{AiIdentityCorrection, AiIdentityRepairReport, AiIdentityRepairRequest},
    heartbeat::MAX_HEARTBEAT_REVISION,
};

use crate::infrastructure::app::AppState;
use crate::middleware::auth;
use crate::model::heartbeat::HeartbeatRow;

const MAX_REPAIR_CORRECTIONS: usize = 2_000;

#[derive(Debug, Clone)]
struct ValidCorrection {
    request: AiIdentityCorrection,
    agent: String,
    provider: String,
    model: String,
    source: String,
}

/// POST /api/v1/ai/identity/repair
///
/// This endpoint is intentionally separate from the normal heartbeat ingest
/// path.  It cannot accept measured values, timestamps, paths, prompts, or
/// patches; it can only append an identity revision for a row that already
/// exists for the authenticated user.
pub async fn repair(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(request): Json<AiIdentityRepairRequest>,
) -> Result<Json<AiIdentityRepairReport>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    if !auth::require_scope(&state, &headers, "write_logged_time").await {
        return Err(auth::forbidden_scope("write_logged_time"));
    }
    require_active_access(&state, user_id).await?;

    if request.corrections.len() > MAX_REPAIR_CORRECTIONS {
        return Err(app_error(
            StatusCode::BAD_REQUEST,
            &format!("at most {MAX_REPAIR_CORRECTIONS} identity corrections per request"),
        ));
    }
    let repair_run_id = Uuid::parse_str(&request.repair_run_id).map_err(|_| {
        app_error(
            StatusCode::BAD_REQUEST,
            "repair_run_id must be a UUID generated for one repair run",
        )
    })?;

    let requested = request.corrections.len() as u64;
    let mut conflicts = 0u64;
    let mut unique = HashMap::<(String, Option<String>), ValidCorrection>::new();
    let mut conflicted_ids = HashSet::<(String, Option<String>)>::new();
    for correction in request.corrections {
        let Some(agent) = normalize_identity_agent(Some(&correction.agent)) else {
            continue;
        };
        let Some(provider) = normalize_identity_provider(Some(&correction.provider)) else {
            continue;
        };
        let Some(model) = normalize_identity_model(Some(&correction.model)) else {
            continue;
        };
        let Some(source) = normalize_identity_source(Some(&correction.source)).filter(|source| {
            matches!(
                source.as_str(),
                "agent_hook" | "mcp" | "structured_mcp" | "transcript"
            )
        }) else {
            continue;
        };
        let mut request_correction = correction;
        request_correction.source = source.clone();
        request_correction.turn_id = request_correction
            .turn_id
            .as_deref()
            .and_then(|value| normalize_identity_reference(Some(value)));
        request_correction.session_id = request_correction
            .session_id
            .as_deref()
            .and_then(|value| normalize_identity_reference(Some(value)));
        request_correction.message_id = request_correction
            .message_id
            .as_deref()
            .and_then(|value| normalize_identity_reference(Some(value)));
        let resolution = resolve_identity(
            Some(&agent),
            &[Some(provider.as_str())],
            &[Some(model.as_str())],
            Some(source.as_str()),
            Some("verified"),
        );
        if resolution.status != IdentityStatus::Confirmed || !is_known_agent_id(&agent) {
            continue;
        }
        let correction_event_id = request_correction.ai_event_id.clone();
        if !is_safe_event_id(&correction_event_id) {
            continue;
        }
        let correction_key = (
            correction_event_id.clone(),
            request_correction.session_id.clone(),
        );
        if conflicted_ids.contains(&correction_key) {
            continue;
        }
        let valid = ValidCorrection {
            request: request_correction,
            agent,
            provider,
            model,
            source,
        };
        if let Some(previous) = unique.get(&correction_key) {
            if previous.agent != valid.agent
                || previous.provider != valid.provider
                || previous.model != valid.model
                || previous.source != valid.source
                || previous.request.session_id != valid.request.session_id
                || previous.request.turn_id != valid.request.turn_id
                || previous.request.message_id != valid.request.message_id
            {
                // Two different tuples for one operation are a conflict.  Do not
                // select the last request just because it arrived later.
                conflicts += 1;
                unique.remove(&correction_key);
                conflicted_ids.insert(correction_key);
            }
            continue;
        }
        unique.insert(correction_key, valid);
    }

    let event_ids: Vec<String> = unique
        .keys()
        .map(|(event_id, _)| event_id.clone())
        .collect();
    let rows = state
        .heartbeat_repo
        .get_by_ai_event_ids(user_id, &event_ids)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
    // A single tool call can produce one heartbeat per changed file. Older
    // producers used the tool-level event id for every file, so this lookup must
    // retain all canonical rows instead of silently keeping whichever row a
    // `HashMap` happened to see last.
    let mut rows_by_event = HashMap::<String, Vec<HeartbeatRow>>::new();
    for row in rows {
        if let Some(id) = row.ai_event_id.clone() {
            rows_by_event.entry(id).or_default().push(row);
        }
    }

    let mut corrected_rows = Vec::new();
    let mut audit_rows = Vec::new();
    let mut matched = 0u64;
    let mut unchanged = 0u64;
    let mut preserved_heartbeats = 0u64;
    let mut preserved_lines_added = 0u64;
    let mut preserved_lines_deleted = 0u64;

    for ((event_id, _session_id), correction) in unique {
        let Some(rows) = rows_by_event.get(&event_id) else {
            continue;
        };
        let mut matched_event = false;
        for row in rows {
            // `ai_event_id` is scoped by the originating session. A correction
            // without a session proof may only touch legacy rows that also have
            // no session, never a row from an unrelated session that reused the
            // same opaque tool id.
            if row.session_id != correction.request.session_id {
                continue;
            }
            // Repair is metadata-only for an existing AI activity. A stale event
            // ID on an explicitly human row must never be enough to promote that
            // row to AI verified during a correction run.
            if row.actor_type == "human" && !row.is_ai_generated {
                continue;
            }
            matched_event = true;
            preserved_heartbeats += 1;
            preserved_lines_added = preserved_lines_added.saturating_add(measured_added(row));
            preserved_lines_deleted = preserved_lines_deleted.saturating_add(measured_deleted(row));

            let same_tuple = row.identity_status.as_deref() == Some("confirmed")
                && row
                    .identity_reason
                    .as_deref()
                    .map(|reason| reason.trim().is_empty())
                    .unwrap_or(true)
                && row.ai_agent.as_deref() == Some(correction.agent.as_str())
                && row.ai_provider.as_deref() == Some(correction.provider.as_str())
                && row.ai_model.as_deref() == Some(correction.model.as_str())
                && row.identity_source.as_deref() == Some(correction.source.as_str())
                && row.identity_turn_id == correction.request.turn_id
                && row.identity_message_id == correction.request.message_id;
            if same_tuple {
                unchanged += 1;
                continue;
            }

            // A later repair run must never silently replace a previously
            // confirmed model. If two independently parsed sources disagree,
            // append a conflict revision that keeps the activity measurable but
            // removes both provider/model labels from the confirmed projection.
            // This is deliberately checked before the normal metadata upgrade,
            // which may add a missing turn/message reference to the same tuple.
            let existing_confirmed_tuple = row.identity_status.as_deref() == Some("confirmed")
                && row
                    .identity_reason
                    .as_deref()
                    .map(|reason| reason.trim().is_empty())
                    .unwrap_or(true)
                && row.ai_agent.as_deref().is_some_and(is_known_agent_id)
                && row
                    .ai_provider
                    .as_deref()
                    .is_some_and(|provider| normalize_identity_provider(Some(provider)).is_some())
                && row
                    .ai_model
                    .as_deref()
                    .is_some_and(|model| normalize_identity_model(Some(model)).is_some());
            if existing_confirmed_tuple
                && (row.ai_agent.as_deref() != Some(correction.agent.as_str())
                    || row.ai_provider.as_deref() != Some(correction.provider.as_str())
                    || row.ai_model.as_deref() != Some(correction.model.as_str()))
            {
                conflicts += 1;
                if row.revision >= MAX_HEARTBEAT_REVISION {
                    return Err(app_error(
                        StatusCode::CONFLICT,
                        &format!("revision limit reached for ai_event_id {event_id}"),
                    ));
                }
                let before = json!({
                    "identity_status": row.identity_status.clone(),
                    "identity_reason": row.identity_reason.clone(),
                    "identity_source": row.identity_source.clone(),
                    "identity_schema_version": row.identity_schema_version,
                    "identity_turn_id": row.identity_turn_id.clone(),
                    "identity_message_id": row.identity_message_id.clone(),
                    "session_id": row.session_id.clone(),
                    "ai_agent": row.ai_agent.clone(),
                    "ai_provider": row.ai_provider.clone(),
                    "ai_model": row.ai_model.clone(),
                });
                let mut next = row.clone();
                next.revision = row.revision.saturating_add(1);
                next.identity_status = Some(IdentityStatus::Conflict.as_str().to_string());
                next.identity_reason =
                    Some(wakaclock_core::ai::REASON_CONFLICTING_EVIDENCE.to_string());
                next.identity_schema_version = Some(IDENTITY_SCHEMA_VERSION);
                next.ai_agent = (row.ai_agent.as_deref() == Some(correction.agent.as_str()))
                    .then(|| correction.agent.clone());
                next.ai_provider = None;
                next.ai_model = None;
                next.ai_confidence = Some("verified".to_string());
                let after = json!({
                    "identity_status": next.identity_status.clone(),
                    "identity_reason": next.identity_reason.clone(),
                    "identity_source": next.identity_source.clone(),
                    "identity_schema_version": next.identity_schema_version,
                    "identity_turn_id": next.identity_turn_id.clone(),
                    "identity_message_id": next.identity_message_id.clone(),
                    "session_id": next.session_id.clone(),
                    "ai_agent": next.ai_agent.clone(),
                    "ai_provider": next.ai_provider.clone(),
                    "ai_model": next.ai_model.clone(),
                });
                corrected_rows.push(next);
                audit_rows.push((
                    event_id.clone(),
                    serde_json::to_string(&before).unwrap_or_else(|_| "{}".to_string()),
                    serde_json::to_string(&after).unwrap_or_else(|_| "{}".to_string()),
                    row.revision.saturating_add(1),
                ));
                continue;
            }
            if row.identity_status.as_deref() == Some("conflict") {
                // Conflict is sticky until a separate, explicit adjudication
                // flow resolves it; a complete candidate alone is not enough to
                // pick one side on retry.
                conflicts += 1;
                unchanged += 1;
                continue;
            }
            if row.revision >= MAX_HEARTBEAT_REVISION {
                return Err(app_error(
                    StatusCode::CONFLICT,
                    &format!("revision limit reached for ai_event_id {event_id}"),
                ));
            }

            let before = json!({
                "identity_status": row.identity_status.clone(),
                "identity_reason": row.identity_reason.clone(),
                "identity_source": row.identity_source.clone(),
                "identity_schema_version": row.identity_schema_version,
                "identity_turn_id": row.identity_turn_id.clone(),
                "identity_message_id": row.identity_message_id.clone(),
                "session_id": row.session_id.clone(),
                "ai_agent": row.ai_agent.clone(),
                "ai_provider": row.ai_provider.clone(),
                "ai_model": row.ai_model.clone(),
            });
            let mut next = row.clone();
            next.revision = row.revision.saturating_add(1);
            next.actor_type = "ai_verified".to_string();
            next.actor_confidence = 1.0;
            next.is_ai_generated = true;
            next.ai_agent = Some(correction.agent.clone());
            next.ai_provider = Some(correction.provider.clone());
            next.ai_model = Some(correction.model.clone());
            next.identity_status = Some(IdentityStatus::Confirmed.as_str().to_string());
            next.identity_reason = None;
            next.identity_source = Some(correction.source.clone());
            next.identity_schema_version = Some(IDENTITY_SCHEMA_VERSION);
            next.identity_turn_id = correction.request.turn_id.clone();
            next.identity_message_id = correction.request.message_id.clone();
            next.ai_confidence = Some("verified".to_string());
            let after = json!({
                "identity_status": next.identity_status.clone(),
                "identity_reason": next.identity_reason.clone(),
                "identity_source": next.identity_source.clone(),
                "identity_schema_version": next.identity_schema_version,
                "identity_turn_id": next.identity_turn_id.clone(),
                "identity_message_id": next.identity_message_id.clone(),
                "session_id": next.session_id.clone(),
                "ai_agent": next.ai_agent.clone(),
                "ai_provider": next.ai_provider.clone(),
                "ai_model": next.ai_model.clone(),
            });
            corrected_rows.push(next.clone());
            audit_rows.push((
                event_id.clone(),
                serde_json::to_string(&before).unwrap_or_else(|_| "{}".to_string()),
                serde_json::to_string(&after).unwrap_or_else(|_| "{}".to_string()),
                next.revision,
            ));
        }
        if matched_event {
            matched += 1;
        }
    }

    if !corrected_rows.is_empty() {
        state
            .heartbeat_repo
            .insert_batch(corrected_rows)
            .await
            .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
    }

    // The audit tables are created with the heartbeat schema migration.  Keep the
    // insert best-effort so an older ClickHouse installation can still receive the
    // correction revision; the revision itself is the authoritative record.
    if let Err(error) = write_audit(
        &state,
        repair_run_id,
        user_id,
        requested,
        matched,
        corrected_rows_len(&audit_rows),
        unchanged,
        requested.saturating_sub(matched),
        conflicts,
        preserved_heartbeats,
        preserved_lines_added,
        preserved_lines_deleted,
        &audit_rows,
    )
    .await
    {
        tracing::warn!(%error, %repair_run_id, "AI identity repair audit write failed");
    }

    Ok(Json(AiIdentityRepairReport {
        repair_run_id: repair_run_id.to_string(),
        requested,
        matched,
        corrected: audit_rows.len() as u64,
        unchanged,
        unresolved: requested.saturating_sub(matched),
        conflicts,
        preserved_heartbeats,
        preserved_lines_added,
        preserved_lines_deleted,
        applied: true,
        dry_run: false,
    }))
}

fn corrected_rows_len(rows: &[(String, String, String, u32)]) -> u64 {
    rows.len() as u64
}

fn measured_added(row: &HeartbeatRow) -> u64 {
    u64::from(row.ai_lines_added.unwrap_or(0))
        .saturating_add(u64::from(row.human_lines_added.unwrap_or(0)))
        .saturating_add(u64::from(row.unattributed_lines_added.unwrap_or(0)))
}

fn measured_deleted(row: &HeartbeatRow) -> u64 {
    u64::from(row.ai_lines_deleted.unwrap_or(0))
        .saturating_add(u64::from(row.human_lines_deleted.unwrap_or(0)))
        .saturating_add(u64::from(row.unattributed_lines_deleted.unwrap_or(0)))
}

async fn write_audit(
    state: &AppState,
    repair_run_id: Uuid,
    user_id: Uuid,
    requested: u64,
    matched: u64,
    corrected: u64,
    unchanged: u64,
    unresolved: u64,
    conflicts: u64,
    preserved_heartbeats: u64,
    preserved_lines_added: u64,
    preserved_lines_deleted: u64,
    rows: &[(String, String, String, u32)],
) -> anyhow::Result<()> {
    let client = state.clickhouse.get_client();
    client
        .query(
            "INSERT INTO wakaclock.ai_identity_repair_runs
             (repair_run_id, user_id, requested, matched, corrected, unchanged,
              unresolved, conflicts, preserved_heartbeats, preserved_lines_added,
              preserved_lines_deleted, applied, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, now())",
        )
        .bind(repair_run_id)
        .bind(user_id)
        .bind(requested as u32)
        .bind(matched as u32)
        .bind(corrected as u32)
        .bind(unchanged as u32)
        .bind(unresolved as u32)
        .bind(conflicts as u32)
        .bind(preserved_heartbeats as u32)
        .bind(preserved_lines_added)
        .bind(preserved_lines_deleted)
        .execute()
        .await?;
    for (event_id, before, after, revision) in rows {
        client
            .query(
                "INSERT INTO wakaclock.ai_identity_repair_corrections
                 (repair_run_id, user_id, ai_event_id, before_json, after_json,
                  revision, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, now())",
            )
            .bind(repair_run_id)
            .bind(user_id)
            .bind(event_id)
            .bind(before)
            .bind(after)
            .bind(*revision)
            .execute()
            .await?;
    }
    Ok(())
}

async fn require_active_access(
    state: &AppState,
    user_id: Uuid,
) -> Result<(), (StatusCode, Json<serde_json::Value>)> {
    let has_access = state
        .user_service
        .has_active_access(user_id)
        .await
        .map_err(|error| app_error(StatusCode::INTERNAL_SERVER_ERROR, &error.to_string()))?;
    if has_access {
        Ok(())
    } else {
        Err(auth::payment_required())
    }
}

fn app_error(status: StatusCode, message: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "error": message })))
}
