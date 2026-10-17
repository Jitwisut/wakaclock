# Goal: ปิดงาน AtoAxis Team รุ่นแรก

ตั้ง Goal ในแชตนี้วันที่ 13 ต.ค. 2026 (Asia/Bangkok) สถานะ **active**
ฐาน source ที่ส่งแล้ว: `382c92e0b973369c428da2477424cbbc89bb78ef` บน `codex/heartbeat-capture-release`

## เป้าหมายสุดท้าย

ให้ทีมซอฟต์แวร์ 10–100 คนใช้ GitHub → session/context → owner-confirmed PR link → canonical usage/cost → receipt/report/CSV ได้จาก UI ภายใต้ consent และมีการกู้ข้อมูล ตรวจสุขภาพ ติดตั้ง client และ billing ที่ใช้งานได้จริง ปิดงานได้เมื่อ implementation และหลักฐานที่จำเป็นผ่านครบ ไม่ใช้จำนวน tests หรือการ push source เป็นเกณฑ์พร้อมขาย

จุดส่งมอบ:

1. **พร้อมให้ทีมทดลองใช้:** candidate/build ตรงกัน, flow และ privacy บน staging ผ่าน, client ตาม scope มีหลักฐานจริง และสามารถดำเนินงานทดลองโดยควบคุม rollout ได้
2. **พร้อมเปิดขาย:** commercial flow, Cloud/security/restore/performance, lifecycle/canary/client และผลทดลองลูกค้าผ่านครบ พร้อมราคาที่เจ้าของอนุมัติและการอนุญาตเปิด production/checkout

## Milestones และเกณฑ์ปิด

| Goal | งาน | Definition of done | สถานะเริ่มต้น / หลักฐานที่ขาด |
|---|---|---|---|
| G1 | Candidate และ evidence ledger | Checkout สะอาด, SHA/manifest/runtime ตรงกัน, รายการ implementation/local/external รวมอยู่ใน ledger เดียว | Clean `382c92e`, macOS arm64 VSIX/standalone 2/8 ผ่าน verifier; isolated extracted status/persistent pause ผ่าน; อีก 3 targets/full lifecycle/certification ยัง pending |
| G2 | GitHub/Copilot full flow | App/OAuth/install/repo scopes, backfill 90 วัน + งานเปิด, sync/recovery, mapping/link editing/history, receipt/API/UI/CSV ผ่าน expected ledger จริง; missed events 100 รายการกู้ภายใน 10 นาทีตามเงื่อนไขเดิม | Code/local มีหลักฐาน; GitHub live, บัญชีที่สอง, callback/permission/lifecycle/redelivery ยัง pending |
| G3 | Client และความน่าเชื่อถือ | VSIX/standalone 8 artifacts บน 4 targets จาก SHA เดียว; native smoke; 4 Team tools × 2 OS × 10 user sessions = 80 พร้อมราย metric/inline ledger; login/sleep/wake และ canary 7 วันทำงานที่จบแล้ว | Actual provider/OS/build matrix และ canary ยังไม่ยืนยันครบ; Windows รอเจ้าของ |
| G4 | Product closure | Onboarding ครบ self-service flow, improvement actions พร้อม owner/window, before/after นิยามเดิม + coverage, weekly summary และ transition notifications ใช้ privacy projection เดียวกัน | Checklist/comparison/actions CRUD+history+bound comparison อยู่ใน uncommitted source; local UI/backend/Copilot/retention/restore/account-completion tests ผ่าน; weekly summary API/UI/CSV local scope ผ่านใน source; joint cost local regression ผ่าน; full onboarding/HTTP/browser ยัง pending |
| G5 | Commercial runtime | Stripe Checkout/portal, durable signed webhook/reconciliation, transactional seats, 14-day no-card trial, upgrade/prorate/downgrade/grace และ recovery ผ่าน tests; live config/Price IDs ที่ตรวจแล้ว | มี policy/helpers; runtime integration ต้องพัฒนาต่อ ราคา/Stripe live configuration รอเจ้าของ |
| G6 | Production acceptance | Tenant/privacy/retention review, Cloud restore, performance, support runbook, 3 ทีมทดลองจริง 14 วัน และ release gates ทุกข้อผ่านด้วย build/date/evidence ที่ตรวจได้ | Cloud target และราคาเจ้าของยังไม่แน่ใจ; external gates ยัง pending |

