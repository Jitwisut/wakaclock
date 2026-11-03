# AtoAxis Team — รายการส่งต่อทดสอบ

วันที่: 2 พฤศจิกายน 2026 (`Asia/Bangkok`)

## สถานะตอนปิดรอบพัฒนา

เจ้าของให้หยุด Goal รอบนี้ไว้ก่อนและบันทึกงานทดสอบ จึงพัก Goal เป็น
`paused` ไม่ทำเครื่องหมายว่า Goal เดิมทั้งหมด `complete` และไม่เริ่มทดสอบ
จากการเขียนเอกสารนี้ ส่วน Stripe ยังมีงานพัฒนาค้างและพักตามคำสั่งเจ้าของ

- ส่วนไม่รวม Stripe: implementation ต่อแล้ว — รอทดสอบพฤติกรรมและรับรองจริง
- ผ่านแล้วเฉพาะ compile, TypeScript, scoped lint และ static checks ตาม receipts
- รายการทดสอบด้านล่างทั้งหมดเป็น **ยังไม่รันใน snapshot รอบนี้**
- งานล่าสุดยังไม่ commit/push และยังไม่มี clean candidate ครบ 8 artifacts
- ไม่เปิด feature flags, Checkout หรือ production จากผล compile หรือรายงานนี้

แหล่งอ้างอิง:

- [ขอบเขตและ source inventory](atoaxis-team-non-stripe-handoff-2026-11-02.md)
- [Goal และประวัติการตัดสินใจ](atoaxis-team-closure-goal-2026-10-13.md)
- [ข้อกำหนด development-first](atoaxis-team-development-first-2026-10-26.md)

## Source ที่จะนำไปทดสอบ

| รายการ | ค่า |
|---|---|
| Branch | `codex/team-closure-wip` |
| Delivered base commit | `1646cbf6549565b008e9dadebe6ff76ebe221258` |
| สถานะ source | Uncommitted WIP; ไม่ใช่ clean release commit |
| Source snapshot | `output/team-closure-2026-10-13/non-stripe-source-snapshot-2026-11-02.json` |
| จำนวนไฟล์ใน snapshot | 828 |
| Aggregate SHA-256 | `c61cc5f8f92420486840f4a56723a6109995221a072b08d9ea2f7e195d26783a` |

ก่อนเริ่ม ให้เทียบ hashes กับไฟล์ปัจจุบัน หากเปลี่ยน source ต้องบันทึก snapshot
ใหม่และระบุว่าผลใดต้องรันซ้ำ ไม่ใช้ผลจาก commit เก่าแทน source ใหม่
การสร้าง candidate ต้องได้รับอนุญาต commit/push แยก และไม่รวม credential,
private outputs หรือไฟล์ค้างของงานอื่น ห้าม push/merge เข้า `main`

## เงื่อนไขก่อนเริ่ม

- [ ] เจ้าของสั่งเริ่มทดสอบและตกลงชุดที่จะรัน
- [ ] ใช้ checkout/build directory เดิมที่เหมาะสม อ่าน storage policy และวัด
  ขนาดก่อน/หลัง substantial builds; ไม่สร้าง target/worktree ใหม่ต่อคำสั่ง
- [ ] เตรียม PostgreSQL/ClickHouse และบัญชีทดสอบแยกจากข้อมูลส่วนตัว/production
- [ ] เตรียม privacy/enrollment ledgers ของชุดทดสอบ โดยไม่ reset authority เดิม
- [ ] ตรวจ feature configuration และ namespace ด้วย staging preflight
- [ ] เก็บ credential ในช่องทางเดิม ไม่ใส่ในคำสั่งตัวอย่าง รายงาน หรือแชต
- [ ] กำหนดผู้เก็บ expected ledger ที่คำนวณอิสระจากผล API/UI
- [ ] ใช้ Docker เฉพาะ dependencies จำเป็น สลับชุดต้นทาง/restore เพื่อลด
  containers; หลังจบหยุดเฉพาะ services ที่งานนี้เปิดและปิด Docker โดยเก็บ volumes

ชื่อฐานข้อมูล fixture ต้องตรงกับ guard ใน source ก่อนรัน migration:

