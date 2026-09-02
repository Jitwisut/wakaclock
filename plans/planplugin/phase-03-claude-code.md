# Phase 3 — Claude Code Plugin Migration

## เป้าหมาย

ย้าย Claude Code integration ที่ live verified แล้วมาใช้ Universal Producer SDK
โดยรักษาพฤติกรรมเดิมและลด shell logic ที่ซ้ำกับ adapter อื่น

## Existing integration

ฐานเดิมอยู่ที่:

```text
extensions/ai-agents/plugins/atoaxis-heartbeat/
  hooks/hooks.json
  scripts/heartbeat.sh
  scripts/heartbeat-sweep.sh
  scripts/git-sweep-before.sh
  scripts/git-sweep-after.sh
```

งานนี้เป็น migration ไม่ใช่สร้าง plugin คู่ขนานอีกชุด

## Hook mapping

- `SessionStart`: session, model, cwd และ start/resume metadata
- `PostToolUse`: successful `Write|Edit|MultiEdit`
- `PostToolUseFailure`: cleanup pending state และ diagnostic
- shell tool lifecycle: before/after snapshot
- `SessionEnd`: ปิด session interval ด้วย event ล่าสุด
- `FileChanged`: ใช้เป็น supporting evidence เมื่อ change ไม่ได้มาจาก Write/Edit

## Direct file tools

- ใช้ `tool_use_id` เป็น producer identity
- ใช้ absolute file path ที่ hook ให้มา
- extract line counts โดยไม่ serialize `content`
- `Write` whole-file ต้องรองรับกรณีไฟล์ใหม่และ overwrite
- `MultiEdit` หลาย hunk ในไฟล์เดียวต้องเป็นหนึ่ง file event
- failed tool ห้าม emit edit
- duration metadata แยกจาก file edit event

## Shell tools

`PostToolUse` ของ Write/Edit ไม่ครอบ Bash/PowerShell ที่แก้ไฟล์ จึงต้อง:

- เรียก shared `tool-before` ก่อน shell tool
- เรียก shared `tool-after` หลังสำเร็จ
- emit changed-file evidence จาก snapshot diff
- ไม่ parse หรือเก็บ command string
- limit changed-file fanout
- formatter/build-generated change ต้องใช้ confidence policy กลาง

## Privacy migration

- hook input มี file content ได้ จึงต้องสร้าง allowlisted object ใหม่
- ห้าม forward hook JSON ทั้งก้อน
- ห้าม log stdin payload ใน debug mode
- errors log ได้เฉพาะ event ID, hook name, code และ redact path
- local fixture ต้องใช้ placeholder content เท่านั้น

## Backward compatibility

- plugin version ใหม่ทำงานกับ legacy CLI โดยตัด unsupported fields
- core Claude heartbeat ต้องไม่หายเมื่อ broker/SDK version เก่า
- upgrade ไม่สร้าง hook ซ้ำใน user/project settings
- existing marketplace install ต้อง upgrade ได้
- uninstall ลบเฉพาะ plugin-owned data

## Verification

- รักษา live verification เดิมไว้เป็น baseline
- หลัง migration ต้องทำ live run ใหม่
- บันทึก Claude Code version, plugin version, CLI SHA และ timestamp
- ถ้า payload schema เปลี่ยนให้ลด status เป็น scaffold จน re-verify

## Files expected to change

- `extensions/ai-agents/plugins/atoaxis-heartbeat/`
- `backend/api/crates/wakaclock-core/src/ai/claude.rs`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`
- shared producer files from Phase 1

## Tests

- SessionStart new/resume
- Write new file
- Write overwrite with `lines_deleted=0` edge case
- Edit and MultiEdit
- PostToolUseFailure emits no edit
- Bash/PowerShell snapshot change
- formatter near Claude tool does not become duplicate
- hook input content never reaches serialized event/log
- legacy CLI fallback
- idempotent plugin upgrade
- native + transcript dedup regression

## Manual live matrix

1. Claude Write ไฟล์ใหม่ประมาณ 200 บรรทัด
2. Claude Edit ไฟล์เดิม
3. Claude Bash `sed` แก้ไฟล์
4. tool call ที่ fail
5. manual formatter หลัง AI edit
6. human typing ระหว่าง Claude session
7. offline broker และ replay

## Acceptance criteria

- พฤติกรรมที่ verified เดิมไม่ regression
- direct Write/Edit เป็น `ai_verified`
- shell edit ใช้ evidence ตาม policy ไม่ใช้ process proximity อย่างเดียว
- human typing ยังคง human
- native/transcript/edit sidecar เหลือ canonical activity เดียว
- ไม่มี prompt/source/command output ใน network, SQLite, ClickHouse หรือ logs
