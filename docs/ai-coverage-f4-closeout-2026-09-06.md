# AI coverage F4 implementation record — 2026-09-06

F4 now has a server-owned certification boundary. The implementation is local
and reviewable; it does not claim that this workspace has authenticated,
current Claude or Codex live certification.

## Delivered

- `scripts/ai-coverage/validate_certification.py` validates schema v2 artifacts,
  bounded metadata, timestamps/expiry, monotonic stage counters, privacy keys,
  mandatory source→producer→broker→canonical→API→dashboard stages, and the
  promotion rule. Fixture and historical evidence cannot promote an adapter.
- `scripts/ai-coverage/run_live_certification.py` runs a driver in a temporary
  HOME/workspace, retains only an allowlisted metadata summary, and always
  emits `review_status=pending`/`promotable=false`. Raw driver output is never
  written to the artifact.
- `scripts/ai-coverage/import_legacy_certifications.py` converted the five v1
  records into `certifications/ai-adapters/historical/`. Missing runtime,
  OS/architecture, edit modes, corpus and build evidence remain `null`/empty.
- `certifications/ai-adapters/catalog-v1.json` is the reviewed catalog release
  artifact. It contains historical entries only, so the current catalog has no
  production promotion. The same file is embedded at
  `backend/api/crates/wakaclock-core/resources/ai-certifications/catalog-v1.json`.
- `wakaclock-core::ai::certification` validates and resolves exact tuples,
  expiry, revocation, historical status and enum mapping. The backend loads the
  catalog at startup and overwrites client maturity claims during v2 ingestion.
- CLI diagnostics now carry the observed tuple. API diagnostics validate tuple
  metadata and return certificate id/status separately from runtime health.
  The dashboard uses capability-scoped “Certified” labels and still shows
  degraded/idle/unavailable runtime state independently.
- CI runs the v2 validator, historical import checks, catalog checks and the
  harness privacy tests.

## Local evidence

- Python F4 tests: 9 passed.
- Historical v2 artifacts: 5 passed privacy/shape validation.
- Catalog validation: passed.
- Core certification tests: 5 passed.
- Backend certification service tests: 2 passed.
- `cargo check --workspace`: passed.
- Frontend TypeScript typecheck and ESLint: passed.

## Remaining release gates

An approved catalog entry still requires an authenticated real adapter run on a
supported OS/architecture, a shipped producer/build digest, backend readback,
dashboard readback and human review. Until that evidence is added, Claude and
Codex remain historical/scaffold in the server catalog even when a local client
reports a real observation.
