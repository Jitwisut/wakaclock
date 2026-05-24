use std::{collections::HashMap, sync::Arc};

use async_trait::async_trait;
use base64::engine::general_purpose;
use base64::Engine;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};

use super::{
    alibaba::AlibabaGateway, aliexpress::AliExpressGateway, amazon::AmazonGateway,
    bigcommerce::BigCommerceGateway, ebay::EbayGateway, ecwid::EcwidGateway, etsy::EtsyGateway,
    jd::JDGateway, lazada::LazadaGateway, shopee::ShopeeGateway, shopify::ShopifyGateway,
    tiktok::TikTokGateway, wix::WixGateway, zoho::ZohoGateway,
};
use crate::{
    config::{Config, PlatformCredentials},
    model::error::{AppError, AppResult},
};

/// Context collected from the incoming connect request.
///
/// This struct centralizes the data we pass down to platform connectors so they
/// can build platform-specific auth URLs or manual credential instructions.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ConnectContext {
    pub platform: String,
    pub org_id: String,
    pub shop_id: String,
    pub redirect_uri: Option<String>,
    pub shop_domain: Option<String>,
    pub shop_region: Option<String>,
    pub user_id: Option<String>,
    pub state_nonce: String,
    #[serde(default)]
    pub metadata: Map<String, Value>,
}

impl ConnectContext {
    pub fn new(
        platform: impl Into<String>,
        org_id: impl Into<String>,
        shop_id: impl Into<String>,
        state_nonce: impl Into<String>,
    ) -> Self {
        Self {
            platform: platform.into(),
            org_id: org_id.into(),
            shop_id: shop_id.into(),
            redirect_uri: None,
            shop_domain: None,
            shop_region: None,
            user_id: None,
            state_nonce: state_nonce.into(),
            metadata: Map::new(),
        }
    }

    pub fn with_redirect_uri(mut self, uri: Option<String>) -> Self {
        self.redirect_uri = uri;
        self
    }

    pub fn with_shop_domain(mut self, domain: Option<String>) -> Self {
        self.shop_domain = domain;
        self
    }

    pub fn with_shop_region(mut self, region: Option<String>) -> Self {
        self.shop_region = region;
        self
    }

    pub fn with_user_id(mut self, user_id: Option<String>) -> Self {
        self.user_id = user_id;
        self
    }

    pub fn insert_metadata(&mut self, key: impl Into<String>, value: Value) {
        self.metadata.insert(key.into(), value);
    }

    /// Construct a deterministic JSON payload that will be encoded into the state parameter.
    pub fn state_payload(&self) -> Map<String, Value> {
        let mut payload = Map::new();
        payload.insert("tenant_id".into(), Value::String(self.org_id.clone()));
        payload.insert("shop_id".into(), Value::String(self.shop_id.clone()));
        payload.insert("platform".into(), Value::String(self.platform.clone()));
        payload.insert("state".into(), Value::String(self.state_nonce.clone()));

        if let Some(domain) = &self.shop_domain {
            payload.insert("shop_domain".into(), Value::String(domain.clone()));
        }

        if let Some(region) = &self.shop_region {
            payload.insert("shop_region".into(), Value::String(region.clone()));
        }

        if let Some(user_id) = &self.user_id {
            payload.insert("user_id".into(), Value::String(user_id.clone()));
        }

        for (key, value) in &self.metadata {
            payload.insert(key.clone(), value.clone());
        }

        payload
    }
}

/// Encoding strategies for the `state` parameter we persist + send to platforms.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum StateFlavor {
    PlainUuid,
    Base64Json,
    JsonString,
}

impl Default for StateFlavor {
    fn default() -> Self {
        StateFlavor::PlainUuid
    }
}

/// Helper struct that stores both the encoded state token and the raw JSON payload.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateEnvelope {
    pub token: String,
    pub flavor: StateFlavor,
    pub context: Value,
}

