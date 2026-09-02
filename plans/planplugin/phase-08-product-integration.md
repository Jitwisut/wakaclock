# Phase 8 — Setup, Doctor, Backend and Frontend Integration

## เป้าหมาย

ทำให้ Universal AI Detection เป็น product feature ที่ติดตั้ง ตรวจสุขภาพ และตรวจผลได้
โดยผู้ใช้ไม่ต้องแก้ config ของแต่ละ agent ด้วยมือ

## CLI setup commands

เพิ่มหรือขยายคำสั่ง:

```bash
wakaclock ai setup --all
wakaclock ai setup codex
wakaclock ai setup claude-code
wakaclock ai setup kilo-code
wakaclock ai setup kimi-code-cli
wakaclock ai uninstall <adapter>
wakaclock ai status --json
wakaclock doctor ai --json
```

## Setup behavior

- detect installed clients และ versions
- เลือก install strategy จาก adapter manifest
- preview actions ก่อนแก้ user config หากมี material change
- install/upgrade แบบ idempotent
- preserve comments และ user-owned configuration
- trust/approval ที่ระบบบังคับต้องแสดง manual step
- rollback เฉพาะ managed changes เมื่อ install ล้ม
- uninstall ลบเฉพาะ AtoAxis-owned files/blocks
- `--all` ไม่ fail ทั้งหมดเพราะ agent หนึ่งติดตั้งไม่ได้

## Adapter status model

ต่อ adapter ต้องแสดง:

```text
detected
installed
enabled
trusted
client_version
plugin_version
contract_version
verification_status
last_native_event_at
last_transcript_event_at
transcript_lag_bytes
pending_events
retry_events
dead_letter_events
last_delivery_result
provider_id
model_id
diagnostics
```

status ต้องแยก “ติดตั้งแล้ว” จาก “กำลังส่ง event จริง”

## Doctor diagnostics

ตรวจอย่างน้อย:

- CLI path/version mismatch
- broker installed/running/version
- stale service/plugin/hook path
- adapter disabled/untrusted
- plugin load error
- unsupported client/schema version
- transcript cursor lag
- local inbox/retry/dead-letter
- outbound queue
- backend `401`, `402`, network, validation
- latest locally captured event versus latest delivered event
- privacy mode/config conflicts

ให้ diagnostic code ที่ frontend/CLI map เป็นข้อความได้โดยไม่ parse log text

## Backend changes

ตรวจ schema ปัจจุบันก่อนเพิ่ม field; ใช้ additive nullable/default-safe changes เท่านั้น

ข้อมูลที่ควรรองรับ:

- canonical `client_id`
- `provider_id`
- `model_id`
- `transport`
- `confidence`
- `producer_version`
- canonical event/fingerprint version
- verification/health summary แยกจาก activity rows หากเหมาะสม

กฎ:

- validate length/enum/version ก่อน insert
- unknown values ไม่ทำ RowBinary column order เหลื่อม
- live insert และ reprocess ใช้ model เดียวกัน
- replay-safe identity
- error 4xx ไม่เผย SQL หรือ internal payload
- old clients ยังส่ง heartbeat เดิมได้

## Frontend integration health

เพิ่มหน้า/section สำหรับ AI Integrations:

- Agent client
- Provider
- Model ล่าสุด
- Detection status
- Verification badge
- Transport
- Last captured
- Last delivered
- Queue/lag
- Setup/repair instruction

สถานะ UX:

| Status | ความหมาย |
|---|---|
| Healthy | native events และ delivery ทำงาน |
| Degraded | fallback ทำงาน แต่ native path มีปัญหา |
| Captured locally | backend/network มีปัญหาแต่ข้อมูลไม่หาย |
| Needs setup | client พบแต่ adapter ยังไม่ติดตั้ง |
| Needs trust | platform รอ user approval |
| Unsupported | client/schema ยังไม่รองรับ |
| Unverified | มี scaffold แต่ยังไม่มี live certification |

ห้ามใช้สี/label เดียวกันสำหรับ detection failure กับ backend delivery failure

## Activity presentation

- แสดง client/provider/model แยก column/filter
- tooltip อธิบาย confidence และ transport
- activity ที่ unknown ไม่ถูกซ่อน
- DeepSeek provider ใต้ Codex/Kilo ต้องแสดง host client ด้วย
- fixture/scaffold ห้ามมี verified badge
- empty state แยก “ไม่มี AI activity” จาก “integration ไม่ทำงาน”

## Files expected to change

- `backend/api/crates/wakaclock-cli/src/main.rs`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- `extensions/vscode/src/agentSetup.ts`
- `extensions/vscode/src/statusBar.ts`
- backend request/model/repository/service filesที่เกี่ยวข้อง
- `frontend/app/lib/wakaclock/types.ts`
- frontend dashboard/integration components

## Tests

- setup all partial success
- idempotent setup/upgrade/uninstall
- preserves user config/comments
- diagnostic codes and status aggregation
- legacy CLI/client compatibility
- backend serde/validation/reprocess parity
- frontend all health states
- DeepSeek host-client rendering
- captured-local versus delivered distinction
- responsive/accessibility/error/loading states

## Acceptance criteria

- ผู้ใช้ติดตั้ง supported adapters จากคำสั่งเดียว
- doctor ชี้จุดเสียได้โดยไม่เปิดหลาย log files
- frontend ไม่ตีความ zero events ว่า tracking healthy โดยอัตโนมัติ
- client/provider/model และ confidence/transport แสดงถูกต้อง
- old heartbeat contract ไม่เสีย
- setup/uninstall ไม่ทำลาย user-owned agent configuration

