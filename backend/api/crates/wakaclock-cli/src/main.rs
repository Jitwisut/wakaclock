use clap::{Parser, Subcommand};
use fs2::FileExt;
use serde::Deserialize;
use std::{
    collections::HashSet,
    error::Error,
    fs,
    io::{self, BufRead, BufReader, Read},
    path::{Path, PathBuf},
    str::FromStr,
    time::Duration,
};
use uuid::Uuid;
mod agent_service;
mod broker;
mod tool_snapshot;
use tool_snapshot::{AiToolInput, ToolSnapshot, WorkspaceChange};
use wakaclock_ast::detect_file;
use wakaclock_core::{
    ai::{
        normalize_agent_id, parse_claude_usage, parse_codex_usage, parse_gemini_usage,
        scan_ai_processes, AiActivityParser, AiAttributionState, AiConfidence, AiEditEvent,
        AiEventSource, ClaudeCodeParser, CodexParser, DiscoveryContext, DiscoveryResult,
        DiscoveryState, FileChangeKind, GeminiCliParser, ParseContext, ParserCursor,
        WorkspaceWatcher,
    },
    api_client::ApiClient,
    broker::BrokerEventV1,
    config::Config,
    error::AppError,
    git,
    heartbeat::{
        resolve_attribution, union_activity_seconds, ActivitySegment, ActorType, AttributionInput,
        Category, EntityType, Heartbeat, MAX_ACTIVITY_GAP_SECONDS,
    },
    queue::Queue,
};

/// Match WakaTime's default keystroke timeout when joining agent heartbeats. AI
/// transcript/tool events are activity markers too; they should contribute the interval
/// between nearby events, not remain permanently at zero seconds.
const AI_ACTIVITY_TIMEOUT_SECONDS: f64 = MAX_ACTIVITY_GAP_SECONDS;
const AI_ACTIVITY_STREAM: &str = "ai";

/// Process-wide lease for transcript sync. SQLite serializes writes, but without a
/// separate lock two CLI processes can both parse and submit the same new event before
/// either marks it delivered. Holding this OS lock across parsing, delivery and state
/// updates makes the operation one-writer-at-a-time.
struct AiSyncLock {
    _file: fs::File,
}

impl AiSyncLock {
    fn acquire() -> Result<Option<Self>, Box<dyn Error>> {
        let home = dirs::home_dir().ok_or("cannot resolve home directory for ai-sync.lock")?;
        Self::try_acquire_at(&home.join(".wakaclock").join("ai-sync.lock"))
    }

    fn try_acquire_at(path: &Path) -> Result<Option<Self>, Box<dyn Error>> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let file = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)?;
        match file.try_lock_exclusive() {
            Ok(()) => Ok(Some(Self { _file: file })),
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => Ok(None),
            Err(error) => Err(Box::new(error)),
        }
    }
}

