use std::collections::HashMap;
use std::sync::Arc;

use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use once_cell::sync::Lazy;
use parking_lot::RwLock;
use serde::{Deserialize, Serialize};

use crate::AppState;

static PRODUCT_STORE: Lazy<RwLock<HashMap<String, MerchantProductDetailResponse>>> =
    Lazy::new(|| {
        let mut map = HashMap::new();
        let sample_id = "right-boost".to_string();
        map.insert(sample_id.clone(), sample_product(&sample_id));
        RwLock::new(map)
    });

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductDetailResponse {
    pub product: MerchantProduct,
    pub status: MerchantProductStatus,
    pub needs_attention: Vec<MerchantProductIssue>,
    pub shipping: MerchantProductShipping,
    pub traffic: MerchantProductTraffic,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProduct {
    pub id: String,
    pub title: String,
    pub website_url: String,
    pub price: MerchantProductMoney,
    pub brand: String,
    pub mpn: String,
    pub product_id: String,
    pub condition: String,
    pub description: String,
    pub images: Vec<MerchantProductImage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductMoney {
    pub amount: f64,
    pub currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductImage {
    pub url: String,
    pub alt: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductStatus {
    pub state: MerchantProductApprovalState,
    pub label: String,
    pub summary: String,
    pub help_center_url: Option<String>,
    pub visibility: MerchantProductVisibility,
    pub marketing_methods: Vec<String>,
    pub countries: Vec<String>,
    pub last_updated: String,
    pub source: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MerchantProductApprovalState {
    Approved,
    NotApproved,
    Pending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductVisibility {
    pub show_on_google_once_approved: bool,
    pub show_in_ads: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductIssue {
    pub id: String,
    pub title: String,
    pub description: String,
    pub severity: MerchantProductIssueSeverity,
    pub link: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum MerchantProductIssueSeverity {
    Critical,
    Warning,
    Info,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductShipping {
    pub warehouse_location: String,
    pub services: Vec<MerchantProductShippingService>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductShippingService {
    pub name: String,
    pub method: String,
    pub price: MerchantProductMoney,
    pub estimated_delivery: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MerchantProductTraffic {
    pub views: u64,
    pub clicks: u64,
    pub conversions: u64,
    pub ctr: f64,
    pub last_updated: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMerchantProductVisibilityRequest {
    pub show_on_google_once_approved: bool,
    pub show_in_ads: bool,
}

pub async fn get_merchant_product_detail(
    State(_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> impl IntoResponse {
    let mut store = PRODUCT_STORE.write();
    let entry = store
        .entry(product_id.clone())
        .or_insert_with(|| sample_product(&product_id));

    Json(entry.clone())
}

pub async fn update_merchant_product_visibility(
    State(_state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Json(payload): Json<UpdateMerchantProductVisibilityRequest>,
) -> impl IntoResponse {
    let mut store = PRODUCT_STORE.write();
    let entry = store
        .entry(product_id.clone())
        .or_insert_with(|| sample_product(&product_id));

    entry.status.visibility.show_on_google_once_approved = payload.show_on_google_once_approved;
    entry.status.visibility.show_in_ads = payload.show_in_ads;
    entry.status.last_updated = current_timestamp();

    Json(entry.clone())
}

fn sample_product(product_id: &str) -> MerchantProductDetailResponse {
    MerchantProductDetailResponse {
        product: MerchantProduct {
            id: product_id.to_string(),
            title: "Philips Bright Boost super 80 หลอดนีออน T8 TL-D 36W ขั้วเขียว TLD หลอดไฟฟลูออเรสเซนต์ หลอดไฟนีออนยาว".to_string(),
            website_url: "https://www.sangaroon.co.th/th/products/right-boost".to_string(),
            price: MerchantProductMoney {
                amount: 320.0,
                currency: "THB".to_string(),
            },
            brand: "Philips".to_string(),
            mpn: "right-boost".to_string(),
            product_id: "right-boost".to_string(),
            condition: "New".to_string(),
            description: "ซื้อ Philips Bright Boost super 80 หลอดนีออน T8 TL-D 36W ขั้วเขียว TLD หลอดไฟนีออนยาว จาก Philips ราค 320 บาท/หลอด คุณภาพดี ส่งฟรีทั่วไทย สั่งซื้อออนไลน์ได้แล้ววันนี้".to_string(),
            images: vec![
                MerchantProductImage {
                    url: "https://storage.googleapis.com/ecommerce-connect-demo/products/philips-bright-boost/main.jpg".to_string(),
                    alt: Some("Philips Bright Boost Tube Light".to_string()),
                },
                MerchantProductImage {
                    url: "https://storage.googleapis.com/ecommerce-connect-demo/products/philips-bright-boost/detail-1.jpg".to_string(),
                    alt: Some("Packaging front view".to_string()),
                },
                MerchantProductImage {
                    url: "https://storage.googleapis.com/ecommerce-connect-demo/products/philips-bright-boost/detail-2.jpg".to_string(),
                    alt: Some("Tube detail and wattage".to_string()),
                },
            ],
        },
        status: MerchantProductStatus {
            state: MerchantProductApprovalState::NotApproved,
            label: "Not approved".to_string(),
            summary: "This product cannot be shown. Review and fix your product so it can be shown to customers.".to_string(),
            help_center_url: Some("https://support.google.com/merchants/answer/6150112".to_string()),
            visibility: MerchantProductVisibility {
                show_on_google_once_approved: true,
                show_in_ads: true,
            },
            marketing_methods: vec!["Free listings".to_string()],
            countries: vec!["Thailand".to_string()],
            last_updated: current_timestamp(),
            source: "Online store".to_string(),
        },
        needs_attention: vec![
            MerchantProductIssue {
                id: format!("{product_id}-policy"),
                title: "Product title contains promotional text".to_string(),
                description: "Remove excessive promotional wording to comply with Google Merchant Center policies."
                    .to_string(),
                severity: MerchantProductIssueSeverity::Warning,
                link: Some("https://support.google.com/merchants/answer/6324468".to_string()),
            },
            MerchantProductIssue {
                id: format!("{product_id}-image"),
                title: "Primary image resolution is low".to_string(),
                description: "Upload a higher resolution image (at least 800x800px) without watermarks."
                    .to_string(),
                severity: MerchantProductIssueSeverity::Critical,
                link: Some("https://support.google.com/merchants/answer/6324350".to_string()),
            },
            MerchantProductIssue {
                id: format!("{product_id}-shipping"),
                title: "Shipping data missing for some regions".to_string(),
                description:
                    "Add shipping settings for rural provinces to ensure accurate delivery estimates."
                        .to_string(),
                severity: MerchantProductIssueSeverity::Warning,
                link: None,
            },
        ],
        shipping: MerchantProductShipping {
            warehouse_location: "Bangkok, Thailand".to_string(),
            services: vec![
                MerchantProductShippingService {
                    name: "Standard Delivery".to_string(),
                    method: "Courier".to_string(),
                    price: MerchantProductMoney {
                        amount: 40.0,
                        currency: "THB".to_string(),
                    },
                    estimated_delivery: "2-3 business days".to_string(),
                },
                MerchantProductShippingService {
                    name: "Express Delivery".to_string(),
                    method: "Courier".to_string(),
                    price: MerchantProductMoney {
                        amount: 85.0,
                        currency: "THB".to_string(),
                    },
                    estimated_delivery: "1 business day".to_string(),
                },
                MerchantProductShippingService {
                    name: "In-store Pickup".to_string(),
                    method: "Pickup".to_string(),
                    price: MerchantProductMoney {
                        amount: 0.0,
                        currency: "THB".to_string(),
                    },
                    estimated_delivery: "Available same day".to_string(),
                },
            ],
        },
        traffic: MerchantProductTraffic {
            views: 1375,
            clicks: 218,
            conversions: 24,
            ctr: 15.85,
            last_updated: current_timestamp(),
        },
    }
}

fn current_timestamp() -> String {
    chrono::Utc::now().to_rfc3339()
}
