//! # Platform Authentication Configuration - การตั้งค่าการยืนยันตัวตน
//!
//! โมดูลนี้จัดการการตั้งค่าการยืนยันตัวตน (OAuth, API Key, Credentials)
//! สำหรับแพลตฟอร์มอีคอมเมิร์ซที่รองรับ รวมถึงการจัดการ endpoint URL ต่างๆ
//!
//! ## คุณสมบัติหลัก:
//! - Multi-platform authentication configuration
//! - OAuth 2.0 flow support สำหรับ platforms ต่างๆ
//! - API key และ credentials management
//! - Dynamic endpoint URL configuration
//! - Platform-specific authentication requirements
//!
//! ## Supported Auth Types:
//! - **OAuth**: สำหรับ TikTok Shop, Shopee, Lazada
//! - **API Key**: สำหรับ Amazon SP-API, eBay
//! - **Credentials**: สำหรับ WooCommerce, Magento
//!
//! ## Platform Configurations:
//! - Client ID/Secret management
//! - Redirect URI configuration
//! - Scope และ permission settings
//! - Token endpoint URLs
//! - Refresh token handling
use std::collections::HashMap;

/// ประเภทของการยืนยันตัวตนที่รองรับ
#[derive(Debug, Clone, PartialEq)]
pub enum AuthType {
    OAuth,
    ApiKey,
    Credentials,
}

/// การตั้งค่าการยืนยันตัวตนสำหรับแพลตฟอร์มเฉพาะ
#[derive(Debug, Clone)]
pub struct PlatformAuthConfig {
    pub auth_type: AuthType,
    pub oauth_config: Option<OAuthConfig>,
    pub required_fields: Vec<String>,
    pub api_endpoints: PlatformEndpoints,
}

/// การตั้งค่า OAuth สำหรับแพลตฟอร์มที่รองรับ OAuth
#[derive(Debug, Clone)]
pub struct OAuthConfig {
    pub has_native_state: bool,
    pub requires_signature: bool,
    pub state_encoding: StateEncoding,
    pub auth_url: String,
    pub token_url: String,
    pub scopes: Vec<String>,
}

/// วิธีการ encoding สำหรับ OAuth state parameter
#[derive(Debug, Clone)]
pub enum StateEncoding {
    Standard,
    UrlPath,
    UrlSuffix,
}

/// API endpoints สำหรับแพลตฟอร์มเฉพาะ
#[derive(Debug, Clone)]
pub struct PlatformEndpoints {
    pub base_url: String,
    pub products: String,
    pub orders: String,
    pub inventory: String,
}

/// Registry สำหรับจัดเก็บการตั้งค่าของแพลตฟอร์มทั้งหมด
pub struct PlatformRegistry {
    configs: HashMap<String, PlatformAuthConfig>,
}

impl PlatformRegistry {
    pub fn new() -> Self {
        let mut configs = HashMap::new();

        configs.insert("tiktok".to_string(), Self::tiktok_config());
        configs.insert("shopee".to_string(), Self::shopee_config());
        configs.insert("lazada".to_string(), Self::lazada_config());
        configs.insert("amazon".to_string(), Self::amazon_config());
        configs.insert("shopify".to_string(), Self::shopify_config());
        configs.insert("ebay".to_string(), Self::ebay_config());
        configs.insert("alibaba".to_string(), Self::alibaba_config());
        configs.insert("aliexpress".to_string(), Self::aliexpress_config());
        configs.insert("walmart".to_string(), Self::walmart_config());
        configs.insert("jd".to_string(), Self::jd_config());
        configs.insert("taobao".to_string(), Self::taobao_config());
        configs.insert("wix".to_string(), Self::wix_config());
        configs.insert("bigcommerce".to_string(), Self::bigcommerce_config());
        configs.insert("ecwid".to_string(), Self::ecwid_config());
        configs.insert("lineshopping".to_string(), Self::lineshopping_config());
        configs.insert("rakuten".to_string(), Self::rakuten_config());
        configs.insert("woocommerce".to_string(), Self::woocommerce_config());
        configs.insert("medusa".to_string(), Self::medusa_config());
        configs.insert("magento".to_string(), Self::magento_config());

        Self { configs }
    }

    pub fn get(&self, platform: &str) -> Option<&PlatformAuthConfig> {
        self.configs.get(&platform.to_lowercase())
    }

