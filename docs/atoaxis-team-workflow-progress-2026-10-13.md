# Team closure — G1/G4 implementation progress

วันที่ตรวจล่าสุด: 14 ต.ค. 2026 (Asia/Bangkok); branch `codex/heartbeat-capture-release`; base `382c92e0b973369c428da2477424cbbc89bb78ef`.
Goal ยัง **active**; ไม่ได้ commit/push การเปลี่ยน G4 รอบนี้ และยังไม่เปิด production/checkout.

## งานที่ทำแล้ว

| รายการ | พัฒนา | Local evidence | Native/external | งานถัดไป |
|---|---|---|---|---|
| Clean candidate | source `382c92e` และ manifest ตรงกัน | extension 219 tests, lint/compile, artifact verifier ผ่าน | macOS arm64 VSIX + standalone 2/8 artifacts; extracted status/persistent pause ผ่าน | Actions อีก 3 targets และ lifecycle smoke ครบ |
| Onboarding checklist | อ่าน consent/health/GitHub ตามสิทธิ์; ไม่เปิด consent ให้เอง | UI regression ผ่าน | full self-service flow ยัง pending | ทดสอบ onboarding ผ่าน UI ตั้งแต่สร้างองค์กรถึง receipt |
| Closed weekly comparison | cost ตาม organization timezone, Copilot UTC; nullable/coverage/pricing และ descriptive delta | pure tests 3; Copilot service comparison และ current proofs บน PostgreSQL ผ่าน | cost joint ClickHouse/PostgreSQL regression ผ่านใน fixture แยก; live ยัง pending | fault injection ที่ canonical correction เกิดระหว่างการอ่าน |
| Cache/privacy boundary | ถอนสิทธิ์/สลับองค์กร/โหลดใหม่ล้มเหลวปิดผลเก่า; Copilot ปิด config แล้วไม่เสนอรายงาน | targeted workflow/Copilot/Trust 16 tests ผ่าน; typecheck/ESLint ผ่าน | browser acceptance pending | full account-switch/export UI acceptance |
| Operational source revision | additive migration 038; PR merge/link/scope/mapping advance operational clock แยกจาก privacy generation | migration รันซ้ำ, no-op/rollback regression ผ่าน | rollout ยังปิด flag | cross-organization allocation/concurrent correction integration |
| Restore operational heads | นำ independent dispositions/revisions กลับมาก่อน mutation; ขัดแย้งแล้ว rollback | actual dump → instance ใหม่: backup 3/ledger 10/restored 11, export/guard ผ่าน; facts คงอยู่และ sharing ปิด | Cloud restore pending | ใช้ ledger สดก่อนเปิด Cloud reads |
| Improvement actions | CRUD/owner/weeks/status/revision/history, paginated API/UI และ bound comparison เพิ่มใน source | UI actions/workflow 13 tests, native CAS/scope/retry/retention/restore/account-completion และ Copilot bound comparison ผ่าน รวม final missing-actor mapping | HTTP/browser acceptance pending | Full onboarding และ weekly summary HTTP/browser acceptance |

| Weekly summary API/UI/CSV | ประกอบ admitted metrics เดิม, แยก Copilot UTC / cost org timezone และ current action metadata; flag ปิด | pure summary 3, UI summary 7, native filtered pages/full CSV 36 actions/current fence ผ่าน | joint cost ClickHouse/PostgreSQL regression ผ่าน; HTTP/browser acceptance pending | ตรวจกระแส cost correction กับ canonical จริงและ full UI acceptance |

หลักฐาน: `output/team-closure-2026-10-13/latest.json`, `candidate/`, `cost-clock-local.json`, `restore-cost-clock.json`.
Candidate `382c92e` ไม่ได้รวม G4 source ที่ยังไม่ commit. แพ็กเกจเป็น **internal unsigned**; ไม่ใช่ stable หรือ certified.
Native checks ใช้ temporary HOME; ยังไม่ได้รับรอง install/resume/upgrade/rollback/uninstall หรือ extension-host จริง.

## หลักการ comparison

- ใช้สองรายงานสัปดาห์ที่ privacy projection อนุญาตแล้ว; ไม่เก็บยอดดิบเป็น improvement-action history.
- ห้ามเทียบคนละ family/scope/timezone/definition/unit/generation; zero baseline ไม่มี percent change; unknown ไม่เป็น zero.
- Cost proof ครอบคลุม canonical cumulative usage และ merged links ของทั้งสองช่วง ไม่ให้ followup ที่ withheld ข้าม baseline correction.
- PostgreSQL source revision ตรวจคร่อม canonical query; independent ledger head ต้องตรงก่อนอ่าน. Source-only edits ไม่เพิ่ม privacy generation ของทุกสัปดาห์เอง.
- Disposition เดิมระหว่าง restore ต้องเหมือนกันทั้ง hash/reason/time; ไม่ overwrite conflict. Hydrate revision ก่อนปิด scope เพื่อไม่ใช้ ordinal เก่าซ้ำ.
- API `GET /api/v2/organizations/:id/reports/comparison` เป็น `private, no-store`; validate source/access อีกครั้งก่อนส่ง.
- Feature flag `ATOAXIS_TEAM_WORKFLOW_ENABLED=1` default off. Deploy backend/migration 038 ก่อน UI/flag; rollback ปิด flag โดยรักษา markers/migrations/accepted data.

## ผลตรวจและข้อจำกัด

Backend server testsล่าสุด: 436 passed, 38 ignored (ignored ไม่ถือว่าผ่าน); strict Clippy all-targets ผ่าน รวม final missing-actor fixture. Native PostgreSQL action/Copilot/privacy registry regressions 3 ชุดผ่านบน source ล่าสุด เป็นการตรวจเพิ่มเติมแยกจากชุดนั้น. TypeScript และ ESLint ของ action sources ผ่าน. Diff whitespace check ของไฟล์ task ผ่าน; ทั้ง tree มีไฟล์งานอื่นซึ่งมี trailing whitespace ไม่แก้หรือรวมไฟล์นั้นในงานนี้.
Copilot fixture 100 คน/90 วัน/9,000 facts บน PostgreSQL ใหม่ได้ p95 1.544711 วินาที (20 service samples รวม JSON/CSV/final fence).
นี่ไม่ใช่ HTTP concurrent staging performance หรือ benchmark ของ cost comparison.
รอบ reused fixture ที่ p95 2.622917 วินาทีและ SQL attempt ที่ผิดถูกเก็บใน logs; ไม่ลบประวัติหรือผ่อนเกณฑ์ 2 วินาที.
ไม่มี Docker ที่เปิดในชุดนี้; native database instances เปิดครั้งละหนึ่งและปิดใน finally. ไม่แก้ personal heartbeat/usage/duration หรือฐานจริง.

## ยังไม่เสร็จและควรทำต่อ

1. **G4:** improvement action CRUD/UI/history/bound comparison และ local proof requirement tests ผ่านครบ slice นี้. Weekly summary API/UI/CSV เพิ่มใน source แล้วและ local scope ผ่าน; full onboarding/HTTP/browser acceptance ยังต้องทำ; joint cost local regression ผ่านแล้ว. Checklist/comparison/actions ไม่ได้ปิด G4 ทั้งหมด.
2. **G1/G3:** clean SHA ใหม่หลัง source review, Actions 4 targets/8 artifacts, complete native lifecycle และ actual provider/OS sessions.
3. **G2:** GitHub actual staging flow/recovery/lifecycle และบัญชีที่สอง; cost service fault regression ผ่านในเครื่อง แต่ full HTTP/browser/staging acceptance ยัง pending.
4. **G5:** Stripe commercial runtime/reconciliation/seats/trial/prorate/downgrade/grace. Checkout ปิดต่อจนราคา/configuration และ gates ครบ.
5. **G6:** Cloud target/security/restore/performance, support และ 3 ทีมทดลองจริง 14 วัน. Canary 7 active completed days ยัง unconfirmed.

รอเจ้าของ: Cloud target และราคาแพ็กเกจยังไม่แน่ใจ, GitHub passkey/2FA, Windows PC, ผู้ทดสอบ GitHub คนที่สอง และทีมทดลองจริง.
งานเหล่านี้ไม่ถูกแทนด้วย fixture และไม่เปลี่ยน Team เป็น production-ready.

## Action closure — source ที่เพิ่มต่อ

Migration 039 เพิ่ม actions/history; 040 เพิ่ม account deletion checkpoint และ minimal proof requirements. API กลุ่ม `/improvement-actions` รองรับ list/create/update/delete/history/comparison. Owner/Admin จัดการตามองค์กร และ lead จัดการเฉพาะทีมที่รับผิดชอบ; owner ที่ได้รับ assignment ต้องเป็นสมาชิกใน scope ปัจจุบัน. Read/write ใช้ auth ปัจจุบันและ final generation/revision fence; write scope ใช้ `write_logged_time`, read ใช้ `read_org_dashboards`.

Title เป็น metadata ที่ผู้ใช้พิมพ์สำหรับงานปรับปรุง ไม่ใช่ captured prompt/source; ไม่มี raw usage numbers ใน action/history. เปรียบเทียบอ่านสอง admitted weekly reports ณ เวลาร้องขอ พร้อม fence ของ action revision และ scope. การกำหนด owner ไม่เปลี่ยน aggregate/individual consent.

การลบเป็น absorbing ต่อ UUID. Restore นำ exact disposition กลับมาก่อน mutation; missing row มี barrier โดยไม่สร้างอดีตขึ้นมา และ history ปิดตาม current barrier. Participant proof เก็บเฉพาะ account/org/action UUID กับ hash/time เพื่อให้ deletion requirement ไม่หายแม้ backup ก่อน create หรือ cleanup ลบ body/history. ไม่ใช้ marker เหล่านี้เป็น analytics cohort หรือบอก capture completeness.

Account deletion เก็บ requirement ก่อน soft tombstone, final checkpoint OR กับข้อกำหนดเดิม และแยก PostgreSQL purge จาก successful completion. หลัง DB commit แต่ ledger export ล้มเหลว งานยัง running; completion retry ใช้ checkpoint แม้ user row หายแล้ว. Native regression ของ runtime helper และลำดับ request → cleanup → final worker ผ่านแล้ว. Marker เฉพาะ account/org/action UUID ผูกกับ independent ledger เพื่อคง requirement หลัง cleanup หรือ restore ก่อน create; ไม่มี title/body/history ใน marker.

Deploy migrations/backend และ account-delete worker ใหม่ก่อนเปิด workflow/UI. Rollback ปิด workflow flag โดยรักษา ledger, checkpoints และ additive migrations; worker เก่าห้ามรับงานที่ต้องใช้ completion proof รุ่นใหม่. ยังไม่ได้ติดตั้งจริงหรือเปลี่ยนบริการผู้ใช้.

## Weekly summary closure — 14 ต.ค. 2026

เพิ่ม `GET /api/v2/organizations/:id/reports/weekly-summary` และ `/export` ภายใต้ `ATOAXIS_TEAM_WORKFLOW_ENABLED=1` (default off). เลือกหนึ่งสัปดาห์ที่จบแล้ว: cost ใช้ organization timezone ส่วน Copilot Monday–Sunday UTC. ทั้งสองนำค่าที่ privacy projection เดิมอนุญาตแล้วมาแสดง ไม่คำนวณ cohort หรือลัด suppression ใหม่. ค่าเป็น decimal string/null; withheld/unavailable ไม่เป็นศูนย์. ทุก cell แสดง coverage/provenance/freshness/calculation/provider/pricing version เท่าที่มีหลักฐาน; รายการ pricing ที่ขาดแสดง unconfirmed.

Actions เป็น metadata ปัจจุบัน ณ เวลาอ่าน แยกจากตัวเลขของสัปดาห์ ไม่อ้างเป็นสถานะ task ในอดีต. SQL กรอง family/ช่วงสัปดาห์ก่อน pagination. API แบ่งหน้า 25; CSV รวมทุกหน้าที่ตรงเงื่อนไขภายใต้ proof เดียวกัน จำกัดงาน 10,000 รายการแล้วคืน error ชัดเจนถ้าเกิน ไม่ตัดเงียบ. Export ไม่รับ cursor. เปลี่ยน action/access/source ระหว่างสร้างหรือก่อนส่งผลให้ยกเลิกและโหลดใหม่. CSV ป้องกัน formula และไม่ serialize private fence/proof.

