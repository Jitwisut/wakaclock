# Phase 00 — ผลลัพธ์

สถานะ: **ทำส่วนในเครื่องเสร็จแล้ว (2026-10-26) — รอข้อมูลจาก server/WakaTime สำหรับ A4, A5 (server), A7, 0.7**
วิธีทำ: [phase-00-baseline-and-contract.md](phase-00-baseline-and-contract.md)

> กรอกเฉพาะจำนวน ชนิดค่า และสถานะ ห้ามใส่ prompt, โค้ด, path ส่วนตัว หรือ credential
> ทุกตัวเลขในไฟล์นี้มาจากสคริปต์ที่อ่านแค่ key/ชนิดค่า/จำนวน และไม่พิมพ์เนื้อหาออกมา

## ข้อมูลการรัน

| รายการ | ค่า |
|---|---|
| วันที่รัน | 2026-10-26 |
| ผู้รัน | Claude (session ของเจ้าของ) |
| ฐานโค้ด | `claude/ai-transcript-coverage` @ `2d442ee5` (จาก `origin/main` @ `9c5905bb`) |
| worktree | `.worktrees/ai-transcript-coverage` (ไม่ได้ build) |
| OS | macOS (เครื่องเจ้าของ) |
| Claude plugin ที่ติดตั้ง | `atoaxis-heartbeat` 1.0.2 (`~/.claude/plugins/cache/atoaxis-plugins/...`) |
| แหล่งข้อมูลฝั่ง client | `~/.claude/projects/*/*.jsonl` (60 ไฟล์ล่าสุด และทั้งหมด), `~/.wakaclock/ai-events.jsonl` (broker sidecar, ~50k บรรทัด), `~/.wakaclock/ai-attribution.sqlite3` |
| ช่วงข้อมูล sidecar | Claude 2026-08-08 → 2026-10-25, Codex 2026-06-08 → 2026-10-25 |

## A1–A3 tool-call ID สองฝั่ง

| Tool | tool-call ID ใน transcript | tool-call ID ที่ hook ส่ง (`tool_event_id`) | ตรงกัน? | ผล |
|---|---|---|---|---|
| Claude Code | `tool_use_id` (`toolu_…`) — edit 674/674 มี และจับคู่กับ `tool_use` ได้ครบ | `claude-code-<sha256(session\|tool_use_id\|file)[:40]>` — hook **อ่าน** `tool_use_id` แต่ส่ง hash เป็น `tool_call_id` (`heartbeat.sh` ~175, ~193) | ✘ | A1 **ไม่เป็นจริง** |
| Codex | `<session-uuid>:call_…` (transcript ใส่ session นำหน้า) | `CALL_ID` ดิบถ้ามี ไม่งั้น `codex-<hash>` (`codex/heartbeat-hook.sh` ~200); เห็นจริง 15 ครั้ง ส่วนใหญ่เป็น hash | ✘ (รูปแบบต่างกัน) | A2 **ไม่เป็นจริง** |
| Codex: `exec` ครอบ `apply_patch`? | — | — | ยังไม่ได้ตรวจ | ทำใน Phase 03 |
| Gemini CLI | ไม่มี session (`~/.gemini/tmp/*/chats` ไม่มี) | — | — | ทดสอบไม่ได้ |
| Copilot (VS Code) | `requestId` ต่อ request ใน `chatSessions/*.jsonl` | hook ของ VS Code agent ไม่มีข้อมูลในเครื่อง | — | ทดสอบไม่ได้ (ดูหมายเหตุ) |
| Kimi Code | ไม่มี `wire.jsonl` | — | — | ทดสอบไม่ได้ |

หมายเหตุสิ่งที่พบ:
- Claude: ข้อมูลที่ต้องใช้จับคู่ **มีครบใน transcript** (`sessionId`, `tool_use_id`, `filePath`) จึงมีทางเลือกให้ client
  คำนวณ event ID ของ hook ซ้ำจาก transcript ได้โดยไม่ต้องแก้ hook (ต้องยืนยันว่า `FILE_PATH` ที่ hook ใช้ตรงกับ
  `toolUseResult.filePath` ทุกกรณี) หรือแก้ hook ให้ส่ง `tool_use_id` ดิบเป็น `tool_call_id` (protected change)
