# Extension host validation on macOS arm64, 19–22 November 2026

Reference browser/client source on main: `6606ce62`, plus the candidate fixes in this checkout. Results apply to the specific hosts and test paths below.

| Host | Verified path | Remaining acceptance work |
| --- | --- | --- |
| Chrome 157.0.8103.79 | Loaded the production-configured ZIP in a fresh profile. On 20 November the loopback build passed 16 checks, including explicit service worker termination, recovery after browser restart and exact retry payload comparison. On 22 November it passed against a local API and dashboard; see below. | Release ZIP with a real account on production, physical idle/lock/sleep and distribution. |
| Edge 156.0.4314.58 | Official Microsoft build, fresh profile, loopback fixture. All 15 browser checks passed including reconnect after restart. | Physical OS timing, production delivery and store distribution. |
| Brave 1.98.63 (Chromium 156.0.8078.80) | Official Brave build, fresh profile, same 15 checks passed independently. | Physical OS timing, production delivery and store distribution. |
| Blender 5.2.3 LTS | Six Python tests. Real Blender installed and enabled the addon ZIP, saved two synthetic files, reopened and saved the first, then disabled the addon. The recording CLI saw three modeling writes. Fixed startup when Blender restricts access to file metadata during registration. | Single installed-addon-to-server run, dashboard readback, upgrade and supported-version matrix. See separate backend probe below. |
| Zed 1.26.2 | Native launcher unit tests and WASM build. Isolated Zed host loaded the extension and issued initialize, configuration and didOpen for a synthetic Python file to an LSP recorder. | Single clean-install-to-server run using shipped language server download, offline restart and dashboard. See separate backend probe below. |
| Firefox 160.0.1 | Temporary installation, extension event page, device login, project assignment, hostname-only payload, pause, offline retry, disconnect, popup and settings passed against the local fixture. A fresh profile required the Firefox development manifest to omit the loopback port from its host match pattern. Requests still target the selected port. | AMO signing, OS timing and production readback. |
| Figma | Compiled plugin entrypoint tested with Figma-shaped fetch responses. Typecheck/build and 22 tests passed. Covered durable capture, lost acknowledgement, concurrent documents, account isolation, device flow, retry timing and readback of pending records after restart. | Real Figma development plugin ID, account, install, edit and production readback. |
| Safari / Xcode | Added support for the converter's project.xcproj format alongside project.pbxproj. Release archive built unsigned. Inspected distinct app/extension IDs and generated App Group build settings. | Signed app and extension, real native messaging, foreground/lock/idle checks and distribution. Requires Apple Developer team with the App Group provisioned. |

Edge and Brave initially exited during direct executable startup before any fixture traffic. Opening each verified app once with macOS LaunchServices using a disposable profile allowed the test runner to start the browser. Edge also required bringing the extension options page to the foreground for the login interaction. The production hostname api.atoaxis.com could not be resolved by the test host. The current remote production account and duration path remains unverified.

Repeat browser checks using the instructions in [the browser README](../extensions/browser/README.md); the Blender host fixture is documented in [the addon README](../extensions/blender/README.md). The [Chrome package report](../extensions/browser/TEST-REPORT.md) provides the tested ZIP checksum.

## Local server readback

A separate isolated run exercised the available CLI, language server and backend binaries with a synthetic account. The Blender CLI invocation used the addon's actual argument builder. The language server received synthetic editor messages for a Rust file. Authenticated reads of heartbeats, durations and summaries all returned HTTP 200. The three heartbeats were one Blender modeling write, one Zed coding open and one Zed coding write. The durations response contained two blocks totaling 2.924 seconds. This run did not exercise a dashboard UI, the complete installed-host-to-server path or a before/after duration comparison.

Test CLI SHA-256: `41ee27f6551128519ec07f868a3d696be20972480e2e4f5c87a1ea6f3ef4f283`. The probe used existing binaries; reproducibility against a newly built release remains a separate check.

## Chrome to local API and dashboard, 22 November

Extension, backend and frontend source match main `9aa0b11b`. Google Chrome 157.0.8103.79 ran headless with a fresh profile and the loopback build. It talked to a newly built API on empty ClickHouse and PostgreSQL containers through a recording proxy, using a synthetic account. All 19 checks passed.

- Device approval, token exchange and the project list used the real API.
- Server browsing total 76.114 s, union of unique accepted segments 76.114 s, script wall clock 76.0 s. The Documentation project was 61.099 s and unmapped time was 15.015 s. The dashboard's Focused browsing panel showed 1m, 1m and 15s from the same response, with no API errors.
- A pause recorded nothing. The 300 s of synthetic coding time did not change.
- Pending activity survived an unreachable API, service worker termination and a browser restart. Replayed payloads were byte-identical.
- When the API accepted a batch but the response was lost, the resend left the total unchanged. 20 sends produced 12 stored rows with 12 unique IDs.
- Payloads contained no path, query, fragment or title.

The run used fulfilled pages instead of real sites, a 24-hour AFK limit and one mapped project. It does not cover the release ZIP, a headed window, physical idle/lock/sleep, production or a baseline/candidate duration comparison.

The Figma queue and payload builder from the same source were also run in Node with in-memory storage against the API. A lost response, reopen and three blind resends left five events at 240 s and five stored rows. This did not run inside Figma.

Test server SHA-256: `16db1fd866064843791cabd9907112721183dabcf607cd79d7b2955b02475d60` (dev profile).
