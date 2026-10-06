# Browser extension test report — 7 October 2026 (Asia/Bangkok)

Baseline: `d82a659` on `codex/browser-extension-v1`. This test run expands the
Chromium integration script to cover refresh rotation, SPA transitions and stopping time.
Host: macOS 27.0.1 (26A434), arm64. Fixture report timestamps are UTC.

## Result

The Chrome implementation works against an isolated local API with a synthetic account.
Production account connection is currently blocked: `api.atoaxis.com` returns NXDOMAIN
from both Google DNS and Cloudflare DNS. Neither browser public client registration nor
real account authorization/ingestion can be verified until the API hostname resolves and
the backend is reachable. This is not a production end-to-end acceptance result.

| Check                             | Result                                | Evidence / scope                                                                                                                               |
| --------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Chrome 154.0.8037.98              | Passed                                | Disposable profile, 15 fixture integration checks                                                                                              |
| Chromium 153.0.8010.12            | Passed                                | Same fixture integration script used by CI                                                                                                     |
| TypeScript / extension unit tests | Passed                                | 47 tests; build and package entrypoints checked                                                                                                |
| Firefox manifest                  | Passed                                | Mozilla Add-ons Linter: 0 errors, 0 notices, 0 warnings                                                                                        |
| Firefox 157.0.1 runtime           | Blocked before extension installation | Official binary + geckodriver 0.37.1 and standalone `about:blank` both exit with `Could not find profile folder` in this execution environment |
| Safari native app / extension     | Compilation passed                    | Latest unsigned Release archive; signed native messaging/focus/idle not verified                                                               |
| Backend server library            | Passed                                | 384 tests, 31 infrastructure tests ignored locally                                                                                             |
| Dashboard                         | Passed                                | Typecheck and 46 related component/panel tests                                                                                                 |
| Edge / Brave                      | Not run                               | Neither browser is installed on this host                                                                                                      |
| Production API / account          | Blocked                               | DNS status 3 (NXDOMAIN) from both independent resolvers                                                                                        |

## GitHub Actions

[Run 37504496865](https://github.com/Jitwisut/wakaclock/actions/runs/37504496865)
targets baseline `d82a659`. Its jobs failed/cancelled before any steps ran. The
Chromium job annotation identifies failed account payments or a spending-limit restriction.
GitHub supplied no execution logs because the jobs were not started. Cross-OS CI results
remain unverified; the account owner must resolve the billing restriction before rerunning.

## Chrome / Chromium fixture assertions

- Device authorization polling and connection; no real account or credentials used.
- Expiring access token refreshes and rotates credentials; API checks the current token.
- Domain/path project rules map the active website to Documentation.
- Sent records contain the hostname and measured intervals, without path, query, fragment,
  title, cookies or page content.
- Navigation and SPA `history.pushState` split project assignment without reloading.
- Pause freezes the local total while navigation continues.
- Excluding a matching domain stops tracking and freezes its total; project rules cannot override it.
- An internal `about:blank` page stops tracking.
- A 503 response retains pending activity; the queue survives closing/reopening the browser.
- Retry delivers saved items; disconnect revokes the fixture grant and clears local state.
- Popup and Settings render and operate; screenshot checked visually.

The fixture verifies the shipped 5-minute AFK default, then uses 24 hours to prevent host
inactivity from interfering with navigation checks. It does **not** certify physical AFK,
screen lock, sleep/wake, private-window timing or direct worker termination. Unit tests
cover timing gaps, privacy/rules, queue capacity, partial acknowledgements and account isolation;
the real OS acceptance matrix remains in [RELEASE-CHECKLIST.md](RELEASE-CHECKLIST.md).

## Production DNS probe

Probe on this run (7 October 2026 Bangkok):

| Hostname          | Google DNS                 | Cloudflare DNS             |
| ----------------- | -------------------------- | -------------------------- |
| `api.atoaxis.com` | Status 3, no answers       | Status 3, no answers       |
| `atoaxis.com`     | Status 0, A record present | Status 0, A record present |

The comparison establishes that the website resolves while the configured API hostname
does not. Queries used TLS-verified HTTPS to `dns.google/resolve` and
`cloudflare-dns.com/dns-query`; no authentication data was sent.

Before a real account test: configure the API DNS/TLS endpoint, deploy the backend with
`029_browser_oauth_clients.sql`, and confirm device authorization, project access and
bulk heartbeat ingestion. Browser release signing/manual checks are still required.

## Reproduce / local evidence

```sh
npm run validate
npm run lint:firefox
ATOAXIS_BROWSER_CHANNEL=chrome npm run test:smoke
npm run test:smoke
```

Detailed fixture results: `dist/smoke-report-chrome.json`,
`dist/smoke-report-chromium.json`; UI images: `dist/screenshots/`.
Safari archive: `dist/packages/AtoAxis Browser.xcarchive`.
Firefox startup diagnostic: `dist/firefox-smoke/driver.log` (temporary test tooling).
These generated local files are ignored by Git; CI uploads its own fixture evidence.

The repository's separate dated core certification fixture failure remains documented
in the release checklist. No claim of an all-workspace clean test run is made here.
