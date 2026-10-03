//! Owner-only, read-time receipts. Facts are authoritative; no heuristic session joins.
use super::*;
use crate::infrastructure::postgres::PostgresClient;
use crate::model::ai_stats::FieldCoverage;
use crate::model::ai_usage::AiUsageEventRow;
use std::collections::BTreeSet;

const MAX_FACTS: usize = 10_000;
const ID_SQL: &str = "lower(hex(SHA256(concat(toString(user_id), ':', toString(length(ai_agent)), ':', ai_agent, ':', ifNull(collector_id, ''), ':', ai_session_id))))";
const FACT_COLUMNS: &str = "user_id, toUInt16(date) AS date, usage_event_id, event_payload_hash, ai_session_id, collector_id, event_time, project_id, project_attribution_method, ai_agent, ai_provider, ai_model, prompt_count, prompt_character_count, input_tokens, output_tokens, cache_read_tokens, cache_write_tokens, estimated_cost_microusd, pricing_version, token_source, version, received_at";

#[derive(Debug, Deserialize)]
pub struct SessionQuery {
    start: Option<String>,
    end: Option<String>,
    timezone: Option<String>,
    agent: Option<String>,
    project_id: Option<Uuid>,
    limit: Option<usize>,
    cursor: Option<String>,
}
#[derive(Debug, Deserialize, Serialize, Row)]
pub struct SessionSummary {
    pub id: String,
    pub agent: String,
    pub first_observed_at: u32,
    pub last_observed_at: u32,
    pub usage_events: u64,
    pub identity_status: String,
}
#[derive(Debug, Serialize, Deserialize)]
struct Cursor {
    user_id: Uuid,
    filter: String,
    last_time: u32,
    last_id: String,
    expires_at: i64,
}
#[derive(Debug, Serialize)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
    pub has_more: bool,
}

fn enabled(state: &AppState) -> Result<(), ApiError> {
    if !state.config.work_sessions_enabled {
        return Err(ApiError::service_unavailable(
            "work session receipts are disabled",
        ));
    }
    Ok(())
}
fn digest(parts: &[&str]) -> String {
    let mut hash = Sha256::new();
    for part in parts {
        hash.update((part.len() as u64).to_le_bytes());
        hash.update(part.as_bytes());
    }
    format!("{:x}", hash.finalize())
}
fn public_agent(raw: &str) -> String {
    let normalized = wakaclock_core::ai::normalize_agent_id(raw);
    if wakaclock_core::ai::KNOWN_AGENT_IDS.contains(&normalized.as_str()) {
        normalized
    } else {
        "unknown".into()
    }
}
fn valid_id(id: &str) -> bool {
    id.len() == 64
        && id
            .bytes()
            .all(|c| c.is_ascii_hexdigit() && !c.is_ascii_uppercase())
}
fn encode_cursor(secret: &str, cursor: &Cursor) -> Result<String, ApiError> {
    let bytes = serde_json::to_vec(cursor).map_err(ApiError::internal)?;
    let sig = ring::hmac::sign(
        &ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes()),
        &bytes,
    );
    Ok(format!(
        "{}.{}",
        URL_SAFE_NO_PAD.encode(bytes),
        URL_SAFE_NO_PAD.encode(sig)
    ))
}
fn decode_cursor(secret: &str, token: &str, user: Uuid, filter: &str) -> Result<Cursor, ApiError> {
    let invalid = || ApiError::bad_request("invalid session cursor; reload the list");
    if token.len() > 4096 {
        return Err(invalid());
    }
    let (payload, sig) = token.split_once('.').ok_or_else(invalid)?;
    let bytes = URL_SAFE_NO_PAD.decode(payload).map_err(|_| invalid())?;
    let sig = URL_SAFE_NO_PAD.decode(sig).map_err(|_| invalid())?;
    ring::hmac::verify(
        &ring::hmac::Key::new(ring::hmac::HMAC_SHA256, secret.as_bytes()),
        &bytes,
        &sig,
    )
    .map_err(|_| invalid())?;
    let cursor: Cursor = serde_json::from_slice(&bytes).map_err(|_| invalid())?;
    if cursor.user_id != user || cursor.filter != filter || !valid_id(&cursor.last_id) {
        return Err(invalid());
    }
    if cursor.expires_at <= Utc::now().timestamp() {
        return Err(ApiError::conflict(
            "session cursor expired; reload the list",
        ));
    }
    Ok(cursor)
}

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<SessionQuery>,
) -> Result<Json<V2Envelope<Page<SessionSummary>>>, ApiError> {
    let user = require_scope(&state, &headers, "read_ai_analytics").await?;
    enabled(&state)?;
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let range = ResolvedRange::parse(&start, &end, query.timezone.as_deref())
        .map_err(|e| ApiError::bad_request(e.to_string()))?;
    let (start_at, end_at) = range.unix_bounds();
    if query
        .agent
        .as_deref()
        .is_some_and(|a| !wakaclock_core::ai::KNOWN_AGENT_IDS.contains(&a))
    {
        return Err(ApiError::bad_request("unknown agent filter"));
    }
    let filter = digest(&[
        "sessions-v1",
        &start,
        &end,
        &range.timezone.to_string(),
        query.agent.as_deref().unwrap_or(""),
        &query.project_id.map(|p| p.to_string()).unwrap_or_default(),
    ]);
    let cursor = query
        .cursor
        .as_deref()
        .map(|c| decode_cursor(&state.config.jwt_secret, c, user, &filter))
        .transpose()?;
    let limit = query.limit.unwrap_or(25).clamp(1, 100);
    // Filter dates/projects in HAVING so list summaries retain the whole native session.
    let sql = format!("SELECT {ID_SQL} AS id, ai_agent AS agent, min(event_time) AS first_observed_at,
        max(event_time) AS last_observed_at, count() AS usage_events,
        if(isNull(collector_id) OR NOT startsWith(ai_session_id, 'ws1_'), 'legacy_unresolved', 'scoped') AS identity_status
        FROM wakaclock.ai_usage_events FINAL WHERE user_id = ? {} GROUP BY user_id, ai_agent, ai_session_id, collector_id
        HAVING countIf(event_time >= ? AND event_time < ?) > 0 {} {}
        ORDER BY first_observed_at DESC, id ASC LIMIT {}",
        if query.agent.is_some() { "AND ai_agent = ?" } else { "" },
        if query.project_id.is_some() { "AND countIf(project_id = ? AND project_attribution_method = 'explicit_project_hint') > 0" } else { "" },
        if cursor.is_some() { "AND (first_observed_at < ? OR (first_observed_at = ? AND id > ?))" } else { "" }, limit + 1);
    let mut request = state.clickhouse.get_client().query(&sql).bind(user);
    if let Some(agent) = &query.agent {
        request = request.bind(agent);
    }
    request = request.bind(start_at).bind(end_at);
    if let Some(project) = query.project_id {
        request = request.bind(project);
    }
    if let Some(c) = &cursor {
        request = request.bind(c.last_time).bind(c.last_time).bind(&c.last_id);
    }
    let mut items = request
        .fetch_all::<SessionSummary>()
        .await
        .map_err(ApiError::internal)?;
    let has_more = items.len() > limit;
    items.truncate(limit);
    let next_cursor = if has_more {
        items
            .last()
            .map(|r| {
                encode_cursor(
                    &state.config.jwt_secret,
                    &Cursor {
                        user_id: user,
                        filter,
                        last_time: r.first_observed_at,
                        last_id: r.id.clone(),
                        expires_at: Utc::now().timestamp() + 3600,
                    },
                )
            })
            .transpose()?
    } else {
        None
    };
    for item in &mut items {
        item.agent = public_agent(&item.agent);
    }
    Ok(Json(envelope(
        Page {
            items,
            has_more,
            next_cursor,
        },
        &range.timezone.to_string(),
        None,
    )))
}