- ใน sidecar ยังมี source `ide_telemetry` (transport `shell_hook`) จำนวนมาก: Claude 6,268, Codex 15,380 แถว
  ซึ่ง tool ID เป็นรูปแบบ `<agent>-tool-<hash>` ไม่ได้อยู่ในการวัดรอบนี้ ต้องตรวจใน Phase 02 ว่าซ้ำกับ hook/transcript หรือไม่
- Copilot ใน VS Code มีข้อมูลจริง: `chatSessions/*.jsonl` 57 ไฟล์ (patch log: `kind=0` snapshot, `kind=1` patch),
  `chatEditingSessions/*/state.json` 57 ไฟล์ (keys: `initialFileContents`, `recentSnapshot`, `timeline`, `version`)
  - request มี `requestId`, `modelId`, `timestamp`, `completionTokens`, `result.metadata.{promptTokens, outputTokens, resolvedModel, toolCallRounds}`
  - **ระวัง privacy**: `result.metadata.renderedUserMessage` และ `initialFileContents` มีเนื้อหาเต็ม
  - `session-store.db` อยู่ที่ `AppSup/Code/User/globalStorage/github.copilot-chat/` (ไม่ใช่ `~/.copilot/`) มีตาราง
    `sessions`, `turns` (มีคอลัมน์ข้อความ `user_message`, `assistant_response`), `session_files`, `checkpoints` — ตอนนี้ว่างทุกตาราง
  - → ต้องแก้ [coverage-matrix.md](coverage-matrix.md) และ [Phase 05](phase-05-github-copilot.md) ให้ตรง

## A4 server เก็บ usage ครบ

รอสิทธิ์ query ClickHouse (ดู "สิ่งที่ต้องให้เจ้าของทำ")

| ai_agent | rows (7 วัน) | with_tokens | with_prompt_chars | prompt_count ไม่ว่าง | ผล |
|---|---|---|---|---|---|
| claude-code | | | | | |
| codex | | | | | |
| gemini-cli | | | | | |

## A5 duplicate ที่มีอยู่แล้ว

### ฝั่ง client (broker sidecar) — วัดแล้ว

จับคู่แถว `agent_hook` กับ `transcript` ด้วย agent + ไฟล์เดียวกัน + เวลาห่างไม่เกิน W วินาที (นับคู่แบบ 1:1)
จับคู่ด้วย tool ID ได้ **0 คู่** เพราะ ID สองฝั่งคนละรูปแบบ (ดู A1–A2)

| window | Claude: คู่ที่ซ้ำ | Claude: `lines_added` ที่ซ้ำ | Codex: คู่ที่ซ้ำ |
|---|---|---|---|
| ±5s | 1,800 | 98,046 | 0 |
| ±10s | 1,824 | 100,733 | 0 |
| ±30s | 1,835 | 102,474 | 0 |
| ±120s | 1,835 | 102,474 | 1 |

- Claude: แถว hook 1,971 → **91% มีแถว transcript คู่กัน** ภายใน 5 วินาที (ช่วง 2026-09 ถึง 2026-10)
- Codex: hook ทำงานแค่ 15 ครั้ง จึงแทบไม่ซ้ำ (transcript 19,748 แถวเป็นแหล่งหลัก)
- ทั้งสองแถวผ่าน broker คนละ `event_id` จึงคาดว่า server เก็บทั้งคู่ (server dedupe ด้วย `ai_event_id`) —
  **ต้องยืนยันด้วย ClickHouse**

### ฝั่ง server — รอสิทธิ์ query

