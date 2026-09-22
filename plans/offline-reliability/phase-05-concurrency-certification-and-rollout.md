# Phase 05 — Single-Flight Concurrency, End-to-End Certification and Rollout

สถานะ: Implemented (C7 soak, Windows, feature flags และ metrics เลื่อนตามที่อนุมัติ)  
ครอบคลุม: OFF-07 และ final validation ของ OFF-01 ถึง OFF-06  
ขึ้นกับ: Phase 00–04

## เป้าหมาย

ป้องกัน refresh/probe ซ้อนกัน, ป้องกัน stale response เขียนทับ state ใหม่ และ certify
offline lifecycle ตั้งแต่ capture ถึง server readback ก่อนเปิด behavior ใหม่เป็น default.

## Single-flight contract

แต่ละ surface มีได้สูงสุด:

- 1 in-flight refresh/probe;
- 1 pending rerun flag หากมี trigger เพิ่มระหว่าง in-flight;
- หลังงานจบ รันซ้ำได้หนึ่งครั้งด้วย config/key/timezone ล่าสุด;
- response ต้องมี local generation และ apply ได้เมื่อ generation ยัง current;
- dispose/shutdown ต้อง cancel timer และ ignore late result;
- manual refresh ใช้ coordinator เดียวกับ interval refresh;
- error ต้องไม่ทำ single-flight lock ค้าง.

ห้ามแก้ด้วย debounce อย่างเดียว เพราะ request อาจนานกว่า debounce window.

## VS Code changes

ไฟล์หลัก:

- `extensions/vscode/src/statusBar.ts`
- `extensions/vscode/src/extension.ts`
- `extensions/vscode/src/commands.ts`
- อาจเพิ่ม `extensions/vscode/src/singleFlight.ts`

งาน:

1. รวม `start()` timer, `handleHeartbeatSent()`, `handleActivity()` และ manual refresh
   ผ่าน coordinator;
2. activity repaint ที่ใช้ local snapshot ทำได้ทันทีโดยไม่ spawn CLI ใหม่;
3. network refresh ขณะมีงานอยู่ให้ mark rerun ไม่ spawn process ซ้ำ;
4. config/key change เพิ่ม generation และยกเลิกผลลัพธ์ scope เก่า;
5. activation `initializeConnection()` ต้องมีหนึ่ง retry loop ต่อ extension context;
6. การเรียก `retryPendingVerification()` ซ้ำจาก command ห้ามสร้าง loop เพิ่ม;
7. dispose ต้องหยุด timers/retry waits และ child processes ที่ extension เป็นเจ้าของ.

## Desktop changes

ไฟล์หลัก:

- `apps/desktop/src/App.tsx`
- `apps/desktop/src/lib/tauri.ts`
- `apps/desktop/src-tauri/src/lib.rs`

งาน:

1. เปลี่ยน `setInterval(async refresh)` เป็น single-flight scheduler;
2. initial load กับ periodic refresh ใช้ coordinator เดียวกัน;
3. manual Refresh ระหว่าง in-flight mark rerun;
4. response จาก owner/timezone generation เก่าห้าม replace snapshot ใหม่;
5. component unmount ไม่ `setState` จาก late promise;
6. backend Tauri command ใช้ cached/local snapshot service และไม่สร้าง HTTP client/request
   ซ้ำถ้ามี probe in-flight;
7. UI แยก `loading initial`, `refreshing`, `offline`, `stale`.

## Timeout and cancellation policy

- HTTP connect timeout และ total timeout แยกกัน;
- UI refresh timeout สั้นกว่า delivery timeout ได้ แต่ต้องไม่ cancel durable delivery;
- child CLI timeout ต้อง terminate process และ reap child;
- cancellation เป็น local presentation concern ห้าม mark queued row ว่าส่งล้มเหลวซ้ำ;
- retry worker จาก Phase 03 เป็นเจ้าของ delivery retry เพียงตัวเดียว.

## Concurrency tests

- `ten_refresh_triggers_spawn_one_cli_and_one_follow_up`
- `activity_repaint_does_not_spawn_a_network_refresh_when_snapshot_exists`
- `late_offline_response_cannot_replace_a_newer_online_snapshot`
- `key_change_invalidates_in_flight_old_scope_result`
- `multiple_pending_verification_requests_share_one_retry_loop`
- `desktop_interval_and_manual_refresh_share_one_in_flight_request`
- `dispose_ignores_late_results_and_clears_timers`
- `single_flight_unlocks_after_error`

## End-to-end certification campaign

รันใน isolated home/profile และ disposable server database:

### C1 — Cold start while server is down

1. queue ว่าง;
2. เปิด VS Code/Desktop;
3. expected: offline ภายในหนึ่ง refresh, ไม่มี subscription/key warning;
4. process/request concurrency ไม่เกินหนึ่งต่อ surface.

### C2 — Capture and restart offline

