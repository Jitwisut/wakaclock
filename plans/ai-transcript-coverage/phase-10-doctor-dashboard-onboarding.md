# Phase 10 — Doctor, status, consent และ dashboard

สถานะ: **ขั้น 9 ส่วน CLI ✅ และ agent ID ฝั่ง server ✅ (2026-10-26); onboarding ใน VS Code ยังไม่ทำ** ดู "ผลการทำ" ท้ายไฟล์
ขึ้นกับ: Phase 01–09 · ส่วน diagnostics บางข้อทำคู่ไปกับแต่ละ phase ได้

## เป้าหมาย

1. ให้ผู้ใช้และทีมเห็นสถานะ parser ทุกตัวได้ในที่เดียว (`wakaclock doctor ai`, `wakaclock ai status`)
2. ขอ consent อย่างถูกต้องสำหรับ tool ที่ไม่มี hook (ตอนนี้ sync ผูกกับ hook consent)
3. แสดงผลใน dashboard โดยไม่ทำให้ผู้ใช้เข้าใจยอดเวลาผิด

## สภาพปัจจุบัน

- `print_ai_status(json)` และ `collect_ai_diagnostics_v2(upload)` ใน `cli/src/main.rs`
- `TranscriptLag` วัดเป็น byte (`core/src/ai/parser.rs`)
- การเริ่ม sync อัตโนมัติจาก editor heartbeat ผูกกับ consent ของ hook (`cli/src/main.rs`)
- dashboard แสดง non-verified AI เป็น "Unattributed AI" (`migrations/001_init.sql` view `ai_daily`,
  `server/services/ai_stats.rs`)

## งาน

### 10.1 Diagnostics ต่อ parser

เพิ่มใน `collect_ai_diagnostics_v2` และ `print_ai_status`:

| field | ความหมาย |
|---|---|
| `parser_id`, `source_kind` | jsonl / sqlite / snapshot / descriptor |
| `install_state` | not_installed / installed_no_data / active |
| `sources` | จำนวน source ที่พบ (ไม่แสดง path เต็มใน upload) |
| `lag` | byte / แถว / record ตามชนิด |
| `last_event_at` | เวลา event ล่าสุดที่ส่ง |
| `budget_hits`, `sqlite_lock_skips`, `parser_panics` | นับต่อ 24 ชม. |
| `schema_unknown` | พบไฟล์แต่ map ไม่ได้ |
| `claims_suppressed`, `claims_conflicts`, `pending_grace` | จาก Phase 02 |
| `cert_status`, `cert_expires_at` | จาก `certifications/ai-adapters/` |
| `time_mode` | time_neutral / counted |

- upload diagnostics ต้องไม่มี path เต็ม, prompt, ชื่อไฟล์โค้ด (ใช้ hash หรือจำนวน)
- `--json` ให้ schema คงที่สำหรับ VS Code extension และ desktop app

### 10.2 Consent ต่อ tool (ตาม Q6)

ตัวเลือกที่จะถามเจ้าของ:
- **แบบ A**: consent เดียว "อ่าน log ของ AI tools ในเครื่อง" + รายการ tool ที่พบ และปิดราย tool ได้
- **แบบ B**: ถามทีละ tool เมื่อพบครั้งแรก

ทั้งสองแบบต้องมี:
- `wakaclock ai sources list` แสดง tool ที่พบ + สถานะเปิด/ปิด
- `wakaclock ai sources disable <id>` / `enable <id>`
- เก็บสถานะใน config เดิมของ wakaclock (ตาม [`.context/environment.md`](../../.context/environment.md))
- ค่าเริ่ม: tool ที่ไม่มี hook = **ปิด** จนกว่าผู้ใช้ยืนยัน (ปลอดภัยกว่า)

### 10.3 Onboarding ใน VS Code extension / desktop app

