use anyhow::Result;
use std::any::{Any, TypeId};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Service lifetime configuration
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum ServiceLifetime {
    /// Service is created once and reused (default)
    Singleton,
    /// New instance created for each request
    Transient,
    /// Service is created once per scope
    Scoped,
}

/// Trait for providing service instances
pub trait ServiceProvider: Send + Sync {
    /// Create a new instance of the service
    fn provide(&self, container: &ServiceContainer) -> Result<Arc<dyn Any + Send + Sync>>;

    /// Get the lifetime of this service
    fn lifetime(&self) -> ServiceLifetime {
        ServiceLifetime::Singleton
    }

    /// Get the TypeId of the service this provider creates
    fn service_type(&self) -> TypeId;
}

/// Factory function for creating services
pub type ServiceFactory =
    Arc<dyn Fn(&ServiceContainer) -> Result<Arc<dyn Any + Send + Sync>> + Send + Sync>;

/// Provider implementation using a factory function
pub struct FactoryProvider {
    factory: ServiceFactory,
    lifetime: ServiceLifetime,
    service_type: TypeId,
}

impl FactoryProvider {
    /// Create a new factory provider
    pub fn new<T: Any + Send + Sync>(factory: ServiceFactory, lifetime: ServiceLifetime) -> Self {
        Self {
            factory,
            lifetime,
            service_type: TypeId::of::<T>(),
        }
    }
}

impl ServiceProvider for FactoryProvider {
    fn provide(&self, container: &ServiceContainer) -> Result<Arc<dyn Any + Send + Sync>> {
        (self.factory)(container)
    }

    fn lifetime(&self) -> ServiceLifetime {
        self.lifetime
    }

    fn service_type(&self) -> TypeId {
        self.service_type
    }
}

/// Service container for dependency injection
pub struct ServiceContainer {
    /// Registered service providers
    providers: Arc<RwLock<HashMap<TypeId, Arc<dyn ServiceProvider>>>>,
    /// Cached singleton instances
    singletons: Arc<RwLock<HashMap<TypeId, Arc<dyn Any + Send + Sync>>>>,
    /// Core app dependencies (passed from App)
    pub app_context: Arc<AppContext>,
}

/// Core app context containing infrastructure components
pub struct AppContext {
    pub logger: Arc<crate::infrastructure::logger::Logger>,
    pub config: Arc<crate::config::Config>,
    pub clickhouse: Arc<crate::client::database::clickhouse::ClickHouseClient>,
    pub cache: Arc<dyn crate::infrastructure::cache::CacheManager>,
    pub queue: Arc<dyn crate::infrastructure::queue::MessageQueue>,
    pub validator: Arc<crate::infrastructure::validator::Validator>,
}

impl ServiceContainer {
    /// Create a new service container
    pub fn new(app_context: Arc<AppContext>) -> Self {
        Self {
            providers: Arc::new(RwLock::new(HashMap::new())),
            singletons: Arc::new(RwLock::new(HashMap::new())),
            app_context,
        }
    }

    /// Register a service provider
    pub async fn register<T: Any + Send + Sync>(&self, provider: Arc<dyn ServiceProvider>) {
        let mut providers = self.providers.write().await;
        providers.insert(TypeId::of::<T>(), provider);
    }

    /// Register a singleton service with a factory
    pub async fn register_singleton<T: Any + Send + Sync>(
        &self,
        factory: impl Fn(&ServiceContainer) -> Result<Arc<T>> + Send + Sync + 'static,
    ) {
        let factory_wrapper: ServiceFactory =
            Arc::new(move |container| factory(container).map(|s| s as Arc<dyn Any + Send + Sync>));

        let provider = Arc::new(FactoryProvider::new::<T>(
            factory_wrapper,
            ServiceLifetime::Singleton,
        ));

        self.register::<T>(provider).await;
    }

    /// Register a transient service with a factory
    pub async fn register_transient<T: Any + Send + Sync>(
        &self,
        factory: impl Fn(&ServiceContainer) -> Result<Arc<T>> + Send + Sync + 'static,
    ) {
        let factory_wrapper: ServiceFactory =
            Arc::new(move |container| factory(container).map(|s| s as Arc<dyn Any + Send + Sync>));

        let provider = Arc::new(FactoryProvider::new::<T>(
            factory_wrapper,
            ServiceLifetime::Transient,
        ));

        self.register::<T>(provider).await;
    }

    /// Resolve a service from the container
    pub async fn resolve<T: Any + Send + Sync>(&self) -> Result<Arc<T>> {
        let type_id = TypeId::of::<T>();

        // Get the provider
        let provider = {
            let providers = self.providers.read().await;
            providers.get(&type_id).cloned().ok_or_else(|| {
                anyhow::anyhow!("Service not registered: {}", std::any::type_name::<T>())
            })?
        };

        // Check lifetime and handle accordingly
        match provider.lifetime() {
            ServiceLifetime::Singleton => {
                // Check if already cached
                {
                    let singletons = self.singletons.read().await;
                    if let Some(service) = singletons.get(&type_id) {
                        return service
                            .downcast_ref::<Arc<T>>()
                            .cloned()
                            .ok_or_else(|| anyhow::anyhow!("Failed to downcast service"));
                    }
                }

                // Create and cache the singleton
                let service = provider.provide(self)?;

                // Clone for caching
                let service_clone = service.clone();

                let typed_service = service
                    .downcast::<Arc<T>>()
                    .map_err(|_| anyhow::anyhow!("Failed to downcast service"))?;

                let mut singletons = self.singletons.write().await;
                singletons.insert(type_id, service_clone);

                Ok(typed_service.as_ref().clone())
            }
            ServiceLifetime::Transient => {
                // Always create a new instance
                let service = provider.provide(self)?;
                service
                    .downcast::<Arc<T>>()
                    .map(|s| s.as_ref().clone())
                    .map_err(|_| anyhow::anyhow!("Failed to downcast service"))
            }
            ServiceLifetime::Scoped => {
                // For now, treat as transient (scope management can be added later)
                let service = provider.provide(self)?;
                service
                    .downcast::<Arc<T>>()
                    .map(|s| s.as_ref().clone())
                    .map_err(|_| anyhow::anyhow!("Failed to downcast service"))
            }
        }
    }

    /// Try to resolve a service, returning None if not registered
    pub async fn try_resolve<T: Any + Send + Sync>(&self) -> Option<Arc<T>> {
        self.resolve::<T>().await.ok()
    }

    /// Clear all cached singleton instances
    pub async fn clear_singletons(&self) {
        let mut singletons = self.singletons.write().await;
        singletons.clear();
    }
}

// Re-export provider implementations
pub mod platform;
pub mod product;
pub mod vector;
pub mod webhook;

pub use platform::PlatformServiceProvider;
pub use product::ProductServiceProvider;
pub use vector::VectorServiceProvider;
pub use webhook::WebhookServiceProvider;