UI ซ่อนผลเดิมเมื่อบัญชี/องค์กร/scope/provider readiness เปลี่ยนหรือโหลดใหม่ล้มเหลว. Pending CSV ถูก abort เมื่อ query/page/readiness/data เปลี่ยน รวม account/token เดิมที่อ่านหน้าใหม่แล้วได้ 403/409. Failed export ซ่อนผลเดิมและให้ Reload. ไม่สร้างอันดับบุคคลหรือข้อสรุปเชิงสาเหตุ.

ผลล่าสุด: server lib 436 passed / 0 failed / 38 ignored; UI actions/workflow/summary 20 passed; TypeScript, changed-source ESLint, strict workspace all-target Clippy ผ่าน. Native PostgreSQL 3 regressions ผ่าน: exportครบ36matchingactionsหลังรายการไม่ตรง30รายการ, action correction/consent/owner withdrawal ปิดผลเก่า, privacy restore/account proof tests เดิมผ่าน. นี่เป็น provider metadata จำลอง ไม่ใช่ live certification หรือ actual cost CH/PG joint fault acceptance. รายงาน: `output/team-closure-2026-10-13/weekly-summary-local.json` รวม source hashes และ logs.

เก็บ build-cache failure และ fixture-ordering failure รอบแรกไว้ใน logs; แยก target build และย้ายการถอนสมาชิกให้ไม่เปลี่ยน consent ที่ original regression ต้องใช้ ไม่ผ่อน assertion เดิม. Native instance ทดสอบปิดแล้ว (ไม่มี postmaster.pid); ไม่เปิด Docker. Current G4 source ยังไม่ commit/push และไม่รวมใน candidate `382c92e`.

งานถัดไป: joint cost canonical correction/fault/concurrency + full HTTP/browser onboarding/report/export; จากนั้นตรึง SHA ใหม่สำหรับ packages และเดิน G5 test-mode commercial runtime. G1–G6 ยัง active; Cloud/ราคาและ external prerequisites คง pending. ไม่มี production/checkout เปิดจากผลรอบนี้.

## Joint canonical cost regression — 14 ต.ค. 2026

เพิ่ม `repository/team_cost_tests.rs` และ `scripts/team-cost-local-check.py`. ใช้ native PostgreSQL 16.15 (Homebrew) และ ClickHouse 24.10.2.80 แบบ tmpfs เพียงหนึ่ง container ไม่มีข้อมูลจริง. Proxy fixture ส่ง GET/POST ตาม client จริงและหยุดเฉพาะ canonical query ในจุดที่ต้องการ เพื่อเปลี่ยน PG metadata ก่อนอ่านหรือเปลี่ยน canonical revision หลังจับ response แล้ว. ไม่มีการเก็บ raw payload ของผู้ใช้หรือใช้ credentials จริง.

Ledger อิสระ 5 ผู้ร่วมข้อมูล: baseline 500 / followup 1,000 micro-USD. Comparison, weekly summary และ CSV อ่านยอดตรง; correction หลังสร้างผลทำให้ final gate ปฏิเสธ; สัปดาห์ที่เผยแพร่แล้วถูก invalidated และไม่ออกยอดแก้ไขซ้ำ. PG operational revision เปลี่ยนระหว่าง canonical query และ canonical revision เปลี่ยนหลังจับ response ทำให้คำขอล้มเพื่อโหลดใหม่.

พบและแก้ Team reader: `FINAL` เดิมรวมตาม physical `(user,date,event)` แต่ logical identity คือ `(user,event)`. เมื่อ source-table revision ใหม่ย้าย date/time ออกนอกช่วง ตัวกรองอาจเหลือแถวเก่า. RED fixture ยืนยันว่า old proof ยังผ่าน แล้วแก้เฉพาะ `TeamInsightsRepository::facts()` ให้เลือก whole-row max revision ด้วย `ORDER BY ... version DESC LIMIT 1 BY user_id,usage_event_id` ก่อน outer time/retention filter และ LIMIT100001. Nullable มาจาก row เดียว ไม่ประกอบค่าคนละ revision.

GREEN บนสอง datastore จริงผ่านทั้งหลังสัปดาห์และก่อน retention พร้อม fault tests เดิม. Ingest ปัจจุบัน **ไม่อนุญาต** date/event_time move ของ ID เดิม; date-move fixture เป็นการตรวจเชิงป้องกันต่อ restored/future canonical rows ไม่ใช่การเปิด producer behavior ใหม่. ไม่แก้ ingest/schema/heartbeat/duration/timeout. Historical consent เป็น snapshot จำลองเท่านั้น; runtime ยังห้าม backdate consent.

ผลล่าสุด: server lib 436 passed / 39 ignored (ignored ไม่เป็นผ่าน); opt-in joint cost fixture 1 passed; strict server all-targets ผ่าน. Strict workspace all-target Clippy ผ่าน; บันทึกแยกใน `cost-joint-workspace-clippy.log`. หลักฐาน `output/team-closure-2026-10-13/cost-joint-local.json` ระบุ source hashes, test binary hash, native OS/architecture และ datastore versions. Source ยัง uncommitted และไม่รวมใน artifacts ของ `382c92e`. API authentication/browser/export acceptance, staging load/performance, actual GitHub/provider/client tests และ Cloud readiness ยัง pending.

ชุดทดสอบหยุด native PG และ Docker backend แล้ว. ตรวจ Cargo lock และ lsof ก่อน detach/remove incremental เก่าของ task target: target 6,595,891,200 → 5,039,251,456 bytes; observed free space เพิ่ม 1,556,602,880 bytes (~1.45 GiB) โดยรักษา active bounded cache, executable และ evidence. ไม่ลบ source/worktree/journal/queue/dependency ของงานอื่น. หลักฐาน `cost-joint-storage.json`.

Goal ยัง active. งานถัดไปของ G4 คือ full onboarding/report/export HTTP/browser acceptance; G5 commercial runtime ยังทำได้ระหว่างรอ Cloud/ราคาที่เจ้าของยังไม่ตัดสินใจ. G1/G2/G3/G6 และ external release gates ยังไม่ปิดจากผล regression นี้.

## G5 Stripe durable receiver foundation — 14 ต.ค. 2026

เพิ่ม migration 041 และ `services/repository/team_stripe.rs`: signed snapshot webhook ถูกลดเหลือ event/account/mode/customer/subscription/invoice identities และ timestamp ก่อน commit. ไม่เก็บ raw webhook, email, description หรือ credential. Event ID แยก account/test/live; ID เดิม payload hash ขัดแย้งถูกปฏิเสธ. ACK หลัง inbox และ requested revision ของงาน reconcile commit ใน transaction เดียว. Event ที่ไม่รองรับมี ignored disposition. งานที่ยังไม่มี verified binding คง pending; ไม่ผูกองค์กรจาก metadata หรือ checkout success.

เพิ่ม `POST /api/v2/team/webhooks/stripe` → BillingService → signed ingress → repository. ปิดด้วย Team flag และ `ATOAXIS_TEAM_STRIPE_ENABLED` โดยค่าเริ่มต้นไม่เปิด. รับ raw bytes จำกัด 2 MB; ใช้ signature verification เดิม (5 นาที), error เป็นรหัส/ข้อความปลอดภัย. `ATOAXIS_STRIPE_ACCOUNT_ID`, `ATOAXIS_STRIPE_MODE` ต้องระบุชัด; signing credential มาจาก encrypted envelope `ATOAXIS_STRIPE_WEBHOOK_CREDENTIALS_PATH` ภายใต้ vault เดิม `ATOAXIS_KMS_KEY_ID` เท่านั้น. Associated data คือ `stripe-webhook:<account>:test|live`; ย้าย envelope ข้ามบัญชี/โหมดแล้วเปิดไม่ได้. Local envelope ไม่ใช่การรับรอง Cloud KMS. Receiver นี้ใช้ snapshot event contract; thin events ยังไม่มี parser.

Repository สำหรับ processor มี exclusive lease 180 วินาที, reclaim หลัง expiry, requested/applied revision และ binding revision fence. จบ DB transaction ก่อนเรียก provider; complete ปฏิเสธ lease เก่า/ผลก่อน event ใหม่/ก่อน binding เปลี่ยน. Scheduling method เตรียม reconcile ทุก 5 นาทีเมื่อ idle โดยไม่เพิ่มงานซ้ำทุก poll. Failure เก็บ enum/HTTP status เท่านั้น ใช้ exponential backoff และเคารพ Retry-After; event ใหม่ไม่ล้าง deadline. 401/403/404/contract มีเหตุผลแยกและพักอย่างน้อยหนึ่งชั่วโมง; 404 ไม่แปลเป็นยกเลิก subscription. Snapshot เก็บ minor currency units ของ Stripe แยกจาก estimated AI micro-USD; unknown เป็น null, partial/multiple items ไม่แกล้งเป็นแพ็กเกจที่ยืนยันแล้ว. First failure เป็นหลักฐานที่พบสำหรับ invoice นั้น ไม่ใช่ผลคำนวณ entitlement/grace ที่เสร็จแล้ว.

ผลในเครื่อง: native PostgreSQL 16.15 ชุดจำลองแยกผ่าน signed ingress, retry หลัง ACK หาย, hash conflict, scope/unbound, concurrent claim, lease expiry, old result fence, idle schedule, Retry-After, DB commit failure rollback/retry, event ผิดลำดับ, encrypted vault และปิด feature flag. Server lib 440 passed / 40 ignored; ignored ไม่ถือว่าผ่าน. Endpoint wiring compile ผ่าน; ยังไม่มี HTTP roundtrip/Stripe-hosted delivery certification. หลักฐาน `output/team-closure-2026-10-13/stripe-local.json` พร้อม source hashes และ logs. ชุดนี้ไม่เรียก Stripe API ไม่เปิด Docker; native instance ปิดและลบเฉพาะฐานจำลองหลังจบ.

| รายการ G5 | พัฒนา | Local tests | Artifact/native | External | สิ่งที่ต้องทำต่อ |
|---|---|---|---|---|---|
| Signed durable receiver + encrypted webhook config | เสร็จเฉพาะ receiver | native PG/service ผ่าน | source ยังไม่รวม candidate | Stripe delivery pending | HTTP test และต่อ worker |
| Lease/revision/backoff repository | เสร็จเฉพาะ storage/processor interface | concurrent/fault fixture ผ่าน | native PG | pending | fixed-origin Stripe client + processor loop/health |
| Snapshot normalization | เสร็จสำหรับ snapshot metadata contract ที่ตรวจ | nullable/mode/identity ผ่าน | compiled | API contract/live pending | API version pin, current subscription/invoice readback |
| Subscription/customer binding, entitlement, trial/seats/prorate/downgrade/grace | ยังไม่ครบ runtime | policy เดิมเท่านั้น | pending | pending | verified server binding + transactional commands + invoice proof |
| Checkout/portal/UI | ยังไม่เสร็จ | pending | pending | Cloud/ราคา/config รอเจ้าของ | ทำ test-mode flow โดยคง checkout ปิดจน gates ครบ |

