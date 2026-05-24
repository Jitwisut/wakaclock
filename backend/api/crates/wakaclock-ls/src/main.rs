//! wakaclock-ls — LSP server for Zed IDE integration
//!
//! Uses tower-lsp to provide heartbeat tracking via LSP protocol.
//! Zed connects to this server for coding time tracking.

fn main() {
    println!("wakaclock-ls v{}", wakaclock_core::version());
    println!("LSP server not yet implemented (Phase 3)");
    // TODO: Phase 3 — tower-lsp server with didOpen/didChange/didSave handlers
}
