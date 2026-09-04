use clap::{Parser, Subcommand};
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashSet},
    error::Error,
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    str::FromStr,
    time::Duration,
};
use uuid::Uuid;
mod agent_service;
use wakaclock_ast::detect;
use wakaclock_core::{
    ai::{
        build_ai_diagnostics_report, parse_claude_usage, parse_codex_usage, parse_gemini_usage,
        AdapterFreshness, AiActivityParser, AiAttributionState, AiEditEvent, BrokerHealth,
        ClaudeCodeParser, CodexParser, DiscoveryContext, DiscoveryResult, DiscoveryState,
        GeminiCliParser, ObserverConfig, ParseContext, ParserCursor, ParserLagSummary,
        VerificationStatus,
    },
    api_client::ApiClient,
    config::Config,
    error::AppError,
    git,
    heartbeat::{
        union_activity_seconds, ActivitySegment, Category, EntityType, Heartbeat,
        MAX_ACTIVITY_GAP_SECONDS,
    },
    queue::Queue,
};

/// Match WakaTime's default keystroke timeout when joining agent heartbeats. AI
/// transcript/tool events are activity markers too; they should contribute the interval
/// between nearby events, not remain permanently at zero seconds.
const AI_ACTIVITY_TIMEOUT_SECONDS: f64 = MAX_ACTIVITY_GAP_SECONDS;
const AI_ACTIVITY_STREAM: &str = "ai";

