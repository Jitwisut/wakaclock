# Architecture

## Data flow

```
 clients                    API server (axum)                 storage
 ────────                   ─────────────────                 ───────
 VS Code ext ─┐
 browser ext  ├─ heartbeat ─► POST /api/v1/heartbeats
 CLI / LS     │                   │
 AI hooks    ─┘                   ▼
                            handlers/  (HTTP only)
                                  │
                                  ▼
                            services/  (business logic)
                                  │
                                  ▼
                            repository/ (SQL)  ──────────►  ClickHouse
                                  │                          (heartbeats,
                                  │                           derived tables)
                                  └── services/authorization,
                                      org/team/billing  ────►  PostgreSQL
                                                               (optional)
 Next.js dashboard ◄── GET /api/v1/*, /api/v2/* ◄─────────────┘
```

Every derived number (durations, summaries, stats, project analytics) is
computed from the **canonical activity timeline**
([../backend/api/src/services/activity_timeline.rs](../backend/api/src/services/activity_timeline.rs)),
never from raw heartbeat rows directly. Do not add a new endpoint that queries
`wakaclock.heartbeats` and infers time from row gaps — that was the previous
approach and it over-counted idle time. See the note in
[../backend/api/src/services/duration.rs](../backend/api/src/services/duration.rs).

## Layer boundaries (backend)

| Layer | Directory | May depend on | Must NOT |
| --- | --- | --- | --- |
| Handlers | `backend/api/src/handlers/` | services, model, middleware | touch ClickHouse/Postgres directly |
| Services | `backend/api/src/services/` | repository, model, other services | parse HTTP types, build responses with status codes |
| Repository | `backend/api/src/repository/` | infrastructure clients, model | contain business rules |
| Model | `backend/api/src/model/` | nothing app-specific | do I/O |
| Infrastructure | `backend/api/src/infrastructure/` | config | contain domain logic |

Detail: [backend/overview.md](backend/overview.md).

## Composition root

[../backend/api/src/infrastructure/app/init.rs](../backend/api/src/infrastructure/app/init.rs)
builds `AppState` — every repository and service is constructed there and held
in an `Arc<AppState>` shared by all handlers. **A new service or repository is
not reachable until it is added to `AppState`.**

[../backend/api/src/main.rs](../backend/api/src/main.rs) then, in order:
1. loads `.env`, builds `AppState`;
2. runs every repository's `migrate()` (ordering matters — see
   [data/migrations.md](data/migrations.md));
3. warms `auth_cache` from ClickHouse and, if configured, PostgreSQL;
4. mounts routers and applies global layers (trace, `Cache-Control:
   private, no-store`, `Vary: Authorization`, CORS);
5. serves with `ConnectInfo<SocketAddr>` so the rate limiter can key on peer IP.

## Route surfaces

| Prefix | Router | Purpose |
| --- | --- | --- |
| `/api/v1` | `handlers::v1::router` | WakaTime-compatible core API |
| `/api/v2` | `handlers::v2::router` | Phase 10: goals, exports, profile, integrations, VCS, share links |
| `/oauth` | `handlers::oauth::router` | OAuth authorize/token/revoke + device flow |
| `/public` | `handlers::public::router` | Unauthenticated share links and embed badges |
| `/scim/v2` | assembled inline in `main.rs` | Enterprise SCIM users/groups |

Detail: [backend/api-routes.md](backend/api-routes.md).

## Known architectural gaps

Documented in code comments, verified present:

- **Rate limiting keys on the direct TCP peer.** Behind a reverse proxy every
  request appears to come from the proxy. `X-Forwarded-For` handling is not
  wired up (`main.rs`, comment above `axum::serve`).
- **Presence is in-memory**
  ([../backend/api/src/infrastructure/presence_store.rs](../backend/api/src/infrastructure/presence_store.rs)),
  not Redis-backed. It does not survive a restart and does not work across
  multiple server instances.
- **PostgreSQL is optional.** `POSTGRES_URL` unset ⇒ `AppState.postgres` is
  `None` and every Phase 10 org/billing path must degrade, not panic.

## Deployment

- Frontend → Netlify, base `frontend/app`, `npm run build`
  ([../netlify.toml](../netlify.toml)).
- Backend → Docker Compose ([../docker-compose.yml](../docker-compose.yml)),
  optionally fronted by Caddy ([../Caddyfile](../Caddyfile)).
- VS Code extension → GitHub Actions
  ([../.github/workflows/release-extension.yml](../.github/workflows/release-extension.yml)).