- หน้า/คำสั่งที่แสดง tool ที่พบในเครื่อง พร้อมสถานะ verified/unverified และปุ่มเปิด/ปิด
- อธิบายสั้นๆ ว่าอ่านอะไรและส่งอะไร (metadata + counts เท่านั้น)
- ไฟล์ที่เกี่ยวข้อง: `extensions/vscode/src/**` (protected — ต้องขออนุมัติรวมใน phase นี้)

### 10.4 Dashboard

- เพิ่มชื่อ/ไอคอนของ agent ID ใหม่ใน frontend (ตาม [`.context/workflows/adding-dashboard-panel.md`](../../.context/workflows/adding-dashboard-panel.md))
- Tool ที่มีแค่ token ไม่มี edit: แสดงตาม Q5 (เช่น อยู่ในหน้า usage/cost แต่ไม่อยู่ในกราฟบรรทัด)
- Tool ที่ยัง time-neutral (ส่งแค่ usage): แสดง token/model ได้; บรรทัดมีแค่ใน dry-run ในเครื่อง แต่ต้องไม่ทำให้ดูเหมือนเวลา AI เพิ่ม
  และต้องมีป้ายบอกว่า "ยังไม่นับเวลา"
- **การเปลี่ยน label, unit, rounding หรือข้อความที่อาจทำให้ผู้ใช้เข้าใจจำนวนเวลาเปลี่ยน**
  อยู่ใน protected scope หมวด 4 ของ heartbeat-safety ต้องขออนุมัติแยก
- Query key ทุกตัวต้องมี `userId` ([`.context/frontend/data-layer.md`](../../.context/frontend/data-layer.md))

## ไฟล์

แก้: `cli/src/main.rs` (status/doctor/sources commands), `core/src/ai/diagnostics.rs`,
`core/src/ai/parser.rs` (`TranscriptLag`), `extensions/vscode/src/**` (onboarding),
`frontend/app/components/wakaclock/**` และ `frontend/app/lib/wakaclock/**` ที่แสดง agent

เพิ่ม: คำสั่ง `wakaclock ai sources`, test ของ JSON schema ของ status

## Tests

| Test | ยืนยัน |
|---|---|
| `wakaclock ai status --json` schema | ฟิลด์ครบ เสถียร |
| diagnostics upload | ไม่มี path เต็ม/prompt |
| sources disable | parser ที่ปิดไม่ถูกเรียก |
| consent ค่าเริ่ม | tool ไม่มี hook ปิดอยู่ |
| VS Code extension tests | onboarding แสดงและเปิด/ปิดได้ |
| frontend `npm run validate` | typecheck + lint + tests ผ่าน |

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์" (มี frontend readback ที่เป็น protected หมวด 4)
2. ทำ: diagnostics, sources commands, consent, onboarding, ป้ายชื่อใน dashboard
3. ผล: ผู้ใช้เห็นและควบคุมได้ว่าอ่าน tool ไหน
4. ความเสี่ยง: label ทำให้เข้าใจยอดเวลาผิด, diagnostics หลุด path, consent ค่าเริ่มผิด
5. หลักฐาน: tests + screenshot dashboard ก่อน/หลัง
- Baseline: ไม่แตะการคำนวณ; ข้อความแสดงผลต้องได้อนุมัติแยกตามหมวด 4

## Exit criteria

- [ ] doctor แสดงทุก parser พร้อมสถานะ
- [ ] consent ทำงานตามข้อตัดสิน Q6
- [ ] dashboard แสดง agent ใหม่และป้าย time-neutral
- [ ] frontend validate ผ่าน

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| ผู้ใช้ตกใจที่ tool อ่าน log ในเครื่อง | อธิบายชัด + ค่าเริ่มปิดสำหรับ tool ไม่มี hook |
| dashboard ทำให้ดูเหมือนเวลาเพิ่ม | ป้าย time-neutral และไม่รวมในยอดเวลา |
| status JSON เปลี่ยนแล้ว extension พัง | versioned schema + test |

## ผลการทำ (ขั้น 9, 2026-10-26)

