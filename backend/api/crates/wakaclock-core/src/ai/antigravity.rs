//! Google Antigravity transcript adapter (desktop, IDE and CLI surfaces).
//!
//! Each surface keeps a JSONL transcript per session under
//! `~/.gemini/<surface>/brain/<session>/.system_generated/logs/transcript.jsonl`, where
//! `<surface>` is `antigravity`, `antigravity-ide` or `antigravity-cli`. Edits are found
//! with the same successful-tool-result rule as Gemini CLI
//! ([`super::gemini::edit_from_record`]) and labelled with `producer_surface`
//! (`desktop`, `ide` or `cli`).
//!
//! Only the JSONL transcript is read. Antigravity also keeps SQLite stores whose
//! payloads are protobuf; decoding those is out of scope (owner decision Q4), so token
//! usage may be incomplete. No local transcript was available when this was written:
//! the record shape is assumed to match Gemini CLI, and an unknown shape yields no edit.
//! Antigravity is a new runtime, so its edits stay local dry-run evidence.

use crate::ai::gemini::{edit_from_record, EditIdentity};
use crate::ai::jsonl::JsonlCursorReader;
use crate::ai::parser::{
    AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState, ParseBatch,
    ParseContext, ParseWarning, ParserCursor,
};
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};

const SURFACES: [(&str, &str); 3] = [
    ("antigravity", "desktop"),
    ("antigravity-ide", "ide"),
    ("antigravity-cli", "cli"),
];

pub struct AntigravityParser;

impl AntigravityParser {
    pub fn new() -> Self {
        Self
    }

    fn roots(context: &DiscoveryContext) -> Vec<PathBuf> {
        if let Some(root) = &context.config_override {
            return vec![root.clone()];
        }
        SURFACES
            .iter()
            .map(|(dir, _)| context.home_dir.join(".gemini").join(dir).join("brain"))
            .collect()
    }

    fn transcripts(context: &DiscoveryContext) -> (bool, Vec<PathBuf>) {
        let mut any_root = false;
        let mut files = Vec::new();
        for root in Self::roots(context) {
            if root.exists() {
                any_root = true;
                collect(&root, 0, &mut files);
            }
        }
        files.sort();
        (any_root, files)
    }
}

impl Default for AntigravityParser {
    fn default() -> Self {
        Self::new()
    }
}

fn collect(dir: &Path, depth: usize, out: &mut Vec<PathBuf>) {
    if depth > 5 {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            collect(&path, depth + 1, out);
        } else if path
            .file_name()
            .is_some_and(|name| name == "transcript.jsonl")
            && path
                .parent()
                .is_some_and(|parent| parent.ends_with(".system_generated/logs"))
        {
            out.push(path);
        }
    }
}

/// The surface a transcript belongs to, from the `.gemini/<surface>` directory.
fn surface_of(path: &Path) -> &'static str {
    SURFACES
        .iter()
        .rev()
        .find(|(dir, _)| path.components().any(|part| part.as_os_str() == *dir))
        .map(|(_, label)| *label)
        .unwrap_or("desktop")
}

fn identity_for(path: &Path) -> EditIdentity {
    EditIdentity {
        agent: "antigravity",
        // Antigravity routes to several model vendors; the model name carries identity.
        provider: None,
        id_prefix: "antigravity-v1",
        producer_surface: Some(surface_of(path)),
    }
}

