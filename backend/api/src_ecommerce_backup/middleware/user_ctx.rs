//! User context extractor compatible with Strapi-issued JWTs.
//!
//! This module provides a `UserCtx` type that can be pulled directly inside
//! handlers (via `FromRequestParts` or `Extension<UserCtx>`) to access
//! multi-tenant information such as `org_id`, `roles`, and `shop_ids`.
//! The extractor validates bearer tokens with the configured Strapi secret
//! when the authentication middleware did not already populate the context.

use std::sync::Arc;

use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{header, request::Parts},
};
use serde_json::Value;

use crate::{
    helpers::auth::jwt::decode_strapi_jwt,
    model::{error::AppError, v1::platfrom::entries::AuthClaims},
    AppState,
};

/// Authenticated user context derived from Strapi JWT claims.
#[derive(Debug, Clone)]
pub struct UserCtx {
    pub user_id: String,
    pub org_id: String,
    pub roles: Vec<String>,
    pub shop_ids: Vec<String>,
}

impl UserCtx {
    /// Build user context from authenticated claims.
    pub fn from_claims(claims: &AuthClaims) -> Result<Self, AppError> {
        let org_id = claims
            .org_id
            .clone()
            .ok_or_else(|| AppError::AuthError("No org_id in token".to_string()))?;

        let user_id = claims.user_id.clone().unwrap_or_else(|| claims.sub.clone());

        let shop_ids = extract_shop_ids(claims.raw.as_ref());

        Ok(Self {
            user_id,
            org_id,
            roles: claims.roles.clone(),
            shop_ids,
        })
    }
}

#[async_trait]
impl<S> FromRequestParts<S> for UserCtx
where
    S: Send + Sync,
{
    type Rejection = AppError;

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        if let Some(existing) = parts.extensions.get::<UserCtx>() {
            return Ok(existing.clone());
        }

        let claims = if let Some(claims) = parts.extensions.get::<AuthClaims>() {
            claims.clone()
        } else {
            let token = extract_bearer_token(parts)?;
            let state = parts
                .extensions
                .get::<Arc<AppState>>()
                .cloned()
                .ok_or_else(|| {
                    AppError::InternalError(
                        "Missing application state in request extensions".to_string(),
                    )
                })?;

            let jwt_secret = state.config.auth.jwt_secret.clone();
            if jwt_secret.is_empty() {
                return Err(AppError::Configuration(
                    "JWT secret is not configured on the backend".to_string(),
                ));
            }

            let claims = decode_strapi_jwt(&token, jwt_secret.as_str())?;
            parts.extensions.insert(claims.clone());
            claims
        };

        let ctx = UserCtx::from_claims(&claims)?;
        parts.extensions.insert(ctx.clone());
        Ok(ctx)
    }
}

fn extract_bearer_token(parts: &Parts) -> Result<String, AppError> {
    let header_value = parts
        .headers
        .get(header::AUTHORIZATION)
        .ok_or_else(|| AppError::Unauthorized("Missing Authorization header".to_string()))?
        .to_str()
        .map_err(|_| AppError::Unauthorized("Invalid Authorization header".to_string()))?;

    let token = header_value
        .strip_prefix("Bearer ")
        .or_else(|| header_value.strip_prefix("bearer "))
        .unwrap_or(header_value)
        .trim();

    if token.is_empty() {
        return Err(AppError::Unauthorized(
            "Authorization bearer token is empty".to_string(),
        ));
    }

    Ok(token.to_string())
}

fn extract_shop_ids(raw_claims: Option<&Value>) -> Vec<String> {
    match raw_claims.and_then(|value| value.get("shop_ids")) {
        Some(Value::Array(items)) => items.iter().filter_map(value_to_string).collect(),
        Some(value) => value_to_string(value).into_iter().collect(),
        None => Vec::new(),
    }
}

fn value_to_string(value: &Value) -> Option<String> {
    match value {
        Value::String(s) => Some(s.clone()),
        Value::Number(num) => Some(num.to_string()),
        Value::Bool(flag) => Some(flag.to_string()),
        _ => None,
    }
}
