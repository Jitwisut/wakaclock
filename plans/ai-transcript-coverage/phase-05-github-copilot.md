# Phase 05 — GitHub Copilot (VS Code + CLI)

สถานะ: **ขั้น 5 ใน README (ทำก่อน Phase 04 เพราะเครื่องเจ้าของมีข้อมูลจริงแล้ว) — รอ Phase 01 + approval** (ต้องได้คำตอบ Q1 เรื่อง `copilot` / `copilot-cli`)
Tier: 1 · ขึ้นกับ: Phase 01 (snapshot + SQLite), Phase 02

## เป้าหมาย

เปลี่ยน Copilot จาก "markers เท่านั้น" เป็น edit + token + model สำหรับ:
1. Copilot Chat / Agent mode / Edits ใน VS Code
2. Copilot CLI

Inline completion (ghost text) **ไม่อยู่ใน scope** เพราะไม่มี log การ accept ที่ระบุได้แน่นอน (non-goal)

## สภาพปัจจุบัน

- มี hook ของ VS Code agent ที่ `~/.wakaclock/vscode-agent-hooks.json` และ Copilot CLI hooks
  (`cli/src/native_hooks.rs`, `cli/src/ai_setup.rs`) ได้แค่ markers ไม่เคยรันกับของจริง
- มี connector ฝั่ง server สำหรับตัวนับรายวัน (คนละเรื่องกับแผนนี้ ไม่แตะ)
- เครื่องเจ้าของมี VS Code (`AppSup/Code/User/workspaceStorage`, `globalStorage/github.copilot-chat`)
  และ `~/.copilot` แต่ยังไม่มี `session-state/`

## ข้อเท็จจริงเรื่องข้อมูล (ต้องยืนยันกับไฟล์จริง)

| แหล่ง | Path (macOS) | รูปแบบ | ได้อะไร |
|---|---|---|---|
| Chat sessions | `AppSup/Code/User/workspaceStorage/<hash>/chatSessions/*.json` หรือ `*.jsonl` | JSON เขียนทับ หรือ JSONL patch log (`set`/`insert` บน `requests`, `modelState`, `response`) | prompt (นับ), model, token จาก result metadata, edit จาก `textEditGroup` |
| Editing sessions | `…/workspaceStorage/<hash>/chatEditingSessions/<id>/state.json` | JSON เขียนทับ | ไฟล์ที่ถูกแก้ + จำนวนบรรทัด |
| Agent traces (OTel) | `AppSup/{Code,Cursor,Windsurf,VSCodium}/User/globalStorage/github.copilot-chat/agent-traces.db` | SQLite `spans`, `span_attributes` | token ต่อ request |
| Copilot CLI events | `~/.copilot/session-state/<id>/events.jsonl` | JSONL | `session.start`, `session.model_change`, `user.message`, `assistant.message`, `tool.execution_*` (มี lines added/removed), `session.shutdown` |
| Copilot CLI store | `~/.copilot/session-store.db` | SQLite `assistant_usage_events`, `sessions` | token |
| Workspace root | `…/workspaceStorage/<hash>/workspace.json` | JSON | folder URI ของ workspace |

Windows: `%APPDATA%\Code\User\...`; Linux: `~/.config/Code/User/...`
รองรับ VS Code Insiders (`Code - Insiders`) และ VSCodium ด้วย root list

## Design

### `core/src/ai/copilot.rs` (id `copilot`)

- ค้นหา `workspaceStorage/*/chatSessions/*` ทุก editor root
- `.json` → `JsonSnapshot` cursor; `.jsonl` (patch log) → `Jsonl` cursor + เล่น patch ใน memory
  ให้ได้สถานะ request ล่าสุด แล้วแตก record ตาม `requestId`
- edit: จาก `textEditGroup` ของ response และ/หรือ `chatEditingSessions/<id>/state.json`
  - ถ้าทั้งสองแหล่งให้ข้อมูลเดียวกัน ใช้ editing session เป็นหลัก (มีสถานะ accept/reject ชัดกว่า — ต้องยืนยัน)
  - edit ที่ผู้ใช้ reject → ไม่นับ (ถ้าข้อมูลระบุได้) และบันทึกผลจริงในใบรับรอง
- token: จาก result metadata ถ้ามี; ถ้าไม่มีให้ join กับ `agent-traces.db` ด้วย request/trace ID
- path: ต่อ relative path กับ workspace root จาก `workspace.json`
- tool-call ID สำหรับ dedupe กับ hook ของ VS Code agent: `requestId` + edit index (ต้องยืนยันว่า hook เห็นค่าเดียวกัน)

