# Team Phase 2: privacy, retention and evidence

วันที่ 8 ต.ค. 2026 — branch `codex/atoaxis-team` ต่อจาก `e9cdbe6`

สถานะ: โค้ดและการตรวจในเครื่องแยกจาก canary จริง ทั้ง phase ยังไม่ผ่านและ
`production_ready=false`, checkout ปิด ไม่มีการติดตั้ง Team บน production หรือ push/merge main

## สิ่งที่เปลี่ยน

- API/CSV ใช้ authorization, consent, repository/team scope, generation และ retention
  ชุดเดียวกัน ตรวจซ้ำก่อนตอบกลับ UI ซ่อนผลเก่าเมื่อ refetch ล้มเหลวหรือสลับบัญชี/องค์กร
  การดาวน์โหลดที่ค้างอยู่ถูกยกเลิกเมื่อ scope ของหน้าหรือบัญชีเปลี่ยน
- Insights รับเฉพาะสัปดาห์จันทร์–อาทิตย์ที่จบแล้ว ตาม timezone ขององค์กร
  pilot ใช้ Asia/Bangkok ตั้ง timezone ก่อนเผยแพร่ครั้งแรกแล้วล็อก
  คำขอช่วงอื่นคืนข้อผิดพลาด ไม่ปรับช่วงให้เงียบ ๆ
- ทะเบียนมุมมองใช้ร่วมกันทั้งองค์กร/API/CSV ภายใต้ lock ของ generation
  คง minimum 5 ของผู้ร่วมข้อมูลจริงและตรวจ complementary partitions เดิม
  มุมมองที่มีผู้ร่วมข้อมูลซ้อนกันอนุญาตเฉพาะเมื่อเป็นสมการและ cohort เดียวกัน
  กลุ่มแยกกันอนุญาตได้ นอกนั้น withheld วิธีนี้ลดความพร้อมของรายงานเพื่อปิดการอนุมาน
- การแก้ข้อมูล/ถอน consent/เปลี่ยน roster หรือ scope ยกเลิกสัปดาห์ที่เผยแพร่แล้ว
  ไม่เผยแพร่ค่าที่แก้ของสัปดาห์เดิม ทะเบียนอิสระเก็บ hash ของแต่ละมุมมองและ week barriers
  จึงตรวจพบ backup ที่มีบางมุมมองหาย แม้ generation และรายชื่อสัปดาห์เท่าเดิม
  ส่งค่าตัวเลขสำเร็จได้เมื่อทะเบียนนี้บันทึกถาวรแล้วเท่านั้น
- แก้ consent upsert: BEFORE INSERT ของ ON CONFLICT ไม่บันทึกเวอร์ชันผีซ้ำกับ UPDATE
  no-op ไม่เปลี่ยนเวลาเริ่มแชร์หรือเวอร์ชัน และ serialize opt-in แรกขององค์กร
- Worker ล้างเฉพาะข้อมูล Team ทีละ batch/checkpoint ใช้ cutoff UTC คงที่ต่อรอบ
  12 เดือนปฏิทิน รองรับ lease, retry และ restart ส่วน read cutoff ใช้ทันที
- `/api/v2/organizations/:id/measurement-health` แสดง capture/delivery ของเจ้าของ
  จาก delivery snapshot เดิม สถานะ missing/unconfirmed/stale/pending/auth/dead letter
  แยกจาก integration/retention และไม่ตีความคิวว่างว่า capture ครบ
- Trust panel แจ้งเมื่อสถานะเปลี่ยนหรือฟื้น และไม่แจ้งซ้ำในสถานะเดิม
  diagnostics รวมที่ยังไม่รับรอง suppression เป็น withheld; integration ที่ไม่มี
  server evidence เป็น unconfirmed ไม่แสดงจำนวนปัญหาของกลุ่มเล็ก
- `launch-readiness` แยก local evidence ออกจาก external พร้อม checked_at/build
  local evidence ไม่เปิด production gate และ build ที่ไม่ได้กำหนดเป็น null

## Inventory และวงจรการลบ

