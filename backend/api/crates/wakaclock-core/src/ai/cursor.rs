//! Cursor IDE and Windsurf agent sessions, read from the editor's `state.vscdb`.
//!
//! Both editors keep chat "bubbles" in the `cursorDiskKV` table (see [`super::vscdb_kv`]).
//! One parser type serves both; only the agent ID and the editor directories differ.
//!
//! An edit is an assistant bubble whose `toolFormerData` names a file-editing tool and
//! reports `status = completed`. Usage comes from assistant bubbles' `tokenCount`, only
//! once the bubble is old enough that streaming has finished, because a usage ID that is
//! later re-sent with different counts is kept as a conflict rather than replaced.
//!
//! The schema was taken from public facts about these stores and has not yet been
//! checked against a real local database, so fields are matched tolerantly: an unknown
//! shape yields nothing rather than a guess. These are new runtimes, so edits stay local
//! dry-run evidence (`AdapterRuntime::emits_edit_heartbeats`). Bubble text, code blocks,
//! tool arguments other than a file path, and file contents are never kept.

use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::normalize_identity_model;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
use crate::ai::source::{SourceCheckpoint, SourceKind};
use crate::ai::sqlite_source::SqliteReadOptions;
use crate::ai::usage::{AiUsageRecord, TokenSource};
use crate::ai::vscdb_kv::{max_bubble_rowid, read_bubbles, Bubble};
use crate::broker::BrokerChangeKind;
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::path::{Path, PathBuf};

const ASSISTANT_BUBBLE: i64 = 2;
/// Token counts of a bubble younger than this may still be streaming.
const USAGE_SETTLE_SECONDS: i64 = 120;
const EDIT_TOOLS: [&str; 7] = [
    "edit_file",
    "search_replace",
    "write",
    "create_file",
    "apply_patch",
    "delete_file",
    "multi_edit",
];

/// The model provider is not the editor: Cursor and Windsurf route to several model
/// vendors, so `provider` is left unset and the model name carries the identity.
pub struct CursorFamilyParser {
    agent: &'static str,
    editor_dirs: &'static [&'static str],
}

impl CursorFamilyParser {
    pub fn cursor() -> Self {
        Self {
            agent: "cursor",
            editor_dirs: &["Cursor"],
        }
    }

    pub fn windsurf() -> Self {
        Self {
            agent: "windsurf",
            editor_dirs: &["Windsurf", "Windsurf - Next"],
        }
    }

    /// `state.vscdb` candidates for this platform. An override may name the database
    /// file itself or a directory that contains it.
    fn databases(&self, context: &DiscoveryContext) -> Vec<PathBuf> {
        if let Some(path) = &context.config_override {
            return vec![if path.is_dir() {
                path.join("state.vscdb")
            } else {
                path.clone()
            }];
        }
        let home = &context.home_dir;
        self.editor_dirs
            .iter()
            .map(|editor| {
                let base = if cfg!(target_os = "macos") {
                    home.join("Library/Application Support")
                } else if cfg!(target_os = "windows") {
                    home.join("AppData/Roaming")
                } else {
                    home.join(".config")
                };
                base.join(editor)
                    .join("User")
                    .join("globalStorage")
                    .join("state.vscdb")
            })
            .collect()
    }

    fn read_options(context: &ParseContext) -> SqliteReadOptions {
        SqliteReadOptions {
            max_rows: context.max_batch_records,
            time_budget: context.time_budget,
            ..SqliteReadOptions::default()
        }
    }

