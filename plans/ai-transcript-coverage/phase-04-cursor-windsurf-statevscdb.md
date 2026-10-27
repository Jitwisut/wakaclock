# Phase 04 — Cursor IDE, Windsurf

สถานะ: **ทำแล้วใน worktree (2026-10-26) ยังไม่ commit** — ขั้น 6 ใน README
`cursor-agent` CLI **ย้ายไปขั้น 8** (Tier 2 สำรวจ storage ก่อน) ตามที่เจ้าของอนุมัติ

## ผลการทำ (2026-10-26)

ที่ทำ:
- `core/src/ai/vscdb_kv.rs`: อ่านเฉพาะ key `bubbleId:%` ของ `cursorDiskKV` ผ่าน `sqlite_source` (read-only, lock → ข้าม,
  งบเวลา, fingerprint) + อ่านย้อน 500 rowid ทุกรอบเพราะ bubble ถูกอัปเดตทับที่เดิม; checkpoint ที่ถูกตัดกลางคัน
  ไม่บันทึก fingerprint (ไม่งั้นรอบหน้าจะข้ามแถวที่ยังไม่อ่าน)
- `core/src/ai/cursor.rs`: `CursorFamilyParser::cursor()` / `::windsurf()` (`Cursor`, `Windsurf`, `Windsurf - Next`;
  macOS/Windows/Linux); edit = bubble assistant + `toolFormerData` เครื่องมือแก้ไฟล์ + `status = completed`;
  usage = `tokenCount` ของ bubble ที่อายุ ≥ 2 นาที; `seed_at_head` = MAX(rowid) ของ bubble
- registry เลือกด้วย id (`None` runtime → usage only); `adapter.rs` เพิ่มแค่ `transcript_roots`; `CAPABILITIES.md`

ต่างจากคำขอโดยตั้งใจ (ไฟล์ชุดเดิม):
- ไม่ใช้ `source_record_hashes`: parser ไม่ได้รับ state DB และถ้าเปิด `~/.wakaclock` เองจะทำให้ test เขียนลง home จริง →
  ใช้ event/usage ID ที่คงที่ต่อ bubble แทน แล้วให้ปลายทางที่ idempotent อยู่แล้วกันซ้ำ
- `provider` เป็นค่าว่าง (editor ส่งต่อไปหลายผู้ให้บริการ model; ชื่อ editor ไม่ใช่ผู้ให้บริการ model)
- ยังไม่นับ prompt สำหรับ Cursor/Windsurf: การผูก prompt กับ usage ขึ้นกับช่วงที่อ่านย้อน → ค่าไม่คงที่ระหว่างรอบ
  และ usage ID เดิมที่ค่าเปลี่ยนจะถูกเก็บเป็น conflict

หลักฐาน: core 453 + 12 + 1 ผ่าน (`vscdb_kv` 5, `cursor` 7: completed/pending/read/create, อัปเดตภายหลังได้ ID เดิม,
Windsurf, usage เฉพาะ bubble ที่นิ่งแล้ว/ข้ามค่า 0, seed, marker ลับไม่หลุด, discovery); cli 108 + 7 + 8 + 44 ผ่าน;
clippy, rustfmt ผ่าน; integration ผ่าน (Cursor **hook** scaffold 2 ตัวล้มตั้งแต่ก่อนแก้ ไม่เกี่ยวกับ parser)

ยังไม่ได้ทำ: ยืนยัน schema กับ db จริง (ขั้นทดสอบรวม: ติดตั้ง Cursor + Windsurf และใช้ agent แก้ไฟล์จริง);
แปลง path แบบ relative เป็น absolute; ตอนเปิดส่ง edit (ขั้น 11) ต้องจับคู่กับ hook `afterFileEdit` ของ Cursor
(`conversation_id`/`generation_id`)

## เป้าหมาย

อ่าน `state.vscdb` ของ Cursor และ Windsurf (schema เดียวกัน) และ transcript ของ cursor-agent CLI
เพื่อให้ได้ edit + token + model ของ Tier 1 สองตัวที่ตอนนี้ไม่มี token เลย

## สภาพปัจจุบัน

- Cursor: มี hook `~/.cursor/hooks.json` (`afterFileEdit`) ที่สร้างจาก public docs แต่ไม่เคยรันกับ Cursor จริง
  (`extensions/ai-agents/cursor/scripts/heartbeat-hook.sh`, manifest ใน `core/src/ai/adapter.rs`)
