//! Webhook HTTP handlers - ตัวจัดการ HTTP endpoints สำหรับ webhooks
//!
//! โมดูลนี้จัดการ API endpoints ทั้งหมดที่เกี่ยวข้องกับ webhook management
//! รวมถึง CRUD operations, การทดสอบ และสถิติการส่ง

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use validator::Validate;

use crate::interfaces::webhook::WebhookInterface;
use crate::model::error::AppResult;
use crate::model::v1::platfrom::entries::AuthClaims;
use crate::model::v1::platfrom::request::webhook::{
    CreateWebhookRequest, TestWebhookRequest, ToggleWebhookRequest, UpdateWebhookRequest,
};
use crate::model::v1::platfrom::response::webhook::{
    CreateWebhookResponse, DeleteWebhookResponse, ListWebhooksResponse, TestWebhookResponse,
    UpdateWebhookResponse, WebhookDeliveryResponse, WebhookResponse, WebhookStatsResponse,
};
use crate::repository::webhook::RedisWebhookRepository;
use crate::services::webhook::WebhookService;
use crate::AppState;

/// Query parameters สำหรับการดึงรายการ webhooks
#[derive(Debug, Deserialize)]
pub struct WebhookQueryParams {
    /// Organization ID (optional)
    pub org_id: Option<String>,
}

fn build_webhook_service(state: &Arc<AppState>) -> Arc<WebhookService> {
    let repository = Arc::new(RedisWebhookRepository::new(state.cache.clone()));
    Arc::new(WebhookService::new(repository))
}

