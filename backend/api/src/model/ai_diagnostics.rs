//! Response shape for `GET /api/v1/users/current/ai_diagnostics` (planai2.md
//! p7.2c). The request body is `wakaclock_core::ai::AiDiagnosticsReport`
//! directly — the client's sanitized, metadata-only snapshot.

use serde::Serialize;
use wakaclock_core::ai::AiDiagnosticsReport;

#[derive(Debug, Serialize)]
pub struct AiDiagnosticsResponse {
    /// The newest snapshot the client pushed, or `None` if it never has (or the
    /// server restarted since — the store is process-local, see
    /// `services::ai_diagnostics`).
    pub report: Option<AiDiagnosticsReport>,
}