    fn tiktok_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://auth.tiktok-shops.com/oauth/authorize".to_string(),
                token_url: "https://auth.tiktok-shops.com/api/v2/token".to_string(),
                scopes: vec![
                    "seller.product.basic".to_string(),
                    "seller.order.info".to_string(),
                ],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://open-api.tiktokglobalshop.com".to_string(),
                products: "/api/products".to_string(),
                orders: "/api/orders".to_string(),
                inventory: "/api/inventory".to_string(),
            },
        }
    }

    fn shopee_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: false,
                requires_signature: true,
                state_encoding: StateEncoding::UrlPath,
                auth_url: "https://partner.shopeemobile.com".to_string(),
                token_url: "https://partner.shopeemobile.com/api/v2/auth/token/get".to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://partner.shopeemobile.com".to_string(),
                products: "/api/v2/product/get_item_list".to_string(),
                orders: "/api/v2/order/get_order_list".to_string(),
                inventory: "/api/v2/product/update_stock".to_string(),
            },
        }
    }

    fn lazada_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: false,
                requires_signature: true,
                state_encoding: StateEncoding::UrlSuffix,
                auth_url: "https://auth.lazada.com/oauth/authorize".to_string(),
                token_url: "https://auth.lazada.com/rest/auth/token/create".to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://api.lazada.com/rest".to_string(),
                products: "/products/get".to_string(),
                orders: "/orders/get".to_string(),
                inventory: "/product/stock/sellable/update".to_string(),
            },
        }
    }

    fn amazon_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://sellercentral.amazon.com/apps/authorize/consent".to_string(),
                token_url: "https://api.amazon.com/auth/o2/token".to_string(),
                scopes: vec!["sellingpartnerapi::migration".to_string()],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://sellingpartnerapi.amazon.com".to_string(),
                products: "/catalog/v0/items".to_string(),
                orders: "/orders/v0/orders".to_string(),
                inventory: "/fba/inventory/v1/summaries".to_string(),
            },
        }
    }

    fn shopify_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://{shop}.myshopify.com/admin/oauth/authorize".to_string(),
                token_url: "https://{shop}.myshopify.com/admin/oauth/access_token".to_string(),
                scopes: vec!["read_products".to_string(), "write_products".to_string()],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://{shop}.myshopify.com".to_string(),
                products: "/admin/api/2024-01/products.json".to_string(),
                orders: "/admin/api/2024-01/orders.json".to_string(),
                inventory: "/admin/api/2024-01/inventory_levels.json".to_string(),
            },
        }
    }

    fn ebay_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://auth.ebay.com/oauth2/authorize".to_string(),
                token_url: "https://api.ebay.com/identity/v1/oauth2/token".to_string(),
                scopes: vec!["https://api.ebay.com/oauth/api_scope".to_string()],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://api.ebay.com".to_string(),
                products: "/sell/inventory/v1/inventory_item".to_string(),
                orders: "/sell/fulfillment/v1/order".to_string(),
                inventory: "/sell/inventory/v1/inventory_item".to_string(),
            },
        }
    }

    fn alibaba_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://openapi-auth.alibaba.com/oauth/authorize".to_string(),
                token_url: "https://gw.api.alibaba.com/auth/token/create".to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://gw.api.alibaba.com".to_string(),
                products: "/openapi/param2/1/com.alibaba.product/alibaba.product.getList"
                    .to_string(),
                orders: "/openapi/param2/1/com.alibaba.trade/alibaba.trade.get.buyerView"
                    .to_string(),
                inventory: "/openapi/param2/1/com.alibaba.product/alibaba.product.update"
                    .to_string(),
            },
        }
    }

    fn aliexpress_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://auth.aliexpress.com/oauth/authorize".to_string(),
                token_url: "https://gw.api.aliexpress.com/openapi/param2/1/system.oauth2/getToken"
                    .to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://gw.api.aliexpress.com".to_string(),
                products: "/openapi/param2/1/aliexpress.open/api.findProductInfoListQuery"
                    .to_string(),
                orders: "/openapi/param2/1/aliexpress.open/api.findOrderListQuery".to_string(),
                inventory: "/openapi/param2/1/aliexpress.open/api.editProductStock".to_string(),
            },
        }
    }

    fn walmart_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://marketplace.walmartapis.com/v3/oauth2/authorize".to_string(),
                token_url: "https://marketplace.walmartapis.com/v3/token".to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://marketplace.walmartapis.com".to_string(),
                products: "/v3/items".to_string(),
                orders: "/v3/orders".to_string(),
                inventory: "/v3/inventory".to_string(),
            },
        }
    }

    fn jd_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://oauth.jd.com/oauth/authorize".to_string(),
                token_url: "https://oauth.jd.com/oauth/token".to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://api.jd.com".to_string(),
                products: "/routerjson".to_string(),
                orders: "/routerjson".to_string(),
                inventory: "/routerjson".to_string(),
            },
        }
    }

    fn taobao_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://oauth.taobao.com/authorize".to_string(),
                token_url: "https://oauth.taobao.com/token".to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://eco.taobao.com/router/rest".to_string(),
                products: "".to_string(),
                orders: "".to_string(),
                inventory: "".to_string(),
            },
        }
    }

    fn wix_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://www.wix.com/installer/install".to_string(),
                token_url: "https://www.wixapis.com/oauth/access".to_string(),
                scopes: vec![],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://www.wixapis.com".to_string(),
                products: "/stores/v1/products".to_string(),
                orders: "/stores/v2/orders".to_string(),
                inventory: "/stores/v1/products".to_string(),
            },
        }
    }

    fn bigcommerce_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://login.bigcommerce.com/oauth2/authorize".to_string(),
                token_url: "https://login.bigcommerce.com/oauth2/token".to_string(),
                scopes: vec!["store_v2_products".to_string()],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://api.bigcommerce.com".to_string(),
                products: "/stores/{store_hash}/v3/catalog/products".to_string(),
                orders: "/stores/{store_hash}/v2/orders".to_string(),
                inventory: "/stores/{store_hash}/v3/inventory".to_string(),
            },
        }
    }

    fn ecwid_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::OAuth,
            oauth_config: Some(OAuthConfig {
                has_native_state: true,
                requires_signature: false,
                state_encoding: StateEncoding::Standard,
                auth_url: "https://my.ecwid.com/api/oauth/authorize".to_string(),
                token_url: "https://my.ecwid.com/api/oauth/token".to_string(),
                scopes: vec!["read_catalog".to_string(), "update_catalog".to_string()],
            }),
            required_fields: vec![],
            api_endpoints: PlatformEndpoints {
                base_url: "https://app.ecwid.com/api/v3".to_string(),
                products: "/{store_id}/products".to_string(),
                orders: "/{store_id}/orders".to_string(),
                inventory: "/{store_id}/products".to_string(),
            },
        }
    }

    fn lineshopping_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::ApiKey,
            oauth_config: None,
            required_fields: vec!["api_key".to_string()],
            api_endpoints: PlatformEndpoints {
                base_url: "https://api.line.me".to_string(),
                products: "/lineshopping/v1/products".to_string(),
                orders: "/lineshopping/v1/orders".to_string(),
                inventory: "/lineshopping/v1/inventory".to_string(),
            },
        }
    }

    fn rakuten_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::ApiKey,
            oauth_config: None,
            required_fields: vec!["application_id".to_string()],
            api_endpoints: PlatformEndpoints {
                base_url: "https://app.rakuten.co.jp".to_string(),
                products: "/services/api/IchibaItem/Search/20170706".to_string(),
                orders: "/services/api/Order/SearchOrder/20130606".to_string(),
                inventory: "/services/api/Inventory/20180808".to_string(),
            },
        }
    }

    fn woocommerce_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::Credentials,
            oauth_config: None,
            required_fields: vec![
                "consumer_key".to_string(),
                "consumer_secret".to_string(),
                "store_url".to_string(),
            ],
            api_endpoints: PlatformEndpoints {
                base_url: "{store_url}".to_string(),
                products: "/wp-json/wc/v3/products".to_string(),
                orders: "/wp-json/wc/v3/orders".to_string(),
                inventory: "/wp-json/wc/v3/products".to_string(),
            },
        }
    }

    fn medusa_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::Credentials,
            oauth_config: None,
            required_fields: vec!["api_key".to_string(), "store_url".to_string()],
            api_endpoints: PlatformEndpoints {
                base_url: "{store_url}".to_string(),
                products: "/store/products".to_string(),
                orders: "/admin/orders".to_string(),
                inventory: "/admin/inventory-items".to_string(),
            },
        }
    }

    fn magento_config() -> PlatformAuthConfig {
        PlatformAuthConfig {
            auth_type: AuthType::Credentials,
            oauth_config: None,
            required_fields: vec![
                "username".to_string(),
                "password".to_string(),
                "store_url".to_string(),
            ],
            api_endpoints: PlatformEndpoints {
                base_url: "{store_url}".to_string(),
                products: "/rest/V1/products".to_string(),
                orders: "/rest/V1/orders".to_string(),
                inventory: "/rest/V1/inventory/source-items".to_string(),
            },
        }
    }
}

impl Default for PlatformRegistry {
    fn default() -> Self {
        Self::new()
    }
}