#[derive(Parser)]
#[command(name = "wakaclock", version, about = "Wakaclock CLI Hub")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
#[allow(clippy::large_enum_variant)]
enum Commands {
    Heartbeat {
        #[arg(short, long)]
        entity: String,

        #[arg(long = "type", default_value = "file")]
        entity_type: String,

        #[arg(long)]
        project: Option<String>,

        #[arg(long, default_value = "coding")]
        category: String,

        #[arg(short, long, default_value_t = false)]
        write: bool,

        #[arg(long)]
        line_number: Option<u32>,

        #[arg(long)]
        cursor_position: Option<u32>,

        #[arg(long)]
        keystrokes: Option<u32>,

        #[arg(long)]
        chars_added: Option<u32>,

        #[arg(long)]
        chars_deleted: Option<u32>,

        #[arg(long)]
        active_seconds: Option<f64>,

        /// Stable transport identity. Retries must reuse this value.
        #[arg(long)]
        heartbeat_id: Option<String>,

        /// JSON array of `{segment_id,start,end,source}` activity intervals.
        #[arg(long)]
        activity_segments: Option<String>,

        /// Canonical attribution state. Legacy clients may omit this and use the
        /// existing AI fields instead.
        #[arg(long)]
        actor_type: Option<ActorType>,

        /// Canonical attribution confidence in the range 0.0..=1.0.
        #[arg(long)]
        actor_confidence: Option<f32>,

        /// Identifies the caller in `user_agent`, e.g. `wakaclock-vscode/0.1.0`.
        /// Without it every heartbeat looks identical on the wire, and a stale editor
        /// build sending legacy payloads is indistinguishable from a current one — which
        /// is precisely how a two-hour timing regression stayed invisible.
        #[arg(long)]
        plugin: Option<String>,

        /// Name of the AI agent that made this edit (e.g. "claude-code", "codex",
        /// "gemini-cli") — this is legacy-compatible AI evidence. The canonical
        /// `actor_type`/`actor_confidence` fields are derived from it unless explicitly
        /// supplied and validated.
        #[arg(long)]
        ai_agent: Option<String>,

        /// Vendor/provider that supplied the AI attribution (e.g. "openai").
        #[arg(long)]
        ai_provider: Option<String>,

        /// Model supplied by the AI integration, when known.
        #[arg(long)]
        ai_model: Option<String>,

        /// Attribution source (e.g. "agent_hook", "ide_telemetry").
        #[arg(long)]
        ai_source: Option<String>,

        /// Attribution confidence (verified, correlated, inferred, unknown).
        #[arg(long)]
        ai_confidence: Option<String>,

        /// Stable id for this AI edit event; used to make retries idempotent downstream.
        #[arg(long)]
        ai_event_id: Option<String>,

        #[arg(long)]
        ai_lines_added: Option<u32>,

        #[arg(long)]
        ai_lines_deleted: Option<u32>,

        #[arg(long)]
        human_lines_added: Option<u32>,

        #[arg(long)]
        human_lines_deleted: Option<u32>,

        /// Lines whose provenance could not be proven as AI or manual.
        #[arg(long)]
        unattributed_lines_added: Option<u32>,

        #[arg(long)]
        unattributed_lines_deleted: Option<u32>,

        #[arg(long, default_value_t = false)]
        extra_heartbeats: bool,

        /// Emit a machine-readable outcome in addition to the normal text mode.
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Config {
        #[command(subcommand)]
        action: Option<ConfigAction>,
    },
    Status,
    Today {
        /// IANA timezone used for the user's calendar day (defaults to UTC).
        #[arg(long)]
        timezone: Option<String>,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Verify the configured (or WAKACLOCK_API_KEY) identity without mutating
    /// config.toml. This command always exits successfully for an HTTP outcome so
    /// editor clients can handle invalid keys and offline servers uniformly.
    Verify {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Ai {
        #[command(subcommand)]
        action: AiAction,
    },
    Broker {
        #[command(subcommand)]
        action: BrokerAction,
    },
    Agent {
        #[command(subcommand)]
        action: AgentAction,
    },
    Repair {
        #[command(subcommand)]
        action: RepairAction,
    },
    /// planai2.md Phase 0: one command that reports where the AI-detection pipeline
    /// is actually broken — CLI identity, broker health, transcript scan lag, and
    /// the last delivery failure — instead of needing several debug logs and manual
    /// checks to find the same thing (the 2026-08-31 audit that motivated this
    /// command found a stale binary, a stopped service, and a lagging scanner this
    /// way, by hand).
    Doctor {
        #[command(subcommand)]
        target: DoctorTarget,
    },
}

#[derive(Subcommand)]
enum DoctorTarget {
    /// AI-detection pipeline health: CLI identity, broker, transcripts, delivery.
    Ai {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
}

#[derive(Subcommand)]
enum BrokerAction {
    /// Run the local AI Activity Broker in the foreground.
    Run {
        #[arg(long, default_value_t = 1)]
        interval_seconds: u64,
    },
    /// Install or update the per-user broker service and start it immediately.
    Install {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Uninstall {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Start {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Stop {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Status {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Re-queue dead-letter events, or one selected event, for processing.
    Retry {
        #[arg(long)]
        event_id: Option<String>,
        #[arg(long, default_value_t = false)]
        all: bool,
    },
    /// Rotate the local bearer token and restart the service.
    RotateToken {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
}

#[derive(Subcommand)]
enum RepairAction {
    /// Rebuild today's canonical interval projection without deleting raw history.
    Day {
        #[arg(long, default_value = "today")]
        date: String,
        #[arg(long)]
        timezone: Option<String>,
        #[arg(long, default_value_t = false)]
        dry_run: bool,
        #[arg(long, default_value_t = false)]
        apply: bool,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
}

#[derive(Subcommand)]
enum AgentAction {
    /// Run the transcript watcher in the foreground. Service managers invoke this.
    Run {
        #[arg(long, default_value_t = 5)]
        interval_seconds: u64,
    },
    /// Install or update the per-user service and start it immediately.
    Install {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Uninstall {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Start {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Stop {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    Status {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
}

#[derive(Subcommand)]
enum AiAction {
    /// Report transcript discovery state for each supported agent, without reading or
    /// sending anything.
    Status,
    /// Phase A of the Universal Detector Core (planai.md Phase 4): scan the local
    /// process table for known AI coding tools currently running and report what was
    /// found — presence only, never an attribution decision. Reads no file contents;
    /// nothing is sent anywhere.
    ProcessScan {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Phase B of the Universal Detector Core (planai.md Phase 3): watch a workspace
    /// root and print each `FILE_CHANGED` event as it happens — evidence only, never
    /// an attribution decision. Runs until `--seconds` elapses or Ctrl-C. No file
    /// content is ever read; nothing is sent anywhere.
    Watch {
        /// Directory to watch recursively. Defaults to the current directory.
        #[arg(long)]
        path: Option<PathBuf>,
        /// Stop after this many seconds instead of running until interrupted.
        #[arg(long)]
        seconds: Option<u64>,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Ingest one privacy-safe AI file-mutation event from stdin as JSON. This is the
    /// universal adapter surface for MCP/tool bridges (for example ChatGPT -> Tan) and
    /// agents that do not expose a transcript format WakaClock can parse itself.
    Emit {
        /// Print a machine-readable delivery outcome.
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Capture a metadata-only workspace fingerprint immediately before an AI shell
    /// or MCP tool runs. The snapshot is persisted in local SQLite for crash-safe retry.
    ToolBefore {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Compare the current workspace against a matching ToolBefore snapshot and emit
    /// inferred AI file events for the actual changes caused during that tool call.
    ToolAfter {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Parse new events from each agent's local transcript since the last sync and
    /// send one AI-attributed heartbeat per event. There is no editor buffer to
    /// correlate against here (this reads transcripts directly, not via an IDE
    /// extension) — plan.md 8.2 requires attribution to keep working "when an agent
    /// edits files outside VS Code," which is exactly this path.
    Sync {
        /// Only sync this agent (`claude-code`, `codex`, or `gemini-cli`); default is all supported
        /// agents.
        #[arg(long)]
        agent: Option<String>,
        /// Parse and print what would be sent without contacting the server or
        /// advancing any cursor/delivery state.
        #[arg(long, default_value_t = false)]
        dry_run: bool,
        /// Ignore the saved parser cursor and replay the discovered transcript from
        /// byte zero. Already-delivered event IDs are still filtered, so this safely
        /// recovers from a cursor that advanced before delivery completed.
        #[arg(long, default_value_t = false)]
        from_start: bool,
        /// Parse one exact transcript file instead of whichever active session was
        /// modified most recently. Requires `--agent`; useful when multiple Codex
        /// sessions are writing concurrently.
        #[arg(long)]
        transcript: Option<PathBuf>,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Save an API key generated from the Wakaclock dashboard into ~/.wakaclock/config.toml
    SetKey {
        /// Deprecated positional form. Prefer `--stdin` so the secret never appears
        /// in shell history or process listings.
        key: Option<String>,
        #[arg(long, default_value_t = false)]
        stdin: bool,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Save the API origin used by the CLI and always-on agent.
    SetServerUrl {
        url: String,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Remove the saved API key (heartbeats fall back to the unauthenticated user_id)
    ClearKey,
}
#[derive(Debug, Clone, Deserialize)]
struct ExtraHeartbeatInput {
    entity: String,
    #[serde(default)]
    entity_type: Option<String>,
    #[serde(default)]
    project: Option<String>,
    #[serde(default)]
    category: Option<String>,
    #[serde(default)]
    write: Option<bool>,
    #[serde(default)]
    line_number: Option<u32>,
    #[serde(default)]
    cursor_position: Option<u32>,
    #[serde(default)]
    keystrokes: Option<u32>,
    #[serde(default)]
    chars_added: Option<u32>,
    #[serde(default)]
    chars_deleted: Option<u32>,
    #[serde(default)]
    active_seconds: Option<f64>,
    #[serde(default)]
    heartbeat_id: Option<String>,
    #[serde(default)]
    activity_segments: Vec<ActivitySegment>,
    #[serde(default)]
    actor_type: Option<ActorType>,
    #[serde(default)]
    actor_confidence: Option<f32>,
    #[serde(default)]
    ai_agent: Option<String>,
    #[serde(default)]
    ai_provider: Option<String>,
    #[serde(default)]
    ai_model: Option<String>,
    #[serde(default)]
    ai_source: Option<String>,
    #[serde(default)]
    ai_confidence: Option<String>,
    #[serde(default)]
    ai_event_id: Option<String>,
    #[serde(default)]
    ai_lines_added: Option<u32>,
    #[serde(default)]
    ai_lines_deleted: Option<u32>,
    #[serde(default)]
    human_lines_added: Option<u32>,
    #[serde(default)]
    human_lines_deleted: Option<u32>,
    #[serde(default)]
    unattributed_lines_added: Option<u32>,
    #[serde(default)]
    unattributed_lines_deleted: Option<u32>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct GenericAiEventInput {
    event_id: String,
    agent: String,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    occurred_at: Option<chrono::DateTime<chrono::Utc>>,
    entity: PathBuf,
    #[serde(default)]
    project_root: Option<PathBuf>,
    #[serde(default)]
    lines_added: Option<u32>,
    #[serde(default)]
    lines_deleted: Option<u32>,
    #[serde(default)]
    source: Option<AiEventSource>,
    #[serde(default)]
    confidence: Option<AiConfidence>,
    #[serde(default)]
    actor_type: Option<ActorType>,
    #[serde(default)]
    actor_confidence: Option<f32>,
    #[serde(default)]
    active_seconds: Option<f64>,
    /// Local-only transport metadata kept in the editor sidecar for diagnostics.
    #[serde(default)]
    transport: Option<String>,
    /// Local-only tool name, e.g. `tan.apply_patch`; never includes arguments/content.
    #[serde(default)]
    tool: Option<String>,
    /// Parent tool-call identity shared by every file event from one shell execution.
    #[serde(default)]
    tool_event_id: Option<String>,
    /// Metadata-only filesystem operation derived from Before/After fingerprints.
    #[serde(default)]
    change_kind: Option<String>,
    /// Old path for a one-to-one inferred rename. No file content is retained.
    #[serde(default)]
    previous_entity: Option<PathBuf>,
}

/// Flat pre-v1 input accepted only by the CLI compatibility adapter. This shape was
/// used by early hook/sidecar experiments (`time` plus `ai_*` metadata); it is converted
/// into the strict Broker Event v1 envelope before validation and durable ingestion.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct LegacyAiEventInput {
    #[serde(alias = "ai_event_id")]
    event_id: String,
    #[serde(default)]
    agent: Option<String>,
    #[serde(default, alias = "ai_agent")]
    legacy_agent: Option<String>,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default, alias = "ai_provider")]
    legacy_provider: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default, alias = "ai_model")]
    legacy_model: Option<String>,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    occurred_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    time: Option<f64>,
    #[serde(alias = "file", alias = "path")]
    entity: PathBuf,
    #[serde(default, alias = "workspace")]
    project_root: Option<PathBuf>,
    #[serde(default, alias = "ai_lines_added")]
    lines_added: Option<u32>,
    #[serde(default, alias = "ai_lines_deleted")]
    lines_deleted: Option<u32>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default, alias = "ai_source")]
    legacy_source: Option<String>,
    #[serde(default)]
    confidence: Option<String>,
    #[serde(default, alias = "ai_confidence")]
    legacy_confidence: Option<String>,
    #[serde(default)]
    actor_type: Option<ActorType>,
    #[serde(default)]
    actor_confidence: Option<f32>,
    #[serde(default)]
    active_seconds: Option<f64>,
    #[serde(default)]
    transport: Option<String>,
    #[serde(default)]
    tool: Option<String>,
    #[serde(default)]
    tool_event_id: Option<String>,
    #[serde(default)]
    change_kind: Option<String>,
    #[serde(default)]
    previous_entity: Option<PathBuf>,
    #[serde(default)]
    is_ai_generated: Option<bool>,
}

impl LegacyAiEventInput {
    fn into_generic(self) -> Result<GenericAiEventInput, Box<dyn Error>> {
        if self.is_ai_generated == Some(false) {
            return Err("legacy AI event cannot set is_ai_generated=false".into());
        }
        if self.occurred_at.is_some() && self.time.is_some() {
            return Err("legacy event must set only one of occurred_at or time".into());
        }
        let occurred_at = match (self.occurred_at, self.time) {
            (Some(value), None) => Some(value),
            (None, Some(value)) => Some(legacy_unix_time(value)?),
            (None, None) => None,
            (Some(_), Some(_)) => unreachable!("validated above"),
        };
        let source = self.source.or(self.legacy_source).map(|value| {
            match value.trim().to_ascii_lowercase().as_str() {
                "agent_hook" => AiEventSource::AgentHook,
                "ide_telemetry" => AiEventSource::IdeTelemetry,
                "mcp" => AiEventSource::Mcp,
                _ => AiEventSource::Transcript,
            }
        });
        let confidence = self.confidence.or(self.legacy_confidence).map(|value| {
            match value.trim().to_ascii_lowercase().as_str() {
                "verified" => AiConfidence::Verified,
                "correlated" => AiConfidence::Correlated,
                "unknown" => AiConfidence::Unknown,
                _ => AiConfidence::Inferred,
            }
        });
        Ok(GenericAiEventInput {
            event_id: self.event_id,
            agent: self
                .agent
                .or(self.legacy_agent)
                .unwrap_or_else(|| "legacy-ai".to_string()),
            provider: self.provider.or(self.legacy_provider),
            model: self.model.or(self.legacy_model),
            session_id: self.session_id,
            occurred_at,
            entity: self.entity,
            project_root: self.project_root,
            lines_added: self.lines_added,
            lines_deleted: self.lines_deleted,
            source,
            confidence,
            actor_type: self.actor_type,
            actor_confidence: self.actor_confidence,
            active_seconds: self.active_seconds,
            transport: self.transport,
            tool: self.tool,
            tool_event_id: self.tool_event_id,
            change_kind: self.change_kind,
            previous_entity: self.previous_entity,
        })
    }
}

fn legacy_unix_time(value: f64) -> Result<chrono::DateTime<chrono::Utc>, Box<dyn Error>> {
    if !value.is_finite() {
        return Err("legacy time must be finite".into());
    }
    let millis = if value.abs() >= 100_000_000_000.0 {
        value.round()
    } else {
        (value * 1_000.0).round()
    };
    if millis < i64::MIN as f64 || millis > i64::MAX as f64 {
        return Err("legacy time is outside the supported timestamp range".into());
    }
    chrono::DateTime::<chrono::Utc>::from_timestamp_millis(millis as i64)
        .ok_or_else(|| "legacy time is outside the supported timestamp range".into())
}

#[tokio::main]
async fn main() {
    // `main` returning `Result` would let the Rust runtime print the error itself, but
    // it does so via `Debug`, not `Display` — that's the literal cause of errors like
    // `Http(reqwest::Error { kind: Status(401, None), url: "..." })` reaching a VS Code
    // user instead of a readable sentence. `AppError`'s `Display` impl (thiserror, see
    // `wakaclock-core::error`) has an actual message; use it instead.
    if let Err(err) = run().await {
        eprintln!("Error: {err}");
        std::process::exit(1);
    }
}

/// Environment overrides layered on top of `config.toml`.
///
/// An API key from the environment (set by the VS Code extension via SecretStorage)
/// takes precedence over the persisted config.toml, without writing it back to disk —
/// that keeps the editor's own secret store as the single place the key lives when set
/// this way. Anything that re-reads the persisted config while running must re-apply
/// these, or it would silently fall back to the on-disk identity.
fn apply_env_overrides(config: &mut Config) -> Result<(), String> {
    if let Ok(env_key) = std::env::var("WAKACLOCK_API_KEY") {
        if !env_key.trim().is_empty() {
            config.api_key = Some(env_key);
        }
    }
    if let Ok(server_url) = std::env::var("WAKACLOCK_SERVER_URL") {
        if !server_url.trim().is_empty() {
            config.server_url = Config::normalize_server_url(&server_url)?;
        }
    }
    Ok(())
}

async fn run() -> Result<(), Box<dyn Error>> {
    let cli = Cli::parse();
    let mut config = Config::load();

    if let Err(error) = apply_env_overrides(&mut config) {
        if matches!(&cli.command, Commands::Verify { json: true }) {
            println!(
                "{}",
                serde_json::json!({
                    "status": "incompatible",
                    "server_url": std::env::var("WAKACLOCK_SERVER_URL").unwrap_or_default(),
                    "authenticated": false,
                    "reachable": false,
                    "cli_version": env!("CARGO_PKG_VERSION"),
                    "queue_count": queue_count(),
                    "error": error,
                })
            );
            return Ok(());
        }
        return Err(format!("WAKACLOCK_SERVER_URL: {error}").into());
    }

    let api_client = ApiClient::new(config.clone())?;

    match cli.command {
        Commands::Heartbeat {
            entity,
            entity_type,
            project,
            category,
            write,
            line_number,
            cursor_position,
            keystrokes,
            chars_added,
            chars_deleted,
            active_seconds,
            heartbeat_id,
            activity_segments,
            actor_type,
            actor_confidence,
            plugin,
            ai_agent,
            ai_provider,
            ai_model,
            ai_source,
            ai_confidence,
            ai_event_id,
            ai_lines_added,
            ai_lines_deleted,
            human_lines_added,
            human_lines_deleted,
            unattributed_lines_added,
            unattributed_lines_deleted,
            extra_heartbeats,
            json,
        } => {
            // Hook-originated AI heartbeats are already attributed. Running transcript
            // sync from inside them would create a second event for the same patch.
            let should_auto_sync_ai = ai_agent.is_none();
            let entity_type = EntityType::from_str(&entity_type)?;
            let category = Category::from_str(&category)?;
            let mut ai_activity_state = if ai_agent.is_some() {
                Some(AiAttributionState::open()?)
            } else {
                None
            };
            let parsed_activity_segments = activity_segments
                .as_deref()
                .map(serde_json::from_str::<Vec<ActivitySegment>>)
                .transpose()?;
            let active_seconds = match (ai_agent.is_some(), active_seconds) {
                (true, explicit) => {
                    let derived = ai_activity_state
                        .as_mut()
                        .expect("AI activity state is present")
                        .record_activity(
                            AI_ACTIVITY_STREAM,
                            chrono::Utc::now().timestamp_millis() as f64 / 1000.0,
                            AI_ACTIVITY_TIMEOUT_SECONDS,
                        )?;
                    Some(explicit.unwrap_or(derived))
                }
                (false, value) => value,
            };
            let primary_extra = ExtraHeartbeatInput {
                entity: entity.clone(),
                entity_type: None,
                project: None,
                category: None,
                write: Some(write),
                line_number,
                cursor_position,
                keystrokes,
                chars_added,
                chars_deleted,
                active_seconds,
                heartbeat_id,
                activity_segments: parsed_activity_segments.unwrap_or_default(),
                actor_type,
                actor_confidence,
                ai_agent,
                ai_provider,
                ai_model,
                ai_source,
                ai_confidence,
                ai_event_id,
                ai_lines_added,
                ai_lines_deleted,
                human_lines_added,
                human_lines_deleted,
                unattributed_lines_added,
                unattributed_lines_deleted,
            };
            let mut primary = build_heartbeat(
                &config,
                &entity,
                entity_type,
                project,
                category,
                write,
                Some(primary_extra),
            )?;
            ensure_activity_segment(&mut primary);
            apply_plugin_user_agent(&mut primary, plugin.as_deref());

            let mut heartbeats = vec![primary.clone()];
            if extra_heartbeats {
                let extras = read_extra_heartbeats()?;
                for mut extra in extras {
                    if extra.ai_agent.is_some() {
                        if ai_activity_state.is_none() {
                            ai_activity_state = Some(AiAttributionState::open()?);
                        }
                        let state = ai_activity_state
                            .as_mut()
                            .expect("AI activity state was initialized above");
                        let derived = state.record_activity(
                            AI_ACTIVITY_STREAM,
                            chrono::Utc::now().timestamp_millis() as f64 / 1000.0,
                            AI_ACTIVITY_TIMEOUT_SECONDS,
                        )?;
                        if extra.active_seconds.is_none() {
                            extra.active_seconds = Some(derived);
                        }
                    }
                    let resolved_entity = extra.entity.clone();
                    let resolved_entity_type = extra
                        .entity_type
                        .as_deref()
                        .map(EntityType::from_str)
                        .transpose()?
                        .unwrap_or_else(|| primary.entity_type.clone());
                    let resolved_project =
                        extra.project.clone().or_else(|| primary.project.clone());
                    let resolved_category = extra
                        .category
                        .as_deref()
                        .map(Category::from_str)
                        .transpose()?
                        .unwrap_or_else(|| primary.category.clone());
                    let mut heartbeat = build_heartbeat(
                        &config,
                        &resolved_entity,
                        resolved_entity_type,
                        resolved_project,
                        resolved_category,
                        extra.write.unwrap_or(false),
                        Some(extra),
                    )?;
                    ensure_activity_segment(&mut heartbeat);
                    apply_plugin_user_agent(&mut heartbeat, plugin.as_deref());
                    heartbeats.push(heartbeat);
                }
            }

            if should_auto_sync_ai {
                run_bounded_ai_sync(&config, &api_client).await;
            }

            // AI-compatible `wakaclock heartbeat --ai-agent ...` is retained for old
            // integrations, but it must enter the same durable broker as native hooks.
            // Keep ordinary editor heartbeats on the legacy API path and never mark the
            // AI fingerprint here: BrokerProcessor owns that write after it has claimed
            // the inbox row, otherwise it could suppress its own event before delivery.
            let (ai_heartbeats, human_heartbeats): (Vec<_>, Vec<_>) = heartbeats
                .into_iter()
                .partition(|heartbeat| heartbeat.actor_type.is_ai());
            let mut report = wakaclock_core::api_client::SendReport {
                sent: 0,
                deduped: 0,
                queued: 0,
                flushed: 0,
                error: None,
            };
            if !ai_heartbeats.is_empty() {
                let ai_events = ai_heartbeats
                    .iter()
                    .map(broker_event_from_heartbeat)
                    .collect::<Result<Vec<_>, _>>()?;
                let broker_report =
                    broker::submit_events_chunked(&config, &api_client, &ai_events).await?;
                report.sent += broker_report.accepted;
                report.deduped += broker_report.duplicate;
                if broker_report.accepted > 0 || broker_report.duplicate > 0 {
                    agent_service::record_heartbeat();
                }
            }
            if !human_heartbeats.is_empty() {
                let human_report = api_client.send_heartbeats(human_heartbeats).await?;
                report.sent += human_report.sent;
                report.deduped += human_report.deduped;
                report.queued += human_report.queued;
                report.flushed += human_report.flushed;
                report.error = human_report.error;
            }
            if json {
                println!(
                    "{}",
                    serde_json::to_string(&serde_json::json!({
                        "sent": report.sent,
                        "deduped": report.deduped,
                        "queued": report.queued,
                        "flushed": report.flushed,
                        "error": report.error,
                        "status": if report.queued > 0 { "queued" } else if report.sent > 0 { "sent" } else { "deduped" },
                    }))?
                );
            } else {
                println!("{}", identity_line(&config));
                println!("Sent: {}", report.sent);
                println!("Deduped: {}", report.deduped);
                println!("Queued: {}", report.queued);
                println!("Flushed: {}", report.flushed);
                if let Some(error) = report.error {
                    println!("Error: {error}");
                }
            }
        }
        Commands::Config { action } => match action {
            None => {
                println!("Config path: {}", Config::config_path().display());
                println!("Server URL: {}", config.server_url);
                println!("{}", identity_line(&config));
            }
            Some(ConfigAction::SetKey { key, stdin, json }) => {
                // Persist to config.toml, independent of any WAKACLOCK_API_KEY env
                // override applied above — this always writes the on-disk value.
                let key = if stdin {
                    let mut value = String::new();
                    io::stdin().read_to_string(&mut value)?;
                    value.trim().to_string()
                } else {
                    key.unwrap_or_default().trim().to_string()
                };
                if key.is_empty() {
                    return Err("API key is required (pass a positional key or --stdin)".into());
                }
                let mut persisted = Config::load();
                persisted.api_key = Some(key);
                persisted.save();
                if json {
                    println!("{}", serde_json::json!({"saved": true}));
                } else {
                    println!("API key saved to {}", Config::config_path().display());
                }
            }
            Some(ConfigAction::SetServerUrl { url, json }) => {
                let normalized = Config::normalize_server_url(&url)?;
                let mut persisted = Config::load();
                persisted.server_url = normalized.clone();
                persisted.save();
                if json {
                    println!(
                        "{}",
                        serde_json::json!({"saved": true, "server_url": normalized})
                    );
                } else {
                    println!("Server URL saved: {normalized}");
                }
            }
            Some(ConfigAction::ClearKey) => {
                let mut persisted = Config::load();
                persisted.api_key = None;
                persisted.save();
                println!("API key cleared from {}", Config::config_path().display());
            }
        },
        Commands::Status => {
            let queue = Queue::open()?;
            println!("Config path: {}", Config::config_path().display());
            println!("Server URL: {}", config.server_url);
            println!("{}", identity_line(&config));
            println!("Queued heartbeats: {}", queue.len()?);

            // The point of `status` is answering "why is nothing being recorded", and the
            // on-disk view above cannot answer it — so ask the server. `today` is the same
            // authenticated call the VS Code extension verifies a key with, and its 401 is
            // already translated into an actionable message by `reject_unauthorized`.
            match api_client.today().await {
                Ok(_) => println!("Key check: verified — the server accepted this API key"),
                Err(AppError::Auth(message)) => println!("Key check: rejected — {message}"),
                Err(error) => {
                    println!("Key check: could not reach {} — {error}", config.server_url)
                }
            }

            let flush = api_client.flush_queue().await?;
            println!("Flushed now: {}", flush.flushed);
            if let Some(reason) = flush.stopped_because {
                println!("Flush stopped: {reason}");
            }
        }
        Commands::Today { timezone, json } => {
            let (mut snapshot, server_error) =
                match api_client.today_with_timezone(timezone.as_deref()).await {
                    Ok(snapshot) => (snapshot, None),
                    Err(AppError::Auth(message)) => return Err(message.into()),
                    Err(error) => (
                        wakaclock_core::api_client::StatusBarSnapshot {
                            total_seconds: 0.0,
                            human_readable: "0s".to_string(),
                            heartbeat_count: 0,
                            confirmed_seconds: Some(0.0),
                            queued_seconds: 0.0,
                            last_heartbeat_at: None,
                            timezone: timezone.clone(),
                            buffered_seconds: 0.0,
                            agent_health: None,
                            covered_intervals: vec![],
                            last_increment_seconds: None,
                            last_increment_source: None,
                            discarded_seconds: 0.0,
                        },
                        Some(error.to_string()),
                    ),
                };
            let queue = Queue::open()?;
            let delivery_failure = wakaclock_core::api_client::ApiClient::last_delivery_failure();
            let queued_segments = queue.queued_segments_for_day(timezone.as_deref())?;
            let queued_seconds = union_activity_seconds(&queued_segments);
            let confirmed_seconds = snapshot.confirmed_seconds.unwrap_or(snapshot.total_seconds);
            snapshot.confirmed_seconds = Some(confirmed_seconds);
            snapshot.queued_seconds = queued_seconds;
            if !snapshot.covered_intervals.is_empty() {
                snapshot.covered_intervals.extend(queued_segments);
                snapshot.total_seconds = union_activity_seconds(&snapshot.covered_intervals);
            } else {
                snapshot.total_seconds = confirmed_seconds + queued_seconds;
            }
            snapshot.human_readable = format_duration(snapshot.total_seconds);
            let agent_report = agent_service::status();
            let agent_health = serde_json::json!({
                "installed": agent_report.installed,
                "running": agent_report.running,
                "last_scan_at": agent_report.last_scan_at,
                "last_heartbeat_at": agent_report.last_heartbeat_at,
                "last_error": agent_report.last_error,
                "queue_count": queue.len().unwrap_or(0),
            });
            if snapshot.agent_health.is_none() {
                snapshot.agent_health = Some(agent_health);
            }
            if json {
                println!(
                    "{}",
                    serde_json::to_string(&serde_json::json!({
                    "confirmed_seconds": confirmed_seconds,
                        "queued_seconds": queued_seconds,
                        "total_seconds": snapshot.total_seconds,
                        "human_readable": snapshot.human_readable,
                        "heartbeat_count": snapshot.heartbeat_count,
                        "last_heartbeat_at": snapshot.last_heartbeat_at,
                    "covered_intervals": snapshot.covered_intervals,
                    "last_increment_seconds": snapshot.last_increment_seconds,
                    "last_increment_source": snapshot.last_increment_source,
                    "discarded_seconds": snapshot.discarded_seconds,
                    "timezone": snapshot.timezone,
                    "agent_health": snapshot.agent_health,
                    "error": server_error,
                    // Depth, not just today's seconds: a backlog rejected yesterday is
                    // still a backlog, and `queued_seconds` scoped to today reports 0 for
                    // it — which is exactly how a day and a half of refused heartbeats
                    // stayed invisible.
                    "queued_heartbeats": queue.len().unwrap_or(0),
                    "delivery_failure": delivery_failure,
                    }))?
                );
            } else {
                if let Some(error) = server_error {
                    println!("Server error: {error}");
                }
                println!("Today: {}", snapshot.human_readable);
                println!("Total seconds: {}", snapshot.total_seconds);
                println!("Confirmed seconds: {}", confirmed_seconds);
                println!("Queued seconds: {}", queued_seconds);
                println!("Heartbeats: {}", snapshot.heartbeat_count);
                // The whole point of the lines below: an expired entitlement and a broken
                // hook look identical from the dashboard. Say which one it is.
                let queued_heartbeats = queue.len().unwrap_or(0);
                if queued_heartbeats > 0 {
                    println!(
                        "Queued heartbeats: {queued_heartbeats} (not yet accepted by the server)"
                    );
                }
                if let Some(failure) = &delivery_failure {
                    println!("Delivery: REFUSED - {}", failure.message);
                    println!(
                        "  No heartbeat accepted since {}. Queued activity stays local until one is.",
                        chrono::DateTime::from_timestamp(failure.at as i64, 0)
                            .map(|at| at.to_rfc3339())
                            .unwrap_or_else(|| "an earlier time".to_string())
                    );
                } else if queued_heartbeats > 0 {
                    println!("Delivery: ok - the queue is draining");
                }
                println!(
                    "Agent: {}",
                    if agent_report.running {
                        "running"
                    } else if agent_report.installed {
                        "installed (stopped)"
                    } else {
                        "not installed"
                    }
                );
                if !snapshot.covered_intervals.is_empty() {
                    println!(
                        "Covered intervals: {}",
                        serde_json::to_string(&snapshot.covered_intervals)?
                    );
                }
                if let Some(seconds) = snapshot.last_increment_seconds {
                    println!("Last increment seconds: {seconds}");
                }
                if let Some(source) = snapshot.last_increment_source {
                    println!("Last increment source: {source}");
                }
                println!("Discarded seconds: {}", snapshot.discarded_seconds);
                if let Some(last_heartbeat_at) = snapshot.last_heartbeat_at {
                    println!("Last heartbeat at: {}", last_heartbeat_at);
                }
            }
        }
        Commands::Verify { json } => {
            let queue_count = queue_count();
            let (status, authenticated, reachable, error) = match api_client.verify().await {
                Ok(()) => ("verified", true, true, None),
                Err(AppError::Auth(message)) => ("invalid_key", false, true, Some(message)),
                Err(AppError::Http(error)) => {
                    let status = error.status().map(|value| value.as_u16());
                    let outcome = match status {
                        Some(402) => "subscription_required",
                        Some(value) if value >= 500 => "server_error",
                        Some(401) => "invalid_key",
                        Some(_) => "server_error",
                        None => "unreachable",
                    };
                    (outcome, false, status.is_some(), Some(error.to_string()))
                }
                Err(AppError::HttpStatus { status, message }) => {
                    let outcome = match status {
                        402 => "subscription_required",
                        401 => "invalid_key",
                        value if value >= 500 => "server_error",
                        _ => "server_error",
                    };
                    (outcome, false, true, Some(message))
                }
                Err(error) => ("server_error", false, false, Some(error.to_string())),
            };
            if json {
                println!(
                    "{}",
                    serde_json::json!({
                        "status": status,
                        "server_url": config.server_url,
                        "authenticated": authenticated,
                        "reachable": reachable,
                        "cli_version": env!("CARGO_PKG_VERSION"),
                        "queue_count": queue_count,
                        "error": error,
                    })
                );
            } else {
                println!("Status: {status}");
                println!("Server URL: {}", config.server_url);
                println!("Authenticated: {authenticated}");
                println!("Reachable: {reachable}");
                println!("CLI version: {}", env!("CARGO_PKG_VERSION"));
                println!("Queue count: {queue_count}");
                if let Some(error) = error {
                    println!("Error: {error}");
                }
            }
        }
        Commands::Ai { action } => match action {
            AiAction::Status => print_ai_status()?,
            AiAction::ProcessScan { json } => print_ai_process_scan(json),
            AiAction::Watch {
                path,
                seconds,
                json,
            } => run_ai_watch(path, seconds, json)?,
            AiAction::Emit { json } => run_ai_emit(&config, &api_client, json).await?,
            AiAction::ToolBefore { json } => run_ai_tool_before(json)?,
            AiAction::ToolAfter { json } => run_ai_tool_after(&config, &api_client, json).await?,
            AiAction::Sync {
                agent,
                dry_run,
                from_start,
                transcript,
            } => {
                if transcript.is_some() && agent.is_none() {
                    return Err("--transcript requires --agent".into());
                }
                run_ai_sync(
                    &config,
                    &api_client,
                    agent.as_deref(),
                    dry_run,
                    true,
                    from_start,
                    transcript.as_deref(),
                )
                .await?
            }
        },
        Commands::Broker { action } => match action {
            BrokerAction::Run { interval_seconds } => {
                broker::run(config, interval_seconds.max(1)).await?;
            }
            BrokerAction::Install { json } => {
                broker::ensure_token()?;
                let report = agent_service::install().map_err(io::Error::other)?;
                print_broker_report(&report, json, broker_status_json()?);
            }
            BrokerAction::Uninstall { json } => {
                let report = agent_service::uninstall().map_err(io::Error::other)?;
                broker::cleanup_discovery();
                print_broker_report(&report, json, broker_status_json()?);
            }
            BrokerAction::Start { json } => {
                let report = agent_service::start().map_err(io::Error::other)?;
                print_broker_report(&report, json, broker_status_json()?);
            }
            BrokerAction::Stop { json } => {
                let report = agent_service::stop().map_err(io::Error::other)?;
                print_broker_report(&report, json, broker_status_json()?);
            }
            BrokerAction::Status { json } => {
                let report = agent_service::status();
                print_broker_report(&report, json, broker_status_json()?);
            }
            BrokerAction::Retry { event_id, all } => {
                if event_id.is_some() == all {
                    return Err("choose exactly one of --event-id or --all".into());
                }
                let changed = wakaclock_core::broker::BrokerStore::open()?
                    .retry_dead_letters(event_id.as_deref())?;
                println!("Requeued broker events: {changed}");
            }
            BrokerAction::RotateToken { json } => {
                let before = agent_service::status();
                if before.running && !before.installed {
                    return Err(
                        "cannot rotate a foreground broker token while it is running; stop the broker first"
                            .into(),
                    );
                }
                broker::rotate_token()?;
                // A running broker keeps its bearer token in memory. Stop/start is
                // intentionally explicit here so rotation takes effect immediately on
                // every supported service manager, not only on the next login.
                let service_restarted = if before.running {
                    let _ = agent_service::stop();
                    agent_service::start().map_err(io::Error::other)?.running
                } else {
                    false
                };
                if json {
                    println!(
                        "{}",
                        serde_json::json!({
                            "rotated": true,
                            "service_restarted": service_restarted,
                        })
                    );
                } else {
                    println!("Broker token rotated; service restart requested.");
                }
            }
        },
        Commands::Agent { action } => {
            let machine_readable = match &action {
                AgentAction::Run { .. } => false,
                AgentAction::Install { json }
                | AgentAction::Uninstall { json }
                | AgentAction::Start { json }
                | AgentAction::Stop { json }
                | AgentAction::Status { json } => *json,
            };
            if !machine_readable {
                eprintln!(
                    "Warning: `wakaclock agent` is deprecated; use `wakaclock broker` instead."
                );
            }
            match action {
                AgentAction::Run { interval_seconds } => {
                    broker::run(config, interval_seconds.max(1)).await?;
                }
                AgentAction::Install { json } => {
                    broker::ensure_token()?;
                    let report = agent_service::install().map_err(io::Error::other)?;
                    print_agent_report(&report, json, queue_count());
                }
                AgentAction::Uninstall { json } => {
                    let report = agent_service::uninstall().map_err(io::Error::other)?;
                    broker::cleanup_discovery();
                    print_agent_report(&report, json, queue_count());
                }
                AgentAction::Start { json } => {
                    let report = agent_service::start().map_err(io::Error::other)?;
                    print_agent_report(&report, json, queue_count());
                }
                AgentAction::Stop { json } => {
                    let report = agent_service::stop().map_err(io::Error::other)?;
                    print_agent_report(&report, json, queue_count());
                }
                AgentAction::Status { json } => {
                    let report = agent_service::status();
                    print_agent_report(&report, json, queue_count());
                }
            }
        }
        Commands::Repair { action } => match action {
            RepairAction::Day {
                date,
                timezone,
                dry_run,
                apply,
                json,
            } => {
                if dry_run && apply {
                    return Err("choose exactly one of --dry-run or --apply".into());
                }
                let report = api_client
                    .repair_day(&date, timezone.as_deref(), apply)
                    .await?;
                if json {
                    println!("{}", serde_json::to_string(&report)?);
                } else {
                    println!("Date: {}", report.date);
                    println!("Timezone: {}", report.timezone);
                    println!("Before seconds: {}", report.before_seconds);
                    println!("After seconds: {}", report.after_seconds);
                    println!("Duplicate heartbeats: {}", report.duplicate_heartbeats);
                    println!("Overlap seconds: {}", report.overlap_seconds);
                    println!("Long-gap seconds: {}", report.long_gap_seconds);
                    println!("Applied: {}", report.applied);
                    println!("Dry run: {}", report.dry_run);
                    if let Some(revision_id) = report.revision_id {
                        println!("Revision: {revision_id}");
                    }
                }
            }
        },
        Commands::Doctor { target } => match target {
            DoctorTarget::Ai { json } => print_ai_doctor_report(&config, json)?,
        },
    }

    Ok(())
}

/// The on-disk identity, when it differs from the one the agent is currently using.
///
/// Returns `None` on an unreadable or half-written config.toml: a watcher that is
/// already authenticated must keep running rather than abort on a transient read.
pub(crate) fn reloaded_agent_config(current: &Config) -> Option<Config> {
    let mut candidate = Config::try_load()?;
    apply_env_overrides(&mut candidate).ok()?;
    let changed = candidate.api_key != current.api_key
        || candidate.server_url != current.server_url
        || candidate.user_id != current.user_id;
    changed.then_some(candidate)
}

fn print_agent_report(report: &agent_service::AgentServiceReport, json: bool, queue_count: usize) {
    if json {
        println!(
            "{}",
            serde_json::json!({
                "platform": report.platform,
                "installed": report.installed,
                "running": report.running,
                "queue_count": queue_count,
                "last_log": report.message,
                "last_scan_at": report.last_scan_at,
                "last_heartbeat_at": report.last_heartbeat_at,
                "last_error": report.last_error,
            })
        );
    } else {
        println!("Platform: {}", report.platform);
        println!("Installed: {}", report.installed);
        println!("Running: {}", report.running);
        println!("Queue count: {}", queue_count);
        if let Some(message) = &report.message {
            println!("Last log: {message}");
        }
        if let Some(last_scan_at) = report.last_scan_at {
            println!("Last scan: {last_scan_at}");
        }
        if let Some(last_heartbeat_at) = report.last_heartbeat_at {
            println!("Last heartbeat: {last_heartbeat_at}");
        }
        if let Some(last_error) = &report.last_error {
            println!("Last error: {last_error}");
        }
    }
}

fn print_broker_report(
    report: &agent_service::AgentServiceReport,
    json: bool,
    broker_status: serde_json::Value,
) {
    if json {
        let mut status = broker_status.as_object().cloned().unwrap_or_default();
        status.insert(
            "platform".to_string(),
            serde_json::Value::String(report.platform.clone()),
        );
        status.insert(
            "service_installed".to_string(),
            serde_json::Value::Bool(report.installed),
        );
        status.insert(
            "service_running".to_string(),
            serde_json::Value::Bool(report.running),
        );
        println!("{}", serde_json::Value::Object(status));
    } else {
        println!("Platform: {}", report.platform);
        println!("Installed: {}", report.installed);
        println!("Running: {}", report.running);
        if let Some(running) = broker_status.get("running") {
            println!("Broker running: {}", running);
        }
        if let Some(inbox) = broker_status.get("inbox") {
            println!("Broker inbox: {inbox}");
        }
        if let Some(queue) = broker_status.get("outbound_queue_count") {
            println!("Outbound queue: {queue}");
        }
        if let Some(error) = broker_status
            .get("inbox")
            .and_then(|inbox| inbox.get("last_error_message"))
            .filter(|error| !error.is_null())
        {
            println!("Last broker error: {error}");
        }
    }
}

fn broker_status_json() -> Result<serde_json::Value, AppError> {
    broker::status_for_cli()
}

pub(crate) fn queue_count() -> usize {
    Queue::open().and_then(|queue| queue.len()).unwrap_or(0)
}

/// `wakaclock ai process-scan`: prints what `scan_ai_processes()` (wakaclock-core's
/// Phase A process observer) found right now. Presence only — this never decides that
/// a file change belongs to whichever agent is running; that correlation is planai.md
/// Phase 8's job, not yet built.
fn print_ai_process_scan(json: bool) {
    let detected = scan_ai_processes();
    if json {
        let rows: Vec<serde_json::Value> = detected
            .iter()
            .map(|process| {
                serde_json::json!({
                    "agent": process.agent,
                    "pid": process.pid,
                    "cwd": process.cwd,
                    "started_at_epoch_seconds": process.started_at_epoch_seconds,
                })
            })
            .collect();
        println!(
            "{}",
            serde_json::json!({ "detected": rows, "count": detected.len() })
        );
        return;
    }
    if detected.is_empty() {
        println!("No known AI tool process detected.");
        return;
    }
    for process in &detected {
        match &process.cwd {
            Some(cwd) => println!(
                "{} (pid {}): cwd={}",
                process.agent,
                process.pid,
                cwd.display()
            ),
            None => println!("{} (pid {}): cwd unavailable", process.agent, process.pid),
        }
    }
}

/// `wakaclock ai watch`: prints every in-scope `FILE_CHANGED` event
/// `WorkspaceWatcher` (wakaclock-core's Phase B filesystem observer) reports, until
/// `--seconds` elapses or the process is interrupted. Presence-only, same as
/// `process-scan` above — this never decides an event is AI-caused.
fn run_ai_watch(
    path: Option<PathBuf>,
    seconds: Option<u64>,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    let root = path.unwrap_or_else(|| PathBuf::from("."));
    let watcher = WorkspaceWatcher::watch(&root)?;
    let deadline = seconds.map(|secs| std::time::Instant::now() + Duration::from_secs(secs));

    if !json {
        println!("Watching {} (Ctrl-C to stop)", root.display());
    }

    loop {
        if let Some(deadline) = deadline {
            if std::time::Instant::now() >= deadline {
                return Ok(());
            }
        }
        // Poll in short slices so the `--seconds` deadline is honored promptly
        // instead of blocking for the full remaining window on one recv call.
        let Some(event) = watcher.next_event(Duration::from_millis(500)) else {
            continue;
        };
        let kind = match event.kind {
            FileChangeKind::Created => "created",
            FileChangeKind::Modified => "modified",
            FileChangeKind::Removed => "removed",
        };
        if json {
            println!(
                "{}",
                serde_json::json!({
                    "path": event.path,
                    "kind": kind,
                    "observed_at": event.observed_at.to_rfc3339(),
                })
            );
        } else {
            println!("{kind}: {}", event.path.display());
        }
    }
}

/// Which `wakaclock` binary a bare `wakaclock` invocation on `PATH` would resolve to
/// right now — the same lookup a shell hook script does when `WAKACLOCK_CLI_PATH` and
/// `~/.wakaclock/cli-path` are both unset. `None` if nothing on `PATH` is executable.
fn resolve_on_path() -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    let exe_name = if cfg!(windows) {
        "wakaclock.exe"
    } else {
        "wakaclock"
    };
    std::env::split_paths(&path_var)
        .map(|dir| dir.join(exe_name))
        .find(|candidate| candidate.is_file())
}

/// True when the binary currently running this process is not the same file a shell
/// hook would resolve to (`hook_would_resolve_to` — the `cli-path` override if set,
/// else whatever `resolve_on_path()` found). Compares canonicalized paths so a
/// symlink or a relative-vs-absolute spelling of the same file does not read as a
/// mismatch. `false` (not "unknown") when either side is unavailable — a doctor
/// report should not accuse a hook of drift it cannot actually observe.
fn cli_identity_mismatch(current_exe: Option<&Path>, hook_would_resolve_to: Option<&Path>) -> bool {
    match (current_exe, hook_would_resolve_to) {
        (Some(current), Some(resolved)) => {
            fs::canonicalize(current).ok() != fs::canonicalize(resolved).ok()
        }
        _ => false,
    }
}

#[cfg(test)]
mod ai_doctor_tests {
    use super::*;

    #[test]
    fn no_mismatch_when_both_paths_are_the_same_real_file() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-cli-doctor-test-same-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        let binary = dir.join("wakaclock");
        fs::write(&binary, b"fake").unwrap();

        assert!(!cli_identity_mismatch(Some(&binary), Some(&binary)));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn mismatch_when_the_hook_would_resolve_to_a_different_real_file() {
        // The exact scenario this check exists for: a stale binary sitting on PATH
        // (or, here, at a different path standing in for one) that differs from the
        // binary actually running right now — found for real on this machine's own
        // `~/.cargo/bin/wakaclock` (8 days stale, no `broker` subcommand at all) on
        // 2026-08-31.
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-cli-doctor-test-diff-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        let current = dir.join("current-wakaclock");
        let stale = dir.join("stale-wakaclock");
        fs::write(&current, b"current build").unwrap();
        fs::write(&stale, b"stale build").unwrap();

        assert!(cli_identity_mismatch(Some(&current), Some(&stale)));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn no_mismatch_reported_when_either_side_is_unknown() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-cli-doctor-test-unknown-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        let binary = dir.join("wakaclock");
        fs::write(&binary, b"fake").unwrap();

        assert!(!cli_identity_mismatch(None, Some(&binary)));
        assert!(!cli_identity_mismatch(Some(&binary), None));
        assert!(!cli_identity_mismatch(None, None));

        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn resolve_on_path_finds_a_real_executable_placed_first_on_a_synthetic_path() {
        let dir = std::env::temp_dir().join(format!(
            "wakaclock-cli-doctor-test-path-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ));
        fs::create_dir_all(&dir).unwrap();
        let exe_name = if cfg!(windows) {
            "wakaclock.exe"
        } else {
            "wakaclock"
        };
        let planted = dir.join(exe_name);
        fs::write(&planted, b"fake").unwrap();

        let previous_path = std::env::var_os("PATH");
        let new_path = match &previous_path {
            Some(existing) => {
                let mut paths = vec![dir.clone()];
                paths.extend(std::env::split_paths(existing));
                std::env::join_paths(paths).unwrap()
            }
            None => dir.clone().into_os_string(),
        };
        // SAFETY: this test does not run concurrently with another test that reads
        // PATH for a resolution decision — every other test in this module works
        // against explicit paths, not PATH lookup.
        unsafe {
            std::env::set_var("PATH", &new_path);
        }
        let found = resolve_on_path();
        unsafe {
            match &previous_path {
                Some(value) => std::env::set_var("PATH", value),
                None => std::env::remove_var("PATH"),
            }
        }
        let _ = fs::remove_dir_all(&dir);

        assert_eq!(found, Some(planted));
    }
}

/// planai2.md Phase 0.5: `wakaclock doctor ai`. Reuses the broker/queue/service
/// status this crate's own `wakaclock broker status` already computes
/// (`broker_status_json`) rather than re-deriving it, and adds the two checks that
/// status alone does not cover: whether the binary a bare `wakaclock` on `PATH`
/// would actually run is the same one currently running this command, and — per
/// agent — how far each transcript's own modification time has drifted ahead of
/// this agent's saved parser cursor. Both were real, confirmed findings on the
/// development machine on 2026-08-31: a `PATH` binary 8 days stale with no `broker`
/// subcommand at all, and a Codex transcript with backlog the running service's own
/// aggregate `last_scan_at` could not localize to one agent.
fn print_ai_doctor_report(config: &Config, json: bool) -> Result<(), Box<dyn Error>> {
    let current_exe = std::env::current_exe().ok();
    let on_path = resolve_on_path();
    let cli_path_override = fs::read_to_string(
        dirs::home_dir()
            .unwrap_or_default()
            .join(".wakaclock")
            .join("cli-path"),
    )
    .ok()
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty());
    // A hook with neither override set falls back to whatever `wakaclock` resolves
    // to on PATH — matching every shell script in extensions/ai-agents/*/scripts/.
    let hook_would_resolve_to = cli_path_override
        .clone()
        .map(PathBuf::from)
        .or_else(|| on_path.clone());
    let cli_identity_mismatch =
        cli_identity_mismatch(current_exe.as_deref(), hook_would_resolve_to.as_deref());

    let broker = broker_status_json().unwrap_or_else(
        |error| serde_json::json!({ "error": format!("broker status unavailable: {error}") }),
    );

    let context = ai_discovery_context()?;
    let state = AiAttributionState::open().ok();
    let mut agents = Vec::new();
    for (id, parser) in supported_ai_parsers() {
        let discovery = parser.discover(&context);
        let installed = !matches!(discovery.state, DiscoveryState::NotInstalled);
        let (transcript_path, transcript_modified_at) = match discovery.state {
            DiscoveryState::TranscriptFound { path } => {
                let modified = fs::metadata(&path)
                    .and_then(|meta| meta.modified())
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|duration| duration.as_secs());
                (Some(path), modified)
            }
            _ => (None, None),
        };
        let cursor_last_record_at = transcript_path.as_ref().and_then(|path| {
            let cursor_key = format!("{id}:{}", path.to_string_lossy());
            state
                .as_ref()
                .and_then(|state| state.load_cursor(&cursor_key).ok().flatten())
                .and_then(|cursor| cursor.last_record_time)
                .map(|time| time.timestamp().max(0) as u64)
        });
        let lag_seconds = match (transcript_modified_at, cursor_last_record_at) {
            (Some(modified), Some(scanned)) => Some(modified.saturating_sub(scanned)),
            (Some(_), None) => None, // transcript exists, never scanned — reported separately
            _ => None,
        };
        agents.push(serde_json::json!({
            "agent": id,
            "installed": installed,
            "transcript_found": transcript_path.is_some(),
            "ever_scanned": cursor_last_record_at.is_some(),
            "lag_seconds": lag_seconds,
        }));
    }

    let last_delivery_failure = dirs::home_dir()
        .map(|home| home.join(".wakaclock").join("last-delivery-failure.json"))
        .and_then(|path| fs::read_to_string(path).ok())
        .and_then(|raw| serde_json::from_str::<serde_json::Value>(&raw).ok());

    let report = serde_json::json!({
        "cli_identity": {
            "running_binary": current_exe,
            "path_resolved_binary": on_path,
            "cli_path_override": cli_path_override,
            "hook_would_use": hook_would_resolve_to,
            "mismatch": cli_identity_mismatch,
        },
        "broker": broker,
        "agents": agents,
        "outbound_queue_depth": queue_count(),
        "last_delivery_failure": last_delivery_failure,
        "configured_server_url": config.server_url,
    });

    if json {
        println!("{report}");
        return Ok(());
    }

    println!("== CLI identity ==");
    if cli_identity_mismatch {
        println!(
            "  MISMATCH: this process is running {}, but a shell hook would use {}",
            current_exe
                .as_ref()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|| "<unknown>".to_string()),
            hook_would_resolve_to
                .as_ref()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|| "<none found>".to_string())
        );
    } else {
        println!("  ok — hooks resolve to the same binary this command is running");
    }
    println!("== Broker ==");
    println!("  {broker}");
    println!("== Agents ==");
    for agent in &agents {
        println!("  {agent}");
    }
    println!("Outbound queue depth: {}", queue_count());
    match &last_delivery_failure {
        Some(failure) => println!("Last delivery failure: {failure}"),
        None => println!("Last delivery failure: none recorded"),
    }
    Ok(())
}

fn supported_ai_parsers() -> Vec<(&'static str, Box<dyn AiActivityParser>)> {
    vec![
        ("claude-code", Box::new(ClaudeCodeParser::new())),
        ("codex", Box::new(CodexParser::new())),
        ("gemini-cli", Box::new(GeminiCliParser::new())),
    ]
}

fn ai_discovery_context() -> Result<DiscoveryContext, Box<dyn Error>> {
    Ok(DiscoveryContext {
        home_dir: dirs::home_dir().ok_or("could not resolve home directory")?,
        config_override: None,
    })
}

fn print_ai_status() -> Result<(), Box<dyn Error>> {
    let context = ai_discovery_context()?;
    for (id, parser) in supported_ai_parsers() {
        let discoveries = parser.discover_sources(&context);
        let paths: Vec<PathBuf> = discoveries
            .iter()
            .filter_map(|result| match &result.state {
                DiscoveryState::TranscriptFound { path } => Some(path.clone()),
                _ => None,
            })
            .collect();
        let result = discoveries
            .into_iter()
            .find(|result| !matches!(result.state, DiscoveryState::TranscriptFound { .. }))
            .unwrap_or_else(|| DiscoveryResult {
                state: DiscoveryState::TranscriptFound {
                    path: paths.first().cloned().unwrap_or_default(),
                },
            });
        let description = match result.state {
            DiscoveryState::NotInstalled => "not installed".to_string(),
            DiscoveryState::InstalledNoTranscript => "installed, no transcript found".to_string(),
            DiscoveryState::TranscriptFound { path } => {
                if paths.len() > 1 {
                    format!(
                        "{} transcripts found (latest: {})",
                        paths.len(),
                        path.display()
                    )
                } else {
                    format!("transcript found: {}", path.display())
                }
            }
            DiscoveryState::PermissionDenied { path } => {
                format!("permission denied: {}", path.display())
            }
            DiscoveryState::UnsupportedVersion {
                path,
                found_version,
            } => {
                format!(
                    "unsupported transcript version at {} ({})",
                    path.display(),
                    found_version.as_deref().unwrap_or("unknown")
                )
            }
        };
        println!("{id}: {description}");
    }
    Ok(())
}

async fn run_ai_sync(
    config: &Config,
    api_client: &ApiClient,
    agent_filter: Option<&str>,
    dry_run: bool,
    verbose: bool,
    from_start: bool,
    transcript_override: Option<&Path>,
) -> Result<(), Box<dyn Error>> {
    let _sync_lock = if dry_run {
        None
    } else {
        match AiSyncLock::acquire()? {
            Some(lock) => Some(lock),
            None => {
                eprintln!("AI sync already running (AlreadyRunning); skipping this invocation");
                return Ok(());
            }
        }
    };
    let mut state = AiAttributionState::open()?;
    let context = ai_discovery_context()?;
    let mut first_delivery_error: Option<AppError> = None;
    // A sync can discover many transcript files, and each parser currently
    // returns the usage records for the whole file. Accumulate and deduplicate
    // them here so one pass makes one bounded upload instead of hammering the
    // API once per transcript (the previous behavior produced hundreds of
    // simultaneous 500s when the server was unhealthy).
    let mut pending_usage_records = Vec::new();
    let mut pending_usage_ids = HashSet::new();

    for (id, parser) in supported_ai_parsers() {
        if agent_filter.is_some_and(|filter| filter != id) {
            continue;
        }
        if verbose {
            println!("== {id} ==");
        }

        let transcript_paths: Vec<PathBuf> = if let Some(path) = transcript_override {
            let path = path.canonicalize()?;
            if !path.is_file() {
                return Err(format!("transcript is not a file: {}", path.display()).into());
            }
            vec![path]
        } else {
            let mut paths = Vec::new();
            for discovery in parser.discover_sources(&context) {
                match discovery.state {
                    DiscoveryState::TranscriptFound { path } => paths.push(path),
                    DiscoveryState::NotInstalled => {
                        if verbose && paths.is_empty() {
                            println!("  not installed, skipping");
                        }
                    }
                    DiscoveryState::InstalledNoTranscript => {
                        if verbose && paths.is_empty() {
                            println!("  installed but no transcript found, skipping");
                        }
                    }
                    DiscoveryState::PermissionDenied { path } => {
                        if verbose {
                            println!("  permission denied reading {}, skipping", path.display());
                        }
                    }
                    DiscoveryState::UnsupportedVersion { path, .. } => {
                        if verbose {
                            println!(
                                "  unsupported transcript version at {}, skipping",
                                path.display()
                            );
                        }
                    }
                }
            }
            paths
        };

        for transcript_path in transcript_paths {
            // Resume from the saved cursor only if it still points at the same file — a
            // new session file (Claude Code starts one per session) means byte offset 0
            // against the file discover() just found, not a stale offset into a file we
            // may no longer even be able to read.
            let source_path_string = transcript_path.to_string_lossy().into_owned();
            let cursor_key = format!("{id}:{}", source_path_string);
            let existing_cursor = state.load_cursor(&cursor_key)?;
            let file_len = fs::metadata(&transcript_path)
                .map(|meta| meta.len())
                .unwrap_or(0);
            let file_identity = transcript_identity(&transcript_path);
            let cursor = match existing_cursor {
                Some(cursor)
                    if !from_start
                        && cursor.source_path == source_path_string
                        && cursor.file_identity == file_identity
                        && cursor.byte_offset <= file_len =>
                {
                    cursor
                }
                _ => ParserCursor {
                    source_path: source_path_string.clone(),
                    file_identity: file_identity.clone(),
                    byte_offset: 0,
                    last_record_id: None,
                    last_record_time: None,
                },
            };

            // On first discovery, old transcripts are intentionally seeded at EOF. This
            // keeps a newly-installed always-on agent from uploading an entire history;
            // recent files (and explicit --from-start) still replay normally.
            let is_first_cursor = state.load_cursor(&cursor_key)?.is_none();
            let is_old = fs::metadata(&transcript_path)
                .and_then(|meta| meta.modified())
                .ok()
                .and_then(|modified| std::time::SystemTime::now().duration_since(modified).ok())
                .is_some_and(|age| age > Duration::from_secs(24 * 60 * 60));
            if !from_start && is_first_cursor && is_old {
                let mut seeded = cursor.clone();
                seeded.byte_offset = file_len;
                state.save_cursor(&cursor_key, &seeded)?;
                if verbose {
                    println!("  old transcript seeded at EOF ({file_len} bytes)");
                }
                continue;
            }

            let batch = parser.parse_since(&ParseContext::default(), Some(&cursor))?;
            // Usage is parsed independently from file-edit events: one model response may edit
            // several files, and copying its token count to each file would inflate totals.
            let usage_records = match id {
                "claude-code" => parse_claude_usage(&transcript_path)?,
                "codex" => parse_codex_usage(&transcript_path)?,
                "gemini-cli" => parse_gemini_usage(&transcript_path)?,
                _ => Vec::new(),
            };
            if verbose {
                for warning in &batch.warnings {
                    eprintln!("  warning: {}", warning.message);
                }
            }

            let candidate_ids: Vec<String> = batch
                .events
                .iter()
                .map(|event| event.event_id.clone())
                .collect();
            let undelivered = state.filter_undelivered(&candidate_ids)?;
            let new_events: Vec<&AiEditEvent> = batch
                .events
                .iter()
                .filter(|event| undelivered.contains(&event.event_id))
                .collect();
            let mut new_events = new_events;
            new_events.sort_by_key(|event| event.occurred_at);

            if verbose {
                println!(
                    "  {} event(s) parsed since last sync, {} already delivered, {} new",
                    batch.events.len(),
                    batch.events.len() - new_events.len(),
                    new_events.len()
                );
                if !usage_records.is_empty() {
                    println!(
                        "  {} usage record(s) available for idempotent upload",
                        usage_records.len()
                    );
                }
            }

            if dry_run {
                if verbose {
                    for event in &new_events {
                        println!(
                            "  [dry-run] {} {} +{}/-{} model={}",
                            event.event_id,
                            event.entity.display(),
                            event.lines_added.unwrap_or(0),
                            event.lines_deleted.unwrap_or(0),
                            event.model.as_deref().unwrap_or("unknown")
                        );
                    }
                }
                continue;
            }

            if !dry_run {
                for record in usage_records {
                    if pending_usage_ids.insert(record.usage_event_id.clone()) {
                        pending_usage_records.push(record);
                    }
                }
            }

            if !new_events.is_empty() {
                let mut broker_events = Vec::with_capacity(new_events.len());
                for event in &new_events {
                    let event_time = event.occurred_at.timestamp_millis() as f64 / 1000.0;
                    let fingerprint_entity = normalize_entity(&event.entity.to_string_lossy())?;
                    if state.has_fingerprint(
                        &fingerprint_entity,
                        event_time,
                        event.lines_added.unwrap_or(0),
                        event.lines_deleted.unwrap_or(0),
                    )? {
                        // The hook path already emitted this patch. Mark the transcript
                        // event delivered so a future cursor replay remains idempotent.
                        state.mark_delivered(&event.event_id, &cursor_key)?;
                        continue;
                    }
                    let active_seconds = state.record_activity(
                        AI_ACTIVITY_STREAM,
                        event_time,
                        AI_ACTIVITY_TIMEOUT_SECONDS,
                    )?;
                    broker_events.push(broker::event_from_ai_edit(event, active_seconds));
                }
                if !broker_events.is_empty() {
                    let report =
                        broker::submit_events_chunked(config, api_client, &broker_events).await?;
                    if verbose {
                        println!(
                            "  broker accepted {} (duplicates {})",
                            report.accepted, report.duplicate
                        );
                    }
                    if report.accepted > 0 || report.duplicate > 0 {
                        agent_service::record_heartbeat();
                    }
                }
                for event in &new_events {
                    state.mark_delivered(&event.event_id, &cursor_key)?;
                }
            }

            state.save_cursor(&cursor_key, &batch.next_cursor)?;
        }
    }

    if !dry_run && !pending_usage_records.is_empty() {
        // Usage parsers intentionally read complete transcripts so they can handle
        // provider rotations and non-JSONL envelopes. Filter the stable provider IDs
        // against local acknowledgements before uploading; otherwise the 5-second
        // watcher would resend every historical token row on every scan.
        let candidate_usage_ids: Vec<String> = pending_usage_records
            .iter()
            .map(|record| record.usage_event_id.clone())
            .collect();
        let undelivered_usage = state.filter_undelivered_usage(&candidate_usage_ids)?;
        pending_usage_records.retain(|record| undelivered_usage.contains(&record.usage_event_id));

        // The API accepts at most 2,000 usage records per request. Keep the
        // chunks deterministic and stop after the first failure so a broken
        // server is not flooded with retries during one scan.
        for chunk in pending_usage_records.chunks(2_000) {
            match api_client.send_ai_usage(chunk).await {
                Ok(report) => {
                    if verbose {
                        println!(
                            "usage: received {}, stored {}, duplicate-in-batch {}, unpriced {}, sessions {}",
                            report.received,
                            report.stored,
                            report.duplicates_in_batch,
                            report.unpriced,
                            report.sessions_touched
                        );
                    }
                    let delivered_ids: Vec<String> = chunk
                        .iter()
                        .map(|record| record.usage_event_id.clone())
                        .collect();
                    state.mark_usage_delivered(&delivered_ids)?;
                }
                Err(error) => {
                    if verbose {
                        eprintln!("warning: usage upload failed: {error}");
                    }
                    first_delivery_error = Some(error);
                    break;
                }
            }
        }
    }

    // A dry run must not mutate delivery state. In particular, pruning here used to
    // make `--dry-run` fail in read-only environments even after it printed results.
    if !dry_run {
        let pruned = state.prune_delivered_older_than(30)?;
        if verbose && pruned > 0 {
            println!("Pruned {pruned} delivered-event record(s) older than 30 days.");
        }
    }

    if let Some(error) = first_delivery_error {
        return Err(Box::new(error));
    }

    Ok(())
}

fn read_broker_event_input() -> Result<BrokerEventV1, Box<dyn Error>> {
    let mut stdin = String::new();
    io::stdin().read_to_string(&mut stdin)?;
    parse_broker_event_input(&stdin)
}

fn parse_broker_event_input(stdin: &str) -> Result<BrokerEventV1, Box<dyn Error>> {
    if stdin.trim().is_empty() {
        return Err("AI event JSON is required on stdin".into());
    }

    // Native adapters may already send the stable v1 envelope. The old flat
    // `wakaclock ai emit` shape remains accepted below and is normalized into the
    // same contract before it reaches the inbox.
    if let Ok(event) = serde_json::from_str::<BrokerEventV1>(stdin) {
        return Ok(event.normalize()?);
    }

    let input: GenericAiEventInput = match serde_json::from_str(stdin) {
        Ok(input) => input,
        Err(generic_error) => {
            // Keep the old flat producer shape working without weakening the v1
            // HTTP contract. The fallback is still deny-unknown-fields and is
            // normalized through the exact same BrokerEventV1 path below.
            let legacy =
                serde_json::from_str::<LegacyAiEventInput>(stdin).map_err(|_| generic_error)?;
            legacy.into_generic()?
        }
    };
    if input.event_id.trim().is_empty() {
        return Err("event_id must not be empty".into());
    }
    if input.agent.trim().is_empty() {
        return Err("agent must not be empty".into());
    }
    if input.entity.as_os_str().is_empty() {
        return Err("entity must not be empty".into());
    }
    if let Some(seconds) = input.active_seconds {
        if !seconds.is_finite() || seconds < 0.0 {
            return Err("active_seconds must be a finite non-negative number".into());
        }
    }
    Ok(broker_event_from_generic(&input)?.normalize()?)
}

fn read_ai_tool_input() -> Result<AiToolInput, Box<dyn Error>> {
    let mut stdin = String::new();
    io::stdin().read_to_string(&mut stdin)?;
    if stdin.trim().is_empty() {
        return Err("AI tool metadata JSON is required on stdin".into());
    }
    let input: AiToolInput = serde_json::from_str(&stdin)?;
    tool_snapshot::validate_input(&input).map_err(io::Error::other)?;
    Ok(input)
}

fn run_ai_tool_before(json: bool) -> Result<(), Box<dyn Error>> {
    let input = read_ai_tool_input()?;
    let snapshot = tool_snapshot::capture(&input)?;
    let snapshot_json = serde_json::to_string(&snapshot)?;
    let state = AiAttributionState::open()?;
    // Keep interrupted tool calls retryable across an editor/CLI restart while bounding
    // metadata-only state. Pruning never emits attribution on its own.
    let _ = state.prune_tool_sessions_older_than(24 * 60 * 60)?;
    state.save_tool_session(
        &snapshot.tool_event_id,
        &snapshot_json,
        snapshot.started_at.timestamp(),
    )?;

    if json {
        println!(
            "{}",
            serde_json::json!({
                "status": "snapshotted",
                "tool_event_id": snapshot.tool_event_id,
                "workspace_root": snapshot.workspace_root,
                "files": snapshot.files.len(),
                "git_backed": snapshot.git_backed,
            })
        );
    } else {
        println!(
            "AI tool snapshot {}: {} files ({})",
            snapshot.tool_event_id,
            snapshot.files.len(),
            if snapshot.git_backed {
                "git"
            } else {
                "filesystem"
            }
        );
    }
    Ok(())
}

fn tool_change_input(
    before: &ToolSnapshot,
    after_input: &AiToolInput,
    change: &WorkspaceChange,
    occurred_at: chrono::DateTime<chrono::Utc>,
) -> GenericAiEventInput {
    let transport = before
        .transport
        .clone()
        .or_else(|| after_input.transport.clone())
        .or_else(|| Some("shell_hook".to_string()));
    let source = if transport
        .as_deref()
        .is_some_and(|value| value.eq_ignore_ascii_case("mcp"))
    {
        AiEventSource::Mcp
    } else {
        // A Before/After filesystem diff proves that a tool changed the file, but
        // does not identify the exact writer as strongly as a native hook. Keep it
        // inferred instead of upgrading shell observation to verified AI.
        AiEventSource::IdeTelemetry
    };
    GenericAiEventInput {
        event_id: tool_snapshot::stable_change_event_id(&before.tool_event_id, change),
        agent: before.agent.clone(),
        provider: after_input
            .provider
            .clone()
            .or_else(|| before.provider.clone()),
        model: before.model.clone().or_else(|| after_input.model.clone()),
        session_id: before
            .session_id
            .clone()
            .or_else(|| after_input.session_id.clone()),
        occurred_at: Some(occurred_at),
        entity: change.entity.clone(),
        project_root: Some(before.workspace_root.clone()),
        lines_added: change.lines_added,
        lines_deleted: change.lines_deleted,
        source: Some(source),
        confidence: Some(AiConfidence::Inferred),
        actor_type: None,
        actor_confidence: None,
        active_seconds: None,
        transport,
        tool: before.tool.clone().or_else(|| after_input.tool.clone()),
        tool_event_id: Some(before.tool_event_id.clone()),
        change_kind: Some(change.kind.as_str().to_string()),
        previous_entity: change.previous_entity.clone(),
    }
}

async fn run_ai_tool_after(
    config: &Config,
    api_client: &ApiClient,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    let input = read_ai_tool_input()?;
    let state = AiAttributionState::open()?;
    let Some(snapshot_json) = state.load_tool_session(&input.tool_event_id)? else {
        return Err(format!(
            "no matching BeforeTool snapshot for {} — refusing to guess attribution",
            input.tool_event_id
        )
        .into());
    };
    let before: ToolSnapshot = serde_json::from_str(&snapshot_json)?;
    let after = tool_snapshot::capture_for_existing(&input, &before)?;
    let changes = tool_snapshot::diff(&before, &after)?;

    if changes.is_empty() {
        state.delete_tool_session(&before.tool_event_id)?;
        if json {
            println!(
                "{}",
                serde_json::json!({
                    "status": "no_changes",
                    "tool_event_id": before.tool_event_id,
                    "changed_files": 0,
                })
            );
        } else {
            println!("AI tool {} changed no files", before.tool_event_id);
        }
        return Ok(());
    }

    let occurred_at = chrono::Utc::now();
    let elapsed_seconds =
        (occurred_at - before.started_at).num_milliseconds().max(0) as f64 / 1000.0;
    let tool_active_seconds = elapsed_seconds.min(MAX_ACTIVITY_GAP_SECONDS);
    let inputs: Vec<GenericAiEventInput> = changes
        .iter()
        .map(|change| tool_change_input(&before, &input, change, occurred_at))
        .collect();
    let events: Vec<AiEditEvent> = inputs
        .iter()
        .map(generic_ai_edit_event)
        .collect::<Result<Vec<_>, _>>()?;
    let ids: Vec<String> = events.iter().map(|event| event.event_id.clone()).collect();
    let undelivered = state.filter_undelivered(&ids)?;

    let mut pending: Vec<(&AiEditEvent, &GenericAiEventInput)> = Vec::new();
    for (event, event_input) in events.iter().zip(inputs.iter()) {
        if !undelivered.contains(&event.event_id) {
            continue;
        }
        // If a stronger native hook already reported the exact same file/time/line
        // delta, suppress this inferred shell observer event. Unknown line deltas are
        // deliberately not guessed into a fingerprint match.
        if let (Some(added), Some(deleted)) = (event.lines_added, event.lines_deleted) {
            let entity = normalize_entity(&event.entity.to_string_lossy())?;
            let time = event.occurred_at.timestamp_millis() as f64 / 1000.0;
            if state.has_fingerprint(&entity, time, added, deleted)? {
                state.mark_delivered(&event.event_id, "tool_snapshot_shadowed")?;
                continue;
            }
        }
        pending.push((event, event_input));
    }
    pending.sort_by(|(left, _), (right, _)| left.entity.cmp(&right.entity));

    if pending.is_empty() {
        state.delete_tool_session(&before.tool_event_id)?;
        if json {
            println!(
                "{}",
                serde_json::json!({
                    "status": "deduped",
                    "tool_event_id": before.tool_event_id,
                    "changed_files": changes.len(),
                    "deduped": changes.len(),
                })
            );
        }
        return Ok(());
    }

    // One tool call owns one duration interval, regardless of how many files it touched.
    // Only the first deterministic file heartbeat carries that interval; the rest are
    // zero-duration attribution evidence linked by ai_change_id/tool_event_id.
    let mut broker_events = Vec::with_capacity(pending.len());
    for (index, (_, event_input)) in pending.iter().enumerate() {
        let mut event_input = (*event_input).clone();
        event_input.active_seconds = Some(if index == 0 { tool_active_seconds } else { 0.0 });
        broker_events.push(broker_event_from_generic(&event_input)?);
    }
    let report = broker::submit_events_chunked(config, api_client, &broker_events).await?;

    for (event, _) in &pending {
        state.mark_delivered(&event.event_id, "tool_snapshot")?;
    }
    state.delete_tool_session(&before.tool_event_id)?;
    if report.accepted > 0 || report.duplicate > 0 {
        agent_service::record_heartbeat();
    }

    if json {
        println!(
            "{}",
            serde_json::json!({
                "status": if report.accepted > 0 { "accepted" } else { "deduped" },
                "tool_event_id": before.tool_event_id,
                "changed_files": changes.len(),
                "emitted": pending.len(),
                "tool_active_seconds": tool_active_seconds,
                "accepted": report.accepted,
                "duplicate": report.duplicate,
                "changes": changes.iter().map(|change| serde_json::json!({
                    "kind": change.kind.as_str(),
                    "entity": change.entity,
                    "previous_entity": change.previous_entity,
                    "lines_added": change.lines_added,
                    "lines_deleted": change.lines_deleted,
                })).collect::<Vec<_>>(),
            })
        );
    } else {
        println!(
            "AI tool {}: {} changed file(s), {:.3}s activity",
            before.tool_event_id,
            changes.len(),
            tool_active_seconds
        );
    }
    Ok(())
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        (!trimmed.is_empty()).then(|| trimmed.to_string())
    })
}

fn generic_ai_edit_event(input: &GenericAiEventInput) -> Result<AiEditEvent, Box<dyn Error>> {
    let entity = PathBuf::from(normalize_entity(&input.entity.to_string_lossy())?);
    let project_root = input
        .project_root
        .as_ref()
        .map(|root| normalize_entity(&root.to_string_lossy()).map(PathBuf::from))
        .transpose()?;
    let source = input.source.clone().unwrap_or_else(|| {
        if input
            .transport
            .as_deref()
            .is_some_and(|value| value.eq_ignore_ascii_case("mcp"))
        {
            AiEventSource::Mcp
        } else {
            // A legacy flat event without a structured transport has only weak
            // provenance and must remain inferred rather than becoming Human or
            // accidentally claiming native verification.
            AiEventSource::Transcript
        }
    });
    let confidence = input.confidence.clone().unwrap_or({
        if matches!(source, AiEventSource::Mcp) {
            AiConfidence::Verified
        } else {
            AiConfidence::Inferred
        }
    });
    Ok(AiEditEvent {
        event_id: input.event_id.trim().to_string(),
        agent: normalize_agent_id(&input.agent),
        provider: normalize_optional_text(input.provider.clone()),
        model: normalize_optional_text(input.model.clone()),
        session_id: normalize_optional_text(input.session_id.clone()),
        occurred_at: input.occurred_at.unwrap_or_else(chrono::Utc::now),
        entity,
        project_root,
        lines_added: input.lines_added,
        lines_deleted: input.lines_deleted,
        input_tokens: None,
        output_tokens: None,
        // A flat legacy `ai emit` payload has no proof that it came from a native
        // hook or structured MCP transport. Keep it on the inferred path; callers
        // that have stronger evidence must send the explicit source/confidence pair.
        source,
        confidence,
    })
}

fn broker_event_from_generic(input: &GenericAiEventInput) -> Result<BrokerEventV1, Box<dyn Error>> {
    let event = generic_ai_edit_event(input)?;
    let change_kind = match input
        .change_kind
        .as_deref()
        .unwrap_or("modify")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        // Both the verb ("modify", used by the wire/API vocabulary this function's
        // own caller — `tool_change_input` — is supposed to speak) and the adjective
        // ("modified", what `WorkspaceChangeKind::as_str()` actually emits) are
        // accepted here: this struct also deserializes directly from external `ai
        // emit` stdin JSON, where either spelling is a reasonable thing for a caller
        // to send. Before this, every real shell-mutation tool call (`ai tool-before`
        // / `ai tool-after` around `sed`, a Python codemod, or any other in-place
        // edit of an existing file — the single most common case) failed at this
        // match with "unsupported broker change_kind: modified" and never reached
        // the server at all.
        "create" | "created" => wakaclock_core::broker::BrokerChangeKind::Create,
        "modify" | "modified" | "write" | "update" => {
            wakaclock_core::broker::BrokerChangeKind::Modify
        }
        "rename" | "renamed" | "move" => wakaclock_core::broker::BrokerChangeKind::Rename,
        "delete" | "deleted" | "remove" => wakaclock_core::broker::BrokerChangeKind::Delete,
        other => return Err(format!("unsupported broker change_kind: {other}").into()),
    };
    let previous_entity = input
        .previous_entity
        .as_ref()
        .map(|path| normalize_entity(&path.to_string_lossy()))
        .transpose()?
        .map(|path| path.to_string());
    Ok(BrokerEventV1 {
        schema_version: wakaclock_core::broker::BROKER_SCHEMA_VERSION,
        event_type: wakaclock_core::broker::BrokerEventType::FileChange,
        event_id: event.event_id,
        occurred_at: event.occurred_at,
        entity: event.entity.to_string_lossy().into_owned(),
        project_root: event
            .project_root
            .as_ref()
            .map(|path| path.to_string_lossy().into_owned()),
        change_kind,
        previous_entity,
        agent: event.agent,
        provider: event.provider,
        model: event.model,
        session_id: event.session_id,
        source: event.source,
        confidence: event.confidence,
        actor_type: input.actor_type,
        actor_confidence: input.actor_confidence,
        lines_added: event.lines_added,
        lines_deleted: event.lines_deleted,
        active_seconds: input.active_seconds,
        transport: input.transport.clone(),
        tool: input.tool.clone(),
        tool_event_id: input.tool_event_id.clone(),
    })
}

/// Convert the pre-Phase-2 `heartbeat --ai-agent` compatibility payload into the
/// canonical broker envelope. New integrations should use `ai emit`; keeping this
/// adapter here prevents an old hook from bypassing durable ingress and creating a
/// second attribution implementation.
fn broker_event_from_heartbeat(heartbeat: &Heartbeat) -> Result<BrokerEventV1, Box<dyn Error>> {
    let occurred_at = chrono::DateTime::<chrono::Utc>::from_timestamp_millis(
        (heartbeat.time * 1_000.0).round() as i64,
    )
    .ok_or_else(|| "heartbeat time is outside the supported timestamp range".to_string())?;
    let source = match heartbeat
        .ai_source
        .as_deref()
        .unwrap_or("transcript")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "agent_hook" => AiEventSource::AgentHook,
        "ide_telemetry" => AiEventSource::IdeTelemetry,
        "mcp" => AiEventSource::Mcp,
        _ => AiEventSource::Transcript,
    };
    let confidence = match heartbeat
        .ai_confidence
        .as_deref()
        .unwrap_or("inferred")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "verified" => AiConfidence::Verified,
        "correlated" => AiConfidence::Correlated,
        "unknown" => AiConfidence::Unknown,
        _ => AiConfidence::Inferred,
    };
    let event_id = heartbeat
        .ai_event_id
        .clone()
        .or_else(|| heartbeat.heartbeat_id.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| {
            let material = format!(
                "{}|{}|{}|{}|{}",
                heartbeat.entity,
                heartbeat.time,
                heartbeat
                    .ai_lines_added
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                heartbeat
                    .ai_lines_deleted
                    .map(|value| value.to_string())
                    .unwrap_or_default(),
                heartbeat.ai_agent.as_deref().unwrap_or("legacy-ai"),
            );
            format!(
                "legacy-heartbeat:{}",
                Uuid::new_v5(&Uuid::NAMESPACE_OID, material.as_bytes())
            )
        });
    Ok(BrokerEventV1 {
        schema_version: wakaclock_core::broker::BROKER_SCHEMA_VERSION,
        event_type: wakaclock_core::broker::BrokerEventType::FileChange,
        event_id,
        occurred_at,
        entity: heartbeat.entity.clone(),
        project_root: None,
        change_kind: wakaclock_core::broker::BrokerChangeKind::Modify,
        previous_entity: None,
        agent: heartbeat
            .ai_agent
            .clone()
            .unwrap_or_else(|| "legacy-ai".to_string()),
        provider: heartbeat.ai_provider.clone(),
        model: heartbeat.ai_model.clone(),
        session_id: None,
        source,
        confidence,
        actor_type: Some(heartbeat.actor_type),
        actor_confidence: Some(heartbeat.actor_confidence),
        lines_added: heartbeat.ai_lines_added,
        lines_deleted: heartbeat.ai_lines_deleted,
        active_seconds: heartbeat.active_seconds,
        transport: Some("cli_compat".to_string()),
        tool: None,
        tool_event_id: heartbeat.ai_change_id.clone(),
    })
}

async fn run_ai_emit(
    config: &Config,
    api_client: &ApiClient,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    let event = read_broker_event_input()?;
    let ack = broker::submit_event(config, api_client, event.clone()).await?;
    let accepted = ack.status == "accepted";
    let duplicate = ack.status == "duplicate";
    if json {
        println!(
            "{}",
            serde_json::json!({
                "status": ack.status,
                "event_id": event.event_id,
                "agent": event.agent,
                "source": event.source,
                "confidence": event.confidence,
                "actor_type": ack.actor_type,
                "actor_confidence": ack.actor_confidence,
                "accepted": accepted,
                "duplicate": duplicate,
            })
        );
    } else {
        println!("AI event {}: {}", event.event_id, ack.status);
        println!("Agent: {} ({})", event.agent, event.source.as_str());
        println!("Actor: {} ({:.2})", ack.actor_type, ack.actor_confidence);
    }
    Ok(())
}

/// Ordinary editor heartbeats opportunistically drain transcript events, so AI edits
/// are not dependent on a user remembering to run `wakaclock ai sync`. The bound keeps
/// extension heartbeat latency predictable; any timeout/error leaves the ordinary
/// heartbeat path untouched and the transcript cursor replayable on the next call.
async fn run_bounded_ai_sync(config: &Config, api_client: &ApiClient) {
    const AUTO_SYNC_BUDGET: Duration = Duration::from_secs(2);
    match tokio::time::timeout(
        AUTO_SYNC_BUDGET,
        run_ai_sync(config, api_client, None, false, false, false, None),
    )
    .await
    {
        Ok(Ok(())) => {}
        Ok(Err(error)) => eprintln!("Warning: automatic AI sync skipped: {error}"),
        Err(_) => eprintln!("Warning: automatic AI sync exceeded 2 seconds; will retry later"),
    }
}

/// Builds an AI-attributed heartbeat directly from a parsed transcript event, with no
/// editor buffer to correlate against (see `AiAction::Sync`'s doc comment). `ai_source`
/// is always `"transcript"` here — never `"agent_hook"` — because the value must
/// describe how *this* event was obtained, not how some other integration might have
/// reported the same file.
pub(crate) fn build_ai_heartbeat(
    config: &Config,
    event: &AiEditEvent,
    active_seconds: f64,
) -> Heartbeat {
    let entity_path = event.entity.to_string_lossy().into_owned();
    let mut heartbeat = Heartbeat::new(
        config.user_id,
        entity_path.clone(),
        EntityType::File,
        "wakaclock-cli/ai-sync".to_string(),
    );

    let git_info = git::discover(&entity_path);
    heartbeat.project = git_info
        .as_ref()
        .map(|info| info.project.clone())
        .or_else(|| infer_non_git_project_name(Path::new(&entity_path)))
        .or_else(|| project_name_from_root(event.project_root.as_deref()));
    heartbeat.branch = git_info.map(|info| info.branch);
    heartbeat.is_write = true;
    heartbeat.category = Category::Coding;
    heartbeat.operating_system = std::env::consts::OS.to_string();
    heartbeat.machine = hostname::get()
        .ok()
        .and_then(|value| value.into_string().ok())
        .unwrap_or_else(|| "unknown".to_string());
    heartbeat.editor = "wakaclock-ai-sync".to_string();
    heartbeat.heartbeat_id = Some(format!("ai:{}", event.event_id));
    heartbeat.time = event.occurred_at.timestamp_millis() as f64 / 1000.0;
    heartbeat.date = Heartbeat::date_from_time(heartbeat.time);

    let entity_file = Path::new(&entity_path);
    if entity_file.exists() {
        if let Ok(lines) = count_file_lines(entity_file) {
            heartbeat.lines = Some(lines);
        }
        if let Ok(Some(ast)) = detect_file(entity_file) {
            heartbeat.language = Some(ast.language.clone());
            heartbeat.ast_language = Some(ast.language);
            heartbeat.ast_confidence = Some(ast.confidence);
            heartbeat.dependencies = ast.dependencies;
        }
    }

    heartbeat.ai_agent = Some(event.agent.clone());
    heartbeat.ai_provider = event.provider.clone();
    heartbeat.ai_model = event.model.clone();
    heartbeat.ai_source = Some(event.source.as_str().to_string());
    heartbeat.ai_confidence = Some(event.confidence.as_str().to_string());
    heartbeat.ai_event_id = Some(event.event_id.clone());
    heartbeat.ai_lines_added = event.lines_added;
    heartbeat.ai_lines_deleted = event.lines_deleted;
    let attribution = resolve_attribution(AttributionInput {
        legacy_is_ai_generated: Some(true),
        ai_agent: heartbeat.ai_agent.as_deref(),
        ai_source: heartbeat.ai_source.as_deref(),
        ai_confidence: heartbeat.ai_confidence.as_deref(),
        ai_event_id: heartbeat.ai_event_id.as_deref(),
        ai_lines_added: heartbeat.ai_lines_added,
        ai_lines_deleted: heartbeat.ai_lines_deleted,
        ..Default::default()
    })
    .expect("a parsed AI event must resolve to an AI actor");
    heartbeat.actor_type = attribution.actor_type;
    heartbeat.actor_confidence = attribution.confidence;
    heartbeat.is_ai_generated = attribution.actor_type.is_ai();
    heartbeat.active_seconds = Some(active_seconds);
    if active_seconds > 0.0 {
        heartbeat.activity_segments.push(ActivitySegment {
            segment_id: format!("ai:{}:segment", event.event_id),
            start: (heartbeat.time - active_seconds).max(0.0),
            end: heartbeat.time,
            source: Some("ai".to_string()),
        });
    }

    heartbeat
}

fn count_file_lines(path: &Path) -> io::Result<u32> {
    let file = fs::File::open(path)?;
    let mut reader = BufReader::new(file);
    let mut newline_count = 0u32;

    loop {
        let buffer = reader.fill_buf()?;
        if buffer.is_empty() {
            break;
        }
        newline_count = newline_count
            .saturating_add(buffer.iter().filter(|&&byte| byte == b'\n').count() as u32);
        let consumed = buffer.len();
        reader.consume(consumed);
    }

    Ok(newline_count.saturating_add(1))
}

fn project_name_from_root(root: Option<&Path>) -> Option<String> {
    root.and_then(Path::file_name)
        .map(|name| name.to_string_lossy().trim().to_string())
        .filter(|name| !name.is_empty())
}

/// Resolve a stable project name for a non-Git workspace.
///
/// Git remains authoritative when present. For folders that are intentionally not Git
/// repositories (for example a pnpm monorepo copied from elsewhere), prefer a strong
/// workspace marker over a nested package.json. This prevents an edit inside
/// `apps/foo/node_modules/bar` or `apps/foo` from being reported as project `bar`/`foo`
/// when the real workspace root is the parent monorepo.
fn infer_non_git_project_name(entity_path: &Path) -> Option<String> {
    discover_non_git_workspace_root(entity_path)
        .as_deref()
        .and_then(|root| project_name_from_root(Some(root)))
}

fn discover_non_git_workspace_root(entity_path: &Path) -> Option<PathBuf> {
    let start = if entity_path.is_dir() {
        entity_path
    } else {
        entity_path.parent()?
    };
    let mut nearest_project_root = None;

    for ancestor in start.ancestors() {
        if has_workspace_marker(ancestor) {
            return Some(ancestor.to_path_buf());
        }
        if nearest_project_root.is_none() && has_project_marker(ancestor) {
            nearest_project_root = Some(ancestor.to_path_buf());
        }
    }

    nearest_project_root
}

fn has_workspace_marker(path: &Path) -> bool {
    if ["pnpm-workspace.yaml", "lerna.json", "nx.json", "rush.json"]
        .iter()
        .any(|marker| path.join(marker).is_file())
    {
        return true;
    }

    let package_json = path.join("package.json");
    fs::read_to_string(package_json)
        .ok()
        .and_then(|content| serde_json::from_str::<serde_json::Value>(&content).ok())
        .and_then(|value| value.get("workspaces").cloned())
        .is_some()
}

fn has_project_marker(path: &Path) -> bool {
    [
        "package.json",
        "Cargo.toml",
        "pyproject.toml",
        "go.mod",
        "composer.json",
    ]
    .iter()
    .any(|marker| path.join(marker).is_file())
}

fn build_heartbeat(
    config: &Config,
    entity: &str,
    entity_type: EntityType,
    project_override: Option<String>,
    category: Category,
    is_write: bool,
    extra: Option<ExtraHeartbeatInput>,
) -> Result<Heartbeat, Box<dyn Error>> {
    let entity_path = normalize_entity(entity)?;
    let mut heartbeat = Heartbeat::new(
        config.user_id,
        entity_path.clone(),
        entity_type,
        "wakaclock-cli/1.0".to_string(),
    );

    let git_info = git::discover(&entity_path);
    heartbeat.project = project_override
        .or_else(|| git_info.as_ref().map(|g| g.project.clone()))
        .or_else(|| infer_non_git_project_name(Path::new(&entity_path)));
    heartbeat.branch = git_info.as_ref().map(|g| g.branch.clone());
    heartbeat.is_write = is_write;
    heartbeat.category = category;
    heartbeat.operating_system = std::env::consts::OS.to_string();
    heartbeat.machine = hostname::get()
        .ok()
        .and_then(|value| value.into_string().ok())
        .unwrap_or_else(|| "unknown".to_string());
    heartbeat.editor = detect_editor();

    let entity_file = Path::new(&entity_path);
    if entity_file.exists() {
        heartbeat.lines = Some(count_file_lines(entity_file)?);
        if let Some(ast) = detect_file(entity_file)? {
            heartbeat.language = Some(ast.language.clone());
            heartbeat.ast_language = Some(ast.language);
            heartbeat.ast_confidence = Some(ast.confidence);
            heartbeat.dependencies = ast.dependencies;
        }
    }

    if let Some(extra) = extra {
        let has_ai_metadata = extra
            .ai_agent
            .as_deref()
            .is_some_and(|value| !value.trim().is_empty())
            || extra
                .ai_source
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
            || extra
                .ai_event_id
                .as_deref()
                .is_some_and(|value| !value.trim().is_empty())
            || extra.ai_lines_added.is_some_and(|value| value > 0)
            || extra.ai_lines_deleted.is_some_and(|value| value > 0)
            || extra.actor_type.is_some_and(ActorType::is_ai);
        let positive_editor_evidence = !has_ai_metadata
            && (is_write
                || extra.activity_segments.iter().any(|segment| {
                    segment.source.as_deref().is_some_and(|source| {
                        source.eq_ignore_ascii_case("human")
                            || source.eq_ignore_ascii_case("editor")
                    })
                }));
        let attribution = resolve_attribution(AttributionInput {
            explicit_actor_type: extra.actor_type,
            explicit_confidence: extra.actor_confidence,
            legacy_is_ai_generated: None,
            ai_agent: extra.ai_agent.as_deref(),
            ai_source: extra.ai_source.as_deref(),
            ai_confidence: extra.ai_confidence.as_deref(),
            ai_event_id: extra.ai_event_id.as_deref(),
            ai_lines_added: extra.ai_lines_added,
            ai_lines_deleted: extra.ai_lines_deleted,
            human_lines_added: extra.human_lines_added,
            human_lines_deleted: extra.human_lines_deleted,
            unattributed_lines_added: extra.unattributed_lines_added,
            unattributed_lines_deleted: extra.unattributed_lines_deleted,
            keystrokes: extra.keystrokes,
            chars_added: extra.chars_added,
            chars_deleted: extra.chars_deleted,
            positive_editor_evidence,
        })
        .map_err(io::Error::other)?;
        heartbeat.line_number = extra.line_number;
        heartbeat.cursor_position = extra.cursor_position;
        heartbeat.keystrokes = extra.keystrokes;
        heartbeat.chars_added = extra.chars_added;
        heartbeat.chars_deleted = extra.chars_deleted;
        heartbeat.active_seconds = extra.active_seconds;
        heartbeat.heartbeat_id = extra
            .heartbeat_id
            .or_else(|| Some(Uuid::new_v4().to_string()));
        heartbeat.activity_segments = extra.activity_segments;
        heartbeat.actor_type = attribution.actor_type;
        heartbeat.actor_confidence = attribution.confidence;
        heartbeat.is_ai_generated = attribution.actor_type.is_ai();
        heartbeat.ai_agent = extra.ai_agent;
        heartbeat.ai_provider = extra.ai_provider;
        heartbeat.ai_model = extra.ai_model;
        heartbeat.ai_source = extra.ai_source;
        heartbeat.ai_confidence = extra.ai_confidence;
        heartbeat.ai_event_id = extra.ai_event_id;
        heartbeat.ai_lines_added = extra.ai_lines_added;
        heartbeat.ai_lines_deleted = extra.ai_lines_deleted;
        heartbeat.human_lines_added = extra.human_lines_added;
        heartbeat.human_lines_deleted = extra.human_lines_deleted;
        heartbeat.unattributed_lines_added = extra.unattributed_lines_added;
        heartbeat.unattributed_lines_deleted = extra.unattributed_lines_deleted;
    }

    if heartbeat.heartbeat_id.is_none() {
        heartbeat.heartbeat_id = Some(Uuid::new_v4().to_string());
    }

    heartbeat.validate().map_err(io::Error::other)?;
    Ok(heartbeat)
}

/// Append the calling plugin to `user_agent`, WakaTime-style (`wakatime/x go/y plugin/z`).
/// The CLI identity stays first so existing parsing of the prefix is unaffected.
fn apply_plugin_user_agent(heartbeat: &mut Heartbeat, plugin: Option<&str>) {
    let Some(plugin) = plugin.map(str::trim).filter(|value| !value.is_empty()) else {
        return;
    };
    heartbeat.user_agent = format!("{} {plugin}", heartbeat.user_agent);
}

fn ensure_activity_segment(heartbeat: &mut Heartbeat) {
    if !heartbeat.activity_segments.is_empty() {
        return;
    }
    // A legacy client may still send one large `active_seconds` value. It is not split
    // into a run of apparently-valid 120-second intervals — that would let one heartbeat
    // manufacture its own idle time, which is exactly what the strict timeline removes.
    // But it is no longer discarded either: dropping it made the entire heartbeat worth
    // zero seconds, silently. Keep the trailing window this heartbeat can actually prove
    // and let the server's idle bridging recover the rest from neighbouring evidence.
    let Some(raw_seconds) = heartbeat.active_seconds.filter(|value| *value > 0.0) else {
        return;
    };
    let seconds = raw_seconds.min(MAX_ACTIVITY_GAP_SECONDS);
    if raw_seconds > MAX_ACTIVITY_GAP_SECONDS {
        eprintln!(
            "wakaclock: clamped active_seconds {raw_seconds:.0}s -> {seconds:.0}s for {}; \
             this client should send activity_segments instead",
            heartbeat.entity
        );
    }
    let base = heartbeat
        .heartbeat_id
        .as_deref()
        .or(heartbeat.ai_event_id.as_deref())
        .unwrap_or("legacy");
    let source = Some(if heartbeat.actor_type.is_ai() {
        "ai".to_string()
    } else {
        "editor".to_string()
    });
    let start = (heartbeat.time - seconds).max(0.0);
    let mut cursor = start;
    let mut index = 0usize;
    while cursor < heartbeat.time {
        let end = (cursor + MAX_ACTIVITY_GAP_SECONDS).min(heartbeat.time);
        heartbeat.activity_segments.push(ActivitySegment {
            segment_id: format!("{base}:segment:{index}"),
            start: cursor,
            end,
            source: source.clone(),
        });
        cursor = end;
        index += 1;
    }
}

fn normalize_entity(entity: &str) -> Result<String, Box<dyn Error>> {
    let path = PathBuf::from(entity);
    let full_path = if path.is_absolute() {
        path
    } else {
        std::env::current_dir()?.join(path)
    };
    Ok(full_path.to_string_lossy().to_string())
}

fn transcript_identity(path: &Path) -> Option<String> {
    let metadata = fs::metadata(path).ok()?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        Some(format!("dev:{}:ino:{}", metadata.dev(), metadata.ino()))
    }
    #[cfg(not(unix))]
    {
        let modified = metadata
            .modified()
            .ok()?
            .duration_since(std::time::UNIX_EPOCH)
            .ok()?;
        Some(format!(
            "len:{}:mtime:{}",
            metadata.len(),
            modified.as_secs()
        ));
    }
}

fn read_extra_heartbeats() -> Result<Vec<ExtraHeartbeatInput>, Box<dyn Error>> {
    let mut stdin = String::new();
    io::stdin().read_to_string(&mut stdin)?;
    if stdin.trim().is_empty() {
        return Ok(vec![]);
    }

    if stdin.trim_start().starts_with('[') {
        Ok(serde_json::from_str(&stdin)?)
    } else {
        Ok(vec![serde_json::from_str(&stdin)?])
    }
}

/// Describe which account this CLI is actually acting as.
///
/// The server derives identity from the API key alone and ignores any `user_id` the
/// client sends, so printing `config.user_id` alongside a successful request was
/// actively misleading — it's a locally-generated uuid that has nothing to do with
/// where the data landed. Report the key's presence instead, since that's what decides.
/// Reports only what is on disk, and says so. This used to claim "Authenticated: yes
/// (account resolved from API key)" on nothing more than the key being present, which is
/// exactly backwards for the case it exists to diagnose: a key the server has since
/// revoked looks identical on disk to a working one, so the line that was supposed to
/// explain "why is nothing recorded" actively argued the key was fine. `wakaclock status`
/// makes a real request and prints the server's verdict; this stays local and cheap so
/// `wakaclock config` does not have to do network I/O just to print a path.
fn identity_line(config: &Config) -> String {
    if config.api_key.is_some() {
        "API key: present in config.toml (not verified here)".to_string()
    } else {
        "API key: missing — run `printf '<KEY>\\n' | wakaclock config set-key --stdin; requests will be rejected"
            .to_string()
    }
}

fn detect_editor() -> String {
    std::env::var("WAKACLOCK_EDITOR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("TERM_PROGRAM").ok())
        .or_else(|| std::env::var("EDITOR").ok())
        .unwrap_or_else(|| "wakaclock-cli".to_string())
}

fn format_duration(seconds: f64) -> String {
    let total = seconds.max(0.0).floor() as u64;
    let hours = total / 3600;
    let minutes = (total % 3600) / 60;
    let secs = total % 60;
    if hours > 0 {
        format!("{hours}h {minutes}m {secs}s")
    } else if minutes > 0 {
        format!("{minutes}m {secs}s")
    } else {
        format!("{secs}s")
    }
}

#[cfg(test)]
mod generic_ai_ingress_tests {
    use super::*;

    #[test]
    fn non_git_monorepo_root_wins_over_nested_package_names() {
        let root = std::env::temp_dir().join(format!("wakaclock-project-root-{}", Uuid::new_v4()));
        let nested = root
            .join("apps/desktop/node_modules/ibm-plex-sans-thai/src")
            .join("styles.css");
        fs::create_dir_all(nested.parent().unwrap()).unwrap();
        fs::write(
            root.join("pnpm-workspace.yaml"),
            "packages:\n  - 'apps/*'\n",
        )
        .unwrap();
        fs::write(
            root.join("package.json"),
            r#"{"private":true,"workspaces":["apps/*"]}"#,
        )
        .unwrap();
        fs::write(
            root.join("apps/desktop/node_modules/ibm-plex-sans-thai/package.json"),
            r#"{"name":"ibm-plex-sans-thai"}"#,
        )
        .unwrap();
        fs::write(&nested, "body {}\n").unwrap();

        assert_eq!(
            infer_non_git_project_name(&nested),
            project_name_from_root(Some(&root))
        );

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn plain_non_git_package_uses_its_package_root() {
        let root = std::env::temp_dir().join(format!("wakaclock-package-root-{}", Uuid::new_v4()));
        let nested = root.join("src/lib.ts");
        fs::create_dir_all(nested.parent().unwrap()).unwrap();
        fs::write(root.join("package.json"), r#"{"name":"plain-project"}"#).unwrap();
        fs::write(&nested, "export {};\n").unwrap();

        assert_eq!(
            infer_non_git_project_name(&nested),
            project_name_from_root(Some(&root))
        );

        fs::remove_dir_all(root).unwrap();
    }

    fn sample_input() -> GenericAiEventInput {
        GenericAiEventInput {
            event_id: "chatgpt-session-1:src/lib.rs:1".to_string(),
            agent: "ChatGPT MCP".to_string(),
            provider: Some("openai".to_string()),
            model: Some("gpt".to_string()),
            session_id: Some("session-1".to_string()),
            occurred_at: Some(chrono::Utc::now()),
            entity: std::env::temp_dir()
                .join("wakaclock-ingress")
                .join("src/lib.rs"),
            project_root: Some(std::env::temp_dir().join("wakaclock-ingress")),
            lines_added: Some(12),
            lines_deleted: Some(4),
            source: None,
            confidence: None,
            actor_type: None,
            actor_confidence: None,
            active_seconds: None,
            transport: Some("mcp".to_string()),
            tool: Some("tan.apply_patch".to_string()),
            tool_event_id: None,
            change_kind: None,
            previous_entity: None,
        }
    }

    #[test]
    fn ai_emit_is_a_first_class_cli_subcommand() {
        let parsed = Cli::try_parse_from(["wakaclock", "ai", "emit", "--json"])
            .expect("ai emit should parse");
        assert!(matches!(
            parsed.command,
            Commands::Ai {
                action: AiAction::Emit { json: true }
            }
        ));
    }

    #[test]
    fn generic_ingress_defaults_to_verified_mcp_and_normalizes_agent() {
        let event = generic_ai_edit_event(&sample_input()).expect("event normalizes");
        assert_eq!(event.agent, "chatgpt-mcp");
        assert_eq!(event.provider.as_deref(), Some("openai"));
        assert_eq!(event.source, AiEventSource::Mcp);
        assert_eq!(event.confidence, AiConfidence::Verified);
        assert_eq!(event.lines_added, Some(12));
        assert_eq!(event.lines_deleted, Some(4));
        assert!(event.entity.is_absolute());
        assert!(event
            .project_root
            .as_ref()
            .is_some_and(|root| root.is_absolute()));
    }

    #[test]
    fn broker_event_from_generic_accepts_the_change_kind_the_shell_hook_engine_sends() {
        // Regression test: `tool_change_input` (the shell/MCP tool-before/tool-after
        // engine every agent's shell hook shares — see tool_snapshot.rs) builds
        // `change_kind` from `WorkspaceChangeKind::as_str()`, which returns the
        // adjective form ("created"/"modified"/"deleted"/"renamed"). This function's
        // match previously only accepted the verb form ("create"/"modify"/...), so
        // every real shell mutation of an *existing* file — sed, a Python codemod,
        // any agent's Bash tool — failed here with "unsupported broker change_kind:
        // modified" and the heartbeat never reached the server. Found by
        // scripts/ai-attribution-integration.py running the real CLI against a real
        // shell mutation, not by any in-process fixture.
        for kind in [
            "modify", "modified", "create", "created", "delete", "deleted", "rename", "renamed",
        ] {
            let mut input = sample_input();
            input.change_kind = Some(kind.to_string());
            broker_event_from_generic(&input)
                .unwrap_or_else(|error| panic!("change_kind {kind:?} should be accepted: {error}"));
        }
    }

    #[test]
    fn generic_ingress_protocol_rejects_raw_prompt_or_content_fields() {
        let json = serde_json::json!({
            "event_id": "evt-1",
            "agent": "chatgpt",
            "entity": "/tmp/file.rs",
            "lines_added": 1,
            "lines_deleted": 0,
            "prompt": "this must never become part of the ingress contract"
        });
        let parsed = serde_json::from_value::<GenericAiEventInput>(json);
        assert!(
            parsed.is_err(),
            "unknown/raw-content fields must be rejected"
        );
    }

    #[test]
    fn legacy_flat_ai_emit_is_normalized_into_broker_v1() {
        let event = parse_broker_event_input(
            r#"{
                "event_id":"legacy-1",
                "entity":"/workspace/src/lib.rs",
                "time":1700000000,
                "ai_agent":"Codex CLI",
                "ai_provider":"openai",
                "ai_source":"legacy",
                "ai_confidence":"inferred",
                "ai_lines_added":3,
                "ai_lines_deleted":1
            }"#,
        )
        .expect("legacy flat input should be accepted");
        assert_eq!(
            event.schema_version,
            wakaclock_core::broker::BROKER_SCHEMA_VERSION
        );
        assert_eq!(event.agent, "codex");
        assert_eq!(event.source, AiEventSource::Transcript);
        assert_eq!(event.confidence, AiConfidence::Inferred);
        assert_eq!(event.actor_type, Some(ActorType::AiInferred));
        assert_eq!(event.actor_confidence, Some(0.6));
        assert_eq!(event.lines_added, Some(3));
        assert_eq!(event.lines_deleted, Some(1));
        assert_eq!(event.occurred_at.timestamp(), 1_700_000_000);
    }

    #[test]
    fn generic_ingress_accepts_explicit_lower_confidence_sources() {
        let mut input = sample_input();
        input.source = Some(AiEventSource::AgentHook);
        input.confidence = Some(AiConfidence::Correlated);
        let event = generic_ai_edit_event(&input).expect("event normalizes");
        assert_eq!(event.source, AiEventSource::AgentHook);
        assert_eq!(event.confidence, AiConfidence::Correlated);
    }

    #[test]
    fn ai_sync_lock_allows_one_process_and_releases_after_drop() {
        let path = std::env::temp_dir().join(format!(
            "wakaclock-ai-sync-lock-{}-{}",
            std::process::id(),
            Uuid::new_v4()
        ));
        let first = AiSyncLock::try_acquire_at(&path)
            .expect("first lock attempt should succeed")
            .expect("first process should acquire the lock");
        assert!(
            AiSyncLock::try_acquire_at(&path)
                .expect("second lock attempt should be handled")
                .is_none(),
            "a second process must observe the active lease"
        );
        drop(first);
        assert!(AiSyncLock::try_acquire_at(&path)
            .expect("lock should be reacquirable")
            .is_some());
        let _ = fs::remove_file(path);
    }
}
