use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, HeaderValue},
    response::{IntoResponse, Json, Response},
    Extension, Router,
};
use serde_json::json;
use std::{io::Cursor, sync::Arc};

use rust_decimal::prelude::ToPrimitive;
use rust_xlsxwriter::{Format, Workbook, XlsxError};

use crate::{
    model::error::{AppError, AppResult},
    model::v1::{
        gateway::request::product::{CreateProductRequest, UpdateProductRequest},
        platfrom::{
            entries::{AppResult as ModelAppResult, AuthClaims, Product},
            request::{
                product::sync::{PlatformProductPullRequest, ProductSyncReviewQuery},
                product::{
                    ListSyncJobsQuery, ProductExportQuery, ProductListQuery,
                    ProductMediaDownloadQuery, ProductMediaUploadRequest, ProductSnapshotQuery,
                    ProductSyncLogQuery, PromoteProductSyncRequest, RealtimeSyncRequest,
                    SampleVectorSyncRequest, SyncProductsRequest, SyncQuery, SyncRequestBody,
                    SyncToVectorRequest,
                },
                queries::product_queries::{GetProductQuery, ListProductsQuery},
            },
            response::product::{
                Category, ProductDetail, ProductListItem, ProductListResponse,
                ProductMediaDownloadResponse, ProductMediaUploadResponse,
                ProductSnapshotListResponse, ProductSyncLogResponse, ProductSyncReviewListResponse,
                PromoteProductSyncResponse, SampleVectorSyncResponse, SyncProductListResponse,
                SyncProductsResponse, SyncResponse, SyncToVectorResponse,
            },
        },
    },
    services::{
        platform_product::{
            PlatformProductService, PlatformProductServiceImpl, ProductSyncStatusResponse,
            DEFAULT_EXPORT_LIMIT, MAX_EXPORT_LIMIT,
        },
        product_listing::{ListProductsResponse, ProductListingService, ProductListingServiceImpl},
        vector_ingest::VectorIngestService,
    },
    AppState,
};

// ============================================================================
// Product List Types and Handlers
// ============================================================================

// Using types from model::v1::platfrom::{request::product, response::product}

/// List products from connected platforms
///
/// Retrieves a paginated list of products from one or more connected e-commerce platforms.
/// Supports filtering by platform and shop, with pagination for large catalogs.
///
/// # Product Data
/// Returns unified product format across all platforms including:
/// - Basic info (title, description, SKU)
/// - Pricing and inventory
/// - Images and categories
/// - Platform-specific attributes
#[utoipa::path(
    get,
    path = "/api/platform/products",
    tag = "product",
    params(
        ("platform" = Option<String>, Query, description = "Filter by platform (tiktok, shopee, lazada)"),
        ("shop_id" = Option<String>, Query, description = "Filter by shop ID"),
        ("page" = Option<u32>, Query, description = "Page number (default: 1)"),
        ("limit" = Option<u32>, Query, description = "Items per page (default: 20, max: 100)")
    ),
    responses(
        (status = 200, description = "Products retrieved successfully", body = ListProductsResponse,
            example = json!({
                "products": [
                    {
                        "product_id": "prod_123",
                        "platform": "tiktok",
                        "shop_id": "shop_456",
                        "title": "Nike Air Max",
                        "price": 2500.00,
                        "inventory": 50,
                        "status": "active"
                    }
                ],
                "total": 100,
                "page": 1,
                "limit": 20
            })
        ),
        (status = 400, description = "Invalid query parameters"),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to retrieve products")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_products(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListProductsQuery>,
) -> ModelAppResult<Json<ListProductsResponse>> {
    let listing_service = ProductListingServiceImpl::new(state.clone());

    let response = listing_service
        .list_products(
            "default", // TODO: Get tenant_id from auth context
            query.platform.as_deref(),
            query.shop_id.as_deref(),
            query.search.as_deref(), // search parameter
            query.page,
            query.limit,
        )
        .await?;

    Ok(Json(response))
}

