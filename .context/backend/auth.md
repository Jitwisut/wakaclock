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
| **Session JWT** | HS256, claims `{sub: Uuid, exp, jti}` | 24 h | dashboard |
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

## Authoritative identity lookup

`middleware/auth.rs` checks credentials against PostgreSQL when configured, or
ClickHouse compatibility state otherwise; there is no credential cache.
Sessions carry `{sub, exp, jti}`. PostgreSQL checks active users and unrevoked,
unexpired session rows. ClickHouse checks active users and session-revocation
hashes. API keys and OAuth access tokens are checked for revocation and expiry;
OAuth grants preserve their scopes.

`resolve_context`, `resolve_user_id`, `require_account_user` and
`require_session_user` return `Result<Option<_>, AuthFailure>`. `Ok(None)` means
401; `Err` means 503, never a reason for clients to delete a valid credential.
`require_scope` returns `Result<bool, AuthFailure>`; `require_scoped_user` performs
one lookup and enforces the scope. Never infer identity from a client user ID.
First-party account helpers reject third-party OAuth grants.

`POST /api/v1/auth/logout` revokes only the signed session supplied by the caller.
The operation is idempotent and durable with either identity store. UI logout
retains the session on a temporary failure so the user can retry; delayed logout
ACKs cannot erase a newer login. Exact session expiry matches revocation TTL.

## Rate limiting

Auth-sensitive endpoints use `auth::client_ip` with explicitly configured
`TRUSTED_PROXY_IPS`; untrusted forwarding headers are ignored. Password/key/logout
limits are separate from OAuth device-code issuance limits. Device issuance also
uses a transactional pending-code limit across API replicas.

See [../../docs/backend-auth-diagnostics-hardening.md](../../docs/backend-auth-diagnostics-hardening.md)
for limits, tests, rollout and rollback constraints.

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
