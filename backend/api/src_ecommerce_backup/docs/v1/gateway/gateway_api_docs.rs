/// Gateway API Documentation - เอกสาร API สำหรับ Gateway
///
/// โมดูลนี้จัดการการสร้างและจัดการ OpenAPI documentation สำหรับ Gateway API
/// รวมถึง endpoints สำหรับการเชื่อมต่อแพลตฟอร์ม, OAuth flows, vector search, และ AI operations
///
/// # Features
/// - การกำหนด OpenAPI specification แบบอัตโนมัติ
/// - Security schemes สำหรับ JWT Bearer และ x-auth-token
/// - API endpoint documentation และ request/response schemas
/// - Scalar UI integration สำหรับ interactive API explorer
/// - Multi-server configuration สำหรับ environments ต่างๆ
use utoipa::{
    openapi::security::{ApiKey, ApiKeyValue, HttpAuthScheme, HttpBuilder, SecurityScheme},
    Modify, OpenApi,
};

use crate::{
    handlers::v1::gateway::{
        ecommerce::platform::{
            callback::handler as callback_handler, connect::handler as connect_handler,
        },
        health::handler as health_handler,
        vectors::vector,
    },
    model::v1::gateway::{
        request::{
            shop::{ConnectQuery, StateData},
            vector::{GetProductVectorQuery, SyncStatusQuery, UpsertRequest, VectorSearchRequest},
        },
        response::{
            gateway::ConnectResponse,
            vector::{ProductVector, SyncStatus, UpsertResponse, VectorMatch, VectorSearchResult},
        },
    },
};

/// โครงสร้างเอกสาร Gateway API
///
/// กำหนดโครงสร้างหลักของ OpenAPI specification สำหรับ Gateway API
/// รวมถึง metadata, endpoints, schemas, security requirements และ tags
///
/// # API Endpoints Coverage
/// - `/connect` - การเริ่มต้น OAuth flow สำหรับ platform connection
/// - `/callback` - OAuth callback handling หลังการ authorization
/// - `/health` - Health check endpoints สำหรับ monitoring
/// - `/vector/*` - Vector search และ AI operations
///
/// # Security
/// - JWT Bearer authentication สำหรับ user authorization
/// - x-auth-token header สำหรับ application authentication
#[derive(OpenApi)]
#[openapi(
    info(
        title = "E-Commerce Gateway API",
        version = "2.4.0",
        description = "Gateway API for shop connections, OAuth flows, vector search, and AI operations",
        contact(
            name = "Gateway Team",
            email = "gateway@ecommerce-connect.com"
        ),
        license(
            name = "MIT"
        )
    ),
    servers(
        (url = "/api/v1/{app_name}/gateway", description = "Gateway API server", variables(
            ("app_name" = (default = "app_name", description = "Application name from configuration"))
        ))
    ),
    paths(
        connect_handler::connect,
        callback_handler::callback,
        health_handler::health_check,
        vector::search,
        vector::upsert,
        vector::get_product_vector,
        vector::sync_status,
    ),
    components(
        schemas(
            ConnectQuery,
            StateData,
            ConnectResponse,
            GetProductVectorQuery,
            SyncStatusQuery,
            UpsertRequest,
            VectorSearchRequest,
            ProductVector,
            SyncStatus,
            UpsertResponse,
            VectorSearchResult,
            VectorMatch,
        )
    ),
    modifiers(&SecurityAddon),
    tags(
        (name = "health", description = "Health check endpoints"),
        (name = "vector", description = "Vector search and AI operations"),
        (name = "auth", description = "Authentication configuration"),
        (name = "audit", description = "Audit logging and compliance"),
    )
)]
pub struct GatewayApiDoc;

/// การตั้งค่าความปลอดภัยสำหรับ Gateway API
///
/// เพิ่ม security schemes ให้กับ OpenAPI specification
/// สนับสนุน JWT Bearer token และ x-auth-token header
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
        }
    }
}

/// สร้าง Gateway OpenAPI JSON specification
///
/// สร้าง JSON string ของ OpenAPI specification สำหรับ Gateway API
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
/// let json_spec = generate_gateway_openapi_json("my_app");
/// // ใช้สำหรับ serve ผ่าน HTTP endpoint หรือเขียนไฟล์
/// ```
pub fn build_gateway_openapi(app_name: &str) -> utoipa::openapi::OpenApi {
    let mut openapi = GatewayApiDoc::openapi();

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

pub fn generate_gateway_openapi_json(app_name: &str) -> String {
    build_gateway_openapi(app_name).to_json().unwrap()
}
