//! API response shape for the latest metadata-only AI diagnostics snapshot.

use serde::Serialize;
use wakaclock_core::ai::AiDiagnosticsReport;

#[derive(Debug, Serialize)]
pub struct AiDiagnosticsResponse {
    pub report: Option<AiDiagnosticsReport>,
}