async fn facts(state: &AppState, user: Uuid, id: &str) -> Result<Vec<AiUsageEventRow>, ApiError> {
    if !valid_id(id) {
        return Err(ApiError::not_found("session not found"));
    }
    let sql = format!("SELECT {FACT_COLUMNS} FROM wakaclock.ai_usage_events FINAL WHERE user_id = ? AND {ID_SQL} = ? ORDER BY event_time, usage_event_id LIMIT {}", MAX_FACTS + 1);
    let rows = state
        .clickhouse
        .get_client()
        .query(&sql)
        .bind(user)
        .bind(id)
        .fetch_all::<AiUsageEventRow>()
        .await
        .map_err(ApiError::internal)?;
    if rows.is_empty() {
        return Err(ApiError::not_found("session not found"));
    }
    if rows.len() > MAX_FACTS {
        return Err(ApiError::service_unavailable(
            "session exceeds the 10000 usage-fact receipt limit; totals were not truncated",
        ));
    }
    Ok(rows)
}
async fn operations(
    state: &AppState,
    user: Uuid,
    fact: &AiUsageEventRow,
) -> Result<Vec<OperationEvidence>, ApiError> {
    let Some(collector) = &fact.collector_id else {
        return Ok(vec![]);
    };
    if !fact.ai_session_id.starts_with("ws1_") {
        return Ok(vec![]);
    }
    let relation = crate::repository::canonical::canonical_winner_relation(
        "h.user_id = ? AND h.session_id = ?",
        "h",
    );
    let actor = crate::services::ai_stats::effective_actor_type_expr();
    // Same repair reference as the Trust Center, not a second repair identity.
    let key = "lower(hex(SHA256(concat(toString(length(ifNull(h.session_id, ''))), ':', ifNull(h.session_id, ''), toString(length(coalesce(nullIf(h.ai_event_id, ''), nullIf(h.ai_change_id, ''), nullIf(h.heartbeat_id, ''), ''))), ':', coalesce(nullIf(h.ai_event_id, ''), nullIf(h.ai_change_id, ''), nullIf(h.heartbeat_id, ''), ''), toString(length(h.entity)), ':', h.entity))))";
    let sql = format!("SELECT h.time, h.entity, h.session_id, h.ai_event_id, h.ai_change_id, h.heartbeat_id, h.ai_agent, h.ai_provider, h.ai_model, h.identity_reason, h.identity_source, {actor} AS effective_actor_type, h.ai_lines_added, h.ai_lines_deleted, h.revision, {key} AS row_key FROM {relation} WHERE h.machine = ? AND (notEmpty(ifNull(h.ai_event_id, '')) OR notEmpty(ifNull(h.ai_change_id, ''))) ORDER BY h.time DESC, row_key ASC LIMIT {}", MAX_FACTS + 1);
    let rows = state
        .clickhouse
        .get_client()
        .query(&sql)
        .bind(user)
        .bind(&fact.ai_session_id)
        .bind(collector)
        .fetch_all::<OperationEvidenceRow>()
        .await
        .map_err(ApiError::internal)?;
    if rows.len() > MAX_FACTS {
        return Err(ApiError::service_unavailable(
            "session exceeds the 10000 operation receipt limit; totals were not truncated",
        ));
    }
    Ok(rows
        .into_iter()
        .map(|r| operation_evidence_from_row(user, r))
        .collect())
}
#[derive(Deserialize, Row)]
struct SegmentsRow {
    activity_segments: String,
}
#[derive(Deserialize, Serialize, Row)]
struct ProjectLabel {
    id: String,
    name: String,
}
fn union(mut ranges: Vec<(f64, f64)>) -> Vec<(f64, f64)> {
    ranges.retain(|(s, e)| s.is_finite() && e.is_finite() && e > s);
    ranges.sort_by(|a, b| a.0.total_cmp(&b.0));
    let mut result: Vec<(f64, f64)> = vec![];
    for (s, e) in ranges {
        if let Some(last) = result.last_mut().filter(|last| s <= last.1) {
            last.1 = last.1.max(e);
        } else {
            result.push((s, e));
        }
    }
    result
}
fn seconds(ranges: &[(f64, f64)]) -> f64 {
    ranges.iter().map(|(s, e)| e - s).sum()
}
fn explicit_tool_ranges(json: &str) -> Vec<(f64, f64)> {
    serde_json::from_str::<Vec<wakaclock_core::heartbeat::ActivitySegment>>(json)
        .unwrap_or_default()
        .into_iter()
        .filter(|s| {
            s.source.as_deref() == Some("ai_tool_v1")
                && s.start.is_finite()
                && s.end.is_finite()
                && s.end > s.start
        })
        .map(|s| (s.start.max(s.end - 21_600.0), s.end))
        .collect()
}
async fn execution_ranges(
    state: &AppState,
    user: Uuid,
    fact: &AiUsageEventRow,
) -> Result<Vec<(f64, f64)>, ApiError> {
    let Some(collector) = &fact.collector_id else {
        return Ok(vec![]);
    };
    if !fact.ai_session_id.starts_with("ws1_") {
        return Ok(vec![]);
    }
    let relation = crate::repository::canonical::canonical_winner_relation(
        "h.user_id = ? AND h.session_id = ?",
        "h",
    );
    let actor = crate::services::ai_stats::effective_actor_type_expr();
    let sql = format!(
        "SELECT activity_segments FROM {relation} WHERE h.machine = ? AND h.ai_agent = ? AND ({actor}) = 'ai_verified' LIMIT {}",
        MAX_FACTS + 1
    );
    let rows = state
        .clickhouse
        .get_client()
        .query(&sql)
        .bind(user)
        .bind(&fact.ai_session_id)
        .bind(collector)
        .bind(&fact.ai_agent)
        .fetch_all::<SegmentsRow>()
        .await
        .map_err(ApiError::internal)?;
    if rows.len() > MAX_FACTS {
        return Err(ApiError::service_unavailable(
            "session execution evidence exceeds receipt limit",
        ));
    }
    Ok(union(
        rows.into_iter()
            .flat_map(|r| explicit_tool_ranges(&r.activity_segments))
            .collect(),
    ))
}
fn measured(values: impl Iterator<Item = Option<u64>>) -> Result<Value, ApiError> {
    let values: Vec<_> = values.collect();
    let count = values.iter().filter(|v| v.is_some()).count();
    let sum = values
        .iter()
        .flatten()
        .try_fold(0_u64, |a, b| a.checked_add(*b))
        .ok_or_else(|| ApiError::internal("usage total overflow"))?;
    Ok(
        json!({"value": (count > 0).then_some(sum), "coverage": FieldCoverage::new(count as u64, values.len() as u64)}),
    )
}
fn assemble(
    id: &str,
    rows: &[AiUsageEventRow],
    operations: &[OperationEvidence],
) -> Result<Value, ApiError> {
    let first = rows
        .first()
        .ok_or_else(|| ApiError::not_found("session not found"))?;
    let start = rows.iter().map(|r| r.event_time).min().unwrap();
    let end = rows.iter().map(|r| r.event_time).max().unwrap();
    let projects: BTreeSet<_> = rows
        .iter()
        .filter(|r| r.project_attribution_method.as_deref() == Some("explicit_project_hint"))
        .filter_map(|r| r.project_id.map(|p| p.to_string()))
        .collect();
    let pricing: BTreeSet<_> = rows
        .iter()
        .filter_map(|r| r.pricing_version.clone())
        .collect();
    let mut revision_inputs: Vec<String> = rows
        .iter()
        .map(|r| serde_json::to_string(r).expect("serializable usage row"))
        .collect();
    revision_inputs.extend(
        operations
            .iter()
            .map(|r| serde_json::to_string(r).expect("serializable evidence")),
    );
    revision_inputs.sort();
    let fingerprint = digest(
        &revision_inputs
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>(),
    );
    let scoped = first.collector_id.is_some() && first.ai_session_id.starts_with("ws1_");
    let unassigned: Vec<_> = rows
        .iter()
        .filter(|r| {
            r.project_id.is_none()
                || r.project_attribution_method.as_deref() != Some("explicit_project_hint")
        })
        .collect();
    let verified: Vec<_> = operations
        .iter()
        .filter(|r| r.actor == "ai_verified")
        .collect();
    Ok(json!({
        "id": id, "schema_version": 1, "calculation_version": "work-session-receipt-v1",
        "generated_at": Utc::now().to_rfc3339(), "revision_fingerprint": fingerprint,
        "agent": public_agent(&first.ai_agent), "runtime_status": "experimental",
        "identity_status": if scoped { "scoped" } else { "legacy_unresolved" },
        "observed_window": {"start": start, "end": end, "kind": "first_to_last_usage_event", "is_execution_time": false},
        "project_ids": projects, "usage_events": rows.len(),
        "usage": {
            "input_tokens": measured(rows.iter().map(|r| r.input_tokens))?,
            "output_tokens": measured(rows.iter().map(|r| r.output_tokens))?,
            "cache_read_tokens": measured(rows.iter().map(|r| r.cache_read_tokens))?,
            "cache_write_tokens": measured(rows.iter().map(|r| r.cache_write_tokens))?,
            "prompt_characters": measured(rows.iter().map(|r| r.prompt_character_count))?,
            "estimated_cost_microusd": measured(rows.iter().map(|r| r.estimated_cost_microusd))?,
            "pricing_versions": pricing,
            "unassigned_project_events": unassigned.len(),
            "unassigned_estimated_cost_microusd": measured(unassigned.iter().map(|r| r.estimated_cost_microusd))?
        },
        "time": {"human_context_seconds": null, "agent_execution_seconds": null, "overlap_seconds": null,
            "combined_observed_seconds": null, "reason": "session_execution_intervals_unavailable",
            "human_context_reason": "explicit_human_intervals_unavailable", "additive_across_receipts": false},
        "lines": {"verified_ai_added": measured(verified.iter().map(|r| r.lines_added.map(u64::from)))?,
            "verified_ai_deleted": measured(verified.iter().map(|r| r.lines_deleted.map(u64::from)))?,
            "inferred_operations": operations.iter().filter(|r| r.actor == "ai_inferred").count(),
            "unknown_operations": operations.iter().filter(|r| r.actor == "unknown").count(),
            "reason": if !scoped { Some("collector_identity_missing") } else if operations.is_empty() { Some("no_exact_session_operations") } else { None }},
        "evidence_count": operations.len(),
        "evidence_references": operations.iter().take(100).map(|r| &r.event_id).collect::<Vec<_>>(),
        "evidence_references_truncated": operations.len() > 100,
        "diagnostics": {"latest_received_at": rows.iter().map(|r| r.received_at).max(),
            "max_ingestion_lag_seconds": rows.iter().map(|r| r.received_at.saturating_sub(r.event_time)).max(),
            "coverage_basis": "received_facts_only", "unmatched_operations": null,
            "unmatched_reason": "unjoined_operations_remain_in_trust_center"},
        "outcome": null, "outcome_source": "user_reported", "outcome_available": false
    }))
}

