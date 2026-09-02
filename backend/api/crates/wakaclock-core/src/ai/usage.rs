//! Token/prompt usage parsed from an agent's local transcript (plan.md 9.4).
//!
//! This is a **separate stream from [`AiEditEvent`](crate::ai::event::AiEditEvent)**, and the
//! separation is the point. An edit event is one row per file touched; a usage event is one row
//! per model request. A single assistant message can edit three files — attaching its token
//! counts to each edit would triple the tokens. The two never merge.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::path::Path;

/// One model request's usage, keyed by the provider's own message id.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiUsageRecord {
    /// The provider's message id (`msg_…`). plan.md 9.4 prefers a stable provider event id over
    /// anything derived, and this is exactly that — which is what makes ingest idempotent.
    pub usage_event_id: String,
    pub ai_session_id: String,
    pub occurred_at: DateTime<Utc>,
    pub agent: String,
    pub provider: Option<String>,
    pub model: Option<String>,
    /// Verified user submissions associated with this request. Tool results, assistant
    /// messages and provider retries contribute zero; sessions sum these values rather
    /// than counting heartbeats or model requests.
    pub prompt_count: u32,
    /// Number of Unicode scalar values in the associated human prompt. The prompt text is
    /// counted locally and discarded; only this aggregate is sent to the server.
    /// `None` means no human prompt was paired with this usage event.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub prompt_character_count: Option<u64>,
    /// `None` means the transcript did not report the figure — never zero. plan.md 9.4: "Nullable
    /// token fields mean unavailable. Missing is not zero."
    pub input_tokens: Option<u64>,
    pub output_tokens: Option<u64>,
    pub cache_read_tokens: Option<u64>,
    pub cache_write_tokens: Option<u64>,
    /// How the figures were obtained, and how far they can be trusted. Carried per row so the 36
    /// ambiguous records in a real transcript stay auditable and re-interpretable later without a
    /// migration — see [`TokenSource`].
    pub token_source: TokenSource,
    /// Privacy-safe project display name captured from the agent's workspace context. Absolute
    /// paths are intentionally reduced to the final directory name before leaving the machine.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_hint: Option<String>,
}

/// The outcome of a server-side usage ingest. Kept in the core crate because both the
/// CLI and the API serialize this sanitized, content-free shape.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AiUsageIngestReport {
    pub received: usize,
    pub stored: usize,
    pub duplicates_in_batch: usize,
    pub unpriced: usize,
    pub sessions_touched: usize,
}

/// Provenance of a usage row's token counts.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TokenSource {
    /// The provider's own top-level `usage` block, taken verbatim.
    Transcript,
    /// Same, but the record also carried a multi-entry `iterations` array whose totals disagree
    /// with the top-level figures — on real data, by four orders of magnitude on input tokens.
    ///
    /// Which one is billed is undocumented, so the top-level value is stored as-is and the
    /// disagreement is recorded rather than resolved. Picking the larger number, or summing the
    /// iterations because the top-level "looks too small", would be inventing precision that
    /// plan.md 9.4 explicitly forbids.
    TranscriptAmbiguousIterations,
}

impl TokenSource {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Transcript => "transcript",
            Self::TranscriptAmbiguousIterations => "transcript_ambiguous_iterations",
        }
    }
}

/// The subset of a Claude Code transcript record this parser reads. Everything else in the
/// record — content, tool calls, diagnostics — belongs to the edit-event stream.
#[derive(Debug, Deserialize)]
struct TranscriptRecord {
    #[serde(rename = "type")]
    record_type: Option<String>,
    #[serde(rename = "sessionId")]
    session_id: Option<String>,
    timestamp: Option<String>,
    cwd: Option<String>,
    /// Claude Code emits synthetic/internal user records alongside real user
    /// submissions. They are explicitly marked and must not become prompts.
    #[serde(rename = "isMeta", default)]
    is_meta: bool,
    message: Option<TranscriptMessage>,
}

