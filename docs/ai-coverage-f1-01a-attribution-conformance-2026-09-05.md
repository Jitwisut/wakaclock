# F1-01a attribution decision conformance — 2026-09-05

Status: **implemented as a contract slice; production server wiring remains
in progress**.

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

Both consumers match every resolved and rejected case. The mirror accepts the
registry decision as input, so it cannot silently grow a second list of agent
names.

## Known server gap

The API helper
`backend/api/src/handlers/v1/heartbeats.rs::payload_to_heartbeat` still
reconstructs `actor_type` with a separate compatibility mapping after calling
`Heartbeat::enforce_attribution_policy`; it does not call
`resolve_attribution`. Therefore this slice does **not** claim full
client/server conformance yet. In particular, the server can turn a payload
with no positive evidence into `human`, and its legacy inferred/unknown path
does not preserve the same canonical decision shape as the fixture.

The next server step is to make payload normalization call the shared resolver,
return stable rejection responses for contradictory input, and add the same
fixture to the server handler tests. That work is intentionally left separate
from this contract slice so old-client compatibility can be reviewed without
changing the editor fallback or revision/projection behavior at the same time.

## Validation

- `cargo test -p wakaclock-core --test attribution_conformance` — 1 passed.
- `npm run lint` in `extensions/vscode` — passed.
- `npm test -- test/attributionDecision.test.ts` — 1 passed.

This slice does not change the three expected F0 editor failures, unmatched
fallback behavior, pending observations, exact reconciliation, or canonical
revision storage.
