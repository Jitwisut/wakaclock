use clap::{Parser, Subcommand};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashSet},
    error::Error,
    fs,
    io::{self, BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::Command,
    str::FromStr,
    sync::OnceLock,
    time::Duration,
};
use uuid::Uuid;
mod agent_service;
mod ai_setup;
mod broker;
mod tool_snapshot;
use tool_snapshot::{AiToolInput, ToolSnapshot, WorkspaceChange};
use wakaclock_ast::detect_file;
use wakaclock_core::{
    ai::{
        normalize_agent_id, normalize_client_id, normalize_model_id, normalize_provider_id,
        parse_claude_usage, parse_codex_usage, parse_gemini_usage, AdapterFreshnessV2,
        AdapterRuntime, AiActivityParser, AiAttributionState, AiConfidence, AiDiagnosticsReportV2,
        AiEditEvent, AiEventSource, BrokerHealthV2, CertificationTuple, ClaudeCodeParser,
        CodexParser, DiagnosticMeasurement, DiagnosticsConsent, DiscoveryContext, DiscoveryResult,
        DiscoveryState, GeminiCliParser, MeasurementAvailability, ObserverConfig, ParseContext,
        ParserCursor, ParserLagSummaryV2, RuntimeHealth, TranscriptLag, VerificationStatus,
        FINGERPRINT_SCHEME_V1, PRODUCER_CONTRACT_VERSION,
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
        clipboard_tracking_version: Option<u8>,

        #[arg(long)]
        copy_actions: Option<u32>,

        #[arg(long)]
        paste_actions: Option<u32>,

        #[arg(long)]
        copied_chars: Option<u32>,

        #[arg(long)]
        copied_lines: Option<u32>,

        #[arg(long)]
        pasted_chars: Option<u32>,

        #[arg(long)]
        pasted_lines: Option<u32>,

        #[arg(long)]
        paste_same_file_actions: Option<u32>,

        #[arg(long)]
        paste_same_workspace_actions: Option<u32>,

        #[arg(long)]
        paste_external_or_unknown_actions: Option<u32>,

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
    Status {
        /// Emit a machine-readable snapshot (build identity, CLI-path resolution,
        /// key check, queue depth) instead of the text summary.
        #[arg(long, default_value_t = false)]
        json: bool,
    },
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
    /// Ping presence so a coworking room shows this user as active without a dashboard
    /// tab open. Best-effort like Verify: always exits successfully for an HTTP outcome
    /// so a periodic editor call never surfaces as a process error.
    PresenceHeartbeat {
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
    /// planai2.md Phase 1: the declarative AI-agent adapter registry — the single
    /// source of truth for which agents exist, how they install, and how far each
    /// is verified. Editor/CLI installers read this instead of hard-coding it.
    Adapter {
        #[command(subcommand)]
        action: AdapterAction,
    },
}

#[derive(Subcommand)]
enum AdapterAction {
    /// List every registered adapter manifest.
    List {
        #[arg(long, default_value_t = false)]
        json: bool,
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
    Status {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Configure one registry-supported adapter (or detected adapters with
    /// `--all`) after explicit consent. This command never infers authorship
    /// and never overwrites an agent-owned configuration file.
    Setup {
        /// Adapter id (for example `claude-code`, `codex`, `kilo-code`, or `kimi-code-cli`).
        agent: Option<String>,
        /// Configure every supported adapter selected by the registry path.
        #[arg(long, default_value_t = false)]
        all: bool,
        /// Explicitly consent to the first local setup write.
        #[arg(long, default_value_t = false)]
        yes: bool,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Remove the CLI-owned adapter registration/consent records and, when no
    /// adapters remain, the AtoAxis-owned watcher service. Agent configuration
    /// files are preserved.
    Uninstall {
        agent: Option<String>,
        #[arg(long, default_value_t = false)]
        all: bool,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Print a metadata-only integration health snapshot.  This command never
    /// attributes a heartbeat and omits transcript paths, prompts and source data.
    Doctor {
        #[arg(long, default_value_t = false)]
        json: bool,
        /// Upload the sanitized snapshot to the authenticated diagnostics endpoint.
        #[arg(long, default_value_t = false)]
        upload: bool,
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
    /// Remove a pending shell/tool snapshot after a failed or cancelled call.
    /// This never emits an edit; it only releases durable pending state.
    ToolAbort {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Record metadata-only session start/resume state for adapters that expose
    /// lifecycle hooks. This never stores prompts or model responses.
    SessionStart {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Close metadata-only session state at the adapter-reported end time.
    SessionEnd {
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
    clipboard_tracking_version: Option<u8>,
    #[serde(default)]
    copy_actions: Option<u32>,
    #[serde(default)]
    paste_actions: Option<u32>,
    #[serde(default)]
    copied_chars: Option<u32>,
    #[serde(default)]
    copied_lines: Option<u32>,
    #[serde(default)]
    pasted_chars: Option<u32>,
    #[serde(default)]
    pasted_lines: Option<u32>,
    #[serde(default)]
    paste_same_file_actions: Option<u32>,
    #[serde(default)]
    paste_same_workspace_actions: Option<u32>,
    #[serde(default)]
    paste_external_or_unknown_actions: Option<u32>,
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
    /// Metadata producer contract version. Old flat/transcript producers may
    /// omit it; native v1 adapters must send `1` so the broker can reject an
    /// unknown envelope deliberately instead of guessing.
    #[serde(default)]
    producer_version: Option<u8>,
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
    /// Editor the producer declared itself as running inside (e.g. `vscode`), read
    /// from `WAKACLOCK_EDITOR`/`TERM_PROGRAM` by the hook script at fire time. `None`
    /// means the producer had no editor context — an agent host that isn't an editor.
    #[serde(default)]
    editor: Option<String>,
}

/// Lifecycle metadata emitted by SessionStart/SessionEnd hooks. This is a local
/// state record, not a file-change broker event: it gives future session rollups a
/// bounded interval without pretending that a session boundary is an edit.
#[derive(Debug, Clone, Deserialize)]
#[serde(deny_unknown_fields)]
struct AiSessionInput {
    session_id: String,
    agent: String,
    #[serde(default)]
    provider: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    cwd: Option<PathBuf>,
    #[serde(default)]
    source: Option<AiEventSource>,
    #[serde(default)]
    occurred_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
struct AiSessionState {
    #[serde(default = "default_session_state_version")]
    version: u8,
    #[serde(default)]
    sessions: BTreeMap<String, AiSessionRecord>,
}

fn default_session_state_version() -> u8 {
    1
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AiSessionRecord {
    #[serde(default = "default_session_state_version")]
    producer_version: u8,
    session_id: String,
    agent: String,
    provider: Option<String>,
    model: Option<String>,
    cwd: Option<String>,
    source: String,
    started_at: chrono::DateTime<chrono::Utc>,
    last_event_at: chrono::DateTime<chrono::Utc>,
    ended_at: Option<chrono::DateTime<chrono::Utc>>,
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
            producer_version: None,
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
            editor: None,
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
            clipboard_tracking_version,
            copy_actions,
            paste_actions,
            copied_chars,
            copied_lines,
            pasted_chars,
            pasted_lines,
            paste_same_file_actions,
            paste_same_workspace_actions,
            paste_external_or_unknown_actions,
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
            // sync from inside them would create a second event for the same patch. A
            // background transcript read is also consent-gated: installing the watcher
            // alone must never open a production attribution path.
            let observer_enabled = load_observer_config().enabled;
            // New registry-driven setup persists per-adapter hook consent. Keep
            // the legacy state file as a compatibility fallback for installations
            // upgraded from the pre-registry CLI.
            let setup_consented = ai_setup::has_enabled_consent()
                || load_ai_setup_state()
                    .map(|state| state.adapters.values().any(|adapter| adapter.consented))
                    .unwrap_or(false);
            let should_auto_sync_ai = ai_agent.is_none() && observer_enabled && setup_consented;
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
                clipboard_tracking_version,
                copy_actions,
                paste_actions,
                copied_chars,
                copied_lines,
                pasted_chars,
                pasted_lines,
                paste_same_file_actions,
                paste_same_workspace_actions,
                paste_external_or_unknown_actions,
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
        Commands::Status { json } => {
            let queue = Queue::open()?;
            let queued = queue.len()?;
            let identity = build_identity();
            let cli_paths = cli_path_report();
            let legacy_service_alias = agent_service::manifest_uses_legacy_alias();
            let stale_service_binary = agent_service::manifest_points_at_stale_binary();

            // The point of `status` is answering "why is nothing being recorded", and the
            // on-disk view above cannot answer it — so ask the server. `today` is the same
            // authenticated call the VS Code extension verifies a key with, and its 401 is
            // already translated into an actionable message by `reject_unauthorized`.
            let (key_check, key_check_detail) = match api_client.today().await {
                Ok(_) => ("verified", None),
                Err(AppError::Auth(message)) => ("rejected", Some(message)),
                Err(error) => ("unreachable", Some(error.to_string())),
            };

            let flush = api_client.flush_queue().await?;

            if json {
                println!(
                    "{}",
                    serde_json::json!({
                        "version": identity.version,
                        "git_sha": identity.git_sha,
                        "build_time": identity.build_time,
                        "config_path": Config::config_path().display().to_string(),
                        "server_url": config.server_url,
                        "identity": identity_line(&config),
                        "queued_heartbeats": queued,
                        "key_check": key_check,
                        "key_check_detail": key_check_detail,
                        "flushed_now": flush.flushed,
                        "flush_stopped_because": flush.stopped_because,
                        "cli_path": cli_paths.to_json(),
                        "legacy_service_alias": legacy_service_alias,
                        "stale_service_binary": stale_service_binary,
                        "capabilities": ["clipboard_metrics_v1", "ai_producer_v1"],
                        "ai_producer_contract_version": PRODUCER_CONTRACT_VERSION,
                    })
                );
            } else {
                println!("Config path: {}", Config::config_path().display());
                println!("Server URL: {}", config.server_url);
                println!(
                    "CLI build: {} ({}, built {})",
                    identity.version, identity.git_sha, identity.build_time
                );
                println!("{}", identity_line(&config));
                println!("Queued heartbeats: {queued}");
                println!("Capabilities: clipboard_metrics_v1, ai_producer_v1 (contract v{PRODUCER_CONTRACT_VERSION})");
                match key_check {
                    "verified" => {
                        println!("Key check: verified — the server accepted this API key")
                    }
                    "rejected" => println!(
                        "Key check: rejected — {}",
                        key_check_detail.as_deref().unwrap_or("")
                    ),
                    _ => println!(
                        "Key check: could not reach {} — {}",
                        config.server_url,
                        key_check_detail.as_deref().unwrap_or("")
                    ),
                }
                println!("Flushed now: {}", flush.flushed);
                if let Some(reason) = &flush.stopped_because {
                    println!("Flush stopped: {reason}");
                }
                for warning in cli_paths.warnings() {
                    println!("warning: {warning}");
                }
                if legacy_service_alias {
                    println!(
                        "warning: the installed service manifest still runs the legacy `agent run` alias — run `wakaclock broker install` to migrate it to `broker run`"
                    );
                }
                if stale_service_binary {
                    println!(
                        "warning: the installed service manifest points at a different `wakaclock` binary than this one — run `wakaclock broker install` to repoint it"
                    );
                }
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
        Commands::PresenceHeartbeat { json } => {
            let (status, error) = match api_client.presence_heartbeat().await {
                Ok(()) => ("sent", None),
                Err(AppError::Auth(message)) => ("invalid_key", Some(message)),
                Err(AppError::Http(error)) => {
                    let outcome = match error.status().map(|value| value.as_u16()) {
                        Some(401) => "invalid_key",
                        Some(value) if value >= 500 => "server_error",
                        Some(_) => "server_error",
                        None => "unreachable",
                    };
                    (outcome, Some(error.to_string()))
                }
                Err(AppError::HttpStatus { status, message }) => {
                    let outcome = match status {
                        401 => "invalid_key",
                        value if value >= 500 => "server_error",
                        _ => "server_error",
                    };
                    (outcome, Some(message))
                }
                Err(error) => ("server_error", Some(error.to_string())),
            };
            if json {
                println!(
                    "{}",
                    serde_json::json!({ "status": status, "error": error })
                );
            } else if let Some(error) = error {
                println!("Presence heartbeat: {status} ({error})");
            } else {
                println!("Presence heartbeat: {status}");
            }
        }
        Commands::Ai { action } => match action {
            AiAction::Status { json } => print_ai_status(json)?,
            AiAction::Setup {
                agent,
                all,
                yes,
                json,
            } => ai_setup::run(agent.as_deref(), all, json, yes)?,
            AiAction::Uninstall { agent, all, json } => {
                ai_setup::uninstall(agent.as_deref(), all, json)?
            }
            AiAction::Doctor { json, upload } => run_ai_doctor(&api_client, json, upload).await?,
            AiAction::Emit { json } => run_ai_emit(&config, &api_client, json).await?,
            AiAction::ToolBefore { json } => run_ai_tool_before(json)?,
            AiAction::ToolAfter { json } => run_ai_tool_after(&config, &api_client, json).await?,
            AiAction::ToolAbort { json } => run_ai_tool_abort(json)?,
            AiAction::SessionStart { json } => run_ai_session(false, json)?,
            AiAction::SessionEnd { json } => run_ai_session(true, json)?,
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
                if agent_service::migrate_legacy_service_manifest().map_err(io::Error::other)? {
                    eprintln!(
                        "migrated service manifest from the legacy `agent run` alias to `broker run`"
                    );
                }
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
        Commands::Adapter { action } => match action {
            AdapterAction::List { json } => {
                let registry = wakaclock_core::ai::AdapterRegistry::builtin();
                if json {
                    println!("{}", serde_json::to_string(&registry.catalog_v1())?);
                } else {
                    for entry in &registry.catalog_v1().adapters {
                        let manifest = &entry.manifest;
                        println!(
                            "{:<14} provider={:<10} runtime={:<14} install={:<18} status={}",
                            manifest.id,
                            manifest.provider,
                            format!("{:?}", entry.runtime).to_lowercase(),
                            adapter_install_kind(manifest),
                            format!("{:?}", manifest.effective_status()).to_lowercase(),
                        );
                    }
                }
            }
        },
    }

    Ok(())
}

/// A short label for an adapter's install strategy, for the text listing.
fn adapter_install_kind(manifest: &wakaclock_core::ai::AdapterManifest) -> &'static str {
    match manifest.install {
        wakaclock_core::ai::InstallStrategy::NativePlugin { .. } => "native_plugin",
        wakaclock_core::ai::InstallStrategy::ConfigHookBlock { .. } => "config_hook_block",
        wakaclock_core::ai::InstallStrategy::TranscriptOnly => "transcript_only",
        wakaclock_core::ai::InstallStrategy::Manual { .. } => "manual",
    }
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

fn queue_count() -> usize {
    Queue::open().and_then(|queue| queue.len()).unwrap_or(0)
}

const AI_SETUP_STATE_VERSION: u8 = 1;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
struct AiSetupState {
    #[serde(default = "default_ai_setup_state_version")]
    version: u8,
    #[serde(default)]
    adapters: BTreeMap<String, AiSetupAdapterState>,
    #[serde(default)]
    observer_config_owned: bool,
}

fn default_ai_setup_state_version() -> u8 {
    AI_SETUP_STATE_VERSION
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
struct AiSetupAdapterState {
    consented: bool,
    detected: bool,
    verification: VerificationStatus,
}

fn ai_setup_state_path() -> Result<PathBuf, Box<dyn Error>> {
    let home = dirs::home_dir().ok_or("could not resolve home directory")?;
    Ok(home.join(".wakaclock").join("ai-setup.json"))
}

fn load_ai_setup_state() -> Result<AiSetupState, Box<dyn Error>> {
    let path = ai_setup_state_path()?;
    if !path.exists() {
        return Ok(AiSetupState {
            version: AI_SETUP_STATE_VERSION,
            ..Default::default()
        });
    }
    let content = fs::read_to_string(path)?;
    let state: AiSetupState = serde_json::from_str(&content)?;
    if state.version != AI_SETUP_STATE_VERSION {
        return Err(format!("unsupported AI setup state version {}", state.version).into());
    }
    Ok(state)
}

fn ai_discovery_context() -> Result<DiscoveryContext, Box<dyn Error>> {
    Ok(DiscoveryContext {
        home_dir: dirs::home_dir().ok_or("could not resolve home directory")?,
        config_override: None,
    })
}

fn print_ai_status(json: bool) -> Result<(), Box<dyn Error>> {
    // Keep the human-friendly discovery details below, but take health/runtime
    // state from the same typed collector used by `ai doctor` and the extension
    // self-test. This prevents the three surfaces from disagreeing about an
    // unavailable broker or parser probe.
    let diagnostics = collect_ai_diagnostics_v2(false)?;
    let context = ai_discovery_context()?;
    let mut reports = Vec::new();
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
        reports.push(serde_json::json!({"agent": id, "status": description}));
    }
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "diagnostics": diagnostics,
                "agents": reports,
            }))?
        );
    } else {
        println!(
            "Runtime: {:?} · broker pending={} · parser={:?}",
            diagnostics.runtime_health,
            format_diagnostic_measurement(&diagnostics.broker.pending),
            diagnostics.parser.availability
        );
        for report in reports {
            println!(
                "{}: {}",
                report["agent"].as_str().unwrap_or("unknown"),
                report["status"].as_str().unwrap_or("unknown")
            );
        }
    }
    Ok(())
}

fn observer_config_path() -> Result<PathBuf, Box<dyn Error>> {
    let home = dirs::home_dir().ok_or("could not resolve home directory")?;
    Ok(home.join(".wakaclock").join("ai-observer.toml"))
}

fn load_observer_config() -> ObserverConfig {
    let Ok(path) = observer_config_path() else {
        return ObserverConfig::default();
    };
    let Ok(contents) = fs::read_to_string(path) else {
        return ObserverConfig::default();
    };
    let lower = contents.to_ascii_lowercase();
    if lower.contains("attribution_mode") && lower.contains("infer") {
        eprintln!(
            "Warning: legacy attribution_mode=\"infer\" is compatibility-only and has been downgraded to observe_only; production inference is disabled."
        );
    }
    ObserverConfig::from_toml(&contents).unwrap_or_default()
}

/// Produce and optionally upload the metadata-only diagnostics snapshot.  Discovery
/// paths are used locally to count sources, but are never included in the JSON or
/// sent to the API.
async fn run_ai_doctor(
    api_client: &ApiClient,
    json: bool,
    upload: bool,
) -> Result<(), Box<dyn Error>> {
    let report = collect_ai_diagnostics_v2(upload)?;
    if upload {
        if let Err(error) = api_client.send_ai_diagnostics_v2(&report).await {
            eprintln!("Warning: diagnostics upload skipped: {error}");
        }
    }

    if json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        println!(
            "Observer: {} (production attribution: disabled)",
            if report.consent.observer {
                "observe_only"
            } else {
                "off"
            }
        );
        println!(
            "Runtime: {:?} · device={} · sequence={}",
            report.runtime_health, report.device_id, report.sequence
        );
        println!(
            "Offline queue: {}",
            format_diagnostic_measurement(&report.broker.pending)
        );
        for adapter in &report.adapters {
            println!(
                "{}: {:?} · verification={} · detected={} · enabled={}",
                adapter.agent,
                adapter.runtime_health,
                serde_json::to_string(&adapter.verification)?.trim_matches('"'),
                format_diagnostic_measurement(&adapter.detected),
                format_diagnostic_measurement(&adapter.enabled)
            );
        }
        if upload {
            println!("Diagnostics upload attempted (metadata-only)");
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AiDiagnosticsIdentity {
    device_id: String,
    sequence: u64,
}

static AI_DIAGNOSTICS_BOOT_ID: OnceLock<String> = OnceLock::new();

fn ai_diagnostics_state_path() -> Result<PathBuf, Box<dyn Error>> {
    Ok(dirs::home_dir()
        .ok_or("could not resolve home directory")?
        .join(".wakaclock")
        .join("ai-diagnostics-identity.json"))
}

fn safe_diagnostics_code(value: Option<&str>, fallback: &'static str) -> Option<String> {
    let Some(value) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Some(fallback.to_string());
    };
    if value.len() <= 64
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '_' | '-' | '.')
        })
    {
        Some(value.to_string())
    } else {
        Some(fallback.to_string())
    }
}

fn next_ai_diagnostics_identity() -> Result<(String, String, u64), Box<dyn Error>> {
    let path = ai_diagnostics_state_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let lock_path = path.with_extension("lock");
    let _lock = AiSyncLock::try_acquire_at(&lock_path)?;
    let previous = fs::read_to_string(&path)
        .ok()
        .and_then(|value| serde_json::from_str::<AiDiagnosticsIdentity>(&value).ok())
        .filter(|identity| {
            !identity.device_id.is_empty()
                && identity.device_id.len() <= 128
                && identity.device_id.chars().all(|character| {
                    character.is_ascii_alphanumeric() || matches!(character, '-' | '_')
                })
        });
    let device_id = previous
        .as_ref()
        .map(|identity| identity.device_id.clone())
        .unwrap_or_else(|| format!("device-{}", Uuid::new_v4().simple()));
    let sequence = previous
        .map(|identity| identity.sequence.saturating_add(1))
        .unwrap_or(1);
    let state = AiDiagnosticsIdentity {
        device_id: device_id.clone(),
        sequence,
    };
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    fs::write(&temporary, serde_json::to_vec(&state)?)?;
    fs::rename(&temporary, &path)?;
    let boot_id = AI_DIAGNOSTICS_BOOT_ID
        .get_or_init(|| format!("boot-{}", Uuid::new_v4().simple()))
        .clone();
    Ok((device_id, boot_id, sequence))
}

fn format_diagnostic_measurement<T: std::fmt::Display>(
    measurement: &DiagnosticMeasurement<T>,
) -> String {
    match (measurement.availability, &measurement.value) {
        (MeasurementAvailability::Available, Some(value)) => value.to_string(),
        (MeasurementAvailability::Disabled, _) => "disabled".to_string(),
        _ => "unavailable".to_string(),
    }
}

fn collect_ai_diagnostics_v2(upload: bool) -> Result<AiDiagnosticsReportV2, Box<dyn Error>> {
    let captured_at = chrono::Utc::now();
    let measured_at = captured_at;
    let (device_id, boot_id, sequence) = next_ai_diagnostics_identity()?;
    let observer = load_observer_config();
    let service_running_probe = agent_service::running_probe();
    let service_running = service_running_probe.as_ref().ok().copied();
    let broker_probe = wakaclock_core::broker::BrokerStore::open().and_then(|store| store.stats());
    let queue_probe = Queue::open().and_then(|queue| queue.len());
    let broker_available = broker_probe.is_ok();
    let queue_available = queue_probe.is_ok();
    let broker_stats = broker_probe.as_ref().ok();
    let queue_count = queue_probe
        .ok()
        .map(|count| count.min(u32::MAX as usize) as u32);

    let broker = BrokerHealthV2 {
        availability: if broker_available {
            MeasurementAvailability::Available
        } else {
            MeasurementAvailability::Unavailable
        },
        running: match service_running {
            Some(running) => DiagnosticMeasurement::available(running, measured_at),
            None => DiagnosticMeasurement::unavailable(),
        },
        pending: match (broker_stats, queue_count) {
            (Some(stats), Some(queue)) => DiagnosticMeasurement::available(
                stats.pending.min(u32::MAX as u64) as u32 + queue,
                measured_at,
            ),
            _ => DiagnosticMeasurement::unavailable(),
        },
        retry: broker_stats
            .map(|stats| {
                DiagnosticMeasurement::available(
                    stats.retry.min(u32::MAX as u64) as u32,
                    measured_at,
                )
            })
            .unwrap_or_else(DiagnosticMeasurement::unavailable),
        dead_letter: broker_stats
            .map(|stats| {
                DiagnosticMeasurement::available(
                    stats.dead_letter.min(u32::MAX as u64) as u32,
                    measured_at,
                )
            })
            .unwrap_or_else(DiagnosticMeasurement::unavailable),
        last_delivery_at: broker_stats
            .and_then(|stats| stats.last_delivery_at)
            .and_then(|seconds| chrono::DateTime::from_timestamp(seconds, 0)),
        last_error_code: if broker_available {
            broker_stats
                .and_then(|stats| stats.last_error_code.as_deref())
                .and_then(|code| safe_diagnostics_code(Some(code), "broker_error"))
                .filter(|code| code != "broker_error")
        } else {
            safe_diagnostics_code(None, "broker_store_unavailable")
        },
    };

    let (parser, adapters, parser_probe_failed) = match ai_discovery_context() {
        Ok(context) => {
            let state = AiAttributionState::open().ok();
            let mut transcripts_watched = 0u32;
            let mut transcripts_behind = 0u32;
            let mut max_lag_seconds = 0u32;
            let mut adapters = Vec::new();
            for (id, parser) in supported_ai_parsers() {
                let discoveries = parser.discover_sources(&context);
                let transcript_paths: Vec<PathBuf> = discoveries
                    .iter()
                    .filter_map(|result| match &result.state {
                        DiscoveryState::TranscriptFound { path } => Some(path.clone()),
                        _ => None,
                    })
                    .collect();
                let transcript_count = transcript_paths.len().min(u32::MAX as usize) as u32;
                transcripts_watched = transcripts_watched.saturating_add(transcript_count);
                let mut agent_lag_seconds = 0u32;
                let mut last_evidence_at: Option<chrono::DateTime<chrono::Utc>> = None;
                for path in &transcript_paths {
                    let cursor_key = format!("{id}:{}", path.to_string_lossy());
                    let cursor = state
                        .as_ref()
                        .and_then(|state| state.load_cursor(&cursor_key).ok().flatten());
                    let file_size = fs::metadata(path).ok().map(|meta| meta.len());
                    if let Some(lag) =
                        file_size.map(|size| TranscriptLag::measure(size, cursor.as_ref()))
                    {
                        if lag.lag_bytes > 0 {
                            transcripts_behind = transcripts_behind.saturating_add(1);
                        }
                    }
                    let modified_at = fs::metadata(path)
                        .and_then(|meta| meta.modified())
                        .ok()
                        .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                        .map(|duration| duration.as_secs());
                    let cursor_at = cursor
                        .as_ref()
                        .and_then(|cursor| cursor.last_record_time)
                        .map(|time| time.timestamp().max(0) as u64);
                    if let Some(recorded_at) =
                        cursor.as_ref().and_then(|cursor| cursor.last_record_time)
                    {
                        last_evidence_at = Some(
                            last_evidence_at
                                .map(|current| current.max(recorded_at))
                                .unwrap_or(recorded_at),
                        );
                    }
                    if let (Some(modified), Some(scanned)) = (modified_at, cursor_at) {
                        agent_lag_seconds = agent_lag_seconds
                            .max(modified.saturating_sub(scanned).min(u32::MAX as u64) as u32);
                    }
                }
                max_lag_seconds = max_lag_seconds.max(agent_lag_seconds);
                let detected = !discoveries
                    .iter()
                    .all(|result| matches!(result.state, DiscoveryState::NotInstalled));
                let diagnostic_code = if !detected {
                    Some("not_installed".to_string())
                } else if transcript_count == 0 {
                    Some("transcript_missing".to_string())
                } else if agent_lag_seconds > 300 {
                    Some("transcript_lagging".to_string())
                } else {
                    None
                };
                let runtime_health = if !observer.enabled {
                    RuntimeHealth::Disabled
                } else if !detected {
                    RuntimeHealth::Unavailable
                } else if diagnostic_code.is_some() {
                    RuntimeHealth::Degraded
                } else if service_running == Some(true) {
                    RuntimeHealth::Healthy
                } else if service_running.is_none() {
                    RuntimeHealth::Degraded
                } else {
                    RuntimeHealth::Idle
                };
                adapters.push(AdapterFreshnessV2 {
                    agent: id.to_string(),
                    availability: MeasurementAvailability::Available,
                    detected: DiagnosticMeasurement::available(detected, measured_at),
                    enabled: DiagnosticMeasurement::available(observer.enabled, measured_at),
                    runtime_health,
                    verification: VerificationStatus::Scaffold,
                    certification: certification_tuple_for_agent(id),
                    certificate_id: None,
                    certification_status: None,
                    last_evidence_at,
                    diagnostic_code,
                });
            }
            (
                ParserLagSummaryV2 {
                    availability: MeasurementAvailability::Available,
                    transcripts_watched: DiagnosticMeasurement::available(
                        transcripts_watched,
                        measured_at,
                    ),
                    transcripts_behind: DiagnosticMeasurement::available(
                        transcripts_behind,
                        measured_at,
                    ),
                    max_lag_seconds: DiagnosticMeasurement::available(max_lag_seconds, measured_at),
                },
                adapters,
                false,
            )
        }
        Err(_) => {
            let adapters = supported_ai_parsers()
                .into_iter()
                .map(|(id, _)| AdapterFreshnessV2 {
                    agent: id.to_string(),
                    availability: MeasurementAvailability::Unavailable,
                    detected: DiagnosticMeasurement::unavailable(),
                    enabled: DiagnosticMeasurement::available(observer.enabled, measured_at),
                    runtime_health: RuntimeHealth::Unavailable,
                    verification: VerificationStatus::Scaffold,
                    certification: certification_tuple_for_agent(id),
                    certificate_id: None,
                    certification_status: None,
                    last_evidence_at: None,
                    diagnostic_code: Some("discovery_unavailable".to_string()),
                })
                .collect();
            (
                ParserLagSummaryV2 {
                    availability: MeasurementAvailability::Unavailable,
                    transcripts_watched: DiagnosticMeasurement::unavailable(),
                    transcripts_behind: DiagnosticMeasurement::unavailable(),
                    max_lag_seconds: DiagnosticMeasurement::unavailable(),
                },
                adapters,
                true,
            )
        }
    };

    let runtime_health = if !observer.enabled {
        RuntimeHealth::Disabled
    } else if !broker_available || !queue_available || parser_probe_failed {
        RuntimeHealth::Degraded
    } else if service_running == Some(true) {
        RuntimeHealth::Healthy
    } else if service_running.is_none() {
        RuntimeHealth::Degraded
    } else {
        RuntimeHealth::Idle
    };
    Ok(AiDiagnosticsReportV2 {
        schema_version: wakaclock_core::ai::AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
        captured_at,
        device_id,
        boot_id,
        sequence,
        measured_at,
        runtime_health,
        consent: DiagnosticsConsent {
            adapter_tracking: observer.enabled,
            observer: observer.enabled,
            diagnostics_upload: upload,
        },
        broker,
        parser,
        adapters,
    })
}

/// Build identity of the binary running this process (planai2.md Phase 0.1). The
/// git SHA and build time are baked in by `build.rs`; `version` is the crate
/// version. `git_sha` / `build_time` are the literal string `"unknown"` when the
/// binary was built outside a git checkout.
struct BuildIdentity {
    version: &'static str,
    git_sha: &'static str,
    build_time: &'static str,
}

fn build_identity() -> BuildIdentity {
    BuildIdentity {
        version: env!("CARGO_PKG_VERSION"),
        git_sha: env!("WAKACLOCK_GIT_SHA"),
        build_time: env!("WAKACLOCK_BUILD_TIME"),
    }
}

/// Ask another `wakaclock` binary on disk which version it is, by running it with
/// `--version` (clap prints `wakaclock <version>`). `None` when the binary cannot
/// be executed or its output cannot be parsed — a missing answer is not a mismatch.
fn binary_version(path: &Path) -> Option<String> {
    let output = Command::new(path).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    text.split_whitespace().last().map(str::to_string)
}

/// Where a bare `wakaclock` would resolve for this process versus for a shell hook,
/// and whether those disagree — by path and, when both can be run, by version.
struct CliPathReport {
    current_exe: Option<PathBuf>,
    on_path: Option<PathBuf>,
    cli_path_override: Option<PathBuf>,
    hook_would_resolve_to: Option<PathBuf>,
    path_mismatch: bool,
    running_version: String,
    hook_version: Option<String>,
}

impl CliPathReport {
    fn version_mismatch(&self) -> bool {
        self.hook_version
            .as_deref()
            .is_some_and(|hook| hook != self.running_version)
    }

    fn warnings(&self) -> Vec<String> {
        let mut out = Vec::new();
        if self.path_mismatch {
            out.push(format!(
                "a shell hook would run {}, not the binary running now ({}) — reinstall so every entry point shares one build",
                self.hook_would_resolve_to
                    .as_deref()
                    .map(|p| p.display().to_string())
                    .unwrap_or_default(),
                self.current_exe
                    .as_deref()
                    .map(|p| p.display().to_string())
                    .unwrap_or_default(),
            ));
        }
        if self.version_mismatch() {
            out.push(format!(
                "CLI version drift: this build is {}, the binary on PATH/override is {} — heartbeats and hooks may disagree until both are updated",
                self.running_version,
                self.hook_version.as_deref().unwrap_or("unknown"),
            ));
        }
        out
    }

    fn to_json(&self) -> serde_json::Value {
        serde_json::json!({
            "current_exe": self.current_exe.as_deref().map(|p| p.display().to_string()),
            "on_path": self.on_path.as_deref().map(|p| p.display().to_string()),
            "cli_path_override": self.cli_path_override.as_deref().map(|p| p.display().to_string()),
            "hook_would_resolve_to": self.hook_would_resolve_to.as_deref().map(|p| p.display().to_string()),
            "path_mismatch": self.path_mismatch,
            "running_version": self.running_version,
            "hook_version": self.hook_version,
            "version_mismatch": self.version_mismatch(),
        })
    }
}

fn cli_path_report() -> CliPathReport {
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
    .filter(|value| !value.is_empty())
    .map(PathBuf::from);
    let hook_would_resolve_to = cli_path_override.clone().or_else(|| on_path.clone());
    let path_mismatch =
        cli_identity_mismatch(current_exe.as_deref(), hook_would_resolve_to.as_deref());
    let running_version = env!("CARGO_PKG_VERSION").to_string();
    // Only pay for a subprocess when the paths already disagree — if the hook would
    // run the very same file, its version is ours by definition.
    let hook_version = if path_mismatch {
        hook_would_resolve_to.as_deref().and_then(binary_version)
    } else {
        None
    };
    CliPathReport {
        current_exe,
        on_path,
        cli_path_override,
        hook_would_resolve_to,
        path_mismatch,
        running_version,
        hook_version,
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
    fn doctor_report_carries_every_required_key() {
        // planai2.md Phase 0.5: a field-presence guard so a pipeline concern can
        // never silently drop out of `doctor ai --json`.
        let report = build_ai_doctor_report(AiDoctorReportParts {
            cli_identity: serde_json::json!({}),
            legacy_service_alias: false,
            stale_service_binary: false,
            broker_installed: true,
            broker_running: false,
            latest_native_hook_event_at: None,
            broker: serde_json::json!({}),
            agents: serde_json::json!([]),
            outbound_queue_depth: 0,
            last_delivery_failure: Some(serde_json::json!({
                "at": 1.0, "message": "HTTP status 402", "category": "payment_402"
            })),
            configured_server_url: "http://localhost".to_string(),
            diagnostics_v2: serde_json::json!({
                "schema_version": wakaclock_core::ai::AI_DIAGNOSTICS_SCHEMA_VERSION_V2
            }),
        });
        for key in ai_doctor_report_keys() {
            assert!(report.get(key).is_some(), "missing doctor key: {key}");
        }
        assert_eq!(
            report["last_delivery_failure"]["category"],
            serde_json::json!("payment_402")
        );
    }

    #[test]
    fn build_identity_is_always_populated() {
        // planai2.md p0.1: `status --json` must carry a build identity. `build.rs`
        // guarantees non-empty values (a real SHA, or the literal "unknown").
        let id = build_identity();
        assert!(!id.version.is_empty());
        assert!(!id.git_sha.is_empty());
        assert!(!id.build_time.is_empty());
    }

    fn cli_path_report_fixture(path_mismatch: bool, hook_version: Option<&str>) -> CliPathReport {
        CliPathReport {
            current_exe: Some(PathBuf::from("/opt/new/wakaclock")),
            on_path: Some(PathBuf::from("/opt/old/wakaclock")),
            cli_path_override: None,
            hook_would_resolve_to: Some(PathBuf::from("/opt/old/wakaclock")),
            path_mismatch,
            running_version: "0.1.0".to_string(),
            hook_version: hook_version.map(str::to_string),
        }
    }

    #[test]
    fn cli_path_report_warns_on_path_and_version_drift_only() {
        // No drift → no warning.
        assert!(cli_path_report_fixture(false, None).warnings().is_empty());

        // Different resolved path → one warning.
        let path_only = cli_path_report_fixture(true, None);
        assert_eq!(path_only.warnings().len(), 1);
        assert!(path_only.warnings()[0].contains("shell hook would run"));

        // Different path AND a readable older version → two distinct warnings.
        let both = cli_path_report_fixture(true, Some("0.0.9"));
        assert!(both.version_mismatch());
        assert_eq!(both.warnings().len(), 2);
        assert!(both.warnings().iter().any(|w| w.contains("version drift")));

        // Same version reported back → no version warning.
        let matched = cli_path_report_fixture(true, Some("0.1.0"));
        assert!(!matched.version_mismatch());
        assert_eq!(matched.warnings().len(), 1);
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

#[cfg(test)]
mod ai_sync_isolation_tests {
    use wakaclock_core::ai::{
        AiActivityParser, AiParseError, DiscoveryContext, DiscoveryResult, DiscoveryState,
        ParseBatch, ParseContext, ParserCursor,
    };

    /// A parser whose `parse_since` either yields an empty batch or a chosen error,
    /// so the per-agent isolation contract can be exercised without a real transcript.
    struct StubParser {
        id: &'static str,
        result: fn() -> Result<ParseBatch, AiParseError>,
    }

    impl AiActivityParser for StubParser {
        fn id(&self) -> &'static str {
            self.id
        }
        fn discover(&self, _context: &DiscoveryContext) -> DiscoveryResult {
            DiscoveryResult {
                state: DiscoveryState::InstalledNoTranscript,
            }
        }
        fn parse_since(
            &self,
            _context: &ParseContext,
            _cursor: Option<&ParserCursor>,
        ) -> Result<ParseBatch, AiParseError> {
            (self.result)()
        }
    }

    fn empty_batch() -> Result<ParseBatch, AiParseError> {
        Ok(ParseBatch {
            events: Vec::new(),
            next_cursor: ParserCursor {
                source_path: "/stub".to_string(),
                file_identity: None,
                byte_offset: 0,
                last_record_id: None,
                last_record_time: None,
            },
            warnings: Vec::new(),
        })
    }

    fn malformed() -> Result<ParseBatch, AiParseError> {
        Err(AiParseError::Malformed("deliberate".to_string()))
    }

    #[test]
    fn one_agents_parse_error_does_not_stop_the_others() {
        // This mirrors the `run_ai_sync` loop shape: iterate agents, and on a parse
        // Err record the agent as skipped and continue — never propagate.
        let parsers: Vec<StubParser> = vec![
            StubParser {
                id: "codex",
                result: malformed,
            },
            StubParser {
                id: "claude-code",
                result: empty_batch,
            },
        ];

        let mut parsed = Vec::new();
        let mut skipped = Vec::new();
        for parser in &parsers {
            match parser.parse_since(&ParseContext::default(), None) {
                Ok(_) => parsed.push(parser.id()),
                Err(_) => skipped.push(parser.id()),
            }
        }

        assert_eq!(skipped, vec!["codex"]);
        assert_eq!(parsed, vec!["claude-code"]);
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
    let diagnostics_v2 = collect_ai_diagnostics_v2(false)
        .map(|report| serde_json::to_value(report).unwrap_or_else(|_| serde_json::json!({})))
        .unwrap_or_else(|_| {
            serde_json::json!({
                "schema_version": wakaclock_core::ai::AI_DIAGNOSTICS_SCHEMA_VERSION_V2,
                "runtime_health": "unavailable",
                "diagnostic_code": "collector_unavailable",
            })
        });
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
        // planai2.md Phase 0.4: an unsupported schema or a permission error must be
        // reported as a distinct diagnostic, never silently folded into "no
        // transcript" — that is the shape of a scanner that looks healthy while
        // emitting zero events forever.
        let (transcript_path, transcript_modified_at, diagnostic) = match discovery.state {
            DiscoveryState::TranscriptFound { path } => {
                let modified = fs::metadata(&path)
                    .and_then(|meta| meta.modified())
                    .ok()
                    .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                    .map(|duration| duration.as_secs());
                (Some(path), modified, None)
            }
            DiscoveryState::UnsupportedVersion {
                path,
                found_version,
            } => (
                None,
                None,
                Some(format!(
                    "unsupported transcript schema at {} (version {})",
                    path.display(),
                    found_version.as_deref().unwrap_or("unknown")
                )),
            ),
            DiscoveryState::PermissionDenied { path } => (
                None,
                None,
                Some(format!("permission denied reading {}", path.display())),
            ),
            DiscoveryState::NotInstalled | DiscoveryState::InstalledNoTranscript => {
                (None, None, None)
            }
        };
        let saved_cursor = transcript_path.as_ref().and_then(|path| {
            let cursor_key = format!("{id}:{}", path.to_string_lossy());
            state
                .as_ref()
                .and_then(|state| state.load_cursor(&cursor_key).ok().flatten())
        });
        let file_size = transcript_path
            .as_ref()
            .and_then(|path| fs::metadata(path).ok())
            .map(|meta| meta.len());
        let lag = file_size.map(|size| TranscriptLag::measure(size, saved_cursor.as_ref()));
        let cursor_last_record_at = saved_cursor
            .as_ref()
            .and_then(|cursor| cursor.last_record_time)
            .map(|time| time.timestamp().max(0) as u64);
        let lag_seconds = match (transcript_modified_at, cursor_last_record_at) {
            (Some(modified), Some(scanned)) => Some(modified.saturating_sub(scanned)),
            _ => None,
        };
        agents.push(serde_json::json!({
            "agent": id,
            "installed": installed,
            "transcript_found": transcript_path.is_some(),
            "diagnostic": diagnostic,
            "ever_scanned": lag.map(|l| l.ever_scanned).unwrap_or(false),
            "file_size": file_size,
            "cursor_offset": lag.map(|l| l.cursor_offset),
            "lag_bytes": lag.map(|l| l.lag_bytes),
            "last_event_at": saved_cursor
                .as_ref()
                .and_then(|c| c.last_record_time)
                .map(|t| t.to_rfc3339()),
            "lag_seconds": lag_seconds,
        }));
    }

    // Native adapters without a stable transcript parser still belong in the
    // doctor report. Showing executable/config state makes a Kilo/Kimi setup
    // failure distinguishable from an empty activity window.
    agents.extend(native_adapter_doctor_entries(&context.home_dir));

    // planai2.md Phase 0.5: attach a classified `category` so the reader can tell a
    // 402 (billing lapsed, capture fine) apart from a 401 (bad credential) or a
    // network failure without eyeballing the raw message.
    let last_delivery_failure =
        wakaclock_core::api_client::ApiClient::last_delivery_failure().map(|failure| {
            serde_json::json!({
                "at": failure.at,
                "message": failure.message,
                "category": failure.kind().as_str(),
            })
        });
    let latest_native_hook_event_at = latest_sidecar_event_time();

    let identity = build_identity();
    let service = agent_service::status();
    let legacy_service_alias = agent_service::manifest_uses_legacy_alias();
    let stale_service_binary = agent_service::manifest_points_at_stale_binary();
    let hook_version = if cli_identity_mismatch {
        hook_would_resolve_to.as_deref().and_then(binary_version)
    } else {
        None
    };
    let report = build_ai_doctor_report(AiDoctorReportParts {
        cli_identity: serde_json::json!({
            "running_binary": current_exe,
            "running_version": identity.version,
            "git_sha": identity.git_sha,
            "build_time": identity.build_time,
            "path_resolved_binary": on_path,
            "cli_path_override": cli_path_override,
            "hook_would_use": hook_would_resolve_to,
            "hook_version": hook_version,
            "mismatch": cli_identity_mismatch,
            "version_mismatch": hook_version
                .as_deref()
                .is_some_and(|v| v != identity.version),
        }),
        legacy_service_alias,
        stale_service_binary,
        broker_installed: service.installed,
        broker_running: service.running,
        latest_native_hook_event_at: latest_native_hook_event_at.clone(),
        broker: broker.clone(),
        agents: serde_json::Value::Array(agents.clone()),
        outbound_queue_depth: queue_count(),
        last_delivery_failure: last_delivery_failure.clone(),
        configured_server_url: config.server_url.clone(),
        diagnostics_v2,
    });
    // planai2.md Phase 0.5: the report must always carry every pipeline-stage key so
    // a reader never has to guess whether a missing field means "healthy" or "not
    // checked". `ai_doctor_report_keys()` is the single source of truth the
    // field-presence test also asserts against.
    debug_assert!(
        ai_doctor_report_keys()
            .iter()
            .all(|key| report.get(key).is_some()),
        "doctor ai report is missing a required key"
    );

    if json {
        println!("{report}");
        return Ok(());
    }

    println!("== CLI identity ==");
    println!(
        "  build: {} ({}, built {})",
        identity.version, identity.git_sha, identity.build_time
    );
    if cli_identity_mismatch {
        println!(
            "  MISMATCH: this process is running {}, but a shell hook would use {}{}",
            current_exe
                .as_ref()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|| "<unknown>".to_string()),
            hook_would_resolve_to
                .as_ref()
                .map(|p| p.display().to_string())
                .unwrap_or_else(|| "<none found>".to_string()),
            hook_version
                .as_deref()
                .map(|v| format!(" (version {v})"))
                .unwrap_or_default(),
        );
    } else {
        println!("  ok — hooks resolve to the same binary this command is running");
    }
    if legacy_service_alias {
        println!(
            "  MISMATCH: the installed service manifest runs the legacy `agent run` alias — run `wakaclock broker install` to migrate it"
        );
    }
    if stale_service_binary {
        println!(
            "  MISMATCH: the installed service manifest points at a different `wakaclock` binary — run `wakaclock broker install` to repoint it"
        );
    }
    println!("== Broker ==");
    println!(
        "  installed={} running={}",
        service.installed, service.running
    );
    println!("  {broker}");
    println!(
        "  latest native-hook event: {}",
        latest_native_hook_event_at.as_deref().unwrap_or("none")
    );
    println!("== Agents ==");
    for agent in &agents {
        println!("  {agent}");
    }
    println!("Outbound queue depth: {}", queue_count());
    match &last_delivery_failure {
        Some(failure) => println!("Last delivery failure: {failure}"),
        None => println!("Last delivery failure: none recorded"),
    }
    println!("== Typed diagnostics snapshot ==");
    println!("{}", report["diagnostics_v2"]);
    Ok(())
}

/// The top-level keys `wakaclock doctor ai --json` always emits, one per pipeline
/// concern from planai2.md §0.5. The single source of truth for the field-presence
/// invariant (`debug_assert!` in the builder, and the unit test).
fn ai_doctor_report_keys() -> &'static [&'static str] {
    &[
        "cli_identity",
        "legacy_service_alias",
        "stale_service_binary",
        "broker_installed",
        "broker_running",
        "latest_native_hook_event_at",
        "broker",
        "agents",
        "outbound_queue_depth",
        "last_delivery_failure",
        "configured_server_url",
        "diagnostics_v2",
    ]
}

struct AiDoctorReportParts {
    cli_identity: serde_json::Value,
    legacy_service_alias: bool,
    stale_service_binary: bool,
    broker_installed: bool,
    broker_running: bool,
    latest_native_hook_event_at: Option<String>,
    broker: serde_json::Value,
    agents: serde_json::Value,
    outbound_queue_depth: usize,
    last_delivery_failure: Option<serde_json::Value>,
    configured_server_url: String,
    diagnostics_v2: serde_json::Value,
}

fn build_ai_doctor_report(parts: AiDoctorReportParts) -> serde_json::Value {
    serde_json::json!({
        "cli_identity": parts.cli_identity,
        "legacy_service_alias": parts.legacy_service_alias,
        "stale_service_binary": parts.stale_service_binary,
        "broker_installed": parts.broker_installed,
        "broker_running": parts.broker_running,
        "latest_native_hook_event_at": parts.latest_native_hook_event_at,
        "broker": parts.broker,
        "agents": parts.agents,
        "outbound_queue_depth": parts.outbound_queue_depth,
        "last_delivery_failure": parts.last_delivery_failure,
        "configured_server_url": parts.configured_server_url,
        "diagnostics_v2": parts.diagnostics_v2,
    })
}

/// planai2.md Phase 0.5: the timestamp of the most recent native-hook event the
/// broker recorded in its metadata-only sidecar (`~/.wakaclock/ai-events.jsonl`,
/// written by `append_broker_sidecar`). `None` when the sidecar is missing, empty
/// or unparseable — a best-effort local file, never an error.
fn latest_sidecar_event_time() -> Option<String> {
    let path = dirs::home_dir()?.join(".wakaclock").join("ai-events.jsonl");
    let content = fs::read_to_string(path).ok()?;
    let last = content.lines().rev().find(|line| !line.trim().is_empty())?;
    let value: serde_json::Value = serde_json::from_str(last).ok()?;
    let seconds = value.get("time").and_then(serde_json::Value::as_f64)?;
    chrono::DateTime::from_timestamp(seconds as i64, 0).map(|dt| dt.to_rfc3339())
}

fn supported_ai_parsers() -> Vec<(&'static str, Box<dyn AiActivityParser>)> {
    // The factory itself is intentionally small and typed, but the registry
    // owns which runtime is exposed. A scaffold/manual adapter therefore cannot
    // accidentally become a working parser merely because a name was added to a
    // client-side list.
    let registry = wakaclock_core::ai::AdapterRegistry::builtin();
    registry
        .catalog_v1()
        .adapters
        .into_iter()
        .filter_map(|entry| {
            let id = entry.manifest.id.as_str();
            let parser: Box<dyn AiActivityParser> = match entry.runtime {
                AdapterRuntime::ClaudeCode => Box::new(ClaudeCodeParser::new()),
                AdapterRuntime::Codex => Box::new(CodexParser::new()),
                AdapterRuntime::GeminiCli => Box::new(GeminiCliParser::new()),
                _ => return None,
            };
            // Builtin ids are static; keep the existing parser API stable while
            // still deriving the inclusion decision from the catalog.
            let static_id = match id {
                "claude-code" => "claude-code",
                "codex" => "codex",
                "gemini-cli" => "gemini-cli",
                _ => return None,
            };
            Some((static_id, parser))
        })
        .collect()
}

fn certification_tuple_for_agent(agent_id: &str) -> Option<CertificationTuple> {
    let registry = wakaclock_core::ai::AdapterRegistry::builtin();
    let entry = registry
        .catalog_v1()
        .adapters
        .into_iter()
        .find(|entry| entry.manifest.id == agent_id)?;
    let provider_id = normalize_provider_id(&entry.manifest.provider).ok()?;
    let payload_schema_versions = if entry.manifest.payload_schema_versions.is_empty() {
        vec!["diagnostic-v2".to_string()]
    } else {
        entry.manifest.payload_schema_versions.clone()
    };
    // Do not infer a CLI/Desktop runtime from the fact that a transcript exists.
    // The current machine's Codex sessions are Desktop/subagent records, while
    // the last approved evidence was a different CLI version. Until F5-02/F5-04
    // captures an origin-specific tuple, send an explicit unclassified mode so
    // the server returns a mismatch/scaffold decision instead of borrowing CLI
    // certification.
    let (tool_version, runtime, edit_modes) = if agent_id == "codex" {
        (
            detected_codex_version(),
            None,
            vec!["unclassified".to_string()],
        )
    } else {
        (
            None,
            Some("cli".to_string()),
            vec!["native_single_file".to_string()],
        )
    };
    Some(CertificationTuple {
        adapter_id: agent_id.to_string(),
        client_id: normalize_client_id(agent_id).ok()?,
        provider_id,
        model_id: None,
        tool_version,
        producer_version: Some(env!("CARGO_PKG_VERSION").to_string()),
        runtime,
        os: Some(std::env::consts::OS.to_string()),
        arch: Some(std::env::consts::ARCH.to_string()),
        edit_modes,
        payload_schema_versions,
        contract_version: format!("producer-v{PRODUCER_CONTRACT_VERSION}"),
        fingerprint_version: FINGERPRINT_SCHEME_V1.to_string(),
        corpus_version: None,
    })
}

/// Return only the bounded version token from the installed Codex executable.
/// This is observation metadata for an exact server-side tuple; it is never a
/// certification claim and is intentionally `None` when the executable is absent.
fn detected_codex_version() -> Option<String> {
    let executable = resolve_named_command(&["codex".to_string()])?;
    let output = Command::new(executable)
        .arg("--version")
        .stdin(std::process::Stdio::null())
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    String::from_utf8_lossy(&output.stdout)
        .split_whitespace()
        .last()
        .map(str::to_string)
}

fn native_adapter_doctor_entries(home_dir: &Path) -> Vec<serde_json::Value> {
    let registry = wakaclock_core::ai::AdapterRegistry::builtin();
    registry
        .catalog_v1()
        .adapters
        .into_iter()
        .filter(|entry| {
            matches!(
                entry.runtime,
                AdapterRuntime::KiloCode | AdapterRuntime::KimiCodeCli
            )
        })
        .filter_map(|entry| {
            let id = entry.manifest.id.as_str();
            let manifest = &entry.manifest;
            let executable = resolve_named_command(&manifest.executable.command_names);
            let config_path = match id {
                "kilo-code" => home_dir.join(".config/kilo/plugin/atoaxis-kilo-code"),
                // Kimi renamed its default home directory in newer releases;
                // prefer the current path but recognize the legacy Beta path.
                "kimi-code-cli" => {
                    let modern = home_dir.join(".kimi-code/config.toml");
                    let legacy = home_dir.join(".kimi/config.toml");
                    let managed = |path: &Path| {
                        fs::read_to_string(path)
                            .map(|text| text.contains("# AtoAxis managed Kimi Code hooks"))
                            .unwrap_or(false)
                    };
                    if managed(&modern) || !managed(&legacy) && modern.exists() {
                        modern
                    } else {
                        legacy
                    }
                }
                _ => return None,
            };
            let installed = match id {
                "kilo-code" => {
                    config_path.is_dir()
                        && config_path
                            .parent()
                            .map(|parent| parent.join("atoaxis-kilo-code.ts").is_file())
                            .unwrap_or(false)
                }
                "kimi-code-cli" => fs::read_to_string(&config_path)
                    .map(|text| text.contains("# AtoAxis managed Kimi Code hooks"))
                    .unwrap_or(false),
                _ => false,
            };
            Some(serde_json::json!({
                "agent": id,
                "installed": installed,
                "transcript_found": false,
                "native_executable": executable,
                "verification_status": format!("{:?}", manifest.effective_status()).to_lowercase(),
                "diagnostic": if executable.is_none() {
                    Some("native executable not found on PATH")
                } else if !installed {
                    Some("native adapter detected but not installed")
                } else {
                    None
                },
                "ever_scanned": false,
                "file_size": serde_json::Value::Null,
                "cursor_offset": serde_json::Value::Null,
                "lag_bytes": serde_json::Value::Null,
                "last_event_at": serde_json::Value::Null,
                "lag_seconds": serde_json::Value::Null,
            }))
        })
        .collect()
}

fn resolve_named_command(names: &[String]) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .flat_map(|directory| names.iter().map(move |name| directory.join(name)))
        .find(|candidate| candidate.is_file())
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

        // A bounded automatic pass must reach the active transcript before walking
        // months of historical sessions. Discovery order is lexical for deterministic
        // CLI output, so reorder the actual scan by mtime (newest first) and use the
        // path as a stable tie-breaker. This keeps Codex's current Desktop session
        // visible even when an older Claude/Codex archive is large.
        let mut transcript_paths = transcript_paths;
        transcript_paths.sort_by(|left, right| {
            let left_modified = fs::metadata(left).and_then(|meta| meta.modified()).ok();
            let right_modified = fs::metadata(right).and_then(|meta| meta.modified()).ok();
            right_modified
                .cmp(&left_modified)
                .then_with(|| right.cmp(left))
        });

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

            // planai2.md Phase 0.4: a parse failure for one agent must not abort the
            // sync for the others (the `AiActivityParser` contract says callers treat
            // `Err` as "skip this agent this cycle"). Record it and move to the next
            // agent instead of `?`-ing out of the whole run.
            let batch = match parser.parse_since(&ParseContext::default(), Some(&cursor)) {
                Ok(batch) => batch,
                Err(error) => {
                    eprintln!(
                        "  {id}: transcript parse failed — skipping this agent this cycle ({error})"
                    );
                    agent_service::record_scan(false, None, Some(&format!("{id}: {error}")));
                    break;
                }
            };
            // Usage is parsed independently from file-edit events: one model response may edit
            // several files, and copying its token count to each file would inflate totals. A
            // usage-parse failure is non-fatal — keep the file-edit events, drop token counts.
            let usage_records = match id {
                "claude-code" => parse_claude_usage(&transcript_path),
                "codex" => parse_codex_usage(&transcript_path),
                "gemini-cli" => parse_gemini_usage(&transcript_path),
                _ => Ok(Vec::new()),
            }
            .unwrap_or_else(|error| {
                eprintln!("  {id}: usage parse failed, continuing without token counts ({error})");
                Vec::new()
            });
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
                let mut submitted_events = Vec::with_capacity(new_events.len());
                for event in &new_events {
                    // One malformed historical transcript record must not abort the
                    // whole sync pass. In particular, Claude can report a file in a
                    // repository parent or a temporary scratch directory while its
                    // record cwd remains a nested workspace. The broker correctly
                    // rejects that event, but validating it here lets later events —
                    // including Codex events — continue through the same pass.
                    let candidate = broker::event_from_ai_edit(event, 0.0);
                    if let Err(error) = candidate.normalize() {
                        eprintln!(
                            "  {id}: skipping transcript event {} ({error})",
                            event.event_id
                        );
                        continue;
                    }

                    let event_time = event.occurred_at.timestamp_millis() as f64 / 1000.0;
                    let active_seconds = state.record_activity(
                        AI_ACTIVITY_STREAM,
                        event_time,
                        AI_ACTIVITY_TIMEOUT_SECONDS,
                    )?;
                    broker_events.push(broker::event_from_ai_edit(event, active_seconds));
                    submitted_events.push(*event);
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
                // Only acknowledge events that actually entered the submitted
                // broker batch. Invalid path/project pairs are intentionally
                // skipped above and must not be recorded as delivered locally.
                for event in submitted_events {
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

fn run_ai_tool_abort(json: bool) -> Result<(), Box<dyn Error>> {
    let input = read_ai_tool_input()?;
    let state = AiAttributionState::open()?;
    state.delete_tool_session(&input.tool_event_id)?;
    if json {
        println!(
            "{}",
            serde_json::json!({
                "status": "aborted",
                "tool_event_id": input.tool_event_id,
            })
        );
    } else {
        println!("AI tool {} snapshot discarded", input.tool_event_id);
    }
    Ok(())
}

fn read_ai_session_input() -> Result<AiSessionInput, Box<dyn Error>> {
    let mut stdin = String::new();
    io::stdin().read_to_string(&mut stdin)?;
    if stdin.trim().is_empty() {
        return Err("AI session metadata JSON is required on stdin".into());
    }
    let input: AiSessionInput = serde_json::from_str(&stdin)?;
    if input.session_id.trim().is_empty() {
        return Err("session_id must not be empty".into());
    }
    if input.session_id.len() > 128 || input.session_id.chars().any(char::is_control) {
        return Err("session_id is invalid or too long".into());
    }
    if input.agent.trim().is_empty() {
        return Err("agent must not be empty".into());
    }
    Ok(input)
}

fn ai_session_state_path() -> Result<PathBuf, Box<dyn Error>> {
    Ok(dirs::home_dir()
        .ok_or("could not resolve home directory")?
        .join(".wakaclock")
        .join("ai-sessions.json"))
}

fn write_ai_session_state_atomically(path: &Path, content: &str) -> Result<(), Box<dyn Error>> {
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    fs::write(&temporary, content)?;
    if let Err(error) = fs::rename(&temporary, path) {
        let _ = fs::remove_file(&temporary);
        return Err(error.into());
    }
    Ok(())
}

fn normalize_session_cwd(cwd: Option<PathBuf>) -> Result<Option<String>, Box<dyn Error>> {
    let Some(cwd) = cwd else { return Ok(None) };
    let absolute = if cwd.is_absolute() {
        cwd
    } else {
        std::env::current_dir()?.join(cwd)
    };
    Ok(Some(absolute.to_string_lossy().into_owned()))
}

fn run_ai_session(ended: bool, json: bool) -> Result<(), Box<dyn Error>> {
    let input = read_ai_session_input()?;
    let now = input.occurred_at.unwrap_or_else(chrono::Utc::now);
    if now > chrono::Utc::now() + chrono::Duration::minutes(5) {
        return Err("occurred_at cannot be more than five minutes in the future".into());
    }
    let agent = normalize_client_id(&input.agent)?;
    let provider = input
        .provider
        .as_deref()
        .map(normalize_provider_id)
        .transpose()?;
    let model = input.model.as_deref().map(normalize_model_id).transpose()?;
    let cwd = normalize_session_cwd(input.cwd)?;
    let source = input
        .source
        .as_ref()
        .unwrap_or(&AiEventSource::AgentHook)
        .as_str()
        .to_string();
    let key = format!("{agent}:{}", input.session_id.trim());
    let path = ai_session_state_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let lock_path = path.with_extension("lock");
    let lock_file = fs::OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(&lock_path)?;
    lock_file.lock_exclusive()?;

    let mut state: AiSessionState = fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or_default();
    state.version = default_session_state_version();
    // Keep closed metadata bounded while preserving every active session. This file
    // contains IDs/timestamps/paths only; it is not a transcript or source store.
    state.sessions.retain(|_, record| {
        record
            .ended_at
            .is_none_or(|ended_at| now.signed_duration_since(ended_at) < chrono::Duration::days(30))
    });

    let ended_at = {
        let record = state
            .sessions
            .entry(key.clone())
            .or_insert_with(|| AiSessionRecord {
                producer_version: PRODUCER_CONTRACT_VERSION,
                session_id: input.session_id.trim().to_string(),
                agent: agent.clone(),
                provider: provider.clone(),
                model: model.clone(),
                cwd: cwd.clone(),
                source: source.clone(),
                started_at: now,
                last_event_at: now,
                ended_at: None,
            });
        // A resumed session keeps its original start, while the latest lifecycle
        // payload may reveal provider/model/cwd that were absent at first start.
        record.last_event_at = now;
        record.provider = provider.or_else(|| record.provider.clone());
        record.model = model.or_else(|| record.model.clone());
        record.cwd = cwd.or_else(|| record.cwd.clone());
        record.source = source;
        if ended {
            record.ended_at = Some(now);
        } else {
            record.ended_at = None;
        }
        record.ended_at
    };
    let serialized = serde_json::to_string_pretty(&state)? + "\n";
    write_ai_session_state_atomically(&path, &serialized)?;
    // Dropping the file descriptor releases the advisory lock on every supported
    // Rust MSRV; `FileExt::unlock` is newer than this workspace's MSRV.
    drop(lock_file);

    if json {
        println!(
            "{}",
            serde_json::json!({
                "status": if ended { "session_ended" } else { "session_started" },
                "producer_version": PRODUCER_CONTRACT_VERSION,
                "agent": agent,
                "session_id": input.session_id.trim(),
                "occurred_at": now,
                "ended_at": ended_at,
            })
        );
    } else {
        println!(
            "AI session {} {}",
            input.session_id.trim(),
            if ended { "ended" } else { "started" }
        );
    }
    Ok(())
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
    // A completed before/after snapshot is positive evidence that an AI tool
    // operation changed the workspace, but the snapshot cannot prove which
    // process wrote the bytes. Preserve that distinction explicitly so the
    // broker publishes `ai_inferred` and the transport policy can scrub the
    // self-declared tool name before the heartbeat leaves the machine.
    let actor_type = Some(ActorType::AiInferred);
    GenericAiEventInput {
        event_id: tool_snapshot::stable_change_event_id(&before.tool_event_id, change),
        producer_version: Some(wakaclock_core::ai::PRODUCER_CONTRACT_VERSION),
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
        actor_type,
        actor_confidence: None,
        active_seconds: None,
        transport,
        tool: before.tool.clone().or_else(|| after_input.tool.clone()),
        tool_event_id: Some(before.tool_event_id.clone()),
        change_kind: Some(change.kind.as_str().to_string()),
        previous_entity: change.previous_entity.clone(),
        editor: None,
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

    // planai2.md Phase 2 (p2.2): one tool call owns one duration interval, no matter
    // how many files it touched. `spread_single_tool_interval` puts the whole
    // interval on the first file-evidence record and zero on the rest — they stay
    // linked by tool_event_id / ai_change_id.
    let mut inputs: Vec<GenericAiEventInput> =
        pending.iter().map(|(_, input)| (*input).clone()).collect();
    spread_single_tool_interval(&mut inputs, tool_active_seconds);
    let mut broker_events = Vec::with_capacity(inputs.len());
    for event_input in &inputs {
        broker_events.push(broker_event_from_generic(event_input)?);
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
    let change_kind = input
        .change_kind
        .as_deref()
        .and_then(wakaclock_core::broker::BrokerChangeKind::from_tool_operation)
        .unwrap_or(wakaclock_core::broker::BrokerChangeKind::Modify);
    let previous_entity = input
        .previous_entity
        .as_ref()
        .map(|path| normalize_entity(&path.to_string_lossy()).map(PathBuf::from))
        .transpose()?;
    Ok(AiEditEvent {
        event_id: input.event_id.trim().to_string(),
        agent: normalize_agent_id(&input.agent),
        provider: normalize_optional_text(input.provider.clone()),
        model: normalize_optional_text(input.model.clone()),
        session_id: normalize_optional_text(input.session_id.clone()),
        tool_event_id: normalize_optional_text(input.tool_event_id.clone()),
        occurred_at: input.occurred_at.unwrap_or_else(chrono::Utc::now),
        entity,
        project_root,
        change_kind,
        previous_entity,
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

/// planai2.md Phase 2 (p2.2): a single tool call touching N files produces N
/// file-evidence records but **one** duration interval — the first record carries
/// the whole `total_seconds`, the rest carry `0.0`. Keeps multi-file edits from
/// multiplying `total_seconds` by the file count.
fn spread_single_tool_interval(inputs: &mut [GenericAiEventInput], total_seconds: f64) {
    for (index, input) in inputs.iter_mut().enumerate() {
        input.active_seconds = Some(if index == 0 { total_seconds } else { 0.0 });
    }
}

fn broker_event_from_generic(input: &GenericAiEventInput) -> Result<BrokerEventV1, Box<dyn Error>> {
    let event = generic_ai_edit_event(input)?;
    // planai2.md Phase 2 (p2.2): the full generic-ingress operation vocabulary
    // (write, apply patch, create, move, rename, delete, replace, multi-edit,
    // shell mutation) plus the adjective spellings `WorkspaceChangeKind::as_str`
    // emits — all resolved through one canonical map in `wakaclock-core::broker`,
    // not a match that has historically missed cases (e.g. "modified", then
    // "replace"/"multi_edit"/"shell_mutation").
    let raw_kind = input.change_kind.as_deref().unwrap_or("modify");
    let change_kind = wakaclock_core::broker::BrokerChangeKind::from_tool_operation(raw_kind)
        .ok_or_else(|| format!("unsupported broker change_kind/operation: {raw_kind}"))?;
    let previous_entity = input
        .previous_entity
        .as_ref()
        .map(|path| normalize_entity(&path.to_string_lossy()))
        .transpose()?
        .map(|path| path.to_string());
    Ok(BrokerEventV1 {
        schema_version: wakaclock_core::broker::BROKER_SCHEMA_VERSION,
        producer_version: input.producer_version,
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
        editor: input.editor.clone(),
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
        producer_version: None,
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
        // `heartbeat.editor` was already set by `build_heartbeat`'s `detect_editor()`
        // in this same process — a real declaration unless it's just that call's own
        // generic fallback, which carries no information worth forwarding.
        editor: Some(heartbeat.editor.clone())
            .filter(|value| !value.trim().is_empty() && value != GENERIC_EDITOR_FALLBACK),
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
/// are not dependent on a user remembering to run `wakaclock ai sync`. Each agent gets
/// its own bounded pass: a large or malformed Claude history must not consume the whole
/// budget before Codex gets a chance to scan its current session. A timeout/error leaves
/// the ordinary heartbeat path untouched and the transcript cursor replayable on the
/// next call.
pub(crate) async fn run_bounded_ai_sync(config: &Config, api_client: &ApiClient) {
    const AUTO_SYNC_AGENT_BUDGET: Duration = Duration::from_secs(2);

    // Keep this order stable and put the low-latency active-session parser first. The
    // calls remain sequential because AiSyncLock protects the shared attribution state;
    // the independent timeout is what prevents one parser from starving the others.
    for agent in ["codex", "claude-code", "gemini-cli"] {
        match tokio::time::timeout(
            AUTO_SYNC_AGENT_BUDGET,
            run_ai_sync(config, api_client, Some(agent), false, false, false, None),
        )
        .await
        {
            Ok(Ok(())) => {}
            Ok(Err(error)) => {
                eprintln!("Warning: automatic {agent} sync skipped: {error}")
            }
            Err(_) => {
                eprintln!("Warning: automatic {agent} sync exceeded 2 seconds; will retry later")
            }
        }
    }
}

/// Builds an AI-attributed heartbeat directly from a parsed transcript event, with no
/// editor buffer to correlate against (see `AiAction::Sync`'s doc comment) — `editor`
/// is therefore best-effort via `detect_editor()` (the same env-var heuristic ordinary
/// heartbeats use), not a real correlation. `ai_source` is always `"transcript"` here —
/// never `"agent_hook"` — because the value must describe how *this* event was
/// obtained, not how some other integration might have reported the same file.
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
        // `project_root` คือ cwd ที่ agent รายงานมาเอง ซึ่งอาจเป็นโฟลเดอร์อะไรก็ได้ —
        // การรับชื่อมันดื้อ ๆ ทำให้ smoke test ใน `/private/tmp` กลายเป็น project ชื่อ
        // `tmp` ปนอยู่ใน dashboard ต้องมี marker ยืนยันว่าเป็น root ของโปรเจกต์จริงก่อน
        // ไม่งั้นปล่อยเป็น NULL ดีกว่ารายงานชื่อที่ไม่ใช่ project ของใครเลย
        .or_else(|| {
            event
                .project_root
                .as_deref()
                .filter(|root| has_workspace_marker(root) || has_project_marker(root))
                .and_then(|root| project_name_from_root(Some(root)))
        });
    heartbeat.branch = git_info.map(|info| info.branch);
    heartbeat.is_write = true;
    heartbeat.category = Category::Coding;
    heartbeat.operating_system = std::env::consts::OS.to_string();
    heartbeat.machine = hostname::get()
        .ok()
        .and_then(|value| value.into_string().ok())
        .unwrap_or_else(|| "unknown".to_string());
    // No editor buffer to correlate against here — prefer whatever editor this
    // process's own environment declares (see `detect_editor_env`), but when there is
    // none, name the actual source honestly (the AI agent itself) rather than a
    // meaningless generic fallback: an agent host that isn't an editor (a headless
    // hook runner, a desktop AI app) simply has no editor to report.
    heartbeat.editor = detect_editor_env().unwrap_or_else(|| event.agent.clone());
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
        heartbeat.clipboard_tracking_version = extra.clipboard_tracking_version;
        heartbeat.copy_actions = extra.copy_actions;
        heartbeat.paste_actions = extra.paste_actions;
        heartbeat.copied_chars = extra.copied_chars;
        heartbeat.copied_lines = extra.copied_lines;
        heartbeat.pasted_chars = extra.pasted_chars;
        heartbeat.pasted_lines = extra.pasted_lines;
        heartbeat.paste_same_file_actions = extra.paste_same_file_actions;
        heartbeat.paste_same_workspace_actions = extra.paste_same_workspace_actions;
        heartbeat.paste_external_or_unknown_actions = extra.paste_external_or_unknown_actions;
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

    // Keep local dry-runs and offline queue entries subject to the same
    // accuracy-first rule as the server. Only verified hook/MCP/transcript
    // evidence may publish a name; all other AI claims remain unattributed.
    heartbeat.enforce_attribution_policy();
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

/// Generic fallback when no client (editor or AI agent host) declared itself. Kept as
/// a named constant, not just a literal, so `broker_event_from_heartbeat` can compare
/// against exactly the value `detect_editor()` produces when nothing was declared.
const GENERIC_EDITOR_FALLBACK: &str = "wakaclock-cli";

/// Self-declared editor from this process's own environment — `WAKACLOCK_EDITOR` is
/// set by a client that spawns the CLI on its own behalf (e.g. the VS Code extension);
/// `TERM_PROGRAM`/`EDITOR` cover an editor's integrated terminal or a shell default.
/// Returns `None` when nothing was declared, rather than guessing.
fn detect_editor_env() -> Option<String> {
    std::env::var("WAKACLOCK_EDITOR")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| std::env::var("TERM_PROGRAM").ok())
        .or_else(|| std::env::var("EDITOR").ok())
}

fn detect_editor() -> String {
    detect_editor_env().unwrap_or_else(|| GENERIC_EDITOR_FALLBACK.to_string())
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
            producer_version: Some(1),
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
            editor: None,
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
    fn ai_session_lifecycle_commands_are_first_class_subcommands() {
        let start = Cli::try_parse_from(["wakaclock", "ai", "session-start", "--json"])
            .expect("session-start should parse");
        assert!(matches!(
            start.command,
            Commands::Ai {
                action: AiAction::SessionStart { json: true }
            }
        ));
        let end = Cli::try_parse_from(["wakaclock", "ai", "session-end", "--json"])
            .expect("session-end should parse");
        assert!(matches!(
            end.command,
            Commands::Ai {
                action: AiAction::SessionEnd { json: true }
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
            "modify",
            "modified",
            "create",
            "created",
            "delete",
            "deleted",
            "rename",
            "renamed",
            // planai2.md p2.2: the rest of the generic-ingress operation vocabulary.
            "write",
            "apply_patch",
            "apply patch",
            "replace",
            "multi_edit",
            "multi-edit",
            "shell_mutation",
            "str_replace",
        ] {
            let mut input = sample_input();
            input.change_kind = Some(kind.to_string());
            broker_event_from_generic(&input)
                .unwrap_or_else(|error| panic!("change_kind {kind:?} should be accepted: {error}"));
        }
        // A genuinely unknown operation is still rejected, not silently mapped.
        let mut bogus = sample_input();
        bogus.change_kind = Some("teleport".to_string());
        assert!(broker_event_from_generic(&bogus).is_err());
    }

    #[test]
    fn shell_tool_snapshot_keeps_positive_ai_evidence_as_inferred() {
        let started_at = chrono::Utc::now();
        let before = ToolSnapshot {
            tool_event_id: "shell-call-1".to_string(),
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            model: None,
            session_id: Some("session-1".to_string()),
            tool: Some("Bash".to_string()),
            transport: Some("shell_hook".to_string()),
            workspace_root: PathBuf::from("/workspace"),
            started_at,
            files: BTreeMap::new(),
            git_backed: true,
        };
        let after_input = AiToolInput {
            tool_event_id: "shell-call-1".to_string(),
            agent: "codex".to_string(),
            provider: Some("openai".to_string()),
            model: None,
            session_id: Some("session-1".to_string()),
            tool: Some("Bash".to_string()),
            transport: Some("shell_hook".to_string()),
            workspace_root: Some(PathBuf::from("/workspace")),
            cwd: None,
        };
        let change = WorkspaceChange {
            kind: tool_snapshot::WorkspaceChangeKind::Modified,
            entity: PathBuf::from("/workspace/app.py"),
            previous_entity: None,
            lines_added: Some(1),
            lines_deleted: Some(1),
        };

        let input = tool_change_input(&before, &after_input, &change, started_at);
        assert_eq!(input.actor_type, Some(ActorType::AiInferred));
        assert_eq!(input.actor_confidence, None);

        let event = broker_event_from_generic(&input)
            .expect("tool snapshot should become a broker event")
            .normalize()
            .expect("tool snapshot should normalize");
        assert_eq!(event.actor_type, Some(ActorType::AiInferred));
        assert_eq!(event.actor_confidence, Some(0.6));
    }

    #[test]
    fn spread_single_tool_interval_gives_one_interval_across_n_files() {
        // planai2.md p2.2: one tool call touching 3 files → 3 evidence records,
        // 1 duration interval (first record only).
        let mut inputs: Vec<GenericAiEventInput> = (0..3)
            .map(|i| {
                let mut input = sample_input();
                input.event_id = format!("multi-{i}");
                input.active_seconds = Some(99.0); // pre-existing value must be overwritten
                input
            })
            .collect();
        spread_single_tool_interval(&mut inputs, 42.0);
        assert_eq!(
            inputs.iter().map(|i| i.active_seconds).collect::<Vec<_>>(),
            vec![Some(42.0), Some(0.0), Some(0.0)]
        );
        let total: f64 = inputs.iter().filter_map(|i| i.active_seconds).sum();
        assert_eq!(total, 42.0);
        assert_eq!(inputs.len(), 3);

        // A single-file call keeps the whole interval.
        let mut one = vec![sample_input()];
        spread_single_tool_interval(&mut one, 7.5);
        assert_eq!(one[0].active_seconds, Some(7.5));
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
        // Accuracy-over-coverage (plans/decision-accuracy-over-coverage.md): a legacy
        // "inferred" confidence with no native-hook/MCP source is unattributed, not a
        // weaker AI guess.
        assert_eq!(event.actor_type, Some(ActorType::Unknown));
        assert_eq!(event.actor_confidence, Some(0.0));
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
