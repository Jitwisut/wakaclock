# Authentication & Authorization

Canonical implementation:
[../../backend/api/src/middleware/auth.rs](../../backend/api/src/middleware/auth.rs).
It is a helper module, **not** an axum middleware layer — handlers call it
directly. (The old `src/helpers/auth/` template code was removed — see
[../dead-code.md](../dead-code.md).)

## Three credential types

| Credential | Shape | Lifetime | Holder |
| --- | --- | --- | --- |
| **API key** | `waka_` + UUIDv4 (new keys); legacy `wcl_` + 64 hex still accepted | long-lived, revocable | CLI, editor/browser extensions, wakatime-cli |
| **Session JWT** | HS256, claims `{sub: Uuid, exp}` | 24 h | dashboard |
| **OAuth access token** | opaque, carries a scope set | per grant | third-party apps |

All three arrive in the same header:
`Authorization: Bearer <token>` or `Authorization: Basic base64(<token>)` (the
WakaTime-compatible form; a trailing `:` is tolerated).

## API keys — Existing Convention

- User API keys are `waka_` + one CSPRNG UUIDv4 (`generate_wakatime_api_key`).
  wakatime-cli rejects any key not matching `^(waka_)?<uuid v4>$` before it
  sends a request, so this shape is what lets WakaTime plugins talk to AtoAxis.
  Keys issued earlier as `wcl_` + 64 hex (`generate_key`, still used for OAuth
  tokens and codes) keep working: lookup hashes the whole string.
- Hashed with **plain SHA-256**, not argon2/bcrypt — deliberate: the key is a
  256-bit random value, not a human password, so a slow KDF only taxes every
  request. Only the hash is persisted or held in memory (`hash_key`).
- Do not change this to a slow KDF without also changing the per-request
  verification path.

## The auth cache

[../../backend/api/src/infrastructure/auth_cache.rs](../../backend/api/src/infrastructure/auth_cache.rs)
holds `sha256(key) -> user_id` in memory, plus OAuth expirations and scopes.

Reason it exists: `wakaclock.users` is a ClickHouse `ReplacingMergeTree` ordered
by `user_id`. Looking a key up by hash would full-scan, and a revoked key would
keep working until ClickHouse merged the old row away.

**Rule: any mutation of a user's key must refresh the cache.** Creating,
rotating or revoking a key without refreshing leaves the old key valid.
`main.rs` warms it at startup from ClickHouse and, if configured, PostgreSQL.

## Resolving identity — the four entry points

| Function | Accepts | Use for |
| --- | --- | --- |
| `resolve_user_id(state, headers)` | session JWT **or** API key | almost every endpoint |
| `require_session_user(state, headers)` | session JWT only | endpoints an API key must not reach — notably minting a new API key (a key must never mint another key) |
| `resolve_user_id_from_token(state, token)` | raw token | **only** the presence SSE stream, where `EventSource` cannot set headers so the token arrives as `?token=` |
| `require_scope(state, headers, scope)` | OAuth scope check | OAuth-exposed resources; session JWTs pass, API keys have no scope entry and keep full-account behaviour |

### Critical rule

`resolve_user_id` returning `None` is a **hard 401**. Never fall back to a
`user_id` from a query string or JSON body — any caller can set that to any
uuid. An earlier soft-rollout fallback was removed for exactly this reason; do
not reintroduce it.

Shared response helpers: `auth::unauthorized()` (401) and
`auth::forbidden_scope(scope)` (403). Use them instead of hand-rolling bodies.

## Rate limiting

`auth::check_rate_limit(state, ip)` returns a ready-to-return 429. Apply it to
auth-sensitive endpoints (login, register, key generate/revoke). Backed by
[../../backend/api/src/infrastructure/rate_limiter.rs](../../backend/api/src/infrastructure/rate_limiter.rs)
(`governor`, in-process).

**Caveat:** the IP comes from `ConnectInfo<SocketAddr>`, i.e. the direct TCP
peer. Behind a reverse proxy every request looks like the proxy.
`X-Forwarded-For` handling is not implemented.

## Authorization (Phase 10)

[../../backend/api/src/services/authorization.rs](../../backend/api/src/services/authorization.rs)
is the single place for tenant policy. Model:

- `OrganizationRole`: Owner / Admin / Member / Viewer
- `OrganizationAction`: ReadSelf, ReadTeam, ReadOrganization, ManageMembers,
  ManageTeams, ManageIntegrations, ManageBilling, ManageSecurity,
  DeleteOrganization, ExportData
- `Entitlement`: OrganizationDashboards, Integrations, Export, SsoScim, Billing
- Returns an `AuthorizationDecision { allowed, role, entitlement, reason }`

**Rule: do not embed role conditionals in handlers.** Pass actor + action + org
+ entitlement through `AuthorizationService`. The pure decision function is
separate from the async PostgreSQL lookup so it stays unit-testable — preserve
that split when extending it.

`AuthorizationService::new` takes `Option<Arc<PostgresClient>>`; with
`POSTGRES_URL` unset it must degrade, not panic.

## OAuth

[../../backend/api/src/handlers/oauth.rs](../../backend/api/src/handlers/oauth.rs)
exposes `/oauth/authorize`, `/token`, `/revoke` and the device flow
(`/device/code`, `/device/token`, `/device/approve`). The handler and the
services it calls are the authoritative implementation; the old
`src/interfaces/oauth_state.rs` interface was uncompiled template code and has
been removed.
