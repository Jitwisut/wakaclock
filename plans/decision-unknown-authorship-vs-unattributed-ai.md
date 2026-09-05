# ADR — unknown authorship is not Unattributed AI

วันที่: 2026-09-05 · Task: [F0-03](ai-coverage-task-ledger.md) · สถานะ: decision record, ไม่ใช่ implementation

Clarifies decision **D02** in [ai-coverage-execution-plan.md](ai-coverage-execution-plan.md)
§4. Related: [[decision-accuracy-over-coverage]] (why "Unattributed AI" exists as a
UI label at all), [ai-coverage-progress.md](ai-coverage-progress.md) (F0-02, the
reproducers this ADR's truth table builds on).

## 1. The two states this ADR separates

| State | Meaning | `ActorType` | `is_ai()` |
| --- | --- | --- | --- |
| **Unknown authorship** | No reliable positive evidence points to AI *or* human. Absence of AI evidence is not proof of human origin (D06), and absence of human evidence is not proof of AI origin either. | `Unknown` (`wakaclock-core/src/heartbeat.rs:16`, the `#[default]` variant) | `false` |
| **Unattributed AI** | Positive evidence that *an* AI tool made the change exists (a correlated sidecar event, a verified hook/MCP signal, or historical data that explicitly asserted AI involvement) — but the specific tool identity is not known or not disclosed. | `AiVerified` or `AiInferred` with `ai_agent: None` | `true` |

These read identically in casual conversation ("we don't know which AI, or maybe
no AI at all") but they are opposite sides of `is_ai()`, and every layer that
aggregates by AI/human/other must not conflate them. This is not a new state to
add to the enum — the enum already has the right shape (§2) — this ADR exists
because **the wire/legacy path around the enum does not consistently agree with
it** (§4).

## 2. Truth table across layers

| Case | Rust core (`ActorType`) | ClickHouse row (`actor_type` column) | API JSON (`agent` field, from `ai_stats.rs::fetch_agents`) | Frontend UI (`ai-agents-table.tsx`) |
| --- | --- | --- | --- | --- |
| Human typed, no AI evidence | `Human` | `'human'` | `'human'` | Actor: "human", Agent: the literal name is never shown as "human" in the Agent column (row is a `human` actor row) |
| Verified native hook/MCP, named tool | `AiVerified` | `'ai_verified'` | tool name (`coalesce(ai_agent, 'unknown')` — but `ai_agent` is set here) | Agent column shows the real tool name |
| Verified/inferred AI, **no tool name recorded** | `AiVerified` / `AiInferred` | `'ai_verified'` / `'ai_inferred'` | `'unknown'` (from `coalesce(h.ai_agent, 'unknown')`) | **"Unattributed AI"** — `ai-agents-table.tsx` keys off `actor_type === 'ai_inferred'`, never off the string `'unknown'`, specifically so this case renders differently from the next row |
| Genuinely ambiguous — no proof either way | `Unknown` | `'unknown'` | `'unknown'` (same literal string as the row above, by construction of the `multiIf` in `fetch_agents`) | Actor: "unknown"; excluded from the AI aggregation entirely (`ai_lines_added`/`ai_lines_deleted` in `fetch_agents` are `sumIf(..., actor_type IN ('ai_verified','ai_inferred'))`, which a `Unknown` row never matches) |

The two `'unknown'`-string rows in the API JSON are the collision this ADR is
about. `ai-agents-table.tsx` already documents this explicitly in its own
comment (lines 24-27): *"The guard keys off `actor_type`, never the literal
string `'unknown'`: the backend's `fetch_agents` coalesces a NULL agent to
`'unknown'` for both an unnamed inferred row and a genuinely unattributed one,
and those two must read differently."* — confirmed correct as of this ADR
(2026-09-05): the frontend guard is sound, and `fetch_agents`' SQL correctly
keeps `actor_type` as an independent column precisely so a consumer *can* key
off it instead of the ambiguous string. No fix needed at this specific
call site. Any **other** aggregation added later must follow the same rule:
never branch on `agent == 'unknown'`; always branch on `actor_type`.

## 3. No layer implicitly promotes Unknown → AI

Checked directly, not assumed:

- **Rust core**: `ActorType::is_ai()` (`heartbeat.rs:34`) matches only
  `AiVerified | AiInferred`; `Unknown` is excluded by construction — there is no
  code path that widens this match.
- **ClickHouse aggregation**: every `ai_lines_added`/`ai_lines_deleted` sum in
  `ai_stats.rs` and `dashboard_analytics.rs` is gated by
  `actor_type IN ('ai_verified', 'ai_inferred')` (or the equivalent single-value
  check); `actor_type = 'unknown'` rows are summed into a *separate*
  `unattributed_lines_added`/`_deleted` accumulator, never merged into the AI one.
- **Frontend UI**: `ai-agents-table.tsx`'s `isInferred` guard is `actor_type ===
  'ai_inferred'`, not a string match on `'unknown'`; `ai/page.tsx`'s
  `namedAgents` filter excludes both `'Unattributed AI'` and `'human'` by the
  rendered label, not by inferring identity from an unknown string.

This satisfies F0-03's closing criterion (no `unknown → AI` promotion) for every
path audited. It does **not** mean the system is bug-free in the *other*
direction — see §4.

## 4. Confirmed violation: the opposite conflation (AI → Unknown)

`backend/api/src/services/wakatime_import.rs::map_heartbeat` (line ~200) sets:

```rust
actor_type: if is_ai_generated { "unknown" } else { "human" }.to_string(),
actor_confidence: if is_ai_generated { 0.0 } else { 1.0 },
```

while, a few lines above, the *same* row also sets `ai_source:
Some("observer")`, `ai_confidence: Some("inferred")`, and carries real
`ai_lines_added`/`ai_lines_deleted` values whenever `is_ai_generated` (derived
from the WakaTime export's own `category == "AI Coding"` / `ai_line_changes` /
`ai_session` / token fields) is `true`.

This is backwards relative to this ADR's own definition in §1: a WakaTime
export that positively asserted AI involvement is exactly the "Unattributed
AI" case (`AiInferred`, `ai_agent: None`), not "Unknown". As written today:

`is_ai_generated()` (`wakatime_import.rs:294-303`) is `true` on any of four
independent triggers: `category == "AI Coding"`, `ai_line_changes.is_some()`,
`ai_session.is_some()`, or a positive token count. `map_heartbeat` derives
`ai_lines_added`/`ai_lines_deleted` from `ai_line_changes` only
(`to_positive_u32`/`to_negative_u32`, both `None` unless that field is
present and non-zero) and `ai_event_id` from `ai_session` only. So the actual
effect on a given row depends on *which* trigger fired:

- The row's `actor_type` is `'unknown'` in every case, so `is_ai()` is `false`
  for all of them — this part is unconditional and is the core of the finding:
  per §1, a row with positive AI evidence should never read `is_ai() == false`.
- **Only when `ai_line_changes` was present and non-zero** in the source
  export does this row also carry real, non-zero `ai_lines_added`/
  `ai_lines_deleted` — and only then do those values get folded into
  `unattributed_lines_added`/`_deleted` instead of the AI bucket, by the exact
  `sumIf(..., actor_type = 'unknown')` clauses documented safe in §3 (safe
  *because* they assume an `'unknown'` row never carries real AI line
  evidence — this specific row shape breaks that assumption). For the
  `category`-only or token-only triggers, `ai_lines_added`/`_deleted` are
  `None`, `coalesce(..., 0)` makes them `0` in the SQL, and no line count is
  affected — only the row's own `actor_type` label is wrong.
- **Only when `ai_session` was present** (setting `ai_event_id`) or
  `ai_line_changes` was positive (setting `ai_lines_added`/`_deleted`) would
  `has_ai_evidence()` (`heartbeat.rs:138-149`) actually return `true` for this
  row's inputs. Note `ai_source: Some("observer")` (set whenever
  `is_ai_generated`) does **not** trip `has_ai_evidence()`'s `ai_source`
  branch, which only matches `"agent_hook"`/`"mcp"` — so `category`-only or
  token-only rows would *not* be flagged by `resolve_attribution` even if this
  path called it. It doesn't: `wakatime_import.rs` builds a `HeartbeatRow` and
  inserts it directly through `HeartbeatRepository`, never calling
  `resolve_attribution` (`heartbeat.rs:175`) for any row.

**Effect**: every historical WakaTime-imported heartbeat that was positively
marked AI-assisted reads as `actor_type: unknown` (should be `ai_inferred`)
regardless of which signal triggered it. On top of that mislabel, the subset
triggered via `ai_line_changes` also has its AI line counts folded into the
unattributed bucket instead of the AI bucket. Both are undercounts of AI, not
overcounts, but both are concrete instances of the exact confusion D02 was
written to prevent, on imported (not live) data.

**Not fixed here.** F0 is reproduction/decision-recording only (see
[ai-coverage-progress.md](ai-coverage-progress.md)'s own rule: "เขียน code แล้ว
ไม่เท่ากับ validated"). This is recorded as a named finding for F1-07
("Broker/server policy boundary และ compatibility projection ของ legacy
fields") to fix: `wakatime_import.rs::map_heartbeat` should set `actor_type:
"ai_inferred"` (not `"unknown"`) and a non-zero `actor_confidence` when
`is_ai_generated` is true, leaving `ai_agent: None` so it renders as
"Unattributed AI" rather than a guessed tool name.

## 5. Legacy field mapping

| Legacy field | Present on | Correct mapping today | Where enforced |
| --- | --- | --- | --- |
| `is_ai_generated: bool` (heartbeat payload) | `wakaclock-core::heartbeat::Heartbeat`, `model::heartbeat::HeartbeatRow` | Must equal `actor_type.is_ai()` exactly — checked at write time | `heartbeat.rs:738` (`validate()`): `if self.is_ai_generated != self.actor_type.is_ai() { return Err(...) }` |
| `legacy_is_ai_generated: Option<bool>` (attribution input) | `AttributionInput` (client-supplied, older clients) | `Some(true)` requires `explicit_actor_type.is_ai() == true` if both are present; conflicting combinations are rejected | `resolve_attribution()`, `heartbeat.rs:195-206` |
| `is_ai_generated: bool` (WakaTime import, derived from `category`/`ai_line_changes`/`ai_session`/token fields) | `wakatime_import.rs::is_ai_generated()` | **Should** map to `AiInferred` (Unattributed AI) when `true`; **currently maps to `Unknown`** (§4 violation) — this path never calls `validate()` or `resolve_attribution()` | Not enforced today; F1-07 to fix |

## 6. Non-goals of this ADR

- Does not decide the delayed-sidecar or mixed-human+AI-edit reconciliation
  protocol — that is F0-05, deferred per
  [ai-coverage-progress.md](ai-coverage-progress.md).
- Does not change any code. The `wakatime_import.rs` finding in §4 is recorded,
  not fixed, per F0's own scope rule.
- Does not decide whether `AiVerified` with `ai_agent: None` can occur in
  practice today (verified paths generally do carry a tool identity by
  construction of the hook/MCP producers) — if F1 discovers a live case, the
  UI label rule in §2 already covers it identically to the inferred case.