- Windsurf: ไม่มีอะไรเลย (ID `windsurf` มีใน `KNOWN_AGENT_IDS` แล้ว)
- cursor-agent: มีแค่ ID `cursor-agent`
- ไม่มีโค้ดใดอ่าน `state.vscdb`

## ข้อเท็จจริงเรื่องข้อมูล (ต้องยืนยันกับไฟล์จริง)

| รายการ | ค่า |
|---|---|
| ไฟล์ Cursor | `AppSup/Cursor/User/globalStorage/state.vscdb` |
| ไฟล์ Windsurf | `AppSup/Windsurf/User/globalStorage/state.vscdb`, `AppSup/Windsurf - Next/...` |
| Windows | `%APPDATA%\Cursor\User\globalStorage\state.vscdb` |
| Linux | `~/.config/Cursor/User/globalStorage/state.vscdb` (บางเครื่องเป็น `~/.config/cursor/`) |
| ตาราง | `cursorDiskKV(key TEXT, value BLOB)` |
| key ที่ใช้ | `bubbleId:<composerId>:<bubbleId>` (value = JSON) |
| field ใน bubble | `createdAt`, `type` (2 = assistant), `tokenCount{inputTokens, outputTokens}` หรือ `usage`, model (หลายชื่อ field), `toolFormerData{name, status, params.relativeWorkspacePath, rawArgs}` |
| tool ที่เป็น edit | `edit_file`, `edit_file_v2` (status `completed`) |
| tool ที่เป็น read | `read_file*` (ไม่นับเป็น edit) |
| เนื้อหาก่อน/หลัง | อ้างผ่าน `beforeContentId` / `afterContentId` ไปยัง row อื่น |
| plan ของผู้ใช้ | `ItemTable` key `cursorAuth/stripeMembershipType` (ไม่ต้องใช้) |
| cursor-agent | `~/.cursor/projects/*/agent-transcripts/**.{jsonl,txt}`, `~/.cursor/ai-tracking/ai-code-tracking.db` ตาราง `ai_code_hashes` |

## Design

### `core/src/ai/vscdb_kv.rs` (ตัวอ่านร่วมของตระกูล state.vscdb)

- ใช้ `sqlite_source.rs` จาก Phase 01 (read-only, budget, fingerprint)
- query เฉพาะ `key LIKE 'bubbleId:%'` ตาม rowid ที่มากกว่า cursor, จำกัด 5,000 แถวต่อรอบ
- bubble ที่ถูกแก้ทับที่เดิม (token เพิ่มระหว่าง stream) → ตรวจด้วย `source_record_hashes`
  และส่งเฉพาะส่วนต่างของ token (usage revision เดิม)
- **ห้าม** อ่าน key อื่นนอกจากที่ระบุ (database นี้เก็บข้อมูลอื่นของ editor ด้วย)

### การนับบรรทัด

- ถ้ามี diff ใน `toolFormerData` → นับ `+`/`-` ใน memory แล้วทิ้งเนื้อหา
- ถ้าต้องดึง before/after content → อ่านสอง row นั้น คำนวณ line diff ใน memory แล้วทิ้ง ห้ามเก็บหรือส่ง
- ถ้าได้แค่ค่า net หรือไม่ได้เลย → ส่ง `line_measurement_status = "partial"` หรือ `"unavailable"`
  (field มีอยู่แล้วใน `core/src/heartbeat.rs`)
- path: `params.relativeWorkspacePath` ต้องต่อกับ workspace root ให้เป็น absolute
  workspace root หาได้จาก `workspaceStorage/<hash>/workspace.json` (ต้องยืนยัน)

### Session และ dedupe

- `session_id` = composerId
- tool-call ID = bubbleId (+ toolCall id ถ้ามี) → ใช้เป็น key ใน claim ledger ของ Phase 02
- ต้องพิสูจน์ก่อนว่า hook `afterFileEdit` ของ Cursor ส่ง ID ที่จับคู่กับ bubble ได้
  ถ้าไม่ได้ → ใช้ fingerprint fallback ของ Phase 02 และบันทึกใน matrix

### ไฟล์ parser

