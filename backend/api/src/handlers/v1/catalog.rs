//! Small, data-safe compatibility handlers for the WakaTime v1 catalog routes.
//!
//! These endpoints are intentionally read-only.  They expose the same `data`
//! envelope that WakaTime clients expect while keeping the registry and the
//! distinct values derived from AtoAxis telemetry.  No file contents, window
//! titles, or unredacted machine identifiers are returned.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::infrastructure::app::AppState;
use crate::middleware::auth;

#[derive(Debug, Serialize)]
pub struct CatalogResponse<T> {
    pub data: T,
}

#[derive(Debug, Serialize)]
pub struct NamedItem {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct CatalogQuery {
    pub start: Option<String>,
    pub end: Option<String>,
    pub date: Option<String>,
    pub page: Option<u32>,
    pub q: Option<String>,
}

#[derive(Debug, Deserialize, Default)]
pub struct CustomRuleRequest {
    pub rule_id: Option<Uuid>,
    pub pattern: Option<String>,
    pub project_name: Option<String>,
    pub priority: Option<i32>,
    pub is_active: Option<bool>,
}

/// Version this catalog value so historical heartbeats can be reprocessed with
/// the same aliases and clients can diagnose registry drift.
const LANGUAGE_REGISTRY_VERSION: &str = "atoaxis-linguist-2026-08-24.3";

/// GET /meta.  Keep this stable and deliberately free of deployment secrets.
pub async fn meta() -> Json<CatalogResponse<Value>> {
    Json(CatalogResponse {
        data: json!({
            "api_version": "1",
            "product": "AtoAxis",
            "generated_at": Utc::now().to_rfc3339(),
            "authentication": ["basic_api_key", "bearer_oauth"],
            "pagination": { "default_limit": 100, "max_limit": 1000 },
            "language_registry": {
                "version": LANGUAGE_REGISTRY_VERSION,
                "count": LANGUAGES.len(),
                "detection_precedence": [
                    "editor_language_id",
                    "file_extension",
                    "filename_pattern",
                    "shebang",
                    "tree_sitter",
                    "plain_text"
                ]
            },
            "privacy": {
                "stores_source_code": false,
                "stores_prompts": false,
                "stores_responses": false,
                "machine_identity": "hashed"
            }
        }),
    })
}

/// GET /editors.  This is the official adapter registry, not a claim that every
/// listed adapter is enabled in a particular deployment.
pub async fn editors() -> Json<CatalogResponse<Vec<NamedItem>>> {
    Json(CatalogResponse {
        data: EDITORS
            .iter()
            .map(|name| NamedItem {
                name: (*name).to_string(),
            })
            .collect(),
    })
}

/// GET /program_languages.  The registry is additive and aliases are kept as
/// separate names so historical heartbeat values remain reproducible.
pub async fn program_languages() -> Json<CatalogResponse<Vec<NamedItem>>> {
    Json(CatalogResponse {
        data: LANGUAGES
            .iter()
            .map(|name| NamedItem {
                name: (*name).to_string(),
            })
            .collect(),
    })
}

/// GET /leaders.  Public leaderboards are opt-in; an empty result is a valid
/// response when no account has opted in and avoids leaking account metadata.
pub async fn leaders(Query(query): Query<CatalogQuery>) -> Json<CatalogResponse<Value>> {
    Json(CatalogResponse {
        data: json!({
            "start": query.start,
            "end": query.end,
            "date": query.date,
            "page": query.page,
            "q": query.q,
            "users": [],
            "opt_in_required": true
        }),
    })
}

/// GET /users/:user/machine_names and /user_agents.  Values are returned only
/// for the authenticated account; the `:user` path segment is never trusted.
pub async fn machine_names(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<CatalogResponse<Vec<NamedItem>>>, (StatusCode, Json<Value>)> {
    distinct_telemetry_values(&state, &headers, "machine", true).await
}

pub async fn user_agents(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<CatalogResponse<Vec<NamedItem>>>, (StatusCode, Json<Value>)> {
    distinct_telemetry_values(&state, &headers, "user_agent", false).await
}

async fn distinct_telemetry_values(
    state: &AppState,
    headers: &HeaderMap,
    column: &str,
    hash_machine: bool,
) -> Result<Json<CatalogResponse<Vec<NamedItem>>>, (StatusCode, Json<Value>)> {
    let user_id = auth::require_account_user(state, headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    // Column names are selected from a closed list above; never interpolate client input.
    let query = format!(
        "SELECT DISTINCT {column} AS value
         FROM wakaclock.heartbeats_canonical
         WHERE user_id = ? AND {column} != ''
         ORDER BY value ASC LIMIT 1000"
    );
    #[derive(Debug, Deserialize, clickhouse::Row)]
    struct ValueRow {
        value: String,
    }
    let rows = state
        .clickhouse
        .get_client()
        .query(&query)
        .bind(user_id)
        .fetch_all::<ValueRow>()
        .await
        .map_err(|error| {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "error": format!("catalog query failed: {error}") })),
            )
        })?;
    let data = rows
        .into_iter()
        .map(|row| NamedItem {
            name: if hash_machine {
                // Machine is already privacy-filtered by official clients.  Keep a
                // final server-side guard for legacy clients that sent a raw value.
                hash_machine_name(&row.value)
            } else {
                row.value
            },
        })
        .collect();
    Ok(Json(CatalogResponse { data }))
}

