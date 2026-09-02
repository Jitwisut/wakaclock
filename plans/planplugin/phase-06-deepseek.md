# Phase 6 — DeepSeek Provider and Client Support

## เป้าหมาย

รองรับ DeepSeek อย่างถูกต้องโดยแยก “provider/model” ออกจาก “coding client”
และไม่สร้าง AI file attribution จาก API call หรือ process name เพียงอย่างเดียว

## Supported modes

### Mode A: DeepSeek เป็น provider ภายใน agent อื่น

ตัวอย่าง:

```text
Codex + DeepSeek
Claude Code + DeepSeek-compatible endpoint
Kilo Code + DeepSeek
OpenCode-compatible client + DeepSeek
```

ในโหมดนี้ direct file evidence มาจาก host client ส่วน DeepSeek เป็น metadata

### Mode B: Standalone coding client

หากผู้ใช้ใช้ Deep Code หรือ standalone client อื่น:

- ตรวจชื่อและ version ของ client จริง
- สำรวจ hook/plugin/transcript/notify API ของ client นั้น
- สร้าง adapter manifest แยกตาม client
- ใช้ `client_id` ของโปรแกรม ไม่ใช้ provider เป็น client
- หากมีเพียง completion API และไม่มี file event ให้ mark unsupported

### Mode C: DeepSeek web/chat

- browser chat ไม่มี direct editor file evidence
- copy/paste เข้าสู่ editor เป็น clipboard `external_or_unknown`
- ห้ามตั้งชื่อว่า AI Paste หรือ DeepSeek edit
- future browser extension ต้องเป็นแผนแยกต่างหาก

## Provider normalization

เพิ่ม exhaustive mapping สำหรับ:

```text
deepseek
deepseek-api
api.deepseek.com
DeepSeek model identifiers ที่ระบบรองรับ
```

- mapping อยู่ใน core จุดเดียว
- reverse mapping สำหรับ API/analytics อยู่จุดเดียวกัน
- unknown custom gateway ไม่เดาว่าเป็น DeepSeek จาก model display อย่างเดียว
- provider/model ที่ client report ต้องผ่าน allowlist/length validation

## Host-client attribution

ตัวอย่าง expected output:

| Runtime | client | provider |
|---|---|---|
| Codex configured to DeepSeek | `codex` | `deepseek` |
| Kilo routed to DeepSeek | `kilo-code` | `deepseek` |
| Claude Code using DeepSeek endpoint | `claude-code` | `deepseek` |
| standalone Deep Code | stable Deep Code client ID | `deepseek` |

model switch/fallback ต้องใช้ provider/model ที่ tool call จริง ไม่ใช่ config default

## Evidence rules

- API request สำเร็จไม่เท่ากับ file edit
- model response มี code ไม่เท่ากับ file edit
- process `deepseek` running ไม่เท่ากับ file edit
- host native successful tool + file mutation สามารถเป็น verified
- transcript completed tool สามารถเป็น correlated/verified ตาม parser certification
- filesystem-only change คง inferred/unknown

## Standalone adapter discovery

สำหรับ client ที่ต้องรองรับ:

1. ตรวจ official integration point
2. capture version และ metadata-only payload
3. ตรวจ tool success/failure semantics
4. ตรวจ session/model/provider fields
5. สร้าง manifest เป็น scaffold
6. เพิ่ม parser/hook integration
7. ทำ live end-to-end
8. จึงเลื่อนเป็น Verified

หากไม่มี hook/transcript ที่มั่นคง ให้ใช้ generic MCP/tool wrapper หรือ snapshot fallback
และบันทึก limitation ตามจริง

## Files expected to change

- provider normalization module ใน `wakaclock-core`
- `backend/api/crates/wakaclock-core/src/ai/event.rs`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- Codex/Kilo/Claude normalizers
- `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`
- standalone adapter directory เฉพาะเมื่อมี client จริง

## Tests

- exhaustive provider normalization
- Codex + DeepSeek
- Kilo + DeepSeek
- Claude + DeepSeek-compatible endpoint
- model switch/fallback
- custom gateway remains unknown when evidence insufficient
- DeepSeek API-only event creates no file attribution
- process-only evidence not verified
- clipboard external remains unattributed
- standalone client adapter status cannot self-promote without live evidence

## Manual live matrix

1. ใช้ DeepSeek ผ่าน Codex แล้วแก้ไฟล์
2. ใช้ DeepSeek ผ่าน Kilo แล้วแก้ไฟล์
3. เปลี่ยนจาก DeepSeek ไป provider อื่นกลาง session
4. เรียก DeepSeek API โดยไม่แก้ไฟล์
5. copy code จาก DeepSeek web แล้ว paste
6. standalone client run หากติดตั้งได้

## Acceptance criteria

- dashboard ไม่เรียก DeepSeek ว่าเป็น client เมื่อทำงานใต้ Codex/Kilo/Claude
- provider/model ถูกต้องต่อ tool call
- API-only และ web-chat activity ไม่สร้าง verified file edit
- standalone adapter แสดง limitation/status ตามหลักฐานจริง
- ไม่มีการนับซ้ำเมื่อ host client และ provider telemetry พูดถึง turn เดียวกัน
