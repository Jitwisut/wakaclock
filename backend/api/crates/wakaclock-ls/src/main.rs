//! wakaclock-ls — LSP server for Zed IDE integration.
//!
//! Zed speaks the Language Server Protocol to editor integrations rather than exposing
//! a plugin API like VS Code's; this binary is the "editor client" for Zed the same way
//! `extensions/vscode` is for VS Code. It talks to `wakaclock-core` directly (heartbeat
//! construction, project detection, dedup, offline queue, API delivery) and to
//! `wakaclock-ast` for the same tree-sitter language detection the CLI uses — it does
//! not spawn `wakaclock-cli` as a child process, matching this workspace's crate
//! dependency graph (`wakaclock-ls` depends on `core` + `ast` directly, per plan.md).
//!
//! Event mapping, matching plan.md Phase 3's `didOpen/didChange/didSave → heartbeat`:
//!   - `textDocument/didOpen`  → one heartbeat immediately (`is_write: false`)
//!   - `textDocument/didChange` → buffered, not sent per-keystroke; a background task
//!     flushes one heartbeat per touched file every 30s, mirroring the VS Code
//!     extension's `wakaclock.flushIntervalSeconds` default so both clients behave the
//!     same way from the server's point of view.
//!   - `textDocument/didSave`  → one heartbeat immediately (`is_write: true`), and also
//!     clears that file's buffered/dirty state so the next periodic flush doesn't send
//!     a redundant second heartbeat for it.

use std::collections::{HashMap, HashSet};
use std::sync::Arc;
use std::time::Duration;

use tokio::sync::{mpsc, Mutex};
use tower_lsp::jsonrpc::Result as LspResult;
use tower_lsp::lsp_types::*;
use tower_lsp::{async_trait, Client, LanguageServer, LspService, Server};
use tracing::{info, warn};

use wakaclock_ast::detect;
use wakaclock_core::api_client::ApiClient;
use wakaclock_core::config::Config;
use wakaclock_core::git;
use wakaclock_core::heartbeat::{Category, EntityType, Heartbeat};

const FLUSH_INTERVAL: Duration = Duration::from_secs(30);

/// Runs `ApiClient::send_heartbeat` on a dedicated OS thread with its own
/// single-threaded runtime, and returns a channel to feed it heartbeats from anywhere.
///
/// Why this exists: `ApiClient` opens a `rusqlite::Connection`-backed offline queue
/// (`wakaclock-core`'s `Queue`) and holds a `&Queue` across an `.await` while flushing
/// it. `rusqlite::Connection` is `!Sync` (an internal `RefCell`-based statement cache),
/// so that `&Queue` is `!Send`, which makes `ApiClient::send_heartbeat`'s future `!Send`
/// end to end — inherent to `wakaclock-core`, and true for anyone calling it from a
/// context that requires a `Send` future, not something specific to this file.
///
/// tower-lsp's `LanguageServer` trait is `#[async_trait]`, which always boxes methods as
/// `Pin<Box<dyn Future<Output = T> + Send>>` — that requirement is baked into tower-lsp
/// itself, not something a runtime-flavor choice on this binary's side can opt out of.
/// So `send_heartbeat` cannot be called directly from inside an LSP handler.
///
/// The fix here is deliberately local to `wakaclock-ls` rather than a change to the
/// shared `wakaclock-core` crate (which `wakaclock-cli` and the planned Tauri app also
/// depend on): `Runtime::block_on` — unlike `tokio::spawn` — has no `Send` bound on the
/// future it runs, because it drives that future to completion on the calling thread
/// only. Isolating `ApiClient` to its own thread and `block_on`-ing it there sidesteps
/// the bound entirely. The channel's `Sender<Heartbeat>` is `Send + Sync + Clone`
/// regardless (`Heartbeat` itself is plain data — no interior mutability), so every LSP
/// handler can hold and use one freely.
fn spawn_heartbeat_worker(api_client: ApiClient) -> mpsc::UnboundedSender<Heartbeat> {
    let (tx, mut rx) = mpsc::unbounded_channel::<Heartbeat>();

    std::thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("wakaclock-ls: failed to start heartbeat worker runtime");

        runtime.block_on(async move {
            while let Some(heartbeat) = rx.recv().await {
                if let Err(error) = api_client.send_heartbeat(heartbeat).await {
                    warn!("wakaclock-ls: failed to send heartbeat: {error}");
                }
            }
        });
    });

    tx
}

/// Everything the periodic flush task needs, factored out of `Backend` so spawning that
/// task does not require wrapping `Backend` itself in an `Arc` — every field here is
/// already cheap to clone (`Arc`, or `Config`/`Client`/`UnboundedSender`, which are
/// themselves thin `Arc`-backed or channel-handle types).
#[derive(Clone)]
struct Shared {
    client: Client,
    config: Config,
    /// Delivery happens on a dedicated thread — see `spawn_heartbeat_worker`. Sending
    /// here is a plain, non-blocking channel push, not a network call.
    heartbeat_tx: mpsc::UnboundedSender<Heartbeat>,
    /// uri -> current buffer contents, kept in sync by didOpen/didChange/didClose since
    /// tower-lsp does not track document text itself.
    documents: Arc<Mutex<HashMap<Url, String>>>,
    /// URIs changed since the last periodic flush.
    dirty: Arc<Mutex<HashSet<Url>>>,
}