#[derive(Debug, Deserialize)]
struct TranscriptMessage {
    id: Option<String>,
    model: Option<String>,
    usage: Option<TranscriptUsage>,
    /// Parsed only enough to distinguish a human text submission from a tool result;
    /// the content itself is never stored or sent to the API.
    content: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
struct TranscriptUsage {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
    cache_read_input_tokens: Option<u64>,
    cache_creation_input_tokens: Option<u64>,
    #[serde(default)]
    iterations: Vec<TranscriptIteration>,
}

#[derive(Debug, Deserialize)]
struct TranscriptIteration {
    input_tokens: Option<u64>,
    output_tokens: Option<u64>,
}

/// A model string the provider uses for non-billable internal turns. Recording it as a real model
/// would put a nonexistent model in the pricing join; the row is kept (its tokens are real) with
/// the model left unknown, which prices as NULL rather than zero.
const SYNTHETIC_MODEL: &str = "<synthetic>";

/// Parses every usage record from a Claude Code transcript, deduplicated by message id.
///
/// Deduplication is not an optimisation — it is required for correctness. The transcript logs the
/// same assistant record once per content block, so a real session yields ~9,000 records for
/// ~4,900 distinct messages. Summing them without deduplicating would nearly double every token
/// figure. Repeats are byte-identical, so keeping the first occurrence loses nothing.
pub fn parse_claude_usage(transcript: &Path) -> std::io::Result<Vec<AiUsageRecord>> {
    let contents = std::fs::read_to_string(transcript)?;
    Ok(parse_claude_usage_str(&contents))
}

/// Parse provider usage records from Gemini CLI's JSON/JSONL transcript. Gemini has changed the
/// outer envelope a few times; the parser only consumes stable usage/token fields and keeps all
/// transcript content out of the normalized record.
pub fn parse_gemini_usage(transcript: &Path) -> std::io::Result<Vec<AiUsageRecord>> {
    let contents = std::fs::read_to_string(transcript)?;
    Ok(parse_gemini_usage_str(&contents))
}

pub fn parse_gemini_usage_str(contents: &str) -> Vec<AiUsageRecord> {
    // Gemini CLI has shipped both JSONL logs and single JSON documents. Normalize
    // document envelopes into one-record-per-line before applying the same sanitized
    // usage extractor used by Codex; no transcript content is retained.
    if let Ok(value) = serde_json::from_str::<serde_json::Value>(contents) {
        let records = value
            .get("messages")
            .or_else(|| value.get("events"))
            .or_else(|| value.get("records"))
            .or_else(|| value.get("entries"))
            .and_then(serde_json::Value::as_array)
            .cloned()
            .or_else(|| value.as_array().cloned());
        if let Some(records) = records {
            let normalized = records
                .into_iter()
                .map(|record| record.to_string())
                .collect::<Vec<_>>()
                .join("\n");
            return parse_generic_usage_str(&normalized, "gemini-cli", Some("google"));
        }
    }
    parse_generic_usage_str(contents, "gemini-cli", Some("google"))
}

/// Codex emits per-turn `event_msg`/`token_count` records. This deliberately reads
/// `last_token_usage` when present rather than cumulative totals, preventing every turn from
/// repeating the entire session's token count.
pub fn parse_codex_usage(transcript: &Path) -> std::io::Result<Vec<AiUsageRecord>> {
    let contents = std::fs::read_to_string(transcript)?;
    Ok(parse_codex_usage_str(&contents))
}

pub fn parse_codex_usage_str(contents: &str) -> Vec<AiUsageRecord> {
    parse_generic_usage_str(contents, "codex", Some("openai"))
}

fn parse_generic_usage_str(
    contents: &str,
    agent: &str,
    provider: Option<&str>,
) -> Vec<AiUsageRecord> {
    let mut seen = HashSet::new();
    let mut pending_prompts = std::collections::HashMap::<String, u32>::new();
    let mut pending_prompt_chars = std::collections::HashMap::<String, u64>::new();
    let mut records = Vec::new();
    for line in contents.lines() {
        let Ok(value) = serde_json::from_str::<serde_json::Value>(line.trim()) else {
            continue;
        };
        let record_type = value
            .get("type")
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_ascii_lowercase();
        let session = first_string_value(&value, &["session_id", "sessionId", "session"])
            .or_else(|| {
                value
                    .get("payload")
                    .and_then(|payload| first_string_value(payload, &["session_id", "sessionId"]))
            })
            .unwrap_or_else(|| "unknown-session".to_string());
        if record_type == "user" || record_type == "prompt" {
            let prompt_chars = value
                .get("content")
                .or_else(|| {
                    value
                        .get("message")
                        .and_then(|message| message.get("content"))
                })
                .map(content_character_count)
                .unwrap_or(0);
            pending_prompts
                .entry(session.clone())
                .and_modify(|count| *count += 1)
                .or_insert(1);
            if prompt_chars > 0 {
                *pending_prompt_chars.entry(session).or_default() += prompt_chars;
            }
            continue;
        }
        let usage = value
            .get("usage")
            .or_else(|| value.get("token_usage"))
            .or_else(|| value.get("last_token_usage"))
            .or_else(|| {
                value
                    .get("info")
                    .and_then(|info| info.get("last_token_usage"))
            });
        let Some(usage) = usage else { continue };
        let Some(event_id) = first_string_value(
            &value,
            &[
                "message_id",
                "messageId",
                "event_id",
                "eventId",
                "id",
                "call_id",
                "callId",
            ],
        )
        .or_else(|| {
            value.get("payload").and_then(|payload| {
                first_string_value(
                    payload,
                    &["message_id", "messageId", "event_id", "eventId", "id"],
                )
            })
        }) else {
            continue;
        };
        if !seen.insert(event_id.clone()) {
            continue;
        }
        let Some(occurred_at) = first_timestamp_value(&value) else {
            continue;
        };
        let model = first_string_value(&value, &["model", "model_name", "modelName"])
            .or_else(|| {
                value.get("payload").and_then(|payload| {
                    first_string_value(payload, &["model", "model_name", "modelName"])
                })
            })
            .filter(|value| !value.starts_with('<'));
        let input = first_u64_value(
            usage,
            &[
                "input_tokens",
                "inputTokens",
                "prompt_tokens",
                "promptTokens",
            ],
        );
        let output = first_u64_value(
            usage,
            &[
                "output_tokens",
                "outputTokens",
                "completion_tokens",
                "completionTokens",
            ],
        );
        let cache_read = first_u64_value(
            usage,
            &[
                "cache_read_tokens",
                "cacheReadTokens",
                "cached_input_tokens",
                "cachedInputTokens",
            ],
        );
        let cache_write = first_u64_value(
            usage,
            &[
                "cache_write_tokens",
                "cacheWriteTokens",
                "cache_creation_input_tokens",
                "cacheCreationInputTokens",
            ],
        );
        if input.is_none() && output.is_none() && cache_read.is_none() && cache_write.is_none() {
            continue;
        }
        let prompt_count = pending_prompts.remove(&session).unwrap_or(0);
        let prompt_character_count = pending_prompt_chars.remove(&session);
        records.push(AiUsageRecord {
            usage_event_id: format!("{agent}-usage-v1:{event_id}"),
            ai_session_id: session.clone(),
            occurred_at,
            agent: agent.to_string(),
            provider: provider.map(str::to_string),
            model,
            prompt_count,
            prompt_character_count: (prompt_count > 0)
                .then_some(prompt_character_count.unwrap_or(0)),
            input_tokens: input,
            output_tokens: output,
            cache_read_tokens: cache_read,
            cache_write_tokens: cache_write,
            token_source: TokenSource::Transcript,
            project_hint: first_string_value(&value, &["project", "project_name", "projectName"])
                .and_then(|value| sanitize_project_hint(&value))
                .or_else(|| {
                    first_string_value(&value, &["cwd", "working_directory", "workingDirectory"])
                        .and_then(|cwd| sanitize_project_hint(&cwd))
                }),
        });
    }
    records
}

fn first_string_value(value: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(serde_json::Value::as_str)
            .map(str::to_string)
    })
}

