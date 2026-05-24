/// Platform API Documentation - เอกสาร API สำหรับ Platform
///
/// โมดูลนี้จัดการการสร้างและจัดการ OpenAPI documentation สำหรับ Platform API
/// รวมถึง endpoints สำหรับการจัดการสินค้า, inventory sync, และ marketplace operations
///
/// # Features
/// - การกำหนด OpenAPI specification สำหรับ platform-specific operations
/// - Security schemes: JWT, x-auth-token, และ X-API-Key
/// - API endpoint documentation สำหรับ shop management และ product operations
/// - Interactive documentation ผ่าน Scalar UI
/// - Multi-environment server configuration
use crate::model::v1::platfrom::{
    request::{product as product_requests, queries::product_queries},
    response::product as product_responses,
};
use utoipa::{
    openapi::security::{ApiKey, ApiKeyValue, HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};

/// โครงสร้างเอกสาร Platform API
///
/// กำหนดโครงสร้างหลักของ OpenAPI specification สำหรับ Platform API
/// รวมถึง metadata, endpoints, schemas, security requirements และ tags
///
/// # API Categories
/// - **Shop Management** - การเชื่อมต่อและ OAuth management
/// - **Product Operations** - การจัดการสินค้าและ CRUD operations
/// - **Sync Operations** - การซิงค์ข้อมูลข้ามแพลตฟอร์ม
/// - **Inventory Management** - การจัดการสต็อกสินค้า
/// - **Bulk Operations** - การดำเนินการแบบเป็นชุด
/// - **Search & Filtering** - การค้นหาและกรองข้อมูล
///
/// **หมายเหตุ**: Platform handlers ยังไม่มี Utoipa annotations
/// โครงสร้างนี้เป็น placeholder ที่สามารถขยายได้ในอนาคต
#[derive(OpenApi)]
#[openapi(
    info(
        title = "E-Commerce Platform API",
        version = "2.4.0",
        description = "Platform-specific API for product management, inventory sync, and marketplace operations",
        contact(
            name = "Platform Team",
            email = "platform@ecommerce-connect.com"
        ),
        license(
            name = "MIT"
        )
    ),
    servers(
        (url = "/api/v1/{app_name}/platform", description = "Platform API server", variables(
            ("app_name" = (default = "app_name", description = "Application name from configuration"))
        ))
    ),
    paths(
        crate::handlers::v1::platform::shop::handler::connect_platform,
        crate::handlers::v1::platform::shop::handler::platform_callback,
        crate::handlers::v1::platform::shop::handler::test_connection,
        crate::handlers::v1::platform::product::product::list_products,
        crate::handlers::v1::platform::product::product::get_product,
        crate::handlers::v1::platform::product::product::list_unique_products,
        crate::handlers::v1::platform::product::product::get_product_detail,
        crate::handlers::v1::platform::product::product::sync_to_vector,
        crate::handlers::v1::platform::product::product::sample_vector_sync,
        crate::handlers::v1::platform::product::product::sync_products,
        crate::handlers::v1::platform::product::product::sync_platform_products,
        crate::handlers::v1::platform::product::product::fetch_platform_products,
        crate::handlers::v1::platform::product::product::realtime_sync_products,
        crate::handlers::v1::platform::product::product::list_product_snapshots,
        crate::handlers::v1::platform::product::product::get_sync_logs,
        crate::handlers::v1::platform::product::product::get_synced_products,
        crate::handlers::v1::platform::product::product::upload_product_media,
        crate::handlers::v1::platform::product::product::download_product_media,
        crate::handlers::v1::platform::product::product::sync_products_extended,
        crate::handlers::v1::platform::product::product::get_sync_status,
        crate::handlers::v1::platform::product::product::get_sync_job_status,
        crate::handlers::v1::platform::product::product::list_sync_jobs,
        crate::handlers::v1::platform::product::product::cancel_sync_job,
    ),
    components(
        schemas(
            crate::handlers::v1::platform::shop::handler::ConnectRequestV1,
            crate::handlers::v1::platform::shop::handler::CallbackRequest,
            crate::handlers::v1::platform::shop::handler::ConnectionResponse,
            crate::handlers::v1::platform::shop::handler::CallbackResponse,
            crate::handlers::v1::platform::shop::handler::TestConnectionRequest,
            crate::handlers::v1::platform::shop::handler::TestConnectionResponse,
            crate::model::v1::gateway::request::product::CreateProductRequest,
            crate::model::v1::gateway::request::product::UpdateProductRequest,
            product_requests::RealtimeSyncRequest,
            product_requests::SampleVectorSyncRequest,
            product_requests::SyncToVectorRequest,
            product_requests::SyncProductsRequest,
            product_requests::SyncRequestBody,
            product_queries::ListProductsQuery,
            product_queries::GetProductQuery,
            product_requests::ListSyncJobsQuery,
            product_requests::ProductListQuery,
            product_requests::ProductSnapshotQuery,
            product_requests::ProductSyncLogQuery,
            product_requests::ProductMediaUploadRequest,
            product_requests::ProductMediaDownloadQuery,
            product_requests::SyncQuery,
            product_responses::ProductListResponse,
            product_responses::ProductListItem,
            product_responses::ProductDetail,
            product_responses::SyncResponse,
            product_responses::SyncToVectorResponse,
            product_responses::SampleVectorSyncResponse,
            product_responses::SyncProductsResponse,
            product_responses::SyncProductListResponse,
            product_responses::ProductSnapshotListResponse,
            product_responses::ProductSyncLogResponse,
            product_responses::ProductMediaUploadResponse,
            product_responses::ProductMediaDownloadResponse,
            crate::services::platform_product::ProductSyncStatusResponse,
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "shop", description = "Shop connection and OAuth management"),
        (name = "products", description = "Product management operations"),
        (name = "sync", description = "Product synchronization across platforms"),
        (name = "inventory", description = "Inventory management"),
        (name = "bulk", description = "Bulk operations on products"),
        (name = "search", description = "Product search and filtering"),
    )
)]
pub struct PlatformApiDoc;

