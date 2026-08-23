use anyhow::{Context, Result};
use axum::http::{header, HeaderValue, Method};
use std::sync::Arc;
use tower_http::{cors::CorsLayer, set_header::SetResponseHeaderLayer};
use tracing::{error, info};

mod config;
mod handlers;
mod helpers;
mod infrastructure;
mod middleware;
mod model;
mod repository;
mod services;
use config::CorsOrigins;
use infrastructure::app::create_app_state;

fn build_cors_layer(origins: &CorsOrigins) -> CorsLayer {
    match origins {
        CorsOrigins::Any => CorsLayer::permissive(),
        CorsOrigins::List(list) => {
            let parsed: Vec<HeaderValue> = list
                .iter()
                .filter_map(|origin| origin.parse().ok())
                .collect();

            CorsLayer::new()
                .allow_origin(parsed)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE])
        }
    }
}

#[tokio::main]
async fn main() -> Result<()> {
    // Load environment variables early
    dotenvy::dotenv().ok();

    // 1. Initialize application state
    let app_state = create_app_state()
        .await
        .context("Failed to initialize AppState")?;
    let app_state = Arc::new(app_state);

    // Initialise logging from AppState
    info!("Wakaclock Server Starting...");

    // 2. Perform Database Migrations
    info!("Running ClickHouse migrations...");
    if let Err(e) = app_state.heartbeat_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.project_merge_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.project_rule_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.analytics_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.account_analytics_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.ai_usage_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    // Must follow heartbeat_repo and analytics_repo: this one widens `heartbeats` and
    // `project_daily` with a nullable project_id, so both have to exist first.
    if let Err(e) = app_state.project_identity_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.reprocess_service.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.org_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.team_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.coworking_session_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    info!("Migrations completed successfully.");

    // Load any existing API key hashes into memory (wakaclock.users now exists).
    if let Err(e) = app_state.auth_cache.refresh(&app_state.clickhouse).await {
        error!("Failed to load auth key cache: {}", e);
        return Err(e);
    }

    // 3. Setup router
    let api_v1 = handlers::v1::router(app_state.clone());

    let router = axum::Router::new()
        .nest("/api/v1", api_v1)
        // Add middleware (Logger, CORS, etc.)
        .layer(tower_http::trace::TraceLayer::new_for_http())
        // Analytics and user/account responses are private data. Do not let a browser,
        // shared proxy or service worker cache one account's response for another user.
        .layer(SetResponseHeaderLayer::if_not_present(
            header::CACHE_CONTROL,
            HeaderValue::from_static("private, no-store"),
        ))
        .layer(SetResponseHeaderLayer::if_not_present(
            header::VARY,
            HeaderValue::from_static("Authorization"),
        ))
        .layer(build_cors_layer(&app_state.config.cors_origins));

    // 4. Start HTTP Server
    let host = app_state.config.server.host.clone();
    let port = app_state.config.server.port;
    let bind_addr = format!("{}:{}", host, port);

    info!("Starting server on {}", bind_addr);
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .context("Failed to bind TCP listener")?;

    // ConnectInfo<SocketAddr> is what the rate limiter keys on — note this is the
    // direct TCP peer, so behind a reverse proxy every request would appear to come
    // from the proxy's IP. Fine for a direct-exposed deployment; a proxied one needs
    // X-Forwarded-For handling instead, which isn't wired up yet.
    axum::serve(
        listener,
        router.into_make_service_with_connect_info::<std::net::SocketAddr>(),
    )
    .await
    .context("Server error")?;

    Ok(())
}
