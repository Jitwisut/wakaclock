# Context และ Health — ผลพัฒนาและงานรับรองที่ยังเหลือ

ตรวจวันที่ 12 ต.ค. 2026 · Asia/Bangkok · branch `codex/heartbeat-capture-release` · ฐาน `db18f40c7f38bfb231badaf57a29f35457615726`

สถานะ: **ส่งมอบโค้ด Context/Health และ local regression ของขอบเขตด้านล่างแล้ว ยังไม่รับรองใช้งานจริง** งานรอบนี้เก็บบน branch ข้างต้น โดยตรวจ commit ที่รวมรายงานนี้จาก Git history; ยังไม่อยู่ในแพ็กเกจที่ติดตั้งจริง ไม่เปลี่ยน duration/timeout/overlap หรือ heartbeat identity และไม่ได้กู้/replay ข้อมูลจริงของผู้ใช้

## เสร็จแล้ว

| รายการ | พัฒนา | Local tests | หลักฐาน / ขอบเขต |
|---|---|---|---|
| Context ก่อนเรียก CLI | เสร็จ | ผ่าน | Python/TypeScript shared producers เก็บ repository/branch/commit และ routing binding ณ hook boundary ก่อน CLI identity handshake; side stream บันทึกถาวรก่อน primary ACK |
| Context durable inbox / idle recovery | เสร็จ | ผ่าน | ID/hash/scope เดิม; conflict ไม่ถูกทับ; pending ที่ขาด binding ไม่ย้ายตาม configuration ใหม่; collector ระบายระหว่าง idle และหมุนเวียน scope |
| Delivery receipts | เสร็จ | ผ่าน | บันทึก durable ingress receipt ก่อนลบคิว; lost response ส่ง ID เดิม; 202 เท่านั้นยืนยัน ingress, canonical readback ยังคง unconfirmed |
| Context ก่อน session/usage | ใช้ receiver เดิมต่อ | Regression ผ่าน | durable verification pending เดิมเก็บข้อมูลไว้จน dependency/consent พร้อม ไม่สร้าง canonical session/usage ทดแทน |
| เจ้าของยืนยัน session → repository | เสร็จ | ผ่าน | API/UI, revision CAS, idempotency, server effective time, ประวัติ/ถอน mapping; `user_confirmed` ไม่แทน native Git/PR link หรือเพิ่มต้นทุน |
| Privacy / retention / restore ของ mapping | เสร็จในชุดทดสอบ | ผ่าน | ตรวจ owner/consent/org/team/repository และ generation ก่อนส่ง; retention เก็บ disposition ครบก่อน cascade; restore บล็อก binding ที่กู้มาจนตรวจใหม่ |
| Health หลายขั้น | เสร็จ | ผ่าน | producer spool, parser, inbox, CLI handoff, context, context delivery แยก adapter/surface; parser fault ถาวรและอีก source สำเร็จล้างไม่ได้ |
| VS Code / Overview / Heartbeats / Team | เสร็จ | ผ่าน | ใช้กฎ stale/pending/error เดียวกัน; backlog เดิมไม่ถูก success ใหม่กลบ; แจ้งตาม semantic state transition; account/consent switch ซ่อน cache เก่าระหว่างตรวจสิทธิ์ |

Health เป็นหลักฐานของขั้นตอนที่สังเกตได้ ไม่ใช่ใบรับรองว่าจับทุกกิจกรรม provider ครบ คิวว่างและข้อมูล client รุ่นเก่าไม่มีรายละเอียดไม่กลายเป็น complete

## สิ่งที่แก้เพื่อป้องกันการเกิดซ้ำ

- Historical timestamp ไม่มีสิทธิ์ให้อ่าน Git ปัจจุบัน; provenance ที่ระบุ CLI/IDE/Desktop ไม่ได้ยังเป็น `unknown`
- Producer side context เก็บเฉพาะ coordinates/identity ที่ตรวจได้ ไม่เก็บ absolute workspace path, remote credential, source, diff, prompt หรือ response
- มี routing proof ตั้งแต่เวลารับ event จึงเข้า verified queue ได้; ขาด proof หรือ owner/origin เปลี่ยนให้ parked/unresolved แทนส่งผิดเจ้าของ
- Idle collector จำกัด 100 รายการต่อ batch, รวมไม่เกิน 5 batches และงบเริ่มงาน 10 วินาที ใช้ producer slots 3/4 สลับกันและ parser 2/1; แม้ process เริ่มใหม่ทุก tick ก็เหลือ slot สำหรับ spool
- Pending context delivery มี budget ที่สงวนให้รายการเก่า; event ใหม่ไม่อดส่ง backlog ถาวร
- 401/403, rate limit/Retry-After, validation dead letter และ network/5xx แยกกัน Pause delivery หยุดก่อน HTTP
- Ingress ACK กับ canonical readback แยกกัน การหายจากคิวไม่ใช่หลักฐาน canonical หรือ capture ครบ
- การยืนยัน repository โดยเจ้าของเริ่มจากเวลาที่ server ยืนยัน ไม่สร้าง branch ในอดีต ไม่ย้าย ownership และไม่ผูก PR/cost อัตโนมัติ

