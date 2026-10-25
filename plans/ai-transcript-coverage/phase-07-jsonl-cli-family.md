# Phase 07 — JSONL CLI family

สถานะ: **รอ Phase 05 + approval** (ต้องได้คำตอบ Q1, Q5 ก่อน)
Tier: 2 · ขึ้นกับ: Phase 01, 02 · ทำขนานกับ Phase 06/08 ได้

## เป้าหมาย

เพิ่ม parser ให้ CLI agent ที่เก็บ session เป็น JSONL ใต้ home:
Qwen Code, Kimi CLI, Kimi Code, Factory Droid, Grok CLI, Kiro, Amp, Continue, Pi

ทุกตัวใช้ `Jsonl` cursor เดิม (byte offset) ต่างกันแค่ path และการ map field
จึงทำเป็น **mapping แบบ Rust struct** บน engine เดียว ไม่ใช่ parser เต็มทีละตัว

## ข้อเท็จจริงเรื่องข้อมูล (ต้องยืนยันกับไฟล์จริง)

| Tool | Path (ใต้ home, ทุก OS เว้นแต่ระบุ) | env override | edit มาจาก | token | model | prompt |
|---|---|---|---|---|---|---|
| Qwen Code | `~/.qwen/projects/*/chats/*.jsonl` (หรือ `advanced.runtimeOutputDir` ใน `~/.qwen/settings.json`) | `QWEN_RUNTIME_DIR`, `QWEN_HOME` | functionResponse + `resultDisplay` diff | ✔ | ✔ | ✔ |
| Kimi CLI | `~/.kimi/sessions/**/wire.jsonl` | `KIMI_SHARE_DIR` | ต้องยืนยัน | ✔ | ✔ | ✔ |
| Kimi Code | `~/.kimi-code/**/wire.jsonl`; desktop: `AppSup/kimi-desktop/daimon-share/daimon/runtime/kimi-code/home/**/wire.jsonl` | `KIMI_CODE_HOME` | ต้องยืนยัน | ✔ | ✔ | ✔ |
| Factory Droid | `~/.factory/sessions/**.jsonl` | `FACTORY_DIR` | ต้องยืนยัน | ✔ | ✔ | ✔ |
| Grok CLI | `~/.grok/sessions/**/{summary.json, updates.jsonl, hunk_records.jsonl}`; version จาก `~/.grok/version.json` | `GROK_HOME` | **เฉพาะ** `hunk_records.jsonl` | ✔ turn-completed | ✔ ต่อ prompt | ✔ |
| Kiro | `~/.kiro/sessions/**/messages.jsonl` + `session.json`; CLI: `~/.kiro/sessions/cli/*.jsonl`; legacy: `AppSup/Kiro/User/globalStorage/kiro.kiroagent/` | `KIRO_HOME` | `tool_result` (success) / legacy `actions[replace]` | ต้องยืนยัน | `modelId` | ✔ |
| Amp | `~/Library/Caches/amp/logs/threads/**/*.log` (Linux `~/.cache/amp/...`, Windows ใต้ `%LOCALAPPDATA%`); `cli.log` ข้างกัน | — | tool lease (`edit`/`create`/`apply_patch`) ที่ยืนยันด้วย result `runStatus=done` | ✘ | ✘ | ✘ |
| Continue | `~/.continue/dev_data/<ver>/{chatInteraction, toolUsage, editOutcome, tokensGenerated}.jsonl`; `~/.continue/sessions/sessions.json` | — | `editOutcome` (accepted) | ✔ `tokensGenerated` | ✔ | ✔ |
| Pi | `~/.pi/agent/sessions/**/*.jsonl` | — | write-tool result + `details.diff` | ✔ | ✔ | ✔ |

ข้อสังเกต:
- Amp ไม่มี token/model/prompt → ได้แค่ edit
- Continue เก็บแยกหลายไฟล์ ต้อง join ด้วย session/timestamp
- Grok CLI แยก prompt/model/edit คนละไฟล์ ต้อง join ด้วย session + prompt index

## Design

### `core/src/ai/jsonl_family.rs`

```rust
struct JsonlProfile {
    agent_id: &'static str,
    roots: &'static [RootSpec],          // home-relative + env override + OS variants
    file_glob: &'static str,
    map: fn(&serde_json::Value, &mut SessionState) -> Vec<MappedRecord>,
}
enum MappedRecord { Edit {..}, Usage {..}, Prompt { chars: u64 }, Model(String), Session {..} }
```
- engine เดียวจัดการ discover, cursor, budget, claim ledger, privacy
- `map` เป็นฟังก์ชันสั้นต่อ tool (ประมาณ 40–80 บรรทัด) ไม่ต้อง implement trait ใหม่
- `SessionState` เก็บ model ล่าสุด, cwd, pending tool calls ต่อ session (เหมือน `ParserContext` เดิม
  และต้อง serialize ลง cursor ได้ ห้ามเก็บเนื้อหา)
