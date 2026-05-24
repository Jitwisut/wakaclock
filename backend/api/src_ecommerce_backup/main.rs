/// ไฟล์หลักสำหรับเริ่มต้นแอพพลิเคชัน E-commerce Connect
/// รองรับการทำงาน 3 โหมด: Web Service, Gateway-only, และ Consumer runtime
use aide::scalar::Scalar;
use anyhow::Result;
use axum::{
    http::{header, StatusCode},
    response::{Html, IntoResponse},
};
use clap::{Parser, Subcommand};
use serde_json::json;
use std::sync::Arc;
use tokio::task::JoinHandle;
use tracing::{error, info, warn};

use ecommerce_connect::{
    create_app_state,
    docs::v1::{gateway::gateway_api_docs, platform::platform_api_docs},
    handlers,
    handlers::v1::gateway::ecommerce::platform::callback::{
        bigcommerce_auth_get, bigcommerce_auth_post,
    },
    repository::{qdrant::QdrantRepository, VectorRepository},
    services::vector::{VectorService, VectorServiceImpl},
    worker::{
        batch_processor::BatchProcessorWorker, product_consumer::ProductConsumerWorker,
        product_detail_consumer::ProductDetailConsumer, product_ingest_worker::ProductIngestWorker,
        product_list_consumer::ProductListConsumer, vector_sync_worker::VectorSyncWorker, Worker,
    },
    AppState,
};

use qdrant_client::Qdrant;

/// โครงสร้างสำหรับรับ arguments จาก command line
/// ใช้ clap สำหรับ parsing arguments อัตโนมัติ
#[derive(Parser, Debug)]
#[command(author, version, about, long_about = None)]
struct Args {
    /// Path to configuration file
    /// ที่อยู่ไฟล์ configuration (default: config.yaml)
    #[arg(short, long, default_value = "config.yaml", global = true)]
    config: String,

    /// Enable debug logging
    /// เปิดใช้งาน debug logging สำหรับการ debug
    #[arg(short, long, global = true)]
    debug: bool,

    /// Optional explicit command (web-service, gateway, consumer)
    #[command(subcommand)]
    command: Option<CliCommand>,
}

#[derive(Subcommand, Debug)]
enum CliCommand {
    /// Run full platform + gateway webservice
    #[command(name = "web-service")]
    WebService {
        /// Port to listen on
        #[arg(long, default_value_t = 8080)]
        port: u16,
    },
    /// Run lightweight gateway-only service
    Gateway {
        /// Port to listen on
        #[arg(long, default_value_t = 8081)]
        port: u16,
    },
    /// Run RabbitMQ consumer runtime
    Consumer {
        /// Comma-separated consumer task list
        #[arg(long, default_value = "product-sync-to-ch-list")]
        tasks: String,
        /// Optional queue prefix override
        #[arg(long)]
        queue_prefix: Option<String>,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum RunMode {
    Webservice,
    Gateway,
    Consumer,
}

impl RunMode {
    fn from_str(value: &str) -> Option<Self> {
        match value.to_lowercase().as_str() {
            "webservice" | "web-service" | "web" => Some(Self::Webservice),
            "gateway" => Some(Self::Gateway),
            "consumer" => Some(Self::Consumer),
            _ => None,
        }
    }
}

enum EffectiveMode {
    Webservice { port: u16 },
    Gateway { port: u16 },
    Consumer { runtime: ConsumerRuntimeConfig },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
enum ConsumerTaskKind {
    ProductSyncToChList,
    ProductDetail,
    ProductEmbedding,
    ProductSyncToVector,
    Webhook,
    BatchProcessor,
}

impl ConsumerTaskKind {
    fn from_str(value: &str) -> Option<Self> {
        match value.trim().to_lowercase().as_str() {
            "product-sync-to-ch-list" => Some(Self::ProductSyncToChList),
            "product-detail" => Some(Self::ProductDetail),
            "product-embedding" => Some(Self::ProductEmbedding),
            "product-sync-to-vector" => Some(Self::ProductSyncToVector),
            "webhook" | "webhook-consumer" => Some(Self::Webhook),
            "batch-processor" => Some(Self::BatchProcessor),
            _ => None,
        }
    }

    fn env_prefix(&self) -> &'static str {
        match self {
            Self::ProductSyncToChList => "CONSUMER_PRODUCT_SYNC_TO_CH_LIST",
            Self::ProductDetail => "CONSUMER_PRODUCT_DETAIL",
            Self::ProductEmbedding => "CONSUMER_PRODUCT_EMBEDDING",
            Self::ProductSyncToVector => "CONSUMER_PRODUCT_SYNC_TO_VECTOR",
            Self::Webhook => "CONSUMER_WEBHOOK",
            Self::BatchProcessor => "CONSUMER_BATCH_PROCESSOR",
        }
    }

    fn default_queue_suffix(&self) -> &'static str {
        match self {
            Self::ProductSyncToChList => "product-sync-list",
            Self::ProductDetail => "product-detail",
            Self::ProductEmbedding => "product-embedding",
            Self::ProductSyncToVector => "product-vector-sync",
            Self::Webhook => "webhook",
            Self::BatchProcessor => "batch-processor",
        }
    }
    fn default_routing_key(&self) -> &'static str {
        match self {
            Self::ProductSyncToChList => "product.sync.list",
            Self::ProductDetail => "product.detail",
            Self::ProductEmbedding => "product.embedding",
            Self::ProductSyncToVector => "product.vector.sync",
            Self::Webhook => "product.batch.upsert",
            Self::BatchProcessor => "ecommerce.product.sync.batch",
        }
    }

