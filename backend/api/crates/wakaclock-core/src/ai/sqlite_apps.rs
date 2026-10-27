//! Agents that keep sessions in their own SQLite database: OpenCode and Qoder.
//!
//! Both stores are read through [`super::sqlite_source`] (read-only, a locked database
//! is skipped, time budget, fingerprint skip). Rows are written and then updated in
//! place while a response streams, so each pass re-reads a window of recent rows and
//! IDs are stable per row; usage waits until a row is two minutes old.
//!
//! - **OpenCode** (`opencode*.db`): `part.data` JSON with `type = "tool"`, an editing
//!   `tool`, `state.status = "completed"`, `state.input.filePath` and
//!   `state.metadata.filediff.{additions, deletions}`; usage from `message.data`
//!   `tokens.{input, output, cache.read, cache.write}` with `modelID`.
//! - **Qoder** (`local.db`): `chat_message` rows; a tool row's `tool_result` JSON lists
//!   `results[].{path, diffInfo.{add, delete}}`; an assistant row's `token_info` has
//!   `prompt_tokens`/`completion_tokens`/`cached_tokens`.
//!
//! The schemas come from public facts with no local database available, so tables or
//! fields that are missing yield nothing. These runtimes are new: usage only, edits stay
//! dry-run. Prompt text, tool input other than a path, and diffs are never kept.

use crate::ai::event::{opaque_file_event_id, AiConfidence, AiEditEvent, AiEventSource};
use crate::ai::fields::{count_at, embedded_object, string_at, timestamp_at};
use crate::ai::normalize_identity_model;
use crate::ai::parser::{
    history_floor, keep_history_floor, AiActivityParser, AiParseError, DiscoveryContext,
    DiscoveryResult, DiscoveryState, ParseBatch, ParseContext, ParseWarning, ParserCursor,
};
use crate::ai::source::{SourceCheckpoint, SourceKind};
use crate::ai::sqlite_source::{open_read_only, read_rows_after, SqliteRead, SqliteReadOptions};
use crate::ai::usage::{AiUsageRecord, TokenSource};
use crate::broker::BrokerChangeKind;
use chrono::{DateTime, Utc};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const RESCAN_ROWS: i64 = 500;
const USAGE_WINDOW_ROWS: i64 = 2_000;
const USAGE_SETTLE_SECONDS: i64 = 120;

#[derive(Clone, Copy)]
enum App {
    OpenCode,
    Qoder,
}

pub struct SqliteAppParser {
    app: App,
}

impl SqliteAppParser {
    pub fn opencode() -> Self {
        Self { app: App::OpenCode }
    }

    pub fn qoder() -> Self {
        Self { app: App::Qoder }
    }

    fn agent(&self) -> &'static str {
        match self.app {
            App::OpenCode => "opencode",
            App::Qoder => "qoder",
        }
    }

    fn databases(&self, context: &DiscoveryContext) -> Vec<PathBuf> {
        let home = &context.home_dir;
        let app_support = if cfg!(target_os = "macos") {
            home.join("Library/Application Support")
        } else if cfg!(target_os = "windows") {
            home.join("AppData/Roaming")
        } else {
            home.join(".config")
        };
        match self.app {
            App::OpenCode => {
                let dirs = match &context.config_override {
                    Some(dir) => vec![dir.clone()],
                    None => vec![
                        home.join(".local/share/opencode"),
                        app_support.join("opencode"),
                    ],
                };
                let mut found: Vec<PathBuf> = dirs
                    .iter()
                    .filter_map(|dir| fs::read_dir(dir).ok())
                    .flat_map(|entries| entries.flatten().map(|entry| entry.path()))
                    .filter(|path| {
                        path.file_name().is_some_and(|name| {
                            let name = name.to_string_lossy();
                            name.starts_with("opencode") && name.ends_with(".db")
                        })
                    })
                    .collect();
                found.sort();
                found
            }
            App::Qoder => {
                let db = match &context.config_override {
                    Some(dir) => dir.join("local.db"),
                    None => app_support.join("Qoder/SharedClientCache/cache/db/local.db"),
                };
                if db.is_file() {
                    vec![db]
                } else {
                    Vec::new()
                }
            }
        }
    }

    fn edit_query(&self) -> &'static str {
        match self.app {
            App::OpenCode => {
                "SELECT rowid, data FROM part WHERE rowid > ?1 ORDER BY rowid LIMIT ?2"
            }
            App::Qoder => {
                "SELECT rowid, session_id, request_id, role, tool_result, token_info, gmt_create \
                 FROM chat_message WHERE rowid > ?1 ORDER BY rowid LIMIT ?2"
            }
        }
    }

    fn usage_query(&self) -> &'static str {
        match self.app {
            App::OpenCode => {
                "SELECT rowid, data FROM message WHERE rowid > ?1 ORDER BY rowid LIMIT ?2"
            }
            App::Qoder => self.edit_query(),
        }
    }

    fn max_rowid_query(&self) -> &'static str {
        match self.app {
            App::OpenCode => "SELECT COALESCE(MAX(rowid), 0) FROM part",
            App::Qoder => "SELECT COALESCE(MAX(rowid), 0) FROM chat_message",
        }
    }

    fn usage_max_rowid_query(&self) -> &'static str {
        match self.app {
            App::OpenCode => "SELECT COALESCE(MAX(rowid), 0) FROM message",
            App::Qoder => self.max_rowid_query(),
        }
    }
}