| Fixture | ฐานข้อมูลแยกที่ source กำหนด |
|---|---|
| Cost equations / readiness | `atoaxis_team_test` |
| Organization birth / Owner recovery / pilot | `atoaxis_team_onboarding_test` |
| No-card trial | `atoaxis_stripe_test` — ชื่อ fixture เดิม ไม่ใช่คำสั่งให้เปิด Stripe จริง |

ตั้ง `POSTGRES_TEST_URL` ให้ตรง fixture ทีละชุด ห้ามใช้ฐานข้อมูลจริงหรือเปลี่ยน
guard เพื่อให้รันได้ การทดสอบที่ใช้ environment ร่วมต้องรันแบบ serial

## T1 — Logic, API contract และ UI ในเครื่อง

สถานะ: **ยังไม่รัน** ใช้ fixtures/mocks ไม่ต้อง login provider จริง

- [ ] ต้นทุนใช้ canonical revision ล่าสุด ไม่คิด usage fact ซ้ำ
- [ ] PR มี usage ที่ได้รับและยืนยันเชื่อมครบราคา จึงเข้าชุดค่าเฉลี่ยแบบ observed
- [ ] แสดง numerator/denominator/rounding ชัดเจน; ไม่อ้างว่าจับกิจกรรมทั้งหมดครบ
- [ ] Unknown price, withheld และ unavailable ไม่เปลี่ยนเป็นศูนย์
- [ ] ไม่รวม usage หลัง merge หรือแจก usage เดียวให้หลาย PR
- [ ] API, receipt, weekly summary และ CSV ใช้นิยามเดียวกัน
- [ ] Copilot ใช้สัปดาห์จันทร์–อาทิตย์ UTC แยกจาก timezone องค์กร
- [ ] สลับบัญชี/session/องค์กร หรือ reload ล้มเหลวแล้วซ่อนข้อมูลเก่า
- [ ] Readiness แยก local/external พร้อมเวลา/build; stored assertion ไม่เท่ากับ certification
- [ ] Trial, onboarding และ pilot คง original request ID และไม่เพิ่มสิทธิ์จาก retry
- [ ] Notification เกิดเฉพาะเปลี่ยนสถานะ/recovery ไม่ซ้ำทุก poll

คำสั่งตัวอย่าง เมื่อเจ้าของให้เริ่มตรวจแล้ว:

จาก `backend/api`:

```sh
cargo test -p wakaclock-server --lib services::team_merged_cost::tests
cargo test -p wakaclock-server --lib services::team_cost_equations::tests
cargo test -p wakaclock-server --lib services::team_release::tests
cargo test -p wakaclock-server --lib services::team_pilot::tests
```

จาก `frontend/app`:

```sh
npm test -- --run test/wakaclock-team-insights.test.tsx test/wakaclock-team-summary.test.tsx test/wakaclock-team-readiness.test.tsx test/wakaclock-team-readiness-endpoints.test.ts
npm test -- --run test/wakaclock-team-organization-creation.test.tsx test/wakaclock-team-organization-recovery.test.tsx test/wakaclock-team-trial.test.tsx test/wakaclock-team-trust.test.tsx test/wakaclock-team-actions.test.tsx
```

ตรวจว่าผลมี test cases รันจริง ไม่ถือว่า exit0 ที่ไม่พบ tests คือผ่าน
เพิ่ม shared session/transport และ regression เดิมที่เกี่ยวข้องตาม source
โดยไม่เปิด Stripe suites ทั้งหมดอัตโนมัติ Strict Clippy ยังต้องรันแยกภายหลัง

เกณฑ์ผ่าน: assertions ตามนิยามผ่าน ไม่มี warning ที่ suppress เพื่อกลบปัญหา
และผล UI/CSV สอดคล้องกับ expected ledger อิสระ

## T2 — ฐานข้อมูล, สิทธิ์ และความเป็นส่วนตัว

สถานะ: **ยังไม่รัน** ต้องใช้ isolated databases และ ledgers