impl StateEnvelope {
    pub fn from_context(ctx: &ConnectContext, flavor: StateFlavor) -> AppResult<Self> {
        let context = Value::Object(ctx.state_payload());

        let token = match flavor {
            StateFlavor::PlainUuid => ctx.state_nonce.clone(),
            StateFlavor::JsonString => context.to_string(),
            StateFlavor::Base64Json => general_purpose::STANDARD.encode(context.to_string()),
        };

        Ok(Self {
            token,
            flavor,
            context,
        })
    }
}

/// Supported authentication types for a connector.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConnectorAuthType {
    OAuth,
    ApiKey,
    Jwt,
}

impl Default for ConnectorAuthType {
    fn default() -> Self {
        ConnectorAuthType::OAuth
    }
}

/// Static metadata that helps the handler understand what a connector needs.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConnectorCapabilities {
    pub auth_type: ConnectorAuthType,
    pub state_flavor: StateFlavor,
    pub required_fields: Vec<String>,
    pub optional_fields: Vec<String>,
    pub requires_shop_domain: bool,
    pub supported_regions: Vec<String>,
    pub instructions: Option<String>,
}

impl Default for ConnectorCapabilities {
    fn default() -> Self {
        Self {
            auth_type: ConnectorAuthType::OAuth,
            state_flavor: StateFlavor::PlainUuid,
            required_fields: Vec::new(),
            optional_fields: Vec::new(),
            requires_shop_domain: false,
            supported_regions: Vec::new(),
            instructions: None,
        }
    }
}

