# Phase 00 — Baseline, Contracts and Regression Harness

สถานะ: Planned  
เป้าหมาย: ล็อกอาการ OFF-01 ถึง OFF-07 ด้วย deterministic tests ก่อนเปลี่ยน production logic

## เหตุผลที่ต้องทำก่อน

ชุดทดสอบเดิมผ่านทั้งหมด แต่ไม่ได้ประกอบเส้นทางจริงข้ามชั้นดังนี้:

```text
network error
  → ApiClient records failure
  → CLI today falls back to local queue
  → VS Code parses output
  → status bar chooses user-facing state
```

และยังไม่มี lifecycle test สำหรับ `old key → offline rows → new key → reconnect` หรือ
Desktop `5s sampler → slow request → missed samples`. Phase นี้ต้องสร้างหลักฐานก่อนแก้
เพื่อแยก regression จริงออกจากการเปลี่ยน expectation ให้ test ผ่าน.

## Scope

### Test files ที่เพิ่ม/ปรับ

- `backend/api/crates/wakaclock-core/tests/offline_delivery.rs`
- `backend/api/crates/wakaclock-cli/tests/offline_lifecycle.rs`
- `extensions/vscode/test/statusBar.test.ts`
- `extensions/vscode/test/cli.test.ts`
- `extensions/vscode/test/commands.test.ts` หรือไฟล์ credential lifecycle แยกใหม่
- `apps/desktop/src-tauri/src/engine.rs` test module หรือ
  `apps/desktop/src-tauri/tests/offline_runtime.rs`
- `apps/desktop/src/App.test.tsx` หลังเตรียม Vitest dependency/runtime พร้อม

### Test helpers

- mock HTTP server ที่กำหนดผลต่อ endpoint ได้แยกกัน: connection refused, hanging
  connection, 401, 402, 429, 503 และ success;
- disposable home/config/queue path ต่อ test process;
- fake monotonic clock สำหรับ sampling/retry/backoff;
- queue inspection helper ที่อ่านเฉพาะ metadata: row count, scope, heartbeat id,
  retry count และ lease state;
- process invocation helper สำหรับ CLI ที่มี timeout ชัดเจนและเก็บ stdout/stderr.

## Test matrix ที่ต้องสร้าง

| Scenario | Expected contract |
|---|---|
| GET today ต่อ server ไม่ได้และ queue ว่าง | `offline`, ไม่ใช่ `verified` |
| POST heartbeat ต่อ server ไม่ได้ | durable queue + `delivery_kind=network` |
| 401 | `auth_rejected`, ไม่ retry แบบ network |
| 402 | queue ไว้ + `subscription_required` |
| 503/429 | queue ไว้ + retry/backoff ตาม contract |
| reconnect ด้วย key เดิม | drain ครั้งเดียว, identity เดิม |
| เปลี่ยน key account เดิม | migrate/claim ได้หลังมี same-owner proof |
| เปลี่ยน key คนละ account | queue เดิมต้องไม่ถูก claim |
| เปลี่ยน server origin | queue เดิมต้องไม่ถูกส่งไป origin ใหม่ |
| Desktop request hang 30s | sampler ยัง tick ตาม fake clock |
| refresh ถูกเรียกถี่กว่า request latency | มี in-flight งานเดียวและ rerun สูงสุดหนึ่งครั้ง |
| stale delivery failure จาก scope เก่า | ไม่เปลี่ยนสถานะ scope ใหม่ |

## Named regression tests

ชื่อ test เป็น contract และควรคงไว้หลัง refactor:

- `network_failure_is_not_reported_as_subscription_required`
- `offline_today_with_an_empty_queue_is_not_verified`
- `offline_today_reports_scoped_queue_depth_and_seconds`
- `same_account_key_rotation_preserves_and_rebinds_every_row`
- `different_account_key_cannot_claim_existing_rows`
- `different_origin_cannot_claim_existing_rows`
- `a_stale_failure_from_another_scope_is_ignored`
- `successful_recovery_clears_only_the_matching_scope_failure`
- `desktop_sampling_continues_while_delivery_is_slow`
- `desktop_snapshot_reads_local_queue_when_the_server_is_down`
- `desktop_refresh_is_single_flight`
- `status_bar_refresh_is_single_flight`

## ขั้นตอนดำเนินงาน

1. สร้าง test fixture แบบไม่แตะ `~/.wakaclock` จริง.
2. รัน test ใหม่บน baseline และบันทึกว่า test ใด fail ด้วยอาการใด.
3. ตรวจว่า failures มาจาก contract ที่ตั้งใจจับ ไม่ใช่ sandbox/port permission.
4. ห้าม mark test เป็น passing ด้วยการลด expectation.
5. เก็บ baseline artifacts เฉพาะ metadata ใน temp directory และลบหลัง test.

## Acceptance criteria

- test ของ OFF-01 ถึง OFF-07 มีครบและ fail บนโค้ดก่อนแก้;
- test ไม่ใช้ public network และไม่แตะ queue/config ของผู้ใช้;
- fake clock ทำให้ test timeout/backoff จบเร็วและ deterministic;
- test แยก transport state ออกจาก duration assertions;
- fixtures ไม่มี API key จริง, source content หรือ prompt text.

## Validation gates

```bash
cd backend/api
cargo test -p wakaclock-core --lib
cargo test -p wakaclock-cli --test offline_lifecycle

cd extensions/vscode
npm run lint
npm test -- --run test/statusBar.test.ts test/cli.test.ts

cd apps/desktop
npm run typecheck
npm test
cargo test --manifest-path src-tauri/Cargo.toml --offline
```

## ความเสี่ยงและการควบคุม

- Tests ที่เปลี่ยน `HOME` ต้องทำใน child process เท่านั้นและ serialize test ที่ใช้ env;
- mock hanging server ต้องมี bounded timeout และ shutdown guard;
- ห้ามใช้ timestamp จริงในการ assert backoff;
- Phase นี้ยังไม่เปลี่ยน production behavior.

## Rollback

ลบเฉพาะ test helpers/tests ที่เพิ่มใน Phase นี้ได้โดยไม่กระทบ production data แต่หาก
พบ test ที่พิสูจน์ data-loss path แล้ว ห้ามลบทิ้งเพื่อให้ CI เขียว; ให้ mark blocker และ
แก้ contract ใน Phase ถัดไป.

