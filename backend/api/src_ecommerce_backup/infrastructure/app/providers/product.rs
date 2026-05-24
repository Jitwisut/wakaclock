use super::ServiceContainer;

/// Provider for product-related services
pub struct ProductServiceProvider;

impl ProductServiceProvider {
    /// Register all product-related services
    pub async fn register(_container: &ServiceContainer) {
        // Note: Product services require refactoring to accept dependencies via constructor
        // instead of requiring the full AppState. Registration will be added after refactoring.
    }
}
