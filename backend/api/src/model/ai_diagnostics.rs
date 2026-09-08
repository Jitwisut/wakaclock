//! API response shape for the latest metadata-only AI diagnostics snapshot.

use serde::Serialize;
use wakaclock_core::ai::{AiDiagnosticsReport, AiDiagnosticsReportV2};

#[derive(Debug, Serialize)]
pub struct AiDiagnosticsResponse {
    pub report: Option<AiDiagnosticsReport>,
}

#[derive(Debug, Serialize)]
pub struct AiDiagnosticsV2Response {
    pub reports: Vec<AiDiagnosticsReportV2>,
    /// `postgres` means the snapshot survives an API restart; `ephemeral` means
    /// this compatibility deployment keeps it in process memory only.
    pub storage: &'static str,
}
