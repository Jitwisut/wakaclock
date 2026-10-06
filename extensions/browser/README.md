# AtoAxis Activity Tracker — desktop browsers

Focused browsing time with local domain/path-to-project rules. One TypeScript core builds
Chrome/Edge/Brave (Chromium MV3), Firefox MV3 event pages, and Safari macOS Web Extensions.
Safari includes a menu-bar macOS companion. Browsing is a separate measured metric; it
never claims code authorship or changes Coding / AI Active totals.

## Build and install

Requires Node 24 and Python 3.12 for ZIP packaging. From this directory:

```sh
npm ci
npm run validate
npm run lint:firefox
npm run package
```

- Chrome: open `chrome://extensions`, enable Developer mode, Load unpacked `dist/chromium`.
- Edge: open `edge://extensions`, enable Developer mode, Load unpacked `dist/chromium`.
- Brave: open `brave://extensions`, enable Developer mode, Load unpacked `dist/chromium`.
- Firefox: `about:debugging` → This Firefox → Load Temporary Add-on → `dist/firefox/manifest.json`.
  Temporary installation is for development. Production Firefox requires AMO signing.
- Safari: `npm run safari:project`; open `dist/safari-xcode/AtoAxis Browser/AtoAxis Browser.xcodeproj`.
  Select the owner's signing team, provision `group.com.atoaxis.browser` for both targets,
  and run scheme **AtoAxis Browser**. Enable the extension in Safari Settings → Extensions.
  Start the containing app and keep its AtoAxis menu-bar item running. Grant website access
  when enabling tracking. A missing/stale companion pauses tracking.

Safari build/archive (macOS 13+, Xcode with Safari converter):

```sh
xcodebuild -project 'dist/safari-xcode/AtoAxis Browser/AtoAxis Browser.xcodeproj' \
  -scheme 'AtoAxis Browser' -configuration Release \
  -derivedDataPath /tmp/atoaxis-safari-build \
  -archivePath "$PWD/dist/packages/AtoAxis Browser.xcarchive" \
  CODE_SIGNING_ALLOWED=NO archive
```

The unsigned archive verifies compilation; distribution requires the owner's Apple
Developer signing and App Group provisioning. Do not treat it as a signed Store upload.
Native focus, lock, idle and messaging still require a signed sandboxed Safari run.

## First use

1. Open the toolbar Popup and choose Connect account.
2. Approve the displayed device code in AtoAxis. Tracking remains paused until enabled.
3. In Settings, load your projects, add a hostname and optional path prefix, then Save.
4. Enable tracking after reading the collection disclosure. Default idle timeout is 5 minutes.
5. Popup shows current domain/project, this installation's local daily total (including pending
   activity), and delivery status. Dashboard shows the server's cross-browser union.

Pause closes the observed interval. Exclude current website blocks its hostname and
subdomains. Imports contain settings only and always pause tracking. Disconnect deletes
local credentials, unsent activity, project cache and local totals and attempts server
revocation; offline revocation can be completed from the account's connected apps screen.
Reconnect starts a new grant namespace and asks before deleting records from an expired
session. Settings are not synced across browsers or profiles.

## Privacy and timing contract

- Only HTTP(S) foreground tabs in focused normal windows are eligible.
- URLs are read only after consent and login. Paths are used in memory to select a project;
  configured path-prefix rules are stored locally. Activity records contain only the hostname.
- No title, HTML, page contents, input values, keys, cookies, clipboard, query or fragment is sent.
- Private windows, browser/internal/file pages, local hosts and private IP networks are excluded.
  Sensitive hostname heuristics are not a complete list of sensitive websites: configure exclusions.
- Exclusions override rules. Exact hostname rules optionally include subdomains. The longest
  segment-bounded path wins; exact-host rules win ties. Duplicate rules are rejected.
- Checkpoints run every minute and on tab/navigation/focus/idle changes. A transaction stores
  the closed segment, local total and next checkpoint together. Browser suspension retains it;
  full startup resets it. Gaps >90 seconds, backwards clocks and detectable wall/monotonic
  discontinuities are not inferred. Native evidence failure discards the unverified interval.
