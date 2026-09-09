# Public UI implementation — 2026-09-09

The public frontend now has an interactive Activity Studio hero (EN/TH) with Human, AI, Mixed and Unknown sample attribution, finite edit/packet/bar animations and replay. It never sends telemetry events. Reduced motion keeps all states usable. The hero lead is shorter and the dashboard preview appears immediately after the hero. Pricing gets a short value transition; the editor strip has a pause/play control; account forms have password visibility controls.

Confirmed UI fixes: weekly preview bar height, tablet navigation wrapping, landscape menu internal scrolling, sticky-header anchor offset and keyboard focus on the Early Access select. The original low-contrast config panel caption was removed with the replaced hero panel.

## Early Access persistence

`POST /api/v1/early-access` accepts email, interest (`solo`/`teams`), locale (`en`/`th`), source_page, explicit consent, and an optional honeypot. Input body is bounded to 4 KiB. The endpoint uses the existing peer-IP auth limiter (5 requests/minute with a burst of 5); deployment proxies must be considered when configuring the API because it does not trust forwarded IP headers. Invalid addresses, absent consent and invalid selections are rejected. New and existing emails return the same accepted response only after PostgreSQL succeeds. No email is sent and no user account is created.

Migration `004_early_access.sql` is included in API startup migrations. It adds `early_access_signups` with a normalized email primary key and consent version/time. Duplicate submissions do not add rows or overwrite existing preferences. PostgreSQL absence or failure returns 503. The frontend posts to the existing `NEXT_PUBLIC_WAKACLOCK_API_URL`, checks the accepted response before redirecting, times out after 15 seconds, guards concurrent submissions and preserves entered data for retry.

Deployment requires the updated backend, POSTGRES_URL, the migration and the frontend's existing API URL / backend CORS origins. This work does not deploy these changes or migrate a remote database. Automatic email delivery, consent-confirmation emails and signup administration are outside this change.

## Verification

- Frontend full Vitest run: 54 files / 270 tests passed before the final editor pause control; focused checks after the final changes passed 30/30.
- TypeScript check passed; changed component ESLint fixes applied.
- Production Webpack build passed with NEXT_PUBLIC_APP_URL=https://atoaxis.com. The initial local build lacked the required production public URL.
- Backend email-validation unit test passed; server compiled and started with PostgreSQL migration.
- Actual local browser submission reached success; direct duplicate retry was accepted. PostgreSQL readback returned one row with consent_version=early-access-v1 for the synthetic `.invalid` email.
- Invalid email, absent consent and invalid interest returned 400; the sixth rapid request hit the existing 429 limiter. Honeypot was checked separately after quota refill and returned 400.
- Chrome at 320/390/1024/1440px: no document overflow; all seven bars have positive height. Verified mode switching, reduced motion, password reveal, anchor clearance, visible select focus and 844×390 menu scrolling.
- Browser regression specifications passed 3/3 in Chrome and are retained in `frontend/app/e2e/marketing-studio.spec.ts`. Safari/Firefox and remote production delivery have not been certified in this run.

The broader account EN/TH localization and additional timeline/integration interactions from the design audit remain future enhancements. Existing source/reference content is retained; no unsupported agent capability is promoted by the illustrative demo.
