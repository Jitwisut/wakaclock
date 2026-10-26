# Phase 01 — Source cursors และ parse engine

สถานะ: **ทำแล้วใน worktree (2026-10-26) ยังไม่ commit** — ขั้น 4 ใน README
ขึ้นกับ: Phase 02 (เสร็จแล้ว) · ปลดล็อก: Phase 03–09

## ผลการทำ (2026-10-26)

ต่างจาก design ด้านล่างโดยตั้งใจ (ไฟล์ชุดเดิมตามคำขออนุมัติ):
- checkpoint ของ SQLite/snapshot เก็บใน `ParserContext.source` (มีที่สร้างตรงๆ 3 จุด) แทนการเพิ่ม field ใน `ParserCursor`
  (มีที่สร้างตรงๆ 43 จุด); JSON ของ cursor เดิมอ่านได้เหมือนเดิม
- gate เป็น method `AdapterRuntime::emits_edit_heartbeats()` ไม่เพิ่ม field ใน catalog (ไม่เปลี่ยน schema `catalog-v1.json`)
- งบเวลา SQLite ใช้ `InterruptHandle` + watchdog thread แทน `progress_handler` (`rusqlite` ไม่ได้เปิด feature `hooks`; ไม่แตะ `Cargo.toml`)
- `is_reusable` / `seed_at_head` เป็น method ของ trait (`cursor_is_reusable`, `seed_at_head`) ค่า default = พฤติกรรม JSONL เดิม
- คำสั่งรายงาน dry-run ยกไป Phase 10 (รอบนี้เก็บข้อมูลอย่างเดียว)

ไฟล์ใหม่: `core/src/ai/{source,sqlite_source,snapshot_source,parser_registry}.rs`
ไฟล์ที่แก้: `core/src/ai/{parser,state,adapter,claude,codex,gemini,mod}.rs`, `cli/src/main.rs`
(`supported_ai_parsers` → registry, `run_ai_sync` ใช้ trait method + `catch_parser_panic` + gate `keep_edits_as_dry_run`, prune ตารางใหม่)

หลักฐาน: `cargo test -p wakaclock-core` 432 + 12 + 1 ผ่าน; `-p wakaclock-cli` 108 + 7 + 8 + 44 ผ่าน;
clippy `-D warnings` ผ่าน; rustfmt ไฟล์/ส่วนของงานนี้ผ่าน; integration ผ่านทุก scenario ยกเว้น Cursor scaffold 2 ตัว
(ล้มตั้งแต่ก่อนแก้). test ใหม่ครอบคลุม: cursor รุ่นเก่า, record hash, dry-run idempotent/ไม่เก็บ path, registry/gate,
panic → error, SQLite (batch, row limit, unchanged, missing, WAL ที่ writer เปิดค้าง, lock ข้ามภายใน 2s,
interrupt เมื่อเกินงบ, checksum ไม่เปลี่ยน, เขียนไม่ได้), snapshot (unchanged/too large, rewrite ส่งเฉพาะ record ใหม่/เปลี่ยน)

ยังไม่ได้ทำ: dry-run เทียบก่อน/หลังกับ transcript จริงในเครื่อง (ย้ายไปขั้นทดสอบรวม); ยังไม่มี parser ตัวไหนใช้
`sqlite_source`/`snapshot_source` จริง (เริ่มใช้ใน Phase 04–08)

## เป้าหมาย

ทำโครงสร้างพื้นฐานให้ parser ใหม่ทุกตัวใช้ร่วมกัน โดย **parser เดิม 3 ตัวต้องให้ผลเหมือนเดิมทุก byte**:
1. cursor ที่รองรับ source 3 ชนิด: JSONL ต่อท้าย, SQLite, JSON ที่ถูกเขียนทับ
2. ตัวอ่าน SQLite แบบ read-only ที่มีงบเวลา/งบการอ่าน และข้าม database ที่ไม่เปลี่ยน
3. registry แทนรายการ hard-code ใน `cli/src/main.rs`
4. usage (token/prompt count) แบบ incremental แทนการอ่านไฟล์ใหม่ทั้งไฟล์
5. แยก panic ของแต่ละ parser

## สภาพปัจจุบัน (ยืนยันจากโค้ด)

