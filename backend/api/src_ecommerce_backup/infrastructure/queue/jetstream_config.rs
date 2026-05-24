//! Subject helper utilities for queue routing keys.
//! Historically this file defined NATS JetStream configuration; it now provides
//! subject builders that are backend-agnostic so other modules can reuse the
//! routing patterns.

/// Subject builders for type-safe subject generation
pub struct SubjectBuilder;

impl SubjectBuilder {
    /// List request subject: sync.products.list.request.{tenant}.{platform}
    pub fn list_request(tenant_id: &str, platform: &str) -> String {
        format!("sync.products.list.request.{}.{}", tenant_id, platform)
    }

    /// Detail request subject: sync.products.detail.request.{tenant}.{platform}
    pub fn detail_request(tenant_id: &str, platform: &str) -> String {
        format!("sync.products.detail.request.{}.{}", tenant_id, platform)
    }

    /// List progress subject: sync.products.list.progress.{tenant}.{platform}
    pub fn list_progress(tenant_id: &str, platform: &str) -> String {
        format!("sync.products.list.progress.{}.{}", tenant_id, platform)
    }

    /// Detail progress subject: sync.products.detail.progress.{tenant}.{platform}
    pub fn detail_progress(tenant_id: &str, platform: &str) -> String {
        format!("sync.products.detail.progress.{}.{}", tenant_id, platform)
    }

    /// List dead-letter queue subject
    pub fn list_dlq() -> String {
        "sync.products.list.dlq".to_string()
    }

    /// Detail dead-letter queue subject
    pub fn detail_dlq() -> String {
        "sync.products.detail.dlq".to_string()
    }
}
