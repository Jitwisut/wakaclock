# Phase 2 — Codex Native Plugin

## เป้าหมาย

ทำให้ Codex ส่ง direct evidence เข้า Local Broker ระหว่างทำงาน และใช้ transcript
เป็น recovery path โดย event จากสอง transport ต้องไม่สร้าง duplicate

## Package layout

เสนอ package:

```text
extensions/ai-agents/plugins/atoaxis-codex/
  .codex-plugin/plugin.json
  hooks/
  scripts/
  README.md
  tests/
```

ต้องยืนยัน native Codex plugin schema จาก plugin รุ่นจริงก่อนกำหนด parser ถาวร
ห้ามคัดลอก payload assumption จาก transcript มาเป็น native schema

## Events to capture

- session start/resume/end
- user prompt activity สำหรับ session timing โดยไม่ส่ง prompt text
- successful `apply_patch`
- file write/edit tools ที่ Codex เพิ่มในอนาคต
- shell tool lifecycle สำหรับ before/after snapshot
- tool failure/cancel สำหรับ cleanup เท่านั้น
- model/provider/session metadata เมื่อ platform เปิดเผย

## Apply patch behavior

- ใช้ tool call ID เป็น producer identity
- parse patch ใน process ของ producer เฉพาะเพื่อหา file metadata และ line counts
- ห้ามส่ง patch body เข้า broker/log
- multi-file patch แตกเป็นหนึ่ง event ต่อไฟล์
- add/update/delete/move ต้องรักษา change kind
- move/rename ต้องกำหนด entity identity ตาม canonical contract
- completed tool output เป็นหลักฐานว่า call สำเร็จ

## Native and transcript reconciliation

- native event ส่งทันทีหลัง successful file tool
- transcript scanner ยังทำงานสำหรับ event ที่ native hook พลาด/offline
- transcript parser ใช้ schema ที่บันทึกใน `CAPABILITIES.md`
- native และ transcript producer IDs อาจต่างกัน แต่ canonical fingerprint ต้องตรงกัน
- native evidence ชนะด้าน confidence แต่ metadata ที่ conflict ต้องไม่ถูก merge แบบเดา

## Shell mutation

- ก่อน shell command เริ่มให้สร้าง workspace snapshot
- หลัง command สำเร็จจึงคำนวณ changed files
- จำกัดจำนวนไฟล์และเวลาสแกน
- ignore build/vendor/generated paths ตาม policy กลาง
- failed/interrupted shell ล้าง snapshot และไม่สร้าง verified edit
- shell command text ห้ามถูกส่งหรือเก็บ

## Installation and migration

- เพิ่ม Codex manifest เป็น native plugin strategy
- install จาก `wakaclock ai setup codex`
- upgrade แบบ idempotent
- migrate managed TOML hook block รุ่นเก่าโดยไม่ลบ config อื่น
- stale hook path ต้องถูก doctor ตรวจพบ
- trust/approval ที่ platform บังคับต้องแสดง manual action
- uninstall ลบเฉพาะ AtoAxis-managed entries

## Verification status

- transcript parser ที่รันกับ real sessions สามารถบันทึกเป็น verified parser evidence ได้
- native plugin ต้องเริ่ม `scaffold` จนมี real Codex run
- fixture หรือ synthetic hook payload ห้ามเลื่อน native adapter เป็น `Verified`
- บันทึก Codex version, plugin version และ live-check timestamp

## Files expected to change

- `extensions/ai-agents/plugins/atoaxis-codex/`
- `extensions/ai-agents/codex/`
- `backend/api/crates/wakaclock-core/src/ai/codex.rs`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`
- `backend/api/crates/wakaclock-cli/src/main.rs`

## Tests

- single-file apply patch
- multi-file add/update/delete/move
- completed output required
- failed/cancelled tool emits no edit
- duplicate native + transcript collapses
- native lost then transcript recovers
- broker offline queues native event
- replay keeps event identity
- shell edit detected from snapshot
- human shell edit without Codex session not verified AI
- payload/log privacy audit
- idempotent install/upgrade/uninstall

## Manual live matrix

1. Start a new Codex session
2. Edit one file with `apply_patch`
3. Edit three files in one patch
4. Modify a file through Codex shell `sed`
5. Trigger a failed tool
6. Stop broker, perform an edit, restart broker
7. Let transcript scanner rescan the same session
8. Compare broker events, sidecar and backend rows

## Acceptance criteria

- direct event พร้อมให้ VS Code correlate ภายใน bounded window
-หนึ่ง logical edit มีหนึ่ง canonical backend activity
- multi-file edit ได้หนึ่ง file event ต่อไฟล์
- `client_id=codex` และ provider/model สะท้อนค่าจริง
- DeepSeek model ภายใน Codex ไม่ทำให้ client เปลี่ยนเป็น DeepSeek
- AI edit ไม่เพิ่ม human lines/keystrokes
- `doctor ai` แสดง native event และ transcript lag ของ Codex แยกกัน
