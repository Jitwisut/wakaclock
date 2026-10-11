# ปิดช่องข้อมูลหายก่อน CLI — Tool boundaries

ฐาน `cd9286e` · branch `codex/heartbeat-capture-release` · ตรวจ 11 ต.ค. 2026

**ปิดเส้นทาง legacy tool-before/after/abort ใน source และ local regression แล้ว** ยังไม่ได้ติดตั้ง hook/client ของผู้ใช้จริง ไม่ใช่การรับรอง provider/Windows หรือแพ็กเกจครบสี่ targets และไม่ใช่การปิดทั้งแผน Producer/Journal/Context/Adapters/Packages ไม่มี Docker เปิด งานส่งผ่าน branch นี้เท่านั้น และไม่ push/merge เข้า main

## ผลที่ได้เทียบกับที่คาดหวัง

ก่อนแก้ หลาย shell hooks เรียก CLI เพื่อสร้าง snapshot โดยตรง จึงขาด boundary หาก CLI ไม่อยู่ ส่วนการเก็บ marker อย่างเดียวไม่พอ: หาก replay แล้วอ่านไฟล์/Git ปัจจุบันจะสร้าง attribution ของอดีตผิด

หลังแก้ hook เก็บ fingerprint, line counters และเวลาสังเกตจริงแบบ metadata-only ลง spool แล้ว fsync ก่อนเรียก CLI ทั้ง before, after และ abort ใช้ durable batch ACK ตาม ID/hash เดิม Collector ระบาย spool และจับคู่หลักฐานขณะ idle โดยไม่อ่าน source/Git ใหม่ หลัง materialize ใช้ broker → queue → delivery เดิม

คำรับประกันครอบคลุม record ที่ fsync สำเร็จแล้ว ไม่ครอบคลุม event ที่ provider/OS ยังไม่ส่งถึง hook หรือ hook ที่เขียน disk ไม่สำเร็จ การเขียนไม่ได้คืน capture failure; สแกนไม่ได้เก็บ observation ที่ระบุ measurement unavailable ไม่สร้าง successful empty snapshot

## เส้นทางข้อมูล

1. Producer ตรวจ persisted Pause และ scope ที่ผูกตอน explicit setup ก่อนรับ observation
2. Freeze snapshot ณ before/after boundary; อ่าน source ชั่วคราวเพื่อ hash/count ไม่เก็บข้อความ คำสั่ง หรือผลตอบกลับ
3. เขียน staging file, fsync, rename เป็น spool record แล้ว fsync directory ก่อนแตะ CLI
4. เก็บ before evidence แยกจาก spool เพื่อให้ after hook ใช้ root/Git mode เดิม แม้ collector ส่ง before สำเร็จและลบ spool แล้ว
5. ถ้า CLI หาย/เก่า/response หาย เก็บ record เดิมไว้ รุ่นเก่าต้องมี `tool_boundary_durable_v1` จึงได้รับ immediate handoff
6. CLI ตรวจ scope, hash, schema และ allowlist แล้ว commit evidence/receipt ลง broker SQLite ก่อนตอบ accepted/duplicate; ACK นี้ยังไม่ใช่ server/canonical ACK
7. Worker จับคู่ before/after ได้แม้มาผิดลำดับ Freeze batch ทั้งชุดก่อน ingest แล้วเก็บ progress หลังแต่ละ durable chunk การ crash หลัง ingest แต่ก่อน progress จะ replay batch เดิมและ deduplicate
8. Collector ลบ spool เฉพาะ ACK ที่ durable และ ID/hash ตรงกัน รายการ conflict/rejection ยังคงต้นฉบับพร้อม recoverable disposition

## Invariants ที่รักษา