ทำภายใต้การอนุมัติรวมขั้น 7–9 · Q6 = อ่านอัตโนมัติ เปิดไว้เป็นค่าเริ่ม ปิดรายเครื่องมือได้
(แทนค่าเริ่ม "ปิด" ที่เขียนไว้ใน 10.2)

**ทำแล้ว (CLI เท่านั้น)**
- `wakaclock ai sources list [--json]`: ทุก parser พร้อม `enabled`, `source_kind`, `sources` (จำนวน),
  `time_mode` (`time_neutral` / `counted`) และยอด dry-run edit (`count`, `lines_added`,
  `lines_deleted`, `latest_at`) ไม่มี path, prompt หรือชื่อไฟล์
- `wakaclock ai sources disable|enable <agent> [--json]`: เก็บใน state DB ในเครื่อง
  (`~/.wakaclock/ai-attribution.sqlite3` ตาราง `ai_source_preferences`) ไม่ใช่ไฟล์ TOML เพื่อไม่เขียนทับ
  config ที่ผู้ใช้แก้เอง ปิดแล้ว sync, identity repair และ measurement-repair preview จะไม่อ่าน tool นั้นเลย
  (รวม usage และ dry-run) cursor เก็บไว้; เปิดใหม่จะ seed ทุก source ที่ปลายไฟล์ จึงไม่อ่านช่วงที่ปิดย้อนหลัง
- `ai sync --agent <ปิดอยู่>` ล้มพร้อมข้อความให้เปิดก่อน (ไม่ใช่ "not supported")
- `ai status --json` เพิ่มฟิลด์เดียวกัน (เพิ่มอย่างเดียว ไม่เปลี่ยนชื่อ/ไม่ลบฟิลด์เดิม) และรวมสถานะ hook ของ
  Kilo/Kimi เข้าแถว parser ของมัน (เดิมขึ้น 2 แถว) — 18 agent ไม่ซ้ำ
- ไม่แตะ `collect_ai_diagnostics_v2` / `ai doctor --upload` (schema ที่ส่งขึ้น server คงเดิม)

**แก้เพิ่มระหว่างทาง (จากการรีวิว)**: source ที่เป็น database เดียว (Cursor, Windsurf, OpenCode, Qoder)
เดิมจะส่ง usage ย้อนหลังทั้งประวัติเมื่ออ่านครั้งแรก ตอนนี้มี `history_floor_ms` ใน `ParserContext`:
ครั้งแรกย้อนแค่ 24 ชม. (เท่ากับกติกา JSONL) และ seed = เริ่มจากตอนนี้; OpenCode/Qoder ได้โควตาแถวเพิ่ม
สำหรับช่วงอ่านซ้ำ 500 แถว เพื่อให้ checkpoint ขยับเสมอ (commit `f35b98c3`)

**ยังไม่ทำ / ต้องถามเจ้าของ**
- Dashboard (10.4): server แสดง agent ที่ไม่อยู่ใน `KNOWN_AGENT_IDS` (`core/src/ai/event.rs`) เป็น
  `unknown` (`handlers/v2/work_sessions.rs` `public_agent`) และใช้รายการเดียวกันใน SQL จัดประเภท actor
  (`services/ai_stats.rs`) จึงต้องเพิ่ม ID แบบ server-first: `qwen-code`, `pi`, `kiro`, `factory-droid`,
  `ibm-bob`, `qoder` (ID อื่นมีอยู่แล้ว) ซึ่งอยู่นอกเงื่อนไขการอนุมัติรวม (ห้ามแตะ server)
  → **อนุมัติแยกแล้ว 2026-10-26** และเพิ่มแล้ว (ไม่เพิ่ม alias) พร้อม test ว่า parser ทุกตัวใน registry
  เป็น ID ที่ server รู้จัก; ต้อง deploy server ก่อน client รุ่นที่ส่ง ID เหล่านี้ dashboard ไม่มีรายการ
  agent ของตัวเอง (แสดงชื่อ ID ตามที่ server ส่งมา) จึงไม่ต้องแก้ frontend
  ส่วนยอด token รวมในหน้า AI แสดงอยู่แล้วโดยไม่ต้องแก้ (usage endpoint รับ agent ใดก็ได้)
