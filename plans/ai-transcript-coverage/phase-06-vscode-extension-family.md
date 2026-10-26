# Phase 06 — VS Code extension family (Cline, Roo, Kilo, IBM Bob, Cody)

สถานะ: **ขั้น 8a ทำแล้ว (2026-10-26)** ภายใต้การอนุมัติแบบรวมขั้น 7–9

## ผลการทำ (2026-10-26)

| Tool | ผล |
|---|---|
| Cline, Roo Code, Kilo Code | ✅ parser ร่วม `ui_messages.rs` ลงทะเบียนแล้ว (Kilo ยังใช้ runtime `KiloCode` ของ plugin; usage only) |
| IBM Bob | ⏸ มี profile ใน parser แต่ **ยังไม่ลงทะเบียน** — ไม่มี manifest ใน catalog และการเพิ่มจะกระทบ certification catalog verifier |
| Cody | ✘ Unsupported — ไม่มี record การแก้ไฟล์ราย edit (ต้องเดาจาก diff ของ context file ซึ่งขัดหลัก accuracy-first) |

ที่ทำ: `fields.rs` (helper อ่าน JSON แบบยืดหยุ่น), `ui_messages.rs`, `SourceCheckpoint::JsonSnapshot.seen_through_ms`
(ใช้ข้ามประวัติเก่าตอนค้นพบครั้งแรกสำหรับไฟล์ที่ถูกเขียนทับ), registry, `CAPABILITIES.md`
ไม่มีข้อมูลจริงในเครื่อง (ไม่ได้ติดตั้ง extension ตัวใด) — schema จากข้อเท็จจริงสาธารณะ, test ใช้ไฟล์สังเคราะห์

หลักฐาน: core 464 + 12 + 1 ผ่าน (ui_messages 7: edit + บรรทัด SEARCH/REPLACE/unified/content, read ไม่นับ,
rewrite แล้ว ID เดิม, seed ข้ามประวัติ, usage เฉพาะที่นิ่งแล้ว, ค้นหาโฟลเดอร์แบบไม่สนตัวพิมพ์, marker ลับไม่หลุด);
cli 108 + 7 + 8 + 44 ผ่าน; clippy, rustfmt ผ่าน; integration ผ่าน (ยกเว้น Cursor hook scaffold 2 ตัวเดิม)

ยังไม่ได้ทำ: ตรวจว่า edit ที่ผู้ใช้ปฏิเสธถูกบันทึกอย่างไร; model/prompt count; แปลง path relative

## เป้าหมาย

Cline, Roo Code, Kilo Code และ IBM Bob เก็บประวัติ task ในรูปแบบเดียวกัน (`ui_messages.json`)
จึงใช้ parser ร่วมตัวเดียวที่ตั้งค่าตาม extension id ส่วน Cody เก็บใน `state.vscdb` `ItemTable`

## สภาพปัจจุบัน

| Tool | สิ่งที่มี | ได้อะไร |
|---|---|---|
| Cline | hook files (Unix + Windows `.ps1`) ใน `cli/src/native_hooks.rs` | markers |
| Roo Code | VS Code API bridge `extensions/vscode/src/rooBridge.ts` | markers |
| Kilo Code | TS plugin `extensions/ai-agents/kilo-code/src/plugin.ts` | edits (scaffold) |
| IBM Bob | ไม่มี | — |
| Cody | ไม่มี | — |

## ข้อเท็จจริงเรื่องข้อมูล (ต้องยืนยันกับไฟล์จริง)

Root ของ editor ที่ต้องค้น (ใช้ `vscode_storage.rs`):
`AppSup/{Code, Code - Insiders, Cursor, Windsurf, VSCodium}/User/globalStorage/` และ remote server
(`~/.vscode-server/data/User/globalStorage/`, `~/.cursor-server/...`)

| Tool | extension id (โฟลเดอร์) | ไฟล์ |
|---|---|---|
| Cline | `saoudrizwan.claude-dev` | `tasks/<taskId>/ui_messages.json` |
| Roo Code | `RooVeterinaryInc.roo-cline` (+ `roo-code-nightly`) | `tasks/<taskId>/ui_messages.json` |
| Kilo Code | `kilocode.kilo-code` | `tasks/**/ui_messages.json`; Kilo CLI: SQLite ใต้ `AppSup/kilo/` |
| IBM Bob | `ibm.bob-code` ใต้ `AppSup/{IBM Bob, Bob-IDE}/User/globalStorage/` | `tasks/**/ui_messages.json` |
| Cody | — | `state.vscdb` ตาราง `ItemTable` key `sourcegraph.cody-ai` → JSON `cody-local-chatHistory-v2` |

โครงสร้าง `ui_messages.json` = JSON array ของ `{ts, type, ask, say, text}`
- `say: "api_req_started"` → `text` เป็น JSON `{request, tokensIn, tokensOut, cacheWrites, cacheReads}`
  (cwd อยู่ใน `request` text)
- `ask: "tool"` → `text` เป็น JSON ของ tool เช่น `editedExistingFile`, `newFileCreated`, `fileDeleted`,
  `appliedDiff`, `writeToFile`, `readFile` พร้อม path และ diff/content
- prompt = task text ของ message แรก

## Design

### `core/src/ai/ui_messages.rs` (parser ร่วม)