/// Result of preparing a connect flow for a platform.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConnectFlow {
    OAuth(OAuthFlow),
    ApiKey(ApiKeyFlow),
    Jwt(JwtFlow),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthFlow {
    pub auth_url: String,
    pub state: String,
    #[serde(default)]
    pub metadata: Map<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyFlow {
    pub message: String,
    pub required_fields: Vec<String>,
    pub instructions: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JwtFlow {
    pub message: String,
    pub required_fields: Vec<String>,
    pub instructions: Option<String>,
}

/// Trait implemented by each platform connector to produce connect metadata.
#[async_trait]
pub trait PlatformConnector: Send + Sync {
    fn platform(&self) -> &'static str;
    fn capabilities(&self) -> &ConnectorCapabilities;

    async fn auth_flow(
        &self,
        ctx: &ConnectContext,
        state: &StateEnvelope,
    ) -> AppResult<ConnectFlow>;
}

/// In-memory registry that keeps platform connectors discoverable at runtime.
#[derive(Default)]
pub struct ConnectorRegistry {
    connectors: HashMap<String, Arc<dyn PlatformConnector>>,
}

impl ConnectorRegistry {
    pub fn new() -> Self {
        Self {
            connectors: HashMap::new(),
        }
    }

    pub fn register(&mut self, connector: Arc<dyn PlatformConnector>) {
        let key = connector.platform().to_lowercase();
        self.connectors.insert(key, connector);
    }

    pub fn extend<I>(&mut self, connectors: I)
    where
        I: IntoIterator<Item = Arc<dyn PlatformConnector>>,
    {
        for connector in connectors {
            self.register(connector);
        }
    }

    pub fn get(&self, platform: &str) -> Option<Arc<dyn PlatformConnector>> {
        let key = platform.to_lowercase();
        self.connectors
            .get(&key)
            .cloned()
            .or_else(|| self.connectors.get(platform).cloned())
    }

    pub fn len(&self) -> usize {
        self.connectors.len()
    }

    pub fn is_empty(&self) -> bool {
        self.connectors.is_empty()
    }
}

/// Shopify connector implementation backed by ShopifyGateway.
pub struct ShopifyConnector {
    config: Arc<Config>,
    frontend_url: String,
    capabilities: ConnectorCapabilities,
}

impl ShopifyConnector {
    pub fn new(config: Arc<Config>) -> Self {
        let frontend_url = config.frontend_url.clone();
        Self {
            config,
            frontend_url,
            capabilities: ConnectorCapabilities {
                auth_type: ConnectorAuthType::OAuth,
                state_flavor: StateFlavor::Base64Json,
                required_fields: vec!["shop_domain".to_string()],
                optional_fields: vec!["shop_region".to_string()],
                requires_shop_domain: true,
                supported_regions: vec![],
                instructions: Some(
                    "Provide the merchant's .myshopify.com domain to initiate the OAuth flow."
                        .to_string(),
                ),
            },
        }
    }

    fn credentials(&self) -> AppResult<PlatformCredentials> {
        self.config.get_platform_credentials("shopify")
    }
}

#[async_trait]
impl PlatformConnector for ShopifyConnector {
    fn platform(&self) -> &'static str {
        "shopify"
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        &self.capabilities
    }

    async fn auth_flow(
        &self,
        ctx: &ConnectContext,
        state: &StateEnvelope,
    ) -> AppResult<ConnectFlow> {
        let domain_input = ctx
            .shop_domain
            .clone()
            .filter(|d| !d.trim().is_empty())
            .ok_or_else(|| {
                AppError::BadRequest(
                    "Shopify connect requires shop_domain query parameter".to_string(),
                )
            })?;

        let normalized_domain = ShopifyGateway::normalize_shop_domain(&domain_input)?;
        let credentials = self.credentials()?;
        let gateway = ShopifyGateway::with_shop_domain(
            credentials,
            self.frontend_url.clone(),
            normalized_domain.clone(),
        );
        let auth_url = gateway.get_oauth_url(&state.token);

        let mut metadata = Map::new();
        metadata.insert(
            "shop_domain".to_string(),
            Value::String(normalized_domain.clone()),
        );

        Ok(ConnectFlow::OAuth(OAuthFlow {
            auth_url,
            state: state.token.clone(),
            metadata,
        }))
    }
}

/// TikTok connector implementation backed by TikTokGateway.
pub struct TikTokConnector {
    config: Arc<Config>,
    capabilities: ConnectorCapabilities,
}

impl TikTokConnector {
    pub fn new(config: Arc<Config>) -> Self {
        Self {
            config,
            capabilities: ConnectorCapabilities {
                auth_type: ConnectorAuthType::OAuth,
                state_flavor: StateFlavor::Base64Json,
                required_fields: vec![],
                optional_fields: vec!["shop_region".to_string()],
                requires_shop_domain: false,
                supported_regions: vec![
                    "SG", "MY", "TH", "VN", "ID", "PH", "BR", "US", "GB", "DE", "FR",
                ]
                .into_iter()
                .map(|r| r.to_string())
                .collect(),
                instructions: Some(
                    "Optionally provide shop_region to route the merchant to the closest TikTok authorization portal."
                        .to_string(),
                ),
            },
        }
    }

    fn credentials(&self) -> AppResult<PlatformCredentials> {
        self.config.get_platform_credentials("tiktok")
    }
}

#[async_trait]
impl PlatformConnector for TikTokConnector {
    fn platform(&self) -> &'static str {
        "tiktok"
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        &self.capabilities
    }

    async fn auth_flow(
        &self,
        ctx: &ConnectContext,
        state: &StateEnvelope,
    ) -> AppResult<ConnectFlow> {
        let mut credentials = self.credentials()?;
        if let Some(region) = &ctx.shop_region {
            let normalized = region.trim().to_uppercase();
            if !normalized.is_empty() {
                credentials.market = Some(normalized);
            }
        }

        let gateway = TikTokGateway::new(credentials);
        let auth_url = gateway.get_oauth_url(&state.token);

        let mut metadata = Map::new();
        if let Some(region) = &ctx.shop_region {
            metadata.insert("shop_region".to_string(), Value::String(region.clone()));
        }

        Ok(ConnectFlow::OAuth(OAuthFlow {
            auth_url,
            state: state.token.clone(),
            metadata,
        }))
    }
}

/// Shopee connector implementation.
pub struct ShopeeConnector {
    config: Arc<Config>,
    frontend_url: String,
    capabilities: ConnectorCapabilities,
}

