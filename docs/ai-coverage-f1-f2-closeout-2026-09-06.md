# AI coverage F1/F2 closeout — 2026-09-06

This closeout records the implementation and local verification completed on
`features/ai-coverage-f0-baseline`. It closes the F1 attribution/reconciliation
and F2 diagnostics implementation gates. It does not claim live ClickHouse or
PostgreSQL certification, which belongs to F4/F8.

## F1 — attribution, deduplication, and late reconciliation

The editor no longer turns the absence of a sidecar row into Human. Each editor
change is retained as a bounded, 24-hour pending observation and starts in the
unknown bucket until a producer proves ownership. A matching sidecar row must
carry either the same producer tool operation ID or the same post-edit
`sha256:<64-hex>` content version. File path, timestamp, and line counts are
candidate selectors only; they are never identity proof. Same-distance
candidates and partial/unknown line counts remain unattributed.

The broker sidecar transport now has a durable stream ID and sequence, bounded
incremental reads, partial-line protection, rotation recovery, atomic cursor
checkpoints, and operation-proof deduplication. Codex, Claude, and Gemini parser
events propagate their tool operation IDs. The broker computes a bounded post-edit
content hash for live producer events. The old path/time/line fingerprint
suppression was removed because it dropped legitimate adjacent edits.

Heartbeat corrections are additive full-value rows with a bounded monotonic
revision. The server rejects orphan and gapped revisions and ignores retries at
or below the stored revision. ClickHouse raw and incoming schemas carry the
additive revision column, and all interactive heartbeat/analytics/reprocess reads
select the canonical max-revision winner before counting lines or duration. Legacy
rows with no operation identity receive a query-local row key so independent rows
are not merged by matching time, path, or line shape.

The canonical actor projection keeps `ai_verified`, `ai_inferred`, `human`, and
`unknown` separate. Invalid verified identity is downgraded and scrubbed; an
unknown row is never promoted because a source string or agent label happens to
be present. Automatic VS Code gap flushes do not emit a second editor heartbeat
when the broker-owned edit already consumed the pending observation.

## F2 — runtime diagnostics and multi-device persistence

Diagnostics v2 uses typed nullable measurements. Every value carries availability
and measurement time; unavailable probes are represented as `null`/`unavailable`,
never as zero. The collector probes the broker store, outbound queue, service lock,
transcript discovery, parser cursor, transcript lag, last delivery, and safe error
codes. A malformed or unreadable service lock is unavailable; only a verified
missing/dead PID reports stopped.

`ai doctor`, `doctor ai`, `ai status`, and the extension self-test share the same
collector contract. Device identity is opaque and persisted locally, boot identity
changes on broker restart, and the per-device sequence is durable. The server
stores the latest snapshot per authenticated user/device with a 30-day TTL in
PostgreSQL when configured, or reports `storage: ephemeral` for the compatibility
fallback. In-memory fallback results are sorted newest-first by receipt and then
by deterministic report fields.

The v2 endpoint enforces authenticated read/write scopes, bounded opaque IDs,
bounded adapter/counter payloads, safe metadata-only error codes, and a per-user /
per-device upload limiter. Claimed adapter `Verified` status is downgraded to
`Scaffold` until a server-side certification artifact exists. Consent for adapter
tracking, observer operation, and diagnostics upload is represented independently;
the observer remains observe-only and cannot feed production attribution.

## Verification

The following local gates passed after the final changes:

- `cargo fmt --all -- --check`
- `cargo check --workspace`
- Core diagnostics, revision, and canonical-relation tests
- CLI unit suite: 51 passed after the registry-driven setup wiring
- Server diagnostics, rate-limit, and correction tests
- VS Code extension: 105 tests passed; TypeScript lint passed
- Frontend typecheck and ESLint passed; diagnostics panel test passed
- `git diff --check`

The full frontend Vitest suite still has one unrelated pre-existing auth redirect
failure in `test/auth-screen.test.tsx`; it does not touch the AI diagnostics or
attribution files. Live ClickHouse/PostgreSQL integration, historical
materialized-view rebuild, and real-account adapter certification were not
available in this workspace and remain explicit release gates.
