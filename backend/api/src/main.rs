use anyhow::{Context, Result};
use axum::http::{header, HeaderValue, Method};
use std::{sync::Arc, time::Duration};
use tower_http::{cors::CorsLayer, set_header::SetResponseHeaderLayer};
use tracing::{error, info};

use wakaclock_server::config::CorsOrigins;
use wakaclock_server::handlers;
use wakaclock_server::infrastructure::app::{create_app_state, AppHealth, AppState, HealthStatus};

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
                .allow_methods([
                    Method::GET,
                    Method::POST,
                    Method::PUT,
                    Method::PATCH,
                    Method::DELETE,
                ])
                .allow_headers([
                    header::AUTHORIZATION,
                    header::CONTENT_TYPE,
                    header::HeaderName::from_static("idempotency-key"),
                ])
                .expose_headers([header::LOCATION])
        }
    }
}

async fn health_endpoint(state: Arc<AppState>) -> (axum::http::StatusCode, axum::Json<AppHealth>) {
    let health = state.health().await;
    let status = if matches!(&health.status, HealthStatus::Ok) {
        axum::http::StatusCode::OK
    } else {
        axum::http::StatusCode::SERVICE_UNAVAILABLE
    };
    (status, axum::Json(health))
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

    let migration_guard = match &app_state.postgres {
        Some(postgres) => Some(postgres.migration_guard().await?),
        None => None,
    };

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
    if let Err(e) = app_state.external_duration_repo.migrate().await {
        error!("Migration failed: {}", e);
        return Err(e);
    }
    if let Err(e) = app_state.follow_up_repo.migrate().await {
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
    if let Some(postgres) = &app_state.postgres {
        info!("Running PostgreSQL Phase 10 foundation migration...");
        if let Err(e) = postgres.migrate().await {
            error!("PostgreSQL migration failed: {}", e);
            return Err(e);
        }
    }
    info!("Migrations completed successfully.");

    app_state.user_service.migrate_legacy_credentials().await?;
    drop(migration_guard);

    // Background jobs are handled by the dedicated `job-worker` process. The API only
    // writes PostgreSQL job/outbox rows, so a worker restart never loses an accepted job
    // and an API replica does not compete with workers for RabbitMQ consumer slots.

    // Reconcile active Redis projections into ClickHouse even when no browser is currently
    // connected. This closes sessions after lease expiry and provides the recovery timeout
    // boundary for an API restart without making analytics a dependency of live room joins.
    if let (Some(redis), Some(presence_repo)) = (
        app_state.redis_presence.clone(),
        app_state.presence_repo.clone(),
    ) {
        let session_service = app_state.coworking_session_service.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_secs(60));
            loop {
                ticker.tick().await;
                let recovery_before =
                    chrono::Utc::now().timestamp().saturating_sub(600).max(0) as u32;
                if let Err(error) = session_service
                    .recover_stale_sessions(recovery_before)
                    .await
                {
                    tracing::warn!(%error, "presence reconciler could not recover stale sessions");
                }
                let rooms = match redis.active_rooms().await {
                    Ok(rooms) => rooms,
                    Err(error) => {
                        tracing::warn!(%error, "presence reconciler could not list Redis rooms");
                        continue;
                    }
                };
                for room_id in rooms {
                    let room = match presence_repo.get(room_id).await {
                        Ok(room) => room,
                        Err(error) => {
                            tracing::warn!(%error, %room_id, "presence reconciler could not load room");
                            continue;
                        }
                    };
                    let Some(room) = room else {
                        let _ = redis.clear_room(room_id).await;
                        continue;
                    };
                    if room.ended_at.is_some()
                        || room
                            .expires_at
                            .is_some_and(|expires_at| expires_at <= chrono::Utc::now())
                    {
                        let _ = redis.clear_room(room_id).await;
                        continue;
                    }
                    match redis.snapshot(room_id).await {
                        Ok(live) => {
                            if let Err(error) = session_service
                                .reconcile_live_snapshot(room_id, room.team_id, &live.sessions)
                                .await
                            {
                                tracing::warn!(%error, %room_id, "presence reconciler could not checkpoint session");
                            }
                        }
                        Err(error) => {
                            tracing::warn!(%error, %room_id, "presence reconciler could not read Redis snapshot");
                        }
                    }
                }
            }
        });
    }

    if app_state.config.presence_v2_enabled {
        let media_state=app_state.clone();
        tokio::spawn(async move {
            let mut ticker=tokio::time::interval(Duration::from_secs(5));
            ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);
            loop {
                ticker.tick().await;
                if let Err(error)=handlers::presence_v2::office::reconcile_media(&media_state).await {
                    tracing::warn!(%error,"presence media permission reconciliation failed");
                }
            }
        });
    }

    // 3. Setup router
    let api_v1 = handlers::v1::router(app_state.clone());
    let api_v2 = handlers::v2::router(app_state.clone());
    let scim_router = axum::Router::new()
        .route(
            "/Users",
            axum::routing::get(handlers::enterprise::scim_users_list)
                .post(handlers::enterprise::scim_users_create),
        )
        .route(
            "/Users/:user_id",
            axum::routing::get(handlers::enterprise::scim_user_get)
                .patch(handlers::enterprise::scim_user_patch)
                .delete(handlers::enterprise::scim_user_delete),
        )
        .route(
            "/Groups",
            axum::routing::get(handlers::enterprise::scim_groups_list)
                .post(handlers::enterprise::scim_groups_create),
        )
        .with_state(app_state.clone());

    let health_state = app_state.clone();
    let router = axum::Router::new()
        .route(
            "/health",
            axum::routing::get(move || health_endpoint(health_state.clone())),
        )
        .nest("/api/v1", api_v1)
        .nest("/api/v2", api_v2)
        .nest("/oauth", handlers::oauth::router(app_state.clone()))
        .nest("/public", handlers::public::router(app_state.clone()))
        .nest("/scim/v2", scim_router)
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
    .with_graceful_shutdown(shutdown_signal())
    .await
    .context("Server error")?;

    Ok(())
}