## ผลตรวจในเครื่อง

| ชุดตรวจ | ผล |
|---|---|
| Rust broad regression | Core 401, CLI 97, server 419 ผ่าน; external/loopback tests ที่ ignored ไม่ถูกนับผ่านโดยอัตโนมัติ |
| หลังเพิ่ม durable parser health | Activity 17 ผ่าน รวม fault isolation/restart/SQLite write failure; editor handoff 8 ผ่าน |
| HTTP fault แบบ isolated | 1 ผ่าน: response หาย → retry ID เดิม → 429/Retry-After → durable 202 receipt |
| PostgreSQL แยกจากข้อมูลจริง | 2 targeted integration tests ผ่าน: ownership/consent/CAS/replay และ retention/restore; history 205 รายการมี disposition ก่อน cascade |
| Python shared producers | 27 ผ่าน |
| TypeScript producer spool | 6 ผ่าน รวม branch เปลี่ยนระหว่าง CLI handshake |
| OpenCode/Kilo plugin และ installer | Node 17 ผ่าน; Kilo installer fixture ผ่านและรักษา foreign configuration |
| VS Code | 214 tests / 22 files ผ่าน; lint ผ่าน |
| Frontend | 27 targeted tests ผ่านรวม consent/account race; typecheck ผ่าน |
| Strict Clippy | all-targets `-D warnings` ผ่าน ไม่มี baseline lint allowance/suppression |
| Duration golden | input/สูตรเดิม: 3,600 วินาที, error 0 |
| คิว 1,191 รายการข้าม 3 วัน + heartbeat ใหม่ | ID reconciliation ผ่านและระบายระหว่าง idle ใน 37.485754208 วินาที ภายใต้ isolated test; ไม่ใช่ production latency measurement |

รายละเอียด machine-readable: `output/context-health-2026-10-12/latest.json` มีเฉพาะ metadata สรุป การทดสอบฐานข้อมูลใช้ native PostgreSQL ชั่วคราวและปิดแล้ว ไม่เปิด Docker ในรอบนี้

## ยังไม่เสร็จ / รอหลักฐานภายนอก

- ยังไม่ติดตั้ง migration/backend/worker/UI รุ่นใหม่นี้กับบัญชีจริง จึงยังไม่ตรวจ canonical readback/provider UI บน runtime จริง
- ยังไม่มี clean committed candidate และ VSIX/standalone 4 targets จาก SHA ใหม่; artifact verifier/native smoke ของแพ็กเกจใหม่ยัง pending
- Native macOS/Windows install, login, sleep/wake, upgrade/rollback และ provider sessions จริงตาม surface/metric ยัง pending
- Codex CLI/IDE/Desktop แหล่งที่ไม่มี provenance ยังคง unknown; ไม่อ้างว่าจำแนกทุก runtime ได้
- การตัดสิน parked spool ที่ไม่มี owner/origin proof ยังต้องใช้หลักฐาน ownership; manual repository confirmation ไม่ใช่เครื่องมือย้าย scope
- Journal recovery และช่องทาง adapter ที่ยังขาดนอกขอบเขต Context/Health รอบนี้ยังดูตาม ledger ของตนเอง ไม่ได้ประกาศว่าปิดทั้งแผน
- Canary 7 วันทำงานจริง, Deep Code/Windsurf identity/contract, signing และการเผยแพร่ยังเป็น gate แยก
- Local PostgreSQL fixtures ไม่รับรอง Cloud restore หรือ GitHub App credentials/live authorization

## ควรทำต่อเรียงลำดับ

1. ตรวจ diff และ commit เฉพาะงานนี้บน `codex/...` แล้วสร้าง candidate ใหม่จาก checkout สะอาด; ไฟล์ค้างงานอื่นต้องแยกออก
2. ติดตั้ง receiver พร้อม migration `035` ก่อน worker/client/UI เปิด flag เฉพาะองค์กรทดลองและตรวจ build ที่รันจริง
3. ทดสอบ frozen branch offline → idle drain → canonical readback และ manual mapping → consent withdrawal ใน UI จริง โดยใช้ metadata ledger อิสระ
4. รัน native Windows/macOS lifecycle และ provider certification ตาม manifest SHA เดียวกัน; ช่องที่ไม่มีหลักฐานคง pending
5. ต่อ Journal/adapter/package gates ที่เหลือและ canary ตาม ledger โดยไม่แก้สูตรเพื่อให้ผลผ่าน

Rollback ปิด flag/producer ใหม่โดยรักษา accepted spool/inbox, receipt, queue IDs และ additive migrations ไม่ล้าง backlog ไม่ย้อน timestamp และไม่กู้ประวัติด้วย branch ปัจจุบัน