/// Keep only a bounded, path-free project label. Providers disagree on whether their
/// `project` field is a display name or an absolute workspace path, so the client applies
/// the same final privacy boundary to both forms before serialization.
fn sanitize_project_hint(raw: &str) -> Option<String> {
    let candidate = raw
        .trim()
        .split(['/', '\\'])
        .rfind(|part| !part.is_empty() && *part != "." && *part != "..")?;
    if candidate.is_empty()
        || candidate.len() > 160
        || candidate.chars().any(|character| character.is_control())
    {
        return None;
    }
    Some(candidate.to_string())
}

fn first_u64_value(value: &serde_json::Value, keys: &[&str]) -> Option<u64> {
    keys.iter().find_map(|key| {
        value.get(*key).and_then(|value| {
            value.as_u64().or_else(|| {
                value
                    .as_f64()
                    .filter(|number| number.is_finite() && *number >= 0.0)
                    .map(|number| number as u64)
            })
        })
    })
}

fn first_timestamp_value(value: &serde_json::Value) -> Option<DateTime<Utc>> {
    let raw = ["timestamp", "time", "created_at", "createdAt"]
        .iter()
        .find_map(|key| value.get(*key))?;
    if let Some(number) = raw.as_f64() {
        let seconds = if number > 10_000_000_000.0 {
            number / 1000.0
        } else {
            number
        };
        return DateTime::from_timestamp(seconds as i64, 0);
    }
    raw.as_str()
        .and_then(|text| DateTime::parse_from_rfc3339(text).ok())
        .map(|date| date.with_timezone(&Utc))
}