เอกสารอ้างอิง: [Stripe webhook guidance](https://docs.stripe.com/webhooks), [event object](https://docs.stripe.com/api/events/object), [subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks). ยังไม่เรียก repository scheduling method ว่า background worker ที่ทำงานจริง; `billing-reconciliation` processor ยังต้องต่อ. ไม่เปิด paid analytics จาก notification/snapshot นี้. Financial metadata retention/deletion policy และการรับรอง Cloud ยังไม่ปิดจาก Team analytics retention เดิม.

งานถัดไป: ต่อ provider client/worker และ verified binding, แล้ว trial/transactional seats/prorate/downgrade/grace/Checkout/portal พร้อม fault/HTTP/UI evidence. G1–G6 และ prerequisites ภายนอกยังตาม Goal เดิม; source รอบนี้ยังไม่ได้ commit/push, checkout/production readiness=false.

## G5 current-subscription worker — 14 ต.ค. 2026

ต่อ `billing-reconciliation` จาก stub ให้ใช้ `StripeWorker` จริง: อ่าน verified bindings, เตรียม reconcile ของงานที่ไม่มี webhook และ refresh หลัง successful checkpoint เกิน 5 นาที. Tick 15 วินาที จำกัด 100 claims/รอบและหยุดเริ่ม claim เมื่อใช้เวลา 10 วินาที; request deadline 10 วินาทีและ connect deadline 5 วินาที. Database transaction จบก่อน HTTP request. ไม่มี paid entitlement เกิดจากการเดิน worker นี้.

`StripeClient` รับ API credential ผ่าน envelope แยก `ATOAXIS_STRIPE_API_CREDENTIALS_PATH` โดย AAD `stripe-api:<account>:test|live`; ตรวจ key mode และไม่ serialize/debug credential. Transport จริงมี origin `https://api.stripe.com` ตายตัว, HTTPS, ไม่ follow redirect และ pin `Stripe-Version: 2025-04-30.basil`. ตรวจ `GET /v1/account` ว่าเป็นบัญชีของ key ก่อน `GET /v1/subscriptions/:id`; ตรวจ customer/subscription/mode ก่อน normalize. Read-only APIs เท่านั้น; ไม่สร้าง customer/price/subscription/payment. จำกัด response ในหน่วยความจำ 2 MB; error body, URL/error จาก transport และ payload ไม่เข้า diagnostics/storage. `Retry-After` รองรับวินาทีและ HTTP date.

Migration 042 เพิ่ม account/mode worker lease และ cooldown ที่ durable. Cooldown commit ก่อนปล่อย job lease เมื่อเจอ network/5xx/429/auth/permission/scope mismatch เพื่อให้ process อีกตัวหรือ restart ไม่ข้ามกำหนดรอ. Lease ทั้ง scope และ job มีอายุ 180 วินาที. Snapshot สำเร็จต้องผ่าน current job/binding revision fence เดิม. 404/unsupported resource contract พักเฉพาะ job โดยรักษา snapshot และให้ job อื่นไปต่อ; ถ้ามี Retry-After ให้เคารพในระดับ account ด้วย. Account-level connection recovery ไม่ล้าง error ของ job ที่ยังค้าง. Scope health เก็บ last tick/provider success/reason/status; การนำไปแสดงใน billing UI ยังรอขั้นถัดไป.

Native fixture บน PostgreSQL 16.15 และ loopback HTTP ผ่าน: reconcile เมื่อไม่มี activity/webhook, refresh ตาม checkpoint, restart เคารพ durable 429 cooldown, 401/403/404/5xx, wrong customer, malformed contract, current-state recovery และ marker privacy. Transport tests ผ่าน pinned API version/auth, wrong account, network refusal, redirect rejection, Retry-After seconds/date/overflow. Sandbox run ครั้งแรกไม่อนุญาต bind loopback จึงล้ม; รันใหม่ด้วย local-test execution permission โดยไม่เปลี่ยน assertions แล้วผ่าน. ผลจำลองเป็น local evidence ไม่ใช่ Stripe live หรือ native full process lifecycle certification.

Source ปัจจุบัน: server lib **442 passed / 41 ignored**; isolated native PG/service/HTTP worker regression **2 passed**. Report/source hashes/logs: `output/team-closure-2026-10-13/stripe-local.json`. ชุดทดสอบปิด PG/HTTP mock และลบเฉพาะฐานจำลองใน finally; ไม่เปิด Docker. Worker ยังไม่ได้ deploy หรือรันกับข้อมูล/credentials จริง และ code รอบนี้ยังไม่อยู่ใน candidate `382c92e`.

สิ่งที่ยังต้องพัฒนา G5: verified customer/subscription binding flow จาก server, invoice/payment evidence สำหรับ entitlement, trial 14 วัน/transactional seats, checkout/portal, confirmed prorate upgrades, explicit-seat downgrade/cancel-at-period-end, grace/recovery และ billing UI/health. ข้อมูล financial metadata ต้องมี retention/restore policy แยกอย่างชัดเจน. Cloud target/ราคา/live config ยังรอเจ้าของ; checkout และ production readiness คง false. ไม่ใช้สมมติฐานว่า snapshot `active` อย่างเดียวเท่ากับชำระแล้ว.

เอกสาร contract: [Stripe subscription retrieve (Basil)](https://docs.stripe.com/api/subscriptions/retrieve?api-version=2025-04-30.basil), [Stripe official account client](https://github.com/stripe/stripe-go/blob/master/account_service.go). `GET /v1/account` ยืนยันบัญชีของ credential; การเรียก `/v1/accounts/:id` เพื่อดู connected account ไม่ได้ใช้แทนการยืนยันนี้.


## G5 invoice/payment evidence — 14 ต.ค. 2026

เพิ่ม invoice observation ใน worker เดิมและ migration 043 แบบ additive. เก็บเฉพาะ allowlisted invoice/subscription/item/price identity, currency, amounts ในหน่วยย่อยของ Stripe, settlement timestamps และ line service period. ไม่เก็บ invoice description, address, payment secret หรือ response body. ข้อมูลที่ไม่มีเป็น null และ partial coverage มีเหตุผล ไม่แปลงเป็นศูนย์หรือ paid entitlement. Invoice-level period ไม่ถูกใช้แทนช่วงบริการของ line.

Worker อ่าน subscription → invoice/line pages → invoice ซ้ำ → subscription ซ้ำก่อน commit. ตรวจ account/mode/customer/subscription/invoice และ line parent ที่ provider ระบุ; หาก allowlisted invoice metadata หรือ subscription เปลี่ยนระหว่างอ่าน ให้พักงานด้วย `observation_changed` และลองใหม่ ไม่บันทึกข้อมูลผสม. นี่เป็นการตรวจความเปลี่ยนแปลงที่สังเกตได้ ไม่ใช่ atomic snapshot guarantee จาก Stripe และไม่ตรวจจับการเปลี่ยนแล้วเปลี่ยนกลับระหว่าง request ได้ทั้งหมด. Pagination จำกัด 1,000 lines/10 additional pages; เกินขอบเขตยังเก็บเป็น partial และไม่ใช้ยืนยัน service coverage. บันทึก invoice กับ subscription observation และ job acknowledgement ใน transaction เดียวผ่าน lease/revision fence เดิม.

แยกการยืนยัน invoice settlement ออกจากการเปิดสิทธิ์องค์กร. ตัวช่วย coverage รับเฉพาะ invoice ที่ยืนยันชำระแล้วและ line ครบ, item/price/quantity/currency ตรง และช่วงบริการที่มีหลักฐาน; credit ที่ซ้อนช่วงปัจจุบันและข้อมูล unknown ไม่ผ่าน. ยังไม่มีการใช้ helper นี้เปิด paid analytics. คำสั่งเปลี่ยนแพ็กเกจต้องตรวจ approved price catalog, confirmation และ payment state อีกชั้นในขั้นถัดไป.

Local regression: server lib **446 passed / 0 failed / 41 ignored**; native PostgreSQL 16.15 + loopback HTTP **2 passed**. ครอบคลุม response-loss replay, scope mismatch, changed subscription/invoice, duplicate pagination/line parent mismatch, partial 1,000-line coverage, invoice 429, DB invoice-write failure แล้ว rollback ทั้ง acknowledgement และ snapshot, restart/retry และ metadata marker privacy. ไม่เรียก Stripe จริง ไม่ใช้ผลจำลองรับรอง checkout/payment lifecycle. PG แยกปิดแล้วและลบเฉพาะฐานจำลอง; ไม่เปิด Docker. Astra review ติด usage limit จึงไม่มีผล review จาก Astra; ใช้การตรวจโค้ดและ regression รอบนี้แทน โดยไม่อ้าง independent review ผ่าน.

| รายการ | พัฒนา | local tests | artifact/native | external | งานถัดไป |
|---|---|---|---|---|---|
| Invoice/line normalization + settlement evidence | เสร็จเฉพาะ evidence contract นี้ | pure/HTTP/PG ผ่าน | source ยังไม่รวม candidate | Stripe actual pending | ต่อ verified binding/entitlement |
| Invoice/subscription change fence + atomic persist | เสร็จสำหรับการเปลี่ยนที่ตรวจพบ | race/DB failure/retry ผ่าน | local native PG | live pending | full worker process fault/lifecycle |
| Trial/seats/upgrade/downgrade/grace + checkout/portal | ยังไม่ครบ | ยังไม่รับรอง flow | pending | ราคา/config owner-pending | ทำ transactional runtime และ UI |

หลักฐานและ source hashes: `output/team-closure-2026-10-13/stripe-invoice-local.json`. ตัวเลข local ไม่รับรอง G5 ทั้งหมด; checkout/production_ready=false และ Goal active. Source ยังไม่ commit/push. Financial retention/restore, full HTTP/browser acceptance, Cloud และ provider certification ยังคงค้างแยก.

Contract: [Stripe invoice retrieve](https://docs.stripe.com/api/invoices/retrieve?api-version=2025-04-30.basil), [invoice line item](https://docs.stripe.com/api/invoice-line-item/object?api-version=2025-04-30.basil). Transport ยังคง pin Basil ตาม worker เดิม.

Strict workspace all-target Clippy ผ่านหลังแก้ boolean expression โดยไม่ suppress warning. Target เดิมหลังตรวจประมาณ 5.01 GiB (ก่อน 5.01 GiB), เก็บเป็น bounded cache ของ Goal ที่ยัง active; ไม่มี target/worktree ใหม่.


## G5 durable customer provisioning — 14 ต.ค. 2026

เพิ่ม `GET/POST /api/v2/organizations/:id/billing/customer` สำหรับ session ของ Owner ภายใต้ Team/Stripe flag เดิมที่ยังปิด. POST บันทึก operation ใน PostgreSQL ก่อนให้ worker สร้าง Customer; GET อ่านสถานะ operation. ไม่รับ customer/subscription/account ID จาก request และไม่รับ organization จาก Stripe callback. Public response เป็น operation/disposition/error/observation metadata ไม่มี credential หรือ provider customer payload. UI setup/Checkout ยังต้องต่อ ไม่อ้าง flow ผ่าน browser แล้ว.

Migration 044 เก็บ scope ต่อ organization/account/mode, server-generated operation UUID, first attempt, lease/retry และ normalized customer receipt. คำขอซ้ำ/พร้อมกันใช้ operation เดิม. Worker เดิมทำสูงสุดหนึ่ง customer job ต่อ tick ก่อน subscription reconciliation; ตรวจ credential account แล้ว POST `/v1/customers` ด้วย idempotency key เดิม และส่งเฉพาะ opaque operation metadata ไม่มีชื่อ/อีเมล/ที่อยู่. ตรวจ returned object/mode/operation identity ก่อนรับผล. ไม่เพิ่ม Stripe permissions หรือใช้ credential จริงในงานนี้.

Central authorization ตรวจ ManageBilling และล็อก membership/user/organization rows ก่อนรับคำขอ ก่อน dispatch และก่อน commit receipt. ถอน Owner ระหว่าง HTTP แล้วคง customer receipt เป็น `owner_changed` เพื่อสอบสวน ไม่เปิดสิทธิ์/ใช้ผูก subscription. Lease หมดอายุ/ถูกแทนไม่สามารถ commit ผลเก่า. ไม่ถือ DB transaction ระหว่าง HTTP. เก็บ customer ACK ถาวรหลัง commit; DB ล้มหลัง provider สร้างสำเร็จ ใช้ idempotency key เดิมเมื่อ lease ฟื้น.

Stripe API v1 อาจ prune idempotency key หลัง 24 ชั่วโมง. ระบบนี้เลือกหยุดเริ่ม create ซ้ำหลัง first attempt 23 ชั่วโมงและเก็บ `recovery_required / idempotency_window_unconfirmed` แทนการสร้างลูกค้าใหม่โดยคาดเดา. การ request ซ้ำไม่ reset deadline, authorization incident หรือ retry backoff. ยังต้องพัฒนา recovery/re-authorization UI และ provider lookup ที่ยืนยันผลเดิมก่อนปิดกรณี ambiguity; ไม่ระบุ recovery นี้ว่าเสร็จแล้ว.

Native PostgreSQL/loopback HTTP suite **3 passed** รวม concurrent request/lease, wrong account/mode, stale lease, DB receipt commit failure หลัง provider creation แล้ว retry ได้ customer เดิม, owner revocation in-flight, expired idempotency window, 429/Retry-After ที่ repeated request ข้ามไม่ได้ และ storage marker privacy. Server lib **446 passed / 42 ignored** (3 opt-in tests รันแยกข้างต้น ไม่ถือ ignored ทั้งหมดว่าผ่าน). Compile รอบแรกขาด await ที่ session auth และ fixture ใช้ชื่อตารางผิด; แก้ทั้งสองจุดโดยคง assertions แล้วรันผ่าน. ฐาน PostgreSQL แยกหยุดและลบเฉพาะข้อมูลจำลองหลังจบ ไม่เปิด Docker.

| รายการ | พัฒนา | local tests | artifact/native | external | งานต่อไป |
|---|---|---|---|---|---|
| Owner-only durable customer request/status API | wired + compiled | service/storage authorization ผ่าน; full route roundtrip pending | source ยังไม่รวม candidate | pending | UI และ session/API HTTP acceptance |
| Server-created customer receipt worker | implemented | PG + mock HTTP/fault/retry ผ่าน | local native PG | actual Stripe pending | checkout operation และ verified subscription binding |
| Idempotency-window/owner-change incident recovery | ตรวจและพักได้ | regression ผ่าน | source | pending | reconciliation/re-authorization UI โดยไม่สร้างซ้ำ |
| Entitlement/trial/seats/prorate/downgrade/grace/portal | ยังไม่ครบ runtime | ไม่รับรอง flow | pending | ราคา/config owner-pending | transactional package commands และ payment proof |

หลักฐาน: `output/team-closure-2026-10-13/stripe-customer-local.json`. Customer receipt ไม่ใช่ paid entitlement และไม่สร้าง subscription; binding งานเก่ายังต้องต่อจาก checkout proof. Financial metadata retention/restore, browser, provider live และ G1–G6 gates ยังไม่ปิด. source uncommitted, checkout/production readiness=false.

อ้างอิง: [Stripe create customer](https://docs.stripe.com/api/customers/create?api-version=2025-04-30.basil), [Stripe idempotency](https://docs.stripe.com/api/idempotent_requests).

Customer slice strict workspace/all-target Clippy ผ่าน หลังเปลี่ยน fixture เป็น async mutex โดยไม่ suppress warning. Target เดิม 5.01 GiB; เก็บ cache ของ Goal ที่ยัง active. Native PG/HTTP fixtures หยุดและลบฐานจำลองแล้ว ไม่มี Docker หรือ cloud resource ถูกเปิด.


## G5 Customer recovery + UI — หลักฐานตรวจรวม 15 ต.ค. 2026

Migration 045 เพิ่ม revision, lookup-only mode และประวัติ Owner authorization แบบ additive. Owner ที่มี session ยืนยัน `operation_id + expected_revision + confirm` ผ่าน `/billing/customer/recover`; ตรวจ account/mode/org และสิทธิ์ใน transaction เดียวกับ CAS/audit. ไม่เปลี่ยน operation ID, first-attempt time หรือ retry deadline. คำขอซ้ำจาก revision เก่าคืน conflict. Worker lookup-only ไม่มีเส้นทาง POST สร้าง Customer ใหม่ และ create method ปฏิเสธ claim ชนิดนี้ด้วย.

ถ้ามี Customer ID ที่รับไว้แล้ว ให้ retrieve ID เดิม. ถ้าไม่มี ให้ค้นด้วย server operation metadata จำกัดผลเพื่อแยก missing/ambiguous แล้ว retrieve candidate สดก่อน commit. Search ของ Stripe มีความล่าช้าได้; missing/ambiguous/deleted จึงคง unconfirmed/recovery_required ไม่อนุมานว่าไม่เคยสร้าง. Positive result ยังต้องผ่าน identity/mode/operation และ owner/lease/revision fence. Region/API ที่ไม่รองรับ search หรือ credential ไม่มีสิทธิ์แสดง error ตามจริง ไม่ขยาย permissions หรือประกาศ recovery ผ่าน.

Teams เพิ่ม Billing setup panel แบบเปิดโดยผู้ใช้: ดูสถานะ, prepare customer, reload และ checkbox ยืนยัน recovery ผูกกับ revision ที่แสดง. ไม่มี checkout/paid access เกิดจาก verified customer. Query แยก user/org, remount เมื่อ scope เปลี่ยน, ซ่อนข้อมูลเก่าขณะ refresh/error และ reset confirmation เมื่อ reload; mutation ไม่ retry อัตโนมัติ. ส่วนเต็มของ subscription/Checkout/portal ยังไม่เสร็จ.

Local evidence: native PG/loopback HTTP **3 tests passed** (เวลาเดิม 14 ต.ค. เก็บไว้ใน `native_fixture_checked_at`), server lib **446 passed / 42 ignored**, component/workflow **25 tests passed** รวม billing 5 cases, TypeScript และ changed-source ESLint ผ่าน, strict workspace all-target Clippy ผ่าน. ทดสอบ competing recovery confirmations, cross-org rejection, owner re-authorization, missing/ambiguous search, fresh resource readback, unchanged create-call count/first-attempt deadline, scope switch, permission loss และ stale UI revision. Full API-auth HTTP/browser staging และ Stripe actual ยัง pending. Lint รอบแรกแก้การเรียง interface/union; test files ใช้นโยบาย lint ignore เดิม แต่รันผ่าน Vitest.

หลักฐาน: `output/team-closure-2026-10-13/stripe-recovery-local.json` รวม source/log hashes. PG ปิดแล้วและลบเฉพาะฐานทดสอบ; ไม่เปิด Docker. Target เดิม 5.01 GiB เก็บสำหรับ Goal ที่ยัง active; source ยังไม่ commit/push หรือรวม candidate.

| รายการ | พัฒนา | local tests | artifact/native | external | ควรทำต่อ |
|---|---|---|---|---|---|
| Customer recovery + owner CAS/history | implemented | native PG/HTTP ผ่าน | source only | pending | real-provider/authenticated HTTP/restore |
| Billing setup/confirmation UI | implemented | component 5 cases + prior 20 ผ่าน | browser staging pending | pending | Checkout/quote/portal UI |
| Payment package runtime | ยังไม่ครบ | ยังไม่รับรอง end-to-end | pending | ราคา/config รอเจ้าของ | approved price catalog, checkout proof, subscription binding, entitlement/seats |

ไม่มีการนำผลจำลองไปเปิด readiness; G1–G6 ยัง active. Financial retention/restore, native/provider certifications, Cloud และ pilot teams ยังเป็น gates เดิม. Contract อ้างอิง: [Stripe customer search](https://docs.stripe.com/api/customers/search?api-version=2025-04-30.basil), [Stripe search consistency](https://docs.stripe.com/search).


## G5 approved price catalog contract — 15 ต.ค. 2026

เพิ่ม `services/team_stripe_catalog.rs` และ read-only `StripeClient::verified_package` เป็นฐานสำหรับ Checkout ที่ยังต้องต่อ. Catalog มาจาก `ATOAXIS_STRIPE_PRICE_CATALOG_PATH` ฝั่ง server เท่านั้น; ไม่รับราคา/Price ID ที่ browser กำหนด. ไม่มีไฟล์ config จริงหรือราคาขายถูกสร้างในงานนี้. Path ไม่ตั้งคืน unavailable; JSON ไม่ตรง schema, ไม่อนุมัติ, scope ไม่ตรง, packages ขาด/ซ้ำ หรือ terms ผิดถูกปฏิเสธ. จำกัดเอกสาร 64 KiB และแปลง parse errors เป็นข้อความปลอดภัย.

Schema v1 มี revision > 0, owner_approved, account_id, livemode, currency และ packages ครบ 10/25/50/100. แต่ละ package มี seats, price_id, product_id, amount_minor และ tax_behavior ตามที่เจ้าของอนุมัติ. Price ID แต่ละ package ไม่ซ้ำ. Amount ใช้ minor units ของ currency จริง ไม่ใช่ micro-USD ของ AI cost; ไม่สร้างราคาหรือ exchange rate สมมติ. จำนวนซื้อคือ **1 package**; seats เป็นขีดจำกัด developer แยกต่างหาก.

ตรวจ credential account แล้ว GET Price พร้อม expanded Product จาก origin/API-version เดิม. ต้องเป็น active price/product, scope/identity/currency/amount/tax behavior ตรง, licensed recurring รายเดือนครั้งละ 1 และ per-unit; variable/custom/tiered/quantity transform ไม่ผ่าน. ตรวจ decimal แบบ exact โดยไม่ผ่าน floating point. สร้าง SHA-256 ของ normalized catalog พร้อม revision/observed_at สำหรับผูก quote/checkout intent ในขั้นถัดไป. ไม่ใช้ค่านี้แทนยอดภาษี/ส่วนลด/ยอด prorate สุดท้าย และไม่เปิด checkout หรือ paid analytics จากการอ่าน price สำเร็จ.

Local server **450 passed / 42 ignored** รวม pure catalog 3 tests และ loopback price transport 1 test. ตรวจ incomplete/unknown-field/unapproved catalog, wrong account/mode, changed terms/amount/currency, fractional amount, archived price และ product ที่ไม่ได้ expand และ marker privacy. ไม่มี Stripe API จริง; fixture amount เป็นข้อมูลจำลอง ไม่ใช่ราคาขายของเจ้าของ. Customer recovery PG/HTTP และ UI evidence คงอยู่ในรายงานรอบก่อน ไม่สร้างผล native/live ใหม่จาก unit tests นี้.

สิ่งที่ยังต้องทำ: เชื่อม catalog กับ owner quote/API/UI, durable Checkout intent + provider idempotency/readback, verified subscription binding, transactional trial/seats/upgrade/downgrade/grace และ portal. Catalog contract ยังไม่ถือเป็น Checkout implementation ครบ. Cloud/ราคา/live config ยังรอเจ้าของ, checkout/production readiness=false.

เอกสารอ้างอิง: [Stripe Price object](https://docs.stripe.com/api/prices/object?api-version=2025-04-30.basil), [retrieve price](https://docs.stripe.com/api/prices/retrieve?api-version=2025-04-30.basil). หลักฐาน source/log hashes จะเก็บใน `output/team-closure-2026-10-13/stripe-catalog-local.json`.

Catalog strict workspace/all-target Clippy ผ่าน; target เดิม 5.00 GiB. Compile errors รอบแรกอยู่ใน fixture macro/assertion และแก้แล้ว; ไม่มี warning suppression หรือเปลี่ยนราคาจริง.

## G5 Owner package price preview — 15 ต.ค. 2026

Migration 046 เพิ่ม immutable quote ที่ผูก organization, Owner, Stripe account/mode, verified customer operation/revision, package และ catalog hash. POST `/api/v2/organizations/:id/billing/quotes` รับเพียง request ID กับ package seats; ราคา/Price ID มาจาก catalog ที่เจ้าของอนุมัติและ provider readback เท่านั้น. GET quote ตรวจ Owner/customer/catalog ใหม่และไม่คืน quote หมดอายุ. Snapshot มีอายุไม่เกิน 10 นาทีจาก observation; ส่ง request ID เดิมซ้ำไม่ขยาย expiry หรือเปลี่ยน terms. Account/role/customer เปลี่ยนระหว่าง provider HTTP กับ database commit ถูกปฏิเสธ. ไม่มี database transaction ค้างระหว่าง HTTP. ใช้ shared Stripe account cooldown/lease เดิมและไม่ข้าม Retry-After.

Teams Billing setup เพิ่ม package preview 10/25/50/100 ที่แสดงหลัง customer verified. POST สำเร็จแล้วต้อง GET ผ่านการตรวจสิทธิ์อีกครั้งก่อนแสดงราคา; refresh ทุก 15 วินาทีเฉพาะขณะเปิดและซ่อนผลขณะ refresh/error. UI รักษา request ID เมื่อ response หาย, แยก user/org/customer revision, ซ่อนราคาเมื่อเปลี่ยน package/สิทธิ์/หมดอายุ และรับ response ที่มาช้าโดยไม่แสดงข้าม scope. ราคาเป็น exact minor-unit string แปลงเป็นข้อความโดย BigInt ตาม Stripe charge units; ทดสอบ JPY/MGA, ISK/UGX และ HUF/TWD แยกจาก payout rules. ไม่มีการใช้ค่าเริ่มต้นเป็นราคาขายจริง.

แสดงราคา package รายเดือน, tax behavior, observation/expiry และ `total_due_minor=null`; ยังไม่ใช่ยอดชำระที่ยืนยันภาษี/ส่วนลด/prorate และไม่มีปุ่มจ่าย. Preview นี้ไม่จองราคา ไม่เปิด subscription และไม่ป้องกันการเปลี่ยนแปลง provider หลัง observation แทน Checkout; ขั้น confirmation ต้องตรวจ terms, ownership, seat count และ subscription exclusivity อีกครั้งแบบ transactional. องค์กรที่มี binding แล้วถูกส่งไปงาน package-change ที่ยังต้องพัฒนา.

Local validation: **native PostgreSQL/loopback HTTP 4 tests passed**, server **450 passed / 43 ignored**, UI/workflow **32 passed** (quote 7, customer 5, prior workflow 20), TypeScript, scoped ESLint และ strict workspace/all-target Clippy ผ่าน. Native fixture time `2026-10-15T01:16:46.951404+00:00`; fixture ถูกหยุดและลบฐานจำลองแล้ว. Tests ตรวจ concurrent same-ID save, unchanged expiry, Owner/customer/catalog fences, cross-owner rejection, expired/read-after-revocation, response-loss ID reuse, UI late response/scope change และ timer expiry. Ignored tests ไม่ถูกนับเป็นผ่าน; 4 opt-in tests รันแยกจริง. Lint รอบแรกแก้ grouping/regex/ternary โดยไม่ suppress warning. Full session-auth HTTP/browser staging และ actual Stripe ยัง pending.

| รายการ | พัฒนา | local tests | artifact/native | external | ควรทำต่อ |
|---|---|---|---|---|---|
| Scoped immutable price quote/API | implemented | native PG + server ผ่าน | source only | pending | full authenticated HTTP, Checkout confirmation |
| Owner package preview/UI | implemented | component 7 + prior 25 ผ่าน | browser pending | pending | final terms/Checkout/portal UI |
| Quote/financial retention + restore | ยังไม่ครบ | ไม่รับรอง | pending | pending | เพิ่ม financial inventory และ recovery policy |
| Checkout, verified subscription binding, entitlement | ยังไม่ครบ runtime | ไม่รับรอง end-to-end | pending | ราคาจริง/config owner-pending | durable operation + provider readback ก่อนสิทธิ์ |

Evidence: `output/team-closure-2026-10-13/stripe-quote-local.json`. Source uncommitted บน `codex/heartbeat-capture-release`, base `382c92e`; ยังไม่รวม candidate และไม่มี push. ไม่เปิด Docker. Reused Rust target 5,240,704 KiB (~5.00 GiB) จากก่อน quote 5,240,100 KiB; เก็บ cache สำหรับ Goal ที่ยัง active. Whitespace ของ analytics/projects page เป็นไฟล์ค้างงานอื่น จึงไม่แก้ใน slice นี้. Checkout/production readiness ยัง false; Goal G1–G6 active.

Contract reference: [Stripe currency charge units](https://docs.stripe.com/currencies), [Stripe Price object](https://docs.stripe.com/api/prices/object?api-version=2025-04-30.basil). สิ่งที่ owner ยังไม่กำหนด (Cloud/ราคา) ไม่ขัดขวาง code/fixture work แต่ไม่ใช้ผลจำลองเปิดขายหรือรับรองจริง.

## G5 Checkout intent/receipt foundation — 15 ต.ค. 2026

เพิ่ม migration 047, `repository/team_stripe_checkout.rs` และ `services/team_stripe_checkout.rs` เป็นฐานสำหรับ purchase confirmation. **ยังไม่มี production request/worker/UI wiring สำหรับ Checkout และยังไม่สร้าง Stripe Session**; ไม่ประกาศว่า Checkout runtime พร้อม. มี authenticated read-only transport `StripeClient::checkout_session` สำหรับขั้น readback ซึ่งยังต้องเชื่อมกับ workflow ถัดไป.

Durable intent ผูก quote/Owner/org/account/mode, serialize คำยืนยันในองค์กรด้วย transaction advisory lock และ unique open-operation index. Quote เดิมให้ operation เดิม; quote อื่นไม่แทนงาน ambiguous ที่ยังไม่ reconcile. Retry ไม่เปลี่ยน first-attempt, deadline, ID หรือข้าม Retry-After. ก่อน claim ตรวจ Owner/customer/catalog/quote expiry และจำนวน developer ที่สังเกต; ก่อนเริ่ม attempt ใหม่หลัง 23 ชั่วโมงพัก recovery_required เพื่อไม่อาศัย Stripe idempotency key ที่อาจหมดอายุ. Intent ที่ยังไม่เคย attempt และ quote หมดอายุปล่อยเป็น expired ได้. ข้อผิดพลาดฐานข้อมูลไม่ถูกกลบเป็น capacity error.

Provider receipt เก็บเฉพาะ session ID/status/expiry/subscription และ observation ที่ตรวจแล้ว; ตรวจ mode/customer/operation/Price/currency/amount/quantity/line completeness. ไม่มี customer details, URL, body หรือ raw JSON ถูกบันทึก. Session complete/unpaid ยังเป็น awaiting_verification ไม่ใช่ paid entitlement. ผลที่เข้ามาหลัง Owner ถูกถอนสิทธิ์เก็บ identity ไว้เป็น owner_changed ไม่เปิดสิทธิ์ ไม่ปล่อย reservation และไม่เริ่ม checkout ใหม่. Lease เก่าถูกปฏิเสธ. Readback transport ตรวจ fixed origin, own account, session identity และ expanded line items; provider URL ไม่ถูกส่งต่อจาก parser นี้.

Local: **native PostgreSQL/loopback 5 tests ผ่าน**, pure parser 1 + HTTP readback 1 รวมใน **server 452 passed / 44 ignored**, strict workspace/all-target Clippy ผ่าน. Fixture ตรวจ simultaneous same-quote confirmation, unconfirmed/changed-catalog/cross-org rejection, live lease exclusion, 429 retry deadline, accepted-intent retry หลัง quote expiry, process recreation, stale lease, injected DB receipt failure, owner revocation, metadata marker exclusion และ idempotency-window stop. Compile รอบแรกแก้ json macro expression ใน fixture โดยคง assertions. Native fixture checked_at `2026-10-15T01:46:50.426309+00:00` เป็นก่อนเพิ่ม readback transport; transport ผ่าน loopback ใน full server run แยกและเก็บ source hashes ตามรอบจริง.

| รายการ | พัฒนา | local tests | artifact/native | external | งานถัดไป |
|---|---|---|---|---|---|
| Durable confirmation/receipt repository | implemented foundation | PG regression ผ่าน | source only | pending | เชื่อม service/endpoint/worker |
| Session metadata parser + readback | implemented contract | pure + HTTP fixture ผ่าน | source only | Stripe actual pending | create/readback/recovery orchestration |
| Checkout Session creation + redirect | ยังไม่พัฒนาใน slice นี้ | pending | pending | ราคา/config pending | immutable return URLs/terms + durable idempotency |
| Subscription binding/payment entitlement | ยังไม่ครบ runtime | pending | pending | pending | independent subscription/invoice proof |
| Transactional seat reservation | ยังไม่ครบ | current-count check เท่านั้น | pending | pending | lock ร่วมกับ membership mutations + concurrent tests |

Repository intent ไม่ใช่ runtime ที่ส่งได้ด้วยตัวเอง. ยังต้องพัฒนา durable provider create/retrieve, immutable request configuration, orphan lookup/recovery/expiration, customer/catalog recheck หลัง request, verified binding, final payment/seat fence, API/UI confirmation, financial retention/restore และ actual staging. ไม่มี callback ที่ใช้ success page เปิด entitlement. `checkout_available=false`, `payment_verified=false` จน flow สิทธิ์ใหม่พร้อม; ไม่ใช้ field false นี้เป็นผลรับรองสำเร็จ.

Evidence: `output/team-closure-2026-10-13/stripe-checkout-intent-local.json`. Target เดิม 5,258,280 KiB (~5.01 GiB), ก่อนงาน 5,240,704 KiB; คง bounded cache ของ Goal ที่ active. Native PG fixture หยุด/ลบฐานจำลองแล้ว, ไม่เปิด Docker. Source บน codex branch ยังไม่ commit/push และยังไม่รวม candidate. G1–G6 ยังไม่ผ่านครบ.

References: [Checkout create](https://docs.stripe.com/api/checkout/sessions/create?api-version=2025-04-30.basil), [Checkout retrieve](https://docs.stripe.com/api/checkout/sessions/retrieve?api-version=2025-04-30.basil), [fulfillment](https://docs.stripe.com/checkout/fulfillment).

## G5 Frozen Checkout create + worker — 15 ต.ค. 2026

เพิ่ม migration 048 เก็บ request metadata/hash แบบ additive. Server contract `CheckoutPolicy` ต้องมี approval, HTTPS return origin ที่ไม่มี credentials/path/query/fragment และ explicit automatic-tax policy; **ยังไม่สร้าง policy/ราคาจริงแทนเจ้าของ**. `FrozenRequest` schema v1 เก็บ operation/customer/price/origin/tax เพื่อสร้าง form เดิมเมื่อ retry; ไม่มีการอ่าน current return URL มาทับ accepted request. Unknown schema/hash mismatch/legacy row ที่ไม่มี request proof พัก recovery_required. Format v1 ต้องรักษาความหมายเมื่อเพิ่ม protocol รุ่นต่อไป.

`StripeClient::create_checkout_session` ตรวจ account/mode, approved catalog hash และ fresh Price/Product ก่อน POST; quantity=1 package, metadata opaque operation ID, same idempotency key, server-built success/cancel URLs, automatic-tax ตาม policy, ปิด adaptive pricing/promotion-code input เพื่อไม่เปลี่ยน base terms เงียบ ๆ. ยังไม่มี feature สำหรับ coupons/prorate ใน flow นี้. ไม่ใส่ expires_at ที่เปลี่ยนทุก retry. หลัง POST parse receipt แล้ว GET Session เดิมพร้อม expanded lines อีกครั้ง. ไม่เก็บ/ส่งต่อ hosted URL หรือ customer details จาก raw response. ไม่มี trial/สิทธิ์ซื้อถูกเปิดจากการสร้าง Session.

เพิ่ม `StripeWorker::checkout_tick` รับไม่เกิน 1 accepted intent ต่อรอบและใช้ account lease/cooldown เดิม. Worker process เรียกได้เมื่อ `ATOAXIS_TEAM_STRIPE_CHECKOUT_WORKER_ENABLED` เปิดอย่างชัดเจนและมี approved catalog; ค่าเริ่มต้นปิด. เป็นส่วนส่งงานที่รับไว้แล้ว **ยังไม่มี endpoint/UI รับ confirmation จริงหรือ checkout redirect**. ไม่ควรเปิด flag สำหรับ production จน full flow/rollback/recovery/seat/payment gates ผ่าน.

กรณี JSON success response ขาดหลัง accepted write ถือ network/unconfirmed เฉพาะ Checkout create/readback เพื่อ retry ID เดิม. เริ่มแรกเปลี่ยน parser กลางแล้วพบ regression ของ subscription readback; แก้ให้ Checkout ใช้ response-loss mode เฉพาะ โดยรักษา behavior GET เดิมและ assertions เดิม. Valid JSON ที่ contract/identity ผิดยังเป็น unsupported/scope error ไม่ retry ด้วย payload ใหม่. Stripe v1 อาจคืน cached 500 เดิม; recovery หลังหมดช่วง safe idempotency ยังคง pending ไม่สร้างใหม่เอง.

ผลตรวจ: **server 454 passed / 44 ignored**, native PostgreSQL/loopback **5 tests passed**, strict workspace/all-target Clippy ผ่าน. เพิ่ม pure frozen-policy/tamper test และ HTTP fixture ที่ accepted POST แรกส่ง body ขาด, retry ใช้ key/form เดิม, creation count=1, GET readback ตรง ID. Native Checkout test ครอบคลุม persisted form หลัง restart, actual worker response-loss/backoff/idle/restart/readback และคง awaiting_verification สำหรับ complete/unpaid โดยไม่มี binding. Local fixtures ใช้ข้อมูลจำลอง; ไม่รับรอง real Stripe หรือ process/login lifecycle. Native fixture timestamp `2026-10-15T01:59:24.764705+00:00` เก็บไว้ตามจริงและฐานทดสอบหยุด/ลบแล้ว.

| รายการ | พัฒนา | local tests | artifact/native | external | งานต่อไป |
|---|---|---|---|---|---|
| Frozen request/policy/hash | implemented | pure + PG ผ่าน | source | pending | server config + confirmation API |
| Checkout create/readback transport | implemented | local HTTP response-loss ผ่าน | source | Stripe actual pending | orphan/recovery lookup และ redirect proof |
| Accepted-intent worker | wired behind separate disabled flag | PG + HTTP worker ผ่าน | process lifecycle pending | pending | poll open/complete sessions และ binding |
| Customer-facing Checkout/API/UI | ยังไม่ครบ | pending | pending | policy/ราคา pending | deliberate confirm, polling, safe redirect |
| Subscription/payment/seat entitlement | ยังไม่ครบ runtime | pending | pending | pending | independently verified binding/invoice + membership transaction |

ยังไม่มี current-session periodic reconciliation หลัง session_open/awaiting_verification, recovery lookup เมื่อ first create response ไม่ชัดเกิน 23h, orphan expiry/re-authorization, หรือ final price/seat/subscription fence ที่ปิด flow ครบ. เก็บ accepted intent ไว้และคง checkout availability/payment_verified false. หน้ากลับจาก Stripeไม่เปิดสิทธิ์. Financial retention/restore, trial/seat/prorate/downgrade/grace/portal และ G1–G6 external gates ยังเป็นงานต่อ.

หลักฐาน `output/team-closure-2026-10-13/stripe-checkout-request-local.json`; source uncommitted base382c92e บน codex branch. ไม่ commit/push หรือใช้ Stripe จริง, ไม่เปิด Docker. Build target เดิม 5,261,972 KiB (~5.02 GiB), ก่อนงาน 5,258,280 KiB; cache ของ Goal ที่ active คงไว้. References: [Checkout create](https://docs.stripe.com/api/checkout/sessions/create?api-version=2025-04-30.basil), [Stripe idempotency behavior](https://docs.stripe.com/api/idempotent_requests).

## G5 Session polling + verified subscription identity binding — 15 ต.ค. 2026

ต่อ worker ให้ติดตาม `session_open`/`awaiting_verification` ด้วย Session ID ที่บันทึกแล้ว ใช้ GET ไม่เริ่ม POST ใหม่แม้ quote/catalog เปลี่ยนหรือพ้น 23 ชั่วโมงของ safe create retry. ตรวจ account/customer/Owner และ request hash ต่อไป; ไม่ใช้เวลาบนเครื่องตัดสินว่า Session ฝั่ง Stripe หมดอายุ. `404` พัก recovery_required และยังจอง operation เดิม ไม่อนุญาตซื้อซ้ำจากการหาไม่พบ.

Session ใหม่ที่ผ่าน POST/GET verification บันทึก receipt ก่อนเริ่มตรวจ subscription ใน tick ถัดไป เพื่อตัด dependency ที่อาจทำให้สูญเสีย identity เมื่อ subscription API ล่ม. Session complete ที่พบ 5xx คง awaiting_verification; receipt เก่าที่กลับมา open ถูกปฏิเสธ. คง shared account lease/cooldown และ Retry-After เดิม.

ก่อนผูก subscription ตรวจ operation metadata, customer/account/mode, Price/currency/amount/quantity เทียบ accepted quote; อ่าน subscription → Session → subscription เพื่อตรวจการเปลี่ยนแปลงที่สังเกตได้ ไม่อ้างว่าเป็น provider snapshot แบบ atomic. บันทึก binding, receipt และงาน reconcile ใน transaction เดียว. หาก Owner ถูกถอนสิทธิ์จะคง provider identity เป็น owner_changed โดยไม่ผูกหรือเปิดสิทธิ์. Binding หมายถึงยืนยันความสัมพันธ์กับองค์กรเท่านั้น **ไม่ได้ยืนยัน payment หรือเปิด paid analytics**; subscription incomplete/unpaid ไม่ถูกแปลงเป็น paid.

| รายการ | พัฒนา | local tests | artifact/native | live | งานต่อไป |
|---|---|---|---|---|---|
| Known Session polling + receipt-before-subscription | implemented | PG/HTTP restart/failure ผ่าน | source only | pending | process/staging lifecycle |
| Verified subscription identity + atomic scheduling | implemented | parser/PG/HTTP ผ่าน | source only | pending | payment/entitlement และ seat transaction |
| Unknown Session/orphan recovery หลัง create ไม่ชัดเจน | ยังไม่ครบ | ไม่รับรอง | pending | pending | read-only lookup/recovery ที่ไม่สร้างซ้ำ |
| Confirmation/redirect API/UI | ยังไม่ครบ | pending | pending | policy/price pending | explicit confirmation และ safe redirect |
| Trial/seats/prorate/downgrade/grace/portal | ยังไม่ครบ | pending | pending | pending | implementation ต่อจาก proof นี้ |

ผลตรวจ: **server 455 passed / 44 ignored**, native PostgreSQL/loopback **5 tests passed**, strict workspace/all-target Clippy ผ่าน. Native fixture timestamp `2026-10-15T02:13:00.557375+00:00`; เพิ่มกรณี known-session polling หลัง catalog เปลี่ยน/เกิน create deadline, injected binding failure, completed receipt ก่อน subscription 503, complete-to-open rejection, 404 reservation และไม่เปิด payment. ฐานข้อมูลทดสอบหยุดและลบแล้ว; ไม่เปิด Docker. UI ไม่เปลี่ยนในรอบนี้ จึงไม่อ้างว่ารัน browser ใหม่.

หลักฐาน `output/team-closure-2026-10-13/stripe-checkout-binding-local.json` พร้อม hashes/logs. Source ยัง uncommitted บน codex branch base382c92e; ไม่ได้รวม candidate หรือ push. Reused target จาก 5,261,972 เป็น 5,262,436 KiB (~5.02 GiB), เก็บ bounded cache สำหรับ Goal ที่ยัง active. Financial retention/restore, actual Stripe และ external gates ยัง pending; checkout/production readiness false. G1–G6 ยังไม่ปิดครบ.

## G5 Unknown Checkout identity recovery — 15 ต.ค. 2026

เพิ่มทางกู้ accepted intent ที่ไม่มี Session ID หลังพ้น safe-create window 23 ชั่วโมง โดยเปลี่ยนเป็น read-only lookup; รองรับ incident เดิม `idempotency_window_unconfirmed` ด้วย. ตรวจ Owner/customer/account/mode/request proof ตามเดิม และใช้ accepted catalog terms สำหรับการตรวจหลักฐาน แม้ catalog ปัจจุบันเปลี่ยนแล้ว. ไม่แก้ frozen request หรือสร้าง operation ใหม่. `create_checkout_session` ปฏิเสธ lookup-only claim.

Lookup ใช้ [Stripe list Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/list?api-version=2025-04-30.basil) กรอง customer, pagination ครั้งละ 100 สูงสุด 5 หน้า/claim. ตรวจ identity ทุกหน้าและ cursor ไม่ซ้ำ; จับคู่ทั้ง operation metadata และ client_reference_id. ต้องจบ scan และมี candidate เดียวจึง GET Session นั้นอีกครั้งเพื่อตรวจ package/identity/status ตาม contract เดิม ก่อนบันทึก receipt. ไม่เก็บ raw list, hosted URL หรือ customer details. Provider list ไม่ใช่ atomic snapshot และผลนี้ไม่อ้างการรับรอง live.

ไม่พบ → `checkout_not_found_unconfirmed`; หลายรายการ → `checkout_candidates_ambiguous`; ยังมีหน้าถัดไปหลังครบงบ → `checkout_lookup_limit`. ทุกกรณียังคง operation/reservation และพัก recovery_required ไม่สร้าง Checkout ใหม่ ไม่ถือว่าหมดอายุหรือจ่ายสำเร็จ. Scope/contract errors และ network/429 ใช้ failure/cooldown เดิม. การกู้ที่พบ complete จะบันทึก Session ก่อนตรวจ subscription ใน tick ถัดไปเช่นเดิม.

ผลตรวจ **native PG/HTTP 5 tests, server 455 passed / 44 ignored และ strict all-target Clippy ผ่าน**. Fixture ครอบคลุม missing, ambiguous, page budget, wrong customer, candidate เดียวพร้อม GET, catalog เปลี่ยน และ assert จำนวน POST ไม่เพิ่มระหว่าง lookup ทุกแบบ. ครั้งแรก fixture ใช้ชื่อ error ผิดจาก contract (`scope_mismatch` แทน `provider_scope_mismatch`); แก้ค่าคาดหวังให้ตรงรหัสเดิมและรันผ่านโดยคงการปฏิเสธ scope. เก็บ failure log ไว้ ไม่กลบผลก่อนหน้า.

| รายการ | พัฒนา | local tests | artifact/native | live | งานต่อไป |
|---|---|---|---|---|---|
| Unknown Session lookup หลัง safe window | implemented | PG/HTTP ผ่าน | source only | pending | real Stripe staging |
| Missing/ambiguous/limit dispositions | implemented | reservation/no-POST ผ่าน | source only | pending | Owner reauthorization + incident UI |
| Confirmation/redirect + payment/seat entitlement | ยังไม่ครบ | pending | pending | policy/prices pending | ทำ full customer-facing flow |

Native checked_at `2026-10-15T08:25:54.958903+00:00`; หลักฐาน `output/team-closure-2026-10-13/stripe-checkout-recovery-local.json`. ฐาน fixture หยุด/ลบแล้ว ไม่มี Docker. Target เดิมจาก 5,262,436 → 5,262,764 KiB (~5.02 GiB), คง cache สำหรับ Goal active. Source ยัง uncommitted base382c92e บน codex branch ไม่รวม candidate ไม่ push. ยังต้องทำ UI ให้ Owner ขอ lookup ซ้ำ/จัดการ scope-change ได้โดยไม่แก้ DB และ review เมื่อเกินขอบเขต 500 Sessions; กรณีเหล่านี้คง parked. Checkout/production readiness false; G1–G6 ยังไม่ผ่านครบ.

## G5 Owner Checkout status/recovery API + UI — 15 ต.ค. 2026

เพิ่ม `GET /api/v2/organizations/:id/billing/checkout` สำหรับสถานะล่าสุดใน account/mode ของ server และ `POST .../checkout/recover` สำหรับยืนยัน lookup ซ้ำด้วย operation/revision. ใช้ session authentication, current Owner permission, private/no-store และข้อความ error ที่ไม่ส่ง provider body/credential. ไม่มี endpoint สร้าง purchase ใหม่เพิ่มในรอบนี้.

Migration049 เพิ่ม durable lookup-only, recovery actor และ authorization audit. Recovery ใช้ org transaction lock, CAS, ปฏิเสธ live lease โดยเทียบเวลาฐานข้อมูล และบันทึกการอนุมัติกับ state ใน transaction เดียว. ไม่แก้ initiator/quote เดิม; Owner คนใหม่อนุมัติการอ่านหลักฐานเดิมได้หลังตรวจ customer/org/account/mode/current permission. Customer identity/revision เปลี่ยนจนไม่ตรง quote ยังถูกพักไว้ ไม่ย้ายข้ามบัญชี. Retry-After และ account cooldown ไม่ถูกล้างจากการกดปุ่ม. Worker ตรวจสิทธิ์อีกครั้งทั้งก่อน claim และรับ receipt; ถอนสิทธิ์กลางงานคง owner_changed ไม่เปิด binding/paid access.

เพิ่ม Existing Checkout panel ใน Billing: เปิดดูอย่างตั้งใจ, poll15s เฉพาะเปิด, user/org query keys + scoped remount, operation/revision-bound confirmation, clear confirmation หลัง mutation/reload/close. ระหว่างโหลดหรือ error ไม่แสดงข้อมูลเดิม; null แสดงไม่มี request ไม่ใช้เป็น paid state. Bound แสดงเพียงยืนยัน subscription identity และบอกว่า payment/paid access ยังไม่ยืนยัน. ปุ่ม recovery ส่ง lookup-only ไม่มีการสร้างหรืออนุมัติ charge ใหม่.

ผลตรวจ **native PG/HTTP5, server455 passed/44 ignored, component17 (ใหม่ Checkout5 + Customer5 + Quote7), TypeScript, scoped production ESLint และ strict all-target Clippy ผ่าน**. เพิ่มข้อทดสอบ new Owner, cross-account/admin rejection, stale revision, concurrent recovery, injected audit write failure, live lease, retry deadline, original actor preservation, explicit lookup-only ก่อน23h และ owner revocation หลัง claim. Component ตรวจ confirmation/conflict/account-org switch/permission loss/null/bound. การเขียนไฟล์ test ครั้งแรกใช้ path ซ้ำกับ cwd ทำให้ไม่สร้างไฟล์; แก้ path และรันไฟล์จริงแล้ว. Lint import/type ordering แก้ตามกฎเดิม; test files ใช้ Vitest ตาม scope ที่ ESLint config กำหนด.

| รายการ | พัฒนา | local tests | artifact/native | live | งานต่อไป |
|---|---|---|---|---|---|
| Owner recovery CAS/audit + lease/identity | implemented | PG/HTTP ผ่าน | source | pending | actual staging/fault/restore |
| Status/recover API + Billing UI | implemented | compile/components ผ่าน | browser pending | pending | authenticated HTTP/browser flow |
| First purchase confirm/redirect | ยังไม่ครบ | pending | pending | policy/prices pending | ต่อ accepted intent จาก UI |
| Payment/seat/financial lifecycle | ยังไม่ครบ | pending | pending | pending | payment fence, seats, trial/upgrade/downgrade/grace/portal |

Evidence `output/team-closure-2026-10-13/stripe-checkout-owner-local.json`; native timestamp `2026-10-15T08:41:11.996098+00:00`. ฐานจำลองหยุด/ลบแล้ว ไม่มี Docker. Reused target 5,262,764 → 5,263,044 KiB (~5.02 GiB), คง cache ที่ใช้ต่อใน Goal. Source ยัง uncommitted บน codex branch/base382c92e ไม่ใช่ candidate และไม่มี push. การตรวจด้วย fixtures ไม่เท่ากับ full HTTP/browser/live Stripe; financial retention/restore ของ audit ใหม่ยังอยู่ในงาน G5 ที่ต้องปิด. Checkout/production readiness false, Goal G1–G6 active.

## G5 Test Checkout confirmation API/UI — 15 ต.ค. 2026

ต่อ `POST /api/v2/organizations/:id/billing/checkout` จาก Owner session → service → durable intent repository เดิม. รับเพียง quote ID กับ explicit confirm; ไม่มี browser-supplied actor/customer/return URL/price. Recheck current Owner/customer/catalog/quote expiry และเก็บ frozen policy ก่อน worker POST. Quote เดิมคืน operation เดิมภายใต้ข้อกำหนด identity/catalog; response loss ไม่เปลี่ยน ID. ยังไม่ได้เพิ่ม hosted redirect หรือให้สิทธิ์ paid จาก accepted intent.

เปิดได้เฉพาะ **test mode** ด้วย `ATOAXIS_TEAM_STRIPE_TEST_CHECKOUT_ENABLED=1/true` และ `ATOAXIS_STRIPE_CHECKOUT_POLICY_PATH` ที่อนุมัติ/valid. Live mode ถูกปฏิเสธแม้เปิด internal flag; เป็นการปิด launch gate ที่ยังไม่ผ่าน ไม่ใช่การตัด live ออกจากเป้าหมาย. คง `checkout_available=false` และเพิ่ม `test_checkout_confirmation_available` ใน quote; client เก่าที่ไม่มี field คง preview-only. Policy ไม่พร้อมไม่ทำให้การดูราคาอย่างเดียวใช้ไม่ได้. ไม่มีการตั้ง policy/ราคา/credentials จริงให้เจ้าของ.

UI แสดง test-only confirmation จากราคาที่ GET ยืนยันแล้ว ต้องเลือก checkbox ก่อนส่ง; ราคา/จำนวนที่นั่ง/ช่วงรายเดือนแสดงตรง quote, final tax/total ยังคง unavailable จนดู Checkout. Retry ใช้ quote เดิม; account/org/quote เปลี่ยนแล้วล้าง confirmation. เมื่อ 400/403/404/409 ให้ล้าง confirmation และ revalidate quote. Accepted response แสดงเพียง saved request และให้เปิด Existing Checkout เพื่อติดตาม ไม่ redirect จาก URL ที่ไม่ตรวจและไม่อ้างว่าชำระแล้ว.

ผลตรวจ **server456 passed/44 ignored, native PG/HTTP5, component23, TypeScript, scoped ESLint, strict Clippy ผ่าน**. เพิ่ม pure test สำหรับ explicit flag/live rejection และ component tests สำหรับ absent capability, explicit consent, same-quote retry, scope reset, expiry, permission loss รวมการเชื่อม parent price panel. Native tests ยืนยัน durable request/identity/deadline behavior เดิม; full authenticated HTTP/browser flow ยังไม่ได้รับรอง. Test setup รอบแรกคืน mock เป็น cleanup ทำให้ test failure หลัง case จบ; แก้ beforeEach ให้ไม่คืนค่าและรันผ่านจริง. คำสั่ง formatter ที่เริ่มจาก cwd ผิดหยุดแล้วและใช้ dependency เดิมใน frontend/app; ไม่มีการเพิ่ม package.

| รายการ | พัฒนา | local tests | artifact/native | live | งานต่อไป |
|---|---|---|---|---|---|
| Owner quote → durable test confirmation | implemented | PG/contract/components ผ่าน | source | staging pending | hosted URL/readback + UI continuation |
| Test-only capability/policy gate | implemented/default off | pure/compile ผ่าน | source | ไม่มี config จริง | owner policy/prices + isolated staging |
| Live Checkout + verified payment/seats | ยังไม่ครบ | pending | pending | pending | payment/seat fence และ launch gates |

Evidence `output/team-closure-2026-10-13/stripe-test-checkout-local.json`; native timestamp `2026-10-15T08:50:51.406328+00:00`. Native PG หยุด/ลบแล้ว ไม่เปิด Docker. Target เดิม 5,263,044 → 5,263,164 KiB (~5.02 GiB) คง bounded cache ของ Goal active. Source ยัง uncommitted codex/base382c92e ไม่รวม candidate ไม่ push. Full flow ยังเหลือ hosted redirect/return, payment/seats/trial/prorate/downgrade/grace/portal, financial retention/restore และ actual staging; G1–G6/production ยังไม่ผ่านครบ.

## G5 Fresh hosted test Checkout destination — 16 ต.ค. 2026

เพิ่ม `POST /api/v2/organizations/:id/billing/checkout/destination` รับ operation/revision/explicit confirm จาก Owner session. เปิดเฉพาะ internal test-mode policy เดิม; live ยังคงปิด. อ่าน proof จาก Session ที่บันทึกแล้วและอยู่ session_open, ตรวจ customer/accepted quote/frozen request hash แล้ว GET Stripe resource ใหม่ภายใต้ shared account lease/cooldown. หลัง network ตรวจ Owner/customer/operation/revision/request proof และ test policy ซ้ำก่อนตอบ no-store. ไม่มี transaction ค้างขณะ HTTP และไม่สร้าง Checkout จากคำขอลิงก์.

Provider contract ตรวจ Session ID, account/mode, customer, operation, base package/quantity, open status และ expiry; URL ต้องเป็น ASCII HTTPS `checkout.stripe.com/c/pay/<exact Session ID>` ไม่มี userinfo/port/query/path normalization trick. Fragment ของ hosted URL รักษาไว้ในหน่วยความจำเพื่อเปิดหน้าที่ provider ส่งมา. URL ไม่เข้าสู่ intent/receipt DB, diagnostics หรือ audit. เป็น browser response ที่มีสิทธิ์เฉพาะ ไม่ใช่หลักฐาน payment. อ้างอิง [Stripe Checkout Session object](https://docs.stripe.com/api/checkout/sessions/object?api-version=2025-04-30.basil).

UI แสดงปุ่ม Get test Checkout link เฉพาะ session_open พร้อม additive server capability. ขอใหม่เมื่อกด, ตรวจ operation/URL/expiry ซ้ำ, แสดง link ไม่เกิน30วินาที (หรือ provider expiry ที่เร็วกกว่า), เปิดด้วย noopener/noreferrer/no-referrer. Account/org/operation/revision เปลี่ยนแล้ว remount ล้างลิงก์; permission failure/pending ไม่แสดงลิงก์เก่า. ไม่เก็บ URL ใน persisted query/cache; mutation ใช้ gcTime0 และ reset เมื่อครบเวลา. Existing PostHog config allowlist เฉพาะ `[data-ph-capture]`; link นี้ไม่ opt in. Provider snapshot ไม่ atomic; การตรวจเป็น current readback + local recheck ไม่ใช่การรับประกันสถานะจะไม่เปลี่ยนหลังตอบ.

ผลตรวจ **server457 passed/44 ignored, native PG/HTTP5, component29, TypeScript, scoped ESLint และ strict all-target Clippy ผ่าน**. Native ตรวจ invalid URL marker/fresh valid readback, wrong account/revision, Owner revoked หลังอ่าน และยืนยัน URL ไม่อยู่ใน stored intent. Pure test ตรวจ host/path/session spoof, userinfo, explicit port, query, control characters, closed/expired. Component ตรวจ capability, click-only lookup, malformed/other-operation/expired response, scope/revision switch, permission failure, 30s expiry และ parent status integration.

คำสั่งเพิ่ม tests รอบ15ต.ค.ไม่ได้ทำงานเพราะ automatic approval review ถึง usage limit (ไม่ใช่ unsafe verdict); ตรวจไฟล์แล้ว retryสำเร็จ16ต.ค. ไม่มีการ bypass approval. UI lint พบ unsafe-regex จึงเปลี่ยนเป็น prefix/ID/character validation และใช้ codePointAt/curly ตามกฎเดิม ไม่ suppress. Full HTTP/browser และ Stripe จริงยังไม่ได้ทดสอบ; raw return/cancel query ไม่ถูกใช้เปิดสิทธิ์. Landing page เดิมยังต้องตรวจ usability/การเลือกองค์กร/refresh หลังกลับใน staging.

| รายการ | พัฒนา | local tests | artifact/native | live | งานต่อไป |
|---|---|---|---|---|---|
| Fresh hosted destination + local read fence | implemented test-only | parser/PG/HTTP ผ่าน | source only | pending | authenticated HTTP/browser staging |
| Ephemeral hosted link UI | implemented | component/type/lint ผ่าน | browser pending | pending | real Checkout/return smoke |
| Payment/seat/financial lifecycle | ยังไม่ครบ | pending | pending | pending | independent paid invoice + transactional entitlement |

Evidence `output/team-closure-2026-10-13/stripe-hosted-checkout-local.json`; native timestamp `2026-10-16T03:37:33.029298+00:00`. Fixture PGหยุด/ลบแล้ว ไม่เปิด Docker. Target ที่ตรวจต้นรอบ 5,249,904 → 5,263,404 KiB (~5.02 GiB); ใช้ cache เดิมของ Goal active ไม่มี target/worktree เพิ่ม. Source uncommitted codex/base382c92e ไม่รวม candidate ไม่ push. Actual prices/config, live readiness และ G1–G6 external gates ยังคง pending; checkout/production=false.

## G5 Accepted-package invoice assessment — 16 ต.ค. 2026

เพิ่ม migration050 `payment_assessment` แบบ additive และ `team_stripe_payment` policy. Worker reconciliation เดิมอ่าน quote ที่ Owner ยืนยันและ Checkout ผูก subscription แล้ว ภายใต้ account/mode/customer/organization เดียวกัน ตรวจราคา/currency/quantity1/package10–100, subscription active, invoice settled และ line ของ subscription item/price/ช่วงบริการตรงกัน. ต้องมี full-period non-proration line; partial/credit conflict/unknown amount/ราคาที่เปลี่ยนยัง unconfirmed. Invoice settled อาจมาจาก credit หรือยอดศูนย์ ไม่อ้างว่าได้รับเงินสด. ไม่ใช้ checkout return หรือ notification อย่างเดียวเปิดสิทธิ์. อ้างอิง [Stripe subscription lifecycle](https://docs.stripe.com/billing/subscriptions/overview) และ [Invoice object](https://docs.stripe.com/api/invoices/object?api-version=2025-04-30.basil).

Assessment, normalized invoice/snapshot และ applied job revision commit พร้อมกัน; DB failure ไม่ ACK งาน. มี calculation version, mode, nullable covered period/package seats และเวลา observation. Existing Owner-only Checkout status/latest เพิ่ม optional invoice_assessment; ตรวจ binding enabled/revision และ requested/applied revision ก่อนแสดง มี event ใหม่รอหรือ observation เกิน5นาที/future/coverage expired เป็น unconfirmed. UI แยก test/live, invoice evidence และ paid access; ตั้งเวลาเลิกแสดง settled แม้ไม่มี poll พร้อมซ่อนหลักฐานเก่าเมื่อ permission/load ล้มเหลว. fieldเดิม payment_verified คง false; access_granted=false. **การตรวจใบแจ้งหนี้ครบในขอบเขตนี้ ไม่ใช่การส่งมอบ transactional entitlement/seat admission แล้ว**; จุดนั้นยังเป็นงานต่อไปก่อน commercial runtime ใช้งานได้.

ผลตรวจ: server **461 passed,44 ignored**, native PG/HTTP **5 passed**, UI **15 passed/2files**, TypeScript/scoped ESLint/strict workspace all-target Clippy ผ่าน. Native ครอบคลุม atomic rollback ของ assessment, duplicate completion, wrong account/mode, disabled binding, pending webhook และ stale; pure testsครอบคลุมทุก non-active state/term mismatch/unknown/partial/proration/credit/future/version. UI testsรวม expiry โดยไม่pollและ Owner revoked reload. ระหว่างพัฒนาพบ mode variable วางผิดscopeในcomponent; แก้แล้วรัน final tests ผ่าน ไม่มี warning suppression.

| รายการ | พัฒนา | local | actual staging | งานถัดไป |
|---|---|---|---|---|
| Invoice coverage เทียบ accepted package | เสร็จในขอบเขตนี้ | pure/PG/HTTP ผ่าน | pending | actual Stripe fixture/HTTP browser |
| Owner invoice evidence UI | เสร็จ | component/types/lint ผ่าน | pending | return/reload browser flow |
| Paid entitlement + transactional seats | ยังไม่เสร็จ | pending | pending | เชื่อม grant/revoke กับ member admission และ scope |
| Trial/prorate/downgrade/grace/portal | ยังไม่ครบ | pending | pending | ดำเนินตาม G5 ledger |

Evidence: `output/team-closure-2026-10-13/stripe-payment-assessment-local.json`. Native run `2026-10-16T04:20:46.179546+00:00`; PostgreSQL fixture stopped/removed, ไม่เปิด Docker. Targetเดิม5,263,404→5,263,968KiB (~5.02GiB), คง bounded cache สำหรับ Goal active. ไม่สร้าง worktree/targetใหม่. Sourceยัง uncommitted บน codex/heartbeat-capture-release base382c92e; ไม่ push. `git diff --check` พบ trailing whitespace เดิมใน analytics/projects/[projectId]/page.tsx ที่เป็นงานอื่น จึงไม่แก้. ราคา/Cloud/Windows/ผู้ทดสอบและ external gates ยังคงpending; production/checkout=false, Goal active.

## G5 Transactional accepted-package seat admission — 17 ต.ค. 2026

เพิ่ม `repository/team_seats.rs` ใช้ advisory transaction lock `team-billing:{org}` ร่วมกับ Checkout ก่อนเพิ่ม/คืน developer membership. ความจุมาจาก quote ของ accepted Checkout ที่ยังไม่ expired (รวม ambiguous/owner_changed/bound ซึ่งยังสงวนแพ็กเกจไว้); ไม่ใช้ invoice assessment เป็นสิทธิ์ชำระเงินและไม่ปลดความจุเมื่อ response หาย. องค์กรที่ยังไม่มี accepted purchase คงพฤติกรรมเดิมจน trial/entitlement runtime เสร็จ.

ต่อ guard กับ OrganizationsService add_member/accept_invite, SCIM upsert และ personal membership restoration. Admin mutation rechecks permission ผ่าน AuthorizationService ภายใน transaction. Invite ตรวจ scope/expiry/account/organization ก่อนรับ; capacity failure rollback สถานะ invite จึงไม่เกิด accepted ที่ไม่มี membership. SCIM user/email/membership อยู่ transaction เดียว. Viewer ไม่นับ quota; developer ที่บัญชีถูกปิดชั่วคราวยังสงวนที่นั่งจน membership ถูกถอด/deactivate และ Checkout capacity ใช้นิยามเดียวกัน. Existing developer retry ไม่ใช้ quotaเพิ่ม. ไม่มี HTTP/provider request ค้างใน transaction.

Local evidence: server461 passed/44ignored; strict workspace all-target Clippyผ่าน; native PG/HTTP5ผ่าน (source hashesตรง). Nativeเพิ่มการทดสอบผ่าน actual member service: แย่งที่นั่งสุดท้ายสองคำขอได้หนึ่ง, เพิ่มสมาชิกเดิมซ้ำ, inactive accountไม่คืนโควตา, full inviteยังpending, เปลี่ยนviewerคืนที่นั่งและรับinviteได้. SCIMจริง/personal restore integration/mixed Checkout concurrency fault matrix/full HTTP-browser ยังไม่รับรองจากผลชุดนี้. การถอดสมาชิก/auditเดิมและ full commercial transaction lifecycleยังต้องตรวจในชุดถัดไป.

| รายการ | พัฒนา | local | รอ/งานต่อ |
|---|---|---|---|
| Accepted-package seat guard + member/invite wiring | implemented | concurrent PGผ่าน | fault matrixเพิ่มและ UIข้อผิดพลาด |
| SCIM/personal restoration guard | wired/compileผ่าน | runtimeเฉพาะเส้นทาง pending | isolated lifecycle tests; SCIM featureคงปิด |
| Paid analytics entitlement/trial/grace/package changes | ยังไม่ครบ | pending | เชื่อมกับ accepted invoice และ admission history |

Evidence `output/team-closure-2026-10-13/stripe-seat-admission-local.json`; nativeตรวจ2026-10-16T19:05:40Z (17ต.ค. Bangkok), DBทดสอบหยุด/ลบแล้ว ไม่เปิดDocker. Targetเดิม5,247,648→5,264,216KiB (~5.02GiB), bounded cache ของ active Goal. Sourceยังuncommittedบนcodex/heartbeat-capture-release; ไม่commit/push/main. ไม่เปลี่ยนheartbeat/duration/capture. Production/checkout=false; G1–G6ยังactive. การขอ Astra review ก่อนรอบนี้ไม่มีผลตอบกลับที่ตรวจได้และ agent ไม่อยู่แล้ว จึงไม่ใช้เป็นหลักฐาน reviewผ่าน.

## G5 Membership audit atomicity — 17 ต.ค. 2026

เพิ่ม fault regression ก่อนแก้ และพบจริงว่า `organization.member_upserted` audit เขียนไม่ได้แล้ว APIคืนerrorแต่ membership ถูกcommitไปแล้ว (`atoaxis-stripe-28855102b3fb4648bd8fe8fefcb618e9/stripe_checkout_confirmation_durability.log`). แก้ add_member, accept_invite และ remove_member ให้ audit อยู่ transactionเดียวกับการเปลี่ยนสมาชิก/คำเชิญ/ที่นั่ง. Admin removal ใช้ lockร่วมกับ admission/Checkout และ recheck authorizationกลาง; target account active/deletedถูกตรวจและล็อกภายใน transaction. Inviteล็อก account/organization ระหว่างยืนยันด้วย. ไม่เปลี่ยนสูตรduration/heartbeat/usage.

หลังแก้ native PG/HTTP5ผ่าน รวม audit failure ของทั้งสามเส้นทาง, inviteกลับpending, ไม่มีmemberหลงเหลือ, removal failureไม่คืนที่นั่ง, removalretryไม่เพิ่มauditซ้ำ; server461ผ่าน/44ignored และstrict workspace all-targetClippyผ่าน. Sourcehashตรงกับnative run2026-10-16T19:11:25Z. ฐานจำลองหยุด/ลบแล้ว ไม่เปิดDocker. Evidence `output/team-closure-2026-10-13/stripe-member-atomic-local.json`.

ขอบเขตผลผ่าน: database mutation+audit atomic. สำเนา privacy ledger ภายนอกยังทำหลังcommitตามเดิม; mirrorล้มเหลวยังเป็น committed-change/retry condition ไม่อ้างว่าข้ามdatabase/filesystem atomic. Recoveryของmirror, fullHTTP/browser และ concurrencyกับlifecycleอื่นยังเป็นงานตรวจต่อ. Paid entitlement/trial/grace/prorate/downgrade/portalยังไม่ครบ. Targetเดิม5,264,216→5,264,224KiB(~5.02GiB), คง cacheของGoal active. ไม่มีcommit/push/newtarget/worktree; production/checkout=false.

## G5 Prospective entitlement history + branch integration — 18 ต.ค. 2026

งานถูกเจ้าของเก็บใน `04daf024` และย้ายไป `codex/team-closure-wip` แล้ว; branch นี้เป็นที่ทำงานต่อ. รวม local `main` (`a49709f3`) เข้ามา: Git พบ explicit conflicts 6 ไฟล์ ไม่ใช่ 7; `team_insights.rs` auto-merge อีกหนึ่งไฟล์และตรวจแล้วว่าเก็บ G4 methods พร้อม error mapping ใหม่ครบ. Environment รวม settings ทั้งสองฝั่ง, Team page เก็บ panels ทั้งหมด, marketing ใช้โครงใหม่จาก main; งานเก่ายังอยู่ใน WIP commit. Cached `origin/main` (`dcba879e`) ใหม่กว่า local main อีก 2 commits ของ Journal ACK และยังไม่รวมใน merge นี้. ไม่อัปเดต/push main.

เพิ่ม migration051 และ policy/repository สำหรับ trial 14 วันครั้งเดียว (package ต้องระบุอย่างชัดเจน), coverage history/revision ถาวร และช่วง paid/grace ที่ไม่เติม gap ย้อนหลัง. Worker ต่อ financial observation + coverage history + ACK ใน transaction เดียวกัน; ไม่มี row activation เดิมจะไม่สร้าง trial/สิทธิ์จาก webhook. การหมดอายุประเมินตาม deadline; snapshot เก่าไม่ยืดสิทธิ์ แต่ไม่ล้างช่วงที่เคยยืนยันแล้ว. Effective cancellation ปิด future coverage; `cancel_at_period_end` รักษาถึงปลายช่วง. Provider-day ต้อง coverage ครบทั้งวันและไม่มีช่องว่าง.

Astra design/review พบและแก้สองจุด: grace ต้องผ่าน accepted-package proof และ first failure ต้องมาจาก unresolved episode ทั้ง subscription ไม่ใช่เฉพาะ latest invoice. เพิ่ม regression ที่มีสองใบแจ้งหนี้ล้มเหลวก่อน reconcile ครั้งแรก, package mismatch และ replay ของ failure ที่ resolved แล้ว. แก้ worker lease ใช้ `clock_timestamp()` หลังรอ billing lock พร้อมตรวจซ้ำหลัง binding/ก่อน ACK; expired result rollback ทั้งชุด. Review follow-up หลังแก้ยังไม่มีคำตอบยืนยัน จึงไม่อ้าง independent final review pass.

| รายการ | พัฒนา | Local evidence | ยังเหลือ |
|---|---|---|---|
| Trial/paid/grace state + durable history | internal primitive และ worker hook เสร็จ | pure + native PG ผ่าน | activation API/UI และ restore proof |
| Package/episode/scope/replay/lease checks | เสร็จในขอบเขตนี้ | regression ผ่าน | provider actual/staging |
| เพิ่ม/อ่าน analytics ตาม billing | ยังไม่ครบ | ยังไม่เปิด runtime grant | admission receipts/worker และ common report/receipt/CSV fence |
| Copilot billing | coverage predicate เท่านั้น | whole-day/gap pure tests | daily connector admission + retained report |

ผลหลัง merge: server **469 passed / 46 ignored**, native PostgreSQL/HTTP **6 ชุด**, frontend **152 tests / 13 files**, TypeScript, scoped ESLint และ strict workspace/all-target Clippy ผ่าน. Queue filter **42 unit + 1 integration ผ่าน** รวม fixture1,191รายการ; ไม่อ้าง live drain latency จากผลนี้. การทดสอบ UI รอบแรกติด node_modules เก่าขาด dependencies ของ main; `npm ci --ignore-scripts` ตาม lockfile แล้วผ่าน. ภาวะ sandbox ไม่อนุญาต local HTTP fixture ในรอบก่อนแก้ด้วยสิทธิ์รันทดสอบ loopback; ไม่ตัด test ออก.

Evidence `output/team-closure-2026-10-13/stripe-entitlement-local.json`, native run `2026-10-18T02:29:29.993632+00:00`. ฐานจำลองหยุดและลบแล้ว ไม่มี Docker. ไม่เปิด trial endpoint, live Checkout, paid analytics หรือ production readiness; state history เพียงอย่างเดียวไม่รับรอง admission. Financial retention/restore, prorate/downgrade/portal และ external gates ยัง pending. Goal G1–G6 ยัง active.
