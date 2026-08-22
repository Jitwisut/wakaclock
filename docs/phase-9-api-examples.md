# Phase 9 analytics API examples

All analytics requests require the authenticated Wakaclock session/API key. `start` and
`end` are inclusive local dates; `timezone` is an IANA name. `data_version: 0` means the
current response used the exact timezone-aware raw-data fallback; projection publication is
available for rebuild/launch-gate verification and is not mixed into that response.

```http
GET /api/v1/dashboard/analytics?start=2026-08-01&end=2026-08-31&timezone=Asia%2FBangkok
Authorization: Bearer <api-key>
```

```http
GET /api/v1/projects/analytics?start=2026-08-01&end=2026-08-31&timezone=Asia%2FBangkok&sort=estimated_cost&order=desc&limit=30
Authorization: Bearer <api-key>
```

Use the returned `next_cursor` verbatim for the next page. Cursors are signed and bound to
the selected sort/order, range, project, branch and file filter (file and branch cursors are
also signed). Project drill-down routes
share the same range and optional branch filter:

```http
GET /api/v1/projects/<project_id>/daily?start=2026-08-01&end=2026-08-31&timezone=Asia%2FBangkok&branch=main
GET /api/v1/projects/<project_id>/files?start=2026-08-01&end=2026-08-31&timezone=Asia%2FBangkok&branch=main&limit=50
GET /api/v1/projects/<project_id>/branches?start=2026-08-01&end=2026-08-31&timezone=Asia%2FBangkok&limit=50
GET /api/v1/projects/<project_id>/ai?start=2026-08-01&end=2026-08-31&timezone=Asia%2FBangkok&branch=main
```

`null` means unavailable or unprovable. It is not a zero-cost, zero-token, or human-change
claim. File paths are sanitized by the API and never expose an absolute machine path. Branch
responses include `other_seconds` when pagination omits additional branches. Expensive analytics,
drill-down, rebuild and reprocess calls are separately rate-limited per authenticated account;
private responses are sent with `Cache-Control: private, no-store` and `Vary: Authorization`.
When a project detail request is filtered to a branch, heartbeat-derived duration and change
metrics follow that branch; prompts, sessions, tokens and cost remain `null` because usage
events do not carry branch provenance.