| ช่วง (window) | คู่ที่ซ้ำ | `ai_lines_added` ส่วนเกิน | วินาทีที่ซ้ำ | ต่อวันเฉลี่ย |
|---|---|---|---|---|
| 30 วัน (±5s) | | | | |
| 30 วัน (±10s) | | | | |
| 30 วัน (±30s) | | | | |

แถว transcript ที่ `ai_change_id IS NULL`: ___ / ___

ข้อเสนอเรื่อง backfill (Q3): รอตัวเลขฝั่ง server

## A6 ทดสอบ anchor ของ time-neutral — **ไม่ผ่าน (จากการอ่านโค้ด + test ที่มีอยู่)**

หลักฐาน (`server/services/activity_timeline.rs`):
- heartbeat ทุกแถวที่อยู่ในช่วงเวลาถูกใส่เป็น anchor ความยาวศูนย์ (`{heartbeat_id}:anchor`, ~340-360)
  **ไม่ขึ้นกับ `active_seconds`**
- `bridge_idle_gaps_with_anchors` / `bridge_by_attendance` ใช้ anchor ต่อช่องว่างได้: anchor หลายตัวที่ห่างกัน
  ไม่เกิน idle timeout รวมเป็นช่วงเวลาเดียว (คอมเมนต์ "three heartbeats ten minutes apart are one 20-minute session")
- stream ของ AI bridge ด้วย `AGENT_IDLE_TIMEOUT_MINUTES` (default = 15 นาที เท่า human)
- `wakatime_compatible_seconds = total_seconds(&timeline.bridged)` (`server/services/duration.rs` ~62)
- test ที่มีอยู่ยืนยัน: `anchor_only_streams_match_wakatime_exactly`,
  `mixed_source_anchors_match_wakatime_when_timeouts_are_equal` (anchor source `ai` นับเวลาเหมือน WakaTime)

| กรณี | ผลที่คาดจากโค้ด |
|---|---|
| ช่องว่าง 20 นาที + AI `active_seconds=0` ตรงกลาง | human stream ไม่ถูก bridge โดย AI anchor (แยก stream) แต่ AI anchor ที่ห่างจาก editor ≤ 15 นาทีเชื่อมกันได้ตามกฎ handover → **ยอดเพิ่ม** |
| AI `active_seconds=0` หลายแถวห่างกัน ≤ 15 นาที | **กลายเป็นเวลา AI** |
| AI `active_seconds=0` แถวเดียวโดดๆ | 0 วินาที |

ข้อสรุป: **"time-neutral ด้วย `active_seconds=0`" ไม่ปลอดภัย** — parser ใหม่ที่ส่งเป็น heartbeat จะเพิ่มเวลา AI ทันที
(ซึ่งเป็นพฤติกรรมเดียวกับ WakaTime ที่นับ AI heartbeat เป็นเวลา "AI coding")
→ ต้องตอบ Q9 ก่อน Phase 01 (ตัวเลือกอยู่ในหัวข้อสรุป)

ยังไม่ได้รัน test จริง (ต้อง build workspace ~หลาย GiB ตาม [storage.md](../../.context/storage.md)) — ถ้าต้องการหลักฐานจากการรัน
ให้รัน `cargo test -p wakaclock-server activity_timeline` ใน workspace เดิมที่มี target อยู่แล้ว

## A7 baseline เทียบ WakaTime — รอตัวเลขจากเจ้าของ

| วัน | AtoAxis `wakatime_compatible` | WakaTime | ต่าง % | วินาทีจาก source AI |
|---|---|---|---|---|
| | | | | |
| **รวม 7 วัน** | | | | |

ผ่านเกณฑ์ ≤ 1%: รอข้อมูล

## A8 state DB ใช้ร่วมกัน — **ผ่าน**

| ฝั่ง | path ของ state DB | หลักฐาน |
|---|---|---|
| broker (ประมวลผล event จาก hook) | `~/.wakaclock/ai-attribution.sqlite3` | `cli/src/broker.rs` ~449, ~560 เรียก `AiAttributionState::open()` |
| `run_ai_sync` | `~/.wakaclock/ai-attribution.sqlite3` | `cli/src/main.rs` ~5804 เรียก `AiAttributionState::open()`; path จาก `core/src/ai/state.rs` ~1058 |