#[derive(Parser)]
#[command(name = "wakaclock", version, about = "Wakaclock CLI Hub")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
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

        /// Identifies the caller in `user_agent`, e.g. `wakaclock-vscode/0.1.0`.
        /// Without it every heartbeat looks identical on the wire, and a stale editor
        /// build sending legacy payloads is indistinguishable from a current one — which
        /// is precisely how a two-hour timing regression stayed invisible.
        #[arg(long)]
        plugin: Option<String>,

        /// Name of the AI agent that made this edit (e.g. "claude-code", "codex",
        /// "gemini-cli") — presence of this flag is what sets `is_ai_generated`; there
        /// is no separate boolean flag, since a heartbeat naming an agent is AI-generated
        /// by definition and a redundant flag is just another way for the two to disagree.
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
    Agent {
        #[command(subcommand)]
        action: AgentAction,
    },
    Repair {
        #[command(subcommand)]
        action: RepairAction,
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
    /// Register detected adapters and, after explicit consent, install the
    /// per-user transcript watcher. This command never infers authorship and
    /// never overwrites an agent-owned configuration file.
    Setup {
        /// Adapter id (`claude-code`, `codex`, or `gemini-cli`).
        agent: Option<String>,
        /// Register every adapter supported by this CLI.
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

async fn run() -> Result<(), Box<dyn Error>> {
    let cli = Cli::parse();
    let mut config = Config::load();

    // An API key from the environment (set by the VS Code extension via SecretStorage)
    // takes precedence over the persisted config.toml, without writing it back to disk —
    // that keeps the editor's own secret store as the single place the key lives when set
    // this way.
    if let Ok(env_key) = std::env::var("WAKACLOCK_API_KEY") {
        if !env_key.trim().is_empty() {
            config.api_key = Some(env_key);
        }
    }
    if let Ok(server_url) = std::env::var("WAKACLOCK_SERVER_URL") {
        if !server_url.trim().is_empty() {
            match Config::normalize_server_url(&server_url) {
                Ok(normalized) => config.server_url = normalized,
                Err(error) => {
                    if matches!(&cli.command, Commands::Verify { json: true }) {
                        println!(
                            "{}",
                            serde_json::json!({
                                "status": "incompatible",
                                "server_url": server_url,
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
            }
        }
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
            let setup_consented = load_ai_setup_state()
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
                active_seconds,
                heartbeat_id,
                activity_segments: parsed_activity_segments.unwrap_or_default(),
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

            let report = api_client.send_heartbeats(heartbeats.clone()).await?;
            // Persist hook fingerprints even when the request is offline-queued. A
            // transcript watcher that sees the same patch a few seconds later must not
            // create a second heartbeat while the queued hook retry is pending.
            if heartbeats.iter().any(|heartbeat| heartbeat.is_ai_generated) {
                // Delivery deduplication is best-effort bookkeeping after the server (or
                // offline queue) has already accepted the heartbeat. A read-only home
                // directory must not turn a successful network send into a non-zero CLI
                // exit that makes the editor retry and double-count it.
                match AiAttributionState::open() {
                    Ok(delivery_state) => {
                        for heartbeat in &heartbeats {
                            if heartbeat.is_ai_generated {
                                if let Err(error) = delivery_state.mark_fingerprint(
                                    &heartbeat.entity,
                                    heartbeat.time,
                                    heartbeat.ai_lines_added.unwrap_or(0),
                                    heartbeat.ai_lines_deleted.unwrap_or(0),
                                    heartbeat.ai_event_id.as_deref(),
                                ) {
                                    eprintln!("Warning: could not persist AI fingerprint: {error}");
                                }
                                if let Some(event_id) = heartbeat.ai_event_id.as_deref() {
                                    if let Err(error) =
                                        delivery_state.mark_delivered(event_id, "hook")
                                    {
                                        eprintln!(
                                            "Warning: could not persist AI event id: {error}"
                                        );
                                    }
                                }
                            }
                        }
                    }
                    Err(error) => {
                        eprintln!("Warning: could not open AI dedup state: {error}");
                    }
                }
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
                        "status": if report.queued > 0 { "queued" } else { "sent" },
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
            AiAction::Status { json } => print_ai_status(json)?,
            AiAction::Setup {
                agent,
                all,
                yes,
                json,
            } => run_ai_setup(agent.as_deref(), all, yes, json)?,
            AiAction::Uninstall { agent, all, json } => {
                run_ai_uninstall(agent.as_deref(), all, json)?
            }
            AiAction::Doctor { json, upload } => run_ai_doctor(&api_client, json, upload).await?,
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
        Commands::Agent { action } => match action {
            AgentAction::Run { interval_seconds } => {
                run_agent_loop(&config, &api_client, interval_seconds.max(1)).await?;
            }
            AgentAction::Install { json } => {
                let report = agent_service::install().map_err(io::Error::other)?;
                print_agent_report(&report, json, queue_count());
            }
            AgentAction::Uninstall { json } => {
                let report = agent_service::uninstall().map_err(io::Error::other)?;
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
        },
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
    }

    Ok(())
}

async fn run_agent_loop(
    config: &Config,
    api_client: &ApiClient,
    interval_seconds: u64,
) -> Result<(), Box<dyn Error>> {
    let _lock = agent_service::AgentLock::acquire().map_err(io::Error::other)?;
    agent_service::append_log(&format!(
        "agent started pid={} interval={}s",
        std::process::id(),
        interval_seconds
    ));
    let interval = Duration::from_secs(interval_seconds);
    loop {
        let started = std::time::Instant::now();
        let mut cycle_error: Option<String> = None;
        let observer_enabled = load_observer_config().enabled;
        let setup_consented = load_ai_setup_state()
            .map(|state| state.adapters.values().any(|adapter| adapter.consented))
            .unwrap_or(false);
        if observer_enabled && setup_consented {
            match run_ai_sync(config, api_client, None, false, false, false, None).await {
                Ok(()) => agent_service::append_log("scan completed"),
                Err(error) => {
                    let message = error.to_string();
                    agent_service::append_log(&format!("scan failed: {message}"));
                    cycle_error = Some(message);
                }
            }
        } else {
            // Installing the service is harmless, but transcript reads and production
            // writes wait for explicit `ai setup` consent plus observe_only enablement.
            agent_service::append_log("observer disabled; transcript scan skipped");
        }

        // The watcher also owns the durable offline queue. This keeps retries flowing
        // while VS Code is closed and there are no fresh transcript events to trigger a
        // normal heartbeat send.
        match api_client.flush_queue().await {
            Ok(report) => {
                if report.flushed > 0 {
                    agent_service::record_heartbeat();
                    agent_service::append_log(&format!(
                        "flushed {} queued heartbeat(s)",
                        report.flushed
                    ));
                }
                if let Some(error) = report.stopped_because {
                    agent_service::append_log(&format!("queue flush stopped: {error}"));
                    cycle_error.get_or_insert(error);
                }
            }
            Err(error) => {
                let message = format!("queue flush failed: {error}");
                agent_service::append_log(&message);
                cycle_error.get_or_insert(message);
            }
        }

        if let Some(error) = cycle_error {
            agent_service::record_scan(false, None, Some(&error));
        } else {
            agent_service::record_scan(true, None, None);
        }
        let elapsed = started.elapsed();
        if elapsed < interval {
            tokio::time::sleep(interval - elapsed).await;
        }
    }
}

fn print_agent_report(report: &agent_service::AgentServiceReport, json: bool, queue_count: usize) {
    if json {
        println!(
            "{}",
            serde_json::json!({
                "platform": report.platform,
                "manifest": report.manifest,
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
        println!("Manifest: {}", report.manifest);
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

fn queue_count() -> usize {
    Queue::open().and_then(|queue| queue.len()).unwrap_or(0)
}

fn supported_ai_parsers() -> Vec<(&'static str, Box<dyn AiActivityParser>)> {
    vec![
        ("claude-code", Box::new(ClaudeCodeParser::new())),
        ("codex", Box::new(CodexParser::new())),
        ("gemini-cli", Box::new(GeminiCliParser::new())),
    ]
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

#[derive(Debug, Serialize)]
struct AiSetupAdapterReport {
    agent: String,
    consented: bool,
    detected: bool,
    status: String,
    verification: VerificationStatus,
}

#[derive(Debug, Serialize)]
struct AiSetupReport {
    adapters: Vec<AiSetupAdapterReport>,
    observer_mode: &'static str,
    service_error: Option<String>,
    service_installed: bool,
    service_running: bool,
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

fn save_ai_setup_state(state: &AiSetupState) -> Result<(), Box<dyn Error>> {
    let path = ai_setup_state_path()?;
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let temporary = path.with_extension(format!("json.tmp-{}", std::process::id()));
    fs::write(
        &temporary,
        format!("{}\n", serde_json::to_string_pretty(state)?),
    )?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(temporary, path)?;
    Ok(())
}

fn canonical_ai_setup_id(value: &str) -> Option<&'static str> {
    match value.trim().to_ascii_lowercase().replace('_', "-").as_str() {
        "claude" | "claude-code" => Some("claude-code"),
        "codex" | "codex-cli" => Some("codex"),
        "gemini" | "gemini-cli" => Some("gemini-cli"),
        _ => None,
    }
}

fn selected_ai_setup_ids(
    agent: Option<&str>,
    all: bool,
) -> Result<Vec<&'static str>, Box<dyn Error>> {
    if all && agent.is_some() {
        return Err("choose one adapter id or --all, not both".into());
    }
    if all || agent.is_none() {
        return Ok(vec!["claude-code", "codex", "gemini-cli"]);
    }
    let value = agent.expect("checked above");
    canonical_ai_setup_id(value)
        .map(|id| vec![id])
        .ok_or_else(|| {
            format!("unsupported adapter '{value}' (supported: claude-code, codex, gemini-cli)")
                .into()
        })
}

fn run_ai_setup(
    agent: Option<&str>,
    all: bool,
    yes: bool,
    json: bool,
) -> Result<(), Box<dyn Error>> {
    let ids = selected_ai_setup_ids(agent, all)?;
    let context = ai_discovery_context()?;
    let mut state = load_ai_setup_state()?;
    let mut changed = false;
    let mut reports = Vec::with_capacity(ids.len());

    for id in ids {
        let detected = supported_ai_parsers()
            .into_iter()
            .find(|(parser_id, _)| *parser_id == id)
            .map(|(_, parser)| {
                parser
                    .discover_sources(&context)
                    .iter()
                    .any(|result| !matches!(result.state, DiscoveryState::NotInstalled))
            })
            .unwrap_or(false);
        let previous = state.adapters.get(id).cloned();
        let already_consented = previous.as_ref().is_some_and(|value| value.consented);
        let consented = already_consented || yes;
        let status = if !consented {
            "consent_required"
        } else if detected {
            "registered"
        } else {
            "not_detected"
        };
        if consented {
            let next = AiSetupAdapterState {
                consented: true,
                detected,
                verification: VerificationStatus::Scaffold,
            };
            if previous.as_ref() != Some(&next) {
                state.adapters.insert(id.to_string(), next);
                changed = true;
            }
        }
        reports.push(AiSetupAdapterReport {
            agent: id.to_string(),
            consented,
            detected,
            status: status.to_string(),
            verification: VerificationStatus::Scaffold,
        });
    }

    let should_reconcile_service = yes || reports.iter().any(|adapter| adapter.consented);
    if reports.iter().any(|adapter| adapter.consented) {
        changed |= ensure_observer_config_after_consent(&mut state)?;
    }
    let (service_installed, service_running, service_error) = if should_reconcile_service {
        match agent_service::install() {
            Ok(report) => (report.installed, report.running, None),
            Err(error) => (false, false, Some(error)),
        }
    } else {
        (false, false, None)
    };
    if changed {
        save_ai_setup_state(&state)?;
    }
    let report = AiSetupReport {
        adapters: reports,
        observer_mode: "observe_only",
        service_error,
        service_installed,
        service_running,
    };
    if json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        println!("Observer mode: observe_only (production attribution disabled)");
        for adapter in &report.adapters {
            println!(
                "{}: {} · detected={} · consented={} · verification={:?}",
                adapter.agent,
                adapter.status,
                adapter.detected,
                adapter.consented,
                adapter.verification
            );
        }
        if should_reconcile_service {
            println!(
                "Watcher service: {}",
                if report.service_running {
                    "running"
                } else {
                    "not running"
                }
            );
        }
        if let Some(error) = &report.service_error {
            println!("Watcher setup warning: {error}");
        }
        if report
            .adapters
            .iter()
            .any(|adapter| adapter.status == "consent_required")
        {
            println!("No agent configuration was changed; rerun with --yes or use VS Code onboarding to grant consent.");
        }
    }
    Ok(())
}

fn run_ai_uninstall(agent: Option<&str>, all: bool, json: bool) -> Result<(), Box<dyn Error>> {
    let ids = selected_ai_setup_ids(agent, all)?;
    let mut state = load_ai_setup_state()?;
    let mut reports = Vec::with_capacity(ids.len());
    for id in ids {
        let removed = state.adapters.remove(id).is_some();
        reports.push(serde_json::json!({
            "agent": id,
            "status": if removed { "removed" } else { "not_configured" },
        }));
    }
    let observer_config_removed = if state.observer_config_owned && state.adapters.is_empty() {
        let path = observer_config_path()?;
        let removed = match fs::remove_file(path) {
            Ok(()) => true,
            Err(error) if error.kind() == io::ErrorKind::NotFound => false,
            Err(error) => return Err(error.into()),
        };
        state.observer_config_owned = false;
        removed
    } else {
        false
    };
    let (service_removed, service_error) = if state.adapters.is_empty() {
        match agent_service::uninstall() {
            Ok(_) => (true, None),
            Err(error) => (false, Some(error)),
        }
    } else {
        (false, None)
    };
    save_ai_setup_state(&state)?;
    if json {
        println!(
            "{}",
            serde_json::to_string_pretty(&serde_json::json!({
                "adapters": reports,
                "observer_config_removed": observer_config_removed,
                "service_removed": service_removed,
                "service_error": service_error,
            }))?
        );
    } else {
        for report in &reports {
            println!(
                "{}: {}",
                report["agent"].as_str().unwrap_or("unknown"),
                report["status"].as_str().unwrap_or("unknown")
            );
        }
        println!(
            "Only AtoAxis-owned registration/consent records were removed{}; agent configuration was preserved.",
            if observer_config_removed {
                " and the observer config"
            } else {
                ""
            }
        );
        if service_removed {
            println!("AtoAxis watcher service removed.");
        } else if let Some(error) = service_error {
            println!("Watcher removal warning: {error}");
        }
    }
    Ok(())
}

fn ai_discovery_context() -> Result<DiscoveryContext, Box<dyn Error>> {
    Ok(DiscoveryContext {
        home_dir: dirs::home_dir().ok_or("could not resolve home directory")?,
        config_override: None,
    })
}

fn print_ai_status(json: bool) -> Result<(), Box<dyn Error>> {
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
        println!("{}", serde_json::to_string_pretty(&reports)?);
    } else {
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

fn ensure_observer_config_after_consent(
    state: &mut AiSetupState,
) -> Result<bool, Box<dyn Error>> {
    let path = observer_config_path()?;
    if path.exists() {
        // A user-managed file wins. The compatibility parser still downgrades a
        // legacy `infer` value, but setup must not overwrite a file it does not own.
        return Ok(false);
    }
    let parent = path.parent().ok_or("observer config has no parent")?;
    fs::create_dir_all(parent)?;
    let temporary = path.with_extension(format!("toml.tmp-{}", std::process::id()));
    fs::write(
        &temporary,
        r#"# Managed by AtoAxis after explicit `ai setup` consent.
enabled = true
attribution_mode = "observe_only"
"#,
    )?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o600))?;
    }
    fs::rename(temporary, path)?;
    state.observer_config_owned = true;
    Ok(true)
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
    let context = ai_discovery_context()?;
    let observer = load_observer_config();
    let pending = match Queue::open() {
        Ok(queue) => queue.len()? as u32,
        Err(_) => 0,
    };
    let mut transcripts_watched = 0u32;
    let mut adapters = Vec::new();

    for (id, parser) in supported_ai_parsers() {
        let discoveries = parser.discover_sources(&context);
        let transcript_count = discoveries
            .iter()
            .filter(|result| matches!(result.state, DiscoveryState::TranscriptFound { .. }))
            .count() as u32;
        transcripts_watched += transcript_count;
        let detected = !discoveries
            .iter()
            .all(|result| matches!(result.state, DiscoveryState::NotInstalled));
        let diagnostic_code = if !detected {
            Some("not_installed".to_string())
        } else if transcript_count == 0 {
            Some("transcript_missing".to_string())
        } else {
            None
        };
        // Discovery is intentionally never promoted to LiveTested or Verified.
        // Those states require a fresh, privacy-reviewed live certification artifact;
        // checked-in fixtures and local file presence are not sufficient evidence.
        let verification = VerificationStatus::Scaffold;
        adapters.push(AdapterFreshness {
            agent: id.to_string(),
            detected,
            enabled: observer.enabled,
            verification,
            diagnostic_code,
            ..Default::default()
        });
    }

    let report = build_ai_diagnostics_report(
        chrono::Utc::now(),
        BrokerHealth {
            running: false,
            pending,
            ..Default::default()
        },
        ParserLagSummary {
            transcripts_watched,
            transcripts_behind: 0,
            max_lag_seconds: 0,
        },
        adapters,
    );

    if upload {
        if let Err(error) = api_client.send_ai_diagnostics(&report).await {
            eprintln!("Warning: diagnostics upload skipped: {error}");
        }
    }

    if json {
        println!("{}", serde_json::to_string_pretty(&report)?);
    } else {
        println!(
            "Observer: {} (production attribution: disabled)",
            if observer.enabled {
                "observe_only"
            } else {
                "off"
            }
        );
        println!("Offline queue: {pending} pending heartbeat(s)");
        for adapter in &report.adapters {
            println!(
                "{}: {} · verification={} · detected={} · enabled={}",
                adapter.agent,
                adapter.health_status(),
                serde_json::to_string(&adapter.verification)?.trim_matches('"'),
                adapter.detected,
                adapter.enabled
            );
        }
        if upload {
            println!("Diagnostics upload attempted (metadata-only)");
        }
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
                let mut heartbeats = Vec::with_capacity(new_events.len());
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
                    heartbeats.push(build_ai_heartbeat(config, event, active_seconds));
                }
                if !heartbeats.is_empty() {
                    let report = api_client.send_heartbeats(heartbeats.clone()).await?;
                    if verbose {
                        println!(
                            "  sent {} (deduped {}, queued {}, flushed {})",
                            report.sent, report.deduped, report.queued, report.flushed
                        );
                    }
                    if report.sent > 0 || report.queued > 0 {
                        agent_service::record_heartbeat();
                    }
                }
                for event in &new_events {
                    state.mark_delivered(&event.event_id, &cursor_key)?;
                    state.mark_fingerprint(
                        &normalize_entity(&event.entity.to_string_lossy())?,
                        event.occurred_at.timestamp_millis() as f64 / 1000.0,
                        event.lines_added.unwrap_or(0),
                        event.lines_deleted.unwrap_or(0),
                        Some(&event.event_id),
                    )?;
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
fn build_ai_heartbeat(config: &Config, event: &AiEditEvent, active_seconds: f64) -> Heartbeat {
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
        .or_else(|| {
            event
                .project_root
                .as_ref()
                .and_then(|root| root.file_name())
                .map(|name| name.to_string_lossy().into_owned())
        });
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

    if Path::new(&entity_path).exists() {
        if let Ok(source) = fs::read(&entity_path) {
            heartbeat.lines = Some(source.iter().filter(|&&b| b == b'\n').count() as u32 + 1);
            if let Some(ast) = detect(&entity_path, &source) {
                heartbeat.language = Some(ast.language.clone());
                heartbeat.ast_language = Some(ast.language);
                heartbeat.ast_confidence = Some(ast.confidence);
                heartbeat.dependencies = ast.dependencies;
            }
        }
    }

    heartbeat.is_ai_generated = true;
    heartbeat.ai_agent = Some(event.agent.clone());
    heartbeat.ai_provider = event.provider.clone();
    heartbeat.ai_model = event.model.clone();
    heartbeat.ai_source = Some(event.source.as_str().to_string());
    heartbeat.ai_confidence = Some(event.confidence.as_str().to_string());
    heartbeat.ai_event_id = Some(event.event_id.clone());
    heartbeat.ai_lines_added = event.lines_added;
    heartbeat.ai_lines_deleted = event.lines_deleted;
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
    heartbeat.project = project_override.or_else(|| git_info.as_ref().map(|g| g.project.clone()));
    heartbeat.branch = git_info.as_ref().map(|g| g.branch.clone());
    heartbeat.is_write = is_write;
    heartbeat.category = category;
    heartbeat.operating_system = std::env::consts::OS.to_string();
    heartbeat.machine = hostname::get()
        .ok()
        .and_then(|value| value.into_string().ok())
        .unwrap_or_else(|| "unknown".to_string());
    heartbeat.editor = detect_editor();

    if Path::new(&entity_path).exists() {
        let source = fs::read(&entity_path)?;
        heartbeat.lines = Some(source.iter().filter(|&&b| b == b'\n').count() as u32 + 1);
        if let Some(ast) = detect(&entity_path, &source) {
            heartbeat.language = Some(ast.language.clone());
            heartbeat.ast_language = Some(ast.language);
            heartbeat.ast_confidence = Some(ast.confidence);
            heartbeat.dependencies = ast.dependencies;
        }
    }

    if let Some(extra) = extra {
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
        // Presence of `ai_agent` is the whole signal — see the CLI flag's doc comment
        // for why there is no separate `is_ai_generated` flag to keep in sync with it.
        heartbeat.is_ai_generated = extra.ai_agent.is_some();
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
    let source = Some(if heartbeat.is_ai_generated {
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
        return Some(format!("dev:{}:ino:{}", metadata.dev(), metadata.ino()));
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
