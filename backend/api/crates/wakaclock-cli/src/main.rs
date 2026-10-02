use chrono::{Duration as ChronoDuration, NaiveDate, TimeZone, Utc};
use chrono_tz::Tz;
use clap::{Parser, Subcommand};
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::BTreeMap,
    error::Error,
    fs,
    io::{self, BufRead, BufReader, Read},
    path::{Path, PathBuf},
    process::Command,
    str::FromStr,
    sync::OnceLock,
    time::{Duration, Instant},
};
use uuid::Uuid;
mod agent_service;
mod ai_setup;
mod broker;
mod tool_snapshot;
use tool_snapshot::{AiToolInput, ToolSnapshot, WorkspaceChange};
use wakaclock_ast::detect_file;
use wakaclock_core::ai::topology_handoff::{
    CloudJobEvidence, CollectorCapabilities, CollectorRegistration, HandoffEvent,
    HandoffEventIdentity, HandoffIngestOutcome, HandoffLedger,
};
use wakaclock_core::{
    ai::{
        editor_capability_catalog, is_known_agent_id, normalize_agent_id, normalize_client_id,
        normalize_identity_reference, normalize_model_id, normalize_provider_id,
        parse_claude_usage, parse_codex_usage, parse_gemini_usage, resolve_identity,
        AdapterFreshnessV2, AdapterRuntime, AiActivityParser, AiAttributionState, AiConfidence,
        AiDiagnosticsReportV2, AiEditEvent, AiEventSource, BrokerHealthV2, CertificationTuple,
        ClaudeCodeParser, CodexParser, DiagnosticMeasurement, DiagnosticsConsent, DiscoveryContext,
        DiscoveryResult, DiscoveryState, EditorSurface, ExecutionSurface, GeminiCliParser,
        IdentityStatus, MeasurementAvailability, ObserverConfig, ParseContext, ParserCursor,
        ParserLagSummaryV2, RuntimeHealth, TopologyContext, TopologyIdentityInput, TranscriptLag,
        VerificationStatus, FINGERPRINT_SCHEME_V1, IDENTITY_SCHEMA_VERSION,
        PRODUCER_CONTRACT_VERSION, REASON_CONFLICTING_EVIDENCE, REASON_INTERNAL_MARKER,
    },
    api_client::{
        http_status_of, is_retryable_delivery_error, retry_after_seconds, AiIdentityCorrection,
        AiIdentityRepairReport, AiIdentityRepairRequest, ApiClient, ConnectionState,
        DeliveryFailureKind,
    },
    broker::{scoped_storage_event_id, BrokerEventV1},
    config::Config,
    error::AppError,
    git,
    heartbeat::{
        resolve_attribution, union_activity_seconds, ActivitySegment, ActorType, AttributionInput,
        Category, EntityType, Heartbeat, MAX_ACTIVITY_GAP_SECONDS, MAX_AI_TOOL_DURATION_SECONDS,
    },
    project::{resolve_project, ProjectSource},
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

    /// Acquire a second, short-lived lease for topology handoff mutations. The
    /// handoff ledger is a load/modify/save snapshot, so SQLite's row write alone
    /// cannot prevent two CLI processes from both accepting the same receipt. A
    /// blocking OS lease serializes that critical section and is released by the
    /// kernel if the producer exits unexpectedly.
    fn acquire_blocking_at(path: &Path) -> Result<Self, Box<dyn Error>> {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        let file = fs::OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(path)?;
        file.lock_exclusive()?;
        Ok(Self { _file: file })
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
#[command(name = "wakaclock", version, about = "AtoAxis CLI Hub")]
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

        /// Force this project name, overriding repository detection.
        #[arg(long)]
        project: Option<String>,

        /// Fallback project name (e.g. the editor's workspace folder), used only when no
        /// repository or project marker identifies the entity.
        #[arg(long)]
        alternate_project: Option<String>,

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

        /// Original event time as Unix seconds. Retries must preserve this value.
        #[arg(long)]
        time: Option<f64>,

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

        #[arg(long)]
        line_metric_version: Option<String>,

        #[arg(long)]
        line_measurement_status: Option<String>,

        #[arg(long)]
        line_measurement_reason: Option<String>,

        #[arg(long)]
        measurement_window_id: Option<String>,

        #[arg(long, default_value_t = false)]
        extra_heartbeats: bool,

        /// Emit a machine-readable outcome in addition to the normal text mode.
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Process queued metadata and newly written AI transcripts once, then exit.
    /// This is the supported on-demand collector entry point.
    Sync {
        /// Only sync this agent (`claude-code`, `codex`, or `gemini-cli`).
        #[arg(long)]
        agent: Option<String>,
        /// Use the short hook budget; intended for native lifecycle hooks.
        #[arg(long, hide = true, default_value_t = false)]
        automatic: bool,
        /// Parse and report without contacting the server or advancing delivery state.
        #[arg(long, default_value_t = false)]
        dry_run: bool,
        /// Replay transcript bytes from the beginning while retaining event deduplication.
        #[arg(long, default_value_t = false)]
        from_start: bool,
        /// Parse one exact transcript file. Requires `--agent`.
        #[arg(long)]
        transcript: Option<PathBuf>,
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
    /// Deprecated compatibility command: remove any legacy service and run one bounded sync.
    Run {
        #[arg(long, default_value_t = 1)]
        interval_seconds: u64,
    },
    /// Deprecated compatibility command: remove the legacy service; never install one.
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
    /// Rotate the legacy local token; on-demand mode does not restart a service.
    RotateToken {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Submit one metadata-only VS Code workspace observation to the local broker.
    /// The JSON payload is read from stdin so no broker token is exposed to the
    /// extension process or its command line.
    #[command(name = "editor-observe")]
    EditorObserve {
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Read the correlation status for a previously submitted VS Code observation.
    #[command(name = "editor-observation-status")]
    EditorObservationStatus {
        #[arg(long)]
        observation_id: String,
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
    /// Deprecated compatibility command: remove any legacy service and run one bounded sync.
    Run {
        #[arg(long, default_value_t = 5)]
        interval_seconds: u64,
    },
    /// Deprecated compatibility command: remove the legacy service; never install one.
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
    /// Print the local topology identity used by remote/container collector setup.
    /// The output contains only opaque IDs; local paths and repository URLs stay
    /// local to the collector and are never included in this snapshot.
    Topology {
        #[arg(long)]
        root: Option<PathBuf>,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Print the shared editor/input/AI-evidence capability inventory. Editor
    /// names never promote a generic document change to an AI attribution.
    Capabilities {
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
    /// Remove the CLI-owned adapter registration/consent records and legacy service
    /// registration. Agent configuration files are preserved.
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
    /// agents that do not expose a transcript format AtoAxis can parse itself.
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
    /// Audit and optionally repair provider/model identity from local
    /// transcripts. Dry-run is the default and never writes local or remote
    /// state; `--apply` sends only metadata corrections for events that have
    /// a complete, trusted tuple.
    #[command(name = "repair", visible_alias = "repair-identity")]
    Repair {
        /// Restrict the report to one supported transcript adapter.
        #[arg(long)]
        agent: Option<String>,
        /// Scan one exact transcript instead of discovered sources. Requires
        /// `--agent` so the parser cannot be guessed from the file contents.
        #[arg(long)]
        transcript: Option<PathBuf>,
        /// Inclusive lower bound as RFC3339 or YYYY-MM-DD (UTC).
        #[arg(long)]
        from: Option<String>,
        /// Exclusive upper bound as RFC3339 or YYYY-MM-DD (UTC). A date-only
        /// value includes that whole calendar day.
        #[arg(long)]
        to: Option<String>,
        /// Append identity revisions on the server for matched events. The
        /// server copies measured values from the canonical row unchanged.
        #[arg(long, default_value_t = false)]
        apply: bool,
        /// Explicitly select the read-only mode (the default).
        #[arg(long, default_value_t = false)]
        dry_run: bool,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Reparse local agent transcripts and create a metadata-only historical line
    /// measurement preview. Applying corrections requires confirmation in Trust Center.
    #[command(name = "repair-measurements")]
    RepairMeasurements {
        /// First inclusive calendar date (YYYY-MM-DD).
        #[arg(long)]
        from: String,
        /// Last inclusive calendar date (YYYY-MM-DD).
        #[arg(long)]
        to: String,
        /// IANA timezone used to resolve the selected calendar dates.
        #[arg(long, default_value = "UTC")]
        timezone: String,
        /// Restrict the scan to one supported transcript adapter.
        #[arg(long)]
        agent: Option<String>,
        /// Reparse one exact transcript instead of discovered sources. Requires `--agent`.
        #[arg(long)]
        transcript: Option<PathBuf>,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Save an API key generated from the AtoAxis dashboard into ~/.wakaclock/config.toml
    SetKey {
        /// Deprecated positional form. Prefer `--stdin` so the secret never appears
        /// in shell history or process listings.
        key: Option<String>,
        #[arg(long, default_value_t = false)]
        stdin: bool,
        #[arg(long, default_value_t = false)]
        json: bool,
    },
    /// Save the API origin used by the CLI and event-triggered hooks.
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
    alternate_project: Option<String>,
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
    time: Option<f64>,
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
    #[serde(default)]
    line_metric_version: Option<String>,
    #[serde(default)]
    line_measurement_status: Option<String>,
    #[serde(default)]
    line_measurement_reason: Option<String>,
    #[serde(default)]
    measurement_window_id: Option<String>,
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
    turn_id: Option<String>,
    /// Optional message-level proof for producers that can expose the parent
    /// assistant message separately from the tool call id.
    #[serde(default)]
    identity_message_id: Option<String>,
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
    /// Optional F7 topology context. It is validated locally and scopes the
    /// opaque event identity; broker v1 does not receive a new field until F8
    /// compatibility rehearsal completes.
    #[serde(default)]
    topology: Option<wakaclock_core::ai::TopologyContext>,
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
            turn_id: None,
            identity_message_id: None,
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
            topology: None,
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

/// `verify --json` status for a failed probe, from the same classifier as `today`.
/// The emitted values are unchanged; `reachable` means the server sent a response.
fn verify_outcome(error: &AppError) -> (&'static str, bool) {
    let reachable = match error {
        AppError::Http(inner) => inner.status().is_some(),
        AppError::Auth(_) | AppError::HttpStatus { .. } | AppError::HttpStatusRetry { .. } => true,
        _ => false,
    };
    let status = match DeliveryFailureKind::from_error(error) {
        DeliveryFailureKind::Auth401 => "invalid_key",
        DeliveryFailureKind::Payment402 => "subscription_required",
        DeliveryFailureKind::Network => "unreachable",
        _ => "server_error",
    };
    (status, reachable)
}

/// Render one scope's delivery failure. `category`/`http_status`/`message_code` are
/// what callers decide on; `message` stays a bounded local diagnostic, and `at` keeps
/// the pre-scope field name so existing readers do not break.
fn delivery_failure_json(
    failure: wakaclock_core::queue::DeliveryFailureRecord,
) -> serde_json::Value {
    serde_json::json!({
        "at": failure.recorded_at as f64,
        "last_attempt_at": failure.last_attempt_at as f64,
        "message": failure.detail.clone().unwrap_or_default(),
        "category": failure.kind,
        "http_status": failure.http_status,
        "message_code": failure.message_code,
        "consecutive_failures": failure.consecutive_failures,
    })
}

/// Structured reachability for `wakaclock today --json`.
///
/// The GET probe decides reachability. When it succeeds, a recorded POST refusal
/// for entitlement (402) or payload (400/422) still wins, because reading today's
/// total keeps working while heartbeat delivery is refused. A recorded 401 does not:
/// the successful GET was authenticated with the same credential, so it proves the
/// key works now. Recorded network/server failures are likewise superseded and only
/// reported as `last_error_kind`.
fn today_connection(
    probe_failure: Option<(DeliveryFailureKind, Option<u16>)>,
    recorded: Option<&wakaclock_core::queue::DeliveryFailureRecord>,
) -> serde_json::Value {
    if let Some((kind, http_status)) = probe_failure {
        let authenticated = match kind {
            DeliveryFailureKind::Auth401 => Some(false),
            DeliveryFailureKind::Payment402 | DeliveryFailureKind::Validation => Some(true),
            _ => None,
        };
        return serde_json::json!({
            "state": ConnectionState::from_failure_kind(kind).as_str(),
            "reachable": kind != DeliveryFailureKind::Network,
            "authenticated": authenticated,
            "http_status": http_status,
            "last_error_kind": kind.as_str(),
            "last_error_at": chrono::Utc::now().timestamp() as f64,
        });
    }
    let refusal =
        recorded.filter(|failure| matches!(failure.kind.as_str(), "payment_402" | "validation"));
    let state = refusal
        .and_then(|failure| match failure.kind.as_str() {
            "payment_402" => Some(ConnectionState::SubscriptionRequired),
            "validation" => Some(ConnectionState::ValidationRejected),
            _ => None,
        })
        .unwrap_or(ConnectionState::Online);
    serde_json::json!({
        "state": state.as_str(),
        "reachable": true,
        "authenticated": true,
        "http_status": refusal.and_then(|failure| failure.http_status),
        "last_error_kind": recorded.map(|failure| failure.kind.clone()),
        "last_error_at": recorded.map(|failure| failure.recorded_at as f64),
    })
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
            alternate_project,
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
            time,
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
            line_metric_version,
            line_measurement_status,
            line_measurement_reason,
            measurement_window_id,
            extra_heartbeats,
            json,
        } => {
            // Hook-originated AI heartbeats are already attributed. Running transcript
            // sync from inside them would create a second event for the same patch. A
            // transcript reads are also consent-gated: installing hooks alone must
            // never open a production attribution path.
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
                alternate_project: None,
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
                time,
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
                line_metric_version,
                line_measurement_status,
                line_measurement_reason,
                measurement_window_id,
            };
            let mut primary = build_heartbeat(
                &config,
                &entity,
                entity_type,
                project.clone(),
                alternate_project.clone(),
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
                    // Inherit the raw command-line names, not `primary.project`: that value
                    // may have come from the primary entity's repository, and an extra
                    // entity can live in a different one.
                    let resolved_project = extra.project.clone().or_else(|| project.clone());
                    let resolved_alternate_project = extra
                        .alternate_project
                        .clone()
                        .or_else(|| alternate_project.clone());
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
                        resolved_alternate_project,
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
        Commands::Sync {
            agent,
            automatic,
            dry_run,
            from_start,
            transcript,
            json,
        } => {
            if transcript.is_some() && agent.is_none() {
                return Err("--transcript requires --agent".into());
            }
            const AUTOMATIC_SYNC_DEADLINE: Duration = Duration::from_secs(10);
            const MANUAL_SYNC_DEADLINE: Duration = Duration::from_secs(60);
            let deadline = Instant::now()
                + if automatic {
                    AUTOMATIC_SYNC_DEADLINE
                } else {
                    MANUAL_SYNC_DEADLINE
                };
            let (sync_error, timed_out) = match tokio::time::timeout(
                if automatic {
                    AUTOMATIC_SYNC_DEADLINE
                } else {
                    MANUAL_SYNC_DEADLINE
                },
                run_on_demand_sync(
                    &config,
                    &api_client,
                    agent.as_deref(),
                    dry_run,
                    !json,
                    from_start,
                    transcript.as_deref(),
                    deadline,
                ),
            )
            .await
            {
                Ok(Ok(())) => (None, false),
                Ok(Err(error)) => {
                    eprintln!("On-demand sync deferred: {error}");
                    let timed_out = error.to_string() == "deadline_exceeded";
                    (Some(error.to_string()), timed_out)
                }
                Err(_) => {
                    eprintln!(
                        "On-demand sync reached the {}-second deadline; remaining work stays queued",
                        if automatic { 10 } else { 60 }
                    );
                    (Some("deadline_exceeded".to_string()), true)
                }
            };
            let queue_scope = api_client.queue_scope();
            let heartbeat_queue = Queue::open()
                .and_then(|queue| queue.status_scoped(&queue_scope))
                .unwrap_or_default();
            let outbound_pending = heartbeat_queue.pending;
            let broker_stats = wakaclock_core::broker::BrokerStore::open()
                .and_then(|store| store.stats())
                .ok();
            let inbox_pending = broker_stats
                .as_ref()
                .map(|stats| {
                    stats
                        .pending
                        .saturating_add(stats.processing)
                        .saturating_add(stats.retry)
                })
                .unwrap_or_default() as usize;
            let ai_usage_queue = AiAttributionState::open()
                .and_then(|state| state.usage_queue_status(chrono::Utc::now().timestamp()))
                .unwrap_or_default();
            let pending = outbound_pending
                .saturating_add(inbox_pending)
                .saturating_add(ai_usage_queue.pending);
            let deferred_reason = sync_deferred_reason(
                sync_error.as_deref(),
                timed_out,
                pending,
                ai_usage_queue.conflicts,
            );
            let deferred = deferred_reason.is_some();
            let last_error = sync_error.clone().or_else(|| {
                (ai_usage_queue.conflicts > 0).then(|| "usage_conflicts_quarantined".to_string())
            });
            if json {
                println!(
                    "{}",
                    serde_json::json!({
                        "schema_version": 2,
                        "runtime_mode": "on_demand",
                        "status": if deferred {
                            "deferred"
                        } else if dry_run {
                            "accepted"
                        } else {
                            "sent"
                        },
                        "accepted": dry_run || sync_error.is_none(),
                        "sent": !dry_run
                            && sync_error.is_none()
                            && pending == 0
                            && ai_usage_queue.conflicts == 0,
                        "pending": pending,
                        "unresolved_conflicts": ai_usage_queue.conflicts,
                        "outbound_pending": outbound_pending,
                        "inbox_pending": inbox_pending,
                        "heartbeat_queue": {
                            "pending": heartbeat_queue.pending,
                            "eligible": heartbeat_queue.eligible,
                            "leased": heartbeat_queue.leased,
                            "retry": heartbeat_queue.retry,
                            "dead_letter": heartbeat_queue.dead_letter,
                        },
                        "ai_usage_queue": {
                            "pending": ai_usage_queue.pending,
                            "eligible": ai_usage_queue.eligible,
                            "leased": 0,
                            "retry": ai_usage_queue.retry,
                            "dead_letter": ai_usage_queue.dead_letter,
                            "conflicts": ai_usage_queue.conflicts,
                        },
                        "inbox": {
                            "pending": broker_stats.as_ref().map(|stats| stats.pending).unwrap_or(0),
                            "eligible": broker_stats.as_ref().map(|stats| stats.pending).unwrap_or(0),
                            "leased": broker_stats.as_ref().map(|stats| stats.processing).unwrap_or(0),
                            "retry": broker_stats.as_ref().map(|stats| stats.retry).unwrap_or(0),
                            "dead_letter": broker_stats.as_ref().map(|stats| stats.dead_letter).unwrap_or(0),
                        },
                        "lease_active": sync_error.as_deref() == Some("already_running"),
                        "deferred_reason": deferred_reason,
                        "deferred": deferred,
                        "last_error": last_error,
                    })
                );
            } else {
                if timed_out {
                    println!(
                        "On-demand sync reached its {}-second deadline.",
                        if automatic { 10 } else { 60 }
                    );
                } else if sync_error.is_some() {
                    println!("On-demand sync completed with deferred work.");
                } else {
                    println!("On-demand sync completed.");
                }
                println!("Pending heartbeat(s): {pending}.");
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
            let queue_scope = api_client.queue_scope();
            let (queue, queue_status, queue_error) = match Queue::open() {
                Ok(queue) => match queue.status_scoped(&queue_scope) {
                    Ok(status) => (Some(queue), Some(status), None),
                    Err(error) => (None, None, Some(error.to_string())),
                },
                Err(error) => (None, None, Some(error.to_string())),
            };
            let queued = queue_status.map(|status| status.pending);
            let identity = build_identity();
            let cli_paths = cli_path_report();
            let legacy_service = agent_service::status();
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

            let flush = match api_client.flush_queue().await {
                Ok(flush) => flush,
                Err(error) => wakaclock_core::api_client::FlushReport {
                    flushed: 0,
                    stopped_because: Some(format!("queue unavailable: {error}")),
                },
            };
            // After the key check: a verified same-account key has already rebound
            // its older rows, so only rows that still lack proof are counted.
            let orphaned = queue
                .as_ref()
                .and_then(|queue| queue.orphaned_len(&api_client.queue_scope()).ok());

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
                        "queue_status": if queued.is_some() { "available" } else { "unavailable" },
                        "queue_status_detail": queue_error,
                        "queued_heartbeats": queued,
                        "queue_eligible": queue_status.map(|status| status.eligible),
                        "queue_leased": queue_status.map(|status| status.leased),
                        "queue_retry": queue_status.map(|status| status.retry),
                        "queue_dead_letter": queue_status.map(|status| status.dead_letter),
                        "queue_line_metrics_pending":
                            queue_status.map(|status| status.line_metrics_pending),
                        "queue_oldest_pending_at": queue_status.and_then(|status| {
                            status
                                .oldest_pending_at
                                .and_then(|seconds| chrono::DateTime::from_timestamp(seconds, 0))
                        }),
                        "queue_last_successful_delivery_at": queue_status.and_then(|status| {
                            status.last_successful_delivery_at.and_then(|seconds| {
                                chrono::DateTime::from_timestamp(seconds, 0)
                            })
                        }),
                        "runtime_mode": "on_demand",
                        "service_installed": legacy_service.installed,
                        "service_running": legacy_service.running,
                        "orphaned_queued_heartbeats": orphaned,
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
                println!("Runtime mode: on_demand (no background collector)");
                if legacy_service.installed || legacy_service.running {
                    println!(
                        "Legacy service detected: installed={} running={} (run `wakaclock broker uninstall` to remove it)",
                        legacy_service.installed, legacy_service.running
                    );
                }
                match queued {
                    Some(queued) => {
                        println!("Queued heartbeats: {queued}");
                        if let Some(status) = queue_status {
                            println!(
                                "Queue detail: eligible={} leased={} retry={} dead_letter={} line_metrics_pending={}",
                                status.eligible,
                                status.leased,
                                status.retry,
                                status.dead_letter,
                                status.line_metrics_pending
                            );
                            if let Some(oldest) = status
                                .oldest_pending_at
                                .and_then(|seconds| chrono::DateTime::from_timestamp(seconds, 0))
                            {
                                println!("Oldest pending heartbeat: {}", oldest.to_rfc3339());
                            }
                            if let Some(last_successful) = status
                                .last_successful_delivery_at
                                .and_then(|seconds| chrono::DateTime::from_timestamp(seconds, 0))
                            {
                                println!(
                                    "Last successful delivery: {}",
                                    last_successful.to_rfc3339()
                                );
                            }
                        }
                    }
                    None => println!(
                        "Queued heartbeats: unavailable{}",
                        queue_error
                            .as_deref()
                            .map(|error| format!(" ({error})"))
                            .unwrap_or_default()
                    ),
                }
                if let Some(orphaned) = orphaned.filter(|count| *count > 0) {
                    println!(
                        "Orphaned heartbeats: {orphaned} (queued under another API key or server; kept until the same account is verified)"
                    );
                }
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
                        "warning: the installed service manifest still runs the legacy `agent run` alias — run `wakaclock broker uninstall` to remove it"
                    );
                }
                if stale_service_binary {
                    println!(
                        "warning: the installed service manifest points at a different `wakaclock` binary — run `wakaclock broker uninstall` to remove it"
                    );
                }
            }
        }
        Commands::Today { timezone, json } => {
            // `--json` reports a rejected key as `connection.state = auth_rejected` so
            // editors decide on a typed state. Text mode keeps the historical non-zero
            // exit, which older editor builds rely on to show "key rejected".
            let (mut snapshot, server_error, probe_failure) =
                match api_client.today_with_timezone(timezone.as_deref()).await {
                    Ok(snapshot) => (snapshot, None, None),
                    Err(AppError::Auth(message)) if !json => return Err(message.into()),
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
                            active_intervals: vec![],
                            last_increment_seconds: None,
                            last_increment_source: None,
                            discarded_seconds: 0.0,
                            active_seconds: None,
                            active_coverage: None,
                            wakatime_compatible_seconds: None,
                            queue_owner_id: None,
                        },
                        Some(error.to_string()),
                        Some((
                            DeliveryFailureKind::from_error(&error),
                            http_status_of(&error),
                        )),
                    ),
                };
            let queue = Queue::open()?;
            let queue_scope = api_client.queue_scope();
            // Scoped to this origin + credential: another account's or server's
            // refusal must never describe this one (and a pre-scope record never does).
            let delivery_record = api_client.delivery_failure();
            let delivery_failure = delivery_record.clone().map(delivery_failure_json);
            let queued_segments =
                queue.queued_segments_for_day_scoped(timezone.as_deref(), &queue_scope)?;
            let queued_heartbeats = queue.len_scoped(&queue_scope).unwrap_or(0);
            // Rows under another credential/origin that this scope cannot deliver.
            // Never deleted: a same-account proof rebinds them (API-key rotation).
            let orphaned_heartbeats = queue.orphaned_len(&queue_scope).unwrap_or(0);
            // Rows a flush would pick up right now: the rest are waiting on a retry
            // backoff, which is a different answer to "why is nothing being sent".
            let eligible_heartbeats = queue.eligible_len_scoped(&queue_scope).unwrap_or(0);
            let queued_seconds = union_activity_seconds(&queued_segments);
            let queued_active_segments = queued_segments
                .iter()
                .filter(|segment| is_strict_active_source(segment.source.as_deref()))
                .cloned()
                .collect::<Vec<_>>();
            let queued_active_seconds = union_activity_seconds(&queued_active_segments);
            let active_confirmed_seconds = snapshot
                .active_seconds
                .filter(|_| snapshot.active_coverage.as_deref() == Some("measured"));
            let active_primary = active_confirmed_seconds.is_some();
            let confirmed_seconds = active_confirmed_seconds
                .or(snapshot.confirmed_seconds)
                .unwrap_or(snapshot.total_seconds);
            snapshot.confirmed_seconds = Some(confirmed_seconds);
            let displayed_queued_seconds = if active_primary {
                queued_active_seconds
            } else {
                queued_seconds
            };
            snapshot.queued_seconds = displayed_queued_seconds;
            if active_primary {
                // The server's raw Active intervals and local queued Active intervals
                // are unioned together. This handles both offline activity and the
                // crash window after an accepted response but before local deletion.
                snapshot.total_seconds =
                    active_seconds_with_queued(&snapshot.active_intervals, &queued_active_segments);
            } else if !snapshot.covered_intervals.is_empty() {
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
                "queue_count": queued_heartbeats,
            });
            if snapshot.agent_health.is_none() {
                snapshot.agent_health = Some(agent_health);
            }
            let connection = today_connection(probe_failure, delivery_record.as_ref());
            if json {
                println!(
                    "{}",
                    serde_json::to_string(&serde_json::json!({
                    "confirmed_seconds": confirmed_seconds,
                        "queued_seconds": displayed_queued_seconds,
                        "total_seconds": snapshot.total_seconds,
                        "human_readable": snapshot.human_readable,
                        "heartbeat_count": snapshot.heartbeat_count,
                        "last_heartbeat_at": snapshot.last_heartbeat_at,
                    "covered_intervals": snapshot.covered_intervals,
                    "active_intervals": snapshot.active_intervals,
                    "last_increment_seconds": snapshot.last_increment_seconds,
                    "last_increment_source": snapshot.last_increment_source,
                    "discarded_seconds": snapshot.discarded_seconds,
                    "active_seconds": snapshot.active_seconds,
                    "active_coverage": snapshot.active_coverage,
                    "wakatime_compatible_seconds": snapshot.wakatime_compatible_seconds,
                    "timezone": snapshot.timezone,
                    "agent_health": snapshot.agent_health,
                    "error": server_error,
                    // Depth, not just today's seconds: a backlog rejected yesterday is
                    // still a backlog, and `queued_seconds` scoped to today reports 0 for
                    // it — which is exactly how a day and a half of refused heartbeats
                    // stayed invisible.
                    "queued_heartbeats": queued_heartbeats,
                    "queued_active_seconds": queued_active_seconds,
                    "delivery_failure": delivery_failure,
                    // Typed state for editor clients. Queue depth/seconds are reported
                    // separately and never decide whether the server is reachable.
                    "connection": connection,
                    "queue": {
                        "depth": queued_heartbeats,
                        "seconds_today": displayed_queued_seconds,
                        "eligible_now": eligible_heartbeats,
                        "orphaned": orphaned_heartbeats,
                    },
                    "orphaned_queued_heartbeats": orphaned_heartbeats,
                    }))?
                );
            } else {
                if let Some(error) = server_error {
                    println!("Server error: {error}");
                }
                println!("Today: {}", snapshot.human_readable);
                if let Some(state) = connection["state"].as_str() {
                    println!("Connection: {state}");
                }
                println!("Total seconds: {}", snapshot.total_seconds);
                println!("Confirmed seconds: {}", confirmed_seconds);
                println!("Queued seconds: {}", displayed_queued_seconds);
                println!("Heartbeats: {}", snapshot.heartbeat_count);
                // The whole point of the lines below: an expired entitlement and a broken
                // hook look identical from the dashboard. Say which one it is.
                if queued_heartbeats > 0 {
                    println!(
                        "Queued heartbeats: {queued_heartbeats} (not yet accepted by the server)"
                    );
                }
                if let Some(failure) = &delivery_record {
                    // Only a server refusal is "REFUSED"; older editor builds map that
                    // word to "subscription required", so an outage must not use it.
                    let label = match failure.kind.as_str() {
                        "network" => "OFFLINE",
                        "server_error" => "RETRYING",
                        _ => "REFUSED",
                    };
                    println!(
                        "Delivery: {label} - {}",
                        failure.detail.as_deref().unwrap_or(&failure.message_code)
                    );
                    println!(
                        "  No heartbeat accepted since {}. Queued activity stays local until one is.",
                        chrono::DateTime::from_timestamp(failure.recorded_at, 0)
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
                Err(error) => {
                    let (status, reachable) = verify_outcome(&error);
                    let detail = match &error {
                        AppError::Auth(message) | AppError::HttpStatus { message, .. } => {
                            message.clone()
                        }
                        AppError::Http(inner) => inner.to_string(),
                        other => other.to_string(),
                    };
                    (status, false, reachable, Some(detail))
                }
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
            AiAction::Topology { root, json } => print_ai_topology(root.as_deref(), json)?,
            AiAction::Capabilities { json } => print_ai_capabilities(json)?,
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
                    false,
                    Some(Instant::now() + Duration::from_secs(60)),
                )
                .await?
            }
            AiAction::Repair {
                agent,
                transcript,
                from,
                to,
                apply,
                dry_run,
                json,
            } => {
                if apply && dry_run {
                    return Err("choose exactly one of --dry-run or --apply".into());
                }
                if transcript.is_some() && agent.is_none() {
                    return Err("--transcript requires --agent".into());
                }
                run_ai_identity_repair(
                    &config,
                    &api_client,
                    agent.as_deref(),
                    transcript.as_deref(),
                    from.as_deref(),
                    to.as_deref(),
                    apply,
                    json,
                )
                .await?
            }
            AiAction::RepairMeasurements {
                from,
                to,
                timezone,
                agent,
                transcript,
                json,
            } => {
                if transcript.is_some() && agent.is_none() {
                    return Err("--transcript requires --agent".into());
                }
                run_ai_measurement_repair_preview(
                    &config,
                    &api_client,
                    &from,
                    &to,
                    &timezone,
                    agent.as_deref(),
                    transcript.as_deref(),
                    json,
                )
                .await?
            }
        },
        Commands::Broker { action } => match action {
            BrokerAction::Run { .. } => {
                // Keep the old command as a compatibility entry point for stale
                // service manifests, but make it a bounded one-shot sync and remove
                // the manifest first. This prevents an upgraded LaunchAgent from
                // bringing the daemon back.
                eprintln!(
                    "Warning: `wakaclock broker run` is deprecated; using one-shot sync and removing the legacy service."
                );
                let _ = agent_service::uninstall();
                run_bounded_ai_sync(&config, &api_client).await;
            }
            BrokerAction::Install { json } => {
                // `install` is retained only as a migration command.  It removes
                // a legacy service and never creates a replacement.
                let report = agent_service::uninstall().map_err(io::Error::other)?;
                broker::cleanup_discovery();
                print_broker_report(&report, json, broker_status_json()?);
            }
            BrokerAction::Uninstall { json } => {
                let report = agent_service::uninstall().map_err(io::Error::other)?;
                broker::cleanup_discovery();
                print_broker_report(&report, json, broker_status_json()?);
            }
            BrokerAction::Start { json } => {
                let report = agent_service::uninstall().map_err(io::Error::other)?;
                broker::cleanup_discovery();
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
                // The local HTTP broker and bearer token are retired. Keep the
                // command for old scripts, but do not create or rotate credentials.
                if json {
                    println!(
                        "{}",
                        serde_json::json!({
                            "rotated": false,
                            "deprecated": true,
                            "runtime_mode": "on_demand",
                        })
                    );
                } else {
                    println!("Local broker tokens are retired; on-demand CLI mode remains active.");
                }
            }
            BrokerAction::EditorObserve { json } => {
                let status =
                    broker::submit_editor_observation_from_stdin(&config, &api_client).await?;
                if json {
                    println!("{}", serde_json::to_string(&status)?);
                } else {
                    println!("Editor observation: {}", status.status);
                }
            }
            BrokerAction::EditorObservationStatus {
                observation_id,
                json,
            } => {
                let status = broker::editor_observation_status_for_cli(&observation_id).await?;
                if json {
                    println!("{}", serde_json::to_string(&status)?);
                } else {
                    println!("Editor observation: {}", status.status);
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
                AgentAction::Run { .. } => {
                    eprintln!(
                        "Warning: `wakaclock agent run` is deprecated; using one-shot sync and removing the legacy service."
                    );
                    let _ = agent_service::uninstall();
                    run_bounded_ai_sync(&config, &api_client).await;
                }
                AgentAction::Install { json } => {
                    let report = agent_service::uninstall().map_err(io::Error::other)?;
                    broker::cleanup_discovery();
                    print_agent_report(&report, json, queue_count());
                }
                AgentAction::Uninstall { json } => {
                    let report = agent_service::uninstall().map_err(io::Error::other)?;
                    broker::cleanup_discovery();
                    print_agent_report(&report, json, queue_count());
                }
                AgentAction::Start { json } => {
                    let report = agent_service::uninstall().map_err(io::Error::other)?;
                    broker::cleanup_discovery();
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
                "runtime_mode": "on_demand",
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
        println!("Runtime mode: on_demand (no background collector)");
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
        status.insert(
            "legacy_service_present".to_string(),
            serde_json::Value::Bool(report.installed || report.running),
        );
        status.insert(
            "runtime_mode".to_string(),
            serde_json::Value::String("on_demand".to_string()),
        );
        println!("{}", serde_json::Value::Object(status));
    } else {
        println!("Platform: {}", report.platform);
        println!("Runtime mode: on_demand (no background collector)");
        println!("Legacy service installed: {}", report.installed);
        println!("Legacy service running: {}", report.running);
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

/// Keep machine-readable sync deferrals stable and bounded. The detailed error
/// remains in `last_error` for local troubleshooting, while consumers can switch
/// on this small enum without parsing transport text.
fn sync_deferred_reason(
    error: Option<&str>,
    timed_out: bool,
    pending: usize,
    conflicts: usize,
) -> Option<&'static str> {
    if timed_out {
        return Some("deadline_exceeded");
    }
    let Some(error) = error else {
        return if pending > 0 {
            Some("backoff")
        } else if conflicts > 0 {
            // Stable-ID payload conflicts are quarantined locally rather than
            // retried. Keep the public reason enum backwards-compatible while
            // exposing the precise disposition in `last_error` and the
            // `unresolved_conflicts` counter.
            Some("server")
        } else {
            None
        };
    };
    if error == "already_running" {
        return Some("already_running");
    }
    if error == "deadline_exceeded" {
        return Some("deadline_exceeded");
    }
    let lower = error.to_ascii_lowercase();
    if lower.contains("sqlite") || lower.contains("database is locked") {
        return Some("sqlite_busy");
    }
    if lower.contains("unsupported") {
        return Some("unsupported_adapter");
    }
    if lower.contains("401")
        || lower.contains("402")
        || lower.contains("credential")
        || lower.contains("api key")
    {
        return Some("auth");
    }
    if lower.contains("429")
        || lower.contains("500")
        || lower.contains("502")
        || lower.contains("503")
        || lower.contains("504")
        || lower.contains("timeout")
        || lower.contains("network")
        || lower.contains("connect")
    {
        return Some("server");
    }
    Some("server")
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

fn sort_transcript_paths_newest_first(paths: &mut [PathBuf]) {
    paths.sort_by(|left, right| {
        let left_modified = fs::metadata(left).and_then(|meta| meta.modified()).ok();
        let right_modified = fs::metadata(right).and_then(|meta| meta.modified()).ok();
        right_modified
            .cmp(&left_modified)
            .then_with(|| right.cmp(left))
    });
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
        let mut paths: Vec<PathBuf> = discoveries
            .iter()
            .filter_map(|result| match &result.state {
                DiscoveryState::TranscriptFound { path } => Some(path.clone()),
                _ => None,
            })
            .collect();
        sort_transcript_paths_newest_first(&mut paths);
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
        let freshness = diagnostics
            .adapters
            .iter()
            .find(|adapter| adapter.agent == id);
        reports.push(serde_json::json!({
            "agent": id,
            "status": description.clone(),
            "detected": freshness.and_then(|adapter| adapter.detected.value),
            "installed": freshness.and_then(|adapter| adapter.enabled.value),
            "hook_state": serde_json::Value::Null,
            "transcript_state": description,
            "runtime_health": freshness.map(|adapter| adapter.runtime_health),
            "verification": freshness.map(|adapter| adapter.verification),
            "last_evidence_at": freshness.and_then(|adapter| adapter.last_evidence_at),
            "exact_tuple": freshness.and_then(|adapter| adapter.certification.clone()),
            "blocker": freshness.and_then(|adapter| adapter.diagnostic_code.clone()),
        }));
    }
    // Kilo and Kimi are native-hook adapters rather than transcript parsers. Keep
    // them on the same status surface so an installed hook is not mistaken for an
    // unsupported adapter merely because there is no parser implementation.
    for native in native_adapter_doctor_entries(&context.home_dir) {
        let agent = native
            .get("agent")
            .and_then(serde_json::Value::as_str)
            .unwrap_or("unknown");
        let installed = native
            .get("installed")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false);
        let detected = native
            .get("native_executable")
            .is_some_and(|value| !value.is_null());
        let status = if installed {
            "native hook installed"
        } else if detected {
            "native executable detected; adapter not installed"
        } else {
            "not installed"
        };
        let freshness = diagnostics
            .adapters
            .iter()
            .find(|adapter| adapter.agent == agent);
        reports.push(serde_json::json!({
            "agent": agent,
            "status": status,
            "detected": freshness.and_then(|adapter| adapter.detected.value),
            "installed": freshness.and_then(|adapter| adapter.enabled.value),
            "hook_state": if installed { "installed" } else { "not_installed" },
            "transcript_state": "not_applicable",
            "runtime_health": freshness.map(|adapter| adapter.runtime_health),
            "verification": freshness.map(|adapter| adapter.verification),
            "last_evidence_at": freshness.and_then(|adapter| adapter.last_evidence_at),
            "exact_tuple": freshness.and_then(|adapter| adapter.certification.clone()),
            "blocker": freshness.and_then(|adapter| adapter.diagnostic_code.clone()),
        }));
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

/// Print a topology context for the workspace where a remote/container collector
/// is running. This is a local setup/diagnostic command: it does not upload the
/// context and deliberately omits the path that was used as key material.
fn print_ai_topology(root: Option<&Path>, json: bool) -> Result<(), Box<dyn Error>> {
    let root = root
        .map(Path::to_path_buf)
        .unwrap_or(std::env::current_dir()?);
    if !root.is_absolute() {
        return Err("topology root must be an absolute path".into());
    }
    let root = fs::canonicalize(&root).unwrap_or(root);
    let execution = execution_surface_from_env()?;
    let editor = editor_surface_from_env();
    let device_seed = topology_device_seed()?;
    let git_info = git::discover(&root.to_string_lossy());
    let workspace_key = git_info
        .as_ref()
        .map(|info| format!("git-workspace:{}", info.root.display()))
        .unwrap_or_else(|| format!("path:{}", root.display()));
    // A branch is mutable metadata, not a worktree identity. The root path (or
    // an explicit bridge key) remains stable when a user switches branches.
    let worktree_key = git_info
        .as_ref()
        .map(|info| format!("git-worktree:{}", info.root.display()))
        .unwrap_or_else(|| format!("path:{}", root.display()));
    let runtime_instance_key = (!matches!(execution, ExecutionSurface::Local))
        .then(|| std::env::var("WAKACLOCK_RUNTIME_INSTANCE_ID").ok())
        .flatten();
    let repository_id = std::env::var("WAKACLOCK_REPOSITORY_ID").ok();
    let session_id = std::env::var("WAKACLOCK_SESSION_ID")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("topology-session-{}", Uuid::new_v4().simple()));
    let context = TopologyIdentityInput {
        execution,
        editor,
        device_seed,
        workspace_key,
        worktree_key,
        session_id,
        runtime_instance_key,
        repository_id,
    }
    .build()?;

    if json {
        println!("{}", serde_json::to_string_pretty(&context)?);
    } else {
        println!("Execution surface: {:?}", context.execution);
        println!("Editor surface: {:?}", context.editor);
        println!("Device: {}", context.device_id);
        println!("Workspace: {}", context.workspace_id);
        println!("Worktree: {}", context.worktree_id);
        println!("Session: {}", context.session_id);
        println!(
            "Runtime instance: {}",
            context.runtime_instance_id.as_deref().unwrap_or("none")
        );
        println!(
            "Repository identity: {}",
            context.repository_id.as_deref().unwrap_or("unreported")
        );
    }
    Ok(())
}

fn print_ai_capabilities(json: bool) -> Result<(), Box<dyn Error>> {
    let catalog = editor_capability_catalog();
    if json {
        println!("{}", serde_json::to_string_pretty(&catalog)?);
        return Ok(());
    }
    for entry in catalog {
        println!(
            "{:?}: status={:?}, input={:?}, separate_ai_evidence={}",
            entry.editor,
            entry.status,
            entry.input_evidence,
            entry.has_separate_ai_evidence()
        );
        println!("  {}", entry.notes);
    }
    Ok(())
}

fn execution_surface_from_env() -> Result<ExecutionSurface, Box<dyn Error>> {
    if let Ok(value) = std::env::var("WAKACLOCK_EXECUTION_SURFACE") {
        match value.trim().to_ascii_lowercase().as_str() {
            "local" => return Ok(ExecutionSurface::Local),
            "ssh" | "ssh_remote" => return Ok(ExecutionSurface::SshRemote),
            "wsl" => return Ok(ExecutionSurface::Wsl),
            "container" | "dev_container" => return Ok(ExecutionSurface::DevContainer),
            "remote_extension" | "remote_extension_host" => {
                return Ok(ExecutionSurface::RemoteExtensionHost)
            }
            "cloud" | "cloud_job" => return Ok(ExecutionSurface::CloudJob),
            other => {
                return Err(
                    format!("unsupported WAKACLOCK_EXECUTION_SURFACE value: {other}").into(),
                )
            }
        }
    }
    if std::env::var_os("SSH_CONNECTION").is_some() {
        Ok(ExecutionSurface::SshRemote)
    } else if std::env::var_os("WSL_DISTRO_NAME").is_some() {
        Ok(ExecutionSurface::Wsl)
    } else if std::env::var_os("REMOTE_CONTAINERS").is_some()
        || std::env::var_os("DEV_CONTAINER").is_some()
    {
        Ok(ExecutionSurface::DevContainer)
    } else {
        Ok(ExecutionSurface::Local)
    }
}

fn editor_surface_from_env() -> EditorSurface {
    let value = std::env::var("WAKACLOCK_EDITOR")
        .ok()
        .or_else(|| std::env::var("TERM_PROGRAM").ok())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if value.contains("code") || value.contains("vscode") {
        EditorSurface::Vscode
    } else if value.contains("zed") {
        EditorSurface::Zed
    } else if value.contains("jetbrains") || value.contains("idea") || value.contains("pycharm") {
        EditorSurface::Jetbrains
    } else if value.contains("nvim") || value.contains("neovim") {
        EditorSurface::Neovim
    } else if value.contains("browser") {
        EditorSurface::Browser
    } else if value.is_empty() {
        EditorSurface::None
    } else {
        EditorSurface::Unknown
    }
}

fn topology_auto_enabled() -> bool {
    std::env::var("WAKACLOCK_TOPOLOGY_AUTO")
        .ok()
        .is_some_and(|value| {
            matches!(
                value.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes"
            )
        })
        || std::env::var_os("WAKACLOCK_EXECUTION_SURFACE").is_some()
        || std::env::var_os("SSH_CONNECTION").is_some()
        || std::env::var_os("WSL_DISTRO_NAME").is_some()
        || std::env::var_os("REMOTE_CONTAINERS").is_some()
        || std::env::var_os("DEV_CONTAINER").is_some()
}

/// Derive a topology only when the producer explicitly opts into the F7 path or
/// the runtime is unambiguously remote. Legacy local events remain wire-compatible
/// and do not suddenly acquire a new identity namespace.
fn infer_topology_for_event(
    project_root: Option<&Path>,
    session_id: Option<&str>,
) -> Result<Option<TopologyContext>, Box<dyn Error>> {
    if !topology_auto_enabled() {
        return Ok(None);
    }
    let root = project_root.ok_or(
        "topology-enabled AI event requires an absolute project_root for workspace mapping",
    )?;
    if !root.is_absolute() {
        return Err("topology project_root must be absolute".into());
    }
    let root = fs::canonicalize(root).unwrap_or_else(|_| root.to_path_buf());
    let execution = execution_surface_from_env()?;
    let git_info = git::discover(&root.to_string_lossy());
    let workspace_key = std::env::var("WAKACLOCK_TOPOLOGY_WORKSPACE_KEY")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            git_info
                .as_ref()
                .map(|info| format!("git-workspace:{}", info.root.display()))
        })
        .unwrap_or_else(|| format!("path:{}", root.display()));
    let worktree_key = std::env::var("WAKACLOCK_TOPOLOGY_WORKTREE_KEY")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| {
            git_info
                .as_ref()
                .map(|info| format!("git-worktree:{}", info.root.display()))
        })
        .unwrap_or_else(|| format!("path:{}", root.display()));
    let runtime_instance_key = if matches!(execution, ExecutionSurface::Local) {
        None
    } else {
        Some(
            std::env::var("WAKACLOCK_RUNTIME_INSTANCE_ID")
                .map_err(|_| "remote topology requires WAKACLOCK_RUNTIME_INSTANCE_ID")?,
        )
    };
    let session_id = session_id
        .filter(|value| !value.trim().is_empty())
        .map(str::to_string)
        .or_else(|| std::env::var("WAKACLOCK_SESSION_ID").ok())
        .unwrap_or_else(|| format!("process:{}", std::process::id()));
    let context = TopologyIdentityInput {
        execution,
        editor: editor_surface_from_env(),
        device_seed: topology_device_seed()?,
        workspace_key,
        worktree_key,
        session_id,
        runtime_instance_key,
        repository_id: std::env::var("WAKACLOCK_REPOSITORY_ID").ok(),
    }
    .build()?;
    Ok(Some(context))
}

fn handoff_source_sequence() -> Result<u64, Box<dyn Error>> {
    let value = std::env::var("WAKACLOCK_SOURCE_SEQUENCE")
        .ok()
        .map(|value| value.parse::<u64>())
        .transpose()
        .map_err(|_| "WAKACLOCK_SOURCE_SEQUENCE must be a positive integer")?
        .unwrap_or(1);
    if value == 0 {
        return Err("WAKACLOCK_SOURCE_SEQUENCE must be a positive integer".into());
    }
    Ok(value)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TopologySeedState {
    device_seed: String,
}

fn topology_device_seed() -> Result<String, Box<dyn Error>> {
    let path = dirs::home_dir()
        .ok_or("could not resolve home directory")?
        .join(".wakaclock")
        .join("topology-identity.json");
    if let Some(seed) = fs::read_to_string(&path)
        .ok()
        .and_then(|value| serde_json::from_str::<TopologySeedState>(&value).ok())
        .map(|state| state.device_seed)
        .filter(|value| !value.trim().is_empty() && value.len() <= 128)
    {
        return Ok(seed);
    }
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let lock_path = path.with_extension("lock");
    let _lock = AiSyncLock::try_acquire_at(&lock_path)?
        .ok_or("topology identity is being initialized by another process")?;
    // Re-read after taking the lock: another process may have created the file while
    // this caller was resolving the home directory.
    if let Some(seed) = fs::read_to_string(&path)
        .ok()
        .and_then(|value| serde_json::from_str::<TopologySeedState>(&value).ok())
        .map(|state| state.device_seed)
        .filter(|value| !value.trim().is_empty() && value.len() <= 128)
    {
        return Ok(seed);
    }
    let seed = format!("install-{}", Uuid::new_v4().simple());
    let temporary = path.with_extension(format!("tmp-{}", std::process::id()));
    fs::write(
        &temporary,
        serde_json::to_vec(&TopologySeedState {
            device_seed: seed.clone(),
        })?,
    )?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(temporary, path)?;
    Ok(seed)
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
                } else if broker_available && queue_available {
                    RuntimeHealth::Healthy
                } else {
                    RuntimeHealth::Degraded
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
            adapters.extend(native_adapter_freshness_entries(
                &context.home_dir,
                &observer,
                measured_at,
            ));
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
            let mut adapters = supported_ai_parsers()
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
                .collect::<Vec<_>>();
            // Even if transcript discovery is unavailable, native adapter setup is
            // still observable locally. Preserve those distinctions instead of
            // collapsing Kilo/Kimi into the parser-level unavailable result.
            if let Ok(context) = ai_discovery_context() {
                adapters.extend(native_adapter_freshness_entries(
                    &context.home_dir,
                    &observer,
                    measured_at,
                ));
            }
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
    } else if broker_available && queue_available {
        RuntimeHealth::Healthy
    } else {
        RuntimeHealth::Degraded
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
                context: None,
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
    // Diagnostics show this scope's failure first; a record migrated from the
    // pre-scope file is still reported, but labelled so it is never read as the
    // current server/account's state.
    let last_delivery_failure = ApiClient::new(config.clone()).ok().and_then(|client| {
        client
            .delivery_failure()
            .map(|failure| (failure, "current"))
            .or_else(|| {
                client
                    .legacy_unscoped_delivery_failure()
                    .map(|failure| (failure, "legacy_unscoped"))
            })
            .map(|(failure, scope)| {
                let mut value = delivery_failure_json(failure);
                if let Some(object) = value.as_object_mut() {
                    object.insert("scope".to_string(), serde_json::json!(scope));
                }
                value
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
            "  LEGACY SERVICE: the installed manifest runs the old `agent run` alias — run `wakaclock broker uninstall` to remove it"
        );
    }
    if stale_service_binary {
        println!(
            "  LEGACY SERVICE: the installed manifest points at an old `wakaclock` binary — run `wakaclock broker uninstall` to remove it"
        );
    }
    println!("== Runtime ==");
    println!("  mode=on_demand (no background collector)");
    println!("== Legacy broker service ==");
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
        "runtime_mode",
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
        "runtime_mode": "on_demand",
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

/// Convert the metadata-only native adapter probe into the typed diagnostics
/// contract. Kilo and Kimi currently have no transcript parser, so their
/// evidence timestamp intentionally stays empty until a native hook records an
/// event in the sidecar. Installation/detection state is still useful and must
/// not be reported as a fake zero or as parser failure.
fn native_adapter_freshness_entries(
    home_dir: &Path,
    observer: &ObserverConfig,
    measured_at: chrono::DateTime<chrono::Utc>,
) -> Vec<AdapterFreshnessV2> {
    native_adapter_doctor_entries(home_dir)
        .into_iter()
        .filter_map(|value| {
            let agent = value.get("agent")?.as_str()?.to_string();
            let detected = value
                .get("native_executable")
                .is_some_and(|entry| !entry.is_null());
            let installed = value
                .get("installed")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            let verification = match value
                .get("verification_status")
                .and_then(serde_json::Value::as_str)
            {
                Some("verified") => VerificationStatus::Verified,
                // The diagnostics wire enum predates the registry's distinct
                // `unverified` label; keep that distinction in `diagnostic_code`
                // while mapping the lifecycle value to the conservative scaffold
                // state for backwards-compatible consumers.
                Some("unverified") => VerificationStatus::Scaffold,
                _ => VerificationStatus::Scaffold,
            };
            let diagnostic_code = if !detected {
                Some("native_executable_missing".to_string())
            } else if !installed {
                Some("not_installed".to_string())
            } else {
                Some("native_hook_only".to_string())
            };
            let runtime_health = if !observer.enabled {
                RuntimeHealth::Disabled
            } else if !detected {
                RuntimeHealth::Unavailable
            } else if !installed {
                RuntimeHealth::Degraded
            } else {
                RuntimeHealth::Idle
            };
            Some(AdapterFreshnessV2 {
                agent: agent.clone(),
                availability: MeasurementAvailability::Available,
                detected: DiagnosticMeasurement::available(detected, measured_at),
                enabled: DiagnosticMeasurement::available(observer.enabled, measured_at),
                runtime_health,
                verification,
                certification: certification_tuple_for_agent(&agent),
                certificate_id: None,
                certification_status: None,
                last_evidence_at: None,
                diagnostic_code,
            })
        })
        .collect()
}

fn resolve_named_command(names: &[String]) -> Option<PathBuf> {
    // Prefer PATH, but also recognize vendor-standard per-user install
    // locations.  Kimi's official checksum-verifying installer intentionally
    // keeps `kimi` under ~/.kimi-code/bin instead of modifying the caller's
    // shell profile.  Doctor/setup run from VS Code or a hook therefore may
    // not inherit that directory in PATH.  This is detection-only: we never
    // execute an untrusted path or add it to PATH globally.
    let path_candidates: Vec<PathBuf> = std::env::var_os("PATH")
        .into_iter()
        .flat_map(|path| std::env::split_paths(&path).collect::<Vec<_>>())
        .flat_map(|directory| names.iter().map(move |name| directory.join(name)))
        .collect();
    let home_candidates: Vec<PathBuf> = std::env::var_os("HOME")
        .into_iter()
        .flat_map(|home| {
            let home = PathBuf::from(home);
            names.iter().flat_map(move |name| {
                let mut candidates = Vec::new();
                if name == "kimi" {
                    candidates.push(home.join(".kimi-code/bin/kimi"));
                    candidates.push(home.join(".kimi/bin/kimi"));
                    candidates.push(home.join(".local/bin/kimi"));
                }
                candidates
            })
        })
        .collect();
    path_candidates
        .into_iter()
        .chain(home_candidates)
        .find(|candidate| candidate.is_file())
}

#[derive(Debug, Serialize)]
struct AiIdentityRepairCandidateReport {
    event_id: String,
    agent: Option<String>,
    provider: Option<String>,
    model: Option<String>,
    identity_status: String,
    identity_reason: Option<String>,
    identity_source: Option<String>,
    session_id: Option<String>,
    turn_id: Option<String>,
    identity_message_id: Option<String>,
    tool_event_id: Option<String>,
    occurred_at: chrono::DateTime<chrono::Utc>,
    lines_added: Option<u32>,
    lines_deleted: Option<u32>,
    has_reference: bool,
}

#[derive(Debug, Serialize)]
struct AiIdentityRepairCliReport {
    repair_run_id: String,
    dry_run: bool,
    apply_requested: bool,
    agent: Option<String>,
    from: Option<String>,
    to: Option<String>,
    parser_versions: Vec<String>,
    transcripts_scanned: Vec<String>,
    event_count: u64,
    heartbeat_count: u64,
    lines_added: u64,
    lines_deleted: u64,
    line_measurement_missing_events: u64,
    confirmed_candidates: u64,
    candidates_with_reference: u64,
    status_counts: BTreeMap<String, u64>,
    reason_counts: BTreeMap<String, u64>,
    truncated_candidates: bool,
    warnings: Vec<String>,
    candidates: Vec<AiIdentityRepairCandidateReport>,
    remote: Option<AiIdentityRepairReport>,
}

/// Parse a date/range bound without consulting server time. Date-only bounds are
/// UTC calendar dates; the upper bound is exclusive so `--to 2026-09-11`
/// includes that entire day.
fn parse_identity_repair_bound(
    value: Option<&str>,
    end_bound: bool,
) -> Result<Option<chrono::DateTime<chrono::Utc>>, Box<dyn Error>> {
    let Some(raw) = value.map(str::trim).filter(|value| !value.is_empty()) else {
        return Ok(None);
    };
    if let Ok(timestamp) = chrono::DateTime::parse_from_rfc3339(raw) {
        return Ok(Some(timestamp.with_timezone(&chrono::Utc)));
    }
    let date = chrono::NaiveDate::parse_from_str(raw, "%Y-%m-%d")
        .map_err(|_| format!("invalid repair bound `{raw}`; use RFC3339 or YYYY-MM-DD"))?;
    let date = if end_bound {
        date.checked_add_signed(chrono::Duration::days(1))
            .ok_or("repair end date is outside the supported range")?
    } else {
        date
    };
    Ok(Some(
        date.and_hms_opt(0, 0, 0)
            .ok_or("repair bound could not be converted to midnight")?
            .and_utc(),
    ))
}

/// Read local transcripts, produce an evidence report, and optionally send only
/// complete identity tuples to the metadata-only repair endpoint.  The parser is
/// always seeded at byte zero and walked to EOF, so this command is independent of
/// the live sync cursor and can safely be repeated after a restart.
async fn run_ai_identity_repair(
    _config: &Config,
    api_client: &ApiClient,
    agent_filter: Option<&str>,
    transcript_override: Option<&Path>,
    from: Option<&str>,
    to: Option<&str>,
    apply: bool,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    let normalized_agent = agent_filter.map(normalize_agent_id);
    if let Some(agent) = normalized_agent.as_deref() {
        if !matches!(agent, "codex" | "claude-code" | "gemini-cli") {
            return Err(format!("unsupported AI repair agent: {agent}").into());
        }
    }
    let from_bound = parse_identity_repair_bound(from, false)?;
    let to_bound = parse_identity_repair_bound(to, true)?;
    if let (Some(start), Some(end)) = (from_bound, to_bound) {
        if start >= end {
            return Err("repair --from must be earlier than --to".into());
        }
    }

    let context = ai_discovery_context()?;
    // Event ids are opaque to the server and some adapters scope/reuse them per
    // session. Keep the local repair inventory keyed by the stable session scope
    // as well, otherwise one transcript could silently replace another before the
    // metadata-only correction is sent.
    let mut events_by_id = BTreeMap::<(String, String, String), AiEditEvent>::new();
    let mut parser_versions = Vec::new();
    let mut transcripts_scanned = Vec::new();
    let mut warnings = Vec::new();

    for (id, parser) in supported_ai_parsers() {
        if normalized_agent.as_deref().is_some_and(|agent| agent != id) {
            continue;
        }
        parser_versions.push(format!("{id}@{}", env!("CARGO_PKG_VERSION")));
        let paths = if let Some(path) = transcript_override {
            let canonical = path.canonicalize()?;
            if !canonical.is_file() {
                return Err(format!("transcript is not a file: {}", canonical.display()).into());
            }
            vec![canonical]
        } else {
            parser
                .discover_sources(&context)
                .into_iter()
                .filter_map(|result| match result.state {
                    DiscoveryState::TranscriptFound { path } => Some(path),
                    _ => None,
                })
                .collect::<Vec<_>>()
        };

        for path in paths {
            let path = path.canonicalize().unwrap_or(path);
            transcripts_scanned.push(path.to_string_lossy().into_owned());
            let file_identity = transcript_identity(&path);
            let mut cursor = ParserCursor {
                source_path: path.to_string_lossy().into_owned(),
                file_identity,
                byte_offset: 0,
                last_record_id: None,
                last_record_time: None,
                context: None,
            };
            let file_len = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
            let mut iterations = 0usize;
            loop {
                iterations += 1;
                if iterations > 10_000 {
                    warnings.push(format!(
                        "{id}: stopped after 10,000 parser batches for {}",
                        path.display()
                    ));
                    break;
                }
                let previous_offset = cursor.byte_offset;
                let batch = parser
                    .parse_since(&ParseContext::default(), Some(&cursor))
                    .map_err(|error| format!("{id}: {}: {error}", path.display()))?;
                for event in batch.events {
                    if from_bound.is_some_and(|start| event.occurred_at < start)
                        || to_bound.is_some_and(|end| event.occurred_at >= end)
                    {
                        continue;
                    }
                    let event_key = (
                        event.agent.clone(),
                        event.session_id.clone().unwrap_or_default(),
                        event.event_id.clone(),
                    );
                    events_by_id.entry(event_key).or_insert(event);
                }
                if !batch.warnings.is_empty() {
                    warnings.extend(
                        batch
                            .warnings
                            .into_iter()
                            .map(|warning| format!("{id}: {}", warning.message)),
                    );
                }
                let next_cursor = batch.next_cursor;
                let pending = next_cursor
                    .context
                    .as_ref()
                    .is_some_and(|context| !context.pending_calls.is_empty());
                let progressed = next_cursor.byte_offset > previous_offset
                    || next_cursor.context != cursor.context;
                cursor = next_cursor;
                if cursor.byte_offset >= file_len && !pending {
                    break;
                }
                // An incomplete call at EOF deliberately rewinds to its start. There
                // is no more input to resolve in this pass, so leave it unresolved.
                if !progressed {
                    break;
                }
            }
        }
    }

    transcripts_scanned.sort();
    transcripts_scanned.dedup();
    parser_versions.sort();
    parser_versions.dedup();

    let mut status_counts = BTreeMap::<String, u64>::new();
    let mut reason_counts = BTreeMap::<String, u64>::new();
    let mut lines_added = 0u64;
    let mut lines_deleted = 0u64;
    let mut candidates_with_reference = 0u64;
    let mut confirmed_candidates = 0u64;
    let mut corrections = Vec::new();
    let mut candidate_reports = Vec::new();
    const MAX_REPORTED_CANDIDATES: usize = 10_000;

    for event in events_by_id.values() {
        let mut identity = resolve_identity(
            Some(&event.agent),
            &[event.provider.as_deref()],
            &[event.model.as_deref()],
            Some(event.source.as_str()),
            Some(event.confidence.as_str()),
        );
        // The parser may have seen contradictory model/provider records for the
        // same tool call. Preserve that decision during repair; recomputing from
        // the already-collapsed tuple must never turn a conflict into a guessed
        // confirmed model.
        if event
            .identity_status
            .as_deref()
            .is_some_and(|status| status.trim().eq_ignore_ascii_case("conflict"))
        {
            identity.status = IdentityStatus::Conflict;
            identity.reason = Some(REASON_CONFLICTING_EVIDENCE);
            identity.provider = None;
            identity.model = None;
            identity.source = event.identity_source.clone().or(identity.source);
        } else if identity.status != IdentityStatus::Confirmed
            && event
                .identity_reason
                .as_deref()
                .is_some_and(|reason| reason.eq_ignore_ascii_case(REASON_INTERNAL_MARKER))
        {
            // The parser deliberately discarded an internal/synthetic model
            // label. Preserve that diagnosis in the dry-run baseline instead of
            // collapsing it into the less specific `missing_model` reason.
            identity.reason = Some(REASON_INTERNAL_MARKER);
            identity.source = event.identity_source.clone().or(identity.source);
        }
        let status = identity.status.as_str().to_string();
        *status_counts.entry(status.clone()).or_default() += 1;
        if let Some(reason) = identity.reason {
            *reason_counts.entry(reason.to_string()).or_default() += 1;
        }
        let has_reference = event.session_id.is_some()
            || event.turn_id.is_some()
            || event.identity_message_id.is_some()
            || event.tool_event_id.is_some();
        if has_reference {
            candidates_with_reference += 1;
        }
        let added = u64::from(event.lines_added.unwrap_or(0));
        let deleted = u64::from(event.lines_deleted.unwrap_or(0));
        lines_added = lines_added.saturating_add(added);
        lines_deleted = lines_deleted.saturating_add(deleted);

        if identity.status == IdentityStatus::Confirmed
            && identity.agent.as_deref().is_some_and(is_known_agent_id)
        {
            if let (Some(agent), Some(provider), Some(model), Some(source)) = (
                identity.agent.clone(),
                identity.provider.clone(),
                identity.model.clone(),
                identity.source.clone(),
            ) {
                confirmed_candidates += 1;
                corrections.push(AiIdentityCorrection {
                    ai_event_id: event.event_id.clone(),
                    agent,
                    provider,
                    model,
                    source,
                    session_id: event.session_id.clone(),
                    turn_id: event.turn_id.clone(),
                    message_id: event.identity_message_id.clone(),
                });
            }
        }

        if candidate_reports.len() < MAX_REPORTED_CANDIDATES {
            candidate_reports.push(AiIdentityRepairCandidateReport {
                event_id: event.event_id.clone(),
                agent: identity.agent,
                provider: identity.provider,
                model: identity.model,
                identity_status: status,
                identity_reason: identity.reason.map(str::to_string),
                identity_source: identity.source,
                session_id: event.session_id.clone(),
                turn_id: event.turn_id.clone(),
                identity_message_id: event.identity_message_id.clone(),
                tool_event_id: event.tool_event_id.clone(),
                occurred_at: event.occurred_at,
                lines_added: event.lines_added,
                lines_deleted: event.lines_deleted,
                has_reference,
            });
        }
    }

    let repair_run_id = Uuid::new_v4().to_string();
    let remote = if apply && !corrections.is_empty() {
        Some(
            api_client
                .repair_ai_identity(&AiIdentityRepairRequest {
                    repair_run_id: repair_run_id.clone(),
                    corrections,
                })
                .await?,
        )
    } else {
        None
    };
    let report = AiIdentityRepairCliReport {
        repair_run_id,
        dry_run: !apply,
        apply_requested: apply,
        agent: normalized_agent,
        from: from.map(str::to_string),
        to: to.map(str::to_string),
        parser_versions,
        transcripts_scanned,
        event_count: events_by_id.len() as u64,
        heartbeat_count: events_by_id.len() as u64,
        lines_added,
        lines_deleted,
        line_measurement_missing_events: events_by_id
            .values()
            .filter(|event| event.lines_added.is_none() || event.lines_deleted.is_none())
            .count() as u64,
        confirmed_candidates,
        candidates_with_reference,
        status_counts,
        reason_counts,
        truncated_candidates: events_by_id.len() > MAX_REPORTED_CANDIDATES,
        warnings,
        candidates: candidate_reports,
        remote,
    };

    if json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        println!("Repair run: {}", report.repair_run_id);
        println!("Mode: {}", if report.dry_run { "dry-run" } else { "apply" });
        println!("Transcripts scanned: {}", report.transcripts_scanned.len());
        println!("Events / heartbeats observed: {}", report.event_count);
        println!(
            "Lines added / deleted: {} / {}",
            report.lines_added, report.lines_deleted
        );
        println!(
            "Events with unavailable line measurements: {}",
            report.line_measurement_missing_events
        );
        println!(
            "Confirmed identity candidates: {}",
            report.confirmed_candidates
        );
        println!(
            "Candidates with stable references: {}",
            report.candidates_with_reference
        );
        println!("Identity statuses: {:?}", report.status_counts);
        println!("Identity reasons: {:?}", report.reason_counts);
        if let Some(remote) = &report.remote {
            println!(
                "Server correction: {} corrected, {} unchanged, {} unresolved, {} conflicts",
                remote.corrected, remote.unchanged, remote.unresolved, remote.conflicts
            );
            println!(
                "Preserved heartbeats / lines: {} / +{} -{}",
                remote.preserved_heartbeats,
                remote.preserved_lines_added,
                remote.preserved_lines_deleted
            );
        } else if report.apply_requested {
            println!("Server correction: no complete candidates to apply");
        } else {
            println!("No data changed. Re-run with --apply after reviewing this report.");
        }
        if !report.warnings.is_empty() {
            println!("Warnings: {}", report.warnings.len());
        }
    }
    Ok(())
}

/// Reparse transcript edits on this machine and send only line counts, outcomes and
/// opaque references. No transcript path, prompt, response, diff or source text is
/// included in the preview request. The server matches references to rows owned by
/// the authenticated account; the resulting job still requires a session confirmation.
async fn run_ai_measurement_repair_preview(
    _config: &Config,
    api_client: &ApiClient,
    from: &str,
    to: &str,
    timezone: &str,
    agent_filter: Option<&str>,
    transcript_override: Option<&Path>,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    let (start_date, end_date, start_epoch, end_epoch, timezone) =
        measurement_repair_range(from, to, timezone)?;
    let normalized_agent = agent_filter.map(normalize_agent_id);
    if let Some(agent) = normalized_agent.as_deref() {
        if !supported_ai_parsers()
            .iter()
            .any(|(parser_id, _)| *parser_id == agent)
        {
            return Err(format!("unsupported measurement repair agent: {agent}").into());
        }
    }

    let context = ai_discovery_context()?;
    let mut events_by_id = BTreeMap::<(String, String, String), AiEditEvent>::new();
    let mut parser_versions = Vec::new();
    let mut transcripts_scanned = 0usize;
    let mut warning_count = 0usize;
    for (id, parser) in supported_ai_parsers() {
        if normalized_agent.as_deref().is_some_and(|agent| agent != id) {
            continue;
        }
        parser_versions.push(format!("{id}@{}", env!("CARGO_PKG_VERSION")));
        let paths = if let Some(path) = transcript_override {
            let canonical = path.canonicalize()?;
            if !canonical.is_file() {
                return Err(format!("transcript is not a file: {}", canonical.display()).into());
            }
            vec![canonical]
        } else {
            parser
                .discover_sources(&context)
                .into_iter()
                .filter_map(|result| match result.state {
                    DiscoveryState::TranscriptFound { path } => Some(path),
                    _ => None,
                })
                .collect::<Vec<_>>()
        };

        for path in paths {
            transcripts_scanned += 1;
            let path = path.canonicalize().unwrap_or(path);
            let mut cursor = ParserCursor {
                source_path: path.to_string_lossy().into_owned(),
                file_identity: transcript_identity(&path),
                byte_offset: 0,
                last_record_id: None,
                last_record_time: None,
                context: None,
            };
            let file_len = fs::metadata(&path).map(|meta| meta.len()).unwrap_or(0);
            let mut iterations = 0usize;
            loop {
                iterations += 1;
                if iterations > 10_000 {
                    warning_count += 1;
                    break;
                }
                let previous_offset = cursor.byte_offset;
                let batch = parser
                    .parse_since(&ParseContext::default(), Some(&cursor))
                    .map_err(|error| format!("{id}: {}: {error}", path.display()))?;
                warning_count += batch.warnings.len();
                for event in batch.events {
                    let occurred_at = event.occurred_at.timestamp_millis() as f64 / 1000.0;
                    if occurred_at < start_epoch || occurred_at >= end_epoch {
                        continue;
                    }
                    let key = (
                        event.agent.clone(),
                        event.session_id.clone().unwrap_or_default(),
                        event.event_id.clone(),
                    );
                    events_by_id.entry(key).or_insert(event);
                }
                let next_cursor = batch.next_cursor;
                let pending = next_cursor
                    .context
                    .as_ref()
                    .is_some_and(|context| !context.pending_calls.is_empty());
                let progressed = next_cursor.byte_offset > previous_offset
                    || next_cursor.context != cursor.context;
                cursor = next_cursor;
                if cursor.byte_offset >= file_len && !pending {
                    break;
                }
                if !progressed {
                    break;
                }
            }
        }
    }

    if events_by_id.is_empty() {
        let report = serde_json::json!({
            "status": "no_local_operations",
            "from": start_date,
            "to": end_date,
            "timezone": timezone.to_string(),
            "transcripts_scanned": transcripts_scanned,
            "warnings": warning_count,
            "preview": null
        });
        if json {
            println!("{}", serde_json::to_string_pretty(&report)?);
        } else {
            println!("No local AI edit operations were found in the selected date range.");
            println!(
                "Transcripts scanned: {transcripts_scanned}; parser warnings: {warning_count}"
            );
        }
        return Ok(());
    }

    const MAX_REPAIR_CANDIDATES: usize = 1_000;
    if events_by_id.len() > MAX_REPAIR_CANDIDATES {
        return Err(format!(
            "{} local operations exceed the server preview limit of {MAX_REPAIR_CANDIDATES}; narrow the date range or select one --agent",
            events_by_id.len()
        )
        .into());
    }
    let candidates = events_by_id
        .values()
        .map(|event| {
            let (outcome, lines_added, lines_deleted) =
                match (event.lines_added, event.lines_deleted) {
                    (Some(added), Some(deleted)) => ("success", Some(added), Some(deleted)),
                    _ => ("unknown", None, None),
                };
            serde_json::json!({
                "repair_reference": measurement_repair_reference(event),
                "outcome": outcome,
                "lines_added": lines_added,
                "lines_deleted": lines_deleted,
            })
        })
        .collect::<Vec<_>>();
    let repair_id = Uuid::new_v4().to_string();
    let response = api_client
        .preview_measurement_repair(
            &repair_id,
            &start_date.to_string(),
            &end_date.to_string(),
            &timezone.to_string(),
            &candidates,
        )
        .await?;
    let preview = response.get("data").cloned().unwrap_or(response);
    let report = serde_json::json!({
        "status": "preview_created",
        "repair_id": repair_id,
        "from": start_date,
        "to": end_date,
        "timezone": timezone.to_string(),
        "transcripts_scanned": transcripts_scanned,
        "local_operations": candidates.len(),
        "parser_versions": parser_versions,
        "warnings": warning_count,
        "preview": preview,
        "confirmation": "Review and apply this preview in Trust Center. This CLI command does not apply corrections."
    });
    if json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        println!(
            "Measurement repair preview created: {}",
            report["repair_id"]
        );
        println!("Local operations: {}", report["local_operations"]);
        println!("Ready: {}", preview["ready"]);
        println!("Unresolved: {}", preview["unresolved"]);
        println!("Unchanged: {}", preview["unchanged"]);
        println!("Parser warnings: {warning_count}");
        println!("Review and apply the preview in the Trust Center.");
    }
    Ok(())
}

fn measurement_repair_range(
    from: &str,
    to: &str,
    timezone: &str,
) -> Result<(NaiveDate, NaiveDate, f64, f64, Tz), Box<dyn Error>> {
    let start = NaiveDate::parse_from_str(from, "%Y-%m-%d")
        .map_err(|_| "--from must be a calendar date in YYYY-MM-DD format")?;
    let end = NaiveDate::parse_from_str(to, "%Y-%m-%d")
        .map_err(|_| "--to must be a calendar date in YYYY-MM-DD format")?;
    if start > end {
        return Err("--from must not be after --to".into());
    }
    if (end - start).num_days() >= 90 {
        return Err("measurement repair ranges may include at most 90 calendar days".into());
    }
    let timezone: Tz = timezone
        .parse()
        .map_err(|_| format!("unknown IANA timezone: {timezone}"))?;
    let local_midnight = |date: NaiveDate| -> Result<chrono::DateTime<Utc>, Box<dyn Error>> {
        let local = date
            .and_hms_opt(0, 0, 0)
            .ok_or("calendar midnight is invalid")?;
        let zoned = timezone
            .from_local_datetime(&local)
            .earliest()
            .or_else(|| timezone.from_local_datetime(&local).latest())
            .ok_or("timezone has no offset at local midnight")?;
        Ok(zoned.with_timezone(&Utc))
    };
    let start_at = local_midnight(start)?;
    let end_at = local_midnight(end + ChronoDuration::days(1))?;
    Ok((
        start,
        end,
        start_at.timestamp_millis() as f64 / 1000.0,
        end_at.timestamp_millis() as f64 / 1000.0,
        timezone,
    ))
}

fn measurement_repair_reference(event: &AiEditEvent) -> String {
    let session = event.session_id.as_deref().unwrap_or_default();
    let operation = event.event_id.as_str();
    let entity = event.entity.to_string_lossy();
    let material = format!(
        "{}:{session}{}:{operation}{}:{entity}",
        session.len(),
        operation.len(),
        entity.len(),
    );
    format!("{:x}", Sha256::digest(material.as_bytes()))
}

#[cfg(test)]
mod measurement_repair_cli_tests {
    use super::*;

    #[test]
    fn repair_range_uses_inclusive_local_dates_and_dst_boundaries() {
        let (start, end, start_epoch, end_epoch, zone) =
            measurement_repair_range("2026-03-08", "2026-03-08", "America/New_York").unwrap();
        assert_eq!(start.to_string(), "2026-03-08");
        assert_eq!(end.to_string(), "2026-03-08");
        assert_eq!(zone.to_string(), "America/New_York");
        assert_eq!(end_epoch - start_epoch, 23.0 * 60.0 * 60.0);
    }

    #[test]
    fn repair_reference_is_fixed_length_and_does_not_expose_entity_path() {
        let event = AiEditEvent {
            event_id: "ai-event-1".to_string(),
            agent: "codex".to_string(),
            provider: None,
            model: None,
            session_id: Some("session-1".to_string()),
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            tool_event_id: None,
            producer_surface: None,
            occurred_at: Utc::now(),
            entity: PathBuf::from("/private/workspace/source.rs"),
            project_root: None,
            change_kind: wakaclock_core::broker::BrokerChangeKind::Modify,
            previous_entity: None,
            lines_added: Some(0),
            lines_deleted: Some(0),
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        };
        let reference = measurement_repair_reference(&event);
        assert_eq!(reference.len(), 64);
        assert!(!reference.contains("workspace"));
        assert!(!reference.contains("source.rs"));
    }
}

async fn run_ai_sync(
    config: &Config,
    api_client: &ApiClient,
    agent_filter: Option<&str>,
    dry_run: bool,
    verbose: bool,
    from_start: bool,
    transcript_override: Option<&Path>,
    lease_already_held: bool,
    deadline: Option<Instant>,
) -> Result<(), Box<dyn Error>> {
    if let Some(agent) = agent_filter {
        let supported = supported_ai_parsers()
            .iter()
            .any(|(parser_id, _)| *parser_id == agent);
        if !supported {
            return Err(
                format!("AI transcript sync is not supported for adapter `{agent}`").into(),
            );
        }
    }
    let _sync_lock = if dry_run || lease_already_held {
        None
    } else {
        match AiSyncLock::acquire()? {
            Some(lock) => Some(lock),
            None => {
                return Err("already_running".into());
            }
        }
    };
    let mut state = AiAttributionState::open()?;
    let context = ai_discovery_context()?;
    let mut first_delivery_error: Option<AppError> = None;
    let check_deadline = || -> Result<(), Box<dyn Error>> {
        if deadline.is_some_and(|limit| Instant::now() >= limit) {
            return Err("deadline_exceeded".into());
        }
        Ok(())
    };
    check_deadline()?;

    // Flush durable usage before discovering new transcript bytes. This makes a
    // restarted watcher drain an outage backlog first while still allowing the
    // scan below to enqueue newly parsed records if the broker remains down.
    if !dry_run {
        if let Some(error) = flush_pending_usage(&mut state, api_client, verbose).await? {
            first_delivery_error = Some(error);
        }
        check_deadline()?;
    }

    for (id, parser) in supported_ai_parsers() {
        check_deadline()?;
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
        sort_transcript_paths_newest_first(&mut transcript_paths);

        for transcript_path in transcript_paths {
            check_deadline()?;
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
                    context: None,
                },
            };

            // On first discovery, old transcripts are intentionally seeded at EOF. This
            // keeps a newly-enabled adapter from uploading an entire history; recent
            // files (and explicit --from-start) still replay normally.
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
            check_deadline()?;
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

            let candidate_keys: Vec<String> = batch
                .events
                .iter()
                .map(|event| scoped_storage_event_id(&event.event_id, event.session_id.as_deref()))
                .collect();
            let undelivered = state.filter_undelivered(&candidate_keys)?;
            let new_events: Vec<&AiEditEvent> = batch
                .events
                .iter()
                .filter(|event| {
                    undelivered.contains(&scoped_storage_event_id(
                        &event.event_id,
                        event.session_id.as_deref(),
                    ))
                })
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

            if !dry_run && !usage_records.is_empty() {
                // Persist before the network call and before the next transcript
                // rotation can hide the source bytes. INSERT is idempotent by the
                // provider event id and stores only the sanitised record.
                state.enqueue_pending_usage(&usage_records)?;
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
                    check_deadline()?;
                    let report =
                        submit_events_with_optional_handoff(config, api_client, &broker_events)
                            .await?;
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
                let submitted_event_ids: Vec<String> = submitted_events
                    .iter()
                    .map(|event| {
                        scoped_storage_event_id(&event.event_id, event.session_id.as_deref())
                    })
                    .collect();
                state.save_cursor_and_mark_delivered(
                    &cursor_key,
                    &batch.next_cursor,
                    &submitted_event_ids,
                )?;
            } else {
                // Advance a context checkpoint even when every parsed event was
                // already delivered. This keeps turn/provider metadata current
                // without creating another activity row.
                state.save_cursor(&cursor_key, &batch.next_cursor)?;
            }
            check_deadline()?;
        }
    }

    if !dry_run {
        if let Some(error) = flush_pending_usage(&mut state, api_client, verbose).await? {
            if first_delivery_error.is_none() {
                first_delivery_error = Some(error);
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

/// Run the complete WakaTime-style one-shot pass.  Transcript reconciliation is
/// only one part of a sync invocation: an offline hook may already have durable
/// inbox rows or queued heartbeats that need delivery even when no transcript byte
/// changed.  Drain both sides before and after parsing, while keeping the same
/// absolute deadline for the whole invocation.
async fn run_on_demand_sync(
    config: &Config,
    api_client: &ApiClient,
    agent_filter: Option<&str>,
    dry_run: bool,
    verbose: bool,
    from_start: bool,
    transcript_override: Option<&Path>,
    deadline: Instant,
) -> Result<(), Box<dyn Error>> {
    let check_deadline = || -> Result<(), Box<dyn Error>> {
        if Instant::now() >= deadline {
            return Err("deadline_exceeded".into());
        }
        Ok(())
    };
    let mut deferred_error: Option<&'static str> = None;
    // The lease covers the complete one-shot lifecycle. Previously the pre-scan
    // drain ran before `run_ai_sync` acquired its lock, so two CLI processes could
    // concurrently drain/parse/flush and the losing process still reported success.
    let _sync_lock = if dry_run {
        None
    } else {
        match AiSyncLock::acquire()? {
            Some(lock) => Some(lock),
            None => return Err("already_running".into()),
        }
    };

    if !dry_run {
        deferred_error = drain_on_demand_delivery(config, api_client, deadline, false).await?;
    }

    check_deadline()?;
    run_ai_sync(
        config,
        api_client,
        agent_filter,
        dry_run,
        verbose,
        from_start,
        transcript_override,
        true,
        Some(deadline),
    )
    .await?;

    if !dry_run {
        if let Some(error) = drain_on_demand_delivery(config, api_client, deadline, true).await? {
            deferred_error.get_or_insert(error);
        }
    }
    if let Some(error) = deferred_error {
        return Err(error.into());
    }
    Ok(())
}

/// Drain durable delivery in bounded batches. The pre-scan pass is intentionally
/// one batch so a large offline backlog cannot starve the active transcript; the
/// post-scan pass rotates inbox and heartbeat batches until they are empty, a retry
/// backoff/deferred observation is encountered, or the caller's deadline expires.
async fn drain_on_demand_delivery(
    config: &Config,
    api_client: &ApiClient,
    deadline: Instant,
    repeat_until_stable: bool,
) -> Result<Option<&'static str>, Box<dyn Error>> {
    let mut deferred_error: Option<&'static str> = None;
    loop {
        if Instant::now() >= deadline {
            return Err("deadline_exceeded".into());
        }
        let report = broker::process_pending(config, api_client, broker::MAX_BATCH_EVENTS).await?;
        if report.dead_lettered > 0 {
            deferred_error.get_or_insert("dead_lettered");
        }
        if Instant::now() >= deadline {
            return Err("deadline_exceeded".into());
        }
        let flush = api_client.flush_queue().await?;
        if flush.stopped_because.is_some() {
            // The detailed server response stays in the local delivery state. Do
            // not copy it into hook/debug output, where it could contain payload
            // material; the machine-readable status only needs the stable reason.
            deferred_error.get_or_insert("delivery_deferred");
        }

        let made_progress = report.processed > 0
            || report.retried > 0
            || report.dead_lettered > 0
            || flush.flushed > 0;
        if !repeat_until_stable
            || flush.stopped_because.is_some()
            || !made_progress
            || report.claimed == 0
        {
            break;
        }
    }
    Ok(deferred_error)
}

/// Drain the durable AI usage queue in deterministic, bounded batches. A successful
/// 200/202 acknowledgement deletes the pending rows and records delivery in one
/// SQLite transaction; a retryable refusal updates the timer, while a permanent
/// 4xx moves the metadata-only records to local dead-letter storage.
async fn flush_pending_usage(
    state: &mut AiAttributionState,
    api_client: &ApiClient,
    verbose: bool,
) -> Result<Option<AppError>, Box<dyn Error>> {
    let pending = state.pending_usage_due(chrono::Utc::now().timestamp())?;
    for batch in pending.chunks(2_000) {
        if let Some(error) = flush_pending_usage_batch(state, api_client, batch, verbose).await? {
            return Ok(Some(error));
        }
    }
    Ok(None)
}

/// Send a pending batch, recursively isolating permanent per-record failures.
/// The HTTP endpoint reports a batch-level status, so dead-lettering the whole
/// batch would incorrectly discard valid records when one identity conflicts.
/// Unknown/protocol and transient outcomes stay retryable with their stable IDs.
async fn flush_pending_usage_batch(
    state: &mut AiAttributionState,
    api_client: &ApiClient,
    batch: &[wakaclock_core::ai::PendingUsage],
    verbose: bool,
) -> Result<Option<AppError>, Box<dyn Error>> {
    if batch.is_empty() {
        return Ok(None);
    }
    // Use an explicit stack instead of recursive async calls. Each permanent
    // batch-level 4xx is bisected until only the offending record is moved to
    // local DLQ; valid siblings still get an acknowledgement in this pass.
    let mut work = vec![batch.to_vec()];
    let mut first_error = None;
    while let Some(current) = work.pop() {
        let records: Vec<_> = current.iter().map(|item| item.record.clone()).collect();
        let ids: Vec<String> = records
            .iter()
            .map(|record| record.usage_event_id.clone())
            .collect();
        match api_client.send_ai_usage(&records).await {
            Ok(report) => {
                if let Err(error) = validate_ai_usage_ack(&report, records.len()) {
                    let max_attempt = current.iter().map(|item| item.attempt).max().unwrap_or(0);
                    let next_retry_at = chrono::Utc::now().timestamp()
                        + retry_after_seconds(&error)
                            .unwrap_or_else(|| 2_u64.saturating_pow(max_attempt.min(11)))
                            .min(3_600) as i64;
                    state.mark_usage_retry(&ids, next_retry_at, "protocol_retry")?;
                    if first_error.is_none() {
                        first_error = Some(error);
                    }
                    continue;
                }
                state.mark_usage_delivered(&ids)?;
                if verbose {
                    println!(
                        "usage: received {}, accepted {}, state {:?}, duplicates {}, pending delivery {}",
                        report.received,
                        report.accepted,
                        report.processing_state,
                        report.duplicates_in_batch,
                        matches!(
                            report.processing_state,
                            wakaclock_core::ai::AiUsageProcessingState::Pending
                        )
                    );
                }
            }
            Err(error) if is_retryable_delivery_error(&error) => {
                let max_attempt = current.iter().map(|item| item.attempt).max().unwrap_or(0);
                let delay_seconds = retry_after_seconds(&error)
                    .unwrap_or_else(|| 2_u64.saturating_pow(max_attempt.min(11)));
                let next_retry_at =
                    chrono::Utc::now().timestamp() + delay_seconds.min(3_600) as i64;
                state.mark_usage_retry(&ids, next_retry_at, "delivery_retry")?;
                if verbose {
                    eprintln!("warning: usage upload will retry: {error}");
                }
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
            Err(error) if current.len() > 1 => {
                let split = current.len() / 2;
                let (left, right) = current.split_at(split);
                // LIFO order sends the left half first, preserving the original
                // deterministic queue order while keeping both halves durable.
                work.push(right.to_vec());
                work.push(left.to_vec());
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
            Err(error) => {
                state.move_usage_dead_letter(&ids, usage_error_code(&error))?;
                if verbose {
                    eprintln!("warning: usage upload permanently rejected: {error}");
                }
                if first_error.is_none() {
                    first_error = Some(error);
                }
            }
        }
    }
    Ok(first_error)
}

fn validate_ai_usage_ack(
    report: &wakaclock_core::ai::AiUsageIngestReportV2,
    expected_records: usize,
) -> Result<(), AppError> {
    if report.contract_version != 2
        || report.received != expected_records
        || report.accepted > report.received
        || report.duplicates_in_batch > report.received
        || report.accepted.checked_add(report.duplicates_in_batch) != Some(report.received)
        || report.stored.is_some_and(|stored| stored > report.accepted)
        || report
            .unpriced
            .is_some_and(|unpriced| unpriced > report.accepted)
    {
        return Err(AppError::Protocol(
            "AI usage acknowledgement fields were inconsistent".to_string(),
        ));
    }
    match report.processing_state {
        wakaclock_core::ai::AiUsageProcessingState::Pending => {
            if report.stored.is_some()
                || report.unpriced.is_some()
                || report.sessions_touched.is_some()
            {
                return Err(AppError::Protocol(
                    "AI usage pending acknowledgement had derived counts".to_string(),
                ));
            }
        }
        wakaclock_core::ai::AiUsageProcessingState::Stored => {
            if report.stored.is_none()
                || report.unpriced.is_none()
                || report.sessions_touched.is_none()
            {
                return Err(AppError::Protocol(
                    "AI usage stored acknowledgement omitted derived counts".to_string(),
                ));
            }
        }
    }
    Ok(())
}

#[cfg(test)]
mod ai_usage_ack_tests {
    use super::*;
    use wakaclock_core::ai::{AiUsageIngestReportV2, AiUsageProcessingState};

    fn stored_report() -> AiUsageIngestReportV2 {
        AiUsageIngestReportV2 {
            contract_version: 2,
            processing_state: AiUsageProcessingState::Stored,
            received: 3,
            accepted: 2,
            duplicates_in_batch: 1,
            stored: Some(2),
            unpriced: Some(1),
            sessions_touched: Some(1),
        }
    }

    #[test]
    fn acknowledgement_requires_consistent_batch_counts() {
        let report = stored_report();
        assert!(validate_ai_usage_ack(&report, 3).is_ok());

        let mut invalid = report.clone();
        invalid.accepted = 1;
        assert!(matches!(
            validate_ai_usage_ack(&invalid, 3),
            Err(AppError::Protocol(_))
        ));
    }

    #[test]
    fn acknowledgement_rejects_derived_counts_larger_than_accepted() {
        let mut invalid = stored_report();
        invalid.stored = Some(3);
        assert!(matches!(
            validate_ai_usage_ack(&invalid, 3),
            Err(AppError::Protocol(_))
        ));
    }
}

fn usage_error_code(error: &AppError) -> &'static str {
    match error {
        AppError::Conflict(_) => "conflict",
        AppError::Validation(_) => "validation",
        AppError::Auth(_) => "auth",
        AppError::HttpStatus { status, .. } | AppError::HttpStatusRetry { status, .. }
            if (400..=499).contains(status) =>
        {
            "permanent_http_4xx"
        }
        _ => "permanent_delivery_error",
    }
}

#[derive(Debug)]
struct ParsedBrokerEventInput {
    event: BrokerEventV1,
    topology: Option<TopologyContext>,
    /// Stable producer mutation identity used only by the local handoff ledger.
    /// The broker v1 event id remains deploy-order compatible.
    mutation_id: Option<String>,
    source_sequence: u64,
}

#[allow(dead_code)]
fn parse_broker_event_input(stdin: &str) -> Result<BrokerEventV1, Box<dyn Error>> {
    Ok(parse_broker_event_input_with_context(stdin)?.event)
}

fn parse_broker_event_input_with_context(
    stdin: &str,
) -> Result<ParsedBrokerEventInput, Box<dyn Error>> {
    if stdin.trim().is_empty() {
        return Err("AI event JSON is required on stdin".into());
    }

    // Native adapters may already send the stable v1 envelope. The old flat
    // `wakaclock ai emit` shape remains accepted below and is normalized into the
    // same contract before it reaches the inbox.
    if let Ok(event) = serde_json::from_str::<BrokerEventV1>(stdin) {
        let event = event.normalize()?;
        let topology = infer_topology_for_event(
            event.project_root.as_deref().map(Path::new),
            event.session_id.as_deref(),
        )?;
        let mutation_id = topology.as_ref().map(|_| {
            wakaclock_core::ai::event::opaque_file_event_id(
                "handoff-mutation-v1",
                "",
                &event.event_id,
            )
        });
        return Ok(ParsedBrokerEventInput {
            event,
            topology,
            mutation_id,
            source_sequence: handoff_source_sequence()?,
        });
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
    let topology = match input.topology.clone() {
        Some(topology) => Some(topology),
        None => {
            infer_topology_for_event(input.project_root.as_deref(), input.session_id.as_deref())?
        }
    };
    let mut input = input;
    input.topology = topology.clone();
    let mutation_id = topology.as_ref().map(|_| {
        wakaclock_core::ai::event::opaque_file_event_id(
            "handoff-mutation-v1",
            "",
            input.event_id.trim(),
        )
    });
    Ok(ParsedBrokerEventInput {
        event: broker_event_from_generic(&input)?.normalize()?,
        topology,
        mutation_id,
        source_sequence: handoff_source_sequence()?,
    })
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
        turn_id: None,
        identity_message_id: None,
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
        topology: None,
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
    // A completed tool operation has explicit start/end evidence. Preserve its
    // observed wall-clock duration up to the safety bound; the old 120-second
    // cap was a heartbeat delivery rule and silently undercounted long patches.
    let tool_active_seconds = elapsed_seconds.min(MAX_AI_TOOL_DURATION_SECONDS);
    let inputs: Vec<GenericAiEventInput> = changes
        .iter()
        .map(|change| tool_change_input(&before, &input, change, occurred_at))
        .collect();
    let events: Vec<AiEditEvent> = inputs
        .iter()
        .map(generic_ai_edit_event)
        .collect::<Result<Vec<_>, _>>()?;
    let ids: Vec<String> = events
        .iter()
        .map(|event| scoped_storage_event_id(&event.event_id, event.session_id.as_deref()))
        .collect();
    let undelivered = state.filter_undelivered(&ids)?;

    let mut pending: Vec<(&AiEditEvent, &GenericAiEventInput)> = Vec::new();
    for (event, event_input) in events.iter().zip(inputs.iter()) {
        if !undelivered.contains(&scoped_storage_event_id(
            &event.event_id,
            event.session_id.as_deref(),
        )) {
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
    let report = submit_events_with_optional_handoff(config, api_client, &broker_events).await?;

    for (event, _) in &pending {
        let delivery_id = scoped_storage_event_id(&event.event_id, event.session_id.as_deref());
        state.mark_delivered(&delivery_id, "tool_snapshot")?;
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
    if let Some(topology) = input.topology.as_ref() {
        topology.validate()?;
    }
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
    let event_id = if let Some(topology) = input.topology.as_ref() {
        // Keep broker-v1 payloads deploy-order safe while still preventing an
        // identical producer event from a different topology scope from being
        // treated as the same retry. The raw context never enters the ID.
        wakaclock_core::ai::event::opaque_file_event_id(
            "topology-v1",
            &format!("{}|{}", topology.workspace_id, topology.worktree_id),
            input.event_id.trim(),
        )
    } else {
        input.event_id.trim().to_string()
    };
    Ok(AiEditEvent {
        event_id,
        agent: normalize_agent_id(&input.agent),
        provider: normalize_optional_text(input.provider.clone()),
        model: normalize_optional_text(input.model.clone()),
        session_id: normalize_optional_text(input.session_id.clone()).or_else(|| {
            input
                .topology
                .as_ref()
                .map(|topology| topology.session_id.clone())
        }),
        turn_id: normalize_optional_text(input.turn_id.clone()),
        identity_message_id: input
            .identity_message_id
            .clone()
            .and_then(|value| normalize_identity_reference(Some(&value))),
        identity_status: None,
        identity_reason: None,
        identity_source: None,
        tool_event_id: normalize_optional_text(input.tool_event_id.clone()),
        producer_surface: None,
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
        turn_id: event.turn_id,
        identity_message_id: event.identity_message_id,
        identity_status: event.identity_status.clone(),
        identity_reason: event.identity_reason.clone(),
        identity_source: event.identity_source.clone(),
        source: event.source,
        confidence: event.confidence,
        actor_type: input.actor_type,
        actor_confidence: input.actor_confidence,
        lines_added: event.lines_added,
        lines_deleted: event.lines_deleted,
        content_fingerprint: None,
        active_seconds: input.active_seconds,
        transport: input.transport.clone(),
        tool: input.tool.clone(),
        tool_event_id: input.tool_event_id.clone(),
        editor: input.editor.clone(),
        producer_surface: event.producer_surface.clone(),
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
        session_id: heartbeat.session_id.clone(),
        turn_id: heartbeat.identity_turn_id.clone(),
        identity_message_id: heartbeat.identity_message_id.clone(),
        identity_status: heartbeat.identity_status.clone(),
        identity_reason: heartbeat.identity_reason.clone(),
        identity_source: heartbeat.identity_source.clone(),
        source,
        confidence,
        actor_type: Some(heartbeat.actor_type),
        actor_confidence: Some(heartbeat.actor_confidence),
        lines_added: heartbeat.ai_lines_added,
        lines_deleted: heartbeat.ai_lines_deleted,
        content_fingerprint: None,
        active_seconds: heartbeat.active_seconds,
        transport: Some("cli_compat".to_string()),
        tool: None,
        tool_event_id: heartbeat.ai_change_id.clone(),
        // `heartbeat.editor` was already set by `build_heartbeat`'s `detect_editor()`
        // in this same process — a real declaration unless it's just that call's own
        // generic fallback, which carries no information worth forwarding.
        editor: Some(heartbeat.editor.clone())
            .filter(|value| !value.trim().is_empty() && value != GENERIC_EDITOR_FALLBACK),
        producer_surface: None,
    })
}

async fn run_ai_emit(
    config: &Config,
    api_client: &ApiClient,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    let mut stdin = String::new();
    io::stdin().read_to_string(&mut stdin)?;
    let parsed = parse_broker_event_input_with_context(&stdin)?;
    let event = parsed.event.clone();
    let mut handoff = match parsed.topology.as_ref() {
        Some(topology) => Some(prepare_handoff(topology, &parsed, &event)?),
        None => None,
    };
    if handoff
        .as_ref()
        .is_some_and(|state| state.already_acknowledged)
    {
        if json {
            println!(
                "{}",
                serde_json::json!({
                    "status": "duplicate",
                    "event_id": event.event_id,
                    "agent": event.agent,
                    "source": event.source,
                    "confidence": event.confidence,
                    "accepted": false,
                    "duplicate": true,
                    "handoff": "deduplicated",
                })
            );
        } else {
            println!("AI event {}: duplicate (handoff ledger)", event.event_id);
        }
        return Ok(());
    }

    let ack = broker::submit_event(config, api_client, event.clone()).await?;
    let accepted = ack.status == "accepted";
    let duplicate = ack.status == "duplicate";
    if let Some(state) = handoff.as_mut() {
        if accepted || duplicate {
            state.ledger.acknowledge(state.receipt_id)?;
            state.queue.save_handoff_ledger(&state.ledger)?;
        }
    }
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

struct PreparedHandoff {
    queue: Queue,
    ledger: HandoffLedger,
    receipt_id: u64,
    already_acknowledged: bool,
    // Held from the ledger load until broker acknowledgement so concurrent
    // emitters cannot race on the same snapshot.
    _lock: AiSyncLock,
}

async fn submit_events_with_optional_handoff(
    config: &Config,
    api_client: &ApiClient,
    events: &[BrokerEventV1],
) -> Result<wakaclock_core::broker::BrokerBatchAck, Box<dyn Error>> {
    if !topology_auto_enabled() {
        return Ok(broker::submit_events_chunked(config, api_client, events).await?);
    }

    let mut combined = wakaclock_core::broker::BrokerBatchAck {
        accepted: 0,
        duplicate: 0,
        results: Vec::with_capacity(events.len()),
    };
    let mut direct_events = Vec::new();
    for (index, event) in events.iter().enumerate() {
        let Some(project_root) = event.project_root.as_deref() else {
            direct_events.push(event.clone());
            continue;
        };
        let Some(topology) =
            infer_topology_for_event(Some(Path::new(project_root)), event.session_id.as_deref())?
        else {
            direct_events.push(event.clone());
            continue;
        };
        let parsed = ParsedBrokerEventInput {
            event: event.clone(),
            topology: Some(topology.clone()),
            mutation_id: Some(wakaclock_core::ai::event::opaque_file_event_id(
                "handoff-mutation-v1",
                "",
                &event.event_id,
            )),
            source_sequence: (index as u64).saturating_add(1),
        };
        let mut handoff = prepare_handoff(&topology, &parsed, event)?;
        if handoff.already_acknowledged {
            combined.duplicate += 1;
            combined
                .results
                .push(wakaclock_core::broker::BrokerEventAck {
                    event_id: event.event_id.clone(),
                    status: "duplicate".to_string(),
                    actor_type: event.actor_type.unwrap_or(ActorType::Unknown),
                    actor_confidence: event.actor_confidence.unwrap_or(0.0),
                });
            continue;
        }
        let ack = broker::submit_event(config, api_client, event.clone()).await?;
        if ack.status == "accepted" {
            combined.accepted += 1;
        } else if ack.status == "duplicate" {
            combined.duplicate += 1;
        }
        if ack.status == "accepted" || ack.status == "duplicate" {
            handoff.ledger.acknowledge(handoff.receipt_id)?;
            handoff.queue.save_handoff_ledger(&handoff.ledger)?;
        }
        combined.results.push(ack);
    }
    if !direct_events.is_empty() {
        let direct = broker::submit_events_chunked(config, api_client, &direct_events).await?;
        combined.accepted += direct.accepted;
        combined.duplicate += direct.duplicate;
        combined.results.extend(direct.results);
    }
    Ok(combined)
}

fn prepare_handoff(
    topology: &TopologyContext,
    parsed: &ParsedBrokerEventInput,
    event: &BrokerEventV1,
) -> Result<PreparedHandoff, Box<dyn Error>> {
    let home = dirs::home_dir().ok_or("cannot resolve home directory for handoff.lock")?;
    let handoff_lock =
        AiSyncLock::acquire_blocking_at(&home.join(".wakaclock").join("handoff.lock"))?;
    let bridge_id = if matches!(topology.execution, ExecutionSurface::Local) {
        None
    } else {
        Some(
            std::env::var("WAKACLOCK_BRIDGE_ID")
                .or_else(|_| std::env::var("WAKACLOCK_CLOUD_AUTH_KEY_ID"))
                .map_err(|_| {
                    "remote/cloud topology requires WAKACLOCK_BRIDGE_ID (opaque authenticated bridge reference)"
                })?,
        )
    };
    if matches!(topology.execution, ExecutionSurface::CloudJob) {
        let auth_key_id = bridge_id
            .clone()
            .ok_or("cloud topology requires an authenticated callback key reference")?;
        let job_id = std::env::var("WAKACLOCK_CLOUD_JOB_ID")
            .ok()
            .filter(|value| !value.trim().is_empty())
            .or_else(|| topology.runtime_instance_id.clone())
            .ok_or("cloud topology requires WAKACLOCK_CLOUD_JOB_ID")?;
        let tool_event_id = event
            .tool_event_id
            .clone()
            .ok_or("cloud topology requires tool_event_id evidence")?;
        let mutation_id = parsed
            .mutation_id
            .clone()
            .ok_or("cloud topology requires a file mutation identity")?;
        CloudJobEvidence {
            schema_version: wakaclock_core::ai::TOPOLOGY_HANDOFF_SCHEMA_VERSION,
            topology: topology.clone(),
            auth_key_id,
            job_id,
            tool_event_id,
            mutation_id,
            event_id: event.event_id.clone(),
        }
        .validate()?;
    }
    let boot_id = std::env::var("WAKACLOCK_BOOT_ID")
        .ok()
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("boot:{}", std::process::id()));
    let registration = CollectorRegistration::for_topology(
        topology.clone(),
        bridge_id,
        boot_id,
        CollectorCapabilities {
            file_mutations: true,
            transcripts: matches!(&event.source, AiEventSource::Transcript),
            editor_observations: matches!(&event.source, AiEventSource::IdeTelemetry),
        },
    )?;
    let queue = Queue::open()?;
    let mut ledger = queue.load_handoff_ledger()?.unwrap_or_default();
    ledger.prune_acknowledged_before(chrono::Utc::now() - chrono::Duration::days(30));
    let collector_id = registration.collector_id.clone();
    ledger.register_or_reconnect(registration)?;

    let operation_id = event.tool_event_id.as_deref().map(|value| {
        wakaclock_core::ai::event::opaque_file_event_id("handoff-operation-v1", "", value)
    });
    let scope_id = topology
        .repository_id
        .clone()
        .unwrap_or_else(|| topology.workspace_id.clone());
    let identity = HandoffEventIdentity {
        event_id: event.event_id.clone(),
        operation_id,
        mutation_id: parsed.mutation_id.clone(),
        scope_id: Some(scope_id),
    };
    let source_sequence = if std::env::var_os("WAKACLOCK_SOURCE_SEQUENCE").is_some() {
        parsed.source_sequence
    } else {
        ledger.next_source_sequence(&collector_id)?
    };
    let receipt = ledger.ingest(
        &collector_id,
        HandoffEvent {
            identity,
            source_sequence,
            occurred_at: event.occurred_at,
        },
    )?;
    let (receipt_id, already_acknowledged) = match receipt {
        HandoffIngestOutcome::Accepted { receipt_id } => {
            queue.save_handoff_ledger(&ledger)?;
            (receipt_id, false)
        }
        HandoffIngestOutcome::Duplicate { receipt_id } => {
            (receipt_id, !ledger.is_pending(receipt_id))
        }
    };
    Ok(PreparedHandoff {
        queue,
        ledger,
        receipt_id,
        already_acknowledged,
        _lock: handoff_lock,
    })
}

/// Ordinary editor heartbeats opportunistically drain transcript events, so AI edits
/// do not depend on a user remembering to run `wakaclock sync`. Each agent gets its
/// own bounded pass: a large or malformed Claude history must not consume the whole
/// budget before Codex gets a chance to scan its current session. A timeout/error leaves
/// the ordinary heartbeat path untouched and the transcript cursor replayable on the
/// next event-triggered call.
pub(crate) async fn run_bounded_ai_sync(config: &Config, api_client: &ApiClient) {
    const AUTO_SYNC_AGENT_BUDGET: Duration = Duration::from_secs(2);

    // Keep this order stable and put the low-latency active-session parser first. The
    // calls remain sequential because AiSyncLock protects the shared attribution state;
    // the independent timeout is what prevents one parser from starving the others.
    for agent in ["codex", "claude-code", "gemini-cli"] {
        match tokio::time::timeout(
            AUTO_SYNC_AGENT_BUDGET,
            run_ai_sync(
                config,
                api_client,
                Some(agent),
                false,
                false,
                false,
                None,
                false,
                Some(Instant::now() + AUTO_SYNC_AGENT_BUDGET),
            ),
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

    // Codex's native transcript already carries the workspace root. Avoid a second
    // repository discovery here: gix ref resolution can block while a checkout is
    // changing (notably for nested `codex/...` branches), which would hold the broker
    // worker before it can deliver the heartbeat. The root-based project fallback
    // below is sufficient for this metadata-only transcript path; ordinary editor
    // heartbeats still use the full Git discovery path.
    let git_info = if event.project_root.is_none() {
        git::discover(&entity_path)
    } else {
        None
    };
    // The project name is decided from the entity path alone, never from the reported
    // cwd: agents `cd` into subfolders and Codex Desktop keeps stale session roots, so a
    // cwd basename (or its nearest manifest) turned `backend/api/crates/wakaclock-core`
    // into a project of its own. `resolve_project` is a stat walk without `gix`, so it
    // keeps the broker free of the ref-resolution stalls described above.
    heartbeat.project = git_info
        .as_ref()
        .map(|info| info.project.clone())
        .or_else(|| {
            resolve_project(&event.entity, event.project_root.as_deref())
                .map(|resolved| resolved.name)
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
    heartbeat.editor = detect_editor_env()
        .or_else(|| event.producer_surface.clone())
        .unwrap_or_else(|| event.agent.clone());
    heartbeat.heartbeat_id = Some(format!("ai:{}", event.event_id));
    heartbeat.session_id = event.session_id.clone();
    heartbeat.time = event.occurred_at.timestamp_millis() as f64 / 1000.0;
    heartbeat.date = Heartbeat::date_from_time(heartbeat.time);

    // A broker launched by launchd may not have permission to open a workspace
    // file under Desktop/Documents. More importantly, a transcript event already
    // carries the authoritative line delta, so do not read source bytes again just
    // to decorate this heartbeat. Infer the display language from the extension;
    // all source/diff inspection stays inside the parser's bounded memory path.
    heartbeat.language = infer_language_from_path(&entity_path);

    heartbeat.ai_agent = Some(event.agent.clone());
    heartbeat.ai_provider = event.provider.clone();
    heartbeat.ai_model = event.model.clone();
    heartbeat.ai_source = Some(event.source.as_str().to_string());
    heartbeat.ai_confidence = Some(event.confidence.as_str().to_string());
    heartbeat.ai_event_id = Some(event.event_id.clone());
    let identity = resolve_identity(
        Some(&event.agent),
        &[event.provider.as_deref()],
        &[event.model.as_deref()],
        Some(event.source.as_str()),
        Some(event.confidence.as_str()),
    );
    heartbeat.identity_status = event
        .identity_status
        .clone()
        .or_else(|| Some(identity.status.as_str().to_string()));
    heartbeat.identity_reason = event
        .identity_reason
        .clone()
        .or_else(|| identity.reason.map(str::to_string));
    heartbeat.identity_source = event.identity_source.clone().or(identity.source);
    heartbeat.identity_schema_version = Some(IDENTITY_SCHEMA_VERSION);
    heartbeat.identity_turn_id = event.turn_id.clone();
    heartbeat.identity_message_id = event.identity_message_id.clone();
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
            // Transcript replay has only an observed edit timestamp and the legacy
            // activity cadence; the broker upgrades this to `ai_tool_v1` only when a
            // completed tool start/end event is present.
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

fn infer_language_from_path(entity: &str) -> Option<String> {
    let extension = Path::new(entity)
        .extension()
        .and_then(|value| value.to_str())?
        .to_ascii_lowercase();
    let language = match extension.as_str() {
        "md" | "markdown" => "Markdown",
        "ts" => "TypeScript",
        "tsx" => "TSX",
        "js" | "mjs" | "cjs" => "JavaScript",
        "jsx" => "JSX",
        "json" | "jsonc" => "JSON",
        "rs" => "Rust",
        "py" => "Python",
        "go" => "Go",
        "java" => "Java",
        "kt" | "kts" => "Kotlin",
        "swift" => "Swift",
        "css" => "CSS",
        "scss" => "SCSS",
        "html" | "htm" => "HTML",
        "vue" => "Vue",
        "svelte" => "Svelte",
        "yaml" | "yml" => "YAML",
        "toml" => "TOML",
        "sh" | "bash" | "zsh" | "fish" => "Shell",
        "sql" => "SQL",
        "c" => "C",
        "h" => "C Header",
        "cc" | "cpp" | "cxx" | "hpp" => "C++",
        "xml" => "XML",
        "txt" => "Text",
        _ => return None,
    };
    Some(language.to_string())
}

fn build_heartbeat(
    config: &Config,
    entity: &str,
    entity_type: EntityType,
    project_override: Option<String>,
    alternate_project: Option<String>,
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
    // WakaTime order: an explicit `--project` override, then the repository, then the
    // editor's `--alternate-project` (its workspace folder name), then non-Git markers.
    // The stat-walk repository check backs up `gix`, so a workspace folder opened on a
    // repository subfolder (`extensions/vscode`) can never outrank the repository.
    heartbeat.project = project_override.or_else(|| {
        git_info.as_ref().map(|g| g.project.clone()).or_else(|| {
            let resolved = resolve_project(Path::new(&entity_path), None);
            match resolved {
                Some(resolved) if resolved.source == ProjectSource::Git => Some(resolved.name),
                other => alternate_project.or_else(|| other.map(|resolved| resolved.name)),
            }
        })
    });
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
            && extra.actor_type != Some(ActorType::Unknown)
            && (is_write
                || extra.activity_segments.iter().any(|segment| {
                    segment.source.as_deref().is_some_and(|source| {
                        source.eq_ignore_ascii_case("human")
                            || source.eq_ignore_ascii_case("editor")
                            || source.eq_ignore_ascii_case("editor_active_v1")
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
        if let Some(time) = extra.time {
            heartbeat.time = time;
            heartbeat.date = Heartbeat::date_from_time(time);
        }
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
        heartbeat.line_metric_version = extra.line_metric_version;
        heartbeat.line_measurement_status = extra.line_measurement_status;
        heartbeat.line_measurement_reason = extra.line_measurement_reason;
        heartbeat.measurement_window_id = extra.measurement_window_id;
    }

    if heartbeat.heartbeat_id.is_none() {
        heartbeat.heartbeat_id = Some(Uuid::new_v4().to_string());
    }
    if heartbeat.line_metric_version.is_some() && heartbeat.measurement_window_id.is_none() {
        heartbeat.measurement_window_id = heartbeat.heartbeat_id.clone();
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
    // A legacy client may still send one large `active_seconds` value. Keep only the
    // trailing window this heartbeat can prove. Splitting the claim into adjacent
    // 120-second segments would make one heartbeat manufacture an arbitrarily long
    // session, which is exactly the idle inflation this evidence boundary prevents.
    // The original claim remains in `active_seconds_claimed` for diagnostics; the
    // canonical timeline reads this single bounded segment and may bridge only when a
    // neighbouring heartbeat independently vouches for the pause.
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
    heartbeat.activity_segments.push(ActivitySegment {
        segment_id: format!("{base}:legacy-segment"),
        start: (heartbeat.time - seconds).max(0.0),
        end: heartbeat.time,
        source,
    });
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

fn is_strict_active_source(source: Option<&str>) -> bool {
    matches!(source, Some("editor_active_v1" | "ai_tool_v1"))
}

/// Union strict Active evidence from the server and the local queue. A heartbeat may
/// remain in SQLite after the server accepted it (process crash between response and
/// delete), so this must union ranges rather than add the two scalar totals. Legacy
/// queued heartbeats remain visible through queue depth but cannot inflate an Active
/// total without a v1 evidence marker.
fn active_seconds_with_queued(server: &[ActivitySegment], queued: &[ActivitySegment]) -> f64 {
    let intervals = server
        .iter()
        .chain(queued.iter())
        .filter(|segment| is_strict_active_source(segment.source.as_deref()))
        .cloned()
        .collect::<Vec<_>>();
    union_activity_seconds(&intervals)
}

#[cfg(test)]
mod generic_ai_ingress_tests {
    use super::*;

    fn ai_event_for(agent: &str, entity: PathBuf, project_root: Option<PathBuf>) -> AiEditEvent {
        AiEditEvent {
            event_id: format!("{agent}-project-test"),
            agent: agent.to_string(),
            provider: None,
            model: None,
            session_id: None,
            turn_id: None,
            identity_message_id: None,
            identity_status: None,
            identity_reason: None,
            identity_source: None,
            tool_event_id: None,
            producer_surface: None,
            occurred_at: chrono::Utc::now(),
            entity,
            project_root,
            change_kind: wakaclock_core::broker::BrokerChangeKind::Modify,
            previous_entity: None,
            lines_added: Some(1),
            lines_deleted: None,
            input_tokens: None,
            output_tokens: None,
            source: AiEventSource::Transcript,
            confidence: AiConfidence::Verified,
        }
    }

    #[test]
    fn ai_heartbeat_names_the_repository_not_the_agent_cwd_or_nested_crate() {
        let base = std::env::temp_dir().join(format!("wakaclock-ai-project-{}", Uuid::new_v4()));
        let repo = base.join("wakaclock");
        let api = repo.join("backend/api");
        let crate_root = api.join("crates/wakaclock-core");
        let entity = crate_root.join("src/ai/codex.rs");
        fs::create_dir_all(repo.join(".git")).unwrap();
        fs::create_dir_all(entity.parent().unwrap()).unwrap();
        fs::write(api.join("Cargo.toml"), "[workspace]\n").unwrap();
        fs::write(
            crate_root.join("Cargo.toml"),
            "[package]\nname = \"wakaclock-core\"\n",
        )
        .unwrap();
        let config = Config::default();

        // Claude records follow `cd`, so its reported root can be a manifest subfolder.
        let claude = ai_event_for("claude-code", entity.clone(), Some(api.clone()));
        assert_eq!(
            build_ai_heartbeat(&config, &claude, 0.0).project.as_deref(),
            Some("wakaclock")
        );
        // Codex transcripts used to bypass every check and name the root folder.
        let codex = ai_event_for("codex", entity.clone(), Some(crate_root.clone()));
        assert_eq!(
            build_ai_heartbeat(&config, &codex, 0.0).project.as_deref(),
            Some("wakaclock")
        );
        let rootless = ai_event_for("codex", repo.join("WAKACLOCK-SMOKE.md"), None);
        assert_eq!(
            build_ai_heartbeat(&config, &rootless, 0.0)
                .project
                .as_deref(),
            Some("wakaclock")
        );

        fs::remove_dir_all(base).unwrap();
    }

    #[test]
    fn editor_alternate_project_is_only_a_fallback_below_the_repository() {
        let base = std::env::temp_dir().join(format!("wakaclock-alt-project-{}", Uuid::new_v4()));
        let repo = base.join("wakaclock");
        let entity = repo.join("extensions/vscode/src/cli.ts");
        fs::create_dir_all(repo.join(".git")).unwrap();
        fs::create_dir_all(entity.parent().unwrap()).unwrap();
        fs::write(repo.join("extensions/vscode/package.json"), "{}").unwrap();
        fs::write(&entity, "export {};\n").unwrap();
        let loose = base.join("loose/notes.txt");
        fs::create_dir_all(loose.parent().unwrap()).unwrap();
        fs::write(&loose, "x").unwrap();
        let config = Config::default();
        let project_of = |entity: &Path, project: Option<&str>, alternate: Option<&str>| {
            build_heartbeat(
                &config,
                entity.to_str().unwrap(),
                EntityType::File,
                project.map(str::to_string),
                alternate.map(str::to_string),
                Category::Coding,
                false,
                None,
            )
            .unwrap()
            .project
        };

        assert_eq!(
            project_of(&entity, None, Some("vscode")).as_deref(),
            Some("wakaclock")
        );
        assert_eq!(
            project_of(&loose, None, Some("notes-folder")).as_deref(),
            Some("notes-folder")
        );
        assert_eq!(
            project_of(&entity, Some("forced"), Some("vscode")).as_deref(),
            Some("forced")
        );

        fs::remove_dir_all(base).unwrap();
    }

    fn sample_input() -> GenericAiEventInput {
        GenericAiEventInput {
            event_id: "chatgpt-session-1:src/lib.rs:1".to_string(),
            producer_version: Some(1),
            agent: "ChatGPT MCP".to_string(),
            provider: Some("openai".to_string()),
            model: Some("gpt".to_string()),
            session_id: Some("session-1".to_string()),
            turn_id: None,
            identity_message_id: None,
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
            topology: None,
        }
    }

    #[test]
    fn active_queue_union_ignores_legacy_and_deduplicates_replay() {
        let server = vec![ActivitySegment {
            segment_id: "accepted".to_string(),
            start: 0.0,
            end: 420.0,
            source: Some("editor_active_v1".to_string()),
        }];
        let queued = vec![
            ActivitySegment {
                segment_id: "replayed".to_string(),
                start: 0.0,
                end: 420.0,
                source: Some("editor_active_v1".to_string()),
            },
            ActivitySegment {
                segment_id: "legacy".to_string(),
                start: 420.0,
                end: 540.0,
                source: None,
            },
            ActivitySegment {
                segment_id: "new-active".to_string(),
                start: 540.0,
                end: 555.0,
                source: Some("editor_active_v1".to_string()),
            },
        ];

        assert_eq!(active_seconds_with_queued(&server, &queued), 435.0);
    }

    #[test]
    fn legacy_active_seconds_keeps_only_one_trailing_evidence_window() {
        let mut heartbeat = Heartbeat::new(
            Uuid::nil(),
            "/workspace/src/lib.rs".to_string(),
            EntityType::File,
            "test".to_string(),
        );
        heartbeat.time = 1_000.0;
        heartbeat.heartbeat_id = Some("legacy-heartbeat".to_string());
        heartbeat.active_seconds = Some(600.0);

        ensure_activity_segment(&mut heartbeat);

        assert_eq!(heartbeat.activity_segments.len(), 1);
        let segment = &heartbeat.activity_segments[0];
        assert_eq!(segment.start, 880.0);
        assert_eq!(segment.end, 1_000.0);
        assert_eq!(segment.end - segment.start, MAX_ACTIVITY_GAP_SECONDS);
        assert_eq!(segment.source.as_deref(), Some("editor"));
    }

    #[test]
    fn topology_scopes_generic_event_identity_without_leaking_context() {
        let mut first = sample_input();
        first.topology = Some(
            TopologyIdentityInput {
                execution: ExecutionSurface::SshRemote,
                editor: EditorSurface::Vscode,
                device_seed: "device-a".to_string(),
                workspace_key: "workspace-a".to_string(),
                worktree_key: "worktree-a".to_string(),
                session_id: "session-a".to_string(),
                runtime_instance_key: Some("host-a".to_string()),
                repository_id: Some("remote:git.example/app.git".to_string()),
            }
            .build()
            .unwrap(),
        );
        let first_event = generic_ai_edit_event(&first).unwrap();

        let mut second = first.clone();
        second.topology = Some(
            TopologyIdentityInput {
                device_seed: "device-b".to_string(),
                ..TopologyIdentityInput {
                    execution: ExecutionSurface::SshRemote,
                    editor: EditorSurface::Vscode,
                    device_seed: "device-a".to_string(),
                    workspace_key: "workspace-a".to_string(),
                    worktree_key: "worktree-a".to_string(),
                    session_id: "session-a".to_string(),
                    runtime_instance_key: Some("host-a".to_string()),
                    repository_id: Some("remote:git.example/app.git".to_string()),
                }
            }
            .build()
            .unwrap(),
        );
        let second_event = generic_ai_edit_event(&second).unwrap();

        assert_ne!(first_event.event_id, second_event.event_id);
        assert!(!first_event.event_id.contains("workspace-a"));
        assert!(!first_event.event_id.contains("git.example"));
    }

    #[test]
    fn topology_event_identity_survives_a_session_reconnect() {
        let mut first = sample_input();
        first.topology = Some(
            TopologyIdentityInput {
                execution: ExecutionSurface::SshRemote,
                editor: EditorSurface::Vscode,
                device_seed: "device-a".to_string(),
                workspace_key: "workspace-a".to_string(),
                worktree_key: "worktree-a".to_string(),
                session_id: "session-a".to_string(),
                runtime_instance_key: Some("host-a".to_string()),
                repository_id: Some("remote:git.example/app.git".to_string()),
            }
            .build()
            .unwrap(),
        );
        let first_id = generic_ai_edit_event(&first).unwrap().event_id;
        let mut reconnected = first.clone();
        reconnected.session_id = Some("session-b".to_string());
        reconnected.topology = Some(
            TopologyIdentityInput {
                session_id: "session-b".to_string(),
                ..TopologyIdentityInput {
                    execution: ExecutionSurface::SshRemote,
                    editor: EditorSurface::Vscode,
                    device_seed: "device-a".to_string(),
                    workspace_key: "workspace-a".to_string(),
                    worktree_key: "worktree-a".to_string(),
                    session_id: "session-a".to_string(),
                    runtime_instance_key: Some("host-a".to_string()),
                    repository_id: Some("remote:git.example/app.git".to_string()),
                }
            }
            .build()
            .unwrap(),
        );
        assert_eq!(
            first_id,
            generic_ai_edit_event(&reconnected).unwrap().event_id
        );
    }

    #[test]
    fn malformed_topology_is_rejected_before_generic_ingress() {
        let mut input = sample_input();
        input.topology = Some(wakaclock_core::ai::TopologyContext {
            schema_version: 1,
            execution: ExecutionSurface::CloudJob,
            editor: EditorSurface::None,
            device_id: "device-1".to_string(),
            workspace_id: "workspace-1".to_string(),
            worktree_id: "worktree-1".to_string(),
            session_id: "session-1".to_string(),
            runtime_instance_id: None,
            repository_id: None,
        });
        assert!(generic_ai_edit_event(&input).is_err());
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
    fn ai_capabilities_is_a_first_class_cli_subcommand() {
        let parsed = Cli::try_parse_from(["wakaclock", "ai", "capabilities", "--json"])
            .expect("ai capabilities should parse");
        assert!(matches!(
            parsed.command,
            Commands::Ai {
                action: AiAction::Capabilities { json: true }
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
    fn top_level_sync_supports_on_demand_json_and_hook_budget() {
        let parsed = Cli::try_parse_from([
            "wakaclock",
            "sync",
            "--agent",
            "codex",
            "--automatic",
            "--json",
        ])
        .expect("sync should parse");
        assert!(matches!(
            parsed.command,
            Commands::Sync {
                agent: Some(agent),
                automatic: true,
                json: true,
                ..
            } if agent == "codex"
        ));
    }

    #[test]
    fn sync_status_distinguishes_quarantined_conflicts_from_transport_pending() {
        assert_eq!(sync_deferred_reason(None, false, 0, 0), None);
        assert_eq!(sync_deferred_reason(None, false, 4, 0), Some("backoff"));
        assert_eq!(sync_deferred_reason(None, false, 0, 3), Some("server"));
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
