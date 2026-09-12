# Presence office

The API applies `007_presence_office.sql` during startup after the existing foundation migrations. Existing tables and presence data are retained. PostgreSQL stores chat, sprites, sprints and linked rooms; Redis remains the live roster and position source. Office changes refresh every two seconds while the page is visible. Chat history uses a server UUID cursor, with scoped request IDs to make retries idempotent. Personal summary totals query all matching participation windows, independent of the history page limit.

## Local media

1. Start existing PostgreSQL, Redis and ClickHouse development infrastructure.
2. Run `docker compose -f deployment/presence/compose.yaml up -d`.
3. Set API and frontend variables from `.env.example` in their respective local environment files. Keep the LiveKit API secret on the backend only.
4. Restart the API and Next development server. Open the application on `localhost`, join a room and walk into a pod. Enable microphone/camera explicitly. A second account in the same pod can receive the tracks. Audio volume falls with avatar distance inside the pod; room boundaries remain server-enforced. Device permission errors are shown without changing buttons to a false “on” state.

The supplied compose configuration is only for browsers on this machine. For testing from a phone, configure a reachable media host with trusted HTTPS/WSS and the correct advertised host IP. Do not expose the development keys.

## Production

Use a separately deployed LiveKit service or an existing LiveKit Cloud project. Set `LIVEKIT_URL` to its browser-facing WSS URL, `LIVEKIT_INTERNAL_URL` to its server API origin, and the matching key/secret. Set `NEXT_PUBLIC_LIVEKIT_URL` to the same browser-facing URL and rebuild Next so CSP permits it. Production needs trusted TLS, RTC UDP/TCP reachability and TURN/TLS for restrictive networks. Follow [LiveKit deployment guidance](https://docs.livekit.io/transport/self-hosting/deployment/) for certificates, public IP discovery and TURN.

The API issues 30-second join tokens restricted to the current pod. A server worker checks media participants against current roster, pod and inherited access every five seconds and removes unauthorized participants. On self-hosted LiveKit, an old token can be retried until its 30-second expiry; the worker removes unauthorized re-entries on subsequent checks. Token expiry alone does not disconnect an existing participant. Monitor `presence media permission reconciliation failed` logs; loss of connectivity to the media admin API prevents forced disconnection until it recovers. No recording is enabled.

Floors and meeting chambers are linked rooms with independent rosters, chat, pods and media. The main ad-hoc room owner or team lead creates spaces. They last up to 24 hours, bounded by the main room expiry, and inherit the main room authorization; a revoked/expired parent also denies child access. Team leads can manage office names and spaces; ordinary team members cannot. Invite creation remains restricted to the main ad-hoc room owner. Sprints are shared goals with server start/end times and per-member completion, not XP or a separate reward economy.

## Acceptance checks

Use two accounts plus a third unauthorized account:
- Create/join a room via invite; walk and reconnect; verify the original history still works.
- Send chat in both directions, retry a request ID, load older messages, and verify cross-room access is rejected.
- Save a sprite, refresh, and verify the second account sees it. Trigger a reaction and verify both clients see it only briefly.
- Create a sprint, join with both accounts, mark completion, end it, refresh and verify the result.
- Create a floor/meeting room, enter/return, verify roster and messages are isolated. End the parent and verify child access is denied.
- Enable devices, stop screen sharing through the browser, leave a pod and revoke access. Verify published tracks stop and server reconciliation ejects stale participants.
- Deny microphone permission; disconnect the network; test multiple tabs and a phone over HTTPS. Verify UI status is truthful and reconnect does not silently activate devices.

## Automated verification

- `cd frontend/app && npx vitest run test/office-chat.test.tsx test/office-media.test.tsx test/office-room-switch.test.tsx`
- With local LiveKit running: `cd frontend/app && PRESENCE_TEST_CHROME_EXECUTABLE="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" node scripts/test-presence-media.cjs`. Omit the executable variable when Playwright Chromium is installed. This uses fake audio/video devices and verifies publication, mute propagation, pod isolation and server removal against LiveKit **v1.13.6**.
- Set `PRESENCE_TEST_POSTGRES_URL` to an isolated database and run `cargo test -p wakaclock-server --bin wakaclock-server --manifest-path backend/api/Cargo.toml office_persistence_and_inherited_authorization -- --ignored`.
- Set `CLICKHOUSE_TEST_URL` to an isolated ClickHouse instance and run `cargo test -p wakaclock-server --bin wakaclock-server --manifest-path backend/api/Cargo.toml configured_database_supports_presence_history_and_summary_queries -- --ignored`.

Do not point the integration test variables at production. Actual camera hardware, browser screen-selection dialogs, and phone connectivity over production TLS still require the manual acceptance checks above.