/// One row as JSON: OpenCode's `data` column, or Qoder's columns as an object.
fn row_json(app: App, row: &rusqlite::Row<'_>) -> rusqlite::Result<Value> {
    let text =
        |index: usize| -> rusqlite::Result<Option<String>> { row.get::<_, Option<String>>(index) };
    Ok(match app {
        App::OpenCode => embedded_object(text(1)?.map(Value::String).as_ref()),
        App::Qoder => serde_json::json!({
            "rowid": row.get::<_, i64>(0)?,
            "session_id": text(1)?,
            "request_id": text(2)?,
            "role": text(3)?,
            "tool_result": embedded_object(text(4)?.map(Value::String).as_ref()),
            "token_info": embedded_object(text(5)?.map(Value::String).as_ref()),
            "gmt_create": row.get::<_, Option<i64>>(6).ok().flatten(),
        }),
    })
}

struct Edit {
    session: String,
    operation: String,
    path: String,
    added: Option<u32>,
    deleted: Option<u32>,
    created: bool,
    model: Option<String>,
    at: Option<DateTime<Utc>>,
}

fn opencode_edits(part: &Value) -> Vec<Edit> {
    if string_at(part, &["type"]).as_deref() != Some("tool") {
        return Vec::new();
    }
    let tool = string_at(part, &["tool"])
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !["edit", "write", "patch", "multiedit", "apply_patch"].contains(&tool.as_str()) {
        return Vec::new();
    }
    let state = part.get("state").cloned().unwrap_or(Value::Null);
    if string_at(&state, &["status"]).as_deref() != Some("completed") {
        return Vec::new();
    }
    let input = embedded_object(state.get("input"));
    let Some(path) = string_at(&input, &["filePath", "file_path", "path"]) else {
        return Vec::new();
    };
    let diff = state
        .get("metadata")
        .and_then(|metadata| metadata.get("filediff"))
        .cloned()
        .unwrap_or(Value::Null);
    vec![Edit {
        session: string_at(part, &["sessionID", "sessionId"])
            .unwrap_or_else(|| "unknown-session".to_string()),
        operation: string_at(part, &["callID", "id"]).unwrap_or_default(),
        path,
        added: count_at(&diff, &["additions"]),
        deleted: count_at(&diff, &["deletions"]),
        created: tool == "write",
        model: None,
        at: state
            .get("time")
            .and_then(|time| timestamp_at(time, &["end", "start"])),
    }]
}

fn qoder_edits(row: &Value) -> Vec<Edit> {
    let result = row.get("tool_result").cloned().unwrap_or(Value::Null);
    let Some(results) = result.get("results").and_then(Value::as_array) else {
        return Vec::new();
    };
    let session = string_at(row, &["session_id"]).unwrap_or_else(|| "unknown-session".to_string());
    let request = string_at(row, &["request_id"]).unwrap_or_default();
    results
        .iter()
        .enumerate()
        .filter_map(|(index, item)| {
            let path = string_at(item, &["path", "filePath"])?;
            let diff = item.get("diffInfo")?;
            Some(Edit {
                session: session.clone(),
                operation: format!("{request}:{index}"),
                path,
                added: count_at(diff, &["add", "added"]),
                deleted: count_at(diff, &["delete", "deleted"]),
                created: false,
                model: None,
                at: timestamp_at(row, &["gmt_create"]),
            })
        })
        .collect()
}