impl ShopeeConnector {
    pub fn new(config: Arc<Config>) -> Self {
        let frontend_url = config.frontend_url.clone();
        Self {
            config,
            frontend_url,
            capabilities: ConnectorCapabilities {
                auth_type: ConnectorAuthType::OAuth,
                state_flavor: StateFlavor::JsonString,
                required_fields: vec![],
                optional_fields: vec![],
                requires_shop_domain: false,
                supported_regions: vec![],
                instructions: Some(
                    "Shopee encodes org_id and shop_id inside the state parameter; no additional fields required."
                        .to_string(),
                ),
            },
        }
    }

    fn credentials(&self) -> AppResult<PlatformCredentials> {
        self.config.get_platform_credentials("shopee")
    }
}

#[async_trait]
impl PlatformConnector for ShopeeConnector {
    fn platform(&self) -> &'static str {
        "shopee"
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        &self.capabilities
    }

    async fn auth_flow(&self, _: &ConnectContext, state: &StateEnvelope) -> AppResult<ConnectFlow> {
        let credentials = self.credentials()?;
        let gateway = ShopeeGateway::with_frontend_url(credentials, self.frontend_url.clone());
        let auth_url = gateway.get_oauth_url(&state.token);

        Ok(ConnectFlow::OAuth(OAuthFlow {
            auth_url,
            state: state.token.clone(),
            metadata: Map::new(),
        }))
    }
}

/// Lazada connector implementation.
pub struct LazadaConnector {
    config: Arc<Config>,
    frontend_url: String,
    capabilities: ConnectorCapabilities,
}

impl LazadaConnector {
    pub fn new(config: Arc<Config>) -> Self {
        let frontend_url = config.frontend_url.clone();
        Self {
            config,
            frontend_url,
            capabilities: ConnectorCapabilities {
                auth_type: ConnectorAuthType::OAuth,
                state_flavor: StateFlavor::Base64Json,
                required_fields: vec![],
                optional_fields: vec!["shop_region".to_string()],
                requires_shop_domain: false,
                supported_regions: vec![],
                instructions: Some(
                    "Specify shop_region to route the merchant to the closest Lazada auth portal."
                        .to_string(),
                ),
            },
        }
    }

    fn credentials(&self) -> AppResult<PlatformCredentials> {
        self.config.get_platform_credentials("lazada")
    }
}

#[async_trait]
impl PlatformConnector for LazadaConnector {
    fn platform(&self) -> &'static str {
        "lazada"
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        &self.capabilities
    }

    async fn auth_flow(&self, _: &ConnectContext, state: &StateEnvelope) -> AppResult<ConnectFlow> {
        let credentials = self.credentials()?;
        let gateway = LazadaGateway::with_frontend_url(credentials, self.frontend_url.clone());
        let auth_url = gateway.get_oauth_url(&state.token);

        Ok(ConnectFlow::OAuth(OAuthFlow {
            auth_url,
            state: state.token.clone(),
            metadata: Map::new(),
        }))
    }
}

macro_rules! simple_gateway_connector {
    ($name:ident, $platform:literal, $gateway:ty, $state_flavor:expr) => {
        pub struct $name {
            config: Arc<Config>,
            capabilities: ConnectorCapabilities,
        }

        impl $name {
            pub fn new(config: Arc<Config>) -> Self {
                Self {
                    config,
                    capabilities: ConnectorCapabilities {
                        auth_type: ConnectorAuthType::OAuth,
                        state_flavor: $state_flavor,
                        required_fields: vec![],
                        optional_fields: vec![],
                        requires_shop_domain: false,
                        supported_regions: vec![],
                        instructions: None,
                    },
                }
            }

            fn credentials(&self) -> AppResult<PlatformCredentials> {
                self.config.get_platform_credentials($platform)
            }
        }

        #[async_trait]
        impl PlatformConnector for $name {
            fn platform(&self) -> &'static str {
                $platform
            }

            fn capabilities(&self) -> &ConnectorCapabilities {
                &self.capabilities
            }

            async fn auth_flow(
                &self,
                _: &ConnectContext,
                state: &StateEnvelope,
            ) -> AppResult<ConnectFlow> {
                let credentials = self.credentials()?;
                let gateway = <$gateway>::new(credentials);
                let auth_url = gateway.get_oauth_url(&state.token);

                Ok(ConnectFlow::OAuth(OAuthFlow {
                    auth_url,
                    state: state.token.clone(),
                    metadata: Map::new(),
                }))
            }
        }
    };
}