struct Backend {
    shared: Shared,
}

/// Mirrors `wakaclock-cli`'s `build_heartbeat` (see `crates/wakaclock-cli/src/main.rs`):
/// same project/branch resolution via `git::discover`, same AST-based language and
/// dependency detection, same fields populated. Kept as a free function taking only the
/// pieces it needs rather than a `&Backend` so it has no dependency on the LSP types.
fn build_heartbeat(config: &Config, uri: &Url, text: &str, is_write: bool) -> Option<Heartbeat> {
    let path = uri.to_file_path().ok()?;
    let entity = path.to_string_lossy().to_string();

    let mut heartbeat = Heartbeat::new(
        config.user_id,
        entity.clone(),
        EntityType::File,
        "wakaclock-ls/0.1".to_string(),
    );

    let git_info = git::discover(&entity);
    heartbeat.project = git_info.as_ref().map(|g| g.project.clone());
    heartbeat.branch = git_info.as_ref().map(|g| g.branch.clone());
    heartbeat.is_write = is_write;
    heartbeat.category = Category::Coding;
    heartbeat.operating_system = std::env::consts::OS.to_string();
    heartbeat.machine = hostname::get()
        .ok()
        .and_then(|value| value.into_string().ok())
        .unwrap_or_else(|| "unknown".to_string());
    heartbeat.editor = "Zed".to_string();
    heartbeat.lines = Some(text.lines().count().max(1) as u32);

    if let Some(ast) = detect(&entity, text.as_bytes()) {
        heartbeat.language = Some(ast.language.clone());
        heartbeat.ast_language = Some(ast.language);
        heartbeat.ast_confidence = Some(ast.confidence);
        heartbeat.dependencies = ast.dependencies;
    }

    Some(heartbeat)
}

impl Shared {
    /// Builds one heartbeat for `uri` and hands it to the delivery worker (see
    /// `spawn_heartbeat_worker`) if it both resolves to a real file path and passes its
    /// own validation — a `None`/invalid result here (e.g. an `untitled:` buffer, or a
    /// heartbeat missing required fields) is silently skipped rather than surfaced as an
    /// editor-visible error, matching the VS Code extension's behavior for the same
    /// class of "nothing to report yet" case.
    ///
    /// Handing off is a plain channel push, not a network call — this returns as soon as
    /// the heartbeat is queued, well before it is actually sent.
    async fn send_for(&self, uri: &Url, is_write: bool) {
        let text = {
            let documents = self.documents.lock().await;
            match documents.get(uri) {
                Some(text) => text.clone(),
                None => return,
            }
        };

        let Some(heartbeat) = build_heartbeat(&self.config, uri, &text, is_write) else {
            return;
        };

        if heartbeat.validate().is_err() {
            return;
        }

        // Only fails if the worker thread's receiver was dropped, which only happens if
        // that thread panicked — surface it once rather than resending, since retrying
        // into a channel with no receiver would just repeat the same failure forever.
        if self.heartbeat_tx.send(heartbeat).is_err() {
            warn!("wakaclock-ls: heartbeat worker is not running, dropping heartbeat");
            self.client
                .log_message(MessageType::WARNING, "Wakaclock: heartbeat worker stopped")
                .await;
        }
    }

    /// Runs for the lifetime of the server: every `FLUSH_INTERVAL`, sends one heartbeat
    /// per URI marked dirty since the last tick and clears the dirty set. This is the
    /// counterpart to the VS Code extension's `flushIntervalSeconds` timer — didChange
    /// fires far too often to send a heartbeat per event.
    async fn run_periodic_flush(self) {
        let mut interval = tokio::time::interval(FLUSH_INTERVAL);
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);

        loop {
            interval.tick().await;

            let uris: Vec<Url> = {
                let mut dirty = self.dirty.lock().await;
                dirty.drain().collect()
            };

            for uri in &uris {
                self.send_for(uri, false).await;
            }
        }
    }
}

