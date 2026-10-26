# Phase 02 — ตัดซ้ำ hook ↔ transcript และเพิ่ม agent ID

สถานะ: **รอ Phase 01 + approval** (ต้องได้คำตอบ Q1 ก่อน)
ขึ้นกับ: Phase 00 (A1–A3, A5), Phase 01 · ปลดล็อก: Phase 03 เป็นต้นไป

## เป้าหมาย

1. edit หนึ่งครั้งที่ทั้ง hook และ transcript เห็น ต้องกลายเป็น **แถวเดียว** (ตาม D1 + D7)
2. เพิ่ม agent ID ของทุก tool ในแผน เพื่อไม่ให้ชื่อถูกลดเป็น "Unattributed AI"

## ปัญหาปัจจุบัน (ยืนยันจากโค้ด)

| ฝั่ง | event ID | tool-call ID |
|---|---|---|
| Claude hook | `claude-code-${EVENT_HASH}` (`extensions/ai-agents/plugins/atoaxis-heartbeat/scripts/heartbeat.sh` ~175) | `.tool_use_id` (~47) → `ai_change_id` (`cli/src/broker.rs` ~508) |
| Claude transcript | `claude-code-v1:{tool_use_id}` (`core/src/ai/claude.rs` ~471) | `tool_event_id = tool_use_id` (~489) |
| Codex hook | `codex-${hash}` (`extensions/ai-agents/codex/heartbeat-hook.sh` ~194) | `.tool_use_id` (~46) |
| Codex transcript | `opaque_file_event_id("codex-v1", call_id, path)` (`core/src/ai/codex.rs` ~616) | `call_id` (~638) |

- แถวที่มาจาก transcript (`build_ai_heartbeat` ใน `cli/src/main.rs`) ตั้งแค่ `ai_event_id` **ไม่ได้ตั้ง**
  `ai_change_id` แม้ event จะมี `tool_event_id` อยู่ ต่างจาก hook path ที่ตั้งไว้ใน `cli/src/broker.rs` ~508
  (ต้องตัดสินใจใน phase นี้ว่าจะเติม `ai_change_id` ให้แถว transcript ด้วยหรือไม่ — เป็น protected change)
- Server dedupe ด้วย `ai_event_id` และใช้ `ai_change_id` **เฉพาะแถวที่ไม่มี** `ai_event_id`
  (`server/services/heartbeat.rs` ~143-156) จึงไม่จับคู่ hook กับ transcript
- `run_ai_sync` กรองเฉพาะ ID ของ transcript เอง
- `dedup::dedup` (`core/src/ai/dedup.rs`), `evidence_supersedes` (`core/src/broker.rs`),
  `record_event_alias`, `mark_fingerprint` มีแต่ไม่มีผู้เรียกนอก test
- `KNOWN_AGENT_IDS` (`core/src/ai/event.rs` ~27-44) มี 16 ID

## ผล Phase 00 ที่เปลี่ยน design (2026-10-26)

- hook **ไม่ได้ส่ง** tool-call ID ดิบ: Claude hook อ่าน `tool_use_id` แต่ส่ง `claude-code-<sha256(session|tool_use_id|file)[:40]>`
  เป็น `tool_call_id`; Codex hook ส่ง `call_id` ดิบ (ถ้ามี) แต่ transcript ใส่ `<session>:` นำหน้า → จับคู่ด้วย ID ได้ 0 คู่
- client ซ้ำจริง: Claude hook 1,971 แถว มีคู่ transcript ภายใน ±5s 1,800 แถว (~98k บรรทัด) — ดู [ผล Phase 00](phase-00-baseline-results.md)
- ดังนั้น `tool_call_id` ใน ledger ต้องได้จากทางใดทางหนึ่ง (เลือกใน approval ของ phase นี้):
  - **(a) คำนวณซ้ำจาก transcript**: transcript มี `sessionId`, `tool_use_id`, `filePath` ครบ → client คำนวณ event ID แบบเดียวกับ hook
    แล้ว claim ด้วยค่านั้น ไม่ต้องแก้ hook แต่ต้องยืนยันว่า input ของ hash ตรงกันทุกกรณี (path แบบเดียวกัน)
    **ระวัง**: plugin ที่ติดตั้งจริง (1.0.2 ใน `~/.claude/plugins/cache/...`) ต่างจากไฟล์ใน repo ต้องยืนยันสูตร hash จาก
    version ที่ติดตั้งจริงทุก version ที่ยังมีผู้ใช้
  - **(b) แก้ hook** ให้ส่ง `tool_use_id` / `call_id` ดิบเป็น `tool_call_id` (protected, ต้องออก plugin version ใหม่) และ normalize
    ID ของ Codex ให้ตรงกับ transcript (ตัด `<session>:` หรือเติมให้เหมือนกัน)
  - ไม่ว่าเลือกทางไหน ต้องมี **fallback ตามเวลา/ไฟล์** (agent + path hash + ±5s) สำหรับ hook version เก่าที่ยังส่งแบบเดิม
