# Phase 4 — Kilo Code Native Plugin

## เป้าหมาย

สร้าง TypeScript plugin สำหรับ Kilo Code ที่ทำงานได้ทั้ง CLI และ VS Code runtime
พร้อมเก็บ client/provider/model แยกกันอย่างถูกต้อง

## Package layout

```text
extensions/ai-agents/kilo-code/
  package.json
  tsconfig.json
  src/plugin.ts
  src/event-normalizer.ts
  src/provider-identity.ts
  src/producer-client.ts
  test/
  README.md
```

Package ต้อง export module descriptor ที่ Kilo รองรับ และ installer ต้องใช้วิธี
global/project install ที่ไม่เขียนทับ user config

## Hook mapping

ใช้ native Kilo hooks/events เท่าที่ real version ยืนยัน:

- `config`
- `tool.execute.before`
- `tool.execute.after`
- `event`
- `session.created`, `session.updated`, `session.idle`, `session.error`
- `session.diff`
- `file.edited`, `file.watcher.updated`
- provider/model metadata จาก session/config context

ยังไม่ยก event ใดเป็น verified จน capture payload จริงและยืนยัน success semantics

## Tool correlation

- before hook สร้าง pending tool state ด้วย session/tool identity
- after hook ปิด pending stateเฉพาะ successful execution
- file event จับคู่กับ pending tool ด้วย session, path และ bounded time
- built-in write/edit tool ใช้ direct metadata ถ้ามี
- shell tool ใช้ shared snapshot API
- pending state หมดอายุต้อง cleanup
- session error/cancel ต้องล้าง pending state

## Provider and model identity

- Kilo เป็น `client_id=kilo-code` เสมอ
- Kimi model ใช้ `provider_id=moonshot`
- DeepSeek model ใช้ `provider_id=deepseek`
- OpenAI/Anthropic/local provider map ตาม canonical normalization
- model switch กลาง session ต้องใช้ model ณ tool call นั้น
- provider router/fallback ต้องบันทึก provider ที่ใช้จริงถ้า Kilo เปิดเผย
- หากไม่รู้ provider ให้ `None` ไม่เดาจากชื่อ display

## Kilo autocomplete

Autocomplete กับ agent tool edit เป็นคนละ evidence path:

- agent tool edit รับจาก native plugin
- inline completion acceptance อาจต้องใช้ VS Code telemetry/correlation เดิม
- ห้ามนับ suggestion ที่แสดงแต่ไม่ถูก accept
- หาก Kilo plugin ไม่มี acceptance event ให้จัดเป็น unsupported ใน v1
- อย่าใช้ text diff เพียงอย่างเดียวเพื่ออ้างว่าเป็น Kilo autocomplete

## Installation

- `wakaclock ai setup kilo-code` ตรวจ Kilo CLI/extension
- install package ใน global config ตาม official mechanism
- pin compatible version range
- preserve JSONC comments และ user plugins
- detect plugin disabled/load failure
- `doctor ai` แสดง CLI/VS Code runtime แยกกันหากทั้งคู่ติดตั้ง
- uninstall เฉพาะ AtoAxis package entry

## Verification status

- manifest เริ่ม `scaffold`
- fixture tests ใช้ payload ที่ redact จาก real capture หลังอนุญาต
- เลื่อนเป็น `Verified` หลัง live Kilo run และ backend row inspection
- บันทึก Kilo version, runtime, provider/model และ plugin version

## Files expected to change

- `extensions/ai-agents/kilo-code/`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- `backend/api/crates/wakaclock-core/src/ai/event.rs`
- `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`
- CLI setup/doctor files

## Tests

- plugin module load
- session lifecycle
- before/after successful tool
- failed/cancelled tool
- file event correlation
- duplicate tool + file events
- shell snapshot
- provider/model normalization matrix
- model switch within session
- Kilo + Kimi identity
- Kilo + DeepSeek identity
- config install/upgrade preserves JSONC
- privacy allowlist

## Manual live matrix

1. Kilo CLI แก้หนึ่งไฟล์
2. Kilo VS Code แก้หนึ่งไฟล์
3. Kilo multi-file task
4. Kilo shell mutation
5. Kilo ใช้ Kimi model
6. Kilo ใช้ DeepSeek model
7. switch model กลาง session
8. offline broker/replay

## Acceptance criteria

- agent edit จาก Kilo ถูกส่งโดยไม่ต้องรอ filesystem observer
- Kilo + Kimi/DeepSeek แสดง client/provider/model ถูกต้อง
- tool/file/native evidence ไม่สร้าง duplicate
- failed tool ไม่สร้าง verified edit
- Kilo plugin load failure ปรากฏใน doctor พร้อมวิธีแก้
- autocomplete ที่ยังไม่มี direct evidence ไม่ถูกโฆษณาว่า verified