simple_gateway_connector!(
    AlibabaConnector,
    "alibaba",
    AlibabaGateway,
    StateFlavor::Base64Json
);
simple_gateway_connector!(
    AliExpressConnector,
    "aliexpress",
    AliExpressGateway,
    StateFlavor::Base64Json
);
simple_gateway_connector!(
    AmazonConnector,
    "amazon",
    AmazonGateway,
    StateFlavor::PlainUuid
);
simple_gateway_connector!(EbayConnector, "ebay", EbayGateway, StateFlavor::PlainUuid);
simple_gateway_connector!(EtsyConnector, "etsy", EtsyGateway, StateFlavor::PlainUuid);
simple_gateway_connector!(
    BigCommerceConnector,
    "bigcommerce",
    BigCommerceGateway,
    StateFlavor::PlainUuid
);
simple_gateway_connector!(WixConnector, "wix", WixGateway, StateFlavor::Base64Json);
simple_gateway_connector!(JDConnector, "jd", JDGateway, StateFlavor::PlainUuid);

/// Ecwid connector requires shop_id context.
pub struct EcwidConnector {
    config: Arc<Config>,
    capabilities: ConnectorCapabilities,
}

impl EcwidConnector {
    pub fn new(config: Arc<Config>) -> Self {
        Self {
            config,
            capabilities: ConnectorCapabilities {
                auth_type: ConnectorAuthType::OAuth,
                state_flavor: StateFlavor::PlainUuid,
                required_fields: vec![],
                optional_fields: vec![],
                requires_shop_domain: false,
                supported_regions: vec![],
                instructions: Some(
                    "Ecwid uses shop_id as store_id during connect requests.".to_string(),
                ),
            },
        }
    }

    fn credentials(&self) -> AppResult<PlatformCredentials> {
        self.config.get_platform_credentials("ecwid")
    }
}

#[async_trait]
impl PlatformConnector for EcwidConnector {
    fn platform(&self) -> &'static str {
        "ecwid"
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        &self.capabilities
    }

    async fn auth_flow(
        &self,
        ctx: &ConnectContext,
        state: &StateEnvelope,
    ) -> AppResult<ConnectFlow> {
        if ctx.shop_id.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Ecwid connect requires shop_id as store identifier".to_string(),
            ));
        }

        let credentials = self.credentials()?;
        let gateway = EcwidGateway::new(credentials, ctx.shop_id.clone());
        let auth_url = gateway.get_oauth_url(&state.token);

        Ok(ConnectFlow::OAuth(OAuthFlow {
            auth_url,
            state: state.token.clone(),
            metadata: Map::new(),
        }))
    }
}

/// Zoho connector includes org context.
pub struct ZohoConnector {
    config: Arc<Config>,
    capabilities: ConnectorCapabilities,
}

impl ZohoConnector {
    pub fn new(config: Arc<Config>) -> Self {
        Self {
            config,
            capabilities: ConnectorCapabilities {
                auth_type: ConnectorAuthType::OAuth,
                state_flavor: StateFlavor::PlainUuid,
                required_fields: vec![],
                optional_fields: vec![],
                requires_shop_domain: false,
                supported_regions: vec![],
                instructions: Some(
                    "Zoho requires org_id (tenant_id) during connect to map tenants.".to_string(),
                ),
            },
        }
    }

    fn credentials(&self) -> AppResult<PlatformCredentials> {
        self.config.get_platform_credentials("zoho")
    }
}

