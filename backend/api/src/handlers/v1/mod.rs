pub mod ai_stats;
pub mod all_time;
pub mod api_key;
pub mod auth;
pub mod dashboard_analytics;
pub mod durations;
pub mod heartbeats;
pub mod insights;
pub mod internal;
pub mod keystroke_stats;
pub mod orgs;
pub mod presence;
pub mod project_identity;
pub mod project_merges;
pub mod project_rules;
pub mod projects;
pub mod reprocess;
pub mod stats;
pub mod status_bar;
pub mod summaries;
pub mod teams;
pub mod users;
pub mod wakatime_import;
use crate::infrastructure::app::AppState;
use axum::{
    routing::{get, post, put},
    Router,
};
use std::sync::Arc;

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/auth/register", post(auth::register))
        .route("/auth/login", post(auth::login))
        .route(
            "/internal/subscription",
            post(internal::update_subscription),
        )
        .route(
            "/heartbeats",
            post(heartbeats::create).get(heartbeats::list),
        )
        .route("/heartbeats.bulk", post(heartbeats::create_bulk))
        .route("/all_time_since_today", get(all_time::get))
        .route("/durations", get(durations::list))
        .route("/insights/:type/:range", get(insights::get))
        .route("/projects", get(projects::list))
        .route(
            "/projects/backfill_preview",
            get(project_identity::backfill_preview),
        )
        .route("/reprocess", post(reprocess::run))
        .route("/status_bar/today", get(status_bar::today))
        .route("/stats/:range", get(stats::get))
        .route("/summaries", get(summaries::list))
        .route("/import/wakatime", post(wakatime_import::run))
        .route("/users/current", get(users::current))
        .route("/dashboard/analytics", get(dashboard_analytics::overview))
        .route(
            "/users/current/api_key",
            get(api_key::current)
                .post(api_key::generate)
                .delete(api_key::revoke),
        )
        .route("/users/current/ai_stats", get(ai_stats::get))
        .route("/users/current/keystroke_stats", get(keystroke_stats::get))
        .route("/orgs", post(orgs::create).get(orgs::list))
        .route("/orgs/:org_id/teams", post(teams::create).get(teams::list))
        .route(
            "/orgs/:org_id/teams/:team_id/members",
            post(teams::add_member),
        )
        .route("/presence/rooms", post(presence::create_room))
        .route("/presence/rooms/:room_id/join", post(presence::join_room))
        .route("/presence/rooms/:room_id/leave", post(presence::leave_room))
        .route(
            "/presence/rooms/:room_id/position",
            post(presence::update_position),
        )
        .route(
            "/presence/rooms/:room_id/sessions",
            post(presence::start_or_join_session),
        )
        .route(
            "/presence/rooms/:room_id/sessions/leave",
            post(presence::leave_session),
        )
        .route(
            "/presence/rooms/:room_id/stream",
            get(presence::stream_presence),
        )
        .route("/project_merges", get(project_merges::list))
        .route(
            "/project_merges/:merge_id",
            put(project_merges::upsert).delete(project_merges::delete),
        )
        .route("/project_rules", get(project_rules::list))
        .route(
            "/project_rules/:rule_id",
            put(project_rules::upsert).delete(project_rules::delete),
        )
        .with_state(app_state)
}
