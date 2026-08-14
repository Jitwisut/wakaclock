use clap::{Parser, Subcommand};
use serde::Deserialize;
use std::{
    error::Error,
    fs,
    io::{self, Read},
    path::{Path, PathBuf},
    str::FromStr,
};
use wakaclock_ast::detect;
use wakaclock_core::{
    api_client::ApiClient,
    config::Config,
    git,
    heartbeat::{Category, EntityType, Heartbeat},
    queue::Queue,
};

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

        #[arg(long, default_value_t = false)]
        extra_heartbeats: bool,
    },
    Config {
        #[command(subcommand)]
        action: Option<ConfigAction>,
    },
    Status,
    Today,
}

#[derive(Subcommand)]
enum ConfigAction {
    /// Save an API key generated from the Wakaclock dashboard into ~/.wakaclock/config.toml
    SetKey { key: String },
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
            extra_heartbeats,
        } => {
            let entity_type = EntityType::from_str(&entity_type)?;
            let category = Category::from_str(&category)?;
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
            };
            let primary = build_heartbeat(
                &config,
                &entity,
                entity_type,
                project,
                category,
                write,
                Some(primary_extra),
            )?;

            let mut heartbeats = vec![primary.clone()];
            if extra_heartbeats {
                let extras = read_extra_heartbeats()?;
                for extra in extras {
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
                    let heartbeat = build_heartbeat(
                        &config,
                        &resolved_entity,
                        resolved_entity_type,
                        resolved_project,
                        resolved_category,
                        extra.write.unwrap_or(false),
                        Some(extra),
                    )?;
                    heartbeats.push(heartbeat);
                }
            }

            let report = api_client.send_heartbeats(heartbeats).await?;
            println!("{}", identity_line(&config));
            println!("Sent: {}", report.sent);
            println!("Deduped: {}", report.deduped);
            println!("Queued: {}", report.queued);
            println!("Flushed: {}", report.flushed);
        }
        Commands::Config { action } => match action {
            None => {
                println!("Config path: {}", Config::config_path().display());
                println!("Server URL: {}", config.server_url);
                println!("{}", identity_line(&config));
            }
            Some(ConfigAction::SetKey { key }) => {
                // Persist to config.toml, independent of any WAKACLOCK_API_KEY env
                // override applied above — this always writes the on-disk value.
                let mut persisted = Config::load();
                persisted.api_key = Some(key);
                persisted.save();
                println!("API key saved to {}", Config::config_path().display());
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
            let flushed = api_client.flush_queue().await?;
            println!("Flushed now: {}", flushed);
        }
        Commands::Today => {
            let snapshot = api_client.today().await?;
            println!("Today: {}", snapshot.human_readable);
            println!("Total seconds: {}", snapshot.total_seconds);
            println!("Heartbeats: {}", snapshot.heartbeat_count);
        }
    }

    Ok(())
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
    }

    heartbeat.validate().map_err(io::Error::other)?;
    Ok(heartbeat)
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
fn identity_line(config: &Config) -> String {
    if config.api_key.is_some() {
        "Authenticated: yes (account resolved from API key)".to_string()
    } else {
        "Authenticated: no — run `wakaclock config set-key <KEY>`; requests will be rejected"
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