#[async_trait]
impl PlatformConnector for ZohoConnector {
    fn platform(&self) -> &'static str {
        "zoho"
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        &self.capabilities
    }

    async fn auth_flow(
        &self,
        ctx: &ConnectContext,
        state: &StateEnvelope,
    ) -> AppResult<ConnectFlow> {
        if ctx.org_id.trim().is_empty() {
            return Err(AppError::BadRequest(
                "Zoho connect requires org_id in the query parameters".to_string(),
            ));
        }
        let credentials = self.credentials()?;
        let gateway = ZohoGateway::new(credentials, ctx.org_id.clone());
        let auth_url = gateway.get_oauth_url(&state.token);

        Ok(ConnectFlow::OAuth(OAuthFlow {
            auth_url,
            state: state.token.clone(),
            metadata: Map::new(),
        }))
    }
}

/// Static API key connectors
pub struct ApiKeyConnector {
    platform: &'static str,
    required_fields: Vec<String>,
    instructions: String,
    additional_message: Option<String>,
}

impl ApiKeyConnector {
    pub fn new(
        platform: &'static str,
        required_fields: Vec<&str>,
        instructions: impl Into<String>,
        additional_message: Option<String>,
    ) -> Self {
        Self {
            platform,
            required_fields: required_fields.into_iter().map(|f| f.to_string()).collect(),
            instructions: instructions.into(),
            additional_message: additional_message.map(Into::into),
        }
    }
}

#[async_trait]
impl PlatformConnector for ApiKeyConnector {
    fn platform(&self) -> &'static str {
        self.platform
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        static DEFAULT_CAPABILITIES: Lazy<ConnectorCapabilities> =
            Lazy::new(|| ConnectorCapabilities {
                auth_type: ConnectorAuthType::ApiKey,
                state_flavor: StateFlavor::PlainUuid,
                required_fields: vec![],
                optional_fields: vec![],
                requires_shop_domain: false,
                supported_regions: vec![],
                instructions: None,
            });
        &DEFAULT_CAPABILITIES
    }

    async fn auth_flow(&self, _: &ConnectContext, _: &StateEnvelope) -> AppResult<ConnectFlow> {
        Ok(ConnectFlow::ApiKey(ApiKeyFlow {
            message: self.additional_message.clone().unwrap_or_else(|| {
                "Provide the required credentials to complete the connection.".to_string()
            }),
            required_fields: self.required_fields.clone(),
            instructions: Some(self.instructions.clone()),
        }))
    }
}

/// Static JWT connector
pub struct JwtConnector {
    platform: &'static str,
    required_fields: Vec<String>,
    instructions: String,
}

impl JwtConnector {
    pub fn new(
        platform: &'static str,
        required_fields: Vec<&str>,
        instructions: impl Into<String>,
    ) -> Self {
        Self {
            platform,
            required_fields: required_fields.into_iter().map(|f| f.to_string()).collect(),
            instructions: instructions.into(),
        }
    }
}