/// Get detailed information for a specific product
///
/// Retrieves comprehensive product details including all attributes,
/// variants, images, and platform-specific metadata.
///
/// # Response Details
/// - Complete product specifications
/// - All SKU variants with pricing
/// - Image gallery with multiple angles
/// - Category hierarchy
/// - SEO metadata
/// - Stock levels per variant
#[utoipa::path(
    get,
    path = "/api/platform/products/{product_id}",
    tag = "product",
    params(
        ("product_id" = String, Path, description = "Product identifier"),
        ("platform" = String, Query, description = "Platform identifier"),
        ("shop_id" = String, Query, description = "Shop identifier")
    ),
    responses(
        (status = 200, description = "Product details retrieved successfully", body = Product,
            example = json!({
                "product_id": "prod_123",
                "platform": "tiktok",
                "shop_id": "shop_456",
                "title": "Nike Air Max Red",
                "description": "Premium running shoes",
                "price": 2500.00,
                "inventory": 50,
                "images": ["https://example.com/img1.jpg"],
                "skus": [
                    {
                        "sku_id": "sku_001",
                        "size": "42",
                        "color": "red",
                        "price": 2500.00,
                        "stock": 10
                    }
                ],
                "categories": ["Footwear", "Running"],
                "attributes": {
                    "brand": "Nike",
                    "material": "Mesh",
                    "origin": "Vietnam"
                },
                "created_at": "2025-01-01T10:00:00Z",
                "updated_at": "2025-01-10T15:30:00Z"
            })
        ),
        (status = 400, description = "Invalid product ID or parameters"),
        (status = 401, description = "Authentication required"),
        (status = 404, description = "Product not found"),
        (status = 500, description = "Failed to retrieve product")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_product(
    State(state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
    Query(query): Query<GetProductQuery>,
) -> ModelAppResult<Json<Product>> {
    let listing_service = ProductListingServiceImpl::new(state.clone());

    let product = listing_service
        .get_product(
            "default", // TODO: Get tenant_id from auth context
            &query.platform,
            &query.shop_id,
            &product_id,
        )
        .await?;

    Ok(Json(product))
}

/// Get list of unique products (no duplicates)
///
/// Retrieves a deduplicated list of products, removing duplicates that may
/// exist across different shops or sync operations. Uses product fingerprinting
/// to identify unique items.
///
/// # Deduplication Logic
/// - Identifies duplicates by title, SKU, and attributes
/// - Returns the most recently updated version
/// - Maintains cross-references to all duplicate instances
#[utoipa::path(
    get,
    path = "/api/platform/products/unique",
    tag = "product",
    params(
        ("platform" = Option<String>, Query, description = "Filter by platform"),
        ("shop_id" = Option<String>, Query, description = "Filter by shop ID"),
        ("page" = u32, Query, description = "Page number (default: 1)"),
        ("limit" = u32, Query, description = "Items per page (default: 20)")
    ),
    responses(
        (status = 200, description = "Unique products retrieved successfully", body = ProductListResponse,
            example = json!({
                "products": [
                    {
                        "product_id": "prod_123",
                        "platform": "tiktok",
                        "shop_id": "shop_456",
                        "title": "Nike Air Max",
                        "price": 2500.00,
                        "inventory": 50,
                        "duplicate_count": 0
                    }
                ],
                "total": 50,
                "page": 1,
                "limit": 20
            })
        ),
        (status = 400, description = "Invalid query parameters"),
        (status = 500, description = "Failed to retrieve products")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_unique_products(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListProductsQuery>,
) -> AppResult<Json<ProductListResponse>> {
    let service = PlatformProductServiceImpl::new(state.clone());

    let response = service
        .list_unique_products(
            params.platform.as_deref(),
            params.shop_id.as_deref(),
            params.search.as_deref(),
            params.page,
            params.limit,
        )
        .await?;

    Ok(Json(response))
}

/// Get single product details
#[utoipa::path(
    get,
    path = "/api/platform/products/{product_id}/detail",
    tag = "product",
    params(
        ("product_id" = String, Path, description = "Product identifier")
    ),
    responses(
        (status = 200, description = "Product detail retrieved successfully", body = ProductDetail),
        (status = 404, description = "Product not found"),
        (status = 500, description = "Failed to retrieve product detail")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_product_detail(
    State(state): State<Arc<AppState>>,
    Path(product_id): Path<String>,
) -> AppResult<Json<ProductDetail>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let product = service.get_product_detail(&product_id).await?;
    Ok(Json(product))
}

pub async fn create_product(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(payload): Json<CreateProductRequest>,
) -> AppResult<impl IntoResponse> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service.create_product(&tenant_id, &payload).await?;
    Ok(Json(response))
}

pub async fn update_product(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(product_id): Path<String>,
    Query(query): Query<GetProductQuery>,
    Json(payload): Json<UpdateProductRequest>,
) -> AppResult<impl IntoResponse> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .update_product(
            &tenant_id,
            &query.platform,
            &query.shop_id,
            &product_id,
            &payload,
        )
        .await?;

    Ok(Json(response))
}

pub async fn delete_product(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(product_id): Path<String>,
    Query(query): Query<GetProductQuery>,
) -> AppResult<impl IntoResponse> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .delete_product(&tenant_id, &query.platform, &query.shop_id, &product_id)
        .await?;

    Ok(Json(response))
}

pub async fn list_categories(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ListProductsQuery>,
) -> AppResult<Json<Vec<Category>>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let categories = service
        .list_categories(query.platform.as_deref(), query.shop_id.as_deref())
        .await?;
    Ok(Json(categories))
}