Tool scope ของ Team คือ Codex, Claude Code, Cursor IDE และ Copilot VS Code ตาม surface/metric ที่ตกลงไว้ ไม่ถือว่า adapter registry 14 ตัวผ่านรับรองทั้งหมดเพื่อปิด Team Provider fields ที่ไม่มีหลักฐานยังเป็น unavailable/pending ตามเหตุผลจริง; การลด scope ต้องถามเจ้าของก่อน

## Release gates ที่ต้องมีหลักฐาน

รายชื่ออิง `backend/api/src/services/team_release.rs` ต้องใช้ external evidence ของ gate นั้น ไม่แทนด้วยผล local:

- `heartbeat_canary_7_active_days`
- `login_sleep_wake_lifecycle`
- `tenant_isolation`
- `privacy_retention_review`
- `restore_drill`
- `provider_certification_macos`
- `provider_certification_windows`
- `inline_expected_ledger`
- `staging_performance`
- `github_reconciliation`
- `billing_lifecycle`
- `stripe_live_configuration`
- `three_team_14_day_trial`
- `support_incident_runbook`

Readiness/checkout เปิดได้หลัง implementation, configuration, owner approval และ evidence ครบ ไม่แก้ hardcoded false เป็น true เพื่อให้ gate ดูผ่าน ผลทดสอบ restore ในเครื่องไม่ใช่ Cloud restore; service p95 ไม่ใช่ HTTP concurrent staging p95

## งานที่เดินต่อได้ทันที

1. ตรวจ clean candidate และปรับเอกสาร/manifest สำหรับ candidate โดยรักษาประวัติ evidence รุ่นก่อน
2. Build/packaging preflight และ local fault/privacy/restore/regressions ที่ขาด โดยใช้ข้อมูลแยก
3. ทำ onboarding/improvement/summary และ commercial test-mode interfaces พร้อม fail-closed live configuration
4. เตรียม scripts/runbook/expected ledgers สำหรับ GitHub/Windows/Cloud certification เพื่อรับหลักฐานเมื่อ prerequisites พร้อม

G1/G2 ทำก่อน จากนั้น G3/G4 และ G5 โดยงานอิสระเดินต่อระหว่างรอภายนอก ไม่เปิด environment จริงหรือ billing live จากข้อมูลจำลอง

## งานรอเจ้าของ/ภายนอก

| รายการ | สถานะที่เจ้าของแจ้ง | ขอบเขตขณะรอ |
|---|---|---|
| Cloud staging/production target | 13 ต.ค.: ยังไม่แน่ใจ | ทำโค้ด/config contract/runbook/local tests ต่อ ไม่สร้าง host หรือทรัพยากรเสียเงินเอง |
| ราคาแพ็กเกจ 10/25/50/100 | 13 ต.ค.: ยังไม่แน่ใจ | Checkout ปิด; test fixtures ไม่ใช่ราคาขายจริง |
| GitHub passkey/2FA | ก่อนหน้า: ยังไม่พร้อม | เจ้าของทำ authentication เอง; ไม่ขอ password/code ในแชต |
| Windows PC | เจ้าของจะเปิดเอง; ยังไม่มีหลักฐานครบ | เตรียม build/manifest/collector metadata; ไม่อ้าง native pass จาก cross-compile |
| GitHub ผู้ทดสอบที่สอง | เจ้าของยังหาไม่ได้ | Actual review/access test pending; ไม่สร้างบัญชีหรือใช้ fixture แทน |
| ทีมลูกค้าทดลอง 3 ทีม | ยังไม่มีหลักฐาน | เตรียม acceptance ledger; ไม่นับ monitor/test activity เป็นการใช้งานลูกค้า |