- สูตร duration/timeout/overlap, existing file-change event IDs และกฎกระจาย tool interval เดิมไม่เปลี่ยน
- ใช้ original before/end timestamps; replay ไม่ใช้เวลาปัจจุบัน มี interval ได้ครั้งเดียวต่อ sorted batch ก่อนแบ่ง chunk
- No-op tool และ abort ไม่สร้าง file interval ตาม legacy semantics
- Unknown baseline/numstat, root/Git mode conflict หรือช่วง tool ตัดกับ Capture Pause เป็น unavailable ไม่อ่านไฟล์ปัจจุบันชดเชย
- รักษา paused intervals และ endpoint semantics; reversed clock ยังคง duration เดิมที่เป็นศูนย์ พร้อม health clock_unconfirmed
- Owner binding ใหม่เป็น fixed scope; account/origin ใหม่ไม่มีสิทธิ์รับ records เก่า Same-owner key aliases ต้องมี proof เดิม Unconfirmed spool ไม่ถูกย้ายอัตโนมัติ
- ใช้ idle collector เดิมและแบ่ง slot จากงบเดิม: สูงสุด 100 materialized events ต่อ boundary slot, รวม parser/spool 5 slots, หยุดเริ่มงานหลัง 10 วินาที Delivery worker แยกงบตามเดิม
- ไม่เพิ่ม background process, service หรือ transport อีกชุด

## ไฟล์ที่แก้

| กลุ่ม | ไฟล์ / หน้าที่ |
|---|---|
| Shared producer | `extensions/ai-agents/common/tool-boundary-producer.py` ใหม่: freeze, allowlist, immutable before cache, spool, capability/ACK |
| Owner protection | `common/metadata-producer.py`, `common/activity-spool.ts`: รักษา fixed owner binding |
| Shell hooks | Codex, shared shell, Claude plugin, Cursor, Gemini และ Kimi before/after/abort รวม 15 entrypoints เรียก shared helper ก่อน CLI; dependency หายแสดง capture failure |
| Kilo | `src/producer-client.ts`, `installer/install.py`: ใช้ helper ร่วม ติดตั้ง helper ภายใน owned directory และไม่สร้าง runtime bytecode ที่ทำให้ ownership inventory เสีย |
| Durable broker | `wakaclock-core/src/broker/producer_boundary.rs` ใหม่ และ `broker.rs`: additive tables, receipts, pair/batch/progress, fairness, health |
| CLI receiver | `wakaclock-cli/src/producer_tool_boundary.rs` ใหม่, `producer_handoff.rs`, `main.rs`: typed validation, durable batch capability, materialize frozen evidence |
| CLI worker/setup | `capture_service.rs`, `native_spool.rs`, `ai_setup.rs`: bounded idle retry, additive health และ explicit scoped binding |
| Measurement | `tool_snapshot.rs`: ใช้ diff logic ร่วมสำหรับ legacy/live และ frozen counters; ไม่เปลี่ยน duration calculation |
| Tests | Shared Python/TS, shell fixtures, Kilo plugin/installer, VS Code agentSetup และ CLI editor_handoff |

## หลักฐานที่รันจริง

| ชุดตรวจ | ผล |
|---|---|
| Core unit tests | 397 ผ่าน รวม receipt conflict, immutable replay และ fair owner scopes |
| CLI unit tests | 97 ผ่าน รวม boundary tests 7 และ tool snapshot regression 8 |
| CLI editor_handoff subprocess | 7 ผ่าน รวม missing CLI → freeze before/after → ลบ source → lost ACK replay → idle restart ที่ใช้ original evidence และไม่มี duplicate |
| CLI offline_lifecycle | 44 ผ่าน รวม backlog 1,191 ข้ามสามวัน, no-new-activity recovery, auth/429/5xx, response loss, mixed validation, identity isolation |
| VS Code | TypeScript lint และ 209 tests / 21 files ผ่าน |
| Shared Python | 22 ผ่าน รวม 15 shell paths ขณะ CLI หาย, frozen Git numstat, disk failure, pause, unknown owner, cache conflict และ missing workspace |
| Shared TS | 5 ผ่าน รวม foreign account ไม่ overwrite fixed owner |
| Kilo | 13 plugin tests ผ่าน และ installed-helper/reinstall/uninstall fixture ผ่าน |
| Shell fixtures | Codex, Claude plugin และ Kimi ผ่าน |
| Rust quality | `cargo fmt --all -- --check`, strict Clippy Core/CLI all targets ผ่าน |
| Duration golden | Input/manifest เดิม 3,600 seconds; daily/total error 0 |

