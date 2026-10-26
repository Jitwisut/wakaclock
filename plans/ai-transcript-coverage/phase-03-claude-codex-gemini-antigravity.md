# Phase 03 — Claude Code, Codex, Gemini CLI, Antigravity

สถานะ: **รอ Phase 02 + approval** (ต้องได้คำตอบ Q4 และ Q8 ก่อน)
Tier: 1 · ขึ้นกับ: Phase 01, 02

## เป้าหมาย

1. ทำให้ parser 3 ตัวที่มีอยู่แล้วใช้ engine ของ Phase 01 เต็มรูปแบบ (usage อยู่ใน trait)
2. ยืนยันรูปแบบไฟล์จริงล่าสุดของแต่ละ tool และแก้เฉพาะส่วนที่เปลี่ยน
3. ทำ Gemini CLI ให้ทดสอบกับไฟล์จริงได้ (ตอนนี้ fixture มีแค่ README)
4. เพิ่ม Antigravity (ส่วน JSONL ก่อน)
5. ต่ออายุใบรับรองให้ Claude/Codex กลับเป็น verified บนทั้ง 3 OS

## สภาพปัจจุบัน

| Tool | Parser | Usage | Fixture | หมายเหตุ |
|---|---|---|---|---|
| Claude Code | `core/src/ai/claude.rs` | `parse_claude_usage` ใน `usage.rs` | `core/src/ai/fixtures/claude_code/` (สังเคราะห์) | transcript จริงมี `structuredPatch` + `tool_use_id` |
| Codex | `core/src/ai/codex.rs` | `parse_codex_usage` | `core/src/ai/fixtures/codex/` (สังเคราะห์) | rollout จริงมี `custom_tool_call` ชื่อ `exec` + `call_id`, มี `token_usage_record` |
| Gemini CLI | `core/src/ai/gemini.rs` | `parse_gemini_usage` | มีแค่ README | ยังไม่เคยยืนยันกับไฟล์จริง |
| Antigravity | ไม่มี (มีแค่ hook) | ไม่มี | ไม่มี | — |

## งานต่อ tool

### Claude Code

- ย้าย `parse_claude_usage` เข้า `parse_usage` ของ trait (พฤติกรรมเดิม)
- รองรับ `$CLAUDE_CONFIG_DIR` และโฟลเดอร์ `projects` ที่เป็น symlink (เช่น iCloud) ถ้ายังไม่รองรับ
- ยืนยันว่ารองรับ `toolUseResult` ทุกแบบที่ใช้จริง: `structuredPatch[].{newLines, oldLines}`,
  การสร้างไฟล์ใหม่ (`type: create`), การลบไฟล์, และ `bashEditDiff` ถ้ามี
- บรรทัด: แปลงเป็น `ai_lines_added` / `ai_lines_deleted` แยกกัน (ไม่ใช้ค่า net)
- Model: `message.model` ของ assistant record ก่อนหน้า (มีอยู่แล้ว)
- Windows: path ใต้ `%USERPROFILE%\.claude\projects`; Linux: `~/.claude/projects`; WSL: ดูคำถามด้านล่าง

### Codex

- ยืนยันจาก Phase 00 (A2) ว่า `exec` ที่เป็น `custom_tool_call` ครอบ patch อยู่ และ parser ปัจจุบันจับได้
  ถ้าไม่ครอบ ให้เพิ่มการจับเฉพาะ shape ที่พบ
- ย้าย `parse_codex_usage` เข้า trait; รองรับ `token_usage_record` ระดับบนสุด (`usage.rs` มีอยู่แล้ว ~297)
- รองรับ `archived_sessions/` และ `$CODEX_HOME`
- Session ที่ fork: ใช้ `session_meta.forked_from_id` เพื่อไม่นับ record ที่คัดลอกมาจาก parent ซ้ำ
  (ต้องยืนยันว่ามี field นี้ในไฟล์จริงก่อน)

### Gemini CLI

- เจ้าของสร้าง session จริงอย่างน้อย 3 แบบ: สร้างไฟล์, แก้ไฟล์ (`replace`), แก้หลายไฟล์
- สร้าง fixture จากไฟล์จริงโดย **ลบเนื้อหา** (`content`, `old_string`, `new_string`, ข้อความ prompt) ออก
  เก็บแค่ key, ชนิด, timestamp, ชื่อ tool, จำนวนบรรทัด
- รูปแบบไฟล์:
  - `chats/session-*.json` (เขียนทับ) → ใช้ `JsonSnapshot` จาก Phase 01
  - `chats/session-*.jsonl` ที่มี patch แบบ `$set` / `$rewindTo` → ต้องเล่น patch ตามลำดับก่อนแตก record
    `$rewindTo` หมายถึงย้อน conversation ให้ถือว่า record หลังจุดนั้นถูกยกเลิก
    (edit ที่ส่งไปแล้วไม่ retract ตาม D7 แต่บันทึกลง conflict/diagnostics)
- บรรทัด: ใช้ `resultDisplay.diffStat.{model_added_lines, model_removed_lines}` ถ้ามี
- Prompt count: นับจาก `logs.json` (นับจำนวนและความยาว ไม่เก็บข้อความ)
- Project: `~/.gemini/projects.json` และ `tmp/<slug>/.project_root`

### Antigravity

