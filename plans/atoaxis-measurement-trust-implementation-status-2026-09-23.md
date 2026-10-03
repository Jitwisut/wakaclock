# Measurement Trust implementation status — 2026-09-25

This is the implementation record for the six-month AtoAxis plan. `validated_local`
means code and local tests passed; it does not mean live certification, release, or
proof of superiority to WakaTime.

| Deliverable | State | Evidence and remaining gate |
| --- | --- | --- |
| Time and AI runtime certification | blocked | Existing correctness plan and certification runners remain the source of truth. A fresh seven-day comparison, independent activity ground truth, and separate Codex CLI/Desktop and Claude Code runtime readback have not been run for this build. |
| Measurement Trust read API and page | validated_local, beta | Canonical summary evidence, project-scoped timeline filtering, AI attribution denominators, metadata-only operation receipts with keyset pagination, calculation version, and explicit unavailable delivery state. The page exposes the server capability matrix and keeps totals independent from the loaded evidence pages. |
| Consent-based team analytics | validated_local, beta | Aggregate and individual sharing are separate and default off. Active membership and sharing are checked for each read; consent changes are audited. PostgreSQL/ClickHouse integration and concurrent revocation tests still require live services. |
| Resumable WakaTime import | validated_local, beta | Chunks, progress, reason counts, canonical all-time totals before/after, and resume use PostgreSQL; exact heartbeat content yields stable IDs across changed chunk boundaries. The browser strips unrelated export fields, runs a bounded legacy-overlap preflight, and requires explicit confirmation for ambiguous v1 history. A live large-export reconciliation remains open. Concurrent activity can also affect the displayed net total. |
| Editor migration check | validated_local, beta | Setup instructions reuse a WakaTime plugin and verify today's heartbeat and project through authenticated APIs. Editor-specific plugin/version certification remains open. |
| Launch and capability publication | implementation complete, beta | Runtime availability is derived from service dependencies and the Trust Center now displays feature status, availability, storage mode, and line metric versions from `/api/v2/capabilities`. New features remain `beta` until the verified build has passed the live release gates. User trials for solo AI users, teams, and other editors have not happened. |

## Local checks

- `cargo check -p wakaclock-server --offline`
- `cargo test -p wakaclock-server --offline --lib`
- `npm run typecheck` in `frontend/app`
- `npx vitest run test/wakatime-import-chunks.test.ts` in `frontend/app`
- Targeted ESLint for changed frontend files

## Development phase closeout

The implementation work for the Trust Center scope is complete for this build. The
remaining work is evidence collection and release validation; it must not be represented
as production-ready by changing the feature matrix alone.

- The web page shows project selection, range/timezone-consistent totals, queue snapshot
  freshness, paginated operation receipts, repair preview/history, and runtime capability
  status.
- The CLI and desktop client read the local queue while offline and report unavailable
  when the queue cannot be opened; queued seconds stay outside confirmed dashboard totals.
- The API and UI preserve `null`/unknown values and keep metadata-only evidence free of
  source paths, prompts, responses, and diffs.

## Release gates

1. Start PostgreSQL and ClickHouse in an isolated test environment, apply migrations
   022 and 023, then exercise account isolation, consent withdrawal, large import,
   changed chunk partitioning, and retry after an interrupted database commit.
2. Run the existing live certification and duration audit tools for each exact client
   and runtime tuple. Keep the external WakaTime comparison separate from the
   independently observed activity reference. Require seven real days for the time
   campaign and record build digests.
3. Run the three user pilots and attach observed task-completion results and limits
   to the release artifact. Promote a capability above beta only for the verified
   build and scope.

Until those gates pass, do not claim the product measures time more accurately than
WakaTime or that an uncertified editor identifies AI/model authorship.