| เรื่อง | ที่อยู่ | ข้อจำกัด |
|---|---|---|
| `ParserCursor { source_path, file_identity, byte_offset, last_record_id, last_record_time, context }` | `core/src/ai/parser.rs` (~62) | มีแค่ byte offset |
| `AiActivityParser { id, discover, discover_sources, parse_since }` | `core/src/ai/parser.rs` (~224) | ไม่มี usage |
| `TranscriptLag::measure(file_size, cursor)` | `core/src/ai/parser.rs` | วัดเป็น byte เท่านั้น |
| ตาราง `parser_state`, `delivered_events`, `delivered_usage`, `pending_usage`, `event_aliases`, `delivered_fingerprints` | `core/src/ai/state.rs` (~65-186) | ใช้ได้ต่อ |
| `supported_ai_parsers()` | `cli/src/main.rs` | รายการ hard-code |
| `run_ai_sync()` | `cli/src/main.rs` | ตรวจ cursor ด้วย `byte_offset <= file_len`, ข้ามไฟล์เก่ากว่า 24 ชม. โดยวาง cursor ที่ EOF |
| `usage_scan_needed(cursor_reused, cursor_offset, file_len)` | `cli/src/main.rs` | usage อ่านไฟล์ใหม่ทั้งไฟล์เมื่อไฟล์เปลี่ยน |
| `parse_claude_usage` / `parse_codex_usage` / `parse_gemini_usage` | `core/src/ai/usage.rs` | ผูกกับ JSONL |
| `AiSyncLock` | `cli/src/main.rs` (~79) | cross-process lock มีแล้ว ใช้ต่อ |
| `AiSyncOptions.deadline` | `cli/src/main.rs` | deadline ต่อรอบ มีแล้ว |
| `rusqlite` | `core/Cargo.toml`, `cli/Cargo.toml` | dependency มีแล้ว |

## ไฟล์

แก้:
- `core/src/ai/parser.rs` — เพิ่ม `SourceKind`, `SourceCheckpoint`, ขยาย `ParseContext`, `parse_usage` ใน trait
- `core/src/ai/state.rs` — ตาราง `source_record_hashes`
- `core/src/ai/usage.rs` — ห่อ parser เดิมเข้า trait method
- `core/src/ai/mod.rs` — ประกาศ module ใหม่
- `core/src/ai/adapter.rs` — ผูก `AdapterRuntime` กับ parser ผ่าน registry
- `cli/src/main.rs` — `supported_ai_parsers`, `run_ai_sync`, `transcript_identity`, ส่วน usage

เพิ่ม:
- `core/src/ai/source.rs` — ชนิด cursor และ logic `is_reusable` / `seed_at_head`
- `core/src/ai/sqlite_source.rs` — ตัวอ่าน SQLite ร่วม
- `core/src/ai/snapshot_source.rs` — ตัวอ่าน JSON ที่ถูกเขียนทับ
- `core/src/ai/parser_registry.rs` — รายการ parser ทั้งหมด

## Design

### 1. Cursor แยกชนิด

```rust
#[derive(Serialize, Deserialize, Default)]
pub enum SourceKind { #[default] Jsonl, Sqlite, JsonSnapshot }

pub enum SourceCheckpoint {
    Jsonl,                                        // ใช้ byte_offset เดิม
    Sqlite { last_rowid: i64, last_updated_at: Option<i64>, fingerprint: DbFingerprint },
    Snapshot { fingerprint: FileFingerprint },
}
```
- เพิ่มใน `ParserCursor` เป็น `#[serde(default)] kind` และ `#[serde(default)] checkpoint: Option<SourceCheckpoint>`
- แถว `parser_state` เดิมจะ deserialize เป็น `Jsonl` + `None` → พฤติกรรมเดิมทุกอย่าง
- `DbFingerprint` = (size, mtime) ของไฟล์ db และไฟล์ `-wal` ถ้ามี
- `FileFingerprint` = (size, mtime, sha256 ของ 4KB แรก)

### 2. แทน logic ที่ผูกกับ byte offset

ใน `run_ai_sync` ให้เรียก method ของ checkpoint แทนการเทียบตัวเลขตรงๆ:

| ชนิด | `is_reusable()` | `seed_at_head()` (ไฟล์เก่ากว่า 24 ชม. ตอนพบครั้งแรก) | lag |
|---|---|---|---|
| Jsonl | `byte_offset <= file_len` (เดิม) | `file_len` (เดิม) | byte |
| Sqlite | database ยังเปิดได้และ `last_rowid <= MAX(rowid)` | `MAX(rowid)` | แถว |
| Snapshot | ไฟล์ยังอยู่ | ถือว่า record ที่มีตอนนี้ "เห็นแล้ว" ทั้งหมด (เขียน hash ลงตาราง) | record |

เพิ่ม `lag_rows: Option<u64>` ใน `TranscriptLag` แบบ additive

### 3. SQLite reader (`sqlite_source.rs`)

