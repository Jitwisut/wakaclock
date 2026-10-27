# Phase 08 — SQLite app family (OpenCode, Goose, Zed, Qoder, Warp)

สถานะ: **ขั้น 8c ✅ (2026-10-26) — OpenCode + Qoder ทำแล้ว (usage only, edit เป็น dry-run); Goose/Zed/Warp/cursor-agent Unsupported ชั่วคราว** ดู "ผลการทำ" ท้ายไฟล์
Tier: 2 · ขึ้นกับ: Phase 01 (`sqlite_source.rs`), Phase 02 · ทำขนานกับ Phase 06/07 ได้

## เป้าหมาย

เพิ่ม parser ให้ tool ที่เก็บ session ใน SQLite โดยแต่ละตัวมีแค่ **query + mapping**
บน `sqlite_source.rs` ร่วม (read-only, budget, fingerprint, rowid cursor)

## สภาพปัจจุบัน

| Tool | สิ่งที่มี |
|---|---|
| OpenCode | native plugin (`cli/src/opencode_plugin.rs`) เฉพาะ version ที่ตรง ได้ markers; manifest ยังเขียนว่า `TranscriptOnly` (ไม่ตรงความจริง ต้องแก้ใน phase นี้) |
| Goose, Zed, Qoder, Warp | ไม่มี |

## ข้อเท็จจริงเรื่องข้อมูล (ต้องยืนยันกับไฟล์จริง)

| Tool | ไฟล์ (macOS) | ตาราง | edit | token | model | prompt |
|---|---|---|---|---|---|---|
| OpenCode | `~/.local/share/opencode/opencode*.db` (หรือ `AppSup/opencode/`, `$OPENCODE_DATA_DIR`, `$XDG_DATA_HOME/opencode`); legacy `storage/{session,message,part}/**/*.json` | `session` (หรือ `session_v2`), `message`, `part`, `session_message` (v2) — JSON ในคอลัมน์ `data` | tool part `edit`/`write`/`apply_patch` + `metadata.filediff.{additions,deletions}`; v2 `state.structured.files[]` | `tokens{input,output,reasoning,cache.read,cache.write}` | `modelID`, `providerID` | text part |
| Goose | `~/.local/share/goose/sessions/sessions.db` (Windows `AppData/Roaming/Block/goose/data/sessions/sessions.db`) | `sessions` (คอลัมน์ต่างตาม version), `messages`/`thread_messages.content_json` | ✘ | ✔ ต่อ session | ✔ | ✔ |
| Zed | `AppSup/Zed/threads/threads.db` | ต้องสำรวจ | ? | ? | ? | ? |
| Qoder | `AppSup/Qoder/SharedClientCache/cache/db/local.db`; prompt history `~/.qoder/cache/projects/**` | `chat_message(rowid, session_id, request_id, role, tool_result, token_info, gmt_create)` | tool rows `results[].{path, diffInfo{add,delete}}` | `token_info{prompt_tokens, completion_tokens, cached_tokens}` | ? | ✔ |
| Warp | `AppSup/dev.warp.Warp-Stable/warp.sqlite` | ต้องสำรวจ | ? | ? | ? | ? |

Zed และ Warp: WakaTime ใช้การสแกนทุกตาราง (best effort) แปลว่าไม่มี schema ที่ชัด
แผนนี้จะ **สำรวจ schema จริงก่อน** และทำเฉพาะเมื่อพบ field ที่ระบุ edit/token ได้แน่นอน
ถ้าไม่พบ ให้บันทึก `out-of-scope` (เจ้าของตัดสิน) แทนการเดา ตามหลัก accuracy over coverage

## Design

### `core/src/ai/sqlite_family.rs`

```rust
struct SqliteProfile {
    agent_id: &'static str,
    db_roots: &'static [RootSpec],
    db_glob: &'static str,
    schema_probe: fn(&Connection) -> Option<SchemaVariant>,   // ตรวจ version ของ schema
    batch_query: fn(SchemaVariant) -> &'static str,           // SELECT ... WHERE rowid > ? ORDER BY rowid LIMIT ?
    map_row: fn(SchemaVariant, &Row, &mut SessionState) -> Vec<MappedRecord>,
}
```
- `schema_probe` อ่าน `PRAGMA table_info` (read-only) เพื่อเลือก query ตาม version
  ถ้าไม่รู้จัก schema → warning `schema_unknown` ใน doctor และไม่อ่าน
- `MappedRecord` ใช้ชนิดเดียวกับ Phase 07
- ตารางที่ update ทับแถวเดิม (เช่น token ของ Goose ต่อ session) → ใช้ `source_record_hashes` และส่ง
  usage เป็นส่วนต่าง (delta) ด้วย usage event ID เดิม + revision

### OpenCode

- รองรับทั้ง db (v1/v2) และ legacy JSON storage (`JsonSnapshot`)
- dedupe กับ native plugin ผ่าน claim ledger (tool part id เป็น tool-call ID — ต้องยืนยัน)
- แก้ manifest ใน `core/src/ai/adapter.rs` ให้สะท้อนสถานะจริง (plugin + transcript)

### Goose

- ได้แค่ token/model/prompt ต่อ session ไม่มี edit → ตาม Q5
- session ที่ hidden ข้าม

### Qoder

- join tool rows กับ assistant rows ด้วย `request_id`
- prompt count จาก history files (นับเท่านั้น)

## ไฟล์

แก้: `core/src/ai/parser_registry.rs`, `core/src/ai/adapter.rs` (รวมแก้ manifest OpenCode),
`core/src/ai/mod.rs`, `core/src/ai/event.rs` (ถ้า ID ยังไม่ครบ), `core/src/ai/CAPABILITIES.md`

