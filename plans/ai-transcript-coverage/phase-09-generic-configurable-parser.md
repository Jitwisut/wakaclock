# Phase 09 — Generic configurable parser (Tier 3)

สถานะ: **รอ Phase 06–08 + approval**
Tier: 3 · ขึ้นกับ: Phase 01, 02 และบทเรียนจาก 06–08

## เป้าหมาย

รองรับ long tail ราว 19 tool โดยไม่เขียน parser แยกทีละตัว ใช้ **descriptor** ที่อธิบายว่าไฟล์อยู่ที่ไหน
เป็นรูปแบบอะไร และ field ไหนคือเวลา/model/token/path/บรรทัด/tool-call ID

## หลักการ

- Descriptor **มากับ binary** (embed ตอน build) และผู้ใช้เขียนเพิ่มในเครื่องได้
  **ห้ามโหลดจากเครือข่าย** (ป้องกันการถูกสั่งให้อ่านไฟล์อื่นในเครื่อง)
- Descriptor ทำได้แค่ "อ่าน field ตาม path" ไม่มี expression/script
- ชื่อ tool จาก descriptor จะ **แสดงชื่อได้ก็ต่อเมื่อ agent ID อยู่ใน `KNOWN_AGENT_IDS`** และผ่าน live cert
  นอกนั้นเป็น "Unattributed AI" ตามกฎเดิม (descriptor ของผู้ใช้จึงไม่สามารถสร้างชื่อ tool ปลอมใน analytics ได้)
- Roots ของ descriptor ต้องอยู่ใต้ home หรือ `AppSup` เท่านั้น (ตรวจหลัง normalize/resolve symlink)

## รูปแบบ descriptor (TOML)

```toml
agent_id = "mistral-vibe"
display_name = "Mistral Vibe"
format = "jsonl"                       # jsonl | json | sqlite
roots = ["~/.vibe/logs/session"]
env_override = "VIBE_HOME"
glob = "**/messages.jsonl"
container = ""                         # json: key ของ array เช่น "messages"
token_mode = "cumulative"              # per_event | cumulative
input_includes_cache = true

[fields]
timestamp = ["/timestamp", "/created_at"]   # JSON pointer ตามลำดับความสำคัญ
session   = ["/session_id"]
model     = ["/model", "/message/model"]
tool_name = ["/tool_name", "/function/name"]
tool_call_id = ["/tool_call_id", "/id"]
file_path = ["/file_path", "/args/path"]
lines_added   = ["/lines_added", "/additions"]
lines_deleted = ["/lines_removed", "/deletions"]
input_tokens  = ["/usage/input_tokens", "/prompt_tokens"]
output_tokens = ["/usage/output_tokens", "/completion_tokens"]
cache_read_tokens = ["/usage/cache_read_input_tokens"]
prompt_text_for_count = ["/prompt"]     # ใช้นับความยาวเท่านั้น ไม่ส่ง

[edit]
write_tool_pattern = "(?i)write|edit|patch|create|delete|replace"

[sqlite]                               # เฉพาะ format = "sqlite"
table = "messages"
order_by = "rowid"
```

## Design

### `core/src/ai/generic/`

- `descriptor.rs` — parse + validate TOML (field ที่ไม่รู้จัก = error, roots นอกขอบเขต = error)
- `engine.rs` — แปลง descriptor เป็น `JsonlProfile` / `SqliteProfile` / snapshot profile ของ Phase 07/08
  (ใช้ engine เดิม ไม่สร้างใหม่)
- `builtin/*.toml` — descriptor ที่มากับ binary
- โหลด descriptor ของผู้ใช้จาก `~/.wakaclock/ai-descriptors/*.toml` (ปิดเป็นค่าเริ่ม ต้องเปิดใน config)

### Token สะสม

- tool ที่เก็บ token เป็นยอดสะสมต่อ session (CodeWhale, Mistral Vibe, Zerostack) ใช้ `token_mode = "cumulative"`
  engine เก็บยอดล่าสุดต่อ session ใน cursor แล้วส่งเฉพาะส่วนต่าง

### บรรทัดที่ไม่มี timestamp

- บางรูปแบบ (เช่น OpenClaw) มีบรรทัดไม่มีเวลา → ใช้เวลาที่ "พบครั้งแรก" และเก็บไว้ใน state
  ต่อ hash ของบรรทัด เพื่อให้ re-parse ได้เวลาเดิม (ตั้ง `line_measurement_status` ตามจริง)

### zstd

- DeepSeek dsh มีไฟล์ `.jsonl.zstd` → ต้องเพิ่ม dependency สำหรับ zstd **เฉพาะเมื่อเจ้าของอนุญาต**
  (การเพิ่ม crate ต้องเช็ก [`.context/storage.md`](../../.context/storage.md) และขนาด binary)
  ถ้าไม่อนุญาต อ่านเฉพาะไฟล์ที่ไม่บีบอัด