- เปิดด้วย URI `file:<path>?mode=ro` + `OpenFlags::SQLITE_OPEN_READ_ONLY | SQLITE_OPEN_URI | SQLITE_OPEN_NO_MUTEX`
- **ห้าม** ใช้ `immutable=1` เพราะ tool อาจกำลังเขียน WAL อยู่
- `busy_timeout(250ms)` ถ้า database ถูก lock ให้บันทึก warning `sqlite_locked` แล้วข้ามรอบนี้ ห้าม retry วน
- `progress_handler` ตัดการ query เมื่อเกินงบเวลา (ค่าเริ่ม 5 วินาทีรวมทุก SQLite parser ต่อรอบ)
- จำกัดจำนวนแถวต่อรอบ (ค่าเริ่ม 5,000) และอ่านเป็น batch ละ 256 แถวตาม rowid/primary key
- ถ้า `DbFingerprint` ไม่เปลี่ยน ให้ข้ามโดยไม่เปิด database
- แถวที่ถูกแก้ทับที่เดิม (เช่น token count เพิ่ม) ตรวจด้วย hash ใน `source_record_hashes`
- ห้าม copy database ไปที่อื่น ห้ามเขียน ห้าม `VACUUM`/`PRAGMA` ที่เปลี่ยนสถานะ

### 4. Snapshot reader (`snapshot_source.rs`)

- ใช้กับไฟล์อย่าง `ui_messages.json`, `chatSessions/*.json`, Gemini session JSON
- อ่านทั้งไฟล์ (มีเพดานขนาด) แล้วแตกเป็น record ที่มี `record_key` คงที่
  (เช่น `ts` + index หรือ `requestId`)
- เทียบ hash ของ record กับตาราง `source_record_hashes` ส่งเฉพาะ record ใหม่หรือที่เปลี่ยน
- record ที่เปลี่ยนต้องได้ event ID เดิม (revision) ไม่ใช่ ID ใหม่

### 5. ตารางใหม่ใน `state.rs`

```sql
CREATE TABLE IF NOT EXISTS source_record_hashes (
  parser_id TEXT NOT NULL,
  source_key TEXT NOT NULL,     -- hash ของ path (ไม่เก็บ path ตรงๆ)
  record_key TEXT NOT NULL,
  record_hash TEXT NOT NULL,
  seen_at INTEGER NOT NULL,
  PRIMARY KEY (parser_id, source_key, record_key)
);
```
- prune แถวที่ `seen_at` เก่ากว่า 90 วัน
- ใช้รูปแบบเดียวกับตารางเดิม (สร้างใน migration ของ `state.rs` ด้วย `CREATE TABLE IF NOT EXISTS`)

### 6. Budget ใน `ParseContext`

- เพิ่ม `time_budget: Duration` และ `max_read_bytes: u64` พร้อมค่า default
- JSONL ที่ใหญ่กว่า 10MB ตอนพบครั้งแรก: เริ่มจากท้ายไฟล์แล้วสร้าง prefix context แบบ bounded
  ตามกลไกที่ `ParserCursor.context` รองรับอยู่แล้ว

### 7. Registry (`parser_registry.rs`)

- `fn all_parsers() -> Vec<Box<dyn AiActivityParser>>` และ `fn parser_for(id) -> Option<...>`
- `supported_ai_parsers()` และ `match id` ของ usage ใน `cli/src/main.rs` เรียก registry แทน
- id ต้องตรงกับผลของ `normalize_agent_id` (ข้อกำหนดเดิมของ trait)

### 8. Usage แบบ incremental

```rust
fn parse_usage(&self, ctx: &ParseContext, cursor: Option<&ParserCursor>)
    -> Result<UsageBatch, AiParseError> { Ok(UsageBatch::empty()) }   // default
```
- Claude/Codex/Gemini: ห่อ `parse_*_usage` เดิมไว้ข้างใน พฤติกรรมเดิมทุกอย่าง (ยังอ่านทั้งไฟล์ได้)
- parser ใหม่: ใช้ cursor key แยก `usage:{parser_id}:{source_key}` อ่านเฉพาะส่วนใหม่
- ส่งผ่าน `POST /api/v1/ai/usage` (`AiUsageRecord`) ตามเดิม idempotent ด้วย `usage_event_id`
- ไม่เปลี่ยน wire format

### 9. Gate "ส่ง edit heartbeat" ต่อ adapter (ตาม Q9 / ผล Phase 00 A6)

- heartbeat ทุกแถวเป็น anchor ที่นับเวลาได้แม้ `active_seconds=0` จึงต้องมี gate ต่อ adapter:
  `emit_edit_heartbeats: bool` ใน manifest (`core/src/ai/adapter.rs`) — **ค่าเริ่ม `false`** สำหรับ parser ใหม่ทุกตัว
- `false` → `run_ai_sync` ส่งแค่ usage (`/api/v1/ai/usage`) และเก็บ edit ที่ "จะส่ง" ไว้ในเครื่องเพื่อใช้ทำหลักฐาน Phase 11
- `true` เฉพาะ Claude Code / Codex / Gemini CLI (ส่ง edit อยู่แล้วก่อนแผนนี้ ไม่เปลี่ยนพฤติกรรม)
- การเปลี่ยนเป็น `true` ของ adapter ใหม่ = คำขออนุมัติแยกใน Phase 11

