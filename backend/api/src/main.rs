use anyhow::{Context, Result};
use std::sync::Arc;
use tracing::{error, info};

mod config;
mod handlers;
mod helpers;
mod infrastructure;
mod middleware;
mod model;
mod repository;
mod services;
use infrastructure::app::create_app_state;

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
        .layer(tower_http::cors::CorsLayer::permissive());

    // 4. Start HTTP Server
    let host = app_state.config.server.host.clone();
    let port = app_state.config.server.port;
    let bind_addr = format!("{}:{}", host, port);

    info!("Starting server on {}", bind_addr);
    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .context("Failed to bind TCP listener")?;

    axum::serve(listener, router)
        .await
        .context("Server error")?;

    Ok(())
}