- [ ] ข้ามองค์กร/ทีม/repository ไม่ได้; Owner/Admin ข้าม consent ไม่ได้
- [ ] Consent เริ่มมีผลตามเวลายืนยัน ไม่ดึงประวัติส่วนตัวก่อนหน้าอัตโนมัติ
- [ ] ถอน consent/ถอดสมาชิกระหว่างอ่านหรือ export แล้วผลถูกระงับ
- [ ] ผู้ร่วมข้อมูล 4 คนถูก withheld; 5 คนผ่านเฉพาะมุมมองที่ปลอดภัยจริง
- [ ] ตรวจยอดหลัก/ย่อย ทีมซ้อน provider/model และหลายผู้ดูร่วมกัน
- [ ] Exact numerator/denominator ไม่เปิดสมการที่อนุมานกลุ่มเล็กได้
- [ ] Correction/เปลี่ยน link/ถอน consent ยกเลิกสัปดาห์ที่เผยแพร่แล้ว
  ไม่เผยแพร่ยอดแก้ซ้ำให้ลบตัวเลขหาเจ้าของได้
- [ ] Context มาก่อน canonical session/usage อยู่ pending และ retry ได้
- [ ] Onboarding/first-sync/Owner transfer พร้อม admission ไม่มี deadlock
  และไม่สร้างสิทธิ์จากหลักฐานที่ขาดหรือ scope ผิด
- [ ] Retention 12 เดือนปฏิทินครอบคลุมปลายเดือน/ปีอธิกสุรทิน และ derived data
- [ ] Team cleanup ไม่ลบ canonical heartbeat/usage ส่วนบุคคล

ตัวอย่างคำสั่งจาก `backend/api` หลังเลือกฐานข้อมูลให้ตรงตารางข้างต้น:

```sh
cargo test -p wakaclock-server --lib repository::team_cost_equations_tests -- --ignored --test-threads=1
cargo test -p wakaclock-server --lib repository::team_readiness_tests -- --ignored --test-threads=1
```

รัน organization birth/recovery, pilot และ trial SQL suites ตาม
[organization recovery](atoaxis-team-organization-recovery-2026-10-31.md),
[pilot](atoaxis-team-pilot-control-2026-11-01.md) และ
[trial](atoaxis-team-self-service-trial-2026-10-27.md) โดยตรวจ DB guard ก่อนแต่ละชุด
คำสั่ง filter ที่ compile ได้ไม่ใช่หลักฐานว่า ignored tests ถูก execute แล้ว

เกณฑ์ผ่าน: ข้อมูลนอกสิทธิ์ไม่ออกทั้ง JSON/CSV/cache, concurrency ไม่ทำให้
allocation เพิ่มซ้ำ และทุกการเปลี่ยนมีหลักฐาน/checkpoint ที่สอดคล้องกัน

## T3 — Fault, recovery และ restore

สถานะ: **ยังไม่รัน** ใช้ข้อมูลสังเคราะห์และ dependencies แยก

- [ ] Restart ระหว่างรับ/commit/ส่ง; response หายหลัง commit; DB เขียนไม่ได้
- [ ] Accepted event ไม่หาย ไม่เพิ่ม canonical duplicate และใช้ ID/revision เดิม
- [ ] Network/5xx, auth/permission, 429/Retry-After และ private404 แยกกันถูกต้อง
- [ ] Mixed batch ส่งรายการดีได้ และรายการเสียมี disposition ไม่ถูกทิ้ง
- [ ] Queue/journal/cursor recovery ไม่สร้างเวลา หรืออ่านไฟล์ปัจจุบันสร้างอดีต
- [ ] Backup ก่อนถอนสิทธิ์ → restore ไป instance ใหม่ → ใช้ทะเบียนล่าสุดก่อนอ่าน
- [ ] Ledger ล่าสุดขาดหรือไม่สดแล้วปิดการอ่าน Team ไม่สร้าง baseline แทน
- [ ] Worker lease/checkpoint กลับมาทำต่อได้ และ replay ไม่เพิ่มต้นทุนซ้ำ
- [ ] Duration golden input เดิมได้ผลเดิม
- [ ] คิว 1,191 รายการข้ามสามวันระบายใน 2 นาทีตามเงื่อนไข server/request เดิม
- [ ] Marked source/diff/prompt/response/credential ไม่รั่วใน diagnostics/storage/outbound

ใช้ runners ที่มีอยู่หลังตรวจ prerequisites ของ candidate:
`scripts/team-cost-local-check.py`, `scripts/team-actions-local-check.py`,
`scripts/team-copilot-admission-local-check.py` และ
`scripts/team-restore-drill.py --github` บาง runner เปิดฐานข้อมูลหรือ Docker
จึงต้องตรวจ ports/ownership และ cleanup ก่อนเริ่ม ไม่ใช้กับ runtime จริง