/// การตั้งค่าความปลอดภัยสำหรับ Platform API
///
/// เพิ่ม security schemes ให้กับ OpenAPI specification
/// สนับสนุน JWT Bearer token, x-auth-token header, และ X-API-Key
struct SecurityAddon;

impl Modify for SecurityAddon {
    fn modify(&self, openapi: &mut utoipa::openapi::OpenApi) {
        if let Some(components) = openapi.components.as_mut() {
            components.add_security_scheme(
                "bearer_auth",
                SecurityScheme::Http(
                    HttpBuilder::new()
                        .scheme(HttpAuthScheme::Bearer)
                        .bearer_format("JWT")
                        .description(Some("JWT Bearer token for authentication"))
                        .build(),
                ),
            );

            components.add_security_scheme(
                "x_auth_token",
                SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("x-auth-token"))),
            );

            components.add_security_scheme(
                "api_key",
                SecurityScheme::ApiKey(ApiKey::Header(ApiKeyValue::new("X-API-Key"))),
            );
        }
    }
}

/// สร้าง Platform OpenAPI JSON specification
///
/// สร้าง JSON string ของ OpenAPI specification สำหรับ Platform API
/// พร้อมการแทนที่ server URL ด้วย app_name จริง
///
/// # Arguments
/// * `app_name` - ชื่อแอปพลิเคชั่นที่จะใช้ใน URL path
///
/// # Returns
/// String - JSON representation ของ OpenAPI specification
///
/// # Usage
/// ```rust
/// let json_spec = generate_platform_openapi_json("my_app");
/// // ใช้สำหรับ serve ผ่าน HTTP endpoint หรือเขียนไฟล์
/// ```
pub fn build_platform_openapi(app_name: &str) -> utoipa::openapi::OpenApi {
    let mut openapi = PlatformApiDoc::openapi();

    // Update the server URL with the actual app_name
    if let Some(servers) = openapi.servers.as_mut() {
        for server in servers.iter_mut() {
            server.url = server.url.replace("{app_name}", app_name);
            // Remove the variables since we're replacing with actual value
            server.variables = None;
        }
    }

    openapi
}

pub fn generate_platform_openapi_json(app_name: &str) -> String {
    build_platform_openapi(app_name).to_json().unwrap()
}