| ข้อมูล | การล้าง/ป้องกันการอ่าน |
| --- | --- |
| `team_session_links` | เกินอายุ, ถอน aggregate หรือ membership ใช้ batch 100; allocations/history cascade |
| `team_usage_allocations` | เกินอายุหรือถอน individual ใช้ batch 100; ไม่สำเนาต้นทุน canonical |
| `team_link_history` | เกินอายุ/cascade ตาม link |
| `team_improvement_actions` / history | metadata ที่ผู้ใช้สร้างเอง; read cutoff จาก created_at/changed_at 12 เดือนปฏิทิน, cleanup phase 13, assignment ไม่เปิด analytics consent |
| Action revisions / participant dispositions | หลักฐานขั้นต่ำต่อ UUID/actor สำหรับ deletion/restore; edits ไม่เพิ่ม privacy generation, tombstone เป็นสถานะถาวรต่อ UUID |
| `team_action_account_proof_requirements` | ไม่มี users FK และไม่ใช่ contributor analytics; เก็บ proof requirement แม้ cleanup ลบ action/history ไปแล้ว จน backup ที่อาจคืน metadata หมดอายุและ operator ยืนยัน |
| `account_deletion_requests` Team checkpoint | เก็บ requirement ตั้งแต่ request แบบ OR; หลัง PostgreSQL purge ยัง running จน independent ledger durable, retry หลัง user row หายได้ |
| `team_work_items` | cutoff ของ provider_updated_at; อ่านผ่าน scopes/consent projection |
| `audit_logs` ขององค์กร | 12 เดือน; read cutoff บังคับทันที |
| `team_consent_history` | ล้างรุ่นเก่าเกินอายุ; คงรุ่นปัจจุบันเป็นหลักฐานสิทธิ์ขั้นต่ำ |
| `team_weekly_publications` | ตัวเลขไม่ได้เก็บ; เกินอายุล้าง contributors/fingerprint เหลือ week barrier |
| GitHub `team_webhook_inbox` | เกินอายุ: pending/dead letter ต้องมี disposition ก่อนล้าง metadata; processed ใช้เหตุผล retention |
| `team_webhook_dispositions` | เก็บ delivery ID/hash/reason ขั้นต่ำ ป้องกัน redelivery และ restore นำข้อมูลกลับ |
| CH `member_daily`, `organization_daily` | allowlist เฉพาะ rollup องค์กร ล้าง batch 100 keys; cutoff และ consent; sum เก่าที่ไม่มี contributor ledger ล้างเมื่อ generation เปลี่ยน |
| report/cache/export | ไม่มี stored Team report/export artifact ในรุ่นนี้; CSV สดเรียก projection เดียวกัน |
| privacy/deletion registry, restore/cleanup checkpoints | หลักฐานขั้นต่ำแยกจาก analytics เก็บจน operator ยืนยันว่า backup เก่าทุกชุดหมดอายุ |
| payment/Stripe inbox | แยกนโยบายออกจาก analytics; worker รอบนี้ไม่ลบ |
| canonical personal heartbeat/AI usage | worker ไม่ลบหรือแก้ ID/timestamp/duration/capture/timeout |

CH rollup เก่ายังไม่มี reader ที่รับรองและ Team duration capability ปิดอยู่
ข้อมูลรายวันไม่สามารถแยกก่อน/หลัง consent ภายในวันได้ จึงล้างวัน boundary แบบ conservative
คงข้อมูลต้นทางส่วนบุคคลไว้ หากเปิด reader/derived store ใหม่ต้องเพิ่ม inventory และตรวจ privacy ก่อน

## Runbook: backend → worker → UI

ใช้ configuration และบัญชี/origin เดิมของ environment ที่จะติดตั้ง ไม่สร้างฐานใหม่แทนฐานจริง
ขั้นทดสอบใช้ isolated fixtures เท่านั้น

1. ปิด `ATOAXIS_TEAM_ENABLED` และ `team_rollouts.enabled` ก่อนติดตั้ง receiver/migration
   migration `031_team_trust.sql` เป็น additive รองรับ boot ซ้ำ
2. เลือกที่เก็บ `ATOAXIS_TEAM_PRIVACY_LEDGER_PATH` เป็น absolute path **นอก database backups**
   ให้เฉพาะ service account อ่าน/เขียนและเก็บ head อิสระที่ไม่ rollback ไปพร้อมฐานข้อมูล
   initialize ได้ครั้งเดียวขณะ rollout ปิด:
   `cargo run --bin team-privacy-worker -- --initialize-ledger`
3. รัน `team-privacy-worker` ต่อเนื่องด้วย service supervisor ของ environment นั้น
   tick 15 วินาที; PostgreSQL batch transactional, CH lease ไม่มี network ใต้ row lock
   `--once` ใช้ตรวจรอบจำกัด ทะเบียน missing/เกิน 5 นาที/ไม่ตรงให้ปิดอ่าน Team
   worker ไม่พิมพ์ credential/metadata payload และไม่สร้าง heartbeat
4. ตั้ง `team_report_policies.timezone` ขององค์กรก่อนมี locked_at ตรวจ timezone ได้จาก health
   เปิด flag เฉพาะ pilot หลังตรวจ receiver/worker build และ ledger readiness แล้วจึงเปิด UI
   ไม่มีการเปิด pilot จริงในงานนี้
5. ถอนสิทธิ์แล้วการอ่านถูกบล็อกทันที งาน cleanup ทำต่อเอง หาก mirror เขียนไม่ได้
   request ไม่ ACK สำเร็จ แต่ consent ที่ถอนในฐานยังมีผลและไม่ย้อนกลับเพื่อให้ API ผ่าน

