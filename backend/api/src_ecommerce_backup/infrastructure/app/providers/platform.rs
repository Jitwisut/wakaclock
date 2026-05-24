use std::sync::Arc;

use crate::interfaces::platform::PlatformRegistry;

use super::ServiceContainer;

/// Provider for platform-related services
pub struct PlatformServiceProvider;

impl PlatformServiceProvider {
    /// Register all platform-related services
    pub async fn register(container: &ServiceContainer) {
        // Register PlatformRegistry as singleton
        container
            .register_singleton::<PlatformRegistry>(|_container| {
                Ok(Arc::new(PlatformRegistry::new()))
            })
            .await;

        // Note: GatewayFactory registration would require refactoring the existing
        // GatewayFactoryImpl to accept dependencies via constructor
        // For now, we'll skip this registration until the service is refactored
    }
}