/// สร้าง webhook ใหม่
///
/// Endpoint นี้ใช้สำหรับสร้าง webhook endpoint ใหม่
/// พร้อมตรวจสอบความถูกต้องของ URL และ events
#[utoipa::path(
    post,
    path = "/platform/webhooks",
    request_body = CreateWebhookRequest,
    responses(
        (status = 201, description = "Webhook created successfully", body = CreateWebhookResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn create_webhook(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(request): Json<CreateWebhookRequest>,
) -> AppResult<impl IntoResponse> {
    // ตรวจสอบความถูกต้องของ request
    request
        .validate()
        .map_err(|e| crate::model::error::AppError::ValidationError(e.to_string()))?;

    let user_id = &claims.sub;
    let org_id = claims.org_id.as_deref().unwrap_or("default");

    let webhook_service = build_webhook_service(&app);
    let webhook = webhook_service
        .create(user_id, org_id, request.into())
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    let response = CreateWebhookResponse {
        webhook: webhook.into(),
        message: "Webhook created successfully".to_string(),
    };

    Ok((StatusCode::CREATED, Json(response)))
}

/// ดึงรายการ webhooks ทั้งหมดของผู้ใช้
///
/// แสดงรายการ webhook endpoints ทั้งหมดที่ผู้ใช้สร้าง
/// สามารถกรองตาม organization ID ได้
#[utoipa::path(
    get,
    path = "/platform/webhooks",
    params(
        ("org_id" = Option<String>, Query, description = "Organization ID")
    ),
    responses(
        (status = 200, description = "List of webhooks", body = ListWebhooksResponse),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_webhooks(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Query(params): Query<WebhookQueryParams>,
) -> AppResult<impl IntoResponse> {
    let user_id = &claims.sub;
    let org_id = params
        .org_id
        .as_deref()
        .or(claims.org_id.as_deref())
        .unwrap_or("default");
    let webhook_service = build_webhook_service(&app);
    let webhooks = webhook_service
        .get_by_user(user_id, org_id)
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    let response = ListWebhooksResponse {
        total: webhooks.len(),
        webhooks: webhooks.into_iter().map(Into::into).collect(),
    };

    Ok((StatusCode::OK, Json(response)))
}

/// ดึงข้อมูล webhook ตาม ID
///
/// แสดงรายละเอียดของ webhook รวมถึง configuration
/// และสถานะการทำงาน
#[utoipa::path(
    get,
    path = "/api/v1/platform/webhooks/{webhook_id}",
    params(
        ("webhook_id" = Uuid, Path, description = "Webhook ID")
    ),
    responses(
        (status = 200, description = "Webhook details", body = WebhookResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Webhook not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_webhook(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(webhook_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let user_id = &claims.sub;

    let webhook_service = build_webhook_service(&app);
    let webhook = webhook_service
        .get_by_id(webhook_id, user_id)
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?
        .ok_or_else(|| crate::model::error::AppError::NotFound("Webhook not found".to_string()))?;

    Ok((StatusCode::OK, Json(WebhookResponse::from(webhook))))
}

/// อัพเดท webhook
///
/// แก้ไขข้อมูล webhook เช่น URL, events, headers
/// พร้อมตรวจสอบความถูกต้องของข้อมูลใหม่
#[utoipa::path(
    put,
    path = "/api/v1/platform/webhooks/{webhook_id}",
    params(
        ("webhook_id" = Uuid, Path, description = "Webhook ID")
    ),
    request_body = UpdateWebhookRequest,
    responses(
        (status = 200, description = "Webhook updated successfully", body = UpdateWebhookResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Webhook not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn update_webhook(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(webhook_id): Path<Uuid>,
    Json(request): Json<UpdateWebhookRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate request
    request
        .validate()
        .map_err(|e| crate::model::error::AppError::ValidationError(e.to_string()))?;

    let user_id = &claims.sub;

    let webhook_service = build_webhook_service(&app);
    let webhook = webhook_service
        .update(webhook_id, user_id, request.into())
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    let response = UpdateWebhookResponse {
        webhook: webhook.into(),
        message: "Webhook updated successfully".to_string(),
    };

    Ok((StatusCode::OK, Json(response)))
}

/// ลบ webhook
///
/// ลบ webhook และประวัติการส่งทั้งหมด
/// การลบจะเป็นแบบ permanent
#[utoipa::path(
    delete,
    path = "/api/v1/platform/webhooks/{webhook_id}",
    params(
        ("webhook_id" = Uuid, Path, description = "Webhook ID")
    ),
    responses(
        (status = 200, description = "Webhook deleted successfully", body = DeleteWebhookResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Webhook not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn delete_webhook(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(webhook_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let user_id = &claims.sub;

    let webhook_service = build_webhook_service(&app);
    webhook_service
        .delete(webhook_id, user_id)
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    let response = DeleteWebhookResponse {
        message: "Webhook deleted successfully".to_string(),
    };

    Ok((StatusCode::OK, Json(response)))
}

/// เปิด/ปิดการใช้งาน webhook
///
/// สลับสถานะ active/inactive ของ webhook
/// webhook ที่ inactive จะไม่ส่ง events
#[utoipa::path(
    post,
    path = "/api/v1/platform/webhooks/{webhook_id}/toggle",
    params(
        ("webhook_id" = Uuid, Path, description = "Webhook ID")
    ),
    request_body = ToggleWebhookRequest,
    responses(
        (status = 200, description = "Webhook status toggled successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Webhook not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn toggle_webhook(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(webhook_id): Path<Uuid>,
    Json(request): Json<ToggleWebhookRequest>,
) -> AppResult<impl IntoResponse> {
    let user_id = &claims.sub;

    let webhook_service = build_webhook_service(&app);
    webhook_service
        .toggle_active(webhook_id, user_id, request.is_active)
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "message": format!("Webhook {} successfully", if request.is_active { "activated" } else { "deactivated" })
        })),
    ))
}

/// ทดสอบ webhook
///
/// ส่ง test payload ไปยัง webhook endpoint
/// เพื่อตรวจสอบการทำงานและ configuration
#[utoipa::path(
    post,
    path = "/api/v1/platform/webhooks/{webhook_id}/test",
    params(
        ("webhook_id" = Uuid, Path, description = "Webhook ID")
    ),
    request_body = TestWebhookRequest,
    responses(
        (status = 200, description = "Webhook test completed", body = TestWebhookResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Webhook not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn test_webhook(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(webhook_id): Path<Uuid>,
    Json(request): Json<TestWebhookRequest>,
) -> AppResult<impl IntoResponse> {
    let user_id = &claims.sub;

    let webhook_service = build_webhook_service(&app);
    let delivery = webhook_service
        .test(webhook_id, user_id, request.payload)
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    let response = TestWebhookResponse {
        delivery: delivery.into(),
        message: "Test webhook sent successfully".to_string(),
    };

    Ok((StatusCode::OK, Json(response)))
}

/// ดึงประวัติการส่ง webhook
///
/// แสดงรายการการส่ง webhook ทั้งหมด
/// รวมถึงสถานะและ response
#[utoipa::path(
    get,
    path = "/api/v1/platform/webhooks/{webhook_id}/deliveries",
    params(
        ("webhook_id" = Uuid, Path, description = "Webhook ID")
    ),
    responses(
        (status = 200, description = "List of webhook deliveries", body = Vec<WebhookDeliveryResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Webhook not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_webhook_deliveries(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(webhook_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let user_id = &claims.sub;

    let webhook_service = build_webhook_service(&app);
    let deliveries = webhook_service
        .get_deliveries(webhook_id, user_id)
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    let response: Vec<WebhookDeliveryResponse> = deliveries.into_iter().map(Into::into).collect();

    Ok((StatusCode::OK, Json(response)))
}

/// ดึงสถิติ webhook
///
/// แสดงสถิติการส่ง webhook เช่น
/// จำนวนสำเร็จ, ล้มเหลว, อัตราความสำเร็จ
#[utoipa::path(
    get,
    path = "/api/v1/platform/webhooks/{webhook_id}/stats",
    params(
        ("webhook_id" = Uuid, Path, description = "Webhook ID")
    ),
    responses(
        (status = 200, description = "Webhook statistics", body = WebhookStatsResponse),
        (status = 401, description = "Unauthorized"),
        (status = 404, description = "Webhook not found"),
        (status = 500, description = "Internal server error")
    ),
    tag = "Webhooks",
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_webhook_stats(
    State(app): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(webhook_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let user_id = &claims.sub;

    let webhook_service = build_webhook_service(&app);
    let stats = webhook_service
        .get_stats(webhook_id, user_id)
        .await
        .map_err(|e| crate::model::error::AppError::InternalError(e.to_string()))?;

    Ok((StatusCode::OK, Json(WebhookStatsResponse::from(stats))))
}