    fn display_name(&self) -> &'static str {
        match self {
            Self::ProductSyncToChList => "product-sync-to-ch-list",
            Self::ProductDetail => "product-detail",
            Self::ProductEmbedding => "product-embedding",
            Self::ProductSyncToVector => "product-sync-to-vector",
            Self::Webhook => "webhook",
            Self::BatchProcessor => "batch-processor",
        }
    }

    fn needs_vector_stack(&self) -> bool {
        matches!(self, Self::ProductEmbedding | Self::ProductSyncToVector)
    }
}

#[derive(Clone, Debug)]
struct ConsumerTaskConfig {
    kind: ConsumerTaskKind,
    exchange: Option<String>,
    routing_key: Option<String>,
    queue_name: Option<String>,
}

#[derive(Clone, Debug)]
struct ConsumerBinding {
    kind: ConsumerTaskKind,
    exchange: String,
    routing_key: String,
    queue_name: String,
}

#[derive(Clone, Debug)]
struct ConsumerRuntimeConfig {
    tasks: Vec<ConsumerTaskConfig>,
    queue_prefix_override: Option<String>,
}

impl ConsumerRuntimeConfig {
    fn parse(raw: &str, queue_prefix_override: Option<String>) -> Result<Self> {
        let mut tasks = Vec::new();
        for token in raw.split(',') {
            let trimmed = token.trim();
            if trimmed.is_empty() {
                continue;
            }
            let kind = ConsumerTaskKind::from_str(trimmed).ok_or_else(|| {
                anyhow::anyhow!(format!(
                    "Unknown consumer task '{}'. Supported: product-sync-to-ch-list, product-detail, product-embedding, product-sync-to-vector",
                    trimmed
                ))
            })?;
            let exchange = std::env::var(format!("{}_STREAM", kind.env_prefix()))
                .ok()
                .filter(|value| !value.trim().is_empty());
            let routing_key = std::env::var(format!("{}_ROUTING_KEY", kind.env_prefix()))
                .ok()
                .filter(|value| !value.trim().is_empty());
            let queue_name = std::env::var(format!("{}_QUEUE", kind.env_prefix()))
                .ok()
                .filter(|value| !value.trim().is_empty());

            tasks.push(ConsumerTaskConfig {
                kind,
                exchange,
                routing_key,
                queue_name,
            });
        }

        Ok(Self {
            tasks,
            queue_prefix_override,
        })
    }

