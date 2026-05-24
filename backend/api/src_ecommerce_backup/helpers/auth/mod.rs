pub mod crypto;
pub mod jwt;

use axum::{extract::Request, http::Extensions};
use std::borrow::Cow;

use crate::model::v1::platfrom::entries::AuthClaims;

/// Default tenant identifier used when no tenant is present in the auth context.
pub const DEFAULT_TENANT_ID: &str = "default";

/// Helper trait that provides borrowed accessors for common claim fields.
pub trait ClaimsExt {
    fn tenant_id(&self) -> Option<&str>;
    fn user_id(&self) -> &str;
    fn subject(&self) -> &str;
    fn email(&self) -> Option<&str>;
}

impl ClaimsExt for AuthClaims {
    fn tenant_id(&self) -> Option<&str> {
        self.org_id.as_deref()
    }

    fn user_id(&self) -> &str {
        self.user_id.as_deref().unwrap_or_else(|| self.sub.as_str())
    }

    fn subject(&self) -> &str {
        self.sub.as_str()
    }

    fn email(&self) -> Option<&str> {
        self.email.as_deref()
    }
}

/// Borrowed auth context wrapper extracted from Axum extensions.
#[derive(Clone, Copy)]
pub struct AuthContext<'a> {
    claims: Option<&'a AuthClaims>,
}

impl<'a> AuthContext<'a> {
    /// Create a new auth context from optional claims.
    pub fn new(claims: Option<&'a AuthClaims>) -> Self {
        Self { claims }
    }

    /// Build context from request extensions.
    pub fn from_extensions(extensions: &'a Extensions) -> Self {
        Self::new(extensions.get::<AuthClaims>())
    }

    /// Build context from Axum request.
    pub fn from_request(request: &'a Request) -> Self {
        Self::from_extensions(request.extensions())
    }

    /// Borrow the underlying claims if present.
    pub fn claims(&self) -> Option<&'a AuthClaims> {
        self.claims
    }

    /// Return the tenant identifier, falling back to `DEFAULT_TENANT_ID`.
    pub fn tenant_id(&self) -> Cow<'a, str> {
        self.claims
            .and_then(ClaimsExt::tenant_id)
            .map(Cow::Borrowed)
            .unwrap_or_else(|| Cow::Borrowed(DEFAULT_TENANT_ID))
    }

    /// Borrow the current user identifier if available.
    pub fn user_id(&self) -> Option<&'a str> {
        self.claims.map(ClaimsExt::user_id)
    }

    /// Borrow the current subject identifier if available.
    pub fn subject(&self) -> Option<&'a str> {
        self.claims.map(ClaimsExt::subject)
    }

    /// Borrow the email if present in the claims.
    pub fn email(&self) -> Option<&'a str> {
        self.claims.and_then(ClaimsExt::email)
    }
}

/// Extract tenant_id from request context
/// Falls back to "default" if not available
pub fn get_tenant_id(extensions: &Extensions) -> String {
    AuthContext::from_extensions(extensions)
        .tenant_id()
        .into_owned()
}

/// Extract tenant_id from request
pub fn get_tenant_id_from_request(request: &Request) -> String {
    AuthContext::from_request(request).tenant_id().into_owned()
}

/// Extract user_id from request context
pub fn get_user_id(extensions: &Extensions) -> Option<String> {
    AuthContext::from_extensions(extensions)
        .user_id()
        .map(ToOwned::to_owned)
}

/// Extract shop_id from request context
pub fn get_shop_id(_extensions: &Extensions) -> Option<String> {
    // Shop ID would need to be passed separately or derived from context
    // For now, return None as AuthClaims doesn't have shop_id
    None
}