// ============================================================================
// Product Sync Types and Handlers
// ============================================================================

/// Synchronize products to vector database for AI search
///
/// Initiates a background job to generate vector embeddings for products
/// and store them in the vector database (Qdrant) for semantic search.
///
/// # Process Flow
/// 1. Retrieves products from specified platform/shop
/// 2. Generates text embeddings using AI model
/// 3. Stores vectors in Qdrant with metadata
/// 4. Returns job ID for status tracking
///
/// # Use Cases
/// - Enable AI-powered product search
/// - Cross-platform product matching
/// - Similar product recommendations
#[utoipa::path(
    post,
    path = "/api/platform/products/vector-sync",
    tag = "product",
    request_body(
        content = SyncToVectorRequest,
        description = "Vector sync configuration",
        example = json!({
            "platform": "tiktok",
            "shop_id": "shop_456",
            "product_ids": ["prod_123", "prod_456"],
            "force_update": false,
            "batch_size": 100
        })
    ),
    responses(
        (status = 200, description = "Vector sync job initiated", body = SyncToVectorResponse,
            example = json!({
                "job_id": "vec_sync_abc123",
                "status": "processing",
                "total_products": 150,
                "message": "Vector synchronization started"
            })
        ),
        (status = 400, description = "Invalid sync parameters"),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to initiate sync")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn sync_to_vector(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(request): Json<SyncToVectorRequest>,
) -> ModelAppResult<Json<SyncToVectorResponse>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let vector_service = VectorIngestService::new(state.clone());
    let response = vector_service.sync_to_vector(&tenant_id, &request).await?;

    Ok(Json(response))
}

/// Fetch sample products directly from the platform, persist them to ClickHouse,
/// and enqueue vector sync jobs (item or batch mode).
#[utoipa::path(
    post,
    path = "/api/platform/products/vector-sync/sample",
    tag = "product",
    request_body(
        content = SampleVectorSyncRequest,
        description = "Fetch sample products from the platform and sync them to the vector store",
        example = json!({
            "platform": "woocommerce",
            "shop_id": "shop_123",
            "mode": "batch",
            "limit": 5,
            "credentials": {
                "api_key": "ck_xxx",
                "api_secret": "cs_xxx",
                "store_url": "https://demo.myshop.com"
            }
        })
    ),
    responses(
        (status = 200, description = "Sample products queued for vector sync", body = SampleVectorSyncResponse),
        (status = 400, description = "Invalid sample sync parameters"),
        (status = 500, description = "Failed to orchestrate sample vector sync")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn sample_vector_sync(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(request): Json<SampleVectorSyncRequest>,
) -> ModelAppResult<Json<SampleVectorSyncResponse>> {
    let tenant_id = request
        .tenant_id
        .clone()
        .or_else(|| claims.org_id.clone())
        .unwrap_or_else(|| "default-tenant".to_string());

    let vector_service = VectorIngestService::new(state.clone());
    let response = vector_service
        .sample_vector_sync(&tenant_id, &request)
        .await?;

    Ok(Json(response))
}

/// Sync products from e-commerce platform (generic endpoint)
///
/// Universal product synchronization endpoint that works with any supported platform.
/// Fetches latest product data from the platform API and updates local database.
///
/// # Sync Process
/// 1. Authenticates with platform using stored credentials
/// 2. Fetches product catalog with pagination
/// 3. Processes products through staging workflow
/// 4. Updates local database with changes
/// 5. Triggers vector embedding generation
///
/// # Important Notes
/// - Access tokens must be provided by Strapi in request body
/// - Supports incremental sync with offset/limit
/// - Handles rate limiting automatically
#[utoipa::path(
    post,
    path = "/api/platform/products/shops/{shop_id}/sync",
    tag = "product",
    params(
        ("shop_id" = String, Path, description = "Shop identifier"),
        ("limit" = Option<i32>, Query, description = "Number of products to sync (default: 100)"),
        ("offset" = Option<i32>, Query, description = "Starting offset for pagination (default: 0)"),
        ("force" = Option<bool>, Query, description = "Force full sync ignoring last sync time")
    ),
    request_body(
        content = Option<SyncRequestBody>,
        description = "Sync configuration with credentials from Strapi",
        example = json!({
            "access_token": "token_from_strapi",
            "shop_cipher": "cipher_for_tiktok",
            "platform": "tiktok"
        })
    ),
    responses(
        (status = 200, description = "Sync completed successfully", body = SyncResponse,
            example = json!({
                "message": "Products synced successfully",
                "status": "completed",
                "sync_id": "sync_123",
                "job_id": "job_456",
                "synced_count": 75,
                "failed_count": 0,
                "success": true,
                "products_synced": 75,
                "products_failed": 0,
                "products_skipped": 25
            })
        ),
        (status = 400, description = "Invalid sync parameters"),
        (status = 401, description = "Missing or invalid access token"),
        (status = 404, description = "Shop not found"),
        (status = 500, description = "Sync failed")
    ),
    security(
        ("bearer_auth" = []),
        ("x_auth_token" = [])
    )
)]
pub async fn sync_products(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Query(query): Query<SyncQuery>,
    body: Option<Json<SyncRequestBody>>,
) -> AppResult<Json<SyncResponse>> {
    let body_ref = body.as_ref().map(|payload| &payload.0);
    let platform = extract_platform_from_body(body_ref)?;
    let response = execute_platform_sync(&state, &platform, &shop_id, &query, body_ref).await?;
    Ok(Json(response))
}

