# Shared browser core

`tracker.ts` validates consent/settings, excludes private/local domains, matches local
project rules and constructs the sole outbound heartbeat shape. URLs, titles and page
content never cross that boundary. Tracking is off until explicitly enabled. Default
AFK is 5 minutes. Domain rules can include subdomains; path rules use segment boundaries.

`src/tracking.ts` closes measured foreground checkpoints and splits local-day totals.
`src/database.ts` commits queue/checkpoint/totals in one IndexedDB transaction.
`src/api.ts` owns device authorization and single-flight rotating refresh tokens.
`src/delivery.ts` acknowledges individual bulk results and retains records on failures.
Browser-specific idle/focus/native APIs stay in `src/background.ts`; manifests and
Safari native sources are separate adapters. Tests use a fake clock/IndexedDB/transport.