## ข้อกำหนดตลอด Goal

- Metadata-only; source/diff/prompt/response/credential ไม่เข้า storage/logs/outbound ที่ห้ามเก็บ
- Aggregate/individual consent default off, actual contributors ≥5 พร้อม complementary/cross-view suppression; Owner/Admin ข้าม consent ไม่ได้
- Copilot closed Monday–Sunday UTC แยกจาก organization timezone; daily metrics ไม่แจกลง session/PR/token/cost
- Retention 12 เดือนปฏิทิน พร้อม restore deletion/revocation proof; รักษา canonical personal facts
- Duration/timeout/overlap, heartbeat IDs/revisions/timestamps และ queue migration เดิมคงอยู่
- ทำบน `codex/...` และแยกไฟล์ค้างงานอื่น; ไม่ push/merge main หรือ publish stable/Marketplace/production โดยไม่มีอนุญาตเฉพาะครั้ง
- Receiver/backend ก่อน worker/client/UI; flags สำหรับ rollback รักษา accepted data, ledger, queues และ additive migrations
- ใช้ Docker เฉพาะ dependencies ของชุดทดสอบแยก ลด containers และปิดบริการที่เปิดหลังจบโดยเก็บ volumes
- ไม่ขยาย provider permissions หรือสร้างทรัพยากรเสียเงินเอง
- หลักฐานใหม่ต้องมี source/build, OS/architecture/version, cutoff/timezone/scope และเวลาตรวจ ผลไม่ครบคง pending/unconfirmed

## รูปแบบรายงานและการปิด Goal

ทุกชุดส่งมอบรายงาน `รายการ | พัฒนา | local tests | artifact/native | external certification | evidence/build | blocker | งานถัดไป` แยกเสร็จแล้ว/ยังไม่เสร็จ/รอภายนอก/ควรทำต่อ

Goal นี้ยัง active จนเกณฑ์ G1–G6 และ release gates ครบ ห้ามระบุ complete เพราะโค้ด build ผ่านหรือ external prerequisite ยังไม่พร้อม หากเกิดการเปลี่ยน scope ต้องบันทึกข้อตกลงจากเจ้าของ ไม่ลดเกณฑ์เอง

หลักฐานปัจจุบัน: [Copilot Team implementation](copilot-team-reports-implementation-2026-10-13.md), [GitHub runbook](atoaxis-team-github.md), [Team Phase 2](atoaxis-team-phase2.md), [Context/health](context-health-closure-2026-10-12.md), [Adapter closure](adapter-development-closure-2026-10-12.md)

เอกสารเก่าเป็นประวัติของแต่ละ slice; ส่วน Copilot weekly/CSV ที่เคยระบุว่ายังไม่พัฒนาถูก supersede โดย commit `382c92e` ไม่ใช่งานโค้ดที่ต้องทำใหม่ และไม่ทำให้ live/production gates ผ่านโดยอัตโนมัติ

## ความคืบหน้า G1 รอบตั้ง Goal

สร้าง managed checkout สะอาดจาก `382c92e` แล้ว ตรวจ macOS arm64 native runner/toolchain/prerequisite ผ่าน และรัน internal candidate/preflight regressions 7 tests ผ่าน เครื่องทดสอบ 1 target ไม่แทน native smoke ทั้ง 4 targets หรือการรับรอง provider sessions หลักฐาน: `output/team-closure-2026-10-13/latest.json` และ `native-runner-darwin-arm64.json` G1 ยัง in progress และ Goal ยัง active