### 10. ที่เก็บ edit แบบ dry-run

- ตารางใหม่ใน `state.rs`: `dry_run_edits(parser_id, event_id, occurred_at, path_hash, lines_added, lines_deleted, model)`
  ไม่เก็บ path ตรงๆ และไม่เก็บเนื้อหา prune 30 วัน
- `wakaclock ai dry-run-report --agent <id> --days 7` สรุปจำนวน edit/บรรทัด และ timestamp สำหรับจำลองยอดเวลาแบบ offline

### 11. Panic isolation

- ห่อทุกการเรียก `parse_since` และ `parse_usage` ด้วย `std::panic::catch_unwind(AssertUnwindSafe(..))`
- panic = บันทึก warning `parser_panic` ใน diagnostics, ไม่ขยับ cursor, ไปต่อ parser ถัดไป
- ยืนยันว่า release profile ไม่ได้ตั้ง `panic = "abort"`

## Tests

| Test | ที่อยู่ | ยืนยันอะไร |
|---|---|---|
| golden ของ parser เดิม | `core/src/ai/{claude,codex,gemini}.rs` tests + fixtures เดิม | output เหมือนก่อนแก้ทุก byte |
| `parser_state` รุ่นเก่า | `core/src/ai/state.rs` tests | JSON เก่า deserialize เป็น `Jsonl` |
| SQLite rowid cursor | `core/src/ai/sqlite_source.rs` tests (db สร้างใน temp dir) | ไม่ข้าม/ไม่ซ้ำข้ามรอบ |
| fingerprint skip | เดียวกัน | db ไม่เปลี่ยน → ไม่เปิด |
| WAL ที่กำลังเขียน | เดียวกัน (เปิด writer ค้างไว้) | อ่านได้หรือข้ามอย่างสุภาพ |
| progress abort | เดียวกัน (query หนัก) | หยุดตามงบ ไม่ค้าง |
| snapshot rewrite | `snapshot_source.rs` tests | เขียนทับไฟล์เดิม → ไม่ส่งซ้ำ |
| record แก้ทับ | เดียวกัน | ได้ event ID เดิม |
| panic isolation | `cli/tests/` | parser หนึ่ง panic อีกตัวยังส่งได้ |
| integration | `scripts/ai-attribution-integration.py` | ผ่านเหมือนเดิม |

คำสั่ง (รันใน workspace ที่ถูกต้องตาม [`.context/commands.md`](../../.context/commands.md)):
```bash
cd backend/api && cargo test -p wakaclock-core ai::
cd backend/api && cargo test -p wakaclock-cli
cd backend/api && cargo clippy -- -D warnings
```

## Live certification

Phase นี้ไม่มี parser ใหม่ แต่ต้องรัน Claude/Codex จริงบน macOS 1 รอบหลังแก้ แล้วยืนยันว่า
`wakaclock ai sync` ให้ event/usage จำนวนเท่ากับก่อนแก้บน transcript ชุดเดียวกัน (dry-run เทียบกัน)

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: เพิ่ม cursor 3 ชนิด, SQLite/snapshot reader, registry, usage method, panic isolation
3. ผล: parser เดิมไม่เปลี่ยนพฤติกรรม, parser ใหม่มีโครงให้ใช้
4. ความเสี่ยง: cursor regression → event หาย/ซ้ำ; schema `parser_state` รุ่นเก่า; SQLite lock
5. หลักฐาน: golden diff ว่าง, tests ข้างบนผ่าน, dry-run เทียบก่อน/หลัง
- Baseline: ไม่แตะแถวใด ผลต่อเวลา 0%

## Exit criteria

- [ ] tests ทั้งหมดผ่าน และ golden diff ของ 3 parser เดิมว่าง
- [ ] dry-run ก่อน/หลังให้ผลเท่ากันบน transcript จริงชุดเดียวกัน
- [ ] `wakaclock doctor ai` ยังทำงานและแสดง lag เดิมได้
- [ ] ยอดเวลาไม่เปลี่ยน (query 1% ซ้ำ)

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| refactor `run_ai_sync` ทำ cursor เดิมเพี้ยน | แยก commit "ย้ายไป checkpoint method" ออกจาก "เพิ่มชนิดใหม่" และมี golden test |
| SQLite ของ tool อื่นเสียหาย | read-only URI, ไม่มี statement ที่เขียน, test ว่า checksum ของ db ไม่เปลี่ยนหลังอ่าน |
| งบเวลาทำให้ sync ช้าลง | งบรวมต่อรอบ + fingerprint skip; วัดเวลาก่อน/หลังใน doctor |
| ตาราง hash โตไม่หยุด | prune 90 วัน และนับขนาดใน doctor |
