# Producer / Journal closure — รายงานรอบพัฒนา 11 ต.ค. 2026
ผลพัฒนาช่องทาง adapter รอบต่อ: [Cline Windows / Roo / Copilot daily และงานที่ยังค้าง](adapter-development-closure-2026-10-12.md). ตารางเดิมด้านล่างเป็นประวัติของรอบนั้น ไม่ใช่สถานะล่าสุดทุกช่องทาง.


ฐาน `8baf491` · branch `codex/heartbeat-capture-release`

**ทั้งแผนยังไม่เสร็จ**: รอบนี้ปิดเส้นทาง producer ที่ระบุด้านล่างและเพิ่ม Journal recovery/reconciliation พร้อม local regression การรับรองจริงและแพ็กเกจครบสี่ targets ยัง pending ไม่มีการติดตั้ง hook/service หรือ Apply journal ของผู้ใช้จริง ไม่มี Docker เปิดในรอบนี้ และไม่มีการ push/merge เข้า main

## Commit ที่ส่งมอบ

- `d0efde6` — scoped durable producer, ingress receipts, canonical readback receiver, Cursor edit hooks และ bounded collector
- `1e9629f` — Journal activation/resume, recovery evidence, incident acknowledgement และ scoped sidecar
- `7e09934` — native runner preflight และ package protocol/prerequisites
- `261a5e9` — ตรวจบัญชี/origin เดิมแบบ read-only ก่อนอ่าน ingress ACK ของ key เก่า

## ตารางตรวจรับ