ความคืบหน้าถัดมา: สร้าง 2 artifacts สำหรับ darwin-arm64 จาก `382c92e`, extension 219 tests และ integrity checks ผ่าน; extracted status/persistent pause ผ่านเท่านั้น. เพิ่ม G4 checklist/closed-week comparison ที่ flag ยังปิด พร้อม source revision และ restore regression ของ backup clock 3/ledger 10/restore 11. รายละเอียดงานเสร็จ/ค้างและผลตรวจที่มีข้อจำกัดอยู่ใน [progress report](atoaxis-team-workflow-progress-2026-10-13.md). Cloud/ราคา owner-pending; G1–G6 ยังไม่ครบและไม่เปิด checkout.

ความคืบหน้า 14 ต.ค. 2026: เพิ่ม G4 weekly summary API/UI/CSV ภายใต้ flag เดิม พร้อม common final projection fence และ full matching action export. Local server 436 tests, UI 20 tests, native PG 3 regressions และ strict Clippy ผ่าน. รายละเอียดใน progress report และ `output/team-closure-2026-10-13/weekly-summary-local.json`. Joint cost ClickHouse/PostgreSQL และ HTTP/browser acceptance ยัง pending; ไม่ปิด G4/full Goal หรือเปลี่ยน production readiness. เจ้าของแจ้ง Cloud/ราคายังไม่แน่ใจ; งานโค้ดและการทดสอบอิสระเดินต่อโดยไม่สร้าง Cloud/live configuration แทนเจ้าของ.

ความคืบหน้าถัดมา 14 ต.ค.: joint cost regression บน PostgreSQL/ClickHouse จริงผ่าน expected ledger และ paused-query correction races. แก้ Team canonical reader เลือก whole latest revision ก่อนเวลา/retention พร้อม RED→GREEN date-key fixture; ingest behavior เดิมยังไม่อนุญาต time/date move. Full HTTP/browser และ staging performance ยังคง pending. ดู `cost-joint-local.json`/`cost-joint-storage.json`; Goal ยัง active.

ความคืบหน้า G5 14 ต.ค.: signed Stripe snapshot receiver, encrypted webhook config, durable metadata inbox และ lease/revision/retry storage interface เพิ่มใน source แล้ว. Native PostgreSQL isolated regression ผ่าน; server 440 passed/40 ignored. ยังไม่ใช่ complete commercial runtime: provider worker/verified binding/entitlement/trial/seats/Checkout/portal และ live configuration ยังต้องทำ. หลักฐาน `stripe-local.json` และ progress report; Goal active และ checkout ปิด.

G5 ต่อเนื่อง 14 ต.ค.: `billing-reconciliation` มี processor ดึง current Stripe subscription แล้ว พร้อม fixed-origin/API-version/account validation และ durable scope cooldown หลัง rate limit/network/auth. Local native PG + HTTP fixture 2 tests และ server lib 442 passed/41 ignored; live provider/full process lifecycle ยัง pending. Verified binding, payment entitlement, trial/seats/prorate/downgrade/grace และ Checkout/portal ยังค้าง ไม่ปิด G5 หรือ Team ทั้งหมดจากผลนี้.

G5 invoice evidence 14 ต.ค.: migration 043 และ worker current invoice/line metadata พร้อม invoice/subscription reread fence และ atomic observation/ACK เพิ่มแล้ว. Server 446 passed/41 ignored และ native PG/HTTP 2 regressions ผ่าน; unknown/partial/credit ไม่ยืนยัน coverage. ยังไม่เปิด entitlement หรือ checkout และไม่ใช่ Stripe actual certification. `stripe-invoice-local.json`/progress report เก็บข้อจำกัดและ source hashes; verified binding/trial/seats/prorate/downgrade/grace/portal และงาน G1–G6 ที่เหลือยังเดินต่อ.