    fn edit_event(&self, bubble: &Bubble) -> Option<AiEditEvent> {
        if integer_at(&bubble.value, &["type"]) != Some(ASSISTANT_BUBBLE) {
            return None;
        }
        let tool = bubble.value.get("toolFormerData")?;
        let name = string_at(tool, &["name", "tool"])?.to_ascii_lowercase();
        if !EDIT_TOOLS.iter().any(|edit| name.contains(edit)) || name.contains("read") {
            return None;
        }
        if string_at(tool, &["status"]).as_deref() != Some("completed") {
            return None;
        }
        let params = match tool.get("params").or_else(|| tool.get("rawArgs")) {
            Some(Value::String(text)) => serde_json::from_str::<Value>(text).unwrap_or(Value::Null),
            Some(other) => other.clone(),
            None => Value::Null,
        };
        let path = string_at(
            &params,
            &[
                "relativeWorkspacePath",
                "targetFile",
                "target_file",
                "filePath",
                "file_path",
                "path",
            ],
        )?;
        let result = tool.get("result").map(|result| match result {
            Value::String(text) => serde_json::from_str::<Value>(text).unwrap_or(Value::Null),
            other => other.clone(),
        });
        let counts = result.as_ref().unwrap_or(&Value::Null);
        let operation = format!("{}:{}", bubble.composer_id, bubble.bubble_id);
        Some(AiEditEvent {
            event_id: opaque_file_event_id(&format!("{}-v1", self.agent), &operation, &path),
            agent: self.agent.to_string(),
            provider: None,
            model: model(&bubble.value),
            session_id: Some(bubble.composer_id.clone()),
            turn_id: None,
            identity_message_id: Some(bubble.bubble_id.clone()),
            identity_status: None,
            identity_reason: None,
            identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
            tool_event_id: string_at(tool, &["toolCallId", "tool_call_id"])
                .or_else(|| Some(bubble.bubble_id.clone())),
            producer_surface: None,
            occurred_at: created_at(&bubble.value).unwrap_or_else(Utc::now),
            // A workspace-relative path stays relative here: the workspace root is not
            // in the bubble. It is resolved when this source is certified.
            entity: PathBuf::from(&path),
            project_root: None,
            change_kind: if name.contains("create") {
                BrokerChangeKind::Create
            } else if name.contains("delete") {
                BrokerChangeKind::Delete
            } else {
                BrokerChangeKind::Modify
            },
            previous_entity: None,
            lines_added: count_at(counts, &["linesAdded", "lines_added", "addedLines"]),
            lines_deleted: count_at(counts, &["linesRemoved", "lines_removed", "removedLines"]),
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        })
    }

    fn usage_record(&self, bubble: &Bubble, now: DateTime<Utc>) -> Option<AiUsageRecord> {
        if integer_at(&bubble.value, &["type"]) != Some(ASSISTANT_BUBBLE) {
            return None;
        }
        let created = created_at(&bubble.value)?;
        if (now - created).num_seconds() < USAGE_SETTLE_SECONDS {
            return None;
        }
        let tokens = bubble
            .value
            .get("tokenCount")
            .or_else(|| bubble.value.get("usage"))?;
        let input = count_at(tokens, &["inputTokens", "input_tokens", "promptTokens"]);
        let output = count_at(
            tokens,
            &["outputTokens", "output_tokens", "completionTokens"],
        );
        // An all-zero count is a placeholder, not a measurement.
        if input.unwrap_or(0) == 0 && output.unwrap_or(0) == 0 {
            return None;
        }
        Some(AiUsageRecord {
            usage_event_id: format!("{}-usage-v1:{}", self.agent, bubble.bubble_id),
            ai_session_id: bubble.composer_id.clone(),
            collector_id: None,
            occurred_at: created,
            agent: self.agent.to_string(),
            provider: None,
            model: model(&bubble.value),
            prompt_count: 0,
            prompt_character_count: None,
            input_tokens: input.map(u64::from),
            output_tokens: output.map(u64::from),
            cache_read_tokens: None,
            cache_write_tokens: None,
            token_source: TokenSource::Transcript,
            project_hint: None,
        })
    }
}

fn checkpoint_of(cursor: Option<&ParserCursor>) -> Option<SourceCheckpoint> {
    cursor
        .and_then(|cursor| cursor.context.as_ref())
        .and_then(|context| context.source.clone())
}