### Restore

ปิดการอ่านและ rollout ก่อน restore ใช้ independent privacy ledger ล่าสุดจากระบบที่เชื่อถือได้
ห้าม seed ledger ว่างหรือเปลี่ยน checked_at เพื่อทำให้ backup เก่าดูสด
หาก ledger ขาด/เก่า/ยืนยันต้นทางไม่ได้ ให้ปิดอ่าน Team จนกู้หลักฐานได้

`cargo run --bin team-privacy-worker -- --reconcile-restore` ปิดทุก rollout/consent ก่อน
ใช้ deletion/revocation barriers และ dispositions แล้ว drain cleanup ด้วย worker
การ re-opt-in ต้องมาจากสมาชิกอีกครั้ง ห้ามเปิดอ่านก่อน reconciliation/cleanup/readiness
canonical personal facts คงอยู่ การ replay delivery ที่ถูก dispose ไม่สร้าง metadata ใหม่
hard deletion ต้องผ่าน cleanup ของทุก store ก่อนลบ metadata องค์กรซึ่งเป็น scope ของงานค้าง

Ledger local นี้ทดสอบ fsync/atomic rename และการกู้ staging file หลัง process crash
ยังไม่รับรอง distributed multi-host filesystem/object-store durability ของ Cloud
ทุก API/worker ของ environment ต้องใช้ **head เดียวกัน** ห้ามใช้สำเนาแยกกัน

### Rollback

ปิด flag/rollout แล้วหยุด UI feature ได้ ให้ privacy worker/ledger และ consent withdrawal ทำงานต่อ
ห้าม rollback ด้วยการลบ backlog, ID, migration, markers หรือ publication barriers
ห้ามย้อน ledger ไป head เก่า ห้ามสร้างฐานว่างแทนฐานเดิม

## Canary จริง

`heartbeat-delivery-canary.py` ใช้ observation ของวัน/account-origin/build นั้นเท่านั้น
ตรวจ queue/capture scope ที่ hash ด้วย NUL แยกจาก archive scope ที่ hash ด้วย newline
local delivery snapshot รุ่นเดิมไม่มี scope จึงใช้ scoped archive ของ PID เดียวกันที่เก่าไม่เกิน 90 วินาที
พร้อม server snapshot ของ queue_id ที่ตรงกัน ไม่สมมติ field ที่ขาดว่าเป็น scope ปัจจุบัน
ข้อมูลก่อนแก้เงื่อนไขเก็บไว้เป็น unconfirmed ไม่ย้อนให้ผ่าน
เก็บ revision รายงานโดยไม่เขียนทับคำตัดสินเดิม การฟื้นวันนี้ไม่ทำให้เมื่อวานผ่าน
ต้องเป็น weekday ที่จบแล้ว มี event ผู้ใช้จริงซึ่งไม่ใช่ monitor และมี health coverage ของช่วงกิจกรรม
snapshot missing/stale หรือ API unavailable เป็น unconfirmed ไม่ใช่ศูนย์
รายงานระบุ timezone/category/timeout เท่าที่ได้จริง actual streams ไม่เรียกว่า identical-input

เพิ่ม LaunchAgent `com.atoaxis.wakaclock.canary` อ่าน metadata ทุก 60 วินาที (`--watch`)
เพื่อไม่ให้การเรียก automation รายชั่วโมงพลาดหลักฐานระหว่างวัน ไม่สร้าง event หรือเปิด service ใหม่
logs/observations อยู่ใต้ incident output ที่ไม่ commit script หยุดเมื่อ schema v2 ระบุครบ 7 วัน
automation เดิมยังเป็นผู้จัดทำรายงาน/ตัดสิน completion และ pause ตามคำสั่งเดิม

เวลา 12:24 Asia/Bangkok พบ backend unavailable, worker หยุดและ snapshot เก่าประมาณ 7 ชั่วโมง
ตรวจ launchd พบ backend/delivery/capture มี persisted disabled override ทั้งสามตัว
ยังไม่มีหลักฐานระบุผู้หรือขั้นตอนที่ตั้ง override จึงไม่อ้างว่าเกิดจาก macOS หรือ network เอง

สำรอง queue/capture ด้วย SQLite backup API รวม WAL และตรวจ integrity=ok ก่อน recovery
sealed account/volume/build binding เดิมผ่าน จึง enable/bootstrap เฉพาะ LaunchAgent เดิม
backend ฟื้นด้วย binary/volumes เดิม ไม่ติดตั้ง Team code ลงข้อมูลจริง
เวลา 12:31 คิวต้นเหตุ 845 แถว ACK ครบ ไม่มี original pending/dead letter
canonical GET ยืนยัน 844 heartbeat ID ครบ (หนึ่ง ID มี revision 0 และ 1)
API นี้ไม่แสดง revision จึงรับรอง readback เป็นระดับ ID และแยกจาก ACK ระดับ revision
capture pending/parser error เป็นศูนย์ มี event ใหม่เกิดระหว่างทำงานจึงตรวจ live queue แยกจากชุดเดิม