broker inbox แยกอยู่ที่ `~/.wakaclock/broker.db` (`core/src/broker.rs` `broker_db_path`) แต่ claim ledger วางใน
`ai-attribution.sqlite3` ได้เพราะทั้งสองทางเปิดไฟล์นี้

## 0.7 `ai_confidence="explicit"` — รอสิทธิ์ query ClickHouse

| source | ai_confidence ที่เก็บ | actor_type ที่เก็บ | จำนวนแถว |
|---|---|---|---|
| codex-activity-v2 | | | |

## 0.8 path จริงที่ยืนยันแล้ว (macOS)

| Tool | path ที่พบ | ตรงกับ matrix? |
|---|---|---|
| Claude Code | `~/.claude/projects/<proj>/*.jsonl` (24 project) | ✔ |
| Codex | `~/.codex/sessions/**` | ✔ |
| Gemini CLI | `~/.gemini/tmp/<slug>/` มีแค่ `.project_root` ไม่มี `chats/` | รอ session |
| Copilot VS Code | `AppSup/Code/User/workspaceStorage/<hash>/chatSessions/*.jsonl`, `…/chatEditingSessions/*/state.json` | ✔ (เป็น `.jsonl` ทั้งหมด) |
| Copilot store | `AppSup/Code/User/globalStorage/github.copilot-chat/session-store.db` | ✘ matrix เขียน `~/.copilot/session-store.db` |
| Copilot CLI | `~/.copilot/` มีแค่ `config.json`, `ide/`, `logs/` ไม่มี `session-state/` | รอ session |
| Kimi Code | `~/.kimi-code/` ไม่มี `wire.jsonl` | รอ session |

## สรุปสำหรับเจ้าของ

ข้อสมมติที่ไม่เป็นจริงและผลต่อแผน:
1. **A1/A2 ไม่จริง** → Phase 02 ต้องเปลี่ยนกุญแจ dedupe: ใช้ (a) คำนวณ event ID ของ hook จาก transcript หรือ
   (b) แก้ hook ให้ส่ง `tool_use_id` ดิบ (protected, ต้องออก plugin version ใหม่) + เก็บ fallback ตามเวลา/ไฟล์สำหรับข้อมูลเก่า
2. **A5 ซ้ำจริงฝั่ง client** (Claude ~98k บรรทัด) → Phase 02 สำคัญกว่าที่คิด; รอยืนยันฝั่ง server แล้วตอบ Q3
3. **A6 ไม่ผ่าน** → "time-neutral" ต้องออกแบบใหม่ (Q9) ก่อน Phase 01
4. **Copilot path ผิด** → แก้ matrix/Phase 05

ข้อตัดสินของเจ้าของ (2026-10-26):
- Q9: ก่อน certify ส่งแค่ usage (token/model/prompt count) ห้ามส่ง edit heartbeat → แก้ README D6, Phase 11, approval template แล้ว
- ClickHouse: เจ้าของรัน [phase-00-queries.sql](phase-00-queries.sql) เองแล้ว paste ผล (Claude ไม่เห็น credential)
- A7: เจ้าของ paste ยอดรายวัน 7 วันทั้งของ **WakaTime และ AtoAxis** (timezone เดียวกัน) — `wakatime_compatible`
  คำนวณใน service ไม่ได้เก็บใน ClickHouse จึง query ตรงไม่ได้ และ Claude ไม่มี session ที่ยืนยันตัวตนกับ API
- Gemini/Kimi sessions: เลื่อนไปทำใน Phase 03 / Phase 07

คำถามที่ยังค้างก่อน Phase 01: Q2 (`explicit`) และ Q3 (backfill) — ต้องได้ผล query ก่อน
พร้อมเริ่ม Phase 01: **ยังไม่พร้อม** (รอผล Q1–Q4 ของ SQL + ตัวเลข WakaTime)