### `core/src/ai/copilot_cli.rs` (id ตาม Q1: `copilot-cli` หรือ `copilot`)

- `events.jsonl` → `Jsonl` cursor
- edit: `tool.execution_complete` ที่มี lines added/removed และ path
- model: `session.start` + `session.model_change`
- token: `session-store.db` ตาราง `assistant_usage_events` → `Sqlite` cursor แล้ว reconcile กับ session
- dedupe กับ Copilot CLI hooks ผ่าน claim ledger

### Privacy

- ไฟล์ chat session มีข้อความ prompt และ response เต็ม → parser ต้องดึงเฉพาะ field ที่ต้องใช้
  แล้วทิ้ง object ที่เหลือทันที ห้าม log raw record แม้ใน debug
- เพิ่ม test ที่ใส่ข้อความ marker ลับใน fixture แล้วยืนยันว่า marker ไม่อยู่ใน payload, log, state

## ไฟล์

แก้: `core/src/ai/parser_registry.rs`, `core/src/ai/adapter.rs`, `core/src/ai/mod.rs`,
`core/src/ai/event.rs` (ถ้า Q1 เลือกแยก ID), `core/src/ai/CAPABILITIES.md`

เพิ่ม: `core/src/ai/copilot.rs`, `core/src/ai/copilot_cli.rs`, `core/src/ai/vscode_storage.rs`
(หา editor roots + `workspace.json` ใช้ร่วมกับ Phase 06), fixtures ใน `core/src/ai/fixtures/copilot/`

## Tests

| Test | ยืนยัน |
|---|---|
| chatSessions `.json` เขียนทับ 2 ครั้ง | ไม่ส่งซ้ำ |
| chatSessions `.jsonl` patch log | เล่น patch ถูก, request ล่าสุดเท่านั้น |
| editing session accept / reject | นับเฉพาะที่ accept (ถ้าระบุได้) |
| join token จาก `agent-traces.db` | token ตรงกับ request |
| หลาย workspace + Insiders | path ถูก workspace |
| Copilot CLI events | edit + model + token ถูก |
| marker ลับใน prompt | ไม่หลุดไปที่ใด |
| hook + transcript ของ request เดียวกัน | 1 edit |

## Live certification

| Surface | macOS | Windows | Linux |
|---|---|---|---|
| VS Code Copilot Chat (Ask) | ☐ | ☐ | ☐ |
| VS Code Copilot Edits / Agent | ☐ | ☐ | ☐ |
| Copilot CLI | ☐ | ☐ | ☐ |

session ตามสคริปต์มาตรฐาน + กรณี reject 1 ครั้ง และ "Keep/Undo" ใน editing session
(Ask mode ไม่มี edit → ต้องได้แค่ usage)

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: parser Copilot VS Code (snapshot + patch log + traces db) และ Copilot CLI (JSONL + db)
3. ผล: Copilot ได้ token + model ทันที; edit เก็บแบบ dry-run จนกว่าจะ certify (time-neutral)
4. ความเสี่ยง: prompt หลุด (ไฟล์มีข้อความเต็ม), reject ถูกนับ, patch log เล่นผิด, schema เปลี่ยนตาม
   version ของ extension
5. หลักฐาน: tests + marker test + live cert 3 OS
- Baseline: time-neutral = ส่งแค่ usage (`emit_edit_heartbeats=false`, [Phase 01 ข้อ 9](phase-01-source-cursors-and-engine.md)); edit เก็บแบบ dry-run จนกว่า Phase 11 อนุมัติ → ผลต่อเวลา 0%

## Exit criteria

- [ ] parser 2 ตัวผ่าน tests และ live cert บน macOS (เจ้าของมี VS Code + Copilot แล้ว)
- [ ] marker test ผ่าน
- [ ] Copilot ใน matrix เปลี่ยนจาก markers เป็น edits
- [ ] ยอดเวลาไม่เปลี่ยน

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| extension เปลี่ยนรูปแบบ chatSessions บ่อย | ทนต่อ field ที่หาย, doctor แจ้ง schema ไม่รู้จัก, บันทึก extension version |
| ไฟล์ chat ใหญ่มาก | เพดานขนาด + อ่านแบบ streaming สำหรับ JSONL |
| Copilot ใน Cursor/Windsurf ใช้ globalStorage ของ editor นั้น | root list ครอบคลุม และระบุ agent ตาม extension ไม่ใช่ตาม editor |