| รายการ | พัฒนา | local tests | artifact/native smoke | live certification | หลักฐาน / blocker | ควรทำต่อ |
|---|---|---|---|---|---|---|
| Metadata producer batch + per-ID/hash durable ACK | เสร็จใน contract v2 | ผ่าน mixed good/bad, conflict, response loss, restart | ยังไม่สร้าง candidate ใหม่ | pending | `producer_handoff.rs`; ACK หลัง inbox commit ไม่ใช่ HTTP | ขยาย legacy tool boundary ให้ครบ |
| Shared shell file/session, Kilo lifecycle/file/tool metadata | ต่อแล้ว | ผ่าน; CLI หายยังเก็บ original metadata | pending | pending | Python/TS spool ใช้ collector เดิม; owner ไม่ยืนยัน parked | ตรวจ native runtime และ tool baselines |
| Legacy Codex/Claude/Gemini/Kimi file hooks | ต่อแล้ว | ผ่าน CLI หาย + privacy fixtures; hook tests ผ่าน | pending | pending | เอา CLI early exit/direct emit fallback ออก; Python/jq/shared resources เป็น prerequisites | ตรวจ installed bundle หลัง upgrade |
| Legacy shell tool-before/after/abort | **ปิด source/local regression แล้วในรอบต่อ** | frozen boundary, ID/hash ACK, lost response และ idle restart ผ่าน | pending | pending | [รายงานต่อจาก cd9286e](tool-boundary-durability-2026-10-11.md); ยังไม่ติดตั้ง hook จริง | candidate และ native installed lifecycle tests |
| Collector fairness/budget | เพิ่มแล้ว | ผ่าน bounded cursor restart; idle backlog regression ผ่าน | pending | pending | Live parser 100 input records/batch, spool+parser รวม 5 slots, สลับ reserved slots 2/3; ไม่เริ่ม batch ใหม่หลัง 10s; checkpoints ถาวร | ตรวจ latency/performance ของทุก source จริง |
| Broker ownership / retained dead letter / sidecar | เพิ่มแล้ว | ผ่าน scope, editor collision, 90-day dead letter retention | pending | pending | sidecar ใช้ fingerprint ที่ producer ให้เท่านั้น; scoped cursor; ไม่มี late file reread | ปิด legacy global attribution state ที่ยังเหลือ |
| Server ingress ACK ledger + ID/revision readback | ต่อแล้ว | ผ่าน atomic ACK/lease/payload races + targeted readback DTO/status | pending | pending | SQL guard ใช้ original payload; ClickHouse authenticated lookup ยังไม่ได้ DB integration | deploy receiver ก่อน client แล้วตรวจ canonical จริง |
| Journal plan/Apply/backup/activation/resume | ต่อแล้ว | ผ่าน fsync fault points, source-clear failure หลัง import, duplicate Apply, original ID/time preservation | pending | pending | Apply ต้อง modal ยืนยันและ recheck scope/hash/ownership; fallback resume_required + Reload | native process-kill/Windows filesystem matrix |
| Journal CLI / ingress / canonical evidence | ต่อแล้ว | ผ่าน pagination/cursor, revision, scope/history fixtures | pending | pending | 100 identities/tick, idle extension timer; canonical คือ ID/revision evidence ไม่ใช่ payload equality | receiver ใหม่ + actual readback; worker เมื่อ VS Code ปิด |
| รับทราบประวัติกู้ไม่ครบ | ต่อแล้ว | ผ่าน retained originals/history badge | pending | pending | acknowledgement ไม่เปลี่ยน completeness; ไม่ตัด unknown tail/conflict | native UI flow และ incident notification test |
| Codex surface | บางส่วน | metadata normalization ผ่าน | pending | pending | Desktop เมื่อ originator ตรง contract; ไม่ทราบเป็น unknown ไม่เดา CLI | CLI/IDE provenance และ context ณ producer boundary |
| Context ที่ส่งผิดลำดับ | เพิ่ม local queue แล้ว | ผ่าน delayed observation, monotonic checkpoint, conflict หลัง ACK/restart | pending | pending | additive local hash receipts; v2 replay ไม่อ่าน Git ปัจจุบันเพื่อเติม context | frozen Git observation จาก producers ทุกช่องทาง |
| User-confirmed task/session → repository | **ยังไม่พัฒนา** | ยังไม่รัน | pending | pending | ต้องมี revision/effective time/history และ scope proof | ทำก่อน Roo project binding |
| Health ราย adapter/surface/stage | บางส่วน | current/incomplete/stale regression ผ่าน | pending | pending | มี spool/broker/Journal stages; health กลางครบทุก adapter และ web UI ยังไม่ครบ | ปิด shared interpretation และ parked adjudication |
| Cursor Agent + Tab edit fragments | ต่อ native owned setup แล้ว | Python 4 fixtures + installer preservation ผ่าน | pending | pending | `afterFileEdit` / `afterTabFileEdit`; ข้อความทิ้งใน memory; generation ID ไม่ใช่ tool ID | payload/provider version จริงและ inline ledger |
| Copilot VS Code inline / daily | **ยังไม่ครบ** | ยังไม่มี connector regression | pending | pending | ไม่สร้าง session/PR cost จาก daily metrics; connector/checkpoint/storage ยังขาด | official endpoint/permission + feature flag โดยไม่เพิ่ม permission เอง |
| Roo Code | **ยังไม่ครบ** | ยังไม่มี bridge regression | pending | pending | public task ID/events มีจริง แต่ API ไม่ให้ project binding ที่ยืนยันแล้ว | bridge + mapping ที่ effective จากเวลายืนยัน |
| Cline Windows | รอ contract + installer | ยังไม่รัน | pending | pending | code ยังไม่เปิด Windows setup; การไม่มี runtime ไม่ใช่ unavailable | ตรวจ execution contract ที่ใช้งานจริงก่อน launcher |
| Deep Code / Windsurf | งานรอเจ้าของแยก | pending | pending | pending | product identity / Cascade version ต้องยืนยัน | เจ้าของส่ง identity/version เมื่อพร้อม |
| Internal packages 8 artifacts | workflow/preflight เพิ่มแล้ว | artifact tooling ผ่าน | **ยังไม่สร้างครบ / native smoke ยังขาด** | pending | ไม่มี Actions run ของ SHA ใหม่; native label/Node/Rust arch ต้องตรง | clean checkout, native lifecycle smoke, Actions สี่ targets |

## ผลตรวจที่รันจริง

- Rust Core 394 unit tests ผ่าน ก่อนเพิ่ม readonly old-key receipt regression; regression ใหม่ 1 test ผ่าน และ queue regression 33 tests ตรวจซ้ำหลัง refactor
- Rust CLI 90 unit tests ผ่าน
- CLI subprocess: broker_process 7, editor_handoff 6, offline_lifecycle 44 ผ่าน; editor_handoff 6 tests ตรวจซ้ำหลัง refactor scope proof
- Core integration: attribution conformance 1 และ offline_delivery 12 ผ่าน
- Backend readback validation/status 2 targeted tests ผ่าน; **ยังไม่ใช่ ClickHouse/backend integration**
- VS Code TypeScript lint และ 209 tests / 21 files ผ่าน
- Kilo/OpenCode/shared TS producer 21 tests ผ่าน
- Shared Python producer 11 tests; Cursor edit producer 4 tests ผ่าน
- Codex/Claude/Kimi shell fixtures และ shared emitter smoke ผ่าน; Gemini missing-CLI fixture อยู่ใน Python regression
- Artifact/certification tooling 53 tests ผ่าน; **ไม่ใช่ artifact จริงหรือ native runtime smoke**
- Strict Clippy Core/CLI/Server `--all-targets -- -D warnings` ผ่าน รวมรอบตรวจซ้ำหลัง refactor receipt
- Duration golden input/fixture เดิม: 3,600 seconds, total/day error 0; ไม่มีสูตร/timeout/overlap เปลี่ยน
- Backlog 1,191 รายการข้ามสามวัน + new event และ idle drain ผ่าน assertion ภายใน 120 วินาทีใน mock conditions; เวลา 38.31 วินาทีเป็น wall time ของชุด offline_lifecycle ทั้ง 44 tests **ไม่ใช่ drain latency**
- บาง tests ใช้ mock loopback และ isolated child HOME ด้วย approval; ไม่ใช่ข้อมูลจริง/Cloud/provider certification