/// The parsing itself, split out so it can be tested against transcript fixtures without a file.
pub fn parse_claude_usage_str(contents: &str) -> Vec<AiUsageRecord> {
    let mut seen: HashSet<String> = HashSet::new();
    // A user submission is paired with the next model usage record for its session.
    // Tool results do not increment this map, so one prompt that drives several tool
    // calls remains one prompt rather than becoming a count of messages or retries.
    let mut pending_prompts: std::collections::HashMap<String, u32> =
        std::collections::HashMap::new();
    let mut pending_prompt_chars: std::collections::HashMap<String, u64> =
        std::collections::HashMap::new();
    let mut records = Vec::new();

    for line in contents.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        // A malformed or truncated line is skipped rather than failing the batch: transcripts are
        // appended to live, so the last line can be half-written while a session is running.
        let Ok(record) = serde_json::from_str::<TranscriptRecord>(line) else {
            continue;
        };
        let Some(session_id) = record.session_id.clone() else {
            continue;
        };
        let Some(message) = record.message else {
            continue;
        };
        if record.record_type.as_deref() == Some("user") {
            if !record.is_meta && is_user_submission(&message) {
                *pending_prompts.entry(session_id.clone()).or_default() += 1;
                let prompt_chars = user_submission_character_count(&message);
                if prompt_chars > 0 {
                    *pending_prompt_chars.entry(session_id).or_default() += prompt_chars;
                }
            }
            continue;
        }
        if record.record_type.as_deref() != Some("assistant") {
            continue;
        }
        // A record with no usage block reports nothing to bill; it is not a zero-token request.
        let (Some(usage), Some(id)) = (message.usage, message.id) else {
            continue;
        };
        if !seen.insert(id.clone()) {
            continue;
        }

        // A usage record without a trustworthy event timestamp must not be assigned
        // upload time: that would put historical usage in the wrong day and possibly
        // apply a price that was not in effect when the request ran.
        let Some(occurred_at) = record
            .timestamp
            .as_deref()
            .and_then(|raw| DateTime::parse_from_rfc3339(raw).ok())
            .map(|dt| dt.with_timezone(&Utc))
        else {
            continue;
        };

        let token_source = if disagrees_with_iterations(&usage) {
            TokenSource::TranscriptAmbiguousIterations
        } else {
            TokenSource::Transcript
        };
        let prompt_count = pending_prompts.remove(&session_id).unwrap_or(0);
        let prompt_character_count = pending_prompt_chars.remove(&session_id);

        records.push(AiUsageRecord {
            usage_event_id: id,
            ai_session_id: session_id,
            occurred_at,
            agent: "claude-code".to_string(),
            provider: Some("anthropic".to_string()),
            model: message.model.filter(|model| model != SYNTHETIC_MODEL),
            prompt_count,
            prompt_character_count: (prompt_count > 0)
                .then_some(prompt_character_count.unwrap_or(0)),
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
            cache_read_tokens: usage.cache_read_input_tokens,
            cache_write_tokens: usage.cache_creation_input_tokens,
            token_source,
            project_hint: record.cwd.as_deref().and_then(sanitize_project_hint),
        });
    }

    records
}