- tool ที่ต้อง join หลายไฟล์ (Continue, Grok) ใช้ `MultiFileProfile` ที่อ่านทุกไฟล์ของ session ในรอบเดียว
  แล้ว join ใน memory โดยใช้ cursor แยกต่อไฟล์

### การนับบรรทัด

- normalize ทุก tool เป็น added/deleted แยกกัน
- tool ที่ให้แค่ net (หรือไม่ชัด) → `line_measurement_status = "partial"`
- tool ที่ไม่มีข้อมูลบรรทัด → `"unavailable"` แต่ยังส่ง edit (path) ได้

### Tool ที่ได้แค่ token หรือแค่ edit

- Amp: edit อย่างเดียว
- Goose (Phase 08) และ Continue บาง version: token อย่างเดียว
- การแสดงใน dashboard รอ Q5; parser ส่งข้อมูลเท่าที่มี ไม่เดาส่วนที่ขาด

### Kimi CLI กับ Kimi Code

- ตอนนี้ `normalize_agent_id` รวมเป็น `kimi-code-cli` และมี hook ของ Kimi Code อยู่แล้ว
- ตาม Q1: ถ้าแยก → `kimi-cli` และ `kimi-code-cli`; ถ้ารวม → ใช้ `kimi-code-cli` ทั้งคู่และแยกด้วย
  `producer_surface`
- dedupe กับ hook ของ Kimi Code ผ่าน claim ledger

## ไฟล์

แก้: `core/src/ai/parser_registry.rs`, `core/src/ai/adapter.rs`, `core/src/ai/mod.rs`,
`core/src/ai/event.rs` (ถ้า ID ยังไม่ครบจาก Phase 02), `core/src/ai/CAPABILITIES.md`

เพิ่ม: `core/src/ai/jsonl_family.rs`, `core/src/ai/jsonl_profiles/{qwen,kimi,droid,grok,kiro,amp,continue_dev,pi}.rs`,
fixtures ใต้ `core/src/ai/fixtures/<tool>/` (สังเคราะห์ก่อน แทนด้วยของจริงที่ลบเนื้อหาแล้วหลัง live run)

## Tests

ต่อ profile อย่างน้อย:
- edit สำเร็จ / edit ล้มเหลว / read ไม่นับ
- token และ model ถูก session
- รอบที่สองบนไฟล์เดิมไม่ส่งซ้ำ
- บรรทัดไม่ครบ JSON (ไฟล์กำลังถูกเขียน) → รอรอบถัดไป ไม่ error
- env override ทำงาน
- marker ลับใน prompt ไม่หลุด

เพิ่ม:
- Continue join 4 ไฟล์ถูก
- Grok join prompt index ↔ hunk ถูก
- Amp: lease ที่ไม่มี result `done` ไม่นับ

## Live certification

| Tool | macOS | Windows | Linux |
|---|---|---|---|
| Qwen Code | ☐ | ☐ | ☐ |
| Kimi CLI | ☐ | ☐ | ☐ |
| Kimi Code | ☐ | ☐ | ☐ |
| Factory Droid | ☐ | ☐ | ☐ |
| Grok CLI | ☐ | ☐ | ☐ |
| Kiro (IDE + CLI) | ☐ | ☐ | ☐ |
| Amp | ☐ | ☐ | ☐ |
| Continue | ☐ | ☐ | ☐ |
| Pi | ☐ | ☐ | ☐ |

ลำดับแนะนำ: Kimi Code (เจ้าของมีโฟลเดอร์อยู่แล้ว) → Qwen → Kiro → Continue → Amp → ที่เหลือ

## คำขออนุมัติ (สรุปเนื้อหา)

1. ไฟล์: ตามหัวข้อ "ไฟล์"
2. ทำ: engine JSONL family + 8 profile
3. ผล: Tier 2 เก้าตัวได้ข้อมูลเท่าที่ log มี (เริ่ม time-neutral)
4. ความเสี่ยง: map ผิดทำ edit ปลอม, join ผิด session, ซ้ำกับ hook ของ Kimi
5. หลักฐาน: tests + live cert
- Baseline: time-neutral → ผลต่อเวลา 0%

## Exit criteria

- [ ] ทุก profile ผ่าน tests
- [ ] live cert บน macOS อย่างน้อยของ tool ที่ติดตั้งได้; ที่เหลือบันทึกเหตุผล
- [ ] matrix อัปเดตคอลัมน์ "?" ให้เป็นค่าจริง

## ความเสี่ยง

| ความเสี่ยง | ป้องกัน |
|---|---|
| CLI เหล่านี้เปลี่ยนรูปแบบเร็ว (ส่วนใหญ่ยังเป็น beta) | profile ทนต่อ field หาย, doctor แจ้ง schema ไม่รู้จัก, ใบรับรองผูก version |
| `map` เขียนผิดแล้วนับ read เป็น edit | test ต่อ profile ต้องมีกรณี read เสมอ |
| ไฟล์ log ของ Amp ปนข้อความ debug อื่น | อ่านเฉพาะบรรทัดที่ parse เป็น JSON และมี field ที่ต้องการ |