## บั๊กที่ตรวจพบและแก้

1. Flush sanitize payload ก่อน ACK แล้วเอา payload ที่เปลี่ยนไปเทียบ SQLite row ต้นฉบับ ทำให้ server รับแล้วแต่ queue ลบไม่สำเร็จ และส่งซ้ำหลัง 402 recovery แยก original/sanitized/wire payload และ ACK+ledger+dequeue ใน transaction โดยตรวจ lease/ข้อมูลเดิม
2. Sidecar อ่าน fingerprint จากไฟล์ปัจจุบันตอน deferred broker process แก้เป็นใช้ boundary fingerprint ที่มีเท่านั้น; ไม่มี baseline ให้ unavailable
3. Broker inbox และ editor observation ไม่แยก credential owner แก้ additive scope และ claim เฉพาะ current/proved aliases; records เดิมไม่ทราบเจ้าของ parked
4. Dead letter ถูก compact ตามอายุ แก้ให้ retained dead letter ไม่หมดอายุอัตโนมัติ
5. Legacy file hooks หยุดเมื่อ CLI หาย แก้ให้บันทึก shared spool แทน และไม่ fallback ไป direct emit ที่ไม่ยืนยัน durability
6. Context เก่ามาทีหลังถูกข้ามทั้งหมด แก้ให้เก็บ delayed evidence แต่ไม่ rewind current checkpoint และเก็บ ID/hash receipt หลัง queue ACK
7. Lifecycle timestamp ถูกแทนด้วยเวลา producer เริ่ม แก้ session marker ให้ใช้ explicit occurred_at เดิมและตรวจ pause ตาม event time
8. Recovery writer กลับ healthy แล้วเตือนราวกับประวัติกู้ครบ แยก current recovery จาก historical incompleteness และ acknowledgement

## งานถัดไปเรียงลำดับ

1. Durable legacy tool boundary ปิด source/local tests แล้วตาม [รายงานรอบต่อ](tool-boundary-durability-2026-10-11.md); ทำ producer-side frozen Git context พร้อม pending dependency/scoped identity ต่อ
2. ทำ user-confirmed mapping และ health per adapter/surface/stage ให้ครบ VS Code/Overview/Heartbeats
3. ต่อ Copilot daily connector และ Roo bridge; ตรวจ Cline Windows contract; Deep Code/Windsurf คง owner-pending แยก
4. ทำ native artifact lifecycle smoke แล้วสร้างแปด artifacts จาก clean SHA เดียวผ่าน Actions; ไม่มีการนับ cross compilation เป็น native pass
5. Live install/upgrade/rollback และ 10 sessions ต่อ surface/OS/metric; canary 7 วัน, signing, publish เป็น gates แยก

Rollback ปิด adapter/feature เท่านั้น รักษา spool, queue IDs, ingress receipts, Journal originals/backup/history และ additive schema ทั้งหมด ยังไม่มี candidate ใหม่ที่รับรองว่า production-ready

## Contract sources

- [Cursor hooks](https://prod.cursor.com/docs/hooks): Agent และ Tab เป็นคนละ hook; completed edit fragments ไม่พิสูจน์ suggested/rejected counters
- [Roo public task event definitions](https://github.com/RooCodeInc/Roo-Code/blob/main/packages/types/src/events.ts), [public API](https://github.com/RooCodeInc/Roo-Code/blob/main/packages/types/src/api.ts): ใช้ task ID จริง; ไม่ดึงข้อความหรือเดา project จาก active workspace
- [Copilot usage metrics](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics): รักษา provider granularity ไม่แจก daily metrics ลง session/PR

เอกสารเหล่านี้เป็นหลักฐาน contract สำหรับการพัฒนา ไม่แทน payload และ certification จริง