/// True only for a user-authored text submission. Claude represents tool results as
/// content blocks with `type: "tool_result"`; counting those would turn a single
/// prompt into one prompt per tool call. The exact words are intentionally discarded.
fn is_user_submission(message: &TranscriptMessage) -> bool {
    match message.content.as_ref() {
        Some(serde_json::Value::String(text)) => !text.trim().is_empty(),
        Some(serde_json::Value::Array(blocks)) => blocks.iter().any(|block| {
            block
                .get("type")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|kind| kind != "tool_result")
        }),
        Some(serde_json::Value::Object(block)) => block
            .get("type")
            .and_then(serde_json::Value::as_str)
            .is_some_and(|kind| kind != "tool_result"),
        _ => false,
    }
}

fn user_submission_character_count(message: &TranscriptMessage) -> u64 {
    message
        .content
        .as_ref()
        .map(content_character_count)
        .unwrap_or(0)
}

/// Count only user-visible text fields. Tool result blocks are excluded so returned source or
/// diagnostics cannot be mistaken for a prompt length.
fn content_character_count(value: &serde_json::Value) -> u64 {
    match value {
        serde_json::Value::String(text) => text.chars().count() as u64,
        serde_json::Value::Array(items) => items
            .iter()
            .filter(|item| {
                item.get("type").and_then(serde_json::Value::as_str) != Some("tool_result")
            })
            .map(content_character_count)
            .sum(),
        serde_json::Value::Object(object) => {
            if object
                .get("type")
                .and_then(serde_json::Value::as_str)
                .is_some_and(|kind| kind == "tool_result")
            {
                return 0;
            }
            ["text", "content", "value"]
                .iter()
                .filter_map(|key| object.get(*key))
                .map(content_character_count)
                .sum()
        }
        _ => 0,
    }
}