- Firefox exposes active/idle but not a distinct locked state. If focus loss is not reported,
  lock may stop at the configured AFK deadline. Sleep/lock behavior must pass the real OS matrix.
- Safari samples native status every 5 seconds; the extension checks it on events/checkpoints.
  A status older than 15 seconds is unusable. OS lock notifications supplement focus/session
  notifications; their delivery must be verified under the owner's signed sandbox.
- Tokens stay in extension-origin IndexedDB, not browser sync or an OS keychain. No content
  scripts, remote executable scripts or external message entrypoints are present.
- Queue is capped at 10,000 records, pauses on capacity, and retains failures for retry. Stable
  heartbeat/segment IDs prevent retries from adding time twice. Success requires per-item ACKs.

## Backend deployment

Deploy migration `029_browser_oauth_clients.sql` and browser-source backend support before
connecting release packages. Public clients: `atoaxis_browser_chromium`,
`atoaxis_browser_firefox`, `atoaxis_browser_safari`; scopes: `write_logged_time read_projects`.
No client secret is shipped. The existing bulk heartbeat endpoint and device approval page
are reused. Client-mapped browser projects win over server domain rules during ingest and
reprocess; project IDs are still resolved by the server.

Dashboard API schema 4 adds `browsing: { total_seconds, domains, projects, daily,
calculation_version: "browser_foreground_v1" }`. Every breakdown has `{name, seconds}`.
Measured browser intervals (max 90 seconds each) are canonicalized without idle bridging;
all dimensions sum to their clipped overlap-free union. Legacy editor and AI timing is
covered by regression tests. Frontend tolerates old deployments lacking `browsing`.

Default server: `https://api.atoaxis.com`. An isolated development API can be selected with
`ATOAXIS_BROWSER_API_URL=http://127.0.0.1:PORT npm run build`; packaged host permissions
follow that origin. The build rejects non-HTTPS non-loopback API URLs. Never submit a fixture build.

For a real local backend and dashboard, set the backend's `SERVER_PORT=8080` and
`ATOAXIS_APP_URL=http://localhost:3000`, and run the frontend with
`NEXT_PUBLIC_WAKACLOCK_API_URL=http://localhost:8080`. Build a separate local extension:

```sh
ATOAXIS_BROWSER_API_URL=http://localhost:8080 \
ATOAXIS_BROWSER_APP_URL=http://localhost:3000 \
ATOAXIS_BROWSER_BUILD_DIR=dist/local npm run build
```

Load `dist/local/chromium` through Chrome's **Load unpacked**, connect and approve the
device code while signed into the local dashboard, then explicitly enable tracking.
The local build's **Open dashboard** opens localhost; release builds use atoaxis.com.
Test on a public website: localhost and private networks are always excluded.

## Validation and release evidence

`npm run test:smoke` launches a temporary Chromium profile and a localhost fixture API;
it tests login, project mapping, domain-only outbound records, offline replay across a browser restart, pause,
disconnect and both UIs. It never accesses a real account. It records actual browser
version/platform in `dist/smoke-report-chromium.json`, with screenshots in `dist/screenshots`.
Set `ATOAXIS_BROWSER_CHANNEL=chrome` or `msedge` to test an installed browser with
CDP unpacked installation in a temporary profile. Brave requires its own installed binary
and manual release checks. See [release checklist](RELEASE-CHECKLIST.md) and
[Store materials](STORE.md). The [latest test report](TEST-REPORT.md) distinguishes fixture
success from production readiness. CI builds on Windows/macOS/Linux and archives Safari on macOS;
a green build does not replace real focus/AFK/lock tests on each browser/OS.
The fixture verifies the default 5-minute setting, then uses 24 hours so a headless run
does not depend on physical input to the host computer. Real AFK is a separate acceptance check.

`npm run package` writes production Chromium/Firefox ZIPs and an AMO source ZIP with
SHA-256 checksums under `dist/packages`. ZIP timestamps are fixed for reproducible output.
The repository's main CI also runs backend unit/service and isolated database integration tests.
