# Release evidence and remaining gates

Date/time in reports is UTC; user-facing release dates use Asia/Bangkok.
Never replace a pending cell with Passed based solely on another browser's engine.
See [the 7 October test report](TEST-REPORT.md) for the current production DNS blocker
and the expanded Chrome integration assertions.

## Local evidence

- Extension TypeScript build and 47 unit/reliability tests passed: run `npm run validate`.
- Mozilla Add-ons Linter: run `npm run lint:firefox` (warnings are errors).
- Chromium 153.0.8010.12 on macOS arm64: fixture integration passed (login, mapping,
  sanitized payload, foreground navigation, offline retry across a full browser restart,
  pause, disconnect and UI). Direct worker termination remains a manual check.
  Exact current report: `dist/smoke-report-chromium.json`.
- Google Chrome 154.0.8037.98 on macOS arm64: isolated profile fixture integration passed;
  `dist/smoke-report-chrome.json` records the exact result. Real OS idle/lock/sleep remains pending.
- Expanded fixture checks include access-token rotation, SPA project switching, frozen
  totals during Pause/exclusion and internal page exclusion.
- Firefox 157.0.1: runtime attempt blocked at browser startup (`Could not find profile folder`),
  including a standalone run without the extension. This does not certify Firefox runtime support.
- Production API hostname `api.atoaxis.com`: NXDOMAIN on Google and Cloudflare DNS in this run.
- GitHub CI jobs did not start due to an account billing/spending-limit restriction;
  see the linked run and annotation in TEST-REPORT.md. Cross-OS results remain pending.
- Headless fixtures verify the default 5-minute AFK setting, then use a 24-hour deadline
  to isolate navigation/delivery checks from physical input on the host computer.
- Safari Xcode 27: unsigned archive compilation passed. Regenerate/archive after native changes.
- Dashboard: 46 related tests passed; the new Browsing component has 100% targeted coverage.
- Backend: server library 384 tests passed, 31 infrastructure tests ignored locally.
  Includes browser payload/project precedence, measured union, overlap, clipping and local midnight.
- Core heartbeat tests: 34 passed. Full core baseline has the unrelated dated-fixture failure below.
- Release/source ZIP contents/checksums verified; source rebuild produces identical browser
  bundles with the same locked dependencies. Safari archive bundles match the production build.

## Real browser / OS acceptance matrix

| Browser | macOS                                                          | Windows      | Linux        |
| ------- | -------------------------------------------------------------- | ------------ | ------------ |
| Chrome  | Fixture integration report + manual OS idle/lock/sleep pending | Pending      | Pending      |
| Edge    | Pending                                                        | Pending      | Pending      |
| Brave   | Pending                                                        | Pending      | Pending      |
| Firefox | Manifest validated; real installation/timing pending           | Pending      | Pending      |
| Safari  | Native sandbox and real timing pending                         | Not targeted | Not targeted |

Record browser version, OS version, architecture, timestamp and observed elapsed time
for every result. CI OS builds only validate packaging/unit tests, not the whole real matrix.

For each target:

- Install cleanly; connect and approve code; refresh token; revoke/disconnect.
- No tracking before consent or login; reauthorization warning explains local queue deletion.
- Active tab/foreground reading counts; switching apps, tabs, windows and Pause stop/segment it.
- Domain/subdomain/SPA path rules work; exclusions override rules; private windows and
  file/internal/localhost/private IP pages produce no activity.
- Leave system untouched for 5 minutes; verify AFK cutoff within one checkpoint (60 sec).
- Lock, sleep/wake (including <90 sec sleep), close/restart browser and stop background worker.
  No absence is bridged. Firefox lock limitation must match its disclosed behavior.
- Safari: signed companion App Group communication, focus, idle, lock, sleep and stale/unavailable
  companion all checked. OS distributed lock notification delivery is a release gate.
- Offline → online retains records, repeats stable IDs and counts once. 429 Retry-After,
  5xx, partial ACK, expired grant and full queue retain existing records correctly.
- Changing account/endpoint never replays another grant's records. Inspect outbound requests:
  no title, full URL, query, fragment, form, cookie or page content.
- Compare an external stopwatch with Popup local total and server union; overlapping device
  observations count once server-side. Midnight/timezone boundaries clip correctly.
- Keyboard-only UI, visible errors, import validation and disconnect data-loss confirmation.

## Store gates

- Production API build, deployed OAuth migration and browser timing backend.
- Published privacy page matches STORE.md; owner contact/support URLs verified.
- Production ZIP checksums and source ZIP retained; use built PNG icons.
- Review screenshots for each store's size/format requirements; fixture data identified.
- AMO signing, Edge/Chrome developer registrations, Apple team/App Group and signed archive.
- Native sandbox and all supported browser/OS manual checks above passed before claiming
  universal support or submitting a production release.

## Regression baseline

An unrelated existing core test, `ai::certification::tests::historical_records_never_promote`,
uses `Utc::now()` against a fixture expiring 2026-10-05. It reports Expired rather than
Historical after that date. This browser change does not alter certification behavior.
Record this failure separately from browser heartbeat/timeline regression results.