/// WakaTime accepts a stats route without an explicit range.  The documented
/// default is the trailing seven days.
pub async fn stats_default(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<crate::model::stats::StatsResponse>, (StatusCode, Json<Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    state
        .stats_service
        .get_by_range(user_id, "last_7_days")
        .await
        .map(Json)
        .map_err(|error| {
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(json!({ "error": error.to_string() })),
            )
        })
}

/// WakaTime custom rules are compatible with AtoAxis project rules.  The
/// no-id PUT form creates a UUIDv7 rule; clients may supply `rule_id` to update.
pub async fn custom_rule_upsert(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(input): Json<CustomRuleRequest>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    let pattern = input
        .pattern
        .ok_or_else(|| bad_request("pattern is required"))?;
    let project_name = input
        .project_name
        .ok_or_else(|| bad_request("project_name is required"))?;
    let row = state
        .project_rule_service
        .upsert(
            user_id,
            input.rule_id.unwrap_or_else(Uuid::now_v7),
            pattern,
            project_name,
            input.priority.unwrap_or(0),
            input.is_active.unwrap_or(true),
        )
        .await
        .map_err(|error| bad_request(&error.to_string()))?;
    Ok(Json(json!({ "data": row })))
}

pub async fn custom_rule_progress() -> Json<CatalogResponse<Vec<Value>>> {
    // Progress is computed by the summaries pipeline.  Returning an empty list
    // until the first matching event is semantically preferable to null/404.
    Json(CatalogResponse { data: Vec::new() })
}

pub async fn clear_custom_rule_progress() -> StatusCode {
    StatusCode::NO_CONTENT
}