impl AiActivityParser for CursorFamilyParser {
    fn id(&self) -> &'static str {
        self.agent
    }

    fn source_kind(&self) -> SourceKind {
        SourceKind::Sqlite
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let found = self.databases(context).into_iter().find(|db| db.is_file());
        DiscoveryResult {
            state: match found {
                Some(path) => DiscoveryState::TranscriptFound { path },
                None => DiscoveryState::NotInstalled,
            },
        }
    }

    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        let found: Vec<DiscoveryResult> = self
            .databases(context)
            .into_iter()
            .filter(|db| db.is_file())
            .map(|path| DiscoveryResult {
                state: DiscoveryState::TranscriptFound { path },
            })
            .collect();
        if found.is_empty() {
            vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }]
        } else {
            found
        }
    }

    fn parse_since(
        &self,
        context: &ParseContext,
        cursor: Option<&ParserCursor>,
    ) -> Result<ParseBatch, AiParseError> {
        let cursor = cursor.ok_or_else(|| AiParseError::NotFound {
            path: "<no cursor: call discover() first and seed a cursor from its path>".to_string(),
        })?;
        let db = PathBuf::from(&cursor.source_path);
        let read = read_bubbles(
            &db,
            checkpoint_of(Some(cursor)).as_ref(),
            &Self::read_options(context),
        )
        .map_err(|error| AiParseError::Malformed(error.to_string()))?;
        let mut warnings = Vec::new();
        if read.locked {
            warnings.push(ParseWarning {
                record_id: None,
                message: format!("{} database was locked; skipped this pass", self.agent),
            });
        }
        let events: Vec<AiEditEvent> = read
            .bubbles
            .iter()
            .filter_map(|bubble| self.edit_event(bubble))
            .collect();
        let mut next_context = cursor.context.clone().unwrap_or_default();
        next_context.source = read.checkpoint;
        Ok(ParseBatch {
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: 0,
                last_record_id: events
                    .last()
                    .map(|event| event.event_id.clone())
                    .or_else(|| cursor.last_record_id.clone()),
                last_record_time: events
                    .last()
                    .map(|event| event.occurred_at)
                    .or(cursor.last_record_time),
                context: Some(next_context),
            },
            events,
            warnings,
        })
    }

    fn parse_usage(
        &self,
        source: &Path,
        cursor: Option<&ParserCursor>,
    ) -> std::io::Result<Vec<AiUsageRecord>> {
        let read = read_bubbles(
            source,
            checkpoint_of(cursor).as_ref(),
            &SqliteReadOptions::default(),
        )
        .map_err(std::io::Error::other)?;
        let now = Utc::now();
        Ok(read
            .bubbles
            .iter()
            .filter_map(|bubble| self.usage_record(bubble, now))
            .collect())
    }

    /// A byte offset means nothing for a database; the checkpoint carries the position.
    fn cursor_is_reusable(&self, _cursor: &ParserCursor, _source_len: u64) -> bool {
        true
    }

    fn seed_at_head(&self, cursor: &ParserCursor, _source_len: u64) -> ParserCursor {
        let mut seeded = cursor.clone();
        let head = max_bubble_rowid(
            Path::new(&cursor.source_path),
            &SqliteReadOptions::default(),
        )
        .unwrap_or(0);
        let mut context = seeded.context.clone().unwrap_or_default();
        context.source = Some(SourceCheckpoint::Sqlite {
            last_rowid: head,
            fingerprint: None,
        });
        seeded.context = Some(context);
        seeded
    }
}

fn string_at(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        value
            .get(*key)
            .and_then(Value::as_str)
            .map(str::trim)
            .filter(|text| !text.is_empty())
            .map(str::to_string)
    })
}

fn integer_at(value: &Value, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_i64))
}

fn count_at(value: &Value, keys: &[&str]) -> Option<u32> {
    keys.iter()
        .find_map(|key| value.get(*key).and_then(Value::as_u64))
        .and_then(|count| u32::try_from(count).ok())
}

fn model(bubble: &Value) -> Option<String> {
    string_at(bubble, &["model", "modelName", "usedModel"])
        .or_else(|| {
            bubble
                .get("modelInfo")
                .and_then(|info| string_at(info, &["modelName", "model"]))
        })
        .and_then(|name| normalize_identity_model(Some(&name)))
}