async fn shutdown_signal() {
    #[cfg(unix)]
    {
        let mut terminate =
            tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                .expect("install SIGTERM handler");
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {},
            _ = terminate.recv() => {},
        }
    }
    #[cfg(not(unix))]
    {
        let _ = tokio::signal::ctrl_c().await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, routing::get, Router};
    use tower::ServiceExt;

    fn cors_app() -> Router {
        Router::new()
            .route("/health", get(|| async { "ok" }))
            .layer(build_cors_layer(&CorsOrigins::List(vec![
                "https://www.atoaxis.com".to_string(),
                "https://app.atoaxis.com".to_string(),
            ])))
    }

    async fn preflight(origin: &str) -> axum::http::Response<Body> {
        cors_app()
            .oneshot(
                axum::http::Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/health")
                    .header(header::ORIGIN, origin)
                    .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
                    .body(Body::empty())
                    .expect("preflight request is valid"),
            )
            .await
            .expect("CORS layer should return a response")
    }

    #[tokio::test]
    async fn production_origins_are_allowed_by_preflight() {
        for origin in ["https://www.atoaxis.com", "https://app.atoaxis.com"] {
            let response = preflight(origin).await;
            assert_eq!(response.status(), axum::http::StatusCode::OK);
            assert_eq!(
                response.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN),
                Some(&HeaderValue::from_str(origin).unwrap())
            );
        }
    }

    #[tokio::test]
    async fn reprocess_job_headers_are_allowed_by_preflight() {
        let response = cors_app()
            .oneshot(
                axum::http::Request::builder()
                    .method(Method::OPTIONS)
                    .uri("/health")
                    .header(header::ORIGIN, "https://www.atoaxis.com")
                    .header(header::ACCESS_CONTROL_REQUEST_METHOD, "POST")
                    .header(
                        header::ACCESS_CONTROL_REQUEST_HEADERS,
                        "content-type, idempotency-key",
                    )
                    .body(Body::empty())
                    .expect("job preflight request is valid"),
            )
            .await
            .expect("CORS layer should return a response");
        assert_eq!(response.status(), axum::http::StatusCode::OK);
        let allowed = response
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_HEADERS)
            .and_then(|value| value.to_str().ok())
            .unwrap_or_default()
            .to_ascii_lowercase();
        assert!(allowed.contains("idempotency-key"));
    }

    #[tokio::test]
    async fn an_unlisted_origin_does_not_receive_cors_access() {
        let response = preflight("https://attacker.example").await;
        assert!(response
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .is_none());
    }
}