## Tool ใน Tier 3 และ descriptor ที่จะทำ

| Tool | format | หมายเหตุ |
|---|---|---|
| OpenClaude | jsonl | schema แบบ Claude → อาจใช้ parser Claude เดิมกับ root ใหม่แทน descriptor |
| DeepSeek dsh | jsonl (+zstd) | ดูหัวข้อ zstd |
| CodeBuddy Code | jsonl | schema คล้าย Claude + subagents |
| Codebuff | json | `chat-messages.json` |
| CodeWhale | json | token สะสม |
| Crush | sqlite | ต้องสำรวจ schema ก่อน (WakaTime สแกนทุกตาราง) |
| Devin (local) | json | container `steps` |
| Forge | sqlite | container `messages` |
| Hermes Agent | sqlite | token แบบ update ทับ |
| LingTai TUI | jsonl | `token_ledger.jsonl` ได้แค่ token |
| Mistral Vibe | jsonl | token สะสม |
| Mux | jsonl | |
| OMP | jsonl | ยังไม่รู้ว่าเป็นผลิตภัณฑ์อะไร → ต้องยืนยันก่อน |
| OpenClaw | jsonl | บางบรรทัดไม่มี timestamp |
| Open Design | jsonl | |
| Quickwork | jsonl + sqlite | |
| ZCode | sqlite | `message`, `part`, `session` |
| Zerostack | json | token สะสม |
| Grok desktop | json blob | ได้แค่เวลา + prompt length → อาจ out-of-scope |

กฎ: tool ที่ยืนยันตัวตนผลิตภัณฑ์ไม่ได้ หรือ schema ไม่ชัด → `out-of-scope` จนกว่าจะมีผู้ใช้จริงขอ

## ไฟล์

แก้: `core/src/ai/parser_registry.rs`, `core/src/ai/mod.rs`, `core/src/ai/adapter.rs`, `cli/src/main.rs`
(config เปิด descriptor ของผู้ใช้), `core/src/ai/event.rs` (เฉพาะ ID ที่ผ่าน live cert)

เพิ่ม: `core/src/ai/generic/{mod,descriptor,engine}.rs`, `core/src/ai/generic/builtin/*.toml`, fixtures

## Tests

| Test | ยืนยัน |
|---|---|
| descriptor ที่ root อยู่นอก home | ถูกปฏิเสธ |
| descriptor ที่มี field แปลก | ถูกปฏิเสธ |
| symlink ออกนอก home | ถูกปฏิเสธ |
| fuzz: JSON ผิดรูป, บรรทัดยาวมาก, ไฟล์ binary | ไม่ panic, ไม่ล้มทั้งรอบ |
| SQLite query เกินงบ | หยุดตามงบ |
| token สะสม | ส่งเฉพาะส่วนต่าง |
| agent ID นอก KNOWN | เป็น Unattributed AI |
| marker ลับ | ไม่หลุด |

## Live certification

ทำเฉพาะ tool ที่ติดตั้งได้และมีผู้ใช้จริง ตารางเต็มอยู่ใน [Phase 11](phase-11-certification-and-rollout.md)
tool ที่ไม่ได้ cert ยังส่งข้อมูลได้แต่เป็น Unattributed AI

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: descriptor engine + builtin descriptors
3. ผล: Tier 3 ส่งข้อมูลได้ (Unattributed จนกว่าจะ cert, เริ่ม time-neutral)
4. ความเสี่ยง: descriptor ถูกใช้อ่านไฟล์นอกขอบเขต, map ผิดทำ edit ปลอม, dependency ใหม่ (zstd)
5. หลักฐาน: tests + fuzz + live cert ที่ทำได้
- Baseline: time-neutral → ผลต่อเวลา 0%

## Exit criteria

- [ ] engine ผ่าน tests + fuzz
- [ ] builtin descriptor ของทุก tool ใน Tier 3 มีสถานะ: ทำแล้ว / out-of-scope พร้อมเหตุผล
- [ ] matrix อัปเดต

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| descriptor ของผู้ใช้อ่านไฟล์ลับ | ปิดค่าเริ่ม, จำกัด roots, ไม่ส่งเนื้อหาอยู่แล้ว |
| long tail เปลี่ยนรูปแบบโดยไม่มีใครรู้ | doctor แสดง "พบไฟล์แต่ map ไม่ได้" เพื่อให้เห็นปัญหา |
| จำนวน tool เพิ่มเรื่อยๆ | เพิ่ม descriptor ได้โดยไม่แตะ engine |
