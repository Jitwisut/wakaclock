# Phase 00 — Baseline และพิสูจน์ contract

สถานะ: **พร้อมเริ่ม** (อ่านอย่างเดียว ไม่ต้องขอ approval ตาม heartbeat-safety เพราะไม่แก้โค้ด)
ผลลัพธ์: กรอกใน [phase-00-baseline-results.md](phase-00-baseline-results.md)

## เป้าหมาย

พิสูจน์ข้อสมมติทุกข้อที่แผนนี้พึ่งพา ด้วยหลักฐานจากไฟล์จริงและข้อมูลจริง ก่อนแตะ protected scope
ถ้าข้อใดไม่เป็นจริง ต้องกลับมาแก้แผน phase ที่เกี่ยวข้องและแจ้งเจ้าของก่อน

## ข้อสมมติที่ต้องพิสูจน์

| ID | ข้อสมมติ | ใช้ใน phase |
|---|---|---|
| A1 | hook payload และ transcript ของ Claude มี `tool_use_id` ค่าเดียวกันสำหรับ edit เดียวกัน | 02 |
| A2 | hook payload และ rollout ของ Codex มี `call_id` ค่าเดียวกัน และ `exec` ครอบ `apply_patch` | 02, 03 |
| A3 | Gemini CLI มี tool-call ID ทั้งใน hook และ session file | 02, 03 |
| A4 | Server เก็บ `prompt_character_count`, `prompt_count` และ token ใน `wakaclock.ai_usage_events` ครบ | 01, 03 |
| A5 | ตอนนี้มีแถว hook + transcript ของ edit เดียวกันซ้ำกันจริงใน ClickHouse | 02 |
| A6 | AI heartbeat ที่ `active_seconds=0` (time-neutral) ไม่ทำให้ยอด `wakatime_compatible` ขยับ | ทุก phase |
| A7 | ยอดปัจจุบันห่าง WakaTime ≤ 1% (baseline ก่อนเริ่ม) | ทุก phase |
| A8 | ขั้น accept ของ hook (broker) และ `run_ai_sync` เปิด SQLite state ไฟล์เดียวกัน (claim ledger ต้องเห็นทั้งสองฝั่ง) | 02 |

## งาน

### 0.1 เตรียม worktree

- สร้าง worktree ใหม่จาก `main` ตาม [`.context/storage.md`](../../.context/storage.md)
  (ใช้ worktree เดิมใต้ `.worktrees/` ถ้ามีและว่าง) branch: `claude/ai-transcript-coverage`
- ห้ามทำงานใน checkout หลักที่อยู่บน `codex/team-closure-wip` (มีงาน Team ค้าง)
- บันทึก commit ของ `main` ที่ใช้เป็นฐานลงไฟล์ผล

### 0.2 ตรวจ ID สองฝั่ง (A1–A3)

กฎ privacy ของการตรวจ: ดู **เฉพาะชื่อ key และชนิดค่า** ห้ามพิมพ์เนื้อหา prompt/โค้ดออกมา

Claude (transcript):
```bash
jq -c 'select(.toolUseResult.structuredPatch != null)
  | {tool_use_id: (.message.content[0].tool_use_id // .toolUseResult.tool_use_id | type)}' \
  ~/.claude/projects/<proj>/<session>.jsonl | sort | uniq -c
```
- เปรียบเทียบกับ field ที่ hook อ่าน: `extensions/ai-agents/plugins/atoaxis-heartbeat/scripts/heartbeat.sh`
  บรรทัดที่อ่าน `.tool_use_id` (~47) และที่สร้าง `EVENT_ID="claude-code-${EVENT_HASH}"` (~175)
- ทดสอบจริง: ทำ edit 1 ครั้งใน Claude Code แล้วดู spool ของ hook กับ transcript ว่า `tool_use_id` ตรงกัน

Codex:
- นับ `custom_tool_call` แยกตาม `name` และดูว่า `exec` มี payload ที่เป็น patch หรือไม่ (ดูแค่ key)
- เปรียบเทียบกับ `extensions/ai-agents/codex/heartbeat-hook.sh` (~46 อ่าน `.tool_use_id`, ~194 สร้าง ID)
- ทดสอบจริง: ทำ `apply_patch` 1 ครั้ง แล้วเทียบ `call_id`

