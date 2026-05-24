use super::ServiceContainer;

/// Provider for webhook-related services
pub struct WebhookServiceProvider;

impl WebhookServiceProvider {
    /// Register all webhook-related services
    pub async fn register(_container: &ServiceContainer) {
        // Note: Webhook service requires MySQL configuration.
        // Registration will be added when MySQL support is configured.
    }
}