- ยังมี source `ide_telemetry` (transport `shell_hook`) จำนวนมากใน sidecar ต้องตรวจว่าซ้ำกับ hook/transcript หรือไม่ก่อนออกแบบ ledger ให้ครบ

## หลักการออกแบบ

- **ไม่เปลี่ยน event ID ของ hook หรือ transcript ที่ส่งไปแล้ว** (เปลี่ยน = แถวเก่ากับใหม่ไม่ dedupe กัน)
- ตัดซ้ำที่ **client** ก่อนส่ง เพราะ client เห็นทั้งสองแหล่งในเครื่องเดียวกัน
- ไม่แก้ logic dedupe ของ server ใน phase นี้ (เป็น protected และกระทบข้อมูลทุกคน)
- กุญแจ: `(agent, tool_call_id, sha256(normalized_path))`
  - รวม path เพราะ tool call เดียวแก้ได้หลายไฟล์ (multi-file `apply_patch`)
  - normalize ด้วย `core::ai::path::normalize_lexical`
  - เก็บ hash ของ path ไม่เก็บ path ตรงๆ

## ไฟล์

แก้:
- `core/src/ai/state.rs` — ตาราง `tool_call_claims`
- `core/src/broker.rs` — บันทึก claim เมื่อ hook event ถูก accept
- `cli/src/broker.rs` — ส่ง `tool_call_id` + path เข้าการบันทึก claim
- `cli/src/main.rs` — `run_ai_sync` ตรวจ claim ก่อน submit, จัดการ pending
- `core/src/ai/event.rs` — `KNOWN_AGENT_IDS`, alias ใน `normalize_agent_id`
- `core/src/ai/adapter.rs` — manifest แบบ scaffold ของ tool ใหม่

เพิ่ม:
- `core/src/ai/claims.rs` — logic ของ claim ledger (แยกจาก `state.rs` เพื่อให้ test ง่าย)

## Design

### ตาราง

```sql
CREATE TABLE IF NOT EXISTS tool_call_claims (
  agent TEXT NOT NULL,
  tool_call_id TEXT NOT NULL,
  path_hash TEXT NOT NULL,
  claimed_by TEXT NOT NULL,        -- 'hook' | 'transcript'
  event_id TEXT NOT NULL,          -- event ID ที่ส่งจริง
  claimed_at INTEGER NOT NULL,
  pending_until INTEGER,           -- สำหรับ transcript ที่รอ hook
  PRIMARY KEY (agent, tool_call_id, path_hash)
);
CREATE TABLE IF NOT EXISTS tool_call_conflicts (
  agent TEXT, tool_call_id TEXT, path_hash TEXT,
  first_source TEXT, late_source TEXT, observed_at INTEGER
);
```
- prune claim เก่ากว่า 30 วัน

### กฎตัดสิน (D7)

| สถานการณ์ | ผล |
|---|---|
| hook มาก่อน แล้ว transcript เห็น call เดียวกัน | transcript **ไม่ส่ง edit** แต่ยังส่ง usage (token/model) ตามปกติ |
| transcript มาก่อน และ agent นี้มี hook ที่ติดตั้งและ healthy | transcript เก็บเป็น pending `TRANSCRIPT_HOOK_GRACE_SECONDS = 300` |
| pending ครบ 300 วินาที ยังไม่มี hook | transcript ส่ง edit ตามปกติ แล้วบันทึก claim |
| hook มาหลังจาก transcript ส่งไปแล้ว | hook ยังส่ง (ไม่ทิ้ง event ของ hook) แต่บันทึกลง `tool_call_conflicts`; ไม่ retract |
| agent ไม่มี hook หรือ hook ไม่ healthy | transcript ส่งทันที |
| tool ไม่มี tool-call ID เลย | ใช้ fingerprint `(agent, session, path_hash, timestamp ปัด 2 วินาที, lines)` ผ่าน `delivered_fingerprints` และตั้ง `line_measurement_status` ตามจริง |

"hook healthy" อ่านจากสถานะ native hook ที่ doctor ใช้อยู่แล้ว (`cli/src/native_hooks.rs`)

ข้อสังเกต: กรณี "hook มาหลัง" ยังทำให้ซ้ำได้ แต่เกิดได้เฉพาะเมื่อ hook ช้ากว่า 5 นาที
ซึ่ง conflict table จะบอกความถี่จริง ถ้าสูงเกินรับได้ให้กลับไปถามเจ้าของเรื่อง retract

### ลำดับ deploy ของ agent ID (server-first)

`KNOWN_AGENT_IDS` อยู่ใน `core` ซึ่ง server ใช้ใน `enforce_attribution_policy` ด้วย ถ้า client ส่ง ID ใหม่ก่อน
server รู้จัก ชื่อจะถูกลดเป็น Unattributed AI

