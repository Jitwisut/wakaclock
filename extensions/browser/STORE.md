# Store submission materials — AtoAxis Activity Tracker 0.1.0

## Listing copy

Name: **AtoAxis Activity Tracker**

Short description: **Measure focused browsing time and connect websites to your AtoAxis projects.**

Full description:

Track the websites you actively use and see where your browsing time goes. Connect your
AtoAxis account, choose project rules by domain or path, and enable tracking when ready.
AtoAxis measures focused foreground tabs, stops after your configured inactivity period,
and excludes private windows and local networks. Pause tracking or exclude the current
website from the toolbar. Your Popup shows today's time and pending delivery; your AtoAxis
dashboard shows measured website and project totals across connected browsers.

Only website domains, project names, timestamps and measured intervals are sent to AtoAxis.
Paths are matched locally. Page titles, page content, forms, cookies and browsing history
are not collected. Activity waits locally when offline and is delivered with retry deduplication.
Safari on macOS includes a menu-bar companion for system idle/focus status.

Desktop browsers only. Safari requires macOS 13 or later. Firefox may stop at the inactivity
threshold when screen lock does not produce a focus-loss event. AtoAxis account required.

## Collection disclosure (shown before Enable tracking)

Enabling tracking sends domains, project names and measured time to your AtoAxis account.
Website paths are matched locally. Titles, page content and private windows are never collected.

## Permission explanations

| Permission                        | Purpose                                                                                      |
| --------------------------------- | -------------------------------------------------------------------------------------------- |
| tabs                              | Read only the active tab URL to derive a hostname and match a local project rule             |
| idle (Chromium/Firefox)           | Stop after the user's inactivity threshold; no key content is observed                       |
| alarms                            | Checkpoint and retry persisted work after background suspension                              |
| storage                           | Restrict access to extension-owned storage; credentials/queue are in origin-scoped IndexedDB |
| API host                          | OAuth and activity delivery to the configured AtoAxis API only                               |
| nativeMessaging (Safari)          | Query the extension's bundled macOS companion for presence status                            |
| Optional website origins (Safari) | User-granted access to active tab metadata for requested sites                               |

No history, cookies, scripting, content scripts, downloads, clipboard or debugger permission.
No remote executable code or embedded client secrets.

## Store fields and assets

- Chrome Web Store: use `dist/packages/atoaxis-chromium-0.1.0.zip`. Describe browsing
  activity collection as necessary for the displayed website/project time-tracking feature.
- Edge Add-ons: submit the same production Chromium ZIP as a separate listing.
- Brave: distribute through the Chrome Web Store listing; still test Brave explicitly.
- Firefox AMO: production Firefox ZIP plus source ZIP and build instructions below.
  Declares required `authenticationInfo` and `browsingActivity`. Hostname/time activity is
  account-bound data, not anonymous data. Select desktop support only.
- Safari/Mac App Store: archive from the generated project, sign both targets with the
  owner's team and App Group. Supply account/consent instructions for review. Run native
  sandbox checks before submission; an unsigned archive is compilation evidence only.
- Icons: PNGs at 16/32/48/128/512/1024 in each build's `icons/` directory.
- Screenshots: integration test emits real Popup/Settings renders in `dist/screenshots/`.
  They use clearly synthetic fixture data. Select and size images to each store's current
  requirements; do not label synthetic data as a real user's activity.
- Public website/support: use the project's owned AtoAxis website and support channel.
  Verify the current published privacy page contains the browser policy below before
  filling the store's privacy-policy URL. Developer contact comes from the owner's account.

## Browser privacy-policy text for the published policy

AtoAxis Activity Tracker collects website hostnames, selected project names, activity
timestamps and measured foreground browsing intervals only after you connect your account
and enable tracking. This information is sent to your AtoAxis account to provide your
website/project time reports. Browser family identifies the emitting integration. We do
not collect webpage content, page titles, form values, cookies, query strings, URL fragments,
clipboard content or private-window activity. Path prefixes you configure are stored in
that browser profile and matched locally; they are not sent with activity.

OAuth access/refresh tokens are stored in the extension's local storage namespace.
Unsent domain/time records remain locally until accepted, disconnected or the extension is
removed, up to 10,000 entries. At capacity the extension pauses further collection rather
than overwriting saved activity. Local daily totals retain up to 35 recorded days. Settings
and project rules are local and can be exported/imported without credentials or activity.
Safari's companion shares only idle seconds, focus/session state and a status timestamp
with its own extension. It does not record the contents of input events.

You can pause, exclude websites, disconnect, remove the extension, or manage connected
apps and stored account data through AtoAxis. Server retention/deletion follows the
published AtoAxis account privacy policy. If offline disconnect cannot revoke a grant,
revoke the connection from AtoAxis once online. Browser activity is used to provide your
requested reports, not to serve personalized advertisements or sell browsing data.

## Reproducible source package

Submit `dist/packages/atoaxis-browser-source-0.1.0.zip`, generated from an explicit source
allowlist with package-lock.json and without node_modules, dist or credentials.
Extract and build from this directory with Node 24:
`npm ci && npm run validate && npm run package`. esbuild bundles locally installed
TypeScript/polyfill resources, with no remote script loading. Validate the release ZIP
using Mozilla Add-ons Linter. Store submission, signing and publication are owner actions.
