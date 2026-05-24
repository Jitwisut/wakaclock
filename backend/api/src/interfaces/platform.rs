use anyhow::Result;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

/// Platform integration interface
#[async_trait]
pub trait PlatformIntegration: Send + Sync {
    /// Platform name
    fn name(&self) -> &str;

    /// Validate request
    async fn validate(&self, request: &IntegrationRequest) -> Result<()>;

    /// Prepare request for platform
    async fn prepare(&self, request: IntegrationRequest) -> Result<PreparedRequest>;

    /// Execute request against platform
    async fn execute(&self, request: PreparedRequest) -> Result<PlatformResponse>;

    /// Transform platform response
    async fn transform(&self, response: PlatformResponse) -> Result<IntegrationResponse>;

    /// Handle platform errors
    async fn handle_error(&self, error: &anyhow::Error) -> Result<ErrorResponse>;
}

/// Platform registry for managing integrations
pub struct PlatformRegistry {
    platforms: HashMap<String, Arc<dyn PlatformIntegration>>,
}

impl Default for PlatformRegistry {
    fn default() -> Self {
        Self::new()
    }
}

impl PlatformRegistry {
    pub fn new() -> Self {
        Self {
            platforms: HashMap::new(),
        }
    }

    pub fn register(&mut self, name: &str, platform: Arc<dyn PlatformIntegration>) {
        self.platforms.insert(name.to_string(), platform);
    }

    pub fn get(&self, name: &str) -> Option<Arc<dyn PlatformIntegration>> {
        self.platforms.get(name).cloned()
    }

    pub fn list(&self) -> Vec<String> {
        self.platforms.keys().cloned().collect()
    }
}

/// Integration request
#[derive(Debug, Clone)]
pub struct IntegrationRequest {
    pub platform: String,
    pub operation: String,
    pub data: serde_json::Value,
    pub headers: HashMap<String, String>,
    pub query_params: HashMap<String, String>,
}

/// Prepared request ready for execution
#[derive(Debug, Clone)]
pub struct PreparedRequest {
    pub url: String,
    pub method: String,
    pub headers: HashMap<String, String>,
    pub body: Option<Vec<u8>>,
    pub timeout_ms: u64,
}

/// Platform response
#[derive(Debug, Clone)]
pub struct PlatformResponse {
    pub status: u16,
    pub headers: HashMap<String, String>,
    pub body: Vec<u8>,
    pub latency_ms: u64,
}

/// Integration response
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct IntegrationResponse {
    pub success: bool,
    pub data: serde_json::Value,
    pub metadata: HashMap<String, String>,
    pub follow_up_tasks: Option<Vec<FollowUpTask>>,
}

/// Follow-up task
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct FollowUpTask {
    pub task_type: String,
    pub data: serde_json::Value,
    pub delay_ms: Option<u64>,
}

/// Error response
#[derive(Debug, Clone)]
pub struct ErrorResponse {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub retry_after_ms: Option<u64>,
}
