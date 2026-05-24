//! # Authentication Middleware - ระบบตรวจสอบสิทธิ์การเข้าถึง
//!
//! โมดูลนี้จัดการการตรวจสอบสิทธิ์การเข้าถึง API ด้วย x-auth-token
//! ทำงานร่วมกับ Strapi backend ที่จัดการ user authentication
//!
//! ## คุณสมบัติหลัก:
//! - ตรวจสอบ x-auth-token จาก HTTP headers
//! - Integration กับ Strapi สำหรับการยืนยันตัวตน
//! - Middleware pattern สำหรับ Axum framework
//! - Security audit logging
//!
//! ## การทำงาน:
//! 1. ดึง x-auth-token จาก request headers
//! 2. เปรียบเทียบกับ token ที่กำหนดใน config
//! 3. อนุญาตให้ผ่านหรือ reject ด้วย 401 Unauthorized

use axum::{
    extract::{Request, State},
    http::{header, Method},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

use chrono::{Duration, Utc};

use crate::{
    config::AuthConfig,
    helpers::auth::jwt::decode_strapi_jwt,
    middleware::user_ctx::UserCtx,
    model::{error::AppError, v1::platfrom::entries::AuthClaims},
    AppState,
};

/// Contract for retrieving authentication secrets without forcing ownership.
pub trait AuthSecretsProvider {
    fn expected_token(&self) -> &str;
    fn jwt_secret(&self) -> &str;
    fn dev_mode(&self) -> bool;
}

/// Contract for decoding bearer tokens into claims.
pub trait JwtClaimsDecoder {
    type Claims;
    fn decode(&self, token: &str, secret: &str) -> Result<Self::Claims, AppError>;
}

/// Borrowed secrets sourced from application configuration.
struct ConfigAuthSecrets<'a> {
    auth: &'a AuthConfig,
}

impl<'a> ConfigAuthSecrets<'a> {
    fn new(state: &'a AppState) -> Self {
        Self {
            auth: &state.config.auth,
        }
    }
}

impl<'a> AuthSecretsProvider for ConfigAuthSecrets<'a> {
    fn expected_token(&self) -> &str {
        self.auth.x_auth_token_secret.as_str()
    }

    fn jwt_secret(&self) -> &str {
        self.auth.jwt_secret.as_str()
    }

    fn dev_mode(&self) -> bool {
        self.auth.dev_mode
    }
}

/// Decoder implementation backed by Strapi-compatible JWT parsing.
#[derive(Default, Clone, Copy)]
struct StrapiJwtDecoder;

impl JwtClaimsDecoder for StrapiJwtDecoder {
    type Claims = AuthClaims;

    fn decode(&self, token: &str, secret: &str) -> Result<Self::Claims, AppError> {
        decode_strapi_jwt(token, secret)
    }
}

/// Stateful middleware that validates Strapi proxy authentication.
struct AuthMiddleware<S, D> {
    secrets: S,
    decoder: D,
}