/// True when the record carries several iterations whose totals contradict the top-level figures.
///
/// A single-entry `iterations` array always agrees and is the common case; only multi-entry
/// records are ever ambiguous.
fn disagrees_with_iterations(usage: &TranscriptUsage) -> bool {
    if usage.iterations.len() < 2 {
        return false;
    }
    let summed_input: u64 = usage
        .iterations
        .iter()
        .map(|entry| entry.input_tokens.unwrap_or(0))
        .sum();
    let summed_output: u64 = usage
        .iterations
        .iter()
        .map(|entry| entry.output_tokens.unwrap_or(0))
        .sum();

    summed_input != usage.input_tokens.unwrap_or(0)
        || summed_output != usage.output_tokens.unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn record(id: &str, extra: &str) -> String {
        format!(
            r#"{{"type":"assistant","sessionId":"s1","timestamp":"2026-08-14T10:00:00.000Z",
               "message":{{"id":"{id}","model":"claude-opus-5","usage":{{{extra}}}}}}}"#
        )
        .replace('\n', "")
    }

    #[test]
    fn gemini_json_document_usage_is_normalized_without_content() {
        let json = r#"{"events":[{"type":"assistant","id":"g-1","session_id":"s1","timestamp":"2026-08-22T10:00:00Z","usage":{"input_tokens":4,"output_tokens":6},"content":"do not retain"}]}"#;
        let records = parse_gemini_usage_str(json);
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].input_tokens, Some(4));
        assert_eq!(records[0].usage_event_id, "gemini-cli-usage-v1:g-1");
    }

    #[test]
    fn parses_the_four_token_classes() {
        let line = record(
            "msg_1",
            r#""input_tokens":10,"output_tokens":20,"cache_read_input_tokens":30,"cache_creation_input_tokens":40"#,
        );
        let parsed = parse_claude_usage_str(&line);
        assert_eq!(parsed.len(), 1);
        assert_eq!(parsed[0].input_tokens, Some(10));
        assert_eq!(parsed[0].output_tokens, Some(20));
        assert_eq!(parsed[0].cache_read_tokens, Some(30));
        assert_eq!(parsed[0].cache_write_tokens, Some(40));
        assert_eq!(parsed[0].usage_event_id, "msg_1");
        assert_eq!(
            parsed[0].prompt_count, 0,
            "an assistant record is not itself a prompt"
        );
    }

    #[test]
    fn counts_prompt_characters_without_retaining_prompt_text() {
        let prompt = r#"{"type":"user","sessionId":"s1","message":{"content":"สวัสดี AI"}}"#;
        let assistant = record("msg_1", r#""input_tokens":10"#);
        let parsed = parse_claude_usage_str(&format!("{prompt}\n{assistant}"));

        assert_eq!(parsed[0].prompt_count, 1);
        assert_eq!(
            parsed[0].prompt_character_count,
            Some("สวัสดี AI".chars().count() as u64)
        );
        let serialized = serde_json::to_string(&parsed[0]).expect("serializes");
        assert!(!serialized.contains("สวัสดี AI"));
    }

    #[test]
    fn tool_results_do_not_count_as_prompt_characters() {
        let tool = r#"{"type":"user","sessionId":"s1","message":{"content":[{"type":"tool_result","content":"secret source"}]}}"#;
        let assistant = record("msg_1", r#""input_tokens":10"#);
        let parsed = parse_claude_usage_str(&format!("{tool}\n{assistant}"));

        assert_eq!(parsed[0].prompt_count, 0);
        assert_eq!(parsed[0].prompt_character_count, None);
    }

    #[test]
    fn project_hints_never_leave_an_absolute_path() {
        let line = r#"{"type":"assistant","id":"msg-1","session_id":"s1","timestamp":"2026-08-22T10:00:00Z","project":"/Users/alice/private-repo","usage":{"input_tokens":1}}"#;
        let parsed = parse_codex_usage_str(line);
        assert_eq!(parsed[0].project_hint.as_deref(), Some("private-repo"));
        let serialized = serde_json::to_string(&parsed[0]).expect("serializes");
        assert!(!serialized.contains("/Users/alice"));
    }

    #[test]
    fn repeated_message_ids_are_counted_once() {
        let line = record("msg_1", r#""input_tokens":10,"output_tokens":20"#);
        let doubled = format!("{line}\n{line}\n{line}");
        let parsed = parse_claude_usage_str(&doubled);
        assert_eq!(
            parsed.len(),
            1,
            "the transcript logs one record per content block; counting each would inflate tokens"
        );
    }

    #[test]
    fn distinct_messages_are_all_kept() {
        let lines = format!(
            "{}\n{}",
            record("msg_1", r#""input_tokens":1"#),
            record("msg_2", r#""input_tokens":2"#)
        );
        assert_eq!(parse_claude_usage_str(&lines).len(), 2);
    }

    #[test]
    fn a_missing_token_class_is_none_not_zero() {
        let line = record("msg_1", r#""input_tokens":10"#);
        let parsed = parse_claude_usage_str(&line);
        assert_eq!(parsed[0].output_tokens, None);
        assert_eq!(parsed[0].cache_read_tokens, None);
    }

    #[test]
    fn non_assistant_records_are_ignored() {
        let line = r#"{"type":"user","sessionId":"s1","message":{"id":"msg_1","usage":{"input_tokens":5}}}"#;
        assert!(parse_claude_usage_str(line).is_empty());
    }

    #[test]
    fn a_record_without_usage_is_skipped_rather_than_recorded_as_zero() {
        let line = r#"{"type":"assistant","sessionId":"s1","message":{"id":"msg_1","model":"claude-opus-5"}}"#;
        assert!(parse_claude_usage_str(line).is_empty());
    }

    #[test]
    fn a_truncated_final_line_does_not_discard_the_batch() {
        let good = record("msg_1", r#""input_tokens":10"#);
        let truncated = format!("{good}\n{{\"type\":\"assist");
        assert_eq!(
            parse_claude_usage_str(&truncated).len(),
            1,
            "transcripts are appended to live, so the last line can be half-written"
        );
    }

    #[test]
    fn a_single_iteration_agreeing_with_the_top_level_is_not_ambiguous() {
        let line = record(
            "msg_1",
            r#""input_tokens":10,"output_tokens":20,"iterations":[{"input_tokens":10,"output_tokens":20}]"#,
        );
        assert_eq!(
            parse_claude_usage_str(&line)[0].token_source,
            TokenSource::Transcript
        );
    }

    #[test]
    fn disagreeing_multi_iteration_records_are_flagged_but_keep_the_reported_totals() {
        let line = record(
            "msg_1",
            r#""input_tokens":4,"output_tokens":2998,"iterations":[
                {"input_tokens":2,"output_tokens":192},
                {"input_tokens":136411,"output_tokens":6687},
                {"input_tokens":2,"output_tokens":2806}]"#,
        );
        let parsed = parse_claude_usage_str(&line);
        assert_eq!(
            parsed[0].token_source,
            TokenSource::TranscriptAmbiguousIterations
        );
        assert_eq!(
            parsed[0].input_tokens,
            Some(4),
            "the provider's own figure is stored; summing the iterations would invent precision"
        );
    }

    #[test]
    fn the_synthetic_pseudo_model_is_recorded_as_unknown() {
        let line = r#"{"type":"assistant","sessionId":"s1","timestamp":"2026-08-14T10:00:00.000Z","message":{"id":"msg_1","model":"<synthetic>","usage":{"input_tokens":5}}}"#;
        let parsed = parse_claude_usage_str(line);
        assert_eq!(
            parsed[0].model, None,
            "a pseudo-model must not enter the pricing join as if it were billable"
        );
        assert_eq!(parsed[0].input_tokens, Some(5), "its tokens are still real");
    }

    #[test]
    fn a_record_without_timestamp_is_ignored_instead_of_being_misdated_at_upload_time() {
        let line = r#"{"type":"assistant","sessionId":"s1","message":{"id":"msg_1","usage":{"input_tokens":5}}}"#;
        assert!(parse_claude_usage_str(line).is_empty());
    }

    #[test]
    fn counts_a_user_submission_once_and_never_counts_tool_results_as_prompts() {
        let prompt =
            r#"{"type":"user","sessionId":"s1","message":{"content":"please add a test"}}"#;
        let tool_result = r#"{"type":"user","sessionId":"s1","message":{"content":[{"type":"tool_result","content":"ignored"}]}}"#;
        let first_usage = record("msg_1", r#""input_tokens":10"#);
        let second_usage = record("msg_2", r#""input_tokens":20"#);

        let parsed = parse_claude_usage_str(&format!(
            "{prompt}\n{tool_result}\n{first_usage}\n{second_usage}"
        ));
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].prompt_count, 1);
        assert_eq!(parsed[1].prompt_count, 0);
    }
}