impl SqliteAppParser {
    fn edits(&self, row: &Value) -> Vec<Edit> {
        match self.app {
            App::OpenCode => opencode_edits(row),
            App::Qoder => qoder_edits(row),
        }
    }

    fn edit_event(&self, edit: Edit) -> AiEditEvent {
        let agent = self.agent();
        AiEditEvent {
            event_id: opaque_file_event_id(
                &format!("{agent}-v1"),
                &format!("{}:{}", edit.session, edit.operation),
                &edit.path,
            ),
            agent: agent.to_string(),
            provider: None,
            model: edit.model,
            session_id: Some(edit.session),
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: Some(AiEventSource::Transcript.as_str().to_string()),
            tool_event_id: Some(edit.operation),
            producer_surface: None,
            occurred_at: edit.at.unwrap_or_else(Utc::now),
            entity: PathBuf::from(&edit.path),
            project_root: None,
            change_kind: if edit.created {
                BrokerChangeKind::Create
            } else {
                BrokerChangeKind::Modify
            },
            previous_entity: None,
            lines_added: edit.added,
            lines_deleted: edit.deleted,
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        }
    }

    fn usage_record(
        &self,
        row: &Value,
        now: DateTime<Utc>,
        floor: DateTime<Utc>,
    ) -> Option<AiUsageRecord> {
        let agent = self.agent();
        let (id, session, at, model, input, output, cache_read, cache_write) = match self.app {
            App::OpenCode => {
                if string_at(row, &["role"]).as_deref() != Some("assistant") {
                    return None;
                }
                let tokens = row.get("tokens")?;
                let cache = tokens.get("cache").cloned().unwrap_or(Value::Null);
                (
                    string_at(row, &["id"])?,
                    string_at(row, &["sessionID", "sessionId"])?,
                    row.get("time")
                        .and_then(|time| timestamp_at(time, &["created"]))?,
                    string_at(row, &["modelID", "modelId"]),
                    count_at(tokens, &["input"]),
                    count_at(tokens, &["output"]),
                    count_at(&cache, &["read"]),
                    count_at(&cache, &["write"]),
                )
            }
            App::Qoder => {
                let tokens = row.get("token_info").filter(|info| info.is_object())?;
                (
                    format!(
                        "{}:{}",
                        string_at(row, &["request_id"]).unwrap_or_default(),
                        row.get("rowid").and_then(Value::as_i64).unwrap_or_default()
                    ),
                    string_at(row, &["session_id"])?,
                    timestamp_at(row, &["gmt_create"])?,
                    string_at(tokens, &["model", "model_name"]),
                    count_at(tokens, &["prompt_tokens"]),
                    count_at(tokens, &["completion_tokens"]),
                    count_at(tokens, &["cached_tokens"]),
                    None,
                )
            }
        };
        if at < floor || (now - at).num_seconds() < USAGE_SETTLE_SECONDS {
            return None;
        }
        if input.unwrap_or(0) == 0 && output.unwrap_or(0) == 0 {
            return None;
        }
        Some(AiUsageRecord {
            usage_event_id: format!("{agent}-usage-v1:{id}"),
            ai_session_id: session,
            collector_id: None,
            occurred_at: at,
            agent: agent.to_string(),
            provider: None,
            model: model.and_then(|name| normalize_identity_model(Some(&name))),
            prompt_count: 0,
            prompt_character_count: None,
            input_tokens: input.map(u64::from),
            output_tokens: output.map(u64::from),
            cache_read_tokens: cache_read.map(u64::from),
            cache_write_tokens: cache_write.map(u64::from),
            token_source: TokenSource::Transcript,
            project_hint: None,
        })
    }

    fn read(
        &self,
        db: &Path,
        query: &str,
        after: i64,
        previous: Option<&crate::ai::source::DbFingerprint>,
        options: &SqliteReadOptions,
    ) -> rusqlite::Result<SqliteRead<Value>> {
        let app = self.app;
        read_rows_after(
            db,
            after,
            previous,
            query,
            |row| row_json(app, row),
            options,
        )
    }
}

