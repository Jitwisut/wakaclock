use super::ServiceContainer;

/// Provider for vector/AI-related services
pub struct VectorServiceProvider;

impl VectorServiceProvider {
    /// Register all vector-related services
    pub async fn register(_container: &ServiceContainer) {
        // Note: Vector service requires refactoring to accept dependencies via constructor.
        // Registration will be added after refactoring.
    }
}