/// Sync products for a specific platform
///
/// Path-based variant that explicitly names the platform.
#[utoipa::path(
    post,
    path = "/api/platform/products/shops/{shop_id}/platforms/{platform}/products/sync",
    tag = "product",
    params(
        ("shop_id" = String, Path, description = "Shop identifier"),
        ("platform" = String, Path, description = "Platform identifier (tiktok, shopee, lazada, etc.)"),
        ("limit" = Option<i32>, Query, description = "Number of products to sync"),
        ("offset" = Option<i32>, Query, description = "Starting offset")
    ),
    request_body(
        content = Option<SyncRequestBody>,
        description = "Sync configuration with credentials",
        example = json!({
            "access_token": "platform_access_token",
            "shop_cipher": "shop_cipher_value",
            "platform": "tiktok"
        })
    ),
    responses(
        (status = 200, description = "Platform products synced", body = SyncResponse),
        (status = 401, description = "Invalid credentials"),
        (status = 500, description = "Platform sync failed")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn sync_platform_products(
    State(state): State<Arc<AppState>>,
    Path((shop_id, platform)): Path<(String, String)>,
    Query(query): Query<SyncQuery>,
    body: Option<Json<SyncRequestBody>>,
) -> AppResult<Json<SyncResponse>> {
    let normalized_platform = platform.trim().to_lowercase();
    let body_ref = body.as_ref().map(|payload| &payload.0);

    if let Some(payload) = body_ref {
        let payload_platform = payload.platform.trim().to_lowercase();
        if !payload_platform.is_empty() && payload_platform != normalized_platform {
            return Err(AppError::BadRequest(format!(
                "Platform mismatch between path ({}) and payload ({})",
                normalized_platform, payload.platform
            )));
        }
    }

    let response =
        execute_platform_sync(&state, &normalized_platform, &shop_id, &query, body_ref).await?;
    Ok(Json(response))
}

/// Fetch platform products in realtime (without saving to database)
#[utoipa::path(
    get,
    path = "/api/platform/products/shops/{shop_id}/platforms/{platform}/products",
    tag = "product",
    params(
        ("shop_id" = String, Path, description = "Shop identifier"),
        ("platform" = String, Path, description = "Platform identifier (tiktok, shopee, lazada, etc.)"),
        ("limit" = Option<u32>, Query, description = "Items per page (default: 50)"),
        ("offset" = Option<u32>, Query, description = "Pagination offset (default: 0)")
    ),
    responses(
        (status = 200, description = "Realtime platform products fetched", body = serde_json::Value),
        (status = 401, description = "Access token missing"),
        (status = 500, description = "Failed to fetch products")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn fetch_platform_products(
    State(state): State<Arc<AppState>>,
    Path((shop_id, platform)): Path<(String, String)>,
    Query(query): Query<ProductListQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let normalized_platform = platform.trim().to_lowercase();
    let response = service
        .fetch_platform_products(&normalized_platform, &shop_id, &query)
        .await?;
    Ok(Json(response))
}

/// Trigger a platform pull using stored credentials in Strapi.
#[utoipa::path(
    post,
    path = "/api/platform/products/shops/{shop_id}/platforms/{platform}/pull",
    tag = "product",
    params(
        ("shop_id" = String, Path, description = "Shop identifier"),
        ("platform" = String, Path, description = "Platform identifier (lineshopping, tiktok, etc.)")
    ),
    request_body(
        content = PlatformProductPullRequest,
        description = "Pull configuration referencing stored credentials",
        example = json!({
            "org_id": "org-abc123",
            "full_sync": false,
            "limit": 100,
            "offset": 0
        })
    ),
    responses(
        (status = 200, description = "Platform pull started", body = SyncResponse),
        (status = 400, description = "Invalid pull parameters"),
        (status = 404, description = "Stored credentials not found"),
        (status = 500, description = "Failed to trigger platform pull")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn pull_platform_products(
    State(state): State<Arc<AppState>>,
    Path((shop_id, platform)): Path<(String, String)>,
    Json(request): Json<PlatformProductPullRequest>,
) -> AppResult<Json<SyncResponse>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let normalized_platform = platform.trim().to_lowercase();

    let sync_body = SyncRequestBody {
        shop_id: shop_id.clone(),
        platform: normalized_platform.clone(),
        mode: None,
        products: None,
        access_token: None,
        shop_cipher: None,
        org_id: Some(request.org_id.clone()),
    };

    let sync_query = SyncQuery {
        full_sync: request.full_sync,
        page_size: None,
        source: Some("platform_pull".to_string()),
        limit: request.limit,
        offset: request.offset,
        batch_id: None,
    };

    let response = service
        .sync_platform_products(
            &normalized_platform,
            &shop_id,
            &sync_query,
            Some(&sync_body),
        )
        .await?;

    Ok(Json(response))
}

/// Sync products from TikTok in realtime (fetch and save immediately)
#[utoipa::path(
    post,
    path = "/api/platform/products/sync/realtime",
    tag = "product",
    request_body(
        content = RealtimeSyncRequest,
        description = "Realtime sync configuration with platform/shop info",
        example = json!({
            "platform": "tiktok",
            "shop_id": "shop_123",
            "access_token": "token-from-strapi",
            "limit": 100,
            "offset": 0
        })
    ),
    responses(
        (status = 200, description = "Realtime sync completed", body = SyncResponse),
        (status = 401, description = "Access token missing"),
        (status = 500, description = "Realtime sync failed")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn realtime_sync_products(
    State(state): State<Arc<AppState>>,
    Json(request): Json<RealtimeSyncRequest>,
) -> AppResult<Json<SyncResponse>> {
    let access_token = request.access_token.clone().ok_or_else(|| {
        AppError::Unauthorized(
            "Access token must be provided in the request from Strapi".to_string(),
        )
    })?;

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .realtime_sync_products(
            &request.platform,
            &request.shop_id,
            access_token,
            None,
            request.limit.map(|value| value as usize),
            request.offset.map(|value| value as usize),
            None,
        )
        .await?;

    Ok(Json(response))
}

/// Get synced products from ClickHouse
#[utoipa::path(
    get,
    path = "/api/platform/products/shops/{shop_id}/synced",
    tag = "product",
    params(
        ("shop_id" = String, Path, description = "Shop identifier"),
        ("limit" = Option<u32>, Query, description = "Items per page (default: 20)"),
        ("offset" = Option<u32>, Query, description = "Pagination offset (default: 0)"),
        ("platform" = Option<String>, Query, description = "Optional platform filter")
    ),
    responses(
        (status = 200, description = "Synced products retrieved successfully", body = SyncProductListResponse),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to retrieve synced products")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_synced_products(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Path(shop_id): Path<String>,
    Query(query): Query<ProductListQuery>,
) -> AppResult<Json<SyncProductListResponse>> {
    let tenant_id = claims.org_id.as_deref().unwrap_or("default-tenant");

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .get_synced_products(
            tenant_id,
            query.platform.as_deref(),
            &shop_id,
            query.limit.map(|value| value as usize),
            query.offset.map(|value| value as usize),
        )
        .await?;
    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/api/platform/products/sync/current",
    tag = "product",
    params(
        ("platform" = String, Query, description = "Platform identifier (tiktok, shopee, lazada, etc.)"),
        ("shop_id" = String, Query, description = "Shop identifier scoped to the platform"),
        ("limit" = Option<usize>, Query, description = "Maximum number of snapshots to return (default 50, max 500)"),
        ("cursor" = Option<String>, Query, description = "Pagination cursor from previous response")
    ),
    responses(
        (status = 200, description = "Product snapshots retrieved successfully", body = ProductSnapshotListResponse),
        (status = 400, description = "Invalid query parameters"),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to query ClickHouse")
    ),
    security(("bearer_auth" = []))
)]
pub async fn list_product_snapshots(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Query(query): Query<ProductSnapshotQuery>,
) -> AppResult<Json<ProductSnapshotListResponse>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .list_product_snapshots(
            &tenant_id,
            &query.platform,
            &query.shop_id,
            query.limit,
            query.cursor.as_deref(),
        )
        .await?;

    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/api/platform/products/sync/logs",
    tag = "product",
    params(
        ("platform" = String, Query, description = "Platform identifier"),
        ("shop_id" = String, Query, description = "Shop identifier"),
        ("limit" = Option<usize>, Query, description = "Maximum log entries to return (default 50, max 200)"),
        ("cursor" = Option<String>, Query, description = "Stream cursor for pagination")
    ),
    responses(
        (status = 200, description = "Realtime sync log entries", body = ProductSyncLogResponse),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to read sync log entries")
    ),
    security(("bearer_auth" = []))
)]
pub async fn get_sync_logs(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Query(query): Query<ProductSyncLogQuery>,
) -> AppResult<Json<ProductSyncLogResponse>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .get_sync_activity(
            &tenant_id,
            &query.platform,
            &query.shop_id,
            query.limit,
            query.cursor.as_deref(),
        )
        .await?;

    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/api/platform/products/sync/review",
    tag = "product",
    params(
        ("shop_id" = Option<String>, Query, description = "Filter by shop identifier"),
        ("platform" = Option<String>, Query, description = "Filter by platform name"),
        ("batch_id" = Option<String>, Query, description = "Filter by sync batch id"),
        ("user_action" = Option<String>, Query, description = "Filter by staging status (pending, approved, etc.)"),
        ("limit" = Option<u32>, Query, description = "Maximum rows to return (default 100, max 1000)"),
        ("offset" = Option<u32>, Query, description = "Offset for pagination")
    ),
    responses(
        (status = 200, description = "List of staged product sync records", body = ProductSyncReviewListResponse),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to load staging records")
    ),
    security(("bearer_auth" = []))
)]
pub async fn list_product_sync_review(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Query(query): Query<ProductSyncReviewQuery>,
) -> AppResult<Json<ProductSyncReviewListResponse>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service.list_product_sync_review(&tenant_id, &query).await?;

    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/api/platform/products/sync/promote",
    tag = "product",
    request_body = PromoteProductSyncRequest,
    responses(
        (status = 200, description = "Selected staging records promoted into the catalog", body = PromoteProductSyncResponse),
        (status = 400, description = "Invalid payload"),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to promote selected records")
    ),
    security(("bearer_auth" = []))
)]
pub async fn promote_product_sync_records(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(payload): Json<PromoteProductSyncRequest>,
) -> AppResult<Json<PromoteProductSyncResponse>> {
    if payload.sync_ids.is_empty() {
        return Err(AppError::BadRequest(
            "sync_ids array cannot be empty".to_string(),
        ));
    }

    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());
    let approved_by = claims
        .user_id
        .clone()
        .or_else(|| claims.email.clone())
        .unwrap_or_else(|| claims.sub.clone());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .promote_product_sync_records(&tenant_id, &payload.sync_ids, &approved_by)
        .await?;

    Ok(Json(response))
}