G5 customer provisioning 14 ต.ค.: owner-only operation/status API, durable server operation และ customer receipt worker เพิ่มแล้ว; ID/mode/account proof, permission-change fence, retry/recovery deadline ผ่าน native PG+HTTP 3 regressions และ server 446 passed/42 ignored. Checkout/subscription binding/entitlement/UI incident recovery ยังต้องพัฒนาต่อ. ดู `stripe-customer-local.json`; ไม่เปิดสิทธิ์ paid analytics หรือ checkout จาก customer receipt.

15 ต.ค. ตรวจรวม G5 Customer recovery/UI: lookup-only recovery พร้อม owner confirmation/CAS/audit และ UI scope reset ผ่าน local PG/HTTP + component tests; ไม่ใช้ search missing เป็นคำอนุญาตสร้างซ้ำ. ดู `stripe-recovery-local.json` ซึ่งรักษาเวลาทดสอบ native เดิม 14 ต.ค. ยังไม่มี checkout/subscription entitlement/live certification หรือ candidate ใหม่.

15 ต.ค. เพิ่ม approved catalog validation + fixed-origin Price/Product readback contract; server 450 passed/42 ignored และ Clippy ผ่าน. ยังไม่เชื่อม quote/Checkout/entitlement และไม่มีราคาจริงที่เจ้าของกำหนด. ดู stripe-catalog-local.json; full Goal ยัง active.

15 ต.ค. G5 Owner price quote/API/UI ต่อแล้ว: immutable preview 10 นาทีจาก approved catalog/provider readback, owner/customer/catalog rechecks, same-ID retry และ exact amount display. Native PG/HTTP 4 tests, server 450 passed/43 ignored, UI32, TypeScript/ESLint/Clippy ผ่าน; `stripe-quote-local.json` เก็บ evidence. ไม่มี Checkout/payment/entitlement หรือ live certification จาก preview; ขั้นต่อไป durable Checkout confirmation/subscription binding และ financial retention/restore. Goal ยัง active, checkout/production=false.

15 ต.ค. G5 Checkout foundation: durable purchase intent/lease/receipt และ read-only provider session parser/transport เพิ่มแล้ว. Native PG/HTTP 5 tests, server452/44ignored, strict Clippy ผ่าน. **ยังไม่ wired Checkout create/worker/API/UI** และไม่ให้ entitlement จาก session completion. Evidence `stripe-checkout-intent-local.json`; production/checkout false. ขั้นต่อไป immutable provider create operation, recovery/subscription binding และ seat/payment fence; Goal ยัง active.

15 ต.ค. ต่อ frozen Checkout request/transport/worker: migration048, approved origin/tax contract, stable idempotency/body + POST/GET verification และ one-intent tick หลัง disabled flag. Server454/44ignored, nativePG/HTTP5, strictClippyผ่าน. Full confirmation API/UI, open-session polling/recovery, subscription binding/payment/seats ยัง pending; `stripe-checkout-request-local.json` ระบุข้อจำกัด. ไม่เปลี่ยน checkout/production readiness หรือปิด G5.

15 ต.ค. G5 ต่อ known-session polling + verified subscription identity binding แล้ว: receipt ใหม่ถูกเก็บก่อน subscription request, GET ต่อด้วย ID เดิมหลัง catalog/deadline เปลี่ยน, receipt/binding/reconcile job atomic และตรวจ Owner ซ้ำ. Native PG/HTTP5, server455/44ignored, strictClippy ผ่าน; `stripe-checkout-binding-local.json`. Binding ไม่ใช่ paid entitlement. ยังเหลือ confirmation/redirect API/UI, unknown-session orphan recovery, verified payment/seat transaction, commercial lifecycle, financial restore และ actual staging; checkout/production false, Goal active.