fn created_at(bubble: &Value) -> Option<DateTime<Utc>> {
    let raw = bubble
        .get("createdAt")
        .or_else(|| bubble.get("timestamp"))?;
    if let Some(text) = raw.as_str() {
        return DateTime::parse_from_rfc3339(text)
            .ok()
            .map(|time| time.with_timezone(&Utc));
    }
    raw.as_i64()
        .and_then(DateTime::<Utc>::from_timestamp_millis)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::vscdb_kv::test_db;
    use serde_json::json;

    const SECRET: &str = "SECRET-MARKER-c0de";

    fn edit_bubble(status: &str, name: &str, path: &str) -> Value {
        json!({
            "type": 2,
            "createdAt": "2026-10-26T10:00:00Z",
            "text": format!("assistant says {SECRET}"),
            "codeBlocks": [{"content": SECRET}],
            "modelInfo": {"modelName": "claude-sonnet-4"},
            "toolFormerData": {
                "name": name,
                "status": status,
                "toolCallId": "tc-1",
                "params": json!({"relativeWorkspacePath": path, "code": SECRET}).to_string(),
                "result": {"linesAdded": 4, "linesRemoved": 2}
            }
        })
    }

    fn cursor_for(db: &Path, context: Option<crate::ai::ParserContext>) -> ParserCursor {
        ParserCursor {
            source_path: db.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context,
        }
    }

    fn parse(parser: &CursorFamilyParser, cursor: &ParserCursor) -> ParseBatch {
        parser
            .parse_since(&ParseContext::default(), Some(cursor))
            .unwrap()
    }

    #[test]
    fn completed_file_edits_are_events_and_others_are_not() {
        let db = test_db::path("edits");
        let connection = test_db::create(&db);
        test_db::put(
            &connection,
            "bubbleId:c1:b1",
            &json!({"type": 1, "text": SECRET}),
        );
        test_db::put(
            &connection,
            "bubbleId:c1:b2",
            &edit_bubble("completed", "edit_file", "src/app.ts"),
        );
        test_db::put(
            &connection,
            "bubbleId:c1:b3",
            &edit_bubble("pending", "edit_file", "src/wait.ts"),
        );
        test_db::put(
            &connection,
            "bubbleId:c1:b4",
            &edit_bubble("completed", "read_file", "src/app.ts"),
        );
        test_db::put(
            &connection,
            "bubbleId:c1:b5",
            &edit_bubble("completed", "create_file", "src/new.ts"),
        );
        let batch = parse(&CursorFamilyParser::cursor(), &cursor_for(&db, None));
        let entities: Vec<&Path> = batch
            .events
            .iter()
            .map(|event| event.entity.as_path())
            .collect();
        assert_eq!(
            entities,
            vec![Path::new("src/app.ts"), Path::new("src/new.ts")]
        );
        let edit = &batch.events[0];
        assert_eq!(edit.agent, "cursor");
        assert_eq!(edit.session_id.as_deref(), Some("c1"));
        assert_eq!((edit.lines_added, edit.lines_deleted), (Some(4), Some(2)));
        assert_eq!(batch.events[1].change_kind, BrokerChangeKind::Create);
    }

    #[test]
    fn a_tool_call_completed_later_is_found_with_the_same_event_id() {
        let db = test_db::path("later");
        let connection = test_db::create(&db);
        test_db::put(
            &connection,
            "bubbleId:c1:b1",
            &edit_bubble("pending", "edit_file", "src/app.ts"),
        );
        let parser = CursorFamilyParser::cursor();
        let first = parse(&parser, &cursor_for(&db, None));
        assert!(first.events.is_empty());
        test_db::update(
            &connection,
            "bubbleId:c1:b1",
            &edit_bubble("completed", "edit_file", "src/app.ts"),
        );
        let second = parse(&parser, &first.next_cursor);
        assert_eq!(second.events.len(), 1);
        // A third pass after another change re-reads the window; the ID is stable.
        test_db::put(&connection, "bubbleId:c1:b2", &json!({"type": 1}));
        let third = parse(&parser, &second.next_cursor);
        assert_eq!(third.events[0].event_id, second.events[0].event_id);
    }

    #[test]
    fn windsurf_reads_the_same_schema_under_its_own_id() {
        let db = test_db::path("windsurf");
        let connection = test_db::create(&db);
        test_db::put(
            &connection,
            "bubbleId:c9:b1",
            &edit_bubble("completed", "edit_file", "/abs/x.rs"),
        );
        let batch = parse(&CursorFamilyParser::windsurf(), &cursor_for(&db, None));
        assert_eq!(batch.events[0].agent, "windsurf");
        assert_eq!(batch.events[0].entity, Path::new("/abs/x.rs"));
    }

    #[test]
    fn usage_comes_from_settled_assistant_bubbles_only() {
        let db = test_db::path("usage");
        let connection = test_db::create(&db);
        let mut settled = edit_bubble("completed", "edit_file", "a.rs");
        settled["tokenCount"] = json!({"inputTokens": 900, "outputTokens": 120});
        test_db::put(&connection, "bubbleId:c1:b1", &settled);
        let mut fresh = settled.clone();
        fresh["createdAt"] = json!(Utc::now().to_rfc3339());
        test_db::put(&connection, "bubbleId:c1:b2", &fresh);
        let mut placeholder = settled.clone();
        placeholder["tokenCount"] = json!({"inputTokens": 0, "outputTokens": 0});
        test_db::put(&connection, "bubbleId:c1:b3", &placeholder);
        let records = CursorFamilyParser::cursor().parse_usage(&db, None).unwrap();
        assert_eq!(records.len(), 1);
        let usage = &records[0];
        assert_eq!(usage.usage_event_id, "cursor-usage-v1:b1");
        assert_eq!(
            (usage.input_tokens, usage.output_tokens),
            (Some(900), Some(120))
        );
        assert_eq!(usage.ai_session_id, "c1");
        usage.validate().unwrap();
    }

    #[test]
    fn first_discovery_seeds_past_existing_history() {
        let db = test_db::path("seed");
        let connection = test_db::create(&db);
        test_db::put(
            &connection,
            "bubbleId:c1:b1",
            &edit_bubble("completed", "edit_file", "a.rs"),
        );
        let parser = CursorFamilyParser::cursor();
        let seeded = parser.seed_at_head(&cursor_for(&db, None), 0);
        assert_eq!(
            seeded.context.as_ref().unwrap().source,
            Some(SourceCheckpoint::Sqlite {
                last_rowid: 1,
                fingerprint: None
            })
        );
        assert!(parser.cursor_is_reusable(&seeded, 0));
    }

    #[test]
    fn no_text_code_or_arguments_leave_the_parser() {
        let db = test_db::path("privacy");
        let connection = test_db::create(&db);
        let mut bubble = edit_bubble("completed", "edit_file", "src/app.ts");
        bubble["tokenCount"] = json!({"inputTokens": 1, "outputTokens": 1});
        test_db::put(&connection, "bubbleId:c1:b1", &bubble);
        let parser = CursorFamilyParser::cursor();
        let batch = parse(&parser, &cursor_for(&db, None));
        let rendered = format!(
            "{:?}{:?}{:?}",
            batch.events,
            batch.next_cursor,
            parser.parse_usage(&db, None).unwrap()
        );
        assert!(!rendered.contains(SECRET));
    }

    #[test]
    fn discovery_reports_a_missing_editor_as_not_installed() {
        let db = test_db::path("discover");
        drop(test_db::create(&db));
        let found = DiscoveryContext {
            home_dir: PathBuf::from("/nonexistent"),
            config_override: Some(db.parent().unwrap().to_path_buf()),
        };
        assert_eq!(
            CursorFamilyParser::cursor().discover(&found).state,
            DiscoveryState::TranscriptFound { path: db.clone() }
        );
        let missing = DiscoveryContext {
            home_dir: PathBuf::from("/nonexistent"),
            config_override: None,
        };
        assert_eq!(
            CursorFamilyParser::windsurf().discover(&missing).state,
            DiscoveryState::NotInstalled
        );
    }
}