impl AiActivityParser for AntigravityParser {
    fn id(&self) -> &'static str {
        "antigravity"
    }

    fn discover(&self, context: &DiscoveryContext) -> DiscoveryResult {
        let (any_root, files) = Self::transcripts(context);
        let newest = files.into_iter().max_by_key(|path| {
            fs::metadata(path)
                .and_then(|metadata| metadata.modified())
                .ok()
        });
        DiscoveryResult {
            state: match (any_root, newest) {
                (false, _) => DiscoveryState::NotInstalled,
                (true, Some(path)) => DiscoveryState::TranscriptFound { path },
                (true, None) => DiscoveryState::InstalledNoTranscript,
            },
        }
    }

    fn discover_sources(&self, context: &DiscoveryContext) -> Vec<DiscoveryResult> {
        let (any_root, files) = Self::transcripts(context);
        if !any_root {
            return vec![DiscoveryResult {
                state: DiscoveryState::NotInstalled,
            }];
        }
        if files.is_empty() {
            return vec![DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            }];
        }
        files
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
        let path = PathBuf::from(&cursor.source_path);
        let identity = identity_for(&path);
        let mut reader = JsonlCursorReader::open(&path, cursor.byte_offset).map_err(|error| {
            match error.kind() {
                std::io::ErrorKind::NotFound => AiParseError::NotFound {
                    path: cursor.source_path.clone(),
                },
                std::io::ErrorKind::PermissionDenied => AiParseError::PermissionDenied {
                    path: cursor.source_path.clone(),
                },
                _ => AiParseError::Io(error),
            }
        })?;
        let mut events = Vec::new();
        let mut warnings = Vec::new();
        let mut offset = cursor.byte_offset;
        let mut last_id = cursor.last_record_id.clone();
        let mut last_time = cursor.last_record_time;
        while events.len() < context.max_batch_records {
            let Some(line) = reader
                .next_line(context.max_record_bytes)
                .map_err(AiParseError::Io)?
            else {
                break;
            };
            offset = line.offset_after;
            if line.too_large {
                warnings.push(ParseWarning {
                    record_id: None,
                    message: "skipped oversized antigravity transcript record".to_string(),
                });
                continue;
            }
            let Ok(value) = serde_json::from_str::<Value>(&line.text) else {
                warnings.push(ParseWarning {
                    record_id: None,
                    message: "skipped malformed antigravity transcript record".to_string(),
                });
                continue;
            };
            if let Some(event) = edit_from_record(&value, line.offset_after, &identity) {
                last_id = Some(event.event_id.clone());
                last_time = Some(event.occurred_at);
                events.push(event);
            }
        }
        Ok(ParseBatch {
            events,
            next_cursor: ParserCursor {
                source_path: cursor.source_path.clone(),
                file_identity: cursor.file_identity.clone(),
                byte_offset: offset,
                last_record_id: last_id,
                last_record_time: last_time,
                context: cursor.context.clone(),
            },
            warnings,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    const SECRET: &str = "SECRET-MARKER-a9f1";

    fn transcript(root: &Path, surface: &str, session: &str, lines: &[Value]) -> PathBuf {
        let dir = root
            .join(".gemini")
            .join(surface)
            .join("brain")
            .join(session)
            .join(".system_generated")
            .join("logs");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join("transcript.jsonl");
        let body: String = lines.iter().map(|line| format!("{line}\n")).collect();
        fs::write(&path, body).unwrap();
        path
    }

    fn temp_home(name: &str) -> PathBuf {
        let nonce = chrono::Utc::now().timestamp_nanos_opt().unwrap_or_default();
        std::env::temp_dir().join(format!("wakaclock-antigravity-{name}-{nonce}"))
    }

    fn records() -> Vec<Value> {
        vec![
            json!({"type": "user", "content": SECRET, "timestamp": "2026-10-26T10:00:00Z"}),
            json!({"tool_name": "replace", "id": "call-1", "file_path": "/repo/a.rs",
                   "diff": format!("@@ -1 +1,2 @@\n-{SECRET}\n+one\n+two"), "model": "gemini-2.5-pro",
                   "timestamp": "2026-10-26T10:00:01Z"}),
            json!({"tool_name": "write_file", "id": "call-2", "file_path": "/repo/b.rs",
                   "success": false, "content": SECRET, "timestamp": "2026-10-26T10:00:02Z"}),
            json!({"tool_name": "read_file", "id": "call-3", "file_path": "/repo/a.rs"}),
        ]
    }

    fn parse(path: &Path) -> ParseBatch {
        let cursor = ParserCursor {
            source_path: path.to_string_lossy().into_owned(),
            file_identity: None,
            byte_offset: 0,
            last_record_id: None,
            last_record_time: None,
            context: None,
        };
        AntigravityParser::new()
            .parse_since(&ParseContext::default(), Some(&cursor))
            .unwrap()
    }

    #[test]
    fn successful_edits_are_attributed_to_antigravity_with_their_surface() {
        let home = temp_home("edits");
        let ide = transcript(&home, "antigravity-ide", "s1", &records());
        let batch = parse(&ide);
        assert_eq!(batch.events.len(), 1);
        let edit = &batch.events[0];
        assert_eq!(edit.agent, "antigravity");
        assert_eq!(edit.provider, None);
        assert_eq!(edit.producer_surface.as_deref(), Some("ide"));
        assert_eq!(edit.entity, PathBuf::from("/repo/a.rs"));
        assert_eq!((edit.lines_added, edit.lines_deleted), (Some(2), Some(1)));
        assert!(edit.event_id.starts_with("antigravity-v1:"));
    }

    #[test]
    fn each_surface_is_discovered_and_labelled() {
        let home = temp_home("discover");
        transcript(&home, "antigravity", "s1", &records());
        transcript(&home, "antigravity-ide", "s2", &records());
        let cli = transcript(&home, "antigravity-cli", "s3", &records());
        let context = DiscoveryContext {
            home_dir: home.clone(),
            config_override: None,
        };
        let found = AntigravityParser::new().discover_sources(&context);
        assert_eq!(found.len(), 3);
        assert_eq!(surface_of(&cli), "cli");
        let missing = DiscoveryContext {
            home_dir: home.join("nobody"),
            config_override: None,
        };
        assert_eq!(
            AntigravityParser::new().discover(&missing).state,
            DiscoveryState::NotInstalled
        );
    }

    #[test]
    fn no_prompt_or_content_leaves_the_parser() {
        let home = temp_home("privacy");
        let path = transcript(&home, "antigravity", "s1", &records());
        let batch = parse(&path);
        let rendered = format!("{:?}{:?}", batch.events, batch.next_cursor);
        assert!(!rendered.contains(SECRET));
    }
}
