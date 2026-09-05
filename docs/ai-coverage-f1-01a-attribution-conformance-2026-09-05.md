# F1-01a attribution decision conformance — 2026-09-05

Status: **implemented for heartbeat ingestion and the v1 history read
projection; analytics/revision projections remain open**.

F1-01 needs one deterministic answer for the same evidence shape before F1-02
can split editor changes and F1-07 can migrate legacy server fields. The shared
fixture at
[`fixtures/ai-attribution/decision-v1.json`](../fixtures/ai-attribution/decision-v1.json)
is the first versioned contract. It records the expected actor and confidence,
or a rejection, without depending on Rust error strings.

## Contract covered by the fixture

The cases pin these boundaries:

- no evidence is `unknown` with confidence `0`;
- positive editor evidence is `human` with confidence `1`;
- ambiguous line ownership stays `unknown`;
- a known agent with verified hook, MCP, or transcript evidence is
  `ai_verified`;
- MCP verified confidence is `0.95`, other verified sources are `1.0`;
- a `verified` label from an untrusted source such as editor telemetry remains
  `unknown`;
- an unknown or unverified agent name cannot become a named actor;
- a legacy AI boolean or event ID alone does not name an agent;
- explicit legacy `ai_inferred` remains readable;
- invalid confidence and contradictory AI/Human evidence are rejected; and
- explicit `unknown` is valid when ambiguous editor counters are present.

`known_agent_id` is an adapter-provided registry result. The pure decision does
not duplicate the registry or treat a free-form `ai_agent` string as proof.

## Consumers

`wakaclock-core::heartbeat::resolve_attribution` now has a fixture-driven
integration test at
[`backend/api/crates/wakaclock-core/tests/attribution_conformance.rs`](../backend/api/crates/wakaclock-core/tests/attribution_conformance.rs).
The VS Code side has a pure mirror in
[`extensions/vscode/src/attributionDecision.ts`](../extensions/vscode/src/attributionDecision.ts)
and runs the same fixture in
[`extensions/vscode/test/attributionDecision.test.ts`](../extensions/vscode/test/attributionDecision.test.ts).
The v1 heartbeat ingestion adapter now parses legacy actor aliases, accepts the
canonical `actor_confidence` field (with a conflict check against the older
`attribution_confidence` field), calls the same resolver, and exercises every
fixture case in
`backend/api/src/handlers/v1/heartbeats.rs`.

All three ingestion consumers match every resolved and rejected case. The mirror accepts the
registry decision as input, so it cannot silently grow a second list of agent
names.

## Read projection covered by this slice

The v1 GET history serializer now treats the stored `actor_type` as canonical.
It derives `is_ai_generated` and the additive `actor_confidence` field from the
same projected actor, preserves explicit `human`/`unknown`/`ai_inferred` rows,
and only exposes an agent identity when the known-agent, source, and verified
confidence checks all pass. A malformed or spoofed `ai_verified` row downgrades
to `ai_inferred` only when it still has explicit AI evidence; an explicit
`unknown` row is never promoted by stale legacy fields. The projection has
table-driven tests and a JSON serialization check.

The AI stats service now applies the same rule for its effective actor SQL: an
invalid `ai_verified` row can be downgraded, while legacy evidence cannot
promote a canonical `unknown` row. Revision winner selection and the remaining
analytics surfaces still need their own F1 follow-up, so this slice does not
claim full read-side conformance.

The adapter intentionally keeps legacy inferred/unknown identity scrubbing and
maps the canonical result back to the invariant trio
`actor_type`/`actor_confidence`/`is_ai_generated`. Contradictory input is a
stable HTTP 400 before project resolution; editor fallback, pending
observations, and revision/projection behavior remain separate F1 work.

## Validation

- `cargo test -p wakaclock-core --test attribution_conformance` — 1 passed.
- `cargo test -p wakaclock-server handlers::v1::heartbeats::tests` — 10 passed,
  including all shared fixture cases, projection cases, and `Heartbeat::validate()`
  invariants.
- `cargo test -p wakaclock-server` — 175 passed, 7 ignored (database-backed
  without ClickHouse/PostgreSQL configuration).
- `npm run lint` in `extensions/vscode` — passed.
- `npm test -- test/attributionDecision.test.ts` — 1 passed.

This slice does not change the three expected F0 editor failures, unmatched
fallback behavior, pending observations, exact reconciliation, or canonical
revision storage.
