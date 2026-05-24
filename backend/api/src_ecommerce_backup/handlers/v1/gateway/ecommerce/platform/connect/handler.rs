use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde_json::{json, Map, Value};
use std::sync::Arc;
use uuid::Uuid;

use crate::{
    client::ecommerce::connector::{
        ApiKeyFlow, ConnectContext, ConnectFlow, ConnectorCapabilities, JwtFlow, OAuthFlow,
        PlatformConnector, StateEnvelope, StateFlavor,
    },
    interfaces::OAuthState,
    model::error::{AppError, AppResult},
    model::v1::gateway::request::queries::ConnectQuery,
    AppState,
};

pub struct ConnectHandler {
    state: Arc<AppState>,
}

impl ConnectHandler {
    /// Create a new Ecommerce handler instance
    pub fn new(state: Arc<AppState>) -> Self {
        Self { state }
    }

    /// Build and return the router with all ecommerce routes
    pub fn build(&self) -> Router<Arc<AppState>> {
        self.routes()
    }

    /// Register all ecommerce platform routes
    fn routes(&self) -> Router<Arc<AppState>> {
        Router::new()
            .route("/", get(connect))
            .with_state(self.state.clone())
    }
}

/// Initiate OAuth connection for a platform
///
/// This handler initiates the OAuth flow for the specified e-commerce platform.
/// It generates the authorization URL that the user should be redirected to.
#[utoipa::path(
    get,
    path = "/ecommerce/{platform}/connect",
    params(
        ("platform" = String, Path, description = "E-commerce platform identifier"),
        ConnectQuery
    ),
    responses(
        (status = 200, description = "Connect metadata",
            body = ConnectResponse,
            examples(
                ("oauth_flow" = (
                    summary = "OAuth platform response",
                    value = json!({
                        "platform": "shopify",
                        "auth_type": "oauth",
                        "auth_url": "https://shop.myshopify.com/admin/oauth/authorize?client_id=...",
                        "state": "eyJvcmdfaWQiOiJvcmdfMTIzIiwi...==",
                        "instructions": "Redirect the merchant to auth_url to complete the OAuth flow."
                    })
                )),
                ("api_key_flow" = (
                    summary = "API key platform response",
                    value = json!({
                        "platform": "lineshopping",
                        "auth_type": "api_key",
                        "required_fields": ["api_key"],
                        "instructions": "Collect an API key and send it to POST /api/v1/{app_name}/platform/shop/{shop_id}/connect/lineshopping. Example:\\n  curl -X POST http://localhost:8080/api/v1/{app_name}/platform/shop/SEE/connect/lineshopping \\\\n    -H \"x-auth-token: <token>\" \\\\n    -H \"Content-Type: application/json\" \\\\n    -d '{\"version\":\"v1\",\"platform\":{\"name\":\"lineshopping\"},\"org\":{\"org_id\":\"org-123\",\"user_id\":\"user-456\"},\"shop\":{\"store_url\":\"https://store.example\",\"timezone\":\"Asia/Bangkok\"},\"auth\":{\"type\":\"api_key\",\"credentials\":{\"api_key\":\"<API_KEY>\"}},\"options\":{\"test_connect\":true}}'"
                    })
                ))
            )
        ),
        (status = 400, description = "Invalid platform"),
        (status = 500, description = "Internal server error")
    ),
    tag = "ecommerce"
)]
pub async fn connect(
    State(state): State<Arc<AppState>>,
    Path(platform): Path<String>,
    Query(query): Query<ConnectQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let connector = state
        .connector_registry
        .get(&platform)
        .ok_or_else(|| AppError::BadRequest(format!("Unsupported platform: {}", platform)))?;

    let state_uuid = Uuid::new_v4().to_string();

    let connect_ctx = ConnectContext::new(
        platform.clone(),
        query.org_id.clone(),
        query.shop_id.clone(),
        state_uuid.clone(),
    )
    .with_redirect_uri(query.redirect_uri.clone())
    .with_shop_region(query.shop_region.clone())
    .with_user_id(query.user_id.clone())
    .with_shop_domain(query.shop_domain.clone());

    let state_flavor = resolve_state_flavor(Some(&connector), platform.as_str());
    let state_envelope = StateEnvelope::from_context(&connect_ctx, state_flavor)?;
    let outgoing_state = state_envelope.token.clone();
    let persisted_state_token = if should_persist_encoded_state(platform.as_str(), state_flavor) {
        outgoing_state.clone()
    } else {
        connect_ctx.state_nonce.clone()
    };

    // Store OAuth state in Redis for later validation
    {
        let oauth_state_service = &state.oauth_state_service;
        let oauth_state_data = OAuthState {
            platform: platform.clone(),
            state: persisted_state_token.clone(),
            shop_id: query.shop_id.clone(),
            org_id: query.org_id.clone(),
            redirect_uri: query.redirect_uri.clone(),
            created_at: chrono::Utc::now(),
            expires_at: chrono::Utc::now() + chrono::Duration::seconds(300), // 5 minutes TTL
        };

        oauth_state_service
            .store(&oauth_state_data)
            .await
            .map_err(|e| {
                tracing::error!("Failed to store OAuth state: {}", e);
                AppError::DatabaseError(format!("Failed to store OAuth state: {}", e))
            })?;
        tracing::info!(
            "OAuth state stored in Redis: {} for platform: {}, shop: {}, org: {}, redirect_uri: {:?}",
            persisted_state_token,
            platform,
            query.shop_id,
            query.org_id,
            query.redirect_uri
        );
    }

    let flow = connector.auth_flow(&connect_ctx, &state_envelope).await?;
    match &flow {
        ConnectFlow::OAuth(oauth) => {
            tracing::info!(
                "OAuth flow initiated for platform {} shop {} by user {}",
                platform,
                query.shop_id,
                query.org_id
            );
            tracing::info!("OAuth URL: {}", oauth.auth_url);
        }
        ConnectFlow::ApiKey(_) | ConnectFlow::Jwt(_) => {
            tracing::info!(
                "Manual credential flow prepared for platform {} shop {} by user {}",
                platform,
                query.shop_id,
                query.org_id
            );
        }
    }

    let response_body = build_flow_response(&platform, flow, connect_ctx.shop_domain.clone());
    Ok(Json(response_body))
}