แก้ explicit installer ของ backend และ helper CLI ที่ delivery/capture ใช้ร่วมกัน
ให้ `launchctl enable` ก่อน bootstrap และทดสอบ disabled-state ด้วย fixture ที่ไม่เรียก launchd จริง
การแก้นี้ไม่ป้องกันโปรแกรมภายนอกปิดบริการโดยเจตนา ต้องตรวจ health/alert ต่อ
canary วันผ่านยัง **0/7** วันที่ 8 ต.ค. ยังไม่จบและมี day-health failure แล้ว
การ recovery ไม่ลบคำตัดสินช่วงขัดข้อง ไม่ใช้ผลจำลองแทนวันทำงานจริง

## การตรวจในเครื่องและข้อจำกัด

ดูผลรันล่าสุดใน `output/team-phase2-restore/latest.json` (synthetic metadata only ไม่ commit)
และรายละเอียดผลการทดสอบท้ายเอกสารนี้

- Restore drill ใช้ pg_dump/pg_restore และ ClickHouse Native snapshot ของฐานจำลอง
  ไป instance ใหม่ tmpfs ไม่มี persistent mounts หรือ volume ของผู้ใช้
  backup เก็บก่อนถอน consent; independent ledger เก็บหลังถอนสิทธิ์
  ตรวจ old-read blocked, monotonic registry, rollout/consent ปิด และ personal usage distinct คงเดิม
- ตรวจ privacy generation race, repeated consent upsert, cross-tenant scopes,
  repeated/overlapping publication, missing ledger, partial-view restore และ batch >100
- ตรวจ PostgreSQL transaction rollback/claim exclusion เป็น **การจำลอง process interruption**
  ไม่ใช่ผลผ่าน macOS login/sleep/wake จริง
- Group health projection ที่เปิดรายละเอียดแก่หัวหน้าทีมยัง withheld จนรับรอง suppression
- Canary จริง 7 วัน, login/sleep/wake จริง และ Cloud backup/restore ยังไม่ผ่าน
- GitHub reconciliation, Stripe, provider certification, Cloud staging อยู่ phase ถัดไป
- ไม่มีการอ้างว่า Team production-ready หรือว่าเวลาเท่ากับ WakaTime บนคนละ input

## ผลตรวจล่าสุดในเครื่อง (8 ต.ค. 2026)

| การตรวจ | ผล |
| --- | --- |
| backend all-target check | ผ่าน |
| backend library | 405 ผ่าน, 34 ignored (integration ที่ต้องเปิดแยก) |
| PostgreSQL integration Team/privacy/trust | 2 ผ่านบน isolated database รวม read-only rejection/retry |
| PG/CH restore drill | ผ่าน แยก instance จริง; artifact มี checked_at/base commit/test executable SHA-256 |
| frontend Team/Trust/org/invites | 31 ผ่าน รวม export ค้างขณะสลับองค์กร |
| frontend typecheck และ lint เฉพาะ source ที่แก้ | ผ่าน |
| canary และ runtime Python fixtures | 11 ผ่าน |
| CLI launchd disabled-state fixture | 1 ผ่าน ใช้ fake executable ไม่แตะ LaunchAgent ผู้ใช้ |
| core offline regressions | 12 ผ่าน |
| คิว 1,191 recovery eligibility regression | 1 ผ่าน; ไม่อ้างเป็น benchmark latency ของ Cloud |
| clippy server library/binaries `--no-deps -D warnings` | ผ่าน |
| clippy all targets | ยังมี baseline `items_after_test_module` ใน dashboard_analytics; ไม่ suppress เพื่อทำให้ gate ผ่าน |
| canary จริง 7 วัน / OS login-sleep-wake จริง / Cloud restore | ยังไม่ผ่าน |

ผลทั้งหมดเป็นการตรวจ source tree ของ Phase 2 ก่อน commit ไม่ใช่ release certification
ผลที่มี fixture ไม่ถือเป็นการรับรอง hardware lifecycle หรือข้อมูลผู้ใช้ครบ

เวลา 12:36 หลังตรวจ scope contract จริงและ archived worker metadata แล้ว latest canary
แสดง capture/delivery พร้อมใช้งานใน observation ปัจจุบัน แต่ completed days ยังคง 0/7
การคง snapshot ว่า observed ไม่ใช่การรับรองว่า capture ครอบคลุมทุก surface/provider
