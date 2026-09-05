# Workflow: Adding a Backend Endpoint

Assumes you have read [../backend/overview.md](../backend/overview.md) and
[../backend/api-routes.md](../backend/api-routes.md).

## 1. Decide the surface

- WakaTime-compatible / core tracking → `/api/v1`, new or existing
  `backend/api/src/handlers/v1/<domain>.rs`.
- Phase 10 (goals, exports, profile, integrations, org) → `/api/v2`, add to
  [../../backend/api/src/handlers/v2.rs](../../backend/api/src/handlers/v2.rs).
- Unauthenticated share/embed → `handlers/public.rs`.

Check [../../wakatime-api-routes.md](../../wakatime-api-routes.md) and
[../../docs/wakatime-compatibility-manifest.json](../../docs/wakatime-compatibility-manifest.json)
first — if you are mirroring a WakaTime route, match its path and response shape.

## 2. Model

Add request/response structs to `backend/api/src/model/<domain>.rs` and declare
the module in `model/mod.rs`. Derive `Serialize`/`Deserialize`. For a date range,
take `ResolvedRange`
([../../backend/api/src/model/date_range.rs](../../backend/api/src/model/date_range.rs))
rather than raw strings.

## 3. Repository (only if new data access is needed)

Add `backend/api/src/repository/<domain>.rs`, declare in `repository/mod.rs`:

- struct holding `Arc<ClickHouseClient>`, `new(client)` constructor;
- `async fn migrate(&self) -> Result<()>` with idempotent DDL;
- query methods taking resolved parameters, returning row structs.

If it defines new tables, add its `migrate()` call to `main.rs` **in the right
position** — [../data/migrations.md](../data/migrations.md).

## 4. Service

Add or extend `backend/api/src/services/<domain>.rs`, declare in
`services/mod.rs`. Returns `anyhow::Result<T>`. **No axum types, no
`StatusCode`.**

For time-series reads, derive from the canonical timeline
(`ActivityTimelineService`), not raw heartbeat gaps.

For anything org-scoped, route the decision through `AuthorizationService`
rather than writing role conditionals — [../backend/auth.md](../backend/auth.md).

## 5. Wire into `AppState`

Add the field and its construction in
[../../backend/api/src/infrastructure/app/init.rs](../../backend/api/src/infrastructure/app/init.rs).
**Nothing is reachable until you do this.**

## 6. Handler

Follow the shape in
[../../backend/api/src/handlers/v1/summaries.rs](../../backend/api/src/handlers/v1/summaries.rs):

```rust
pub async fn list(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(params): Query<MyQuery>,
) -> Result<Json<MyResponse>, (StatusCode, Json<serde_json::Value>)> {
    let user_id = auth::resolve_user_id(&state, &headers).ok_or_else(auth::unauthorized)?;
    let response = state.my_service.do_thing(user_id, &params).await
        .map_err(|e| app_error(StatusCode::INTERNAL_SERVER_ERROR, &e.to_string()))?;
    Ok(Json(response))
}
```

Auth choices:
- normal endpoint → `resolve_user_id`
- must not be reachable by API key (e.g. minting a key) → `require_session_user`
- OAuth-scoped resource → `require_scope` + `forbidden_scope`
- auth-sensitive (login/register/key ops) → also `auth::check_rate_limit`

**Never read `user_id` from the query string or body as identity.**

## 7. Route it

Add to the `Router` in `handlers/v1/mod.rs` or `v2.rs`. axum 0.7 colon params
(`/thing/:id`). Declare the handler module in `handlers/v1/mod.rs` if new.

## 8. Test

Inline `#[cfg(test)] mod tests` in the file with the logic. Test the service's
pure logic without a database where possible; ClickHouse-backed tests use
`CLICKHOUSE_TEST_*` via
[../../backend/api/src/test_support.rs](../../backend/api/src/test_support.rs).

```bash
cd backend/api && cargo test && cargo clippy -- -D warnings
```

## 9. Frontend, if the dashboard consumes it

Add the response type to `lib/wakaclock/types.ts`, the call to `endpoints.ts`,
the key to `query-keys.ts` (**with `userId`**) — then
[adding-dashboard-panel.md](adding-dashboard-panel.md).
