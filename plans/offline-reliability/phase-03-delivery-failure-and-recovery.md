# Phase 03 — Scoped Delivery Failure and Recovery Lifecycle

สถานะ: Implemented (Desktop ส่วนของ Phase นี้เลื่อนไป Phase 04)  
ครอบคลุม: OFF-04 และ backlog ที่ไม่ drain หลัง network recovery  
ขึ้นกับ: Phase 01–02

## เป้าหมาย

แทนที่ไฟล์ global `last-delivery-failure.json` ด้วย state ที่ผูกกับ normalized origin และ
verified queue owner พร้อม lifecycle ที่ชัดเจน เพื่อไม่ให้ failure จาก account/server เก่า
ไปเปลี่ยน UI ของ scope ใหม่ และให้ backlog เริ่ม drain เมื่อ network กลับมาแม้ไม่มี editor
activity ใหม่.

## Failure record v2

โครงสร้างขั้นต่ำ:

```json
{
  "schema_version": 2,
  "origin": "https://api.atoaxis.com",
  "owner_scope": "owner-v2:...",
  "kind": "network",
  "http_status": null,
  "recorded_at": 1789740000,
  "last_attempt_at": 1789740000,
  "next_retry_at": 1789740060,
  "consecutive_failures": 1,
  "message_code": "connect_failed"
}
```

หลักการ:

- free-form message ใช้เฉพาะ local diagnostics และต้อง bounded/sanitized;
- UI ใช้ `kind`, `http_status`, `message_code`;
- lookup ต้องระบุ queue scope เสมอ;
- success ของ scope A ห้ามล้าง failure ของ scope B;
- successful authenticated probe ล้าง stale network/server failure ได้ แต่ไม่ล้าง 401/402
  โดยไม่มีหลักฐานว่า credential/entitlement กลับมาปกติ;
- successful heartbeat/fully drained eligible batch ล้าง delivery failure ของ scope นั้น;
- record ต้องเขียน atomically.

## Storage choice

แนะนำให้เก็บใน SQLite `queue.db` แทนไฟล์ JSON แยก เพื่อให้ queue row, retry state และ
failure state อยู่ใน transaction boundary เดียวกัน:

```sql
CREATE TABLE delivery_state (
  destination TEXT NOT NULL,
  owner_scope TEXT NOT NULL,
  kind TEXT NOT NULL,
  http_status INTEGER,
  message_code TEXT NOT NULL,
  sanitized_detail TEXT,
  recorded_at INTEGER NOT NULL,
  last_attempt_at INTEGER NOT NULL,
  next_retry_at INTEGER NOT NULL,
  consecutive_failures INTEGER NOT NULL,
  PRIMARY KEY (destination, owner_scope)
);
```

Legacy JSON migration:

- อ่านครั้งเดียว;
- ถ้าระบุ scope ไม่ได้ ให้ย้ายเป็น `legacy_unscoped` diagnostic เท่านั้น;
- ห้ามใช้ legacy unscoped record ตัดสิน status bar;
- ลบไฟล์เดิมหลัง persist/migration สำเร็จเท่านั้น.

## Recovery worker

เพิ่ม bounded queue drain loop ที่แยกจากการสร้าง heartbeat:

- run เมื่อ client/broker/desktop process ทำงาน;
- wake เมื่อมี row ใหม่, network state เปลี่ยน, manual refresh หรือ retry deadline ถึง;
- claim ตาม lease เดิมและ scope ปัจจุบัน;
- batch ไม่เกิน `FLUSH_BATCH_SIZE`;
- retry backoff + jitter แบบ bounded;
- respect `Retry-After`;
- หยุดเมื่อพบ credential/permanent error ตาม typed policy;
- ไม่ต้องรอ editor activity ใหม่;
- shutdown ต้อง release lease หรือปล่อยให้ lease expire;
- process หลายตัวใช้ SQLite lease ป้องกันส่งซ้ำ.

## ไฟล์ที่คาดว่าจะเปลี่ยน

- `backend/api/crates/wakaclock-core/src/queue.rs`
  - delivery state table, scoped APIs, migration;
- `backend/api/crates/wakaclock-core/src/api_client.rs`
  - record/clear failure ผ่าน queue storage;
- `backend/api/crates/wakaclock-cli/src/broker.rs`
  - bounded recovery tick;
- `backend/api/crates/wakaclock-cli/src/main.rs`
  - `today`, `status`, `doctor` อ่าน scoped state;
- `apps/desktop/src-tauri/src/engine.rs`
  - start/wake recovery worker หรือใช้ shared runner;
- `extensions/vscode/src/statusBar.ts`
  - render structured scoped state จาก Phase 01.

## Retry policy table

| Kind | Queue action | UI | Clear condition |
|---|---|---|---|
| network | retry/backoff | Offline, queued locally | successful probe/send |
| 408/429/5xx | retry/Retry-After | Service degraded | successful send/probe |
| 401/403 | retain, pause | Key rejected | verified credential + send |
| 402 | retain, pause | Subscription required | entitlement probe/send succeeds |
| 400/422 | dead-letter | Validation error | row recovery/manual repair |
| protocol | retry bounded | Client/server incompatible | compatible response |

ต้องยืนยันว่า policy นี้ตรงกับ ingest contract ปัจจุบันก่อน implement; ห้ามเปลี่ยน
permanent/retryable classification แฝงใน refactor.

## Tests

