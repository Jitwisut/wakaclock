# Phase 0 — Runtime Readiness and Baseline

## เป้าหมาย

ทำให้ pipeline ที่มีอยู่ทำงานจริงและตรวจสอบได้ ก่อนเพิ่ม producer/plugin ใหม่
เพื่อไม่ให้ adapter ใหม่ถูกวัดบน broker, CLI หรือ service ที่ยังใช้คนละ version

## ขอบเขต

- ปิด dependency จาก `planai2` Phase 6.1
- ทำ CLI และ service identity ให้เป็นหนึ่งเดียว
- ทำ broker และ transcript scanner ให้พร้อม
- สร้าง baseline สำหรับ Codex และ Claude Code
- ไม่เพิ่ม Kilo/Kimi/DeepSeek adapter ใน phase นี้

## งานที่ต้องทำ

### 0.1 ปิด canonical fingerprint dependency

- รอ session ที่กำลังแก้ `ai/canonical.rs` ทำงานเสร็จ
- review contract และ version prefix ที่ได้
- ยืนยันว่า fingerprint ไม่ใช้ producer/transport เป็น input
- ยืนยันว่า timestamp มี bounded window ตาม design เดิม
- รัน correlation และ duration gates
- ห้าม overwrite `canonical.rs` หรือ `ai/mod.rs` ที่มี uncommitted work

### 0.2 Single CLI identity

- ตรวจ CLI จาก shell `PATH`
- ตรวจ managed CLI ของ VS Code
- ตรวจ path ที่ launchd/systemd/Windows service ใช้
- ตรวจ path ที่ Claude/Codex hook scripts ใช้
- เพิ่ม version, commit SHA และ executable path ใน status output หากยังไม่ครบ
- แจ้ง mismatch อย่างชัดเจนแทนการเลือก binary แบบเงียบ ๆ

### 0.3 Broker lifecycle

- ทำ install/start/upgrade แบบ idempotent
- ใช้ singleton lock ป้องกัน broker หลาย process
- service manifest ต้องชี้ไป stable managed path
- update CLI แล้ว service ต้องไม่ชี้ไป binary เก่า
- broker restart ต้อง resume inbox และ retry state เดิม
- extension-owned broker ใช้เป็น fallback ได้เมื่อ user service unavailable

### 0.4 Codex transcript recovery

- scanner autostart เมื่อ broker พร้อม
- resume จาก cursor ที่บันทึกไว้
- รองรับ transcript ที่โตขึ้นและ log rotation
- expose `file_size`, `cursor_offset`, `lag_bytes`
- expose `last_scan_at`, `last_event_at`, parser diagnostic
- parser ของ agent หนึ่ง fail แล้ว agent อื่นยังทำงานต่อ

### 0.5 Baseline capture

ทำ controlled run ก่อนเปลี่ยน plugin:

1. Claude Code `Write` หนึ่งไฟล์
2. Claude Code `Edit` หนึ่งไฟล์
3. Codex `apply_patch` หนึ่งไฟล์
4. Codex `apply_patch` หลายไฟล์
5. human typing ใน VS Code
6. human `sed` ใน terminal

บันทึกเฉพาะ:

- event count
- file metadata
- actor/confidence/source
- broker queue state
- heartbeat IDs
- backend totals

ห้ามบันทึก prompt หรือ patch body ใน certification artifact

## Files expected to change

- `backend/api/crates/wakaclock-cli/src/main.rs`
- `backend/api/crates/wakaclock-cli/src/agent_service.rs`
- `backend/api/crates/wakaclock-cli/src/broker.rs`
- `extensions/vscode/src/managedCli.ts`
- `extensions/vscode/src/agentSetup.ts`
- service installer filesที่เกี่ยวข้อง
- `backend/api/crates/wakaclock-core/src/ai/VERIFICATION.md`

หลีกเลี่ยงการแก้ `canonical.rs` จนกว่า work เดิมจะปิด

## Tests

- CLI path/version mismatch
- stale service manifest detection
- idempotent broker install/start
- singleton broker lock
- restart resumes inbox
- scanner resumes cursor
- growing transcript follow
- one parser failure does not stop other adapters
- unsupported schema produces diagnostic

## Acceptance criteria

- `wakaclock doctor ai --json` ระบุ binary และ service version เดียวกัน
- broker แสดง `installed=true` และ `running=true`
- Codex transcript lag กลับเป็นศูนย์หรืออยู่ใน bounded active-file window
- Claude และ Codex baseline event ไปถึง local broker
- backend offline หรือ 402 แล้ว local capture ยังไม่หาย
- baseline human counters และ `total_seconds` ถูกบันทึกเพื่อใช้เปรียบเทียบ phase หลัง

## Exit gate

Phase นี้ปิดได้เมื่อ runtime ไม่เหลือ stale binary/path และ Codex edit หนึ่งครั้ง
สามารถผ่าน pipeline ปัจจุบันได้โดยไม่ต้องสั่ง sync ด้วยมือ