1. เพิ่ม ID ใน `core/src/ai/event.rs` + alias ใน `normalize_agent_id`
2. deploy server (staging ก่อน) → readback ว่าแถวทดสอบที่ใช้ ID ใหม่ไม่ถูกลด
3. จากนั้นจึงปล่อย client ที่มี parser ใหม่

ID ที่จะเพิ่ม (รอ Q1 ตัดสินเรื่องแยก/รวม):

| ID ใหม่ | Tool | หมายเหตุ |
|---|---|---|
| `copilot-cli` | Copilot CLI | หรือรวมกับ `copilot` (Q1) |
| `kimi-cli` | Kimi CLI | ตอนนี้ `normalize_agent_id` รวมเป็น `kimi-code-cli` (Q1) |
| `qwen-code` | Qwen Code | |
| `goose` | Goose | |
| `zed` | Zed agent | |
| `continue` | Continue | |
| `amp` | Amp | |
| `kiro` | Kiro | |
| `factory-droid` | Factory Droid | |
| `grok-cli` | Grok CLI | |
| `cody` | Cody | |
| `warp` | Warp | |
| `qoder` | Qoder | |
| `ibm-bob` | IBM Bob | |
| `pi` | Pi | |

Tier 3 ไม่เพิ่ม ID ใน phase นี้ (ดู Phase 09)

## Tests

| Test | ที่อยู่ | ยืนยัน |
|---|---|---|
| hook + transcript ของ call เดียว → 1 edit | `core/tests/attribution_conformance.rs` | ไม่ซ้ำ |
| multi-file call → N edit | เดียวกัน | ไม่ทิ้งไฟล์ที่ 2+ |
| transcript ก่อน hook ภายใน grace | `core/src/ai/claims.rs` tests | pending แล้วถูกแทนด้วย hook |
| transcript ก่อน hook เกิน grace | เดียวกัน | ส่ง transcript + บันทึก conflict |
| agent ไม่มี hook | เดียวกัน | ส่งทันที |
| usage ยังส่งแม้ edit ถูกตัด | `cli/tests/` | token ไม่หาย |
| replay ทั้ง hook spool + transcript fixture | `scripts/ai-attribution-integration.py` (เพิ่ม scenario) | จำนวนแถวที่ fake backend รับ = จำนวน edit จริง |
| ID ใหม่ไม่ถูกลด | `core/src/heartbeat.rs` tests ของ `enforce_attribution_policy` | ชื่อคงอยู่เมื่อ source verified |

## Live certification

- macOS: Claude Code + Codex ทำ edit 10 ครั้ง (รวม multi-file 2 ครั้ง) โดยติดตั้ง hook
  แล้วรัน `wakaclock ai sync` → readback จาก ClickHouse ต้องได้ 10 change ไม่ซ้ำ
- ทำซ้ำโดยถอด hook ชั่วคราว → transcript ต้องส่งครบ 10
- Windows/Linux: ทำซ้ำเมื่อได้เครื่องตาม Q8

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์" (มีไฟล์ hook/broker ใน protected scope)
2. ทำ: claim ledger, grace 300 วินาที, conflict log, เพิ่ม agent ID แบบ server-first
3. ผล: `ai_lines_added` ของข้อมูลใหม่ไม่ซ้ำ; ชื่อ tool ใหม่แสดงได้เมื่อ verified
4. ความเสี่ยง: ตัดผิดจน edit หาย, pending ค้างถ้า process ตาย (ต้อง resume จาก state), deploy ผิดลำดับ
5. หลักฐาน: tests ข้างบน, live cert, query duplicate ของ Phase 00 ซ้ำ → 0 สำหรับข้อมูลใหม่
- Baseline: ไม่แตะแถวใด; เวลาไม่เปลี่ยนเพราะ timeline รวมช่วงอยู่แล้ว (ยืนยันด้วย query 1%)

## Exit criteria

- [ ] duplicate rate ของข้อมูลหลัง deploy = 0 (query ของ Phase 00)
- [ ] conflict table มีจำนวนที่รายงานได้ใน doctor
- [ ] ID ใหม่ทั้งหมดอยู่บน server ก่อน client ส่ง
- [ ] ยอดเวลาไม่เปลี่ยนเกิน 1%

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| process ตายระหว่าง pending → edit หาย | pending อยู่ใน SQLite และถูกประมวลผลรอบถัดไป |
| hook ส่ง tool-call ID ไม่ครบ (บาง tool/บางเวอร์ชัน) | fallback เป็น fingerprint และนับใน doctor |
| path ต่างกันระหว่าง hook (relative) กับ transcript (absolute) | normalize ทั้งคู่เป็น absolute ก่อน hash; test กรณี symlink |
| ข้อมูลเก่ายังซ้ำ | ไม่แตะ (D9) จนกว่าเจ้าของตอบ Q3 |
