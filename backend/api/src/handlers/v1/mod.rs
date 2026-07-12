pub mod ai_stats;
pub mod all_time;
pub mod durations;
pub mod heartbeats;
pub mod insights;
pub mod keystroke_stats;
pub mod project_merges;
pub mod project_rules;
pub mod projects;
pub mod reprocess;
pub mod stats;
pub mod status_bar;
pub mod summaries;
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
        .route(
            "/heartbeats",
            post(heartbeats::create).get(heartbeats::list),
        )
        .route("/heartbeats.bulk", post(heartbeats::create_bulk))
        .route("/all_time_since_today", get(all_time::get))
        .route("/durations", get(durations::list))
        .route("/insights/:type/:range", get(insights::get))
        .route("/projects", get(projects::list))
        .route("/reprocess", post(reprocess::run))
        .route("/status_bar/today", get(status_bar::today))
        .route("/stats/:range", get(stats::get))
        .route("/summaries", get(summaries::list))
        .route("/import/wakatime", post(wakatime_import::run))
        .route("/users/current", get(users::current))
        .route("/users/current/ai_stats", get(ai_stats::get))
        .route("/users/current/keystroke_stats", get(keystroke_stats::get))
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