#[utoipa::path(
    post,
    path = "/api/platform/products/media/upload",
    tag = "product",
    request_body = ProductMediaUploadRequest,
    responses(
        (status = 200, description = "Media uploaded successfully", body = ProductMediaUploadResponse),
        (status = 400, description = "Invalid upload payload"),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to upload media")
    ),
    security(("bearer_auth" = []))
)]
pub async fn upload_product_media(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<AuthClaims>,
    Json(request): Json<ProductMediaUploadRequest>,
) -> AppResult<Json<ProductMediaUploadResponse>> {
    let tenant_id = claims
        .org_id
        .clone()
        .unwrap_or_else(|| "default-tenant".to_string());

    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service.upload_product_media(&tenant_id, &request).await?;

    Ok(Json(response))
}

#[utoipa::path(
    get,
    path = "/api/platform/products/media/download",
    tag = "product",
    params(("key" = String, Query, description = "Storage key returned from upload")),
    responses(
        (status = 200, description = "Download URL resolved", body = ProductMediaDownloadResponse),
        (status = 401, description = "Authentication required"),
        (status = 404, description = "Download location not available"),
        (status = 500, description = "Failed to resolve download link")
    ),
    security(("bearer_auth" = []))
)]
pub async fn download_product_media(
    State(state): State<Arc<AppState>>,
    Extension(_claims): Extension<AuthClaims>,
    Query(query): Query<ProductMediaDownloadQuery>,
) -> AppResult<Json<ProductMediaDownloadResponse>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service.resolve_product_media_download(&query.key).await?;

    Ok(Json(response))
}