- `core/src/ai/cursor.rs` — `AiActivityParser` id `cursor` ใช้ `vscdb_kv`
- `core/src/ai/windsurf.rs` — id `windsurf` ใช้ `vscdb_kv` ด้วย root ต่างกัน
- `core/src/ai/cursor_agent.rs` — id `cursor-agent`:
  - JSONL transcripts → `Jsonl` cursor
  - `ai-code-tracking.db` → `Sqlite` cursor (ใช้เป็นหลักฐานเสริมว่าโค้ดมาจาก AI ไม่ใช่แหล่ง edit หลัก)

## ไฟล์

แก้: `core/src/ai/parser_registry.rs`, `core/src/ai/adapter.rs`, `core/src/ai/mod.rs`,
`core/src/ai/CAPABILITIES.md`

เพิ่ม: `core/src/ai/vscdb_kv.rs`, `core/src/ai/cursor.rs`, `core/src/ai/windsurf.rs`,
`core/src/ai/cursor_agent.rs`, fixture SQLite ที่สร้างจาก script ใน test (ไม่ commit database จริง)

## Tests

| Test | ยืนยัน |
|---|---|
| fixture db สร้างใน test: bubble assistant + edit_file completed | 1 edit, บรรทัดถูก, model ถูก |
| bubble ที่ status ไม่ completed | ไม่นับ |
| read_file | ไม่นับเป็น edit |
| bubble ถูกแก้ทับ (token เพิ่ม) | usage ส่งเฉพาะส่วนต่าง, event ID เดิม |
| key อื่นในตาราง | ไม่ถูกอ่าน |
| database ถูก lock | ข้ามรอบอย่างสุภาพ, warning ใน diagnostics |
| checksum ของ db ก่อน/หลังอ่าน | ไม่เปลี่ยน |
| Windsurf ใช้ fixture เดียวกันกับ root ต่าง | agent ID เป็น `windsurf` |
| privacy | ไม่มี content/diff/prompt text ใน payload |

## Live certification

| Tool | macOS | Windows | Linux |
|---|---|---|---|
| Cursor IDE (Agent/Composer) | ☐ | ☐ | ☐ |
| Windsurf (Cascade) | ☐ | ☐ | ☐ |
| cursor-agent CLI | ☐ | ☐ | ☐ |

สคริปต์ session เหมือน Phase 03 และเพิ่มกรณี:
- ปฏิเสธ (reject) การแก้ของ agent → ต้องไม่นับ หรือนับตามที่ข้อมูลระบุได้ชัด (บันทึกผลจริง)
- Tab completion → **ไม่อยู่ใน scope** (non-goal) ต้องไม่ถูกนับเป็น edit ของ agent

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: ตัวอ่าน `cursorDiskKV` แบบ read-only + parser 3 ตัว
3. ผล: Cursor/Windsurf/cursor-agent ได้ token + model ทันที; edit เก็บแบบ dry-run จนกว่าจะ certify (time-neutral)
4. ความเสี่ยง: lock database ของ editor ที่กำลังใช้, อ่านข้อมูลเกินจำเป็น, reject ถูกนับเป็น edit,
   schema เปลี่ยนตาม version
5. หลักฐาน: tests ข้างบน, checksum test, live cert 3 OS
- Baseline: time-neutral = ส่งแค่ usage (`emit_edit_heartbeats=false`, [Phase 01 ข้อ 9](phase-01-source-cursors-and-engine.md)); edit เก็บแบบ dry-run จนกว่า Phase 11 อนุมัติ → ผลต่อเวลา 0%

## Exit criteria

- [ ] parser 3 ตัวผ่าน tests และ live cert บน macOS
- [ ] ไม่พบ lock/ช้าในการใช้งาน Cursor/Windsurf ระหว่าง sync (เจ้าของยืนยัน)
- [ ] dedupe กับ hook ของ Cursor ทำงาน หรือมีเหตุผลบันทึกว่าทำไมใช้ fingerprint
- [ ] matrix อัปเดต

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| Cursor เปลี่ยน schema บ่อย | parser ทนต่อ field ที่หาย, บันทึก version, doctor แจ้ง "schema ไม่รู้จัก" |
| database ใหญ่หลาย GB | อ่านตาม rowid + จำกัดแถว + fingerprint skip |
| อ่าน before/after content ทำให้หน่วยความจำสูง | จำกัดขนาดต่อ row และข้ามถ้าเกิน (ตั้ง `partial`) |
| ข้อมูลส่วนตัวใน key อื่น | query ด้วย prefix เท่านั้น และมี test |