fn checkpoint_of(cursor: Option<&ParserCursor>) -> (i64, Option<crate::ai::source::DbFingerprint>) {
    match cursor
        .and_then(|cursor| cursor.context.as_ref())
        .and_then(|context| context.source.as_ref())
    {
        Some(SourceCheckpoint::Sqlite {
            last_rowid,
            fingerprint,
        }) => (*last_rowid, *fingerprint),
        _ => (0, None),
    }
}

impl AiActivityParser for SqliteAppParser {
    fn id(&self) -> &'static str {
        self.agent()
    }

    fn source_kind(&self) -> SourceKind {
        SourceKind::Sqlite
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        DiscoveryResult {
            state: match self.databases(context).into_iter().next() {
                Some(path) => DiscoveryState::TranscriptFound { path },
                None => DiscoveryState::NotInstalled,
            },
        }
    }

    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        let found = self.databases(context);
        if found.is_empty() {
            return vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }];
        }
        found
            .into_iter()
            .map(|path| DiscoveryResult {
                state: DiscoveryState::TranscriptFound { path },
            })
            .collect()
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
        let (last_rowid, previous) = checkpoint_of(Some(cursor));
        let options = SqliteReadOptions {
            // The rescan window must not use up the pass, or the checkpoint never moves.
            max_rows: context.max_batch_records + RESCAN_ROWS as usize,
            time_budget: context.time_budget,
            ..SqliteReadOptions::default()
        };
        let mut warnings = Vec::new();
        let start = last_rowid.saturating_sub(RESCAN_ROWS).max(0);
        let (events, checkpoint) =
            match self.read(&db, self.edit_query(), start, previous.as_ref(), &options) {
                Ok(SqliteRead::Rows {
                    rows,
                    last_rowid: read_to,
                    fingerprint,
                    complete,
                }) => (
                    rows.iter()
                        .flat_map(|row| self.edits(row))
                        .map(|edit| self.edit_event(edit))
                        .collect(),
                    Some(SourceCheckpoint::Sqlite {
                        last_rowid: read_to.max(last_rowid),
                        fingerprint: complete.then_some(fingerprint),
                    }),
                ),
                Ok(SqliteRead::Locked) => {
                    warnings.push(ParseWarning {
                        record_id: None,
                        message: format!("{} database was locked; skipped this pass", self.agent()),
                    });
                    (
                        Vec::new(),
                        cursor
                            .context
                            .as_ref()
                            .and_then(|context| context.source.clone()),
                    )
                }
                Ok(SqliteRead::Missing | SqliteRead::Unchanged) => (
                    Vec::new(),
                    cursor
                        .context
                        .as_ref()
                        .and_then(|context| context.source.clone()),
                ),
                Err(error) => {
                    // A missing table or column means an unknown schema version: report
                    // it and read nothing rather than guess.
                    warnings.push(ParseWarning {
                        record_id: None,
                        message: format!("{} schema not recognised: {error}", self.agent()),
                    });
                    (
                        Vec::new(),
                        cursor
                            .context
                            .as_ref()
                            .and_then(|context| context.source.clone()),
                    )
                }
            };
        let mut next_context = cursor.context.clone().unwrap_or_default();
        next_context.source = checkpoint;
        keep_history_floor(&mut next_context, cursor, Utc::now());
        let events: Vec<AiEditEvent> = events;
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
        self.parse_usage_within(source, cursor, SqliteReadOptions::default().time_budget)
    }

    fn parse_usage_within(
        &self,
        source: &Path,
        cursor: Option<&ParserCursor>,
        budget: std::time::Duration,
    ) -> std::io::Result<Vec<AiUsageRecord>> {
        // The edit pass may already have stored this fingerprint, and a row skipped by
        // the settle rule must be read again even when the database has not changed, so
        // usage re-reads a recent window; the history floor keeps old rows out.
        let defaults = SqliteReadOptions::default();
        let options = SqliteReadOptions {
            time_budget: budget.min(defaults.time_budget),
            ..defaults
        };
        let head = open_read_only(source, options.busy_timeout)
            .and_then(|connection| {
                connection.query_row(self.usage_max_rowid_query(), [], |row| row.get::<_, i64>(0))
            })
            .unwrap_or(0);
        let start = head.saturating_sub(USAGE_WINDOW_ROWS).max(0);
        let rows = match self.read(source, self.usage_query(), start, None, &options) {
            Ok(SqliteRead::Rows { rows, .. }) => rows,
            _ => return Ok(Vec::new()),
        };
        let now = Utc::now();
        let floor = history_floor(cursor, now);
        Ok(rows
            .iter()
            .filter_map(|row| self.usage_record(row, now, floor))
            .collect())
    }

    fn cursor_is_reusable(&self, _cursor: &ParserCursor, _source_len: u64) -> bool {
        true
    }

    fn seed_at_head(&self, cursor: &ParserCursor, _source_len: u64) -> ParserCursor {
        let head = open_read_only(
            Path::new(&cursor.source_path),
            SqliteReadOptions::default().busy_timeout,
        )
        .and_then(|connection| {
            connection.query_row(self.max_rowid_query(), [], |row| row.get::<_, i64>(0))
        })
        .unwrap_or(0);
        let mut seeded = cursor.clone();
        let mut context = seeded.context.clone().unwrap_or_default();
        context.source = Some(SourceCheckpoint::Sqlite {
            last_rowid: head,
            fingerprint: None,
        });
        context.history_floor_ms = Some(Utc::now().timestamp_millis());
        seeded.context = Some(context);
        seeded
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::{params, Connection};
    use serde_json::json;

    const SECRET: &str = "SECRET-MARKER-db51";

    fn temp_dir(name: &str) -> PathBuf {
        let nonce = Utc::now().timestamp_nanos_opt().unwrap_or_default();
        let dir = std::env::temp_dir().join(format!("wakaclock-sqlite-apps-{name}-{nonce}"));
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn hour_ago() -> i64 {
        Utc::now().timestamp_millis() - 3_600_000
    }

    fn cursor_for(db: &Path) -> ParserCursor {
        ParserCursor {
            source_path: db.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        }
    }

    fn opencode_db(dir: &Path) -> (PathBuf, Connection) {
        let db = dir.join("opencode.db");
        let connection = Connection::open(&db).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE part (id TEXT PRIMARY KEY, message_id TEXT, session_id TEXT, data TEXT);
                 CREATE TABLE message (id TEXT PRIMARY KEY, session_id TEXT, data TEXT);",
            )
            .unwrap();
        (db, connection)
    }

    fn put_part(connection: &Connection, id: &str, data: &Value) {
        connection
            .execute(
                "INSERT INTO part (id, message_id, session_id, data) VALUES (?1, 'm', 's', ?2)",
                params![id, data.to_string()],
            )
            .unwrap();
    }

    fn tool_part(status: &str, tool: &str, path: &str) -> Value {
        json!({"type": "tool", "tool": tool, "callID": format!("call-{path}"), "sessionID": "ses-1",
               "state": {"status": status, "input": {"filePath": path, "content": SECRET},
                         "metadata": {"filediff": {"additions": 5, "deletions": 2}},
                         "time": {"start": hour_ago(), "end": hour_ago()}}})
    }

    #[test]
    fn opencode_completed_edit_parts_become_events() {
        let dir = temp_dir("opencode");
        let (db, connection) = opencode_db(&dir);
        put_part(&connection, "p1", &json!({"type": "text", "text": SECRET}));
        put_part(
            &connection,
            "p2",
            &tool_part("completed", "edit", "/repo/a.ts"),
        );
        put_part(
            &connection,
            "p3",
            &tool_part("running", "edit", "/repo/b.ts"),
        );
        put_part(
            &connection,
            "p4",
            &tool_part("completed", "read", "/repo/a.ts"),
        );
        put_part(
            &connection,
            "p5",
            &tool_part("completed", "write", "/repo/new.ts"),
        );
        let parser = SqliteAppParser::opencode();
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor_for(&db)))
            .unwrap();
        let paths: Vec<&Path> = batch
            .events
            .iter()
            .map(|event| event.entity.as_path())
            .collect();
        assert_eq!(
            paths,
            vec![Path::new("/repo/a.ts"), Path::new("/repo/new.ts")]
        );
        assert_eq!(
            (batch.events[0].lines_added, batch.events[0].lines_deleted),
            (Some(5), Some(2))
        );
        assert_eq!(batch.events[0].session_id.as_deref(), Some("ses-1"));
        assert_eq!(batch.events[1].change_kind, BrokerChangeKind::Create);
        let rendered = format!("{:?}{:?}", batch.events, batch.next_cursor);
        assert!(!rendered.contains(SECRET));
    }

    #[test]
    fn opencode_usage_comes_from_settled_assistant_messages() {
        let dir = temp_dir("opencode-usage");
        let (db, connection) = opencode_db(&dir);
        for (id, role, created) in [
            ("m1", "assistant", hour_ago()),
            ("m2", "user", hour_ago()),
            (
                "m0",
                "assistant",
                Utc::now().timestamp_millis() - 3 * 86_400_000,
            ),
            ("m3", "assistant", Utc::now().timestamp_millis()),
        ] {
            let data = json!({"id": id, "role": role, "sessionID": "ses-1", "modelID": "claude-sonnet-4",
                              "time": {"created": created},
                              "tokens": {"input": 800, "output": 60, "cache": {"read": 30, "write": 5}}});
            connection
                .execute(
                    "INSERT INTO message (id, session_id, data) VALUES (?1, 's', ?2)",
                    params![id, data.to_string()],
                )
                .unwrap();
        }
        let records = SqliteAppParser::opencode().parse_usage(&db, None).unwrap();
        assert_eq!(records.len(), 1);
        let usage = &records[0];
        assert_eq!(usage.usage_event_id, "opencode-usage-v1:m1");
        assert_eq!(
            (
                usage.input_tokens,
                usage.cache_read_tokens,
                usage.cache_write_tokens
            ),
            (Some(800), Some(30), Some(5))
        );
        usage.validate().unwrap();
    }

    #[test]
    fn qoder_tool_rows_and_token_rows_are_read() {
        let dir = temp_dir("qoder");
        let db = dir.join("local.db");
        let connection = Connection::open(&db).unwrap();
        connection
            .execute_batch(
                "CREATE TABLE chat_message (session_id TEXT, request_id TEXT, role TEXT,
                 tool_result TEXT, token_info TEXT, gmt_create INTEGER, content TEXT);",
            )
            .unwrap();
        let tool = json!({"toolCallName": "edit_file", "parameters": {"file_path": "/repo/q.rs", "code": SECRET},
                          "results": [{"path": "/repo/q.rs", "diffInfo": {"add": 3, "delete": 1}}]});
        connection
            .execute(
                "INSERT INTO chat_message VALUES ('s1', 'r1', 'tool', ?1, NULL, ?3, ?2)",
                params![tool.to_string(), SECRET, hour_ago()],
            )
            .unwrap();
        let tokens = json!({"prompt_tokens": 400, "completion_tokens": 40, "cached_tokens": 10});
        connection
            .execute(
                "INSERT INTO chat_message VALUES ('s1', 'r1', 'assistant', NULL, ?1, ?3, ?2)",
                params![tokens.to_string(), SECRET, hour_ago()],
            )
            .unwrap();
        let parser = SqliteAppParser::qoder();
        let batch = parser
            .parse_since(&ParseContext::default(), Some(&cursor_for(&db)))
            .unwrap();
        assert_eq!(batch.events.len(), 1);
        assert_eq!(
            (batch.events[0].lines_added, batch.events[0].lines_deleted),
            (Some(3), Some(1))
        );
        let usage = parser.parse_usage(&db, None).unwrap();
        assert_eq!(usage.len(), 1);
        assert_eq!(
            (usage[0].input_tokens, usage[0].output_tokens),
            (Some(400), Some(40))
        );
        usage[0].validate().unwrap();
        let rendered = format!("{:?}{:?}", batch.events, usage);
        assert!(!rendered.contains(SECRET));
    }

    #[test]
    fn an_unknown_schema_is_reported_and_reads_nothing() {
        let dir = temp_dir("schema");
        let db = dir.join("opencode-v9.db");
        Connection::open(&db)
            .unwrap()
            .execute_batch("CREATE TABLE something_else (x TEXT);")
            .unwrap();
        let batch = SqliteAppParser::opencode()
            .parse_since(&ParseContext::default(), Some(&cursor_for(&db)))
            .unwrap();
        assert!(batch.events.is_empty());
        assert!(batch.warnings[0].message.contains("schema not recognised"));
    }

    #[test]
    fn discovery_finds_opencode_databases_by_name() {
        let dir = temp_dir("discover");
        fs::write(dir.join("opencode.db"), b"").unwrap();
        fs::write(dir.join("opencode-dev.db"), b"").unwrap();
        fs::write(dir.join("other.db"), b"").unwrap();
        let context = DiscoveryContext {
            home_dir: dir.clone(),
            config_override: Some(dir.clone()),
        };
        assert_eq!(
            SqliteAppParser::opencode().discover_sources(&context).len(),
            2
        );
        assert_eq!(
            SqliteAppParser::qoder().discover(&context).state,
            DiscoveryState::NotInstalled
        );
    }

    #[test]
    fn the_checkpoint_moves_past_the_rescan_window() {
        let dir = temp_dir("advance");
        let (db, connection) = opencode_db(&dir);
        for index in 0..30 {
            put_part(&connection, &format!("p{index}"), &json!({"type": "text"}));
        }
        let parser = SqliteAppParser::opencode();
        let context = ParseContext {
            max_batch_records: 10,
            ..ParseContext::default()
        };
        let mut cursor = cursor_for(&db);
        let mut seen = Vec::new();
        for _ in 0..3 {
            cursor = parser
                .parse_since(&context, Some(&cursor))
                .unwrap()
                .next_cursor;
            seen.push(checkpoint_of(Some(&cursor)).0);
        }
        assert_eq!(seen, vec![30, 30, 30]);
        put_part(
            &connection,
            "late",
            &tool_part("completed", "edit", "/repo/late.ts"),
        );
        let batch = parser.parse_since(&context, Some(&cursor)).unwrap();
        assert_eq!(batch.events.len(), 1);
        assert_eq!(checkpoint_of(Some(&batch.next_cursor)).0, 31);
    }

    #[test]
    fn usage_reads_stop_within_their_budget() {
        let dir = temp_dir("budget");
        let (db, connection) = opencode_db(&dir);
        let transaction = connection.unchecked_transaction().unwrap();
        for index in 0..20_000 {
            let data = json!({"id": format!("m{index}"), "role": "assistant", "sessionID": "s",
                              "time": {"created": hour_ago()}, "tokens": {"input": 1, "output": 1}});
            transaction
                .execute(
                    "INSERT INTO message (id, session_id, data) VALUES (?1, 's', ?2)",
                    params![format!("m{index}"), data.to_string()],
                )
                .unwrap();
        }
        transaction.commit().unwrap();
        let parser = SqliteAppParser::opencode();
        let started = std::time::Instant::now();
        let _ = parser
            .parse_usage_within(&db, None, std::time::Duration::from_millis(1))
            .unwrap();
        assert!(started.elapsed() < std::time::Duration::from_secs(1));
        assert_eq!(parser.parse_usage(&db, None).unwrap().len(), 2_000);
    }

    #[test]
    fn seeded_sources_report_no_earlier_usage() {
        let dir = temp_dir("seed-usage");
        let (db, connection) = opencode_db(&dir);
        let data = json!({"id": "m1", "role": "assistant", "sessionID": "ses-1",
                          "time": {"created": hour_ago()}, "tokens": {"input": 10, "output": 1}});
        connection
            .execute(
                "INSERT INTO message (id, session_id, data) VALUES ('m1', 's', ?1)",
                params![data.to_string()],
            )
            .unwrap();
        let parser = SqliteAppParser::opencode();
        let seeded = parser.seed_at_head(&cursor_for(&db), 0);
        assert!(parser.parse_usage(&db, Some(&seeded)).unwrap().is_empty());
        assert_eq!(parser.parse_usage(&db, None).unwrap().len(), 1);
    }

    #[test]
    fn seeding_starts_after_existing_rows() {
        let dir = temp_dir("seed");
        let (db, connection) = opencode_db(&dir);
        put_part(
            &connection,
            "p1",
            &tool_part("completed", "edit", "/repo/a.ts"),
        );
        let parser = SqliteAppParser::opencode();
        let seeded = parser.seed_at_head(&cursor_for(&db), 0);
        assert_eq!(checkpoint_of(Some(&seeded)).0, 1);
    }
}