/// Export synced products for a shop as an Excel file
#[utoipa::path(
    get,
    path = "/api/platform/products/shops/{shop_id}/export",
    tag = "product",
    params(
        ("shop_id" = String, Path, description = "Shop identifier that matches ClickHouse records"),
        ("platform" = Option<String>, Query, description = "Platform filter (required)"),
        ("limit" = Option<usize>, Query, description = "Maximum rows to export (default 500, max 5000)"),
        ("format" = Option<String>, Query, description = "Export format (excel/xlsx)")
    ),
    responses(
        (status = 200, description = "Excel file generated successfully", content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
        (status = 400, description = "Invalid parameters"),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Failed to generate export file")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn export_shop_products_excel(
    State(state): State<Arc<AppState>>,
    Path(shop_id): Path<String>,
    Query(query): Query<ProductExportQuery>,
) -> AppResult<Response> {
    let platform = query
        .platform
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| AppError::BadRequest("platform query parameter is required".to_string()))?;

    let shop_id_trimmed = shop_id.trim();
    if shop_id_trimmed.is_empty() {
        return Err(AppError::BadRequest(
            "shop_id path parameter is required".to_string(),
        ));
    }

    let requested_limit = query.limit.unwrap_or(DEFAULT_EXPORT_LIMIT);
    let export_limit = requested_limit.clamp(1, MAX_EXPORT_LIMIT);
    let format = query
        .format
        .as_deref()
        .unwrap_or("excel")
        .trim()
        .to_lowercase();

    if format != "excel" && format != "xlsx" {
        return Err(AppError::BadRequest(format!(
            "Unsupported export format: {}",
            format
        )));
    }

    let service = PlatformProductServiceImpl::new(state.clone());
    let products = service
        .export_products(platform, shop_id_trimmed, export_limit)
        .await?;

    let workbook = build_products_workbook(&products)
        .map_err(|err| AppError::InternalError(format!("Failed to build Excel workbook: {err}")))?;

    let filename = format!(
        "{}-{}-products.xlsx",
        sanitize_filename(platform),
        sanitize_filename(shop_id_trimmed)
    );

    let mut response = Response::new(Body::from(workbook));
    response.headers_mut().insert(
        header::CONTENT_TYPE,
        HeaderValue::from_static(
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    );
    response.headers_mut().insert(
        header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"{}\"", filename))
            .unwrap_or_else(|_| HeaderValue::from_static("attachment; filename=\"products.xlsx\"")),
    );

    Ok(response)
}

