# Phase 7 — Correlation and Cross-Transport Dedup

## เป้าหมาย

รวม native hook, transcript, editor, MCP, snapshot, filesystem และ process evidence
ก่อนสร้าง canonical heartbeat เพื่อให้ logical edit เดียวถูกนับครั้งเดียว

## Dependency

- ต้องรอ `planai2` Phase 6.1 canonical fingerprint ปิด
- review versioned fingerprint และ existing correlation engine ก่อนแก้
- ห้ามสร้าง fingerprint implementation ชุดที่สอง
- duration/actor migration gates ต้องผ่านก่อนและหลัง phase

## Evidence priority

เรียงจากตรงที่สุด:

```text
native successful file tool
native file event correlated with active tool
completed structured transcript tool
MCP/tool middleware event
before/after tool snapshot
filesystem event + active session evidence
process-only evidence
```

priority ใช้ตัดสิน confidence แต่ไม่อนุญาตให้ evidence ที่ต่ำกว่าลบ metadata ที่พิสูจน์แล้ว

## Confidence policy

| Confidence | เงื่อนไขขั้นต่ำ |
|---|---|
| `verified` | direct successful tool และ file mutation ที่ตรงกัน |
| `correlated` | completed tool/transcript จับคู่ file change ได้ |
| `inferred` | หลักฐานอ้อมหลายแหล่งตรงกัน |
| `unknown` | หลักฐานไม่พอหรือขัดกัน |

- process proximity อย่างเดียวไม่เกิน `unknown`
- filesystem + process โดยไม่มี tool/session proof ไม่เกิน `inferred`
- conflicting direct evidence ต้อง `unknown` หรือแยก lineage ไม่เลือกแบบเดา

## Canonical fingerprint

ต้อง transport-independent และ versioned โดยพิจารณา:

```text
workspace identity
normalized entity
change kind
bounded timestamp bucket
line delta/content fingerprint
session/tool identity when reliable
```

ห้ามใช้:

```text
transport
adapter name as the only discriminator
raw prompt/content/patch
retry attempt
local queue row ID
```

## Correlation windows

- native tool ↔ file event: short named window
- transcript recovery ↔ native tool: larger bounded window
- editor sidecar ↔ document change: existing editor-specific window
- session/process evidence: context-only window
- ทุก window ต้องมีชื่อ เหตุผล และ test
- ห้ามเฉลี่ย 5s/15s/120s เป็นค่ากลางเดียว

## Multi-file and repeated edits

- tool call หนึ่งครั้งหลายไฟล์ต้องได้ canonical activity ต่อไฟล์
- edit ซ้ำไฟล์เดิมใน tool call คนละครั้งต้องไม่ collapse หาก logical mutation ต่างกัน
- save/formatter หลัง AI editต้องไม่กลืนเข้า AI event หากไม่มี provenance
- rename/move ต้อง normalize source/destination ตาม change contract
- undo/redo ไม่สร้าง AI tool attribution ใหม่

## Line attribution

- verified/correlated AI lines เข้า AI counters
- human editor input คง Human
- paste ไม่มี direct provenance คง Unattributed
- formatter/build/git change คง Unknown หรือ system category ตาม schema เดิม
- AI event ใกล้ human typing ห้ามลบ positive human evidence
- line totals ต้องรักษา invariants เดิม

## Dedup layers

### Local inbox

- producer event ID ป้องกัน retry duplicate
- broker replay idempotent

### Correlation engine

- group evidence lineage เป็น canonical candidate
- เก็บ evidence IDs ที่ร่วมตัดสิน

### Backend

- canonical fingerprint ป้องกัน cross-device/process replay
- insert/reprocess path ใช้กฎเดียวกัน
- conflict diagnostic ไม่เผย raw payload

## Files expected to change

- `backend/api/crates/wakaclock-core/src/ai/canonical.rs`
- `backend/api/crates/wakaclock-core/src/ai/correlation_engine.rs`
- `backend/api/crates/wakaclock-core/src/ai/correlation.rs`
- `backend/api/crates/wakaclock-core/src/ai/state.rs`
- `backend/api/src/services/heartbeat.rs`
- editor sidecar correlation เฉพาะเมื่อ contract จำเป็น

เริ่มแก้ไฟล์เหล่านี้หลัง worktree ไม่มี concurrent Phase 6.1 edits เท่านั้น

## Tests

- native + transcript same edit collapses
- native + filesystem same edit collapses
- MCP + hook same edit collapses
- same file edited twice remains two activities
- multi-file one event per file
- timestamp boundary cases
- replay across restart
- conflicting client evidence becomes unknown
- human typing near AI remains human
- paste remains unattributed without direct evidence
- formatter/save/undo/redo regression
- backend live/reprocess parity

## Acceptance criteria

-หนึ่ง logical edit มีหนึ่ง canonical heartbeat
- native evidence ทำให้ confidence สูงขึ้นโดยไม่เพิ่ม totals
- transport failover ไม่ทำให้ event หาย
- `total_seconds`, daily totals และ Human counters ผ่าน baseline tolerance
- evidence conflict มองเห็นใน diagnostics และไม่ถูกแอบตัดสินเป็น Human/AI
