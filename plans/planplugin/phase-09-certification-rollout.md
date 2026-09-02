# Phase 9 — Certification, Rollout and Final Acceptance

## เป้าหมาย

พิสูจน์ระบบกับเครื่องมือจริง วางลำดับ deployment ที่ rollback ได้ และไม่เลื่อน
adapter เป็น Verified จาก fixture หรือ synthetic process

## Certification artifact

สร้าง metadata-only artifact ต่อ adapter เช่น:

```text
certifications/ai-adapters/<client>/<date>.json
```

บันทึกได้เฉพาะ:

- client/provider/model IDs
- client/plugin/CLI versions
- contract/fingerprint versions
- test scenario IDs
- event counts
- canonical counts
- duplicate counts
- delivery results
- timestamps/timezone
- commit SHA
- pass/fail และ tolerance

ห้ามบันทึก path จริง, username, prompt, source, patch, command หรือ token

## Verification levels

| Status | เงื่อนไข |
|---|---|
| `unverified` | มี manifest แต่ยังไม่มี payload ที่ยืนยัน |
| `scaffold` | มี implementation/fixture แต่ยังไม่รันกับ client จริง |
| `verified` | ผ่าน live client → broker → backend verification |

- verification ผูกกับ compatible client/plugin schema range
- schema ที่ไม่รู้จักต้องลด effective status
- certification หมดอายุตาม policy เมื่อ client major version เปลี่ยน
- UI และ doctor แสดงสถานะเดียวกับ registry

## Automated matrix

### Shared producer

- contract serde และ legacy compatibility
- privacy allowlist
- offline/retry/replay
- event ID stability
- multi-file behavior
- malformed/oversized payload

### Correlation

- cross-transport dedup
- conflicting evidence
- human typing near AI
- paste/formatter/save/undo/redo
- live/reprocess parity

### Product

- setup/upgrade/uninstall
- doctor diagnostics
- backend validation
- frontend health states

## Live adapter matrix

### Codex

- direct apply patch one file
- multi-file patch
- shell edit
- failed tool
- native + transcript duplicate
- DeepSeek provider under Codex

### Claude Code

- Write/Edit/MultiEdit
- shell edit
- failed tool
- human typing during session
- transcript fallback

### Kilo Code

- CLI and VS Code runtime
- native file tool
- shell edit
- Kimi provider
- DeepSeek provider
- model switch

### Kimi Code CLI

- WriteFile/StrReplaceFile
- shell edit
- failed tool
- resume session
- transcript recovery if supported

### DeepSeek

- provider under Codex/Kilo/Claude
- API call without edit creates no file attribution
- browser copy/paste remains external/unknown
- standalone client only when real adapter is available

## End-to-end failure matrix

- broker stopped before tool call
- broker restarts during active session
- backend offline
- backend `401`
- backend `402`
- backend validation rejection
- stale CLI/service binary
- plugin disabled/untrusted
- unsupported payload schema
- transcript rotation/cursor lag
- local queue replayed twice

ทุกเคสต้องแยก `captured`, `correlated`, `queued`, `delivered` ได้

## Rollout order

1. Backend additive contract and validation
2. Updated CLI/Broker and Universal Producer SDK
3. Doctor/setup commands
4. Claude migration canary
5. Codex native plugin canary
6. Kilo plugin canary
7. Kimi hook canary
8. DeepSeek identity mapping
9. Frontend integration health
10. General availability หลัง certification ผ่าน

ห้ามปล่อย producer ที่ส่ง field ใหม่ก่อน backend รองรับ

## Canary policy

- เริ่ม adapter ใหม่ใน shadow mode
- เปรียบเทียบ native กับ transcript/filesystem baseline
- shadow event ไม่เปลี่ยน production totals จน dedup ผ่าน
- monitor duplicate rate, queue lag และ validation failures
- rollout เป็นเปอร์เซ็นต์หรือ opt-in ก่อน default-on
- kill switch ต่อ adapter โดยไม่ปิด core heartbeat

## Rollback

- disable adapter ผ่าน manifest/remote capability โดยไม่ถอน core CLI
- plugin version pin/rollback
- preserve local queue ระหว่าง rollback
- backend ต้องรับ payload รุ่นก่อนหน้า
- schema migration additive และไม่ต้องลบข้อมูล
- UI แสดง degraded/fallback แทนหายเงียบ

## Global gates

```bash
cd backend/api
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

cd extensions/vscode
npm test

cd frontend/app
npm run validate

git diff --check
```

รัน duration/actor/certification audits ทั้งหมด และ ignored integration tests
แบบ single-thread เมื่อ environment พร้อม

## Final acceptance

- Codex, Claude Code, Kilo Code และ Kimi Code CLI มี live certification
- DeepSeek identity ถูกต้องภายใต้ host client ที่ทดสอบจริง
-หนึ่ง logical edit มีหนึ่ง canonical backend activity
- offline/replay ไม่เพิ่ม totals ซ้ำ
- failed tools ไม่สร้าง verified edits
- Human/Unattributed counters ไม่ถูกกลืนเป็น AI
- `total_seconds` และ daily totals อยู่ใน tolerance เดิม
- doctor ระบุ failure layer ได้ครบ
- frontend แสดง detection และ delivery health แยกกัน
- privacy audit ผ่านทุก local/network/storage boundary
- adapter ที่ยังไม่ได้ live verify คง `scaffold`/`unverified` และระบุ blocker ชัดเจน

## Completion record

เมื่อปิดแผน ให้เพิ่ม summary ใน `VERIFICATION.md` พร้อม:

- adapter versions
- certification paths
- exact automated/manual scenarios
- known limitations
- unsupported clients/schema versions
- date และ commit SHA ของ final acceptance