- Onboarding ใน VS Code extension (10.3): ยังไม่ทำ ต้องขออนุมัติแยกเพราะเป็นไฟล์ client ที่ protected
- ตัวนับ budget/lock skip/panic ต่อ 24 ชม. และ lag เป็นแถว: ยังไม่ทำ (ต้องมีที่เก็บตัวนับถาวร)
- tests: core 481 passed, cli 109+7+8+44, clippy สะอาด; smoke test ใน HOME ชั่วคราวผ่าน

## ผลการทำ: auto sync ทุกเครื่องมือ (2026-10-26, อนุมัติแยก, consent แบบ A)

- `run_bounded_ai_sync` (`cli/src/main.rs`): Codex → Claude Code → Gemini CLI ลำดับและงบ 2 วินาทีเดิม;
  parser อื่นที่เปิดอยู่ใช้งบรวม 2 วินาที เรียงตามตัวที่ไม่ได้อ่านนานสุด (`auto_sync_rotation`)
  ข้ามตัวที่อ่านภายใน 60 วินาที ไม่เริ่มตัวใหม่ถ้างบเหลือ < 300 ms; บันทึกเวลาก่อนอ่านทุกตัว
  (ตาราง `auto_sync_schedule`) ตัวที่หมดเวลาจึงไปต่อท้าย; ถือ `AiSyncLock` ครั้งเดียวทั้งรอบ
  (ถ้ามีคนถืออยู่ = ข้ามทั้งรอบ); ตัวที่ผู้ใช้ปิดถูกกรองออกก่อนเรียก (รวม 3 ตัวเดิม)
- งบเวลาส่งเข้า parser จริง: `ParseContext.time_budget` = เวลาที่เหลือ และ `parse_usage_within`
  (ค่าเริ่มเรียก `parse_usage` เดิม; Cursor/Windsurf/OpenCode/Qoder ใช้งบนี้) — parser JSONL ไม่ใช้
  `time_budget` จึงไม่เปลี่ยน; การข้าม usage เมื่องบ < 300 ms ใช้เฉพาะ source แบบ SQLite
  (อ่านซ้ำทุกรอบอยู่แล้ว) เพื่อไม่ให้ usage ของ JSONL หาย — แคบกว่าคำขอเดิมเพื่อความปลอดภัย
- consent ไม่เปลี่ยน: ต้องมี observer + hook consent อย่างน้อย 1 ตัวเหมือนเดิม
- หลักฐาน: test `auto_sync_rotation_takes_the_longest_waiting_turned_on_parsers`,
  `usage_reads_stop_within_their_budget` (20,000 แถว, งบ 1 ms หยุดภายใน 1 วินาที), state test ของตาราง;
  core 483, cli 110+7+8+44 ผ่าน, clippy สะอาด, integration 7 ok + 2 Cursor scaffold เดิม
- วัดเวลา `wakaclock heartbeat` ใน HOME ชั่วคราว (Cursor 20,000 bubble + OpenCode 20,000 message
  สังเคราะห์, server ปิด): ปิด rotation (= ขอบเขตเดิม) 0.02–0.03 วินาที; เปิด rotation ครั้งแรก
  0.47 วินาที (queue usage 7,000 แถว), ครั้งต่อมา 0.03 วินาที (ยังไม่ครบ 60 วินาที); heartbeat ของ
  editor เข้า queue ทุกครั้ง (ห่างจากเส้นตาย 45 วินาทีของ extension มาก)
- ข้อสังเกต: ตอน offline แต่ละ tool ที่ถึงคิวพิมพ์ warning "sync skipped: HTTP error" หนึ่งครั้ง
  (เหมือนพฤติกรรม 3 ตัวเดิม) usage ยังอยู่ใน queue; รอบถัดไปเงียบเพราะ backoff ของ pending usage