#[async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, _params: InitializeParams) -> LspResult<InitializeResult> {
        Ok(InitializeResult {
            capabilities: ServerCapabilities {
                text_document_sync: Some(TextDocumentSyncCapability::Kind(
                    TextDocumentSyncKind::FULL,
                )),
                ..ServerCapabilities::default()
            },
            server_info: Some(ServerInfo {
                name: "wakaclock-ls".to_string(),
                version: Some(wakaclock_core::version().to_string()),
            }),
        })
    }

    async fn initialized(&self, _params: InitializedParams) {
        info!(
            "wakaclock-ls initialized, tracking user {}",
            self.shared.config.user_id
        );
        self.shared
            .client
            .log_message(MessageType::INFO, "Wakaclock is tracking this workspace")
            .await;
    }

    async fn shutdown(&self) -> LspResult<()> {
        Ok(())
    }

    async fn did_open(&self, params: DidOpenTextDocumentParams) {
        let uri = params.text_document.uri;
        let text = params.text_document.text;

        self.shared.documents.lock().await.insert(uri.clone(), text);
        self.shared.send_for(&uri, false).await;
    }

    async fn did_change(&self, mut params: DidChangeTextDocumentParams) {
        // Full sync (declared in `initialize`) means each notification carries exactly
        // one change event whose `text` is the entire new document — no incremental
        // range to apply.
        let Some(change) = params.content_changes.pop() else {
            return;
        };
        let uri = params.text_document.uri;

        self.shared
            .documents
            .lock()
            .await
            .insert(uri.clone(), change.text);
        self.shared.dirty.lock().await.insert(uri);
    }

    async fn did_save(&self, params: DidSaveTextDocumentParams) {
        let uri = params.text_document.uri;

        self.shared.send_for(&uri, true).await;
        self.shared.dirty.lock().await.remove(&uri);
    }

    async fn did_close(&self, params: DidCloseTextDocumentParams) {
        let uri = params.text_document.uri;

        self.shared.documents.lock().await.remove(&uri);
        self.shared.dirty.lock().await.remove(&uri);
    }
}

#[tokio::main]
async fn main() {
    // clippy's disallowed-methods rule bans raw stdout/stderr writes in favor of tracing
    // macros — this call isn't one of those; it configures the writer tracing's own
    // macros use. stdout is the LSP JSON-RPC transport for this process, so log output
    // has to go to stderr specifically, which requires naming it here once.
    #[allow(clippy::disallowed_methods)]
    tracing_subscriber::fmt()
        .with_writer(std::io::stderr)
        .init();

    let config = Config::load();
    let api_client = match ApiClient::new(config.clone()) {
        Ok(client) => client,
        Err(error) => {
            eprintln!("wakaclock-ls: failed to build API client: {error}");
            std::process::exit(1);
        }
    };
    let heartbeat_tx = spawn_heartbeat_worker(api_client);

    let stdin = tokio::io::stdin();
    let stdout = tokio::io::stdout();

    let (service, socket) = LspService::new(move |client| {
        let shared = Shared {
            client,
            config: config.clone(),
            heartbeat_tx: heartbeat_tx.clone(),
            documents: Arc::new(Mutex::new(HashMap::new())),
            dirty: Arc::new(Mutex::new(HashSet::new())),
        };

        // `Shared` is `Clone` (every field is an `Arc` or an `Arc`-backed handle), so the
        // flush task gets its own handle to the same underlying state without needing
        // `Backend` itself to be wrapped in an `Arc`.
        tokio::spawn(shared.clone().run_periodic_flush());

        Backend { shared }
    });

    Server::new(stdin, stdout, socket).serve(service).await;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_heartbeat_returns_none_for_a_non_file_uri() {
        let config = Config::default();
        let uri = Url::parse("untitled:Untitled-1").unwrap();

        assert!(build_heartbeat(&config, &uri, "fn main() {}", false).is_none());
    }

    #[test]
    fn build_heartbeat_populates_core_fields_for_a_file_uri() {
        let config = Config::default();
        let uri = Url::parse("file:///tmp/wakaclock-ls-test/example.rs").unwrap();

        let heartbeat = build_heartbeat(&config, &uri, "fn main() {}\n", false)
            .expect("a file:// URI should always produce a heartbeat");

        assert_eq!(heartbeat.user_id, config.user_id);
        assert_eq!(heartbeat.entity_type, EntityType::File);
        assert_eq!(heartbeat.category, Category::Coding);
        assert_eq!(heartbeat.editor, "Zed");
        assert!(!heartbeat.is_write);
        assert_eq!(heartbeat.lines, Some(1)); // a single trailing '\n' is not a second line
    }

    #[test]
    fn build_heartbeat_marks_is_write_when_asked() {
        let config = Config::default();
        let uri = Url::parse("file:///tmp/wakaclock-ls-test/example.rs").unwrap();

        let heartbeat = build_heartbeat(&config, &uri, "fn main() {}\n", true).unwrap();

        assert!(heartbeat.is_write);
    }

    #[test]
    fn build_heartbeat_detects_language_from_content() {
        let config = Config::default();
        let uri = Url::parse("file:///tmp/wakaclock-ls-test/example.rs").unwrap();

        let heartbeat = build_heartbeat(&config, &uri, "fn main() {}\n", false).unwrap();

        assert_eq!(heartbeat.language.as_deref(), Some("Rust"));
        assert_eq!(heartbeat.ast_language.as_deref(), Some("Rust"));
    }

    #[test]
    fn build_heartbeat_result_passes_its_own_validation() {
        let config = Config::default();
        let uri = Url::parse("file:///tmp/wakaclock-ls-test/example.rs").unwrap();

        let heartbeat = build_heartbeat(&config, &uri, "fn main() {}\n", false).unwrap();

        assert!(heartbeat.validate().is_ok());
    }
}