    fn resolve_bindings(
        &self,
        default_exchange: &str,
        default_queue_prefix: &str,
    ) -> Vec<ConsumerBinding> {
        self.tasks
            .iter()
            .map(|task| {
                let queue_prefix = self
                    .queue_prefix_override
                    .as_deref()
                    .unwrap_or(default_queue_prefix);
                let queue_name = task.queue_name.clone().unwrap_or_else(|| {
                    format!("{}_{}", queue_prefix, task.kind.default_queue_suffix())
                });
                ConsumerBinding {
                    kind: task.kind,
                    exchange: task
                        .exchange
                        .clone()
                        .unwrap_or_else(|| default_exchange.to_string()),
                    routing_key: task
                        .routing_key
                        .clone()
                        .unwrap_or_else(|| task.kind.default_routing_key().to_string()),
                    queue_name,
                }
            })
            .collect()
    }
}

fn resolve_effective_mode(args: &Args) -> Result<EffectiveMode> {
    if let Some(command) = &args.command {
        return match command {
            CliCommand::WebService { port } => Ok(EffectiveMode::Webservice { port: *port }),
            CliCommand::Gateway { port } => Ok(EffectiveMode::Gateway { port: *port }),
            CliCommand::Consumer {
                tasks,
                queue_prefix,
            } => {
                let runtime = ConsumerRuntimeConfig::parse(tasks, queue_prefix.clone())?;
                Ok(EffectiveMode::Consumer { runtime })
            }
        };
    }

    let run_mode = std::env::var("RUN_MODE")
        .ok()
        .and_then(|value| RunMode::from_str(&value))
        .unwrap_or(RunMode::Webservice);

    match run_mode {
        RunMode::Webservice => {
            let port = std::env::var("WEB_PORT")
                .ok()
                .and_then(|value| value.parse::<u16>().ok())
                .unwrap_or(8080);
            Ok(EffectiveMode::Webservice { port })
        }
        RunMode::Gateway => {
            let port = std::env::var("GATEWAY_PORT")
                .ok()
                .and_then(|value| value.parse::<u16>().ok())
                .unwrap_or(8081);
            Ok(EffectiveMode::Gateway { port })
        }
        RunMode::Consumer => {
            let tasks = std::env::var("CONSUMER_TASKS")
                .unwrap_or_else(|_| "product-sync-to-ch-list".to_string());
            let queue_prefix = std::env::var("CONSUMER_QUEUE_PREFIX").ok();
            let runtime = ConsumerRuntimeConfig::parse(&tasks, queue_prefix)?;
            Ok(EffectiveMode::Consumer { runtime })
        }
    }
}

/// ฟังก์ชันหลักของแอพพลิเคชัน
/// ใช้ tokio runtime สำหรับ async operations
#[tokio::main]
async fn main() -> Result<()> {
    // Try to load .env from current directory or parent directories
    // โหลด environment variables จากไฟล์ .env (ถ้ามี)
    dotenvy::dotenv().ok();

    // รับ command line arguments และ parse เป็น struct Args
    let args = Args::parse();

    // Initialize logger
    // ตั้งค่า logging level ตามที่ระบุใน arguments
    if args.debug {
        // Debug mode: แสดง log ทุกระดับรวมถึง DEBUG
        tracing_subscriber::fmt()
            .with_max_level(tracing::Level::DEBUG)
            .init();
    } else {
        // Normal mode: แสดงเฉพาะ INFO ขึ้นไป
        tracing_subscriber::fmt()
            .with_max_level(tracing::Level::INFO)
            .init();
    }

    let mode = resolve_effective_mode(&args)?;
    match mode {
        EffectiveMode::Webservice { port } => run_webservice(port).await,
        EffectiveMode::Gateway { port } => run_gateway_service(port).await,
        EffectiveMode::Consumer { runtime } => run_consumer_runtime(runtime).await,
    }
}

