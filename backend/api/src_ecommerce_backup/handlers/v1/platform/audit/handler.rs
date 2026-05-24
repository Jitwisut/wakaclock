use axum::Router;
use std::sync::Arc;

use super::logs::handler::AuditLogsHandler;
use super::stat::handler::AuditStatsHandler;
use crate::AppState;

/// Product API Handler
///
/// Manages all product-related routes including CRUD and sync operations.
/// This handler provides:
/// - Product CRUD operations
/// - Synchronization with platforms
/// - Vector search integration
/// - Job management
pub struct AuditHandler {
    state: Arc<AppState>,
}

impl AuditHandler {
    /// Create a new Product handler instance
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Build and return the router with all product routes
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// Register all product routes
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            // Product CRUD routes
            .nest("/stats", AuditStatsHandler::new(self.state.clone()).build())
            .nest("/logs", AuditLogsHandler::new(self.state.clone()).build())
            .with_state(self.state.clone())
    }
}