1. coding/app activity หลายไฟล์/หลายแอป;
2. ปิด client แล้วเปิดใหม่โดย server ยังดับ;
3. expected: queue rows/seconds/identity เท่าเดิม, UI อ่าน count ได้;
4. ไม่มี row หายจาก shutdown.

### C3 — Recovery while idle

1. สร้าง backlog แล้วหยุด activity;
2. เปิด server;
3. expected: background recovery drain โดยไม่ต้องสร้าง heartbeat ใหม่;
4. server accepted count เท่าจำนวน unique queue rows;
5. local queue เหลือศูนย์และ state online.

### C4 — Error classification

สลับ mock responses 401, 402, 429, 503, timeout และ success พร้อมตรวจ UI/action/retry
ตรง policy table ทุกกรณี.

### C5 — Same-account key rotation

1. queue ด้วย key A;
2. rotate เป็น key B ของ account เดิม;
3. verify owner proof, transactional rebind, drain;
4. expected: data ครบ, ไม่ duplicate, queue zero.

### C6 — Cross-account and cross-origin isolation

key/account/origin ใหม่ต้องเห็นเฉพาะ diagnostics ว่ามี orphaned rows แต่ claim หรือส่ง
payload เดิมไม่ได้.

### C7 — Slow/hanging network soak

30–60 นาทีด้วย latency/timeout injection:

- Desktop sample count เทียบ fake/independent activity oracle;
- VS Code/desktop concurrent request high-water mark;
- memory/process count;
- queue growth/backoff;
- recovery duration หลัง network กลับมา.

## Data-integrity assertions

ทุก campaign ต้องเก็บ before/after metadata:

- ordered `(heartbeat_id, session_id, entity_hash, revision, timestamp)`;
- queue row count, dead-letter count, retry count;
- accepted server identities;
- canonical interval count และ total seconds;
- duplicate acceptance count;
- scoped failure state.

ใช้ entity hash ใน artifact และห้ามบันทึก source path ดิบ.

## Required gates

```bash
cd backend/api
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py
python3 scripts/duration-audit/verify_actor_migration.py
python3 scripts/duration-audit/verify_certification.py

cd extensions/vscode
npm ci
npm run lint
npm test
npm run compile

cd apps/desktop
npm ci
npm run typecheck
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

ผล duration gate ต้องคง `total_error: 0.0`. Compile ผ่านอย่างเดียวไม่ถือว่า certify.

## Rollout stages

1. **Shadow/internal** — structured status + counters, recovery worker ปิด auto-send;
2. **Canary** — เปิด single-flight และ scoped failure state;
3. **Queue owner v2 observe** — เขียน owner v2/migration diagnostics แต่ไม่ auto-rebind;
4. **Same-owner rebind canary** — เปิดเฉพาะ certified builds;
5. **Desktop async delivery canary**;
6. **General availability** หลัง soak/certification ผ่าน.

Feature flags ควรแยก:

- `structured_offline_status_v1`
- `queue_owner_v2`
- `queue_same_owner_rebind_v1`
- `background_queue_recovery_v1`
- `desktop_async_delivery_v1`

## Metrics และ alerts

metadata-only metrics:

- queue depth/oldest age histogram;
- orphaned scope count;
- delivery result by typed kind;
- retry interval and attempt count;
- duplicate/rejected acceptance count;
- refresh concurrency high-water mark;
- desktop sampling drift;
- recovery time after first successful probe.

Alert เมื่อ:

- queue age โตต่อหลัง server healthy;
- same-owner rebind failure > 0;
- cross-owner claim attempt > 0;
- duplicate acceptance เพิ่มจาก baseline;
- sampling drift เกิน threshold;
- in-flight refresh มากกว่า 1.

## Final acceptance criteria

- OFF-01 ถึง OFF-07 ปิดด้วย named regression tests;
- campaign C1–C7 ผ่านบน macOS และ Windows สำหรับ Desktop และ supported VS Code targets;
- restart/replay เพิ่ม canonical duration เป็นศูนย์;
- account/origin isolation ผ่าน negative tests;
- ไม่มี queue deletion/migration ที่ย้อนกลับไม่ได้;
- docs/support playbook อธิบาย offline, queued, rejected, subscription และ recovery
  เป็นคนละสถานะ;
- rollback rehearsal ผ่านโดย queue/data ยังอยู่ครบ.

## Rollback plan

ลำดับ rollback ที่ปลอดภัย:

1. ปิด auto-rebind;
2. ปิด background recovery;
3. ปิด Desktop async delivery แต่ยัง persist queue;
4. คง structured status fields และ schema additive ไว้;
5. หาก UI regression ให้แสดง raw typed state แบบ conservative (`offline/unknown`)
   แทนการเดาว่า online;
6. ห้าม downgrade schema ด้วย destructive migration หรือ delete orphaned rows.

## Completion record template

เมื่อจบ Phase ให้บันทึก:

```text
Commit/PR:
Files changed:
Behavior before:
Behavior after:
Tests added:
Gates run:
Certification artifacts:
Duration result:
Remaining risks:
Rollback rehearsal:
```

## Completion record (2026-09-21)

```text
Commit/PR:        branch feat/offline-phase05-single-flight (ยังไม่ merge ตอนบันทึก)
Files changed:    extensions/vscode/src/{singleFlight.ts (ใหม่),statusBar.ts,extension.ts,commands.ts}
                  extensions/vscode/test/{singleFlight.test.ts (ใหม่),offlineStatus.test.ts}
                  apps/desktop/src/{App.tsx,App.test.tsx}
                  backend/api/crates/wakaclock-cli/tests/offline_lifecycle.rs