Gemini CLI / Copilot / Kimi Code:
- เจ้าของต้องเปิด session จริงอย่างน้อย 1 ครั้งที่มีการแก้ไฟล์ (ตอนนี้ยังไม่มี `chats/`, `session-state/`, `wire.jsonl`)
- บันทึก version ของ tool ที่ใช้

### 0.3 ตรวจ server (A4)

- อ่าน DDL: `server/repository/ai_usage.rs` (`CREATE TABLE IF NOT EXISTS wakaclock.ai_usage_events`
  มี `usage_event_id`, `ai_agent`, `prompt_count`, `prompt_character_count`) และ
  `server/repository/heartbeat.rs` (คอลัมน์ `ai_event_id`, `ai_change_id`, `prompt_character_count`, `input_tokens`)
- readback แถวจริงของ Claude/Codex ล่าสุด 7 วัน (นับจำนวน + ดูว่า field ไม่เป็น NULL ทั้งหมด):

```sql
SELECT ai_agent, count() AS rows,
       countIf(input_tokens IS NOT NULL) AS with_tokens,
       countIf(prompt_character_count IS NOT NULL) AS with_prompt_chars
FROM wakaclock.ai_usage_events
WHERE user_id = {owner_uuid} AND date >= today() - 7
GROUP BY ai_agent;
```

### 0.4 วัด duplicate ที่มีอยู่แล้ว (A5)

ข้อควรระวัง: **group ด้วย `ai_change_id` ไม่ได้** เพราะ hook path ตั้ง `ai_change_id = tool_event_id`
(`cli/src/broker.rs` ~508) แต่ transcript path (`build_ai_heartbeat` ใน `cli/src/main.rs`) ตั้งแค่
`ai_event_id` ไม่ได้ตั้ง `ai_change_id` แถว transcript จึงเป็น NULL ทำให้ query แบบ group ด้วย change id
หา duplicate ไม่เจอเลย (ข้อนี้เองก็เป็นสาเหตุที่ server จับคู่สองแถวไม่ได้ ดู Phase 02)

ให้จับคู่ด้วย agent + ไฟล์ + ช่วงเวลาใกล้กันแทน:

```sql
SELECT h.ai_agent,
       count() AS pairs,
       sum(t.ai_lines_added) AS extra_lines_added
FROM wakaclock.heartbeats AS h
INNER JOIN wakaclock.heartbeats AS t
  ON  h.user_id = t.user_id
  AND h.ai_agent = t.ai_agent
  AND h.entity = t.entity
WHERE h.user_id = {owner_uuid}
  AND h.time >= now() - INTERVAL 30 DAY
  AND h.ai_source = 'agent_hook'
  AND t.ai_source = 'transcript'
  AND abs(dateDiff('second', h.time, t.time)) <= 10
GROUP BY h.ai_agent;
```
- ตรวจด้วยว่าแถว transcript มี `ai_change_id` เป็น NULL จริง (`countIf(ai_change_id IS NULL)` แยกตาม `ai_source`)
- ช่วง ±10 วินาทีเป็นค่าเริ่ม ให้ลอง 5/30 วินาทีด้วยเพื่อดูความไวของผล
- รายงาน: จำนวนคู่ที่ซ้ำ, `ai_lines_added` ส่วนเกินรวม, และวินาทีที่ซ้ำ (ถ้ามี) ต่อวัน
- ต้องยืนยันชื่อคอลัมน์กับ DDL ก่อนรัน (query นี้เขียนจากการอ่านโค้ด)
- ใช้ credential จาก environment ตาม [`.context/environment.md`](../../.context/environment.md) ห้ามเขียนลงไฟล์

### 0.5 Baseline เวลา (A7)

- ใช้ช่วง 7 วันทำงานล่าสุด เทียบ AtoAxis `wakatime_compatible` กับ WakaTime ของผู้ใช้คนเดียวกัน
- แยกวินาทีที่มาจาก source `ai` / `ai_tool_v1` ออกมาด้วย เพื่อเป็นค่าอ้างอิงตอนปลด time-neutral
- ใช้ endpoint/readback เดิม ห้ามแก้สูตร

### 0.6 ทดสอบ anchor ของ time-neutral (A6)

เหตุผล: `bridge_idle_gaps_with_anchors` ใน `server/services/activity_timeline.rs` ใช้ heartbeat ที่ไม่มี duration
เป็น anchor ต่อ chain ได้ ถ้า AI heartbeat ที่ `active_seconds=0` ไปเชื่อมช่องว่างของ editor
ยอดเวลาอาจเพิ่มขึ้นแม้ตั้งใจให้ time-neutral