```rust
struct UiMessagesProfile {
    agent_id: &'static str,            // "cline" | "roo-code" | "kilo-code" | "ibm-bob"
    extension_dirs: &'static [&'static str],
    edit_tools: &'static [&'static str],
    read_tools: &'static [&'static str],
}
```
- หนึ่ง struct `UiMessagesParser { profile }` implement `AiActivityParser` ลงทะเบียน 4 ตัวใน registry
- cursor: `JsonSnapshot` ต่อไฟล์ task, `record_key = ts + index`
- edit: นับบรรทัดจาก diff (`SEARCH/REPLACE` block หรือ unified diff) หรือจำนวนบรรทัดของ content
  ของไฟล์ใหม่ ใน memory แล้วทิ้ง
- edit ที่ผู้ใช้ปฏิเสธ: ดู `ask` ที่ตามด้วยการตอบ reject (ต้องยืนยันว่ามีใน log) ถ้าระบุไม่ได้ ให้ตั้ง
  `line_measurement_status="partial"` และบันทึกในใบรับรอง
- token: `api_req_started` ต่อ request → usage record
- model: ไม่อยู่ใน `ui_messages.json` เสมอ → ลองอ่าน `api_conversation_history.json` ในโฟลเดอร์เดียวกัน
  (เฉพาะ field model) ถ้าไม่มี ให้ส่ง model ว่าง
- agent ระบุตาม extension id ไม่ใช่ตาม editor (Cline ใน Cursor ยังเป็น `cline`)

### Kilo Code: dedupe กับ plugin เดิม

- Kilo มี TS plugin ที่ส่ง edit อยู่แล้ว → transcript ต้องผ่าน claim ledger ของ Phase 02
- ต้องพิสูจน์ว่า plugin กับ `ui_messages.json` มี ID ร่วมกัน ถ้าไม่มีใช้ fingerprint fallback

### Roo Code: bridge เดิม

- bridge ส่ง markers อยู่แล้ว ไม่แก้ bridge ใน phase นี้ transcript เติม edit/token
- ตรวจว่า marker ของ bridge ไม่ถูกนับเป็น edit ซ้ำ

### `core/src/ai/cody.rs`

- ใช้ `sqlite_source.rs` อ่าน **เฉพาะ** `ItemTable` key `sourcegraph.cody-ai`
- value เป็น JSON ก้อนเดียว → ใช้ snapshot logic + hash ราย interaction
- edit: คำนวณ line diff จาก old/new content ใน memory (LCS) แล้วทิ้ง
- token: `tokenUsage{promptTokens, completionTokens}`; model: `assistantMessage.model`

## ไฟล์

แก้: `core/src/ai/parser_registry.rs`, `core/src/ai/adapter.rs`, `core/src/ai/mod.rs`,
`core/src/ai/event.rs` (`ibm-bob`, `cody` ถ้ายังไม่เพิ่มใน Phase 02), `core/src/ai/CAPABILITIES.md`

เพิ่ม: `core/src/ai/ui_messages.rs`, `core/src/ai/cody.rs`, fixtures ใต้
`core/src/ai/fixtures/{cline,roo_code,kilo_code,ibm_bob,cody}/`

## Tests

| Test | ยืนยัน |
|---|---|
| ui_messages: editedExistingFile + newFileCreated + fileDeleted | edit/บรรทัดถูก |
| readFile | ไม่นับ |
| api_req_started | token ถูกต่อ request |
| ไฟล์ถูกเขียนทับเมื่อ task ดำเนินต่อ | ส่งเฉพาะ message ใหม่ |
| Cline ติดตั้งใน Cursor | agent = `cline` |
| Kilo plugin + transcript | 1 edit |
| Cody: ItemTable key อื่น | ไม่ถูกอ่าน |
| marker ลับใน task text | ไม่หลุด |

## Live certification

| Tool | macOS | Windows | Linux |
|---|---|---|---|
| Cline (VS Code) | ☐ | ☐ | ☐ |
| Roo Code | ☐ | ☐ | ☐ |
| Kilo Code (extension) | ☐ | ☐ | ☐ |
| Kilo CLI | ☐ | ☐ | ☐ |
| IBM Bob | ☐ | ☐ | ☐ |
| Cody | ☐ | ☐ | ☐ |

ช่องที่ tool ไม่มีบน OS นั้นบันทึก N/A ตาม D8

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: parser ร่วม `ui_messages.json` 4 profile + Cody
3. ผล: Tier 2 ห้าตัวได้ token ทันที; edit เก็บแบบ dry-run จนกว่าจะ certify (time-neutral)
4. ความเสี่ยง: นับ edit ที่ถูก reject, ซ้ำกับ Kilo plugin/Roo bridge, prompt หลุด
5. หลักฐาน: tests + live cert
- Baseline: time-neutral = ส่งแค่ usage (`emit_edit_heartbeats=false`, [Phase 01 ข้อ 9](phase-01-source-cursors-and-engine.md)); edit เก็บแบบ dry-run จนกว่า Phase 11 อนุมัติ → ผลต่อเวลา 0%

## Exit criteria

- [ ] ทุก profile ผ่าน tests และ live cert บน macOS
- [ ] Kilo/Roo ไม่ซ้ำกับ producer เดิม
- [ ] matrix อัปเดต

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| extension fork ใหม่ใช้รูปแบบเดียวกัน (เพิ่มเรื่อยๆ) | เพิ่มเป็น profile ใหม่ หรือย้ายไป descriptor ของ Phase 09 |
| task folder จำนวนมาก | fingerprint ต่อไฟล์ ข้ามไฟล์ที่ไม่เปลี่ยน |
| `ui_messages.json` ใหญ่ | เพดานขนาด + บันทึก `budget_hit` |