- `failure_state_is_isolated_by_origin_and_owner`
- `legacy_unscoped_failure_never_drives_user_facing_state`
- `successful_probe_clears_only_matching_network_failure`
- `successful_send_clears_matching_credential_failure`
- `offline_backlog_drains_after_recovery_without_new_activity`
- `two_recovery_workers_do_not_deliver_the_same_lease`
- `retry_after_is_respected`
- `shutdown_and_restart_reclaim_expired_lease`
- `permanent_validation_error_moves_to_recoverable_dead_letter`
- `recovery_never_changes_heartbeat_payload_or_timestamp`

## Acceptance criteria

- เปลี่ยน account/server แล้วไม่เห็น failure เก่าของ scope ก่อนหน้า;
- network กลับมาแล้ว backlog เริ่ม drain ภายใน bounded retry interval แม้ผู้ใช้ idle;
- queue depth ลดลงตาม accepted rows เท่านั้น;
- ไม่มี tight retry loop ขณะ server ดับ;
- restart ระหว่าง flush ไม่ทำ row หายหรือส่ง canonical duplicate;
- `status` และ `doctor` แสดง current scope กับ orphaned/legacy counts แยกกัน.

## Observability

เก็บเฉพาะ counters/codes:

- scoped queue depth;
- eligible, leased, delayed, dead-letter counts;
- oldest queued age;
- last success/failure kind;
- retry attempts และ next retry time;
- orphaned legacy scope count.

ห้าม log payload, entity path, API key หรือ raw response body ที่อาจมีข้อมูลเกินจำเป็น.

## Rollback

- feature flag ปิด background recovery ได้ แต่ manual/new-heartbeat flush ยังทำงาน;
- delivery-state table เป็น additive;
- rollback reader ต้อง ignore table ใหม่โดยไม่ลบ;
- legacy JSON ห้ามลบจน migration transaction สำเร็จและมี migration marker.

## Gates

```bash
cd backend/api
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace
cargo test -p wakaclock-cli --test broker_process

python3 scripts/duration-audit/golden.py
python3 scripts/duration-audit/verify_port.py
```


## Implementation notes (2026-09-20)

- `queue.rs`: ตาราง `delivery_state` (PK = destination + owner_scope) เก็บ `kind`,
  `http_status`, `message_code`, `sanitized_detail` (bounded 512 ตัวอักษร),
  `recorded_at`, `last_attempt_at`, `consecutive_failures`. `consecutive_failures`
  นับต่อเมื่อ kind เดิมซ้ำ และรีเซ็ตเมื่อ kind เปลี่ยน.
- `clear_delivery_failure(scope, kinds)` รับ list ของ kind ที่อนุญาตให้ล้าง:
  probe ที่สำเร็จล้างได้เฉพาะ `network`/`server_error`; `auth_401`/`payment_402`
  ต้องส่งสำเร็จจริงจึงล้าง.
- Migration: ไฟล์ `~/.wakaclock/last-delivery-failure.json` ถูกอ่านครั้งเดียวและเก็บลง
  scope `legacy_unscoped` (ไม่ตรงกับ origin/owner จริงใด ๆ จึงไม่ถูกใช้ตัดสินสถานะ)
  แล้วลบไฟล์ต่อเมื่อ persist สำเร็จ. `http_status` ของ record เก่าเป็น unknown
  เพราะ binary เดิมไม่ได้บันทึกไว้.
- `push_scoped_after()` ทำให้ `Retry-After` มีผลตั้งแต่ครั้งแรกที่ queue (บั๊กที่พบใน
  Phase 00); backoff เดิม 60s→3600s ไม่เปลี่ยน.
- `eligible_len_scoped()` แยก "ค้างเพราะรอ backoff" ออกจาก "ค้างเพราะส่งไม่ได้";
  `today --json` มี `queue.eligible_now` แล้ว (ค้างมาจาก Phase 01).
- CLI: `today`/`doctor` อ่าน state ตาม scope. `delivery_failure` ใน JSON เพิ่ม
  `http_status`, `message_code`, `consecutive_failures` และเปลี่ยนชื่อ kind เป็น
  `category` (ชื่อเดียวกับที่ `doctor ai` ใช้อยู่เดิม).
- `broker.rs`: ไม่ต้องเขียน recovery worker ใหม่ — loop เดิมเรียก `flush_queue` ทุก tick
  และ `claim_batch_scoped` เคารพ `next_retry_at` กับ lease อยู่แล้ว จึง drain เองได้โดยไม่ต้อง
  มี activity ใหม่ (มีเทสต์ยืนยัน). เปลี่ยนเฉพาะ log ให้บอก `kind` ของ scope ปัจจุบัน.
- VS Code: `cli.ts` อ่าน `category` (fallback เป็น `kind` สำหรับ CLI รุ่นเก่า) เพื่อไม่ให้
  tooltip เรียก network failure ว่า REFUSED.
- **ไม่ใส่ jitter** ใน backoff: queue เป็นของเครื่องเดียวและมี lease กันส่งซ้ำอยู่แล้ว
  jitter จะทำให้เทสต์ไม่ deterministic โดยไม่ได้ลดภาระ server จริง.

เลื่อนไป Phase 04: การปลุก recovery worker ใน `apps/desktop/src-tauri/src/engine.rs`
(ไฟล์เดียวกับที่ Phase 04 ต้องแยก seam อยู่แล้ว).
