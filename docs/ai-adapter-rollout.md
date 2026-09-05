# Universal AI adapter rollout

This document is the operational runbook for Phases 6–9 of `planplugin.md`.
Adapters are metadata-only producers. A provider name (for example DeepSeek)
never proves that a file was edited; the host client and a successful file
mutation remain the attribution evidence.

## Release order

1. Deploy the additive backend contract and validation.
2. Ship the CLI, broker, canonical fingerprint and producer contract.
3. Run `wakaclock ai status --json` and `wakaclock doctor ai --json` on a clean
   machine; repair setup before enabling an adapter.
4. Install one adapter in shadow/canary mode and compare native events with the
   transcript or filesystem baseline. Shadow events do not change production
   totals until dedup is confirmed.
5. Enable the verified Codex and Claude paths, then opt-in Kilo and Kimi only
   after live certification. DeepSeek is enabled as provider metadata under the
   host client that supplied the file evidence.
6. Promote an adapter only when its metadata-only artifact under
   `certifications/ai-adapters/<client>/` is `verified` and the CI verifier passes.

The deployment order is backend → CLI/broker → setup/doctor → canary adapters →
frontend health view. A producer must not send a new field before the backend
accepts it. Additive migrations are safe for old clients and do not rewrite old
rows.

## Kill switch

Disable one or more adapters without stopping ordinary heartbeats or deleting a
local queue:

```bash
WAKACLOCK_DISABLED_AI_ADAPTERS=kilo-code,kimi-code-cli wakaclock ai status --json
```

Values are comma-separated client IDs or their supported aliases. The CLI and
doctor report `enabled=false` and `diagnostic_code=disabled_by_policy`; the
dashboard maps that to a distinct disabled/needs-trust state. The broker remains
running and queued events retain their original identity. Remove an ID and run
the status/doctor command again to resume capture. This is intentionally a
client-level switch, so disabling `kilo-code` does not disable a different host
client that happens to use the DeepSeek provider.

For an emergency rollback, first set the switch, then uninstall only the
managed adapter hooks:

```bash
WAKACLOCK_DISABLED_AI_ADAPTERS=codex wakaclock ai uninstall codex
```

Uninstall preserves user-owned config and the broker queue. Re-enable the
adapter only after the previous package is pinned or rolled back and
`wakaclock doctor ai --json` shows no stale hook or schema diagnostic.

## Evidence and certification policy

- `verified` means a real client → producer → broker → backend run was inspected;
  fixtures alone are never enough.
- `scaffold` means implementation and automated tests exist but no executable
  was available for a live run.
- `unverified` means a manifest exists without a proven integration point.
- Certification artifacts contain IDs, versions, counters, timestamps, timezone,
  SHA and scenario IDs only. They must not contain paths, users, prompts,
  source, patches, commands, tokens or arbitrary payloads.
- Artifacts expire after 30 days and should be regenerated when a client major
  version, plugin contract or fingerprint version changes.

Validate the checked-in artifacts with:

```bash
python3 scripts/verify_ai_certification.py certifications/ai-adapters
```

When a live run is available, create an artifact from explicit metadata (never
from a raw transcript export):

```bash
python3 scripts/certify_ai_adapter.py \
  --client codex --provider openai --model gpt-5.6-sol \
  --status verified --live-e2e \
  --scenario native-single-file --scenario backend-row-inspection \
  --captured 2 --correlated 2 --canonical 2 --delivered 2 \
  --output certifications/ai-adapters/codex/$(date -u +%F).json
```

Do not replace a `scaffold`/`unverified` artifact with synthetic counts. Record
the blocker and leave the effective registry status unchanged until the live
matrix is run.

## Monitoring and rollback signals

Track separately:

- captured versus delivered events;
- canonical activities versus duplicate events;
- retry/dead-letter depth and transcript lag;
- validation rejection rates by contract version; and
- `total_seconds`, daily totals, Human and Unattributed counters against the
  pre-rollout baseline.

A duplicate spike, a new validation rejection, or a mismatch in canonical row
counts triggers the kill switch for that adapter. Preserve the local queue,
collect only diagnostic codes/counters, and use `ai status` plus `doctor ai` to
identify whether capture, correlation, delivery or backend validation failed.