/// ฟังก์ชันสำหรับรัน Web Service mode
/// เป็น HTTP API server ที่รับ request จาก client
/// รองรับ REST API endpoints และ OpenAPI documentation
async fn run_webservice(port: u16) -> Result<()> {
    use axum::http::{header, Method};
    use axum::Router;
    use ecommerce_connect::{helpers::app_config, infrastructure, AppState};
    use std::net::SocketAddr;
    use tower_cookies::CookieManagerLayer;
    use tower_http::{
        compression::CompressionLayer,
        cors::CorsLayer,
        timeout::TimeoutLayer,
        trace::{self, TraceLayer},
    };
    use tracing::Level;

    // เริ่มต้นระบบ logging และ tracing สำหรับ monitoring
    infrastructure::logger::init_tracing()?;
    let logger = infrastructure::logger::global();

    // Load app_name from credentials file
    // โหลดชื่อแอพพลิเคชันจากไฟล์ credentials สำหรับใช้ใน routing
    let app_name = app_config::load_app_name("credentials/crendential.json").unwrap_or_else(|e| {
        logger.warn(
            &format!(
                "Failed to load app_name from credentials: {}. Using default '{}'",
                e,
                app_config::DEFAULT_APP_NAME
            ),
            None,
        );
        app_config::DEFAULT_APP_NAME.to_string()
    });

    // สร้าง logging context พร้อมข้อมูลสำคัญสำหรับ tracking
    let context = infrastructure::logger::Logger::context()
        .app_name(app_name.clone())
        .custom("mode", serde_json::json!("webservice"))
        .custom("port", serde_json::json!(port))
        .build();

    logger.info("Initializing webservice...", Some(&context));
    logger.info(&format!("Loaded app_name: {}", app_name), Some(&context));

    // สร้าง application state ที่เก็บ dependencies ทั้งหมด (database, cache, config, etc.)
    let state: Arc<AppState> = Arc::new(create_app_state().await?);

    // Configure CORS
    // ตั้งค่า CORS policy สำหรับการเข้าถึงจาก frontend
    let cors = if state.config.server.cors_origins.contains(&"*".to_string()) {
        CorsLayer::new()
            .allow_origin(tower_http::cors::Any)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                header::ACCEPT,
                header::HeaderName::from_static("x-auth-token"),
            ])
            .expose_headers(cors_expose_headers())
    } else {
        let origins: Vec<_> = state
            .config
            .server
            .cors_origins
            .iter()
            .map(|origin| origin.parse().unwrap())
            .collect();
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                header::ACCEPT,
                header::HeaderName::from_static("x-auth-token"),
            ])
            .expose_headers(cors_expose_headers())
            .allow_credentials(true)
    };

    // Build the router with v1 routes using the new handler pattern
    // สร้าง handler สำหรับ API version 1 พร้อม dependency injection
    let v1_handler = handlers::v1::V1Handler::new(state.clone());

    // สร้าง OpenAPI documentation สำหรับ gateway และ platform APIs
    let gateway_openapi = gateway_api_docs::build_gateway_openapi(&app_name);
    let platform_openapi = platform_api_docs::build_platform_openapi(&app_name);
    let gateway_openapi_json = gateway_openapi.clone().to_json().unwrap();
    let platform_openapi_json = platform_openapi.clone().to_json().unwrap();

    // เตรียมชื่อ app สำหรับ routing (รองรับทั้ง lowercase และ original case)
    let app_name_lower = app_name.to_lowercase();
    let app_name_original = app_name.clone();
    let mut combined_openapi = gateway_openapi.clone();
    combined_openapi.merge(platform_openapi.clone());
    let docs_openapi_json = combined_openapi.to_json().unwrap();
    let docs_scalar_html = scalar_page_html(
        "E-Commerce Connect API",
        format!("/api/v1/{}/docs/openapi.json", app_name_original),
    );
    let gateway_scalar_html = scalar_page_html(
        "E-Commerce Gateway API",
        format!("/api/v1/{}/gateway/docs/openapi.json", app_name_original),
    );
    let platform_scalar_html = scalar_page_html(
        "E-Commerce Platform API",
        format!("/api/v1/{}/platform/docs/openapi.json", app_name_original),
    );

    let docs_openapi_json: &'static str = Box::leak(docs_openapi_json.into_boxed_str());
    let gateway_openapi_json: &'static str = Box::leak(gateway_openapi_json.into_boxed_str());
    let platform_openapi_json: &'static str = Box::leak(platform_openapi_json.into_boxed_str());
    let app_name_lower_ref = app_name_lower.clone();
    let platform_openapi_not_found = format!(
        "Platform OpenAPI spec not found for '{}'",
        app_name_original
    );

    // สร้าง router หลักพร้อม register routes ตามชื่อ app
    let mut router: Router<Arc<AppState>> = Router::new();

    let mut doc_app_names = vec![app_name_original.clone()];
    if app_name_lower != app_name_original {
        doc_app_names.push(app_name_lower.clone());
    }

    for app_name in doc_app_names.iter() {
        let docs_path = format!("/api/v1/{}/docs", app_name);
        let docs_spec_path = format!("/api/v1/{}/docs/openapi.json", app_name);
        let gateway_docs_path = format!("/api/v1/{}/gateway/docs", app_name);
        let gateway_spec_path = format!("/api/v1/{}/gateway/docs/openapi.json", app_name);
        let platform_docs_path = format!("/api/v1/{}/platform/docs", app_name);
        let platform_spec_path = format!("/api/v1/{}/platform/docs/openapi.json", app_name);

        router = router
            .route(
                &docs_path,
                axum::routing::get({
                    move || async move { Html(docs_scalar_html).into_response() }
                }),
            )
            .route(
                &docs_spec_path,
                axum::routing::get({
                    move || async move {
                        (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "application/json")],
                            docs_openapi_json,
                        )
                            .into_response()
                    }
                }),
            )
            .route(
                &gateway_docs_path,
                axum::routing::get({
                    move || async move { Html(gateway_scalar_html).into_response() }
                }),
            )
            .route(
                &gateway_spec_path,
                axum::routing::get({
                    move || async move {
                        (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "application/json")],
                            gateway_openapi_json,
                        )
                            .into_response()
                    }
                }),
            )
            .route(
                &platform_docs_path,
                axum::routing::get({
                    move || async move { Html(platform_scalar_html).into_response() }
                }),
            )
            .route(
                &platform_spec_path,
                axum::routing::get({
                    move || async move {
                        (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "application/json")],
                            platform_openapi_json,
                        )
                            .into_response()
                    }
                }),
            );
    }
    // Proxy สำหรับ ecommerce gateway service
    router = router.nest(
        "/api/gateway",
        ecommerce_connect::services::gateway_proxy::router(state.clone()),
    );

    // Register with lowercase version
    // ลงทะเบียน routes ด้วยชื่อ lowercase
    router = router.nest(
        &format!("/api/v1/{}", app_name_lower),
        v1_handler.register_routes(),
    );

    // Only register with original case if different from lowercase
    // ลงทะเบียน routes ด้วยชื่อต้นฉบับ (ถ้าไม่ซ้ำกับ lowercase)
    if app_name_lower != app_name_original {
        router = router.nest(
            &format!("/api/v1/{}", app_name_original),
            v1_handler.register_routes(),
        );
    }

    let router = router
        .route(
            "/auth",
            axum::routing::get(bigcommerce_auth_get).post(bigcommerce_auth_post),
        )
        .route(
            "/api/v1/:app_name/platform/docs/openapi.json",
            axum::routing::get({
                let expected_lower = app_name_lower_ref.clone();
                let not_found_message = platform_openapi_not_found.clone();
                let spec_json = platform_openapi_json;
                move |path: axum::extract::Path<String>| {
                    let requested_name = path.0;
                    let expected_lower = expected_lower.clone();
                    let not_found_message = not_found_message.clone();
                    async move {
                        if requested_name.to_lowercase() != expected_lower {
                            return (StatusCode::NOT_FOUND, not_found_message).into_response();
                        }
                        (
                            StatusCode::OK,
                            [(header::CONTENT_TYPE, "application/json")],
                            spec_json,
                        )
                            .into_response()
                    }
                }
            }),
        )
        // Strapi proxy routes - proxy authentication and management endpoints to Strapi
        .route(
            "/api/auth/local",
            axum::routing::post(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/auth/local/register",
            axum::routing::post(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/auth/local/callback",
            axum::routing::post(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/auth/*path",
            axum::routing::any(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/v1/users/*path",
            axum::routing::any(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/v1/organization",
            axum::routing::get(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi)
                .post(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/v1/organization/*path",
            axum::routing::any(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/shops",
            axum::routing::get(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi)
                .post(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        )
        .route(
            "/api/shops/*path",
            axum::routing::any(ecommerce_connect::client::strapi::strapi_proxy::proxy_to_strapi),
        );

    // Add global middleware
    // เพิ่ม middleware ทั่วไปสำหรับทุก requests
    let app = router
        .layer(axum::middleware::from_fn(
            ecommerce_connect::middleware::request_logger::request_logger_middleware,
        )) // Custom request logger for detailed logging
        .layer(CookieManagerLayer::new()) // จัดการ cookies
        .layer(cors) // จัดการ CORS policy
        .layer(CompressionLayer::new()) // บีบอัด response สำหรับประหยัด bandwidth
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::default().level(Level::INFO))
                .on_request(trace::DefaultOnRequest::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        ) // tracing สำหรับ monitoring with request/response logging
        .layer(TimeoutLayer::new(std::time::Duration::from_secs(60))) // timeout 60 วินาที
        .with_state(state.clone()); // แนบ application state

    // สร้าง socket address สำหรับ binding
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    logger.info(&format!("Starting server on {}", addr), Some(&context));

    // เริ่ม TCP listener และรัน server
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

fn scalar_page_html(title: &str, spec_url: String) -> &'static str {
    let html = Scalar::new(spec_url).with_title(title).html();
    Box::leak(html.into_boxed_str())
}

/// Gateway-only HTTP service with reduced surface area.
async fn run_gateway_service(port: u16) -> Result<()> {
    use axum::http::{header, Method};
    use axum::{routing::get, Router};
    use ecommerce_connect::{helpers::app_config, infrastructure, AppState};
    use std::net::SocketAddr;
    use tower_cookies::CookieManagerLayer;
    use tower_http::{
        compression::CompressionLayer,
        cors::CorsLayer,
        timeout::TimeoutLayer,
        trace::{self, TraceLayer},
    };
    use tracing::Level;

    infrastructure::logger::init_tracing()?;
    let logger = infrastructure::logger::global();

    let state: Arc<AppState> = Arc::new(create_app_state().await?);

    let cors = if state.config.server.cors_origins.contains(&"*".to_string()) {
        CorsLayer::new()
            .allow_origin(tower_http::cors::Any)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                header::ACCEPT,
                header::HeaderName::from_static("x-auth-token"),
            ])
            .expose_headers(cors_expose_headers())
    } else {
        let origins: Vec<_> = state
            .config
            .server
            .cors_origins
            .iter()
            .map(|origin| origin.parse().unwrap())
            .collect();
        CorsLayer::new()
            .allow_origin(origins)
            .allow_methods([
                Method::GET,
                Method::POST,
                Method::PUT,
                Method::PATCH,
                Method::DELETE,
                Method::OPTIONS,
            ])
            .allow_headers([
                header::AUTHORIZATION,
                header::CONTENT_TYPE,
                header::ACCEPT,
                header::HeaderName::from_static("x-auth-token"),
            ])
            .expose_headers(cors_expose_headers())
            .allow_credentials(true)
    };

    let handler = handlers::v1::gateway::handler::GatewayHandler::new(state.clone());
    let app_name = app_config::load_app_name("credentials/crendential.json")
        .unwrap_or_else(|_| app_config::DEFAULT_APP_NAME.to_string());

    let router = Router::new()
        .nest(&format!("/api/v1/{}/gateway", app_name), handler.build())
        .route(
            "/healthz",
            get(|| async move { axum::Json(json!({ "status": "ok" })) }),
        )
        .layer(axum::middleware::from_fn(
            ecommerce_connect::middleware::request_logger::request_logger_middleware,
        ))
        .layer(CookieManagerLayer::new())
        .layer(cors)
        .layer(CompressionLayer::new())
        .layer(
            TraceLayer::new_for_http()
                .make_span_with(trace::DefaultMakeSpan::default().level(Level::INFO))
                .on_request(trace::DefaultOnRequest::new().level(Level::INFO))
                .on_response(trace::DefaultOnResponse::new().level(Level::INFO)),
        )
        .layer(TimeoutLayer::new(std::time::Duration::from_secs(60)))
        .with_state(state.clone());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    logger.info(
        &format!("Starting gateway service on {}", addr),
        Some(
            &infrastructure::logger::Logger::context()
                .app_name(app_name)
                .custom("mode", serde_json::json!("gateway"))
                .custom("port", serde_json::json!(port))
                .build(),
        ),
    );

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, router).await?;
    Ok(())
}

async fn run_consumer_runtime(config: ConsumerRuntimeConfig) -> Result<()> {
    info!("Starting consumer runtime...");
    let state: Arc<AppState> = Arc::new(create_app_state().await?);

    let default_exchange = state.config.rabbitmq.exchange.clone();
    let default_queue_prefix = config
        .queue_prefix_override
        .clone()
        .unwrap_or_else(|| state.config.rabbitmq.queue_prefix.clone());

    let bindings = config.resolve_bindings(&default_exchange, &default_queue_prefix);
    if bindings.is_empty() {
        warn!("No consumer tasks configured. Set CONSUMER_TASKS to enable workers.");
        return Ok(());
    }

    let mut handles: Vec<JoinHandle<()>> = Vec::new();
    let mut qdrant_stack: Option<QdrantStack> = None;

    for binding in bindings {
        let consumer_name = apply_binding_env(&binding);
        info!(
            task = binding.kind.display_name(),
            exchange = binding.exchange,
            routing = binding.routing_key,
            queue = binding.queue_name,
            "Launching consumer task"
        );

        if binding.kind.needs_vector_stack() && qdrant_stack.is_none() {
            qdrant_stack = Some(build_qdrant_stack(&state)?);
        }

        match binding.kind {
            ConsumerTaskKind::ProductSyncToChList => {
                let worker = ProductListConsumer::new(state.clone());
                handles.push(spawn_worker_task("product-sync-to-ch-list", worker));
            }
            ConsumerTaskKind::ProductDetail => {
                let worker = ProductDetailConsumer::new(state.clone());
                handles.push(spawn_worker_task("product-detail", worker));
            }
            ConsumerTaskKind::ProductEmbedding => {
                let stack = qdrant_stack
                    .as_ref()
                    .expect("Qdrant stack should be initialized");
                handles.push(spawn_product_embedding_worker(state.clone(), stack)?);
            }
            ConsumerTaskKind::ProductSyncToVector => {
                let stack = qdrant_stack
                    .as_ref()
                    .expect("Qdrant stack should be initialized");
                handles.push(spawn_vector_sync_worker(state.clone(), stack)?);
            }
            ConsumerTaskKind::Webhook => {
                handles.push(spawn_webhook_worker(state.clone(), consumer_name.clone())?);
            }
            ConsumerTaskKind::BatchProcessor => {
                let worker = BatchProcessorWorker::new(state.clone());
                handles.push(spawn_worker_task("batch-processor", worker));
            }
        }
    }

    tokio::signal::ctrl_c().await?;
    info!("Shutdown signal received. Stopping consumer workers...");
    for handle in handles {
        handle.abort();
    }

    Ok(())
}

fn spawn_worker_task<W>(name: &'static str, worker: W) -> JoinHandle<()>
where
    W: Worker + 'static,
{
    tokio::spawn(async move {
        info!(worker = name, "Worker started");
        if let Err(err) = worker.start().await {
            error!(worker = name, error = %err, "Worker exited with error");
        }
    })
}

fn spawn_product_embedding_worker(
    state: Arc<AppState>,
    stack: &QdrantStack,
) -> Result<JoinHandle<()>> {
    let queue = state.queue.clone();
    let clickhouse = state.product_repository();
    let vector_repo = stack.vector_repo.clone();
    let config = state.config.clone();

    let worker = ProductConsumerWorker::new(queue, clickhouse, vector_repo, config);
    Ok(spawn_worker_task("product-embedding", worker))
}

fn spawn_webhook_worker(state: Arc<AppState>, consumer_name: String) -> Result<JoinHandle<()>> {
    let worker = ProductIngestWorker::new(state, consumer_name);
    Ok(spawn_worker_task("webhook", worker))
}

fn spawn_vector_sync_worker(state: Arc<AppState>, stack: &QdrantStack) -> Result<JoinHandle<()>> {
    let worker = VectorSyncWorker::new(
        state.queue.clone(),
        state.product_repository(),
        stack.client.clone(),
        stack.vector_service.clone(),
    );
    Ok(tokio::spawn(async move {
        info!(worker = "product-sync-to-vector", "Worker started");
        if let Err(err) = worker.start().await {
            error!(worker = "product-sync-to-vector", error = %err, "Worker exited with error");
        }
    }))
}

fn apply_binding_env(binding: &ConsumerBinding) -> String {
    let consumer_name = format!("{}_consumer", binding.queue_name.replace(['-', '.'], "_"));
    std::env::set_var(
        format!("{}_STREAM", binding.kind.env_prefix()),
        &binding.exchange,
    );
    std::env::set_var(
        format!("{}_CONSUMER", binding.kind.env_prefix()),
        consumer_name.as_str(),
    );
    std::env::set_var(
        format!("{}_ROUTING_KEY", binding.kind.env_prefix()),
        &binding.routing_key,
    );
    std::env::set_var(
        format!("{}_QUEUE", binding.kind.env_prefix()),
        &binding.queue_name,
    );
    consumer_name
}

struct QdrantStack {
    client: Arc<Qdrant>,
    vector_repo: Arc<dyn VectorRepository>,
    vector_service: Arc<dyn VectorService>,
}

fn build_qdrant_stack(state: &Arc<AppState>) -> Result<QdrantStack> {
    let mut builder = Qdrant::from_url(&state.config.qdrant.url);
    if let Some(api_key) = &state.config.qdrant.api_key {
        builder = builder.api_key(api_key.clone());
    }

    let client = Arc::new(
        builder
            .build()
            .map_err(|err| anyhow::anyhow!("Failed to initialize Qdrant client: {}", err))?,
    );
    let vector_repo: Arc<dyn VectorRepository> = Arc::new(QdrantRepository::new(
        client.clone(),
        state.config.qdrant.collection_prefix.clone(),
    ));
    let vector_service: Arc<dyn VectorService> =
        Arc::new(VectorServiceImpl::new(state.clone(), vector_repo.clone()));

    Ok(QdrantStack {
        client,
        vector_repo,
        vector_service,
    })
}

fn cors_expose_headers() -> [header::HeaderName; 4] {
    [
        header::HeaderName::from_static("x-request-id"),
        header::HeaderName::from_static("x-total-count"),
        header::HeaderName::from_static("x-org-id"),
        header::HeaderName::from_static("x-user-id"),
    ]
}
