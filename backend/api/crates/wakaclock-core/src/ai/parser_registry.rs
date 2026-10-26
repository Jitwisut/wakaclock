//! The transcript parsers this build can run, derived from the adapter catalog.
//!
//! The catalog decides which runtimes are exposed, so a scaffold or manual adapter
//! cannot become a working parser merely because a name was added somewhere. Adding a
//! parser means adding its [`AdapterRuntime`] arm here.

use crate::ai::adapter::{AdapterRegistry, AdapterRuntime};
use crate::ai::parser::AiActivityParser;
use crate::ai::{ClaudeCodeParser, CodexParser, GeminiCliParser};

/// One runnable parser and the runtime that owns its policy.
pub struct RegisteredParser {
    pub id: &'static str,
    pub runtime: AdapterRuntime,
    pub parser: Box<dyn AiActivityParser>,
}

fn parser_for(runtime: AdapterRuntime) -> Option<Box<dyn AiActivityParser>> {
    match runtime {
        AdapterRuntime::ClaudeCode => Some(Box::new(ClaudeCodeParser::new())),
        AdapterRuntime::Codex => Some(Box::new(CodexParser::new())),
        AdapterRuntime::GeminiCli => Some(Box::new(GeminiCliParser::new())),
        _ => None,
    }
}

/// Every built-in parser, in catalog order. A catalog entry is included only when its
/// runtime has a parser and its manifest id matches the parser's own id.
pub fn builtin_parsers() -> Vec<RegisteredParser> {
    AdapterRegistry::builtin()
        .catalog_v1()
        .adapters
        .into_iter()
        .filter_map(|entry| {
            let parser = parser_for(entry.runtime)?;
            let id = parser.id();
            (entry.manifest.id == id).then_some(RegisteredParser {
                id,
                runtime: entry.runtime,
                parser,
            })
        })
        .collect()
}

/// Whether edits parsed for `parser_id` may be sent as heartbeats. Unknown ids are
/// treated as new parsers: usage only.
pub fn emits_edit_heartbeats(parser_id: &str) -> bool {
    builtin_parsers()
        .iter()
        .find(|registered| registered.id == parser_id)
        .is_some_and(|registered| registered.runtime.emits_edit_heartbeats())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builtin_parsers_are_the_three_transcript_adapters() {
        let ids: Vec<&str> = builtin_parsers().iter().map(|entry| entry.id).collect();
        assert_eq!(ids.len(), 3);
        for id in ["claude-code", "codex", "gemini-cli"] {
            assert!(ids.contains(&id), "{id} missing from {ids:?}");
        }
    }

    #[test]
    fn existing_parsers_keep_sending_edits_and_new_ones_do_not() {
        for id in ["claude-code", "codex", "gemini-cli"] {
            assert!(emits_edit_heartbeats(id), "{id}");
        }
        assert!(!emits_edit_heartbeats("cursor"));
        assert!(!AdapterRuntime::KiloCode.emits_edit_heartbeats());
        assert!(!AdapterRuntime::None.emits_edit_heartbeats());
    }
}
