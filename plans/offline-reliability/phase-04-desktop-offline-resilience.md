# Phase 04 — Desktop Offline-Safe Tracking and Local Snapshot

สถานะ: Planned  
ครอบคลุม: OFF-05, OFF-06  
ขึ้นกับ: Phase 01–03

## เป้าหมาย

ทำให้ Desktop app เก็บ foreground activity ต่อเนื่องโดยไม่รอ network และให้ dashboard
แสดง server-confirmed, local queued และ session-local values อย่างตรงไปตรงมาเมื่อ offline.

## Architecture ก่อน/หลัง

ก่อน:

```text
5s sampling loop
  → detect foreground/idle
  → await HTTP send (สูงสุด 30s)
  → sleep 5s
```

หลัง:

```text
sampling loop (5s, no network await)
  → detect foreground/idle
  → update local accounting
  → enqueue immutable delivery intent

delivery worker
  → construct/persist heartbeat
  → send or durable queue
  → update scoped delivery state

snapshot service
  → cached server-confirmed snapshot
  + live local queue intervals/count
  + current session counters
```

## Sampling loop changes

ไฟล์หลัก: `apps/desktop/src-tauri/src/engine.rs`

- แยก foreground sampling ออกจาก API request;
- loop tick ใช้ `tokio::time::interval` และกำหนด missed-tick behavior ชัดเจน;
- สร้าง immutable `DeliveryIntent` ที่มี activity identity/timestamp ณ ตอน sample;
- bounded channel: ห้าม unbounded memory growth;
- เมื่อ channel เต็ม ให้ coalesce ตาม canonical rules โดยไม่ทิ้ง write/app-switch boundary;
- durable queue write ต้องเกิดก่อนถือว่า intent ถูก handoff สำเร็จ;
- `last_heartbeat_at` แยกเป็น:
  - `last_captured_at`
  - `last_queued_at`
  - `last_delivered_at`
- network failure ห้ามเปลี่ยน tracker status จาก `Active` เป็น `Unavailable`;
- OS tracker error กับ server offline ต้องเป็นคนละ field/state.

## Desktop local snapshot

ไฟล์หลัก:

- `apps/desktop/src-tauri/src/lib.rs`
- `apps/desktop/src-tauri/src/models.rs`
- `apps/desktop/src-tauri/src/state.rs`
- `apps/desktop/src/types.ts`
- `apps/desktop/src/components/Overview.tsx`

เพิ่ม snapshot shape:

```json
{
  "connection_state": "offline",
  "confirmed_seconds": 1800,
  "queued_seconds": 75,
  "display_total_seconds": 1875,
  "queued_heartbeats": 5,
  "last_confirmed_at": 1789739000,
  "server_snapshot_stale": true,
  "session_seconds": 240
}
```

Semantics:

- `confirmed_seconds` มาจาก last successful server snapshot และมี timestamp;
- `queued_seconds` คำนวณจาก scoped local queue ด้วย interval union เดียวกับ CLI;
- `display_total_seconds` union confirmed intervals + queued intervals เมื่อมี interval
  evidence; ห้ามบวกแบบตรง ๆ ถ้ามีโอกาส overlap;
- ถ้าไม่มี cached confirmed snapshot ให้แสดง unknown/offline ไม่ใช่ confirmed zero;
- `heartbeat_count` แยก confirmed กับ queued count;
- Cloud card แสดง Offline/Degraded/Connected ตาม Phase 01;
- UI ห้ามใช้คำว่า “queue protected” โดยไม่มี count หากอ่าน queue ได้.

## Cached server snapshot

- cache เฉพาะ metadata/interval summary ที่จำเป็น;
- write atomically พร้อม `fetched_at`, timezone และ owner scope;
- invalidate เมื่อ account/origin เปลี่ยน;
- stale cache แสดง label ชัดเจน;
- cache ไม่ใช่ source of truth สำหรับ delivery และห้ามลบ queue;
- จำกัด retention/size.

## Delivery/recovery behavior

- delivery worker ใช้ shared queue/recovery contract จาก Phase 03;
- request timeout ไม่หยุด sampling;
- app switch ระหว่าง request ช้ายังสร้าง boundary ถูกต้อง;
- pause/private/idle transition ต้องหยุดสร้าง activity แต่ไม่ยกเลิก queued delivery;
- exit/hide window ไม่หยุด background tracker;
- quit ต้อง flush in-memory intents เข้า durable queue แบบ bounded ก่อนจบ.

## Tests

### Rust

- `sampling_ticks_continue_during_a_hanging_delivery`
- `app_switch_during_outage_keeps_both_boundaries`
- `network_failure_does_not_mark_native_tracker_unavailable`
- `shutdown_persists_every_in_memory_intent_before_exit`
- `offline_snapshot_reports_real_scoped_queue_depth`
- `offline_snapshot_unions_cached_confirmed_and_queued_intervals`
- `overlap_between_cached_and_queued_intervals_is_not_double_counted`
- `account_change_invalidates_cached_snapshot_without_deleting_queue`
- `idle_and_private_transitions_do_not_create_offline_time`

### React/UI

- `offline_card_shows_queue_count_and_duration`
- `unknown_confirmed_total_is_not_rendered_as_zero`
- `stale_confirmed_total_is_labelled`
- `tracker_error_and_cloud_offline_are_presented_separately`

## Acceptance scenarios

1. เปิด Desktop, coding 2 นาที, ปิด server 10 นาที, สลับแอปหลายครั้ง:
   - session accounting ยังเดินตาม sampling cadence;
   - queue มี boundaries ของทุก tracked app;
   - UI แสดง offline + queue จริง.
2. เปิด server กลับขณะผู้ใช้ idle:
   - recovery worker drain queue;
   - sampling ไม่ต้องสร้าง heartbeat ใหม่เพื่อกระตุ้น flush;
   - UI เปลี่ยน connected เมื่อ probe สำเร็จ.
3. suspend/resume:
   - elapsed gap ถูก cap ตาม invariant เดิม;
   - ไม่สร้างเวลาช่วง suspend.

## ความเสี่ยง

- แยก worker อาจเปลี่ยน ordering: ต้อง preserve timestamp และ transport identity;
- coalescing ผิดอาจทำ app-switch boundary หาย;
- cached readback อาจ double-count queue overlap;
- shutdown flush ที่รอนานเกินไปทำให้ app ปิดไม่ได้;
- Desktop Rust lockfile อาจเปลี่ยนจาก dependency resolution โดยไม่เกี่ยวกับ logic:
  ใช้ `--locked/--offline` ตามความเหมาะสมและ review diff แยก.

## Rollout

- feature flag `desktop_async_delivery_v1` สำหรับเปรียบเทียบ shadow counters;
- ช่วงแรกเก็บ cadence/queue counters เท่านั้น ไม่เก็บ app/entity เพิ่ม;
- เปิดให้ internal build ก่อน;
- ตรวจ queue growth, missed samples, duplicate acceptance และ crash recovery;
- เปิด default หลัง E2E certification ใน Phase 05.

## Rollback

- ปิด async worker flag และกลับ delivery trigger เดิมได้;
- queue/schema ใหม่ต้องยังอ่านได้;
- ห้าม rollback ด้วยการลบ cached/queued data;
- หาก display union มีปัญหา ให้แสดง confirmed และ queued แยกโดยไม่คำนวณ total.

## Gates

```bash
cd apps/desktop
npm ci
npm run typecheck
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked

cd backend/api
cargo test -p wakaclock-core --lib
python3 scripts/duration-audit/golden.py
```