- ไฟล์ใหม่ `core/src/ai/antigravity.rs`
- อ่าน `~/.gemini/{antigravity,antigravity-ide,antigravity-cli}/brain/<session>/.system_generated/logs/transcript.jsonl`
- ใช้ agent ID `antigravity` (มีใน `KNOWN_AGENT_IDS` แล้ว)
- ส่วน SQLite ที่เก็บ protobuf (`conversations/*.db`, `implicit/*.db`): รอ Q4
  - ถ้าเจ้าของเลือก decode เอง → ทำเป็น phase ย่อย 03b, clean-room จากการสังเกตไฟล์จริงเท่านั้น
  - ถ้าไม่ → บันทึกใน matrix ว่า token อาจไม่ครบ
- dedupe กับ hook ของ Antigravity (`cli/src/native_hooks.rs`) ผ่าน claim ledger ของ Phase 02

## ไฟล์

แก้: `core/src/ai/claude.rs`, `core/src/ai/codex.rs`, `core/src/ai/gemini.rs`, `core/src/ai/usage.rs`,
`core/src/ai/parser_registry.rs`, `core/src/ai/adapter.rs` (manifest + capabilities),
`core/src/ai/CAPABILITIES.md`, `core/src/ai/VERIFICATION.md`

เพิ่ม: `core/src/ai/antigravity.rs`, `core/src/ai/fixtures/gemini_cli/*.json(l)`,
`core/src/ai/fixtures/antigravity/*.jsonl`, scenario ใหม่ใน `scripts/ai-coverage/`
(campaign ของ Gemini/Antigravity โดยใช้ `run_claude_cli_campaign.py` เป็นต้นแบบ)

## Tests

| Test | ยืนยัน |
|---|---|
| golden เดิมของ Claude/Codex | ไม่เปลี่ยน |
| fixture Gemini: create / replace / multi-file / `$rewindTo` | จำนวน edit และบรรทัดถูก |
| fixture Gemini snapshot เขียนทับ 2 ครั้ง | ไม่ส่งซ้ำ |
| Antigravity transcript | edit + model ถูก |
| privacy test | ไม่มี field `content`/`old_string`/`new_string`/prompt text ใน payload ที่ส่ง |
| usage incremental | รอบที่ 2 บนไฟล์เดิมไม่สร้าง usage ใหม่ |

## Live certification (ต่อ tool × OS)

ใช้สคริปต์เดียวกันทุก tool (รายละเอียดใน [Phase 11](phase-11-certification-and-rollout.md)):
1. ติดตั้ง/อัปเดต tool และบันทึก version
2. session ตามสคริปต์: prompt 3 ครั้ง, สร้างไฟล์ 1, แก้ 3, แก้หลายไฟล์ 1, edit ที่ล้มเหลว 1
3. `wakaclock ai sync --dry-run --verbose` → เทียบกับ ground truth ที่จดไว้
4. sync จริง → readback heartbeats + `ai_usage_events`
5. ออกใบรับรองด้วย `scripts/ai-coverage/run_live_certification.py`

| Tool | macOS | Windows | Linux |
|---|---|---|---|
| Claude Code | ☐ | ☐ | ☐ |
| Codex | ☐ | ☐ | ☐ |
| Gemini CLI | ☐ | ☐ | ☐ |
| Antigravity | ☐ | ☐ | ☐ (ถ้ามี) |

## คำถามเพิ่มเติมที่ต้องถามก่อนเริ่ม

- WSL: จะอ่าน home ของ WSL จากฝั่ง Windows ด้วยหรือไม่ (WakaTime ทำ) หรือให้ติดตั้ง wakaclock ใน WSL แยก
- Codex IDE extension / Codex Desktop: ใช้ rollout เดียวกันหรือไม่ ต้องยืนยันจากเครื่องจริง

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: ย้าย usage เข้า trait, รองรับ shape ใหม่ที่พบจริง, fixture Gemini จริง, parser Antigravity
3. ผล: Claude/Codex/Gemini/Antigravity ได้ edit + token + model; ใบรับรองใหม่
4. ความเสี่ยง: แก้ parser เดิมแล้วพฤติกรรมเปลี่ยน, `$rewindTo` ทำ edit ผี, fixture หลุดเนื้อหาจริง
5. หลักฐาน: golden, privacy test, live cert 3 OS
- Baseline: Antigravity เริ่ม time-neutral (ส่งแค่ usage, `emit_edit_heartbeats=false`); Claude/Codex/Gemini คงพฤติกรรมเวลาเดิม → ผลต่อเวลา 0%

## Exit criteria

- [ ] golden ของ Claude/Codex ไม่เปลี่ยน (หรือเปลี่ยนเฉพาะ shape ใหม่ที่ได้รับอนุญาต)
- [ ] Gemini มี fixture จริง (ลบเนื้อหาแล้ว) และ live cert บน macOS
- [ ] Antigravity มี parser + live cert บน macOS
- [ ] ใบรับรองครบตามตาราง (ช่องที่ทำไม่ได้มีเหตุผลบันทึก)
- [ ] [coverage-matrix.md](coverage-matrix.md) อัปเดต

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| tool อัปเดตรูปแบบระหว่างทำ | บันทึก version ในใบรับรอง; parser ทนต่อ field ที่ไม่รู้จัก |
| `$rewindTo` ทำให้นับ edit ที่ถูกยกเลิก | ตาม D7 ไม่ retract แต่บันทึก conflict และนับใน doctor |
| fixture หลุดโค้ด/prompt จริง | script ลบเนื้อหา + review ก่อน commit |
| Gemini กับ Antigravity ใช้ `~/.gemini` ร่วมกัน | แยก root ตามชื่อโฟลเดอร์และ agent ID ชัดเจน |
