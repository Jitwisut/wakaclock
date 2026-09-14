pub mod account_analytics;
pub mod ai_diagnostics;
pub mod ai_identity;
pub mod ai_stats;
pub mod ai_usage;
pub mod all_time;
pub mod analytics_explorer;
pub mod api_key;
pub mod auth;
pub mod catalog;
pub mod dashboard_analytics;
pub mod data_dumps;
pub mod durations;
pub mod early_access;
pub mod external_durations;
pub mod goals;
pub mod heartbeats;
pub mod insights;
pub mod internal;
pub mod keystroke_stats;
pub mod orgs;
pub mod presence;
pub mod project_analytics;
pub mod project_identity;
pub mod project_merges;
pub mod project_rules;
pub mod projects;
pub mod repair;
pub mod reprocess;
pub mod stats;
pub mod status_bar;
pub mod summaries;
pub mod teams;
pub mod users;
pub mod wakatime_import;
use crate::infrastructure::app::AppState;
use axum::{
    routing::{delete, get, post, put},
    Router,
};
use std::sync::Arc;

pub fn router(app_state: Arc<AppState>) -> Router {
    Router::new()
        .route("/early-access", post(early_access::create).layer(early_access::body_limit()))
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
        .route(
            "/heartbeats.bulk",
            post(heartbeats::create_bulk).delete(heartbeats::delete_bulk),
        )
        .route("/ai/usage", post(ai_usage::ingest))
        .route("/ai/identity/repair", post(ai_identity::repair))
        .route("/ai/diagnostics", post(ai_diagnostics::ingest))
        .route("/ai/diagnostics/v2", post(ai_diagnostics::ingest_v2))
        .route("/analytics/rebuild", post(account_analytics::rebuild))
        .route("/all_time_since_today", get(all_time::get))
        .route("/editors", get(catalog::editors))
        .route("/leaders", get(catalog::leaders))
        .route("/meta", get(catalog::meta))
        .route("/program_languages", get(catalog::program_languages))
        .route("/durations", get(durations::list))
        .route(
            "/external_durations",
            get(external_durations::list)
                .post(external_durations::create)
                .delete(external_durations::delete_source),
        )
        .route(
            "/external_durations.bulk",
            post(external_durations::create_bulk)
                .delete(external_durations::delete_bulk),
        )
        .route("/data_dumps", get(data_dumps::list).post(data_dumps::create))
        .route("/goals", get(goals::list))
        .route("/insights/:type/:range", get(insights::get))
        .route("/projects", get(projects::list))
        .route("/projects/analytics", get(project_analytics::list))
        .route(
            "/projects/:project_id/analytics",
            get(project_analytics::detail),
        )
        .route("/projects/:project_id/files", get(project_analytics::files))
        .route(
            "/projects/:project_id/branches",
            get(project_analytics::branches),
        )
        .route("/projects/:project_id/daily", get(project_analytics::daily))
        .route("/projects/:project_id/ai", get(project_analytics::ai))
        .route(
            "/projects/backfill_preview",
            get(project_identity::backfill_preview),
        )
        .route("/reprocess", post(reprocess::run))
        .route("/repair/day", post(repair::day))
        .route("/status_bar/today", get(status_bar::today))
        .route("/stats/:range", get(stats::get))
        .route("/stats", get(catalog::stats_default))
        .route("/summaries", get(summaries::list))
        .route("/import/wakatime", post(wakatime_import::run))
        .route("/users/current", get(users::current))
        // WakaTime-compatible aliases. The authenticated principal always wins; the
        // `:user` segment is accepted for client compatibility but is never trusted as
        // an authorization input.
        .route("/users/:user", get(users::current))
        .route("/users/current/machine_names", get(catalog::machine_names))
        .route("/users/:user/machine_names", get(catalog::machine_names))
        .route("/users/current/user_agents", get(catalog::user_agents))
        .route("/users/:user/user_agents", get(catalog::user_agents))
        .route("/users/current/stats", get(catalog::stats_default))
        .route("/users/:user/stats", get(catalog::stats_default))
        .route(
            "/users/current/custom_rules",
            get(project_rules::list).put(catalog::custom_rule_upsert),
        )
        .route(
            "/users/:user/custom_rules",
            get(project_rules::list).put(catalog::custom_rule_upsert),
        )
        .route(
            "/users/current/custom_rules/:rule_id",
            delete(project_rules::delete),
        )
        .route(
            "/users/:user/custom_rules/:rule_id",
            delete(project_rules::delete),
        )
        .route(
            "/users/current/custom_rules_progress",
            get(catalog::custom_rule_progress).delete(catalog::clear_custom_rule_progress),
        )
        .route(
            "/users/:user/custom_rules_progress",
            get(catalog::custom_rule_progress).delete(catalog::clear_custom_rule_progress),
        )
        .route("/users/current/orgs", get(orgs::list))
        .route("/users/:user/orgs", get(orgs::list))
        .route("/users/current/leaderboards", get(catalog::private_leaderboards))
        .route("/users/:user/leaderboards", get(catalog::private_leaderboards))
        .route(
            "/users/current/leaderboards/:board",
            get(catalog::private_leaderboard),
        )
        .route(
            "/users/:user/leaderboards/:board",
            get(catalog::private_leaderboard),
        )
        .route(
            "/users/current/data_dumps",
            get(data_dumps::list).post(data_dumps::create),
        )
        .route(
            "/users/:user/data_dumps",
            get(data_dumps::list).post(data_dumps::create),
        )
        .route(
            "/users/current/all_time_since_today",
            get(all_time::get),
        )
        .route("/users/:user/all_time_since_today", get(all_time::get))
        .route("/users/current/durations", get(durations::list))
        .route("/users/:user/durations", get(durations::list))
        .route(
            "/users/current/external_durations",
            get(external_durations::list)
                .post(external_durations::create)
                .delete(external_durations::delete_source),
        )
        .route(
            "/users/current/external_durations.bulk",
            post(external_durations::create_bulk)
                .delete(external_durations::delete_bulk),
        )
        .route(
            "/users/:user/external_durations",
            get(external_durations::list)
                .post(external_durations::create)
                .delete(external_durations::delete_source),
        )
        .route(
            "/users/:user/external_durations.bulk",
            post(external_durations::create_bulk)
                .delete(external_durations::delete_bulk),
        )
        .route("/users/current/heartbeats", get(heartbeats::list).post(heartbeats::create))
        .route(
            "/users/:user/heartbeats",
            get(heartbeats::list).post(heartbeats::create),
        )
        .route(
            "/users/current/heartbeats.bulk",
            post(heartbeats::create_bulk).delete(heartbeats::delete_bulk),
        )
        .route(
            "/users/:user/heartbeats.bulk",
            post(heartbeats::create_bulk).delete(heartbeats::delete_bulk),
        )
        .route("/users/current/insights/:type/:range", get(insights::get))
        .route("/users/:user/insights/:type/:range", get(insights::get))
        .route("/users/current/projects", get(projects::list))
        .route("/users/:user/projects", get(projects::list))
        .route("/users/current/goals", get(goals::list))
        .route("/users/:user/goals", get(goals::list))
        .route("/users/current/goals/:goal", get(goals::get))
        .route("/users/:user/goals/:goal", get(goals::get))
        .route("/users/current/stats/:range", get(stats::get))
        .route("/users/:user/stats/:range", get(stats::get))
        .route("/users/current/summaries", get(summaries::list))
        .route("/users/:user/summaries", get(summaries::list))
        .route("/users/current/status_bar/today", get(status_bar::today))
        .route("/users/:user/status_bar/today", get(status_bar::today))
        .route("/users/current/ai_stats", get(ai_stats::get))
        .route("/users/:user/ai_stats", get(ai_stats::get))
        .route(
            "/users/current/ai_diagnostics",
            get(ai_diagnostics::get),
        )
        .route(
            "/users/current/ai_diagnostics/v2",
            get(ai_diagnostics::get_v2),
        )
        .route("/users/:user/ai_diagnostics", get(ai_diagnostics::get))
        .route(
            "/users/:user/ai_diagnostics/v2",
            get(ai_diagnostics::get_v2),
        )
        .route("/dashboard/analytics", get(dashboard_analytics::overview))
        .route("/dashboard/explorer", get(analytics_explorer::get))
        .route(
            "/users/current/api_key",
            get(api_key::current)
                .post(api_key::generate)
                .delete(api_key::revoke),
        )
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
            "/presence/rooms/:room_id/stream-ticket",
            post(presence::create_stream_ticket),
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