เกณฑ์ผ่าน: มี ledger เปรียบเทียบทุก ID, revoked data อ่านไม่ได้ก่อนเปิด Team
และไม่มีการลบ backlog/reset authority เพื่อทำให้ผ่าน

## T4 — Flow ผ่าน UI และ GitHub จริงบน staging

สถานะ: **ยังไม่รัน** ต้องมี GitHub App, HTTPS tunnel และบัญชีทดสอบพร้อม

- [ ] สร้างองค์กร → เชิญสมาชิก → consent → เลือกทีม/repository
- [ ] OAuth/installation binding ตรวจตัวตนจริง; callback replay/account switch ถูกปฏิเสธ
- [ ] Initial sync ครบงานเปลี่ยนใน 90 วันและงานเปิดทั้งหมดตาม expected ledger
- [ ] PR/Issue/review/CI ถูกต้องตาม head SHA และ lifecycle ไม่แต่ง timestamp ย้อนหลัง
- [ ] Capture context → mapping → ดู sessions ที่ยังไม่เชื่อมและเหตุผล unresolved
- [ ] ยืนยัน/ปฏิเสธ/เปลี่ยนเป้าหมาย/ถอน link และดู history จาก UI โดยไม่แก้ DB มือ
- [ ] Receipt/ต้นทุน/weekly reports/CSV ตรง ledger และ privacy projection
- [ ] Disconnect/reconnect/resync ทำได้จาก UI; ถอน repo/installation บล็อกอ่านทันที
- [ ] Webhook ที่รับแล้วแสดงผลภายใน 5 นาทีในสภาพปกติ
- [ ] Missed events100 กู้ครบภายใน 10 นาทีหลัง API ฟื้นเมื่อไม่ติด rate limit
- [ ] บัญชีที่สอง review PR และตรวจสิทธิ์ข้ามผู้ใช้จริง

ใช้ [staging preflight](atoaxis-team-staging-configuration-2026-11-01.md) และ
`scripts/team-github-certification.py` ตาม schema evidence ของ candidate
Tunnel เปลี่ยน hostname ต้องตรวจ callback/webhook URL ใหม่ เจ้าของทำ passkey/2FA
ด้วยตนเอง ไม่มีผู้ทดสอบบัญชีที่สองให้คง gate นั้น `pending`

เกณฑ์ผ่าน: ครบ flow โดยไม่แก้ DB มือ มี source/version/เวลาใน evidence และ
expected ledger ตรง ไม่ใช้เพียง HTTP200 หรือ App ติดตั้งสำเร็จเป็นผลผ่านทั้งหมด

## T5 — แพ็กเกจและ native runtime

สถานะ: **ยังไม่รัน/ยังไม่สร้าง clean candidate ครบ**

- [ ] VSIX + standalone ครบ macOS x64/arm64 และ Windows x64/arm64 รวม8 artifacts
- [ ] ทุก artifact มาจาก SHA เดียวกัน และ binary/resources/hash/capabilities ตรงกัน
- [ ] Native runner/architecture ตรง target ไม่ใช้ cross-compile แทน native pass
- [ ] Fresh install/status/Pause/Resume/upgrade/interrupted upgrade/rollback/uninstall
- [ ] Pause อยู่ข้าม login/reboot; sleep/wake ไม่สร้างกิจกรรมเพิ่ม
- [ ] Custom CLI override และ hook ของผู้ใช้ไม่ถูกเขียนทับ
- [ ] Windows path ภาษาไทย/ช่องว่าง, executable lock และ versioned binary
- [ ] Installed VSIX activate ได้จริงจาก artifact ที่แตก ไม่อาศัย sibling repository
- [ ] Queue/receipts/journal อยู่ครบหลังทุก lifecycle และ cleanup ทำเฉพาะของทดสอบ

รายละเอียด workflow, prior-candidate baseline และ native VS Code prerequisite:
[native candidate handoff](atoaxis-client-candidate-native-handoff-2026-11-01.md)
Workflow dispatch/commit/push ต้องรับคำสั่งแยก Missing runner/baseline/VS Code
เป็น `pending` ไม่ใช่ผ่าน Signing/Marketplace/stable release เป็น gate แยก

## T6 — Provider sessions และ canary จริง

สถานะ: **ยังรับรองไม่ครบ** ต้องใช้เครื่อง/รุ่น/provider ที่ติดตั้งจริง