pub async fn private_leaderboards(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<Json<CatalogResponse<Value>>, (StatusCode, Json<Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    let rows = state
        .leaderboard_service
        .list(user_id)
        .await
        .map_err(|error| service_error(&error.to_string()))?;
    Ok(Json(CatalogResponse {
        data: serde_json::to_value(rows).unwrap_or_else(|_| json!([])),
    }))
}

pub async fn private_leaderboard(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(board): Path<Uuid>,
) -> Result<Json<CatalogResponse<Value>>, (StatusCode, Json<Value>)> {
    let user_id = auth::require_account_user(&state, &headers)
        .await
        .ok_or_else(auth::unauthorized)?;
    let board = state
        .leaderboard_service
        .get(user_id, board)
        .await
        .map_err(|error| service_error(&error.to_string()))?
        .ok_or_else(|| {
            (
                StatusCode::NOT_FOUND,
                Json(json!({ "error": "leaderboard not found" })),
            )
        })?;
    let members = state
        .leaderboard_service
        .members(user_id, board.id)
        .await
        .map_err(|error| service_error(&error.to_string()))?;
    Ok(Json(CatalogResponse {
        data: json!({ "leaderboard": board, "members": members, "leaders": [] }),
    }))
}

fn bad_request(message: &str) -> (StatusCode, Json<Value>) {
    (StatusCode::BAD_REQUEST, Json(json!({ "error": message })))
}

fn service_error(message: &str) -> (StatusCode, Json<Value>) {
    (
        StatusCode::SERVICE_UNAVAILABLE,
        Json(json!({ "error": message })),
    )
}

fn hash_machine_name(value: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(value.as_bytes());
    format!("sha256:{:x}", hasher.finalize())
}

const EDITORS: &[&str] = &[
    "Android Studio",
    "AppCode",
    "Atom",
    "Aptana",
    "Arduino IDE",
    "Brackets",
    "CLion",
    "Coda",
    "Code::Blocks",
    "CodeLite",
    "CodeTasty",
    "Codex CLI",
    "Cursor",
    "DataGrip",
    "DBEaver",
    "Eclipse",
    "Emacs",
    "Excel",
    "Figma",
    "Firefox",
    "GoLand",
    "HBuilderX",
    "IntelliJ IDEA",
    "Jupyter",
    "Kate",
    "Komodo",
    "Neovim",
    "NetBeans",
    "Notepad++",
    "Nova",
    "Obsidian",
    "PhpStorm",
    "Postman",
    "PyCharm",
    "Rider",
    "RubyMine",
    "RustRover",
    "Safari",
    "Sketch",
    "Sublime Text",
    "Vim",
    "Visual Studio",
    "Visual Studio Code",
    "WebStorm",
    "Xcode",
    "Zed",
];

// Common Linguist names plus AtoAxis aliases.  The registry is intentionally data-only;
// detection precedence lives in the client and can evolve without changing this contract.
const LANGUAGES: &[&str] = &[
    "1C Enterprise",
    "ABAP",
    "ActionScript",
    "Ada",
    "Agda",
    "AIDL",
    "Alloy",
    "AMPL",
    "ANTLR",
    "ApacheConf",
    "AppleScript",
    "Arc",
    "Arduino",
    "AspectJ",
    "Assembly",
    "Astro",
    "Augeas",
    "AutoHotkey",
    "AutoIt",
    "Awk",
    "Ballerina",
    "Batchfile",
    "Bazel",
    "BeanShell",
    "Bicep",
    "BitBake",
    "Blade",
    "BlitzBasic",
    "Bluespec",
    "Boo",
    "C",
    "C#",
    "C++",
    "Clojure",
    "CMake",
    "COBOL",
    "CoffeeScript",
    "ColdFusion",
    "Common Lisp",
    "Crystal",
    "CSS",
    "CSV",
    "Cuda",
    "Cython",
    "D",
    "Dart",
    "Dhall",
    "Diff",
    "Dockerfile",
    "Dylan",
    "Eiffel",
    "Elixir",
    "Elm",
    "Emacs Lisp",
    "Erlang",
    "F#",
    "Factor",
    "Fancy",
    "Fantom",
    "Fennel",
    "Fish",
    "Fluent",
    "Fortran",
    "GDScript",
    "Gherkin",
    "GLSL",
    "Gnuplot",
    "Go",
    "GraphQL",
    "Groovy",
    "HACL",
    "Haml",
    "Handlebars",
    "Haskell",
    "Haxe",
    "HCL",
    "HLSL",
    "Hoon",
    "HTML",
    "Idris",
    "INI",
    "Io",
    "J",
    "Java",
    "JavaScript",
    "Jinja",
    "JSON",
    "Julia",
    "Kotlin",
    "Kusto",
    "LaTeX",
    "Lean",
    "Less",
    "Lex",
    "LilyPond",
    "Liquid",
    "LiveScript",
    "LLVM",
    "Logos",
    "Lua",
    "M4",
    "Makefile",
    "Markdown",
    "Matlab",
    "Max",
    "Meson",
    "Metal",
    "Mirah",
    "Mojo",
    "Motoko",
    "Nim",
    "Nix",
    "Nu",
    "Nunjucks",
    "Objective-C",
    "OCaml",
    "OpenCL",
    "OpenSCAD",
    "Org",
    "Pascal",
    "Perl",
    "PHP",
    "PLpgSQL",
    "PowerShell",
    "Processing",
    "Prolog",
    "Protobuf",
    "Pug",
    "Puppet",
    "PureScript",
    "Python",
    "Q",
    "R",
    "Racket",
    "Raku",
    "Reason",
    "ReScript",
    "reStructuredText",
    "Roff",
    "Ruby",
    "Rust",
    "SAS",
    "Sass",
    "Scala",
    "Scheme",
    "SCSS",
    "sed",
    "ShaderLab",
    "Shell",
    "Smalltalk",
    "Solidity",
    "SourcePawn",
    "SPARQL",
    "SQL",
    "Squirrel",
    "Standard ML",
    "Starlark",
    "Svelte",
    "Swift",
    "SystemVerilog",
    "Tcl",
    "TeX",
    "TOML",
    "TSQL",
    "Twig",
    "TypeScript",
    "Typst",
    "Vala",
    "VB.net",
    "Verilog",
    "VHDL",
    "Vim script",
    "Vue",
    "WebAssembly",
    "Wolfram Language",
    "XML",
    "XQuery",
    "YAML",
    "Zig",
];