// Additional types and functions for extended sync functionality

/// Trigger product sync using extended system with ProductRow schema
///
/// Advanced synchronization endpoint using the extended product schema
/// with comprehensive data mapping and validation.
///
/// # Extended Features
/// - Full ProductRow schema support
/// - Advanced data validation
/// - Conflict resolution strategies
/// - Batch processing optimization
/// - Detailed sync reporting
///
/// # Sync Strategies
/// - **merge**: Merge new data with existing
/// - **replace**: Replace all existing data
/// - **update**: Update only changed fields
#[utoipa::path(
    post,
    path = "/api/platform/products/sync/extended",
    tag = "product",
    request_body(
        content = SyncProductsRequest,
        description = "Extended sync configuration",
        example = json!({
            "shop_id": "shop_456",
            "platform": "tiktok",
            "sync_strategy": "merge",
            "validate_before_save": true,
            "batch_size": 500
        })
    ),
    responses(
        (status = 200, description = "Extended sync completed", body = SyncProductsResponse,
            example = json!({
                "job_id": "ext_sync_123",
                "status": "completed",
                "products_synced": 500,
                "products_failed": 0,
                "validation_errors": [],
                "sync_duration_ms": 15000
            })
        ),
        (status = 400, description = "Invalid sync configuration"),
        (status = 401, description = "Authentication required"),
        (status = 500, description = "Extended sync failed")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn sync_products_extended(
    State(state): State<Arc<AppState>>,
    Json(request): Json<SyncProductsRequest>,
) -> AppResult<Json<SyncProductsResponse>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .sync_products_extended(
            &request.shop_slug,
            0,
            &request.platform,
            &request.org_id,
            None,
            request.full_sync,
            None,
            None,
            None,
        )
        .await?;

    Ok(Json(response))
}

/// Get product sync status
#[utoipa::path(
    get,
    path = "/api/platform/products/sync/jobs/{job_id}/summary",
    tag = "product",
    params(
        ("job_id" = String, Path, description = "Sync job identifier")
    ),
    responses(
        (status = 200, description = "Sync job summary retrieved", body = ProductSyncStatusResponse),
        (status = 404, description = "Job not found"),
        (status = 500, description = "Failed to retrieve job summary")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_sync_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<ProductSyncStatusResponse>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service.get_sync_status(&job_id).await?;
    Ok(Json(response))
}