Offline suite ครั้งแรก sandbox ปฏิเสธ localhost listener; รันซ้ำด้วยสิทธิ์สำหรับ mock server แล้วผ่าน ไม่ใช้ผล run ที่ listener เปิดไม่ได้เป็นผลของ code ชุด offline ทั้ง 44 ใช้ wall time 102.72 วินาที ซึ่งไม่ใช่ drain latency; backlog test มี assertion ภายใน 120 วินาทีของตัวเอง

ทั้งหมดใช้ synthetic metadata / temporary HOME ไม่ replay activity จริง ไม่เปลี่ยนฐานข้อมูล/hooks/services ของบัญชีจริง และไม่ใช้ผลนี้แทน live certification

## สถานะส่งมอบและงานต่อ

| รายการ | พัฒนา | Local tests | Live/artifacts | งานถัดไป |
|---|---|---|---|---|
| Legacy shell + Kilo tool boundary ก่อน CLI | เสร็จใน source ของช่องทางที่ระบุ | ผ่าน | pending | ออก candidate ใหม่แล้วทดสอบ installed hooks จริง |
| Durable pair/ACK/idle restart | เสร็จ | ผ่าน | pending | Native process-kill/disk/permissions matrix บนทั้งสอง OS |
| Scoped ownership + fixed binding | เสร็จสำหรับ setup/new boundary paths | ผ่าน identity regression | pending | ตรวจ upgrade, same-owner key rotation และ account switch จาก installed bundle |
| Additive boundary health | มี pending/unavailable/retry/materialized/aborted/clock diagnostics | ผ่าน | UI กลางทุก adapter ยังไม่ครบ | ต่อ stage/surface health กับหน้าความพร้อมในงาน Context/Health |
| Journal recovery/UI closure | อยู่นอกการแก้รอบนี้ | ใช้หลักฐานเดิม | pending | Native recovery/crash matrix และ receipt/readback จริง |
| Producer-side Git context/manual mapping | ยังไม่ครบ | pending | pending | Frozen observation context และ user-confirmed mapping |
| Copilot daily/Roo/Cline Windows | ยังมีช่องทางขาด | pending | pending | ต่อ contract/setup/recovery แยกงาน |
| Deep Code/Windsurf | รอเจ้าของตามข้อตกลง | pending | pending | ยืนยัน product/runtime contract |
| 8 internal artifacts / native smoke | ยังไม่สร้าง candidate จากงานรอบนี้ | pending | pending | Clean SHA เดียวและ Actions สี่ targets |
| Canary/signing/stable release | Gate แยก | ไม่ใช้ fixture แทน | pending | เก็บหลักฐานจริงและอนุมัติการ publish แยก |

## การติดตั้งและ rollback

Receiver CLI ใหม่ต้องพร้อมก่อนเปิด producer ใหม่ ใช้ capability `tool_boundary_durable_v1`; shared bundle ต้องมี Python helper ทั้ง `tool-boundary-producer.py` และ `activity-producer.py` พร้อม Python3/jq/Git ตาม provider path และ versioned Kilo helper ที่ไม่อ้างโฟลเดอร์ sibling

ทำ explicit setup ภายใต้ scope ที่ตรวจสอบแล้วก่อนใช้งาน เพื่อสร้าง fixed owner binding หาก scope เดิมต่างบัญชีให้รักษาของเดิมและรายงาน owner conflict ไม่ย้าย spool การตั้งค่า environment สำหรับ fixtures ไม่เป็น owner proof

Worker capture ต้องกำลังทำงานและไม่ paused จึงระบาย evidence ขณะ idle ถ้าหยุดไว้ยังคง spool/inbox โดยไม่อ้างว่าส่งครบ Old CLI เก็บ spool ต่อพร้อม upgrade-required ไม่ยืนยัน durability จาก exit 0

Rollback ปิดช่องทาง/หยุดสร้าง observation ใหม่ หรือกลับ binary เดิม พร้อมคง spool, before cache, boundary receipts/batches, broker inbox, queue IDs และ additive tables ห้ามลบข้อมูลเพื่อทำสถานะให้ว่าง Original boundary ที่ CLI ใหม่รับแล้วแต่ CLI เก่าประมวลผลไม่ได้จะรอ compatible worker ไม่ replay จาก workspace ปัจจุบัน
