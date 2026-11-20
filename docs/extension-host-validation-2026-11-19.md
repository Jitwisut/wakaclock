# Extension host validation on macOS arm64, 19 November 2026

Reference browser/client source on main: `6606ce62`, plus the candidate fixes in this checkout. Results apply to the specific hosts and test paths below.

| Host | Verified path | Remaining acceptance work |
| --- | --- | --- |
| Chrome 157.0.8103.79 | Loaded the production-configured ZIP in a fresh profile. The separate loopback build passed all 15 browser smoke assertions, including refresh, pause, exclusions, restart and offline replay. | Real account → API receipt → dashboard, physical idle/lock/sleep and abrupt service worker termination. |
| Edge 156.0.4314.58 | Official Microsoft build, fresh profile, loopback fixture. All 15 browser checks passed including reconnect after restart. | Physical OS timing, production delivery and store distribution. |
| Brave 1.98.63 (Chromium 156.0.8078.80) | Official Brave build, fresh profile, same 15 checks passed independently. | Physical OS timing, production delivery and store distribution. |
| Blender 5.2.3 LTS | Six Python tests. Real Blender installed and enabled the addon ZIP, saved two synthetic files, reopened and saved the first, then disabled the addon. The recording CLI saw three modeling writes. Fixed startup when Blender restricts access to file metadata during registration. | Real CLI persistence and server/dashboard readback under a dedicated account, upgrade and supported-version matrix. |
| Zed 1.26.2 | Native launcher unit tests and WASM build. Isolated Zed host loaded the extension and issued initialize, configuration and didOpen for a synthetic Python file to an LSP recorder. | Shipped language server download on clean install, actual save/change delivery through it, offline restart, receipt and dashboard. |
| Safari / Xcode | Added support for the converter's project.xcproj format alongside project.pbxproj. Release archive built unsigned. Inspected distinct app/extension IDs and generated App Group build settings. | Signed app and extension, real native messaging, foreground/lock/idle checks and distribution. Requires Apple Developer team with the App Group provisioned. |

Edge and Brave initially exited during direct executable startup before any fixture traffic. Opening each verified app once with macOS LaunchServices using a disposable profile allowed the test runner to start the browser. Edge also required bringing the extension options page to the foreground for the login interaction. The production hostname api.atoaxis.com could not be resolved by the test host. The current remote production account and duration path remains unverified.

Repeat browser checks using the instructions in [the browser README](../extensions/browser/README.md); the Blender host fixture is documented in [the addon README](../extensions/blender/README.md). The [Chrome package report](../extensions/browser/TEST-REPORT.md) provides the tested ZIP checksum.