/// Query parameters for listing sync jobs
/// Get sync job status and latest progress
#[utoipa::path(
    get,
    path = "/api/platform/products/sync/jobs/{job_id}",
    tag = "product",
    params(
        ("job_id" = String, Path, description = "Sync job identifier")
    ),
    responses(
        (status = 200, description = "Sync job status retrieved", body = serde_json::Value),
        (status = 404, description = "Job not found"),
        (status = 500, description = "Failed to retrieve job status")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn get_sync_job_status(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service.get_sync_job_status(&job_id).await?;
    Ok(Json(response))
}

/// List sync jobs for an organization
#[utoipa::path(
    get,
    path = "/api/platform/products/sync/jobs",
    tag = "product",
    params(
        ("limit" = Option<u32>, Query, description = "Items per page (default: 20, max: 100)"),
        ("offset" = Option<u32>, Query, description = "Pagination offset (default: 0)")
    ),
    responses(
        (status = 200, description = "Sync jobs listed", body = serde_json::Value),
        (status = 401, description = "Authentication required")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn list_sync_jobs(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListSyncJobsQuery>,
) -> AppResult<Json<serde_json::Value>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service
        .list_sync_jobs(
            Some("default".to_string()),
            params.limit.map(|value| value as u32),
            params.offset.map(|value| value as u32),
        )
        .await?;
    Ok(Json(response))
}

/// Cancel a sync job
#[utoipa::path(
    delete,
    path = "/api/platform/products/sync/jobs/{job_id}",
    tag = "product",
    params(
        ("job_id" = String, Path, description = "Sync job identifier")
    ),
    responses(
        (status = 200, description = "Sync job cancelled", body = serde_json::Value),
        (status = 404, description = "Job not found"),
        (status = 500, description = "Failed to cancel job")
    ),
    security(
        ("bearer_auth" = [])
    )
)]
pub async fn cancel_sync_job(
    State(state): State<Arc<AppState>>,
    Path(job_id): Path<String>,
) -> AppResult<Json<serde_json::Value>> {
    let service = PlatformProductServiceImpl::new(state.clone());
    let response = service.cancel_sync_job(&job_id).await?;
    Ok(Json(response))
}

fn build_products_workbook(products: &[Product]) -> Result<Vec<u8>, XlsxError> {
    let mut workbook = Workbook::new();
    let worksheet = workbook.add_worksheet();
    let header_format = Format::new().set_bold();
    let headers = [
        "Platform",
        "Shop ID",
        "Product ID",
        "Platform Product ID",
        "SKU",
        "Title",
        "Description",
        "Price",
        "Currency",
        "Quantity",
        "Status",
        "Categories",
        "Primary Image",
        "Created At",
        "Updated At",
    ];

    for (col, header) in headers.iter().enumerate() {
        worksheet.write_string_with_format(0, col as u16, *header, &header_format)?;
    }

    for (index, product) in products.iter().enumerate() {
        let row = (index + 1) as u32;

        worksheet.write_string(row, 0, &product.platform.to_string())?;
        worksheet.write_string(row, 1, product.shop_id.as_str())?;
        worksheet.write_string(row, 2, product.product_id.as_str())?;
        worksheet.write_string(row, 3, product.platform_product_id.as_str())?;
        worksheet.write_string(row, 4, product.sku.as_str())?;
        worksheet.write_string(row, 5, product.title.as_str())?;
        worksheet.write_string(row, 6, product.description.as_deref().unwrap_or(""))?;

        let price_value = product.price.amount.to_f64().unwrap_or(0.0);
        worksheet.write_number(row, 7, price_value)?;
        worksheet.write_string(row, 8, product.currency.as_str())?;
        worksheet.write_number(row, 9, f64::from(product.quantity))?;
        worksheet.write_string(row, 10, &product.status.to_string())?;

        let categories = if product.categories.is_empty() {
            String::new()
        } else {
            product.categories.join(", ")
        };
        worksheet.write_string(row, 11, categories.as_str())?;

        if let Some(image_url) = primary_image_url(product) {
            worksheet.write_string(row, 12, image_url)?;
        }

        let created_at = product.created_at.to_rfc3339();
        let updated_at = product.updated_at.to_rfc3339();
        worksheet.write_string(row, 13, created_at.as_str())?;
        worksheet.write_string(row, 14, updated_at.as_str())?;
    }

    let mut cursor = Cursor::new(Vec::new());
    workbook.save_to_writer(&mut cursor)?;
    Ok(cursor.into_inner())
}

fn primary_image_url(product: &Product) -> Option<&str> {
    product
        .images
        .iter()
        .find(|image| image.is_primary)
        .or_else(|| product.images.first())
        .map(|image| image.url.as_str())
}

fn sanitize_filename(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            'A'..='Z' | 'a'..='z' | '0'..='9' | '-' | '_' => ch,
            _ => '-',
        })
        .collect()
}

fn extract_platform_from_body(body: Option<&SyncRequestBody>) -> AppResult<String> {
    body.map(|payload| payload.platform.trim().to_lowercase())
        .filter(|value| !value.is_empty())
        .ok_or_else(|| {
            AppError::BadRequest("platform must be provided in the request body".to_string())
        })
}

async fn execute_platform_sync(
    state: &Arc<AppState>,
    platform: &str,
    shop_id: &str,
    query: &SyncQuery,
    body: Option<&SyncRequestBody>,
) -> AppResult<SyncResponse> {
    let service = PlatformProductServiceImpl::new(state.clone());
    service
        .sync_platform_products(platform, shop_id, query, body)
        .await
}

// ============================================================================
// Routes
// ============================================================================

/// Legacy helper to build product routes.
/// Prefer using `ProductHandler::build()` directly to avoid route drift.
pub fn product_routes(state: Arc<AppState>) -> Router<Arc<AppState>> {
    super::handler::ProductHandler::new(state).build()
}