เพิ่ม: `core/src/ai/sqlite_family.rs`, `core/src/ai/sqlite_profiles/{opencode,goose,zed,qoder,warp}.rs`
(zed/warp เฉพาะถ้าสำรวจแล้วพบ schema ที่ใช้ได้), test helper สร้าง db ใน temp dir

## Tests

| Test | ยืนยัน |
|---|---|
| OpenCode v1 db / v2 db / legacy JSON | edit + token + model ถูกทั้ง 3 รูปแบบ |
| OpenCode plugin + db ของ call เดียวกัน | 1 edit |
| Goose: token ของ session เพิ่มในแถวเดิม | ส่งเฉพาะส่วนต่าง |
| Qoder: join request_id | edit ผูกกับ token ถูก |
| schema ไม่รู้จัก | ไม่อ่าน, warning |
| db ถูก lock / WAL กำลังเขียน | ข้ามรอบอย่างสุภาพ |
| checksum db ก่อน/หลัง | ไม่เปลี่ยน |
| marker ลับ | ไม่หลุด |

## Live certification

| Tool | macOS | Windows | Linux |
|---|---|---|---|
| OpenCode | ☐ | ☐ | ☐ |
| Goose (CLI/desktop) | ☐ | ☐ | ☐ |
| Zed agent | ☐ | N/A? | ☐ |
| Qoder | ☐ | ☐ | ☐ |
| Warp | ☐ | ☐ | ☐ |

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: engine SQLite family + profile ของ tool ที่ schema ชัดเจน
3. ผล: OpenCode/Goose/Qoder (+Zed/Warp ถ้าผ่านการสำรวจ) ได้ข้อมูล (เริ่ม time-neutral)
4. ความเสี่ยง: lock db ของแอปที่เปิดอยู่, schema เปลี่ยน, ซ้ำกับ plugin OpenCode
5. หลักฐาน: tests + checksum + live cert
- Baseline: time-neutral = ส่งแค่ usage (`emit_edit_heartbeats=false`, [Phase 01 ข้อ 9](phase-01-source-cursors-and-engine.md)); edit เก็บแบบ dry-run จนกว่า Phase 11 อนุมัติ → ผลต่อเวลา 0%

## Exit criteria

- [ ] OpenCode, Goose, Qoder ผ่าน tests และ live cert บน macOS
- [ ] Zed/Warp มีผลสำรวจ schema และข้อตัดสิน (ทำ / out-of-scope)
- [ ] manifest OpenCode ตรงความจริง
- [ ] matrix อัปเดต

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| แอปเปิดอยู่และเขียน db ตลอด | `mode=ro`, busy_timeout สั้น, ข้ามรอบ |
| query ช้าบน db ใหญ่ | `ORDER BY rowid LIMIT` + progress handler + งบรวม |
| เดาความหมายของตารางผิด (Zed/Warp) | ต้องยืนยันด้วย live run ก่อนเปิดใช้; ไม่ผ่าน = ไม่ทำ |

## ผลการทำ (ขั้น 8c, 2026-10-26)

ทำภายใต้การอนุมัติรวมขั้น 7–9 (บันทึกใน `.context/heartbeat-safety.md`)

- เพิ่ม `core/src/ai/sqlite_apps.rs` (`SqliteAppParser::opencode()` / `::qoder()`) แทน
  `sqlite_family.rs` + `sqlite_profiles/` ที่วางไว้ เพราะมีแค่ 2 ตัวที่ schema ชัดพอ แต่ละตัวคือ
  query + mapping บน `sqlite_source.rs`
- OpenCode: อ่าน `part.data` เฉพาะ tool ที่ `state.status = "completed"` มี `filePath` และนับบรรทัดจาก
  `metadata.filediff.{additions,deletions}`; usage จาก `message.data.tokens` ของ assistant
- Qoder: `chat_message.tool_result.results[].diffInfo.{add,delete}` และ `token_info`
- ทุกรอบอ่านย้อน 500 แถวล่าสุด (แถวถูก update ระหว่าง stream), ID คงที่ต่อแถว, usage รอ 120 วินาที
  และอ่าน usage โดยไม่ข้ามด้วย fingerprint เพื่อไม่ให้แถวที่ยังไม่ settle หายไป
- schema ไม่รู้จัก (ไม่มีตาราง/คอลัมน์) → warning `schema not recognised` และไม่อ่าน
- manifest: OpenCode ได้ `transcript_roots`, เพิ่ม manifest `qoder` (TranscriptOnly) — catalog 20 ตัว,
  registry 18 parser
- ยังไม่ทำ: OpenCode legacy JSON storage และ schema v2 (`session_message`); dedupe กับ plugin
  OpenCode ไม่จำเป็นตอนนี้เพราะ edit เป็น dry-run
- Unsupported ชั่วคราว: Goose (token สะสมต่อ session ในแถวเดิม ต้องมี usage แบบ delta/revision ซึ่ง
  usage ID แบบ first-write-wins ยังทำไม่ได้), Zed และ Warp (ไม่มีตาราง edit/token ที่ยืนยันได้),
  cursor-agent (`agent-transcripts`/`ai-code-tracking.db` ไม่มี record ต่อ edit ที่ยืนยันได้)
- ไม่มี db ของทั้งสองตัวบนเครื่อง → ทดสอบด้วย db สังเคราะห์ใน temp dir (6 tests รวม marker ลับ,
  schema ไม่รู้จัก, seed ที่หัว db); live test รวมไว้ขั้น 10
- ผล: core 477 passed, cli 108+7+8+44, clippy สะอาด, integration 7 ok + 2 Cursor scaffold เดิม,
  `verify_inventory.py certifications/ai-adapters` ผ่าน
