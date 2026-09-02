# Phase 1 — Universal Producer SDK and Event Contract

## เป้าหมาย

สร้าง shared producer layer ให้ native plugin/hook ทุกตัวส่ง metadata ด้วย contract เดียว
โดยไม่คัดลอก retry, redaction, discovery และ event-ID logic ไปตาม shell scripts

## Target package

เสนอให้วาง shared implementation ที่:

```text
extensions/ai-agents/common/
  producer/
    discover-cli
    broker-client
    event-builder
    event-id
    redact
    snapshot-before
    snapshot-after
    health
```

หากต้องรองรับ shell, Node และ Rust ให้ canonical validation อยู่ใน Rust CLI
ส่วน shell/Node wrapper มีหน้าที่แปลง hook payload เป็น allowlisted metadata เท่านั้น

## Canonical producer event

ต่อยอด event model ให้มีข้อมูลอย่างน้อย:

```text
schema_version
event_id
client_id
provider_id
model_id
session_id
tool_call_id
occurred_at
workspace_root
file_path
change_kind
lines_added
lines_deleted
transport
confidence
producer_version
```

Optional field ต้องใช้ `None` เมื่อไม่รู้ ห้ามแปลง unknown เป็น empty string หรือ zero

## Identity normalization

- normalize `codex`, `claude-code`, `kilo-code`, `kimi-code-cli`
- normalize provider `openai`, `anthropic`, `moonshot`, `deepseek`
- model เก็บ normalized raw identifier ที่ allowlist แล้ว
- client/provider/model ต้องเป็นคนละ field
- unknown client ใช้ stable normalized ID แต่ confidence ห้ามถูกยกเพราะชื่อดูเหมือน AI

## Transport values

อย่างน้อยรองรับ:

```text
native_plugin
agent_hook
transcript
mcp
ide_telemetry
tool_snapshot
filesystem_observer
process_observer
```

ต้อง map เข้ากับ `AiEventSource`/evidence kind เดิมโดยไม่สร้างคำเรียกซ้ำหลายชุด

## Event identity

- producer event ID ต้อง stable ข้าม retry
- multi-file tool call ต้องแตกเป็นหนึ่ง ID ต่อไฟล์
- ID ห้ามมี raw path แบบ plaintext หากส่งออกนอกเครื่อง
- schema/version prefix ต้องชัดเจน
- offline queue และ broker replay ต้องใช้ ID เดิม
- canonical activity fingerprint เป็นชั้นถัดไป ไม่ใช่ producer ID

## Delivery behavior

- ค้นหา managed `wakaclock` binary ก่อน shell `PATH`
- emit เข้า local broker แบบ non-blocking
- broker unavailable ให้ spool ลง local queue
- timeout/failure ต้อง fail-open ต่อ agent
- payload ใหญ่หรือ malformed ถูก reject พร้อม diagnostic ที่ไม่เผยข้อมูล
- retry ใช้ bounded exponential backoff
- dead-letter เก็บเหตุผลและ metadata ที่ redact แล้ว

## Privacy enforcement

สร้าง allowlist serialization และ test ว่าฟิลด์ต่อไปนี้ออกไม่ได้:

```text
prompt
response
content
source
source_text
patch
diff
command
arguments
stdout
stderr
clipboard
tool_output
```

ห้ามใช้ generic flatten ของ hook payload เพราะ schema รุ่นใหม่อาจเพิ่มข้อมูลลับ

## Snapshot API

สำหรับ shell tools ที่ไม่บอกไฟล์โดยตรง:

- `tool-before` สร้าง metadata snapshot ต่อ workspace/tool call
- `tool-after` เปรียบเทียบ snapshot หลัง successful completion
- snapshot เก็บ file identity, size/mtime และ content fingerprint ที่ไม่ reversible
- timeout และ cleanup state ที่ tool ไม่จบ
- failed tool ลบ pending snapshot โดยไม่ emit verified edit

## Capability and version negotiation

- CLI status ต้องประกาศ producer contract version
- plugin ใหม่ตรวจ capability ก่อนส่ง field ใหม่
- legacy CLI fallback ต้องยังส่ง core heartbeat ได้
- unsupported event schema ให้ controlled diagnostic
- adapter manifest ระบุ payload schema versions ที่รองรับ

## Files expected to change

- `backend/api/crates/wakaclock-core/src/ai/event.rs`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- `backend/api/crates/wakaclock-core/src/broker.rs`
- `backend/api/crates/wakaclock-cli/src/main.rs`
- `backend/api/crates/wakaclock-cli/src/tool_snapshot.rs`
- `extensions/ai-agents/common/`

## Tests

- serde round-trip ทุก optional field
- legacy event compatibility
- identity normalization matrix
- unknown schema rejection
- stable event ID across retry
- distinct per-file IDs for multi-file edit
- forbidden-field audit
- broker unavailable spool/replay
- oversized payload rejection
- failed tool snapshot does not emit
- plugin failure does not block agent workflow

## Acceptance criteria

- Claude/Codex wrapper สามารถเรียก SDK เดียวกันได้
- adapter ไม่ต้องรู้ backend HTTP contract
- event ทุกตัวผ่าน allowlist validation ก่อนเข้า broker
- retry/replay ไม่เพิ่ม event ซ้ำ
- เพิ่ม agent ใหม่ได้โดยเพิ่ม manifest + adapter โดยไม่แก้ correlation rules ตามชื่อ agent
