# Receipt/runtime development progress — 2026-10-03

This is a development checkpoint, not release certification. Observation has not started.

## Changes verified in this continuation

- Removed invented zero durations from the Analytics source summary. Missing verified/inferred AI durations display `Unavailable`; measured zero still displays `0s`. The regression failed before the fix.
- Fixed calendar-day parsing in the shared analytics range picker, Session timeline and Heartbeat pulse monitor. A date-only string now represents local midnight instead of UTC midnight. Regression tests reproduced a one-day backwards shift in `America/Los_Angeles` before the fix.
- Kept the range preset control controlled when a custom range is selected.
- Verified that changing a Receipt list date range discards the previous pagination cursor, refetches projects and does not retain sessions from the previous range.
- Expanded tests for real calendar selection, heartbeat composition, chat send readback deduplication, import shape validation/UTF-8 chunk limits, authentication pending states, navigation, marketing metadata, attribution identity, interval unions, Insights sorting/retry and pointer cancellation/isolation.

Earlier uncommitted Receipt/runtime/gate changes remain in the working tree. This continuation does not promote their historical runtime evidence to the current source.

## Latest checks

| Check | Result | Evidence/limits |
| --- | --- | --- |
| Frontend tests | Passed | 100 files, 806 tests in the full coverage invocation |
| Frontend coverage gate | **Failed** | Statements 99.15% (4215/4251), branches 95.26% (3424/3594), functions 100% (1432/1432), lines 99.65% (3791/3804) |
| Typecheck | Passed | `npm run typecheck` |
| Strict lint | Passed | `npm run lint:strict` |
| Date controls — Los Angeles | Passed | 13 tests across range picker, duration timeline and heartbeat pulse monitor |
| Date controls — Bangkok | Passed | Same 13 tests with `TZ=Asia/Bangkok` |
| Python validation tools | Passed | `python3 -m unittest discover -s scripts/work-sessions/tests`: 36 tests |
| Diff whitespace | Passed | `git diff --check` |
| Current build/native/production-browser certification | Not run | Current source is not a frozen, validated manifest |

The first full coverage attempt while lint/typecheck were also running timed out in the Heartbeat pagination test. A subsequent standalone coverage invocation passed every test. No timeout or threshold was increased, and no test was excluded. The coverage gate remains failed for the percentages above.

Private development artifacts (ignored by Git):

- `.local/receipt-validation/frontend-coverage-current.log`
- `.local/receipt-validation/frontend-coverage-gaps-current.json` — remaining gaps across 58 files; line numbers describe this checkpoint.
- `.local/receipt-validation/range-picker-regression.log` and `duration-day-regression.log` — failures captured before the date fix.

## Readiness

`observation.py check-ready` returned `ready=false`, `window_started=false`:

- `readiness_evidence_unavailable`
- `codex:daily_auth_unavailable`
- `claude-code:daily_auth_unavailable`
- `daily_profile_or_account_unavailable`
- `codex:daily_rehearsal_incomplete`
- `claude-code:daily_rehearsal_incomplete`
- `lab_preflight_failed`

These results do not diagnose the main user profiles; the checks use isolated daily lab profiles. No credential diagnostics, model calls, push or deploy were performed in this continuation.

## Next development work

1. Close the remaining 170 branch and 13 line coverage gaps using the current inventory. Inspect whether each gap represents an untested user behavior, defensive handling or demonstrably unused code. Preserve the 100% thresholds.
2. Run checks after that group, then build the production frontend and validate Receipt evidence pagination above 25 items on desktop/mobile against the isolated API.
3. Complete live editor/hook/runtime scenarios with independent ground truth. Transcript-import success alone does not satisfy live-capture gates.
4. Resolve isolated agent authentication using normal login, then freeze local commits/build and run both native campaigns against the same final manifest.
5. Finish both daily rehearsals and require every gate before `start-window`. Historical Codex results cannot certify changed source.

Do not use this checkpoint or its development coverage artifacts as a passed gate report.
