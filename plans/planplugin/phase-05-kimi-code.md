# Phase 5 — Kimi Code CLI Hooks

## เป้าหมาย

เพิ่ม Kimi Code CLI เป็น direct adapter ผ่าน lifecycle hooks และใช้ transcript/stream
output เป็น recovery path เฉพาะเมื่อ schema ได้รับการยืนยัน

## Package layout

```text
extensions/ai-agents/kimi-code/
  hooks/
    pre-tool-use
    post-tool-use
    post-tool-use-failure
    session-start
    session-end
  installer/
  fixtures/
  README.md
```

Hook implementation เรียก Universal Producer SDK และต้อง fail-open

## Hook mapping

- `SessionStart`: session ID, cwd, source และ model ถ้ามี
- `PreToolUse`: pending identity หรือ before snapshot
- `PostToolUse`: successful tool evidence
- `PostToolUseFailure`: cleanup และ diagnostic
- `SessionEnd`: ปิด session interval
- `Stop`/`StopFailure`: health/session metadata ไม่ใช่ file edit
- subagent events ใช้ session lineage เมื่อจำเป็น

## File tool mapping

เริ่มจาก tool names ที่ real Kimi version ยืนยัน เช่น:

```text
WriteFile
StrReplaceFile
Shell
```

- `WriteFile`/`StrReplaceFile` ใช้ path และ tool call identity
- shell ใช้ before/after snapshot
- unknown tool ไม่ parse arbitrary input; ส่ง diagnostic แล้วใช้ fallback
- tool output ห้ามถูก forward
- PostToolUseFailure ไม่สร้าง edit

## Hook configuration

- installer เพิ่ม managed `[[hooks]]` blocks ใน config
- preserve existing comments และ hook rules ของผู้ใช้
- matcher เจาะจงเฉพาะ event/tool ที่ต้องใช้
- timeout สั้นและ fail-open
- repeated setup ต้องไม่เพิ่ม duplicate rule
- upgrade เปลี่ยนเฉพาะ AtoAxis-managed blocks
- uninstall คืน config เดิมโดยไม่กระทบ hook อื่น

## Beta compatibility

Kimi hooks เป็น Beta จึงต้อง:

- pin/test supported Kimi version range
- manifest ระบุ payload schema version ที่ยืนยันแล้ว
- unknown/missing field ใช้ controlled diagnostic
- hook schema mismatch ลด effective status เป็น scaffold
- doctor ตรวจ config path เก่า/ใหม่และ hook activation
- release note ต้องระบุ version compatibility

## Provider and model

- direct Kimi CLI ใช้ `client_id=kimi-code-cli`
- default provider ใช้ `moonshot` เมื่อยืนยันจาก config/session
- model ใช้ค่าจริง ณ tool call ถ้าเปิดเผย
- Kimi-compatible third-party endpoint ห้ามถูกเรียก Moonshot โดยอัตโนมัติ
- ถ้าระบุ provider ไม่ได้ให้ `None`

## Transcript/stream recovery

- สำรวจ Kimi session storage และ stream-json format จาก real installation
- parser ต้องแยก successful tool result จาก tool request
- cursor, rotation และ malformed record ใช้ framework เดิม
- transcript recovery ต้อง dedup กับ native hook
- fixture สร้างหลัง real capture และ redact content ทั้งหมด
- หากไม่มี stable session transcript ให้ native hook เป็น primary และบันทึก limitation

## Verification status

- เริ่ม adapter เป็น `scaffold`
- unit fixture ไม่ถือเป็น live verification
- live check ต้องใช้ Kimi CLI จริงและตรวจ broker/backend row
- บันทึก Kimi version, hook schema, plugin version และ timestamp

## Files expected to change

- `extensions/ai-agents/kimi-code/`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- parser module ใหม่เมื่อ transcript schema ยืนยันแล้ว
- `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`
- CLI setup/doctor files

## Tests

- config managed-block round-trip
- idempotent setup/upgrade/uninstall
- SessionStart/SessionEnd
- successful WriteFile/StrReplaceFile
- failed tool emits no edit
- shell snapshot
- missing/unknown fields diagnostic
- native + transcript dedup
- offline queue/replay
- beta schema downgrade to scaffold
- privacy allowlist

## Manual live matrix

1. Kimi WriteFile
2. Kimi StrReplaceFile
3. Kimi shell edit
4. failed/cancelled tool
5. multi-file task
6. resume session
7. broker offline/restart
8. transcript recovery ถ้ามี stable transcript

## Acceptance criteria

- successful Kimi file tools ส่ง direct evidence
- `client_id=kimi-code-cli` และ provider/model ถูกต้อง
- config ของผู้ใช้ไม่เสีย comments/rules
- hook timeout/failure ไม่ขวาง Kimi workflow
- native/transcript evidence เหลือหนึ่ง canonical activity
- adapter ไม่แสดง Verified หากยังไม่ได้ live run