#[async_trait]
impl PlatformConnector for JwtConnector {
    fn platform(&self) -> &'static str {
        self.platform
    }

    fn capabilities(&self) -> &ConnectorCapabilities {
        static DEFAULT_CAPABILITIES: Lazy<ConnectorCapabilities> =
            Lazy::new(|| ConnectorCapabilities {
                auth_type: ConnectorAuthType::Jwt,
                state_flavor: StateFlavor::PlainUuid,
                required_fields: vec![],
                optional_fields: vec![],
                requires_shop_domain: false,
                supported_regions: vec![],
                instructions: None,
            });
        &DEFAULT_CAPABILITIES
    }

    async fn auth_flow(&self, _: &ConnectContext, _: &StateEnvelope) -> AppResult<ConnectFlow> {
        Ok(ConnectFlow::Jwt(JwtFlow {
            message: "Provide the required credentials to complete the connection.".to_string(),
            required_fields: self.required_fields.clone(),
            instructions: Some(self.instructions.clone()),
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{
        AiConfig, AuthConfig, Config, DatabaseConfig, HydraConfig, IngestionConfig, KetoConfig,
        KratosConfig, MediaConfig, ObservabilityConfig, PlatformConfig, PlatformCredentials,
        QdrantConfig, RabbitMqConfig, SecurityConfig, ServerConfig, WorkerConfig,
    };
    use std::collections::HashMap;

    struct DummyConnector {
        capabilities: ConnectorCapabilities,
    }

    #[async_trait]
    impl PlatformConnector for DummyConnector {
        fn platform(&self) -> &'static str {
            "dummy"
        }

        fn capabilities(&self) -> &ConnectorCapabilities {
            &self.capabilities
        }

        async fn auth_flow(
            &self,
            _: &ConnectContext,
            state: &StateEnvelope,
        ) -> AppResult<ConnectFlow> {
            Ok(ConnectFlow::OAuth(OAuthFlow {
                auth_url: "https://example.com/oauth".to_string(),
                state: state.token.clone(),
                metadata: Map::new(),
            }))
        }
    }

    #[tokio::test]
    async fn state_envelope_encodes_base64() {
        let ctx = ConnectContext::new("shopify", "org-1", "shop-1", "nonce-123")
            .with_shop_domain(Some("demo.myshopify.com".into()));
        let envelope = StateEnvelope::from_context(&ctx, StateFlavor::Base64Json).unwrap();

        let decoded = String::from_utf8(
            general_purpose::STANDARD
                .decode(envelope.token.clone())
                .unwrap(),
        )
        .unwrap();

        assert!(decoded.contains("\"tenant_id\":\"org-1\""));
        assert!(decoded.contains("\"shop_domain\":\"demo.myshopify.com\""));
    }

    #[tokio::test]
    async fn connector_registry_returns_registered_connector() {
        let connector = Arc::new(DummyConnector {
            capabilities: ConnectorCapabilities::default(),
        }) as Arc<dyn PlatformConnector>;

        let mut registry = ConnectorRegistry::new();
        registry.register(connector.clone());

        assert_eq!(registry.len(), 1);

        let retrieved = registry.get("dummy").expect("connector should exist");
        if let ConnectFlow::OAuth(flow) = retrieved
            .auth_flow(
                &ConnectContext::new("dummy", "org", "shop", "nonce"),
                &StateEnvelope::from_context(
                    &ConnectContext::new("dummy", "org", "shop", "nonce"),
                    StateFlavor::PlainUuid,
                )
                .unwrap(),
            )
            .await
            .unwrap()
        {
            assert_eq!(flow.auth_url, "https://example.com/oauth");
        } else {
            panic!("unexpected flow");
        }
    }

    #[test]
    fn context_includes_metadata_in_payload() {
        let mut ctx = ConnectContext::new("tiktok", "org-9", "shop-1", "state-xyz")
            .with_shop_region(Some("SG".into()));
        ctx.insert_metadata("foo", Value::String("bar".into()));

        let payload = ctx.state_payload();
        assert_eq!(payload.get("foo"), Some(&Value::String("bar".to_string())));
        assert_eq!(
            payload.get("shop_region"),
            Some(&Value::String("SG".to_string()))
        );
    }

    #[test]
    fn shopify_connector_reports_expected_capabilities() {
        let config = test_config();
        let connector = ShopifyConnector::new(config.clone());
        let caps = connector.capabilities();
        assert!(caps.requires_shop_domain);
        assert_eq!(caps.state_flavor, StateFlavor::Base64Json);
        assert!(caps
            .required_fields
            .iter()
            .any(|field| field == "shop_domain"));
    }

    #[test]
    fn tiktok_connector_reports_optional_region() {
        let config = test_config();
        let connector = TikTokConnector::new(config);
        let caps = connector.capabilities();
        assert!(!caps.requires_shop_domain);
        assert_eq!(caps.state_flavor, StateFlavor::Base64Json);
        assert!(caps
            .optional_fields
            .iter()
            .any(|field| field == "shop_region"));
    }

    fn test_config() -> Arc<Config> {
        let server = ServerConfig {
            host: "127.0.0.1".into(),
            port: 8080,
            base_url: "http://localhost:8080".into(),
            cors_origins: vec![],
            request_timeout_secs: 30,
            max_body_size: 10_000_000,
        };

        let database = DatabaseConfig {
            clickhouse_url: "http://localhost:8123".into(),
            clickhouse_database: "default".into(),
            max_connections: 5,
            connection_timeout_secs: 5,
        };

        let qdrant = QdrantConfig {
            url: "http://localhost:6333".into(),
            api_key: None,
            collection_prefix: "test".into(),
            default_limit: 10,
        };

        let rabbitmq = RabbitMqConfig {
            url: "amqp://guest:guest@localhost:5672/%2f".into(),
            exchange: "test".into(),
            queue_prefix: "test".into(),
            prefetch_count: 10,
        };

        let auth = AuthConfig {
            jwt_secret: "secret".into(),
            jwt_expiration_hours: 24,
            encryption_key: "encryption".into(),
            x_auth_token_secret: "token".into(),
            ory_kratos_url: None,
            ory_hydra_url: None,
            dev_mode: true,
            google_client_id: None,
            google_client_secret: None,
        };

        let security = SecurityConfig {
            encryption_key: None,
            x_auth_token_secret: None,
            strapi_backend_token: None,
        };

        let keto = KetoConfig {
            read_url: "http://localhost:4466".into(),
            write_url: "http://localhost:4467".into(),
        };

        let hydra = HydraConfig {
            admin_url: "http://localhost:4445".into(),
            public_url: "http://localhost:4444".into(),
        };

        let kratos = KratosConfig {
            admin_url: "http://localhost:4434".into(),
            public_url: "http://localhost:4433".into(),
        };

        let mut platforms = PlatformConfig::default();
        platforms.shopify = PlatformCredentials {
            app_key: "shopify_key".into(),
            app_secret: "shopify_secret".into(),
            oauth_authorize_url: Some("https://example.myshopify.com/admin/oauth/authorize".into()),
            oauth_token_url: Some("https://example.myshopify.com/admin/oauth/access_token".into()),
            ..PlatformCredentials::default()
        };
        platforms.tiktok = PlatformCredentials {
            app_key: "tiktok_key".into(),
            app_secret: "tiktok_secret".into(),
            oauth_authorize_url: Some("https://auth.tiktok-shops.com/oauth/authorize".into()),
            ..PlatformCredentials::default()
        };

        let ingestion = IngestionConfig {
            webhook_shared_secrets: HashMap::new(),
            webhook_max_batch_items: 10,
            webhook_max_body_bytes: 1024,
            webhook_idempotency_ttl_secs: 60,
            webhook_queue_routing_key: "ingest".into(),
            crawler_url_queue: "crawler_urls".into(),
            crawler_prefetch: 10,
            crawler_result_queue: "crawler_results".into(),
            crawler_dlq: "crawler_dlq".into(),
        };

        let media = MediaConfig {
            worker_url: "http://localhost:9000".into(),
            auth_token: None,
            cf_worker_upload_url: None,
            cf_worker_download_url: None,
            cf_worker_api_token: None,
        };

        Arc::new(Config {
            server,
            database,
            qdrant,
            rabbitmq,
            redis_url: "redis://localhost".into(),
            auth,
            security,
            keto,
            hydra,
            kratos,
            platforms,
            ai: AiConfig::default(),
            worker: WorkerConfig::default(),
            observability: ObservabilityConfig {
                jaeger_endpoint: None,
                prometheus_port: 9090,
                log_level: "info".into(),
                log_format: "plain".into(),
            },
            frontend_url: "https://frontend.test".into(),
            auth_token: "test-token".into(),
            strapi_url: None,
            ingestion,
            media,
            platform_credentials: None,
        })
    }
}