- [ ] Codex, Claude Code, Cursor IDE และ Copilot VS Code บน macOS/Windows
  อย่างน้อย10 sessions ต่อเครื่องมือต่อ OS รวม80 sessions ตามขอบเขต Team
- [ ] เก็บ provider/client version, OS/architecture, candidate SHA และ binary hash
- [ ] มี expected ledger อิสระสำหรับ Agent/inline และผลราย metric
- [ ] ตรวจ capture → durable storage → delivery → canonical readback → UI
- [ ] Token/model/cost ที่ไม่มีหลักฐานแสดง unavailable ไม่กลายเป็นศูนย์
- [ ] Copilot daily metrics คง daily/team granularity ไม่แจกลง session/PR
- [ ] Canary ครบ7วันจันทร์–ศุกร์ที่จบแล้วและมี activity ผู้ใช้จริง
- [ ] วัน monitor-only/ไม่มีหลักฐาน/ระบบไม่พร้อมเป็น unconfirmed ไม่นับผ่าน
- [ ] รักษา revision ของรายงานวันผิดปกติ ไม่เปลี่ยนวันเก่าให้ผ่านเพราะฟื้นวันนี้
- [ ] เทียบ WakaTime ด้วยวัน/timezone/cutoff/timeout/category เดียวกัน
  รายงาน WakaTime-only และ AtoAxis-only แยกรายช่วง
- [ ] เป้าต่างไม่เกิน1% ใช้เฉพาะ identical input ไม่ใช้กับคนละ actual stream

ใช้ canary metadata-only ตาม runbook เดิมเมื่อเจ้าของให้เริ่ม ไม่สร้าง heartbeat
หรือเติมเวลาเพื่อทดสอบบัญชีจริง Runtime/login/Windows ที่ยังไม่พร้อมคง pending
เกณฑ์นี้ไม่รับรอง adapter ทั้ง14ตัว; Deep Code/Windsurf ยังแยกรอเจ้าของ

## รูปแบบเก็บผลและเกณฑ์จบ

| ID/ชุดทดสอบ | Source SHA/hash | Environment/version | Expected | Actual | สถานะ | Evidence | ข้อบกพร่อง/ผู้รับผิดชอบ |
|---|---|---|---|---|---|---|---|
| T1–T6 แยกรายกรณี | ต้องกรอก | ต้องกรอก | ledger/assertion | ยังไม่รัน | pending | ยังไม่มี | ระบุเมื่อพบ |

แยก `passed`, `failed`, `pending`, `unconfirmed`, `withheld` และ `unavailable`
ตามความหมายจริง การมี test source, test count ครบ, exit0 หรือ artifact ครบ
อย่างเดียวไม่พอจะผ่านทั้งชุด หากแก้ source หลังทดสอบต้องระบุผลที่ต้องรันซ้ำ

ปิดการตรวจรับได้เมื่อทุกข้อในขอบเขตมี evidence บน candidate เดียวกัน
หรือมีข้อยกเว้นที่เจ้าของยอมรับอย่างชัดเจน Failure ต้องเปิดงานแก้ตามสาเหตุ
ไม่ลด assertions/เปลี่ยน duration/capture/timeout เพื่อทำให้ผ่าน

## งานนอกการเริ่มทดสอบรอบนี้

- Stripe ยังมีงานพัฒนา provider preview/result projection, upgrade/proration,
  retained-seat downgrade และ financial recovery/maintenance ที่พักไว้
  จึงไม่ถือว่าเหลือแค่ทดสอบ Stripe หรือมีบัญชีแล้วจะเสร็จอัตโนมัติ
- Cloud staging/production, Cloud restore, p95 performance, privacy/security
  review, signing และ3ทีมทดลอง14วัน ยังคงเป็น gate พร้อมเปิดขายแยกต่างหาก
- ราคาขาย/Stripe live config, deploy และเปิด Checkout ต้องเจ้าของตัดสินใจ

เมื่อกลับมาเริ่ม ให้เริ่ม T1 → T2 → T3 ก่อน จากนั้น T4/T5 ตาม prerequisites
และ T6 เมื่อมี candidate/provider พร้อม Canary อาจทำคู่ขนานได้ แต่การเปลี่ยน
build/capture scope ต้องบันทึกแยกและไม่ข้ามวันจริงเพื่อเร่งผล