15 ต.ค. G5 เพิ่ม bounded read-only lookup สำหรับ accepted Checkout ที่ไม่มี Session ID หลัง 23 ชั่วโมง พร้อม fresh candidate GET และ parked outcomes สำหรับ missing/ambiguous/page limit. ไม่ POST ใหม่หรือปล่อย reservation จากผลค้นไม่พบ. NativePG/HTTP5, server455/44ignored, strictClippyผ่าน; `stripe-checkout-recovery-local.json`. Owner recovery/reauthorization UI และ payment/seat/full commercial flow ยัง pending; Goal active/production false.

15 ต.ค. G5 Owner Checkout status/recovery API/UI เพิ่มแล้วพร้อม migration049, lookup-only reauthorization/CAS/audit และ Owner-change/read fences โดยไม่แก้ original quote/initiator. NativePG5, server455/44ignored, component17, TS/ESLint/Clippyผ่าน; `stripe-checkout-owner-local.json`. First purchase confirmation/redirect, payment/seats/commercial lifecycle, financial restore และ live staging ยัง pending; Goal active ไม่เปิด checkout/production.

15 ต.ค. G5 ต่อ test-only quote confirmation API/UI → durable intent เดิมแล้ว พร้อม approved policy flag และ additive capability. Live ยังคงปิดจน launch/payment gates ครบ. Server456/44ignored, nativePG5, component23, TS/ESLint/Clippyผ่าน; `stripe-test-checkout-local.json`. ยังเหลือ hosted redirect/return, payment/seats/commercial lifecycle, financial restore และ actual staging. ไม่มี config จริงหรือการเปิดขาย; Goal active.

16 ต.ค. G5 hosted test Checkout destination API/UI เพิ่มแล้ว: fresh provider proof, exact URL/session validation, local Owner/revision recheck และ ephemeral no-referrer link. Server457/44ignored, nativePG5, component29, TS/ESLint/Clippyผ่าน; `stripe-hosted-checkout-local.json`. Full HTTP/browser/return และ Stripe actual ยัง pending; payment/seats/financial lifecycle ยังไม่ครบ. Goal active ไม่เปิด live checkout/production.

### Progress 2026-10-16: G5 invoice assessment

เชื่อม accepted package → current subscription/invoice → atomic assessment → Owner Checkout status/UI แล้ว พร้อม pending/stale/expiry/permission fences. ผล local: server461/44ignored, PG/HTTP5, UI15, TypeScript/ESLint/Clippyผ่าน. Evidence `output/team-closure-2026-10-13/stripe-payment-assessment-local.json`. Invoice settled ไม่เท่ากับ cash payment หรือ paid access; entitlement/seat admission, trial/change/grace/portal และ financial retention/restore ยังเป็นงานพัฒนาที่เหลือ. Sourceยัง uncommitted/noncandidate, production/live checkout=false. Goal G1–G6 ยัง active; ไม่มี external gate ที่ประกาศผ่านจาก fixtures.

### Progress 2026-10-17: G5 seat admission

เพิ่ม shared transactional accepted-package capacity guard สำหรับเพิ่มสมาชิก/รับคำเชิญ และต่อ SCIM/personal restoration. ผ่าน concurrent last-seat/invite rollback tests บน PostgreSQLแยก; server461/44ignoredและClippyผ่าน. Evidence `output/team-closure-2026-10-13/stripe-seat-admission-local.json`. ไม่ใช่ paid entitlement: trial/grace/package change/portal/paid analytics admission ยังเหลือ พร้อม runtime testsที่ระบุใน ledger. Goalยังactiveและproduction=false; sourceยังไม่commit/push.

### Progress 2026-10-17: membership/audit failure recovery

Reproduced audit-write failure leaving committed membership, then fixed add/invite/remove to commit their audit atomically with membership/capacity changes. Fault tests now pass; server461/44ignored, nativePG/HTTP5, strictClippy. Evidence `output/team-closure-2026-10-13/stripe-member-atomic-local.json`. External privacy-ledger mirror remains postcommit and needs separate retry/restore evidence. Paid commercial runtime/external gates remain pending; Goal active, source uncommitted, production=false.
