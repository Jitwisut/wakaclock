use super::*;
use crate::model::agent_universe::{
    AgentLiveResponse, AgentUniverseResponse, AGENT_UNIVERSE_MAX_RANGE_DAYS,
};
use crate::services::agent_universe::{AgentUniverseService, TooManyRows};

pub async fn get(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<RangeQuery>,
) -> Result<(HeaderMap, Json<V2Envelope<AgentUniverseResponse>>), ApiError> {
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    if !state.config.agent_universe_enabled {
        return Err(ApiError::service_unavailable("agent universe is disabled"));
    }
    let (start, end) = resolve_range(query.start, query.end, query.timezone.as_deref())?;
    let range = ResolvedRange::parse(&start, &end, query.timezone.as_deref())
        .map_err(|error| ApiError::bad_request(error.to_string()))?;
    if range.days_included() > AGENT_UNIVERSE_MAX_RANGE_DAYS {
        return Err(ApiError::bad_request(format!(
            "agent universe range must be at most {AGENT_UNIVERSE_MAX_RANGE_DAYS} days"
        )));
    }
    let universe = AgentUniverseService::new(state.clickhouse.clone())
        .universe(user_id, &range)
        .await
        .map_err(|error| {
            if error.downcast_ref::<TooManyRows>().is_some() {
                ApiError::bad_request("this range has too many sessions to draw")
            } else {
                ApiError::internal(error)
            }
        })?;
    let timezone = range.timezone.to_string();
    let mut private = HeaderMap::new();
    private.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((
        private,
        Json(envelope(
            universe,
            &timezone,
            Some(json!({
                "source": "ai_usage_events",
                "time": "hours_with_events_not_durations",
            })),
        )),
    ))
}

/// The agents with heartbeats in the last few minutes. Polled by the dashboard, so it shares the
/// per-account analytics limit.
pub async fn live(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
) -> Result<(HeaderMap, Json<V2Envelope<AgentLiveResponse>>), ApiError> {
    let user_id = require_scope(&state, &headers, "read_ai_analytics").await?;
    if !state.config.agent_universe_enabled {
        return Err(ApiError::service_unavailable("agent universe is disabled"));
    }
    auth::check_analytics_rate_limit(&state, user_id)
        .map_err(|_| ApiError::too_many_requests("analytics request rate limit exceeded"))?;
    let now = u32::try_from(Utc::now().timestamp()).map_err(ApiError::internal)?;
    let live = AgentUniverseService::new(state.clickhouse.clone())
        .live(user_id, now)
        .await
        .map_err(ApiError::internal)?;
    let mut private = HeaderMap::new();
    private.insert("cache-control", "private, no-store".parse().unwrap());
    Ok((
        private,
        Json(envelope(
            live,
            "UTC",
            Some(json!({
                "source": "heartbeats",
                "time": "latest_heartbeat_not_delivery_time",
            })),
        )),
    ))
}