วิธีทดสอบ (fixture เท่านั้น ไม่ส่งข้อมูลจริง):
1. สร้าง fixture editor heartbeat 2 ช่วง ห่างกัน 20 นาที (เกิน idle 15 นาที)
2. เพิ่ม AI heartbeat `active_seconds=0` ตรงกลางช่องว่าง
3. รันการคำนวณ timeline ด้วย test ที่มีอยู่ (อ่านอย่างเดียว: รัน test ที่มีอยู่หรือใช้ test harness ใน scratch
   ห้ามแก้ test ใน repo)
4. เทียบยอดก่อน/หลัง

ถ้ายอดขยับ → Q9 ใน README: ต้องเลือกทางอื่น เช่น ส่ง edit ทาง `ai_changes_raw`/usage แทน heartbeat
หรือใส่ flag ที่ทำให้ timeline ไม่ใช้เป็น anchor (ซึ่งเป็นการแตะ locked logic ต้องขออนุญาตแยก)

### 0.7 บันทึกเรื่อง `ai_confidence="explicit"`

- `cli/src/capture_service.rs` (~38-64) ตั้ง `ai_source="transcript"` และ `ai_confidence="explicit"`
  ให้ activity event ทุกตัว ค่า `explicit` ไม่อยู่ในชุดค่าที่ `core/src/heartbeat.rs` รู้จัก
- query ดูว่าแถว `codex-activity-v2` ใน ClickHouse มี `ai_confidence` และ `actor_type` เป็นอะไร
- ห้ามแก้ ให้บันทึกผลและถามเจ้าของ (Q2)

### 0.7b ตรวจว่า state DB ใช้ร่วมกัน (A8)

- หา path ที่ broker (`cli/src/broker.rs`, `core/src/broker.rs`) เปิด state เทียบกับที่ `run_ai_sync` เปิด
  (`core/src/ai/state.rs` และฟังก์ชัน `*_state_path()` ใน `cli/src/main.rs`)
- ถ้าเป็นคนละไฟล์ Phase 02 ต้องเพิ่มการแชร์ claim ระหว่างสองไฟล์ (หรือย้าย ledger ไปไฟล์ที่ทั้งคู่เปิด)
  และต้องระบุใน approval ของ Phase 02

### 0.8 สำรวจ storage ของ tool ตาม OS

- สำหรับแต่ละ tool ใน Tier 1 ที่ติดตั้งได้ ให้บันทึก path จริงบน macOS
- Windows/Linux: บันทึกเป็น "ต้องยืนยัน" จนกว่าจะได้เครื่องตาม Q8

## สิ่งที่ห้ามทำใน Phase นี้

- ห้ามแก้ไฟล์ใน repo ยกเว้น [phase-00-baseline-results.md](phase-00-baseline-results.md) และ
  [coverage-matrix.md](coverage-matrix.md)
- ห้ามเขียนข้อมูลลง ClickHouse/Postgres (query อ่านอย่างเดียว)
- ห้ามคัดลอก transcript จริงเข้า repo
- ห้าม commit/push

## Exit criteria

- [ ] A1–A8 มีผล "ยืนยัน / ไม่ยืนยัน / ยังทดสอบไม่ได้" พร้อมหลักฐาน
- [ ] ตัวเลข duplicate (จำนวน change, บรรทัดส่วนเกิน, วินาที) ต่อวัน
- [ ] baseline delta เทียบ WakaTime เป็น %
- [ ] ผลทดสอบ anchor
- [ ] รายงานเจ้าของ และได้คำตอบ Q2, Q3, Q9 ก่อนเริ่ม Phase 01

## ความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|---|---|
| query เผลอแสดง path ส่วนตัวในรายงาน | รายงานเฉพาะจำนวน ไม่ใส่ `entity` จริงลงไฟล์ผล |
| `jq` เผลอพิมพ์เนื้อหา prompt | ใช้ filter ที่คืนแค่ `type`/ชื่อ key เสมอ |
| ข้อมูล 30 วันไม่พอเพราะ hook ไม่ได้ติดตั้งตลอด | บันทึกช่วงที่ hook ติดตั้งจริงควบคู่ |
| Gemini/Copilot/Kimi ยังไม่มี session | เจ้าของสร้าง session ก่อน หรือเลื่อน A3 ไปทำใน Phase 03/05/07 |