impl<S, D> AuthMiddleware<S, D>
where
    S: AuthSecretsProvider,
    D: JwtClaimsDecoder<Claims = AuthClaims>,
{
    fn new(secrets: S, decoder: D) -> Self {
        Self { secrets, decoder }
    }

    pub async fn handle(&self, mut request: Request, next: Next) -> Result<Response, AppError> {
        if request.method() == Method::OPTIONS {
            tracing::debug!("Auth middleware - skipping authentication for preflight request");
            return Ok(next.run(request).await);
        }

        self.log_headers(&request);
        self.validate_token(&request)?;

        let claims = self.decode_bearer_token(&request)?;
        let user_ctx = UserCtx::from_claims(&claims);
        request.extensions_mut().insert(claims);

        match user_ctx {
            Ok(ctx) => {
                request.extensions_mut().insert(ctx);
            }
            Err(err) => {
                tracing::debug!("Auth middleware - user context unavailable: {}", err);
            }
        }

        tracing::debug!("Auth middleware - authentication successful");

        Ok(next.run(request).await)
    }

    fn log_headers(&self, request: &Request) {
        tracing::debug!(
            "Auth middleware - incoming headers: {:?}",
            request.headers()
        );
    }

    fn validate_token(&self, request: &Request) -> Result<(), AppError> {
        let provided = request
            .headers()
            .get("x-auth-token")
            .and_then(|value| value.to_str().ok());

        let expected = self.secrets.expected_token();

        tracing::debug!("Auth middleware - x-auth-token: {:?}", provided);
        tracing::debug!(
            "Auth middleware - expected token present: {}",
            !expected.is_empty()
        );

        if provided != Some(expected) {
            tracing::error!("Auth middleware - token mismatch. Received: {:?}", provided);
            return Err(AppError::AuthError(
                "Invalid or missing x-auth-token".to_string(),
            ));
        }

        Ok(())
    }

    fn decode_bearer_token(&self, request: &Request) -> Result<AuthClaims, AppError> {
        let auth_header = request
            .headers()
            .get(header::AUTHORIZATION)
            .and_then(|value| value.to_str().ok());

        let auth_header = match auth_header {
            Some(value) => value,
            None => {
                tracing::warn!(
                    "Auth middleware - missing Authorization header, using proxy claims"
                );
                return Ok(build_proxy_claims(self.secrets.dev_mode()));
            }
        };

        let token = auth_header
            .strip_prefix("Bearer ")
            .or_else(|| auth_header.strip_prefix("bearer "))
            .unwrap_or(auth_header)
            .trim();

        if token.is_empty() {
            tracing::error!("Auth middleware - empty bearer token provided");
            return Err(AppError::AuthError(
                "Authorization bearer token is empty".to_string(),
            ));
        }

        let jwt_secret = self.secrets.jwt_secret();
        if jwt_secret.is_empty() {
            tracing::error!("Auth middleware - JWT secret is not configured");
            return Err(AppError::Configuration(
                "JWT secret is not configured on the Rust backend".to_string(),
            ));
        }

        let claims = self.decoder.decode(token, jwt_secret)?;
        tracing::debug!(
            "Auth middleware - validated JWT for subject={} org_id={:?}",
            claims.sub,
            claims.org_id
        );

        Ok(claims)
    }
}

/// Authentication middleware function
/// ตรวจสอบ x-auth-token header ก่อนอนุญาตให้ request ผ่านไปยัง handler
///
/// # ขั้นตอนการทำงาน:
/// 1. ดึง x-auth-token จาก request headers
/// 2. เปรียบเทียบกับ token ที่กำหนดใน config
/// 3. อนุญาตให้ผ่านหรือ reject ด้วย 401 Unauthorized
pub async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, AppError> {
    let middleware = AuthMiddleware::new(ConfigAuthSecrets::new(&state), StrapiJwtDecoder);
    middleware.handle(request, next).await
}

/// Validate authentication token จาก headers
/// ฟังก์ชัน utility สำหรับตรวจสอบ token โดยไม่ต้องใช้ middleware
///
/// # Parameters
/// * `headers` - HTTP headers ที่ต้องการตรวจสอบ
/// * `expected_token` - Token ที่ถูกต้องจาก config
pub fn validate_auth_token(
    headers: &axum::http::HeaderMap,
    expected_token: &str,
) -> Result<(), AppError> {
    // Check for x-auth-token header
    // ดึง x-auth-token จาก headers
    let token = headers
        .get("x-auth-token")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing x-auth-token header".to_string()))?;

    if token != expected_token {
        return Err(AppError::Unauthorized("Invalid x-auth-token".to_string()));
    }

    Ok(())
}

fn build_proxy_claims(dev_mode: bool) -> AuthClaims {
    let now = Utc::now();
    let (permissions, roles) = if dev_mode {
        (vec!["*".to_string()], vec!["developer".to_string()])
    } else {
        (Vec::new(), vec!["service".to_string()])
    };

    AuthClaims {
        sub: "strapi-proxy".to_string(),
        exp: (now + Duration::hours(1)).timestamp(),
        iat: now.timestamp(),
        user_id: Some("strapi-proxy".to_string()),
        org_id: None,
        email: None,
        permissions,
        roles,
        raw: None,
    }
}
