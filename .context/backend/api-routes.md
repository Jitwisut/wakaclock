# API Routes

Mounted in [../../backend/api/src/main.rs](../../backend/api/src/main.rs).

| Prefix | Router source | Auth |
| --- | --- | --- |
| `/api/v1` | [../../backend/api/src/handlers/v1/mod.rs](../../backend/api/src/handlers/v1/mod.rs) | Bearer/Basic per handler |
| `/api/v2` | [../../backend/api/src/handlers/v2.rs](../../backend/api/src/handlers/v2.rs) | same |
| `/oauth` | [../../backend/api/src/handlers/oauth.rs](../../backend/api/src/handlers/oauth.rs) | authorize / token / revoke / device flow |
| `/public` | [../../backend/api/src/handlers/public.rs](../../backend/api/src/handlers/public.rs) | **unauthenticated** — share links, embed badges |
| `/scim/v2` | assembled inline in `main.rs` from `handlers::enterprise` | SCIM users/groups |

## v1 — WakaTime-compatible core

Grouped by concern (see `handlers/v1/mod.rs` for the authoritative list):

- ingest — `/heartbeats`, `/heartbeats.bulk`, `/ai/usage`, `/external_durations`
- read models — `/summaries`, `/durations`, `/stats`, `/status_bar`,
  `/all_time_since_today`, `/insights/:type/:range`, `/projects`
- catalog — `/editors`, `/leaders`, `/meta`, `/program_languages`
- identity/config — `/auth/register`, `/auth/login`, `/users`, `/api_key`
- project hygiene — `/project_rules`, `/project_merges`, `/projects/analytics`
- org — `/orgs`, `/teams`, `/presence`
- maintenance — `/analytics/rebuild`, `/reprocess`, `/repair`, `/data_dumps`,
  `/wakatime_import`
- gated — `/internal/subscription` (404 unless `INTERNAL_API_SECRET` is set)

## v2 — Phase 10

`/capabilities`, `/me`, `/me/analytics`, `/me/ai/effectiveness`, `/me/goals`,
`/exports`, `/profile`, `/share-links`, `/integrations/*`, `/ai/follow-up*`,
and VCS routes delegating to
[../../backend/api/src/handlers/vcs.rs](../../backend/api/src/handlers/vcs.rs).

## Handler pattern — Existing Convention

Canonical minimal example:
[../../backend/api/src/handlers/v1/summaries.rs](../../backend/api/src/handlers/v1/summaries.rs).

```rust
#[derive(Debug, Deserialize)]
pub struct SummariesQuery { pub start: String, pub end: String }

pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<SummariesQuery>,
) -> Result<Json<SummariesResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;

    let response = state
        .summary_service
        .get_range(user_id, &params.start, &params.end)
        .await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;

    Ok(Json(response))
}

fn app_error(status: StatusCode, msg: &str) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(serde_json::json!({ "error": msg })))
}
```

The five fixed elements:

1. `State(state): State<Arc<AppState>>` first.
2. `HeaderMap` — required for auth; never accept `user_id` from query or body.
3. A `#[derive(Deserialize)]` query/body struct in the same file.
4. `auth::resolve_user_id(...).ok_or_else(auth::unauthorized)?` as the first
   statement.
5. Exactly one service call; errors mapped through a local `app_error`.

## Validation — Existing Convention

Validation is serde deserialization plus explicit checks inside the service.
There is no validator crate and no shared request-validation layer. Date/range
parsing is centralised in
[../../backend/api/src/model/date_range.rs](../../backend/api/src/model/date_range.rs)
(`ResolvedRange`) — use it rather than parsing dates in a handler.

## Response conventions

- Success: bare `Json<T>` of a model type from `model/`.
- Error: `{"error": "<message>"}` with the status code.
- Global layers set `Cache-Control: private, no-store` and
  `Vary: Authorization` — analytics responses are per-account private data.
  Do not override these on an authenticated route.

## Route registration

A handler function is unreachable until it is added to the `Router` in
`handlers/v1/mod.rs` (or `v2.rs`). Path params use axum 0.7 colon syntax
(`/insights/:type/:range`), not braces.