fn resolve_state_flavor(
    connector: Option<&Arc<dyn PlatformConnector>>,
    platform: &str,
) -> StateFlavor {
    connector
        .map(|c| c.capabilities().state_flavor)
        .unwrap_or_else(|| legacy_state_flavor_for_platform(platform))
}

fn legacy_state_flavor_for_platform(platform: &str) -> StateFlavor {
    match platform {
        "tiktok" | "lazada" | "alibaba" | "aliexpress" | "shopify" => StateFlavor::Base64Json,
        "shopee" => StateFlavor::JsonString,
        _ => StateFlavor::PlainUuid,
    }
}

fn should_persist_encoded_state(platform: &str, flavor: StateFlavor) -> bool {
    match flavor {
        StateFlavor::Base64Json => true,
        StateFlavor::JsonString => false,
        StateFlavor::PlainUuid => false,
    }
}

fn build_flow_response(
    platform: &str,
    flow: ConnectFlow,
    fallback_domain: Option<String>,
) -> Value {
    match flow {
        ConnectFlow::OAuth(oauth) => build_oauth_response(platform, oauth, fallback_domain),
        ConnectFlow::ApiKey(api_key) => build_api_key_response(platform, api_key),
        ConnectFlow::Jwt(jwt) => build_jwt_response(platform, jwt),
    }
}

fn build_oauth_response(platform: &str, flow: OAuthFlow, fallback_domain: Option<String>) -> Value {
    let mut response = json!({
        "platform": platform,
        "auth_type": "oauth",
        "auth_url": flow.auth_url,
        "state": flow.state,
        "message": "Redirect user to auth_url to complete OAuth flow"
    });

    let metadata = flow.metadata;
    if let Some(domain) = metadata_shop_domain(&metadata).or(fallback_domain) {
        response["shop_domain"] = json!(domain);
    }

    if !metadata.is_empty() {
        response["metadata"] = Value::Object(metadata);
    }

    response
}

fn metadata_shop_domain(metadata: &Map<String, Value>) -> Option<String> {
    metadata
        .get("shop_domain")
        .and_then(|v| v.as_str().map(|s| s.to_string()))
}

fn build_api_key_response(platform: &str, flow: ApiKeyFlow) -> Value {
    let mut response = json!({
        "platform": platform,
        "auth_type": "api_key",
        "message": flow.message,
        "required_fields": flow.required_fields,
    });

    if let Some(instructions) = flow.instructions {
        response["instructions"] = json!(instructions);
    }

    response
}

fn build_jwt_response(platform: &str, flow: JwtFlow) -> Value {
    let mut response = json!({
        "platform": platform,
        "auth_type": "jwt",
        "message": flow.message,
        "required_fields": flow.required_fields,
    });

    if let Some(instructions) = flow.instructions {
        response["instructions"] = json!(instructions);
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use async_trait::async_trait;

    struct TestConnector {
        capabilities: ConnectorCapabilities,
    }

    impl TestConnector {
        fn json_state() -> Arc<dyn PlatformConnector> {
            Arc::new(Self {
                capabilities: ConnectorCapabilities {
                    state_flavor: StateFlavor::JsonString,
                    ..Default::default()
                },
            })
        }
    }

    #[async_trait]
    impl PlatformConnector for TestConnector {
        fn platform(&self) -> &'static str {
            "dummy"
        }

        fn capabilities(&self) -> &ConnectorCapabilities {
            &self.capabilities
        }

        async fn auth_flow(&self, _: &ConnectContext, _: &StateEnvelope) -> AppResult<ConnectFlow> {
            Ok(ConnectFlow::ApiKey(ApiKeyFlow {
                message: "noop".to_string(),
                required_fields: vec![],
                instructions: None,
            }))
        }
    }

    #[test]
    fn resolve_state_flavor_prefers_connector_capability() {
        let connector = Some(TestConnector::json_state());
        let flavor = resolve_state_flavor(connector.as_ref(), "shopify");
        assert_eq!(flavor, StateFlavor::JsonString);
    }

    #[test]
    fn resolve_state_flavor_uses_legacy_when_missing() {
        let flavor = resolve_state_flavor(None, "shopify");
        assert_eq!(flavor, StateFlavor::Base64Json);
    }

    #[test]
    fn should_not_persist_json_string_states() {
        assert!(!should_persist_encoded_state(
            "shopee",
            StateFlavor::JsonString
        ));
        assert!(should_persist_encoded_state(
            "tiktok",
            StateFlavor::Base64Json
        ));
        assert!(!should_persist_encoded_state(
            "amazon",
            StateFlavor::PlainUuid
        ));
    }

    #[test]
    fn metadata_shop_domain_prefers_metadata_value() {
        let mut metadata = Map::new();
        metadata.insert(
            "shop_domain".to_string(),
            Value::String("demo.myshopify.com".into()),
        );
        assert_eq!(
            metadata_shop_domain(&metadata),
            Some("demo.myshopify.com".to_string())
        );
    }
}