Behavior before:  ทุก trigger (timer, heartbeat sent, manual refresh, activity repaint)
                  spawn CLI process ใหม่ แม้ตัวก่อนยังค้าง; Desktop ยิง
                  dashboard_snapshot ทุก 5 วินาทีโดยไม่สน request ที่ค้างอยู่;
                  initializeConnection และ retryPendingVerification สร้าง retry loop
                  ใหม่ทุกครั้งที่ถูกเรียก; ผลลัพธ์ของ key/server เก่าที่มาช้าเขียนทับ
                  state ปัจจุบันได้
Behavior after:   หนึ่ง surface มี in-flight ได้ 1 งาน + queued rerun ได้ 1 ครั้ง;
                  repaint จาก snapshot เดิมไม่เรียก CLI; generation ตัดผลลัพธ์ของ scope
                  เก่าทิ้ง; dispose หยุด timer และทิ้งผลที่มาช้า; error ปลด lock เสมอ
Tests added:      VS Code 8 ตัว (ten_refresh_triggers_spawn_one_cli_and_one_follow_up,
                  single_flight_unlocks_after_error, key_change_invalidates_in_flight_old_scope_result,
                  multiple_pending_verification_requests_share_one_retry_loop,
                  dispose_ignores_late_results_and_clears_timers,
                  activity_repaint_does_not_spawn_a_network_refresh_when_snapshot_exists,
                  late_offline_response_cannot_replace_a_newer_online_snapshot,
                  status_bar_refresh_is_single_flight);
                  Desktop 1 ตัว (desktop_interval_and_manual_refresh_share_one_in_flight_request);
                  certification C1–C6 6 ตัวใน offline_lifecycle.rs;
                  เปิดใช้เทสต์ baseline OFF-07 ที่ค้างจาก Phase 00 ทั้ง 2 ตัว
Gates run:        cargo fmt --check (สะอาด); cargo clippy --workspace --all-targets
                  (สะอาด ยกเว้น 3 lint ที่แดงอยู่ก่อนแล้วบน main); cargo test --workspace;
                  verify_port / golden / verify_actor_migration / verify_certification;
                  VS Code lint+test(162)+compile; Desktop typecheck+test(9)+build+
                  cargo test --locked(22)+clippy
Certification:    backend/api/target/offline-certification/c{1..6}*.json (metadata-only:
                  counts, states, hashed destinations — ไม่มี path ดิบ, key หรือ payload)
Duration result:  total_error: 0.0 (golden), verify_certification ผ่าน
Remaining risks:  C7 soak 30–60 นาที และการรันบน Windows ยังไม่ได้ทำ;
                  feature flags/metrics ยังไม่มีระบบรองรับใน repo;
                  broker_process (เทสต์เดิม) timeout ที่ 5 วินาทีจึง fail เมื่อเครื่อง
                  โหลดหนัก — ผ่าน 7/7 เมื่อรันตอนว่าง ไม่เกี่ยวกับ Phase นี้
Rollback:         revert commit; ไม่มี schema/queue change ใน Phase นี้ ผลคือกลับไปยิง
                  request ซ้อนกันเหมือนเดิมเท่านั้น ข้อมูลไม่ได้รับผลกระทบ
```

## ส่วนที่ยังไม่ทำและเหตุผล

| งานในแผน | สถานะ | เหตุผล |
|---|---|---|
| C7 soak 30–60 นาที | ยังไม่ทำ | ต้องมี latency injector และรันยาว ควรสั่งรันตอนเครื่องว่าง |
| Certification บน Windows | ยังไม่ทำ | รันจากเครื่องนี้ไม่ได้ |
| Feature flags 5 ตัว | ยังไม่ทำ | ยังไม่มีระบบ flag ใน repo; flag เปล่าเพิ่มเส้นทางโค้ดที่ไม่มีใครใช้ |
| Metrics/alerts | ยังไม่ทำ | ต้องมี telemetry backend; ข้อกำหนดเก็บไว้ในเอกสารนี้แล้ว |
| Rollback rehearsal บน production | ยังไม่ทำ | ทำได้เท่าที่ยืนยันว่า schema เป็น additive และ revert commit ได้ |
