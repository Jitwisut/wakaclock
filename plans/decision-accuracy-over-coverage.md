# ADR: Accuracy over attribution coverage

**Decision date:** 2026-09-04
**Status:** accepted

We will not guess which AI wrote a change. Native hooks, structured MCP events,
and completed transcript tool calls with explicit file-edit evidence are
verified-tier inputs. Filesystem/process correlation is useful for local health
diagnostics, but it is not a production attribution source.

## Why

An incorrect named agent is more misleading than an unattributed AI bucket. The
wire/API contract already has `ai_inferred` and `unknown` compatibility labels,
so removing those values would be a destructive compatibility change with no
accuracy benefit. Keeping them readable while stripping unverified identity gives
old data a safe presentation and lets research continue without leaking guesses.

## Consequences

- `ObserverConfig` can only run disabled or `observe_only`; legacy `infer` is
  parsed and downgraded.
- Client and server enforce the identity boundary independently, protecting
  against old clients.
- Analytics can count AI activity, but named-agent rankings use verified names
  only; otherwise the label is **Unattributed AI**.
- Investment moves to live-certified adapters and honest onboarding/repair
  diagnostics rather than wider heuristics.

This ADR is a rationale record. [`ROADMAP.md`](ROADMAP.md) owns sequencing and
acceptance criteria.