pub async fn detail(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<V2Envelope<Value>>, ApiError> {
    let user = require_scope(&state, &headers, "read_ai_analytics").await?;
    enabled(&state)?;
    let rows = facts(&state, user, &id).await?;
    let ops = operations(&state, user, &rows[0]).await?;
    let mut receipt = assemble(&id, &rows, &ops)?;
    let project_ids: BTreeSet<Uuid> = rows
        .iter()
        .filter(|r| r.project_attribution_method.as_deref() == Some("explicit_project_hint"))
        .filter_map(|r| r.project_id)
        .collect();
    let projects = if project_ids.is_empty() {
        vec![]
    } else {
        state.clickhouse.get_client().query(
            "SELECT toString(project_id) AS id, argMax(display_name, version) AS name FROM wakaclock.project_identities FINAL WHERE user_id = ? AND project_id IN ? GROUP BY project_id ORDER BY project_id"
        ).bind(user).bind(project_ids.into_iter().collect::<Vec<_>>()).fetch_all::<ProjectLabel>().await.map_err(ApiError::internal)?
    };
    receipt["projects"] = json!(projects);
    let execution = execution_ranges(&state, user, &rows[0]).await?;
    let mut start = rows
        .iter()
        .map(|r| r.event_time as f64)
        .fold(f64::INFINITY, f64::min);
    let mut end = rows.iter().map(|r| r.event_time as f64).fold(0.0, f64::max);
    for op in &ops {
        start = start.min(op.occurred_at);
        end = end.max(op.occurred_at);
    }
    for (s, e) in &execution {
        start = start.min(*s);
        end = end.max(*e);
    }
    receipt["observed_window"] = json!({"start": start, "end": end, "kind": "received_evidence_window", "is_execution_time": false});
    let human = if end > start {
        let raw = crate::services::activity_timeline::ActivityTimelineService::new(
            state.clickhouse.clone(),
            0.0,
        )
        .intervals(user, start, end)
        .await
        .map_err(ApiError::internal)?;
        union(
            raw.into_iter()
                .filter(|i| i.source == "editor_active_v1")
                .map(|i| (i.start.max(start), i.end.min(end)))
                .collect(),
        )
    } else {
        vec![]
    };
    if !human.is_empty() {
        receipt["time"]["human_context_seconds"] = json!(seconds(&human));
        receipt["time"]["human_context_reason"] =
            json!("same_user_window_context_not_task_authorship");
    }
    if !execution.is_empty() {
        receipt["time"]["agent_execution_seconds"] = json!(seconds(&execution));
        receipt["time"]["reason"] =
            json!("received_completed_tool_intervals_only_partial_session_coverage");
        if !human.is_empty() {
            let both = union(human.iter().chain(&execution).copied().collect());
            let total = seconds(&both);
            receipt["time"]["combined_observed_seconds"] = json!(total);
            receipt["time"]["overlap_seconds"] =
                json!((seconds(&human) + seconds(&execution) - total).max(0.0));
        }
    }
    if let Some(pg) = &state.postgres {
        let row = pg.query_opt("SELECT outcome, version, updated_at FROM work_session_outcomes WHERE user_id = $1 AND session_id = $2", &[&user, &id]).await.map_err(ApiError::internal)?;
        receipt["outcome_available"] = json!(true);
        if let Some(row) = row {
            receipt["outcome"] = json!({"value": row.get::<_, Option<String>>("outcome"), "version": row.get::<_, i64>("version"), "updated_at": row.get::<_, chrono::DateTime<Utc>>("updated_at")});
        }
    }
    // Include contextual time and annotation in the snapshot fingerprint, excluding wall clock.
    receipt["revision_fingerprint"] = json!(digest(&[
        receipt["revision_fingerprint"].as_str().unwrap(),
        &receipt["time"].to_string(),
        &receipt["outcome"].to_string(),
        &receipt["projects"].to_string(),
        &serde_json::to_string(&execution).map_err(ApiError::internal)?,
        &serde_json::to_string(&human).map_err(ApiError::internal)?
    ]));
    Ok(Json(envelope(receipt, "UTC", None)))
}

pub async fn evidence(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Query(query): Query<RangeQuery>,
) -> Result<Json<V2Envelope<OperationEvidencePage>>, ApiError> {
    let user = require_scope(&state, &headers, "read_ai_analytics").await?;
    enabled(&state)?;
    let rows = facts(&state, user, &id).await?;
    let ops = operations(&state, user, &rows[0]).await?;
    // Bind pages to the canonical revision set: don't silently skip changed evidence.
    let version = digest(&[&serde_json::to_string(&ops).map_err(ApiError::internal)?]);
    let key = format!("session-evidence:{id}:{version}");
    let cursor = query
        .cursor
        .as_deref()
        .map(|c| {
            decode_operation_evidence_cursor(
                c,
                &state.config.jwt_secret,
                user,
                &key,
                &key,
                "UTC",
                None,
            )
        })
        .transpose()?;
    let limit = query.limit.unwrap_or(25).clamp(1, 100);
    let mut operations: Vec<_> = ops
        .into_iter()
        .filter(|r| {
            cursor.as_ref().is_none_or(|c| {
                r.occurred_at < c.last_time
                    || (r.occurred_at == c.last_time && r.repair_reference > c.last_row_key)
            })
        })
        .take(limit + 1)
        .collect();
    let has_more = operations.len() > limit;
    operations.truncate(limit);
    let next_cursor = if has_more {
        operations
            .last()
            .map(|r| {
                encode_operation_evidence_cursor(
                    &state.config.jwt_secret,
                    OperationEvidenceCursor {
                        user_id: user,
                        start: key.clone(),
                        end: key,
                        timezone: "UTC".into(),
                        project_id: None,
                        last_time: r.occurred_at,
                        last_row_key: r.repair_reference.clone(),
                        expires_at: Utc::now().timestamp() + 3600,
                    },
                )
            })
            .transpose()?
    } else {
        None
    };
    Ok(Json(envelope(
        OperationEvidencePage {
            operations,
            has_more,
            next_cursor,
            date_basis: "whole_native_session",
        },
        "UTC",
        None,
    )))
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OutcomeInput {
    outcome: Outcome,
}
#[derive(Deserialize, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Completed,
    NeedsWork,
    Abandoned,
}
async fn write_outcome(
    state: &AppState,
    headers: &HeaderMap,
    id: &str,
    outcome: Option<Outcome>,
) -> Result<StatusCode, ApiError> {
    let user = require_scope(state, headers, "write_ai_outcomes").await?;
    enabled(state)?;
    let pg = state
        .postgres
        .as_ref()
        .ok_or_else(|| ApiError::service_unavailable("outcomes require PostgreSQL"))?;
    facts(state, user, id).await?;
    ensure_pg_identity(state, user).await?;
    let mut client = pg.transaction_client().await.map_err(ApiError::internal)?;
    let tx = client.transaction().await.map_err(ApiError::internal)?;
    PostgresClient::account_activity_transaction_lock(&tx, user)
        .await
        .map_err(ApiError::internal)?;
    if tx
        .query_opt(
            "SELECT id FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL",
            &[&user],
        )
        .await
        .map_err(ApiError::internal)?
        .is_none()
    {
        return Err(ApiError::not_found("session not found"));
    }
    let value = outcome.map(|v| {
        serde_json::to_value(v)
            .unwrap()
            .as_str()
            .unwrap()
            .to_string()
    });
    let row = tx.query_one("INSERT INTO work_session_outcomes (user_id, session_id, outcome) VALUES ($1, $2, $3) ON CONFLICT (user_id, session_id) DO UPDATE SET outcome = EXCLUDED.outcome, version = work_session_outcomes.version + 1, updated_at = now() RETURNING version", &[&user, &id, &value]).await.map_err(ApiError::internal)?;
    let version: i64 = row.get(0);
    tx.execute("INSERT INTO work_session_outcome_history (user_id, session_id, version, outcome) VALUES ($1, $2, $3, $4)", &[&user, &id, &version, &value]).await.map_err(ApiError::internal)?;
    tx.commit().await.map_err(ApiError::internal)?;
    Ok(StatusCode::NO_CONTENT)
}
pub async fn set_outcome(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(input): Json<OutcomeInput>,
) -> Result<StatusCode, ApiError> {
    write_outcome(&state, &headers, &id, Some(input.outcome)).await
}
pub async fn clear_outcome(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, ApiError> {
    write_outcome(&state, &headers, &id, None).await
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cursor_is_owner_filter_and_expiry_bound() {
        let user = Uuid::new_v4();
        let mut c = Cursor {
            user_id: user,
            filter: "codex".into(),
            last_time: 10,
            last_id: "a".repeat(64),
            expires_at: Utc::now().timestamp() + 100,
        };
        let token = encode_cursor("secret", &c).unwrap();
        assert!(decode_cursor("secret", &token, user, "codex").is_ok());
        assert!(decode_cursor("secret", &token, Uuid::new_v4(), "codex").is_err());
        assert!(decode_cursor("secret", &token, user, "claude").is_err());
        assert!(decode_cursor("wrong-key", &token, user, "codex").is_err());
        c.expires_at = 0;
        assert!(decode_cursor(
            "secret",
            &encode_cursor("secret", &c).unwrap(),
            user,
            "codex"
        )
        .is_err());
    }
    #[test]
    fn partial_usage_preserves_missing_and_measured_zero() {
        assert!(measured([None, None].into_iter()).unwrap()["value"].is_null());
        let partial = measured([Some(0), None].into_iter()).unwrap();
        assert_eq!(partial["value"], 0);
        assert_eq!(partial["coverage"]["status"], "partial");
        assert!(measured([Some(u64::MAX), Some(1)].into_iter()).is_err());
    }
    #[test]
    fn duration_uses_explicit_tool_evidence_and_union_not_session_lifetime() {
        assert!(
            explicit_tool_ranges(r#"[{"segment_id":"x","start":0,"end":100,"source":"ai"}]"#)
                .is_empty()
        );
        let execution = union(explicit_tool_ranges(
            r#"[{"segment_id":"a","start":0,"end":20,"source":"ai_tool_v1"},{"segment_id":"b","start":10,"end":30,"source":"ai_tool_v1"}]"#,
        ));
        assert_eq!(seconds(&execution), 30.0);
        let human = [(20.0, 40.0)];
        let total = seconds(&union(execution.iter().chain(&human).copied().collect()));
        assert_eq!(total, 40.0);
        assert_eq!(seconds(&execution) + seconds(&human) - total, 10.0);
    }
    #[test]
    fn outcome_rejects_free_text_and_unknown_fields() {
        assert!(serde_json::from_value::<OutcomeInput>(json!({"outcome":"completed"})).is_ok());
        assert!(
            serde_json::from_value::<OutcomeInput>(json!({"outcome":"quality_proven"})).is_err()
        );
        assert!(serde_json::from_value::<OutcomeInput>(
            json!({"outcome":"completed", "prompt":"secret"})
        )
        .is_err());
    }
    #[tokio::test]
    #[ignore = "requires isolated CLICKHOUSE_TEST_URL and POSTGRES_TEST_URL; run alone"]
    async fn receipt_live_databases_isolate_sessions_replay_revisions_and_outcomes() {
        let ch = std::env::var("CLICKHOUSE_TEST_URL").expect("isolated test ClickHouse required");
        let pg_url = std::env::var("POSTGRES_TEST_URL").expect("isolated test PostgreSQL required");
        assert!(ch.contains("127.0.0.1"));
        assert!(pg_url.contains("127.0.0.1"));
        for (key, value) in [
            ("CLICKHOUSE_URL", ch),
            ("POSTGRES_URL", pg_url),
            ("CLICKHOUSE_DATABASE", "wakaclock".into()),
            (
                "CLICKHOUSE_USER",
                std::env::var("CLICKHOUSE_TEST_USER").unwrap(),
            ),
            (
                "CLICKHOUSE_PASSWORD",
                std::env::var("CLICKHOUSE_TEST_PASSWORD").unwrap(),
            ),
            (
                "JWT_SECRET",
                "receipt-test-only-secret-not-for-deployment".into(),
            ),
            ("ATOAXIS_WORK_SESSIONS_ENABLED", "true".into()),
        ] {
            std::env::set_var(key, value);
        }
        let state = Arc::new(
            crate::infrastructure::app::create_app_state()
                .await
                .unwrap(),
        );
        let pg = state.postgres.as_ref().unwrap();
        pg.migrate().await.unwrap();
        state.ai_usage_repo.migrate().await.unwrap();
        crate::repository::heartbeat::HeartbeatRepository::new(state.clickhouse.clone())
            .migrate()
            .await
            .unwrap();
        state.analytics_repo.migrate().await.unwrap();
        state.project_identity_repo.migrate().await.unwrap();
        let user = Uuid::new_v4();
        let other = Uuid::new_v4();
        let key = Uuid::new_v4().to_string();
        for u in [user, other] {
            pg.execute(
                "INSERT INTO users(id, username) VALUES ($1, $2)",
                &[&u, &format!("receipt-test-{u}")],
            )
            .await
            .unwrap();
        }
        pg.execute("INSERT INTO api_keys(id,user_id,name,key_hash,key_prefix) VALUES ($1,$2,'test',$3,'test')", &[&Uuid::new_v4(), &user, &auth::hash_key(&key)]).await.unwrap();
        let mut headers = HeaderMap::new();
        headers.insert("Authorization", format!("Bearer {key}").parse().unwrap());
        let collector = Uuid::new_v4().to_string();
        let project = Uuid::new_v4();
        let scoped_session =
            wakaclock_core::ai::usage::scoped_session_id(&collector, "codex", "same-native");
        let base: AiUsageEventRow = serde_json::from_str(&json!({"user_id": user.to_string(), "date": 20708, "usage_event_id": "usage-a", "event_payload_hash": null, "ai_session_id": scoped_session, "collector_id": collector, "event_time": 1789171200, "project_id": project.to_string(), "project_attribution_method":"explicit_project_hint", "ai_agent":"codex", "ai_provider":"openai", "ai_model":"test-model", "prompt_count": 1, "prompt_character_count": null, "input_tokens": 0, "output_tokens": null, "cache_read_tokens": null, "cache_write_tokens": null, "estimated_cost_microusd": null, "pricing_version": null, "token_source":"transcript", "version": 1, "received_at":1789171201}).to_string()).unwrap();
        let mut variants = vec![base.clone(), base.clone()]; // replay must collapse
        let mut claude = base.clone();
        claude.usage_event_id = "usage-b".into();
        claude.ai_agent = "claude-code".into();
        claude.ai_session_id =
            wakaclock_core::ai::usage::scoped_session_id(&collector, "claude-code", "same-native");
        variants.push(claude);
        let mut device = base.clone();
        device.usage_event_id = "usage-c".into();
        device.collector_id = Some(Uuid::new_v4().to_string());
        device.ai_session_id = wakaclock_core::ai::usage::scoped_session_id(
            device.collector_id.as_deref().unwrap(),
            "codex",
            "same-native",
        );
        variants.push(device);
        let mut legacy = base.clone();
        legacy.usage_event_id = "usage-d".into();
        legacy.collector_id = None;
        legacy.ai_session_id = "same-native".into();
        variants.push(legacy);
        let mut foreign = base.clone();
        foreign.user_id = other;
        variants.push(foreign);
        let client = state.clickhouse.get_client();
        client.query(&format!("INSERT INTO wakaclock.project_identities (user_id, project_id, canonical_name, display_name, version) VALUES ('{user}', '{project}', 'receipt-project', 'Receipt project', 1), ('{other}', '{project}', 'foreign-project', 'Foreign project', 1)")).execute().await.unwrap();
        let mut insert = client.insert("wakaclock.ai_usage_events").unwrap();
        for row in &variants {
            insert.write(row).await.unwrap();
        }
        insert.end().await.unwrap();
        let query = || SessionQuery {
            start: Some("2026-09-12".into()),
            end: Some("2026-09-12".into()),
            timezone: Some("UTC".into()),
            agent: None,
            project_id: None,
            limit: Some(100),
            cursor: None,
        };
        let response = list(State(state.clone()), headers.clone(), Query(query()))
            .await
            .unwrap()
            .0;
        assert_eq!(response.data.items.len(), 4);
        assert!(response.data.items.iter().all(|s| s.usage_events == 1));
        let mut q = query();
        q.limit = Some(1);
        let page1 = list(State(state.clone()), headers.clone(), Query(q))
            .await
            .unwrap()
            .0;
        let mut q = query();
        q.limit = Some(1);
        q.cursor = page1.data.next_cursor.clone();
        let page2 = list(State(state.clone()), headers.clone(), Query(q))
            .await
            .unwrap()
            .0;
        assert_ne!(page1.data.items[0].id, page2.data.items[0].id);
        let id_sql = format!("SELECT {ID_SQL} FROM wakaclock.ai_usage_events FINAL WHERE user_id = ? AND ai_agent = 'codex' AND collector_id = ? LIMIT 1");
        let id: String = client
            .query(&id_sql)
            .bind(user)
            .bind(&collector)
            .fetch_one()
            .await
            .unwrap();
        assert_eq!(
            facts(&state, other, &id).await.unwrap_err().status,
            StatusCode::NOT_FOUND
        );
        let metrics = super::super::ai_effectiveness(
            State(state.clone()),
            headers.clone(),
            Query(RangeQuery {
                start: Some("2026-09-12".into()),
                end: Some("2026-09-12".into()),
                timezone: Some("UTC".into()),
                project_id: None,
                limit: None,
                cursor: None,
            }),
        )
        .await
        .unwrap()
        .0;
        assert!(metrics.data.metrics_v2.ai_line_share.is_none());
        assert!(metrics.data.metrics.tokens_per_ai_line.is_none());
        assert_eq!(metrics.data.stats.usage_coverage.event_count, 4);
        assert_eq!(metrics.data.metrics.coverage.token_usage, "partial");
        assert_eq!(metrics.data.stats.line_measurements.human_added, 0);
        let hb = format!("INSERT INTO wakaclock.heartbeats (user_id,entity,entity_type,time,date,is_write,category,editor,operating_system,machine,user_agent,is_ai_generated,ai_agent,ai_provider,ai_model,identity_status,identity_source,ai_source,ai_confidence,ai_event_id,heartbeat_id,session_id,ai_lines_added,ai_lines_deleted,actor_type,revision,created_at) VALUES ('{user}','/private/secret.rs','file',1789171200,'2026-09-12',1,'coding','test','test','{collector}','test',1,'codex','openai','test-model','confirmed','agent_hook','agent_hook','verified','op-a','hb-a','{scoped_session}',5,0,'ai_verified',0,1), ('{user}','/private/secret.rs','file',1789171200,'2026-09-12',1,'coding','test','test','{collector}','test',1,'codex','openai','test-model','confirmed','agent_hook','agent_hook','verified','op-a','hb-a','{scoped_session}',8,0,'ai_verified',1,2)");
        client.query(&hb).execute().await.unwrap();
        let receipt = detail(State(state.clone()), headers.clone(), Path(id.clone()))
            .await
            .unwrap()
            .0
            .data;
        assert_eq!(receipt["usage"]["input_tokens"]["value"], 0);
        assert!(receipt["usage"]["output_tokens"]["value"].is_null());
        assert_eq!(receipt["lines"]["verified_ai_added"]["value"], 8);
        assert_eq!(receipt["evidence_count"], 1);
        assert_eq!(receipt["projects"][0]["name"], "Receipt project");
        assert!(receipt["time"]["agent_execution_seconds"].is_null());
        assert!(!receipt.to_string().contains("secret.rs"));
        let downgrade = format!("INSERT INTO wakaclock.heartbeats (user_id,entity,entity_type,time,date,is_write,category,editor,operating_system,machine,user_agent,is_ai_generated,heartbeat_id,ai_event_id,session_id,actor_type,revision,created_at) VALUES ('{user}','/private/secret.rs','file',1789171200,'2026-09-12',1,'coding','test','test','{collector}','test',0,'hb-a','op-a','{scoped_session}','unknown',2,3)");
        client.query(&downgrade).execute().await.unwrap();
        let corrected = detail(State(state.clone()), headers.clone(), Path(id.clone()))
            .await
            .unwrap()
            .0
            .data;
        assert!(corrected["lines"]["verified_ai_added"]["value"].is_null());
        assert_eq!(corrected["lines"]["unknown_operations"], 1);
        // Exercise the real timeline query, partial usage, and measured overlap.
        let mut partial = base.clone();
        partial.usage_event_id = "usage-partial".into();
        partial.event_time += 60;
        partial.input_tokens = None;
        partial.output_tokens = Some(4);
        partial.estimated_cost_microusd = Some(0);
        let mut insert = client.insert("wakaclock.ai_usage_events").unwrap();
        insert.write(&partial).await.unwrap();
        insert.end().await.unwrap();
        let tool = json!([{"segment_id":"tool-b", "start":1789171210.0,"end":1789171230.0,"source":"ai_tool_v1"}]);
        client.query(&format!("INSERT INTO wakaclock.heartbeats (user_id,entity,entity_type,time,date,is_write,category,editor,operating_system,machine,user_agent,is_ai_generated,ai_agent,ai_provider,ai_model,identity_status,identity_source,ai_source,ai_confidence,ai_event_id,heartbeat_id,session_id,ai_lines_added,actor_type,activity_segments) VALUES ('{user}','/private/tool.rs','file',1789171230,'2026-09-12',1,'coding','test','test','{collector}','test',1,'codex','openai','test-model','confirmed','agent_hook','agent_hook','verified','op-b','hb-b','{scoped_session}',1,'ai_verified',?)")).bind(tool.to_string()).execute().await.unwrap();
        let human = json!([{"segment_id":"human-context", "start":1789171225.0,"end":1789171240.0,"source":"editor_active_v1"}]);
        client.query(&format!("INSERT INTO wakaclock.heartbeats (user_id,entity,entity_type,time,date,is_write,category,editor,operating_system,machine,user_agent,is_ai_generated,heartbeat_id,actor_type,activity_segments) VALUES ('{user}','/private/unrelated.rs','file',1789171240,'2026-09-12',0,'coding','test','test','{collector}','test',0,'hb-human','human',?)")).bind(human.to_string()).execute().await.unwrap();
        let timed = detail(State(state.clone()), headers.clone(), Path(id.clone()))
            .await
            .unwrap()
            .0
            .data;
        assert_eq!(
            timed["usage"]["input_tokens"]["coverage"]["status"],
            "partial"
        );
        assert_eq!(timed["usage"]["estimated_cost_microusd"]["value"], 0);
        assert_eq!(timed["time"]["agent_execution_seconds"], 20.0);
        assert_eq!(timed["time"]["human_context_seconds"], 15.0);
        assert_eq!(timed["time"]["overlap_seconds"], 5.0);
        assert_eq!(timed["time"]["combined_observed_seconds"], 30.0);
        assert_ne!(
            timed["revision_fingerprint"],
            corrected["revision_fingerprint"]
        );
        // Exercise the boundary with real facts, rather than mocking a count.
        let mut limit_fact = base.clone();
        limit_fact.ai_session_id =
            wakaclock_core::ai::usage::scoped_session_id(&collector, "codex", "limit-native");
        let mut insert = client.insert("wakaclock.ai_usage_events").unwrap();
        for index in 0..MAX_FACTS {
            limit_fact.usage_event_id = format!("limit-{index}");
            insert.write(&limit_fact).await.unwrap();
        }
        insert.end().await.unwrap();
        let fact_id = |row: &AiUsageEventRow| {
            format!(
                "{:x}",
                Sha256::digest(
                    format!(
                        "{}:{}:{}:{}:{}",
                        row.user_id,
                        row.ai_agent.len(),
                        row.ai_agent,
                        row.collector_id.as_deref().unwrap_or(""),
                        row.ai_session_id
                    )
                    .as_bytes()
                )
            )
        };
        let limit_id = fact_id(&limit_fact);
        let began = std::time::Instant::now();
        let at_limit = detail(
            State(state.clone()),
            headers.clone(),
            Path(limit_id.clone()),
        )
        .await
        .unwrap()
        .0
        .data;
        assert_eq!(at_limit["usage_events"], MAX_FACTS);
        eprintln!(
            "receipt_facts_limit_query_ms={}",
            began.elapsed().as_millis()
        );
        limit_fact.usage_event_id = "limit-overflow".into();
        let mut insert = client.insert("wakaclock.ai_usage_events").unwrap();
        insert.write(&limit_fact).await.unwrap();
        insert.end().await.unwrap();
        assert!(
            detail(State(state.clone()), headers.clone(), Path(limit_id))
                .await
                .is_err()
        );
        let mut operation_fact = base.clone();
        operation_fact.ai_session_id = wakaclock_core::ai::usage::scoped_session_id(
            &collector,
            "codex",
            "operation-limit-native",
        );
        operation_fact.usage_event_id = "operation-limit-usage".into();
        let mut insert = client.insert("wakaclock.ai_usage_events").unwrap();
        insert.write(&operation_fact).await.unwrap();
        insert.end().await.unwrap();
        let operation_id = fact_id(&operation_fact);
        client.query(&format!("INSERT INTO wakaclock.heartbeats (user_id,entity,entity_type,time,date,is_write,category,editor,operating_system,machine,user_agent,heartbeat_id,ai_event_id,session_id,actor_type) SELECT '{user}', 'limit-fixture', 'file', 1789171200, '2026-09-12', 1, 'coding', 'test', 'test', '{collector}', 'test', concat('limit-hb-', toString(number)), concat('limit-op-', toString(number)), '{}', 'unknown' FROM numbers({MAX_FACTS})", operation_fact.ai_session_id)).execute().await.unwrap();
        let began = std::time::Instant::now();
        let at_limit = detail(
            State(state.clone()),
            headers.clone(),
            Path(operation_id.clone()),
        )
        .await
        .unwrap()
        .0
        .data;
        assert_eq!(at_limit["evidence_count"], MAX_FACTS);
        eprintln!(
            "receipt_operations_limit_query_ms={}",
            began.elapsed().as_millis()
        );
        client.query(&format!("INSERT INTO wakaclock.heartbeats (user_id,entity,entity_type,time,date,is_write,category,editor,operating_system,machine,user_agent,heartbeat_id,ai_event_id,session_id,actor_type) VALUES ('{user}', 'limit-fixture', 'file', 1789171200, '2026-09-12', 1, 'coding', 'test', 'test', '{collector}', 'test', 'limit-hb-overflow', 'limit-op-overflow', '{}', 'unknown')", operation_fact.ai_session_id)).execute().await.unwrap();
        assert!(
            detail(State(state.clone()), headers.clone(), Path(operation_id))
                .await
                .is_err()
        );
        let oauth_app = Uuid::new_v4();
        let read_token = Uuid::new_v4().to_string();
        pg.execute("INSERT INTO oauth_apps(id,owner_user_id,name,client_id) VALUES ($1,$2,'receipt test',$3)", &[&oauth_app, &user, &oauth_app.to_string()]).await.unwrap();
        pg.execute("INSERT INTO oauth_access_tokens(id,app_id,user_id,token_hash,scopes,expires_at) VALUES ($1,$2,$3,$4,ARRAY['read_ai_analytics'],now()+interval '1 hour')", &[&Uuid::new_v4(), &oauth_app, &user, &auth::hash_key(&read_token)]).await.unwrap();
        let mut read_headers = HeaderMap::new();
        read_headers.insert(
            "Authorization",
            format!("Bearer {read_token}").parse().unwrap(),
        );
        assert!(
            detail(State(state.clone()), read_headers.clone(), Path(id.clone()))
                .await
                .is_ok()
        );
        assert_eq!(
            write_outcome(&state, &read_headers, &id, Some(Outcome::Completed))
                .await
                .unwrap_err()
                .status,
            StatusCode::FORBIDDEN
        );
        write_outcome(&state, &headers, &id, Some(Outcome::Completed))
            .await
            .unwrap();
        write_outcome(&state, &headers, &id, None).await.unwrap();
        let history: i64 = pg
            .query_one(
                "SELECT count(*) FROM work_session_outcome_history WHERE user_id=$1",
                &[&user],
            )
            .await
            .unwrap()
            .get(0);
        assert_eq!(history, 2);
        pg.execute("DELETE FROM users WHERE id=$1", &[&user])
            .await
            .unwrap();
        let history: i64 = pg
            .query_one(
                "SELECT count(*) FROM work_session_outcome_history WHERE user_id=$1",
                &[&user],
            )
            .await
            .unwrap()
            .get(0);
        assert_eq!(history, 0);
        assert!(detail(State(state.clone()), headers, Path(id))
            .await
            .is_err());
        pg.execute("DELETE FROM users WHERE id=$1", &[&other])
            .await
            .unwrap();
    }
}
