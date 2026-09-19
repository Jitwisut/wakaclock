# Phase 00 — Baseline Results

วันที่รัน: 2026-09-19  
Branch: `test/offline-phase00-baseline` (จาก `main` @ `94af261`)  
สถานะ: tests เพิ่มแล้ว, **ไม่มีการเปลี่ยน production code**

## วิธีอ่านผล

- Test ที่ติด `#[ignore = "OFF-0x baseline: ..."]` (Rust) หรือ `it.fails(...)` (Vitest)
  คือ contract เป้าหมายที่ **fail บนโค้ดปัจจุบัน**. CI ปกติยังเขียว.
- Rust baseline tests ต้องตั้ง `WAKACLOCK_OFFLINE_BASELINE=1` ด้วยจึงจะรันจริง เพราะ
  job ClickHouse ใน `.github/workflows/ci.yml` รัน `cargo test --workspace -- --ignored`;
  ถ้าไม่มีตัวแปรนี้ test จะ return ทันทีพร้อมพิมพ์ `skipped: ...` เพื่อไม่ให้ sweep นั้นแดง.
  Phase ที่แก้บั๊กต้องลบทั้ง `#[ignore]` และบรรทัด `offline_baseline_enabled()`.
- Phase ที่แก้บั๊กต้องถอด `#[ignore]` / เปลี่ยน `it.fails` → `it` แล้วให้ผ่านจริง.
  `it.fails` จะเตือนเองเมื่อบั๊กถูกแก้ (test จะกลายเป็น fail).
- ห้ามลด expectation เพื่อให้ผ่าน.

รันเต็ม (รวม baseline):

```bash
cd backend/api
WAKACLOCK_OFFLINE_BASELINE=1 cargo test -p wakaclock-core --test offline_delivery -- --include-ignored
WAKACLOCK_OFFLINE_BASELINE=1 cargo test -p wakaclock-cli --test offline_lifecycle -- --include-ignored

cd extensions/vscode && npx vitest run test/offlineStatus.test.ts test/cli.test.ts
cd apps/desktop && npm test
```

## ผลบน baseline

### Rust — `wakaclock-core/tests/offline_delivery.rs` (in-process, ไม่แตะ HOME)

| Test | Bug | ผล | อาการที่พบจริง |
|---|---|---|---|
| `network_failure_is_not_reported_as_subscription_required` | OFF-01 | FAIL | URL port `40213` ทำให้ `classify_delivery_failure` คืน `Payment402` |
| `network_failure_is_not_reported_as_auth_rejected` | OFF-01 | FAIL | URL port `54017` → `Auth401` |
| `transport_error_without_a_response_is_classified_as_network` | OFF-01 | FAIL | `"error sending request for url"` → `Other` (ไม่ใช่ `Network`) |
| `http_402_body_is_classified_as_subscription_required` | guard | pass | |
| `http_401_rejection_is_classified_as_auth_rejected` | guard | pass | |
| `http_429_and_503_are_retryable_and_401_422_are_not` | guard | pass | |
| `retry_after_is_taken_from_the_response_not_the_clock` | guard | pass | |
| `different_account_key_cannot_claim_existing_rows` | guard (Phase 02) | pass | |
| `different_origin_cannot_claim_existing_rows` | guard (Phase 02) | pass | |
| `queue_scope_normalizes_a_trailing_slash_in_the_origin` | guard | pass | |
| `scoped_depth_and_seconds_exclude_other_scopes` | guard | pass | |
| `a_leased_row_is_not_claimed_twice_and_retry_keeps_identity` | guard | pass | |

### Rust — `wakaclock-cli/tests/offline_lifecycle.rs` (child process, HOME ชั่วคราว, mock API บน 127.0.0.1)

| Test | Bug | ผล | อาการที่พบจริง |
|---|---|---|---|
| `network_failure_is_not_reported_as_subscription_required` | OFF-01 | FAIL | `today --json` ไม่มี `connection`; failure เก็บเป็น free-form message; text mode พิมพ์ `Delivery: REFUSED` |
| `offline_today_with_an_empty_queue_is_not_verified` | OFF-02 | FAIL | exit 0, snapshot ศูนย์, `delivery_failure: null`, สัญญาณ offline มีแค่ string `error` |
| `offline_today_reports_scoped_queue_depth_and_seconds` | OFF-02 | FAIL | ไม่มี object `queue` (legacy `queued_heartbeats` = 2 ถูกต้อง) |
| `http_401_reports_auth_rejected_not_offline` | OFF-01 | FAIL | `today` exit ≠ 0 พร้อม stderr แทนที่จะรายงาน `auth_rejected` |
| `http_402_keeps_rows_queued_and_reports_subscription_required` | OFF-01 | FAIL | row ถูก queue (ถูก) แต่ไม่มี structured state |
| `http_503_keeps_rows_queued_and_reports_retryable_server_error` | OFF-01 | FAIL | row ถูก queue (ถูก) แต่ 503 เป็นแค่ string `error` |
| `http_429_retry_after_is_respected_for_a_newly_queued_row` | matrix 429 | FAIL | send-path ทิ้ง `Retry-After`: row ใหม่มี `next_retry_at = 0` (flush-path เคารพ) |
| `same_account_key_rotation_preserves_and_rebinds_every_row` | OFF-03 | FAIL | server ได้เฉพาะ `hb-rot-new`; 3 rows ของ key เก่าค้างใน scope `key:<hash เก่า>` |
| `a_stale_failure_from_another_scope_is_ignored` | OFF-04 | FAIL | scope ใหม่ (origin/account อื่น, queue ว่าง) เห็น network failure ของ scope เก่า |
| `successful_recovery_clears_only_the_matching_scope_failure` | OFF-04 | FAIL | success ของ account อื่นลบไฟล์ failure global → 402 ที่ยังค้างของ scope เดิมหายไป |
| `http_429_retry_after_is_respected_by_a_queue_flush` | guard | pass | |
| `reconnect_with_the_same_key_drains_each_row_exactly_once` | guard | pass | id และ timestamp เดิม, ส่งครั้งเดียว, queue ว่าง |
| `different_account_key_cannot_claim_existing_rows` | guard | pass | rows เดิมไม่ถูกส่ง/ลบ/เปลี่ยน scope |
| `different_origin_cannot_claim_existing_rows` | guard | pass | |

### VS Code — `test/offlineStatus.test.ts`, `test/cli.test.ts`

| Test | Bug | ผล | อาการที่พบจริง |
|---|---|---|---|
| `network_failure_is_not_reported_as_subscription_required` | OFF-01 | expected fail | แสดง `$(warning) AtoAxis: 30s` (subscription) สำหรับ connection refused |
| `offline_today_with_an_empty_queue_is_not_verified` | OFF-02 | expected fail | CLI offline → parser → status bar แสดง `$(clock) 0s` (เหมือน verified) |
| `offline_today_is_parsed_with_its_connection_state` (cli.test.ts) | OFF-02 | expected fail | text parser ทิ้งบรรทัด `Server error:`; ไม่มี connection state |
| `status_bar_refresh_is_single_flight` | OFF-07 | expected fail | `getToday` ถูกเรียก 5 ครั้งจาก 5 refresh ระหว่าง in-flight |
| `status_bar_polling_does_not_stack_while_a_refresh_is_in_flight` | OFF-07 | expected fail | fake clock 60s → 5 CLI calls ขณะ request แรกค้าง |
| `a_real_402_refusal_is_reported_as_subscription_required` | guard | pass | |

### Desktop — `apps/desktop/src/App.test.tsx`

| Test | Bug | ผล | อาการที่พบจริง |
|---|---|---|---|
| `desktop_refresh_is_single_flight` | OFF-07 | expected fail | fake clock 30s ขณะ snapshot ค้าง → `dashboard_snapshot` ถูกเรียก 7 ครั้ง |

## Blockers ที่เลื่อนไป Phase 04

| Test | เหตุผล |
|---|---|
| `desktop_sampling_continues_while_delivery_is_slow` (OFF-06) | `engine::run` เรียก OS tracker, `Instant::now()`, `Config::load()` (อ่าน `~/.wakaclock` จริง) และ `ApiClient` ตรง ๆ และรับ Tauri `AppHandle` — ไม่มี seam ให้ fake clock/tracker/delivery โดยไม่แก้ production code (protected). จุดบั๊ก: `send_activity(..).await` อยู่ใน sampler loop และ `elapsed` ถูก clamp ที่ 10s → request ค้าง 30s นับได้ 10s |
| `desktop_snapshot_reads_local_queue_when_the_server_is_down` (OFF-05) | `dashboard_snapshot` เป็น `#[tauri::command]` ที่ต้องการ `State<'_, DesktopState>` และเรียก `Config::load()`/`ApiClient::today()` ที่ผูกกับ HOME — เหตุผลเดียวกัน. อาการจากการอ่านโค้ด: เมื่อ `today()` error จะคืน `queued_seconds: 0.0` และ `today_text: "Offline"` โดยไม่อ่าน queue |

Phase 04 ต้องสร้าง seam (trait/parameter สำหรับ clock, tracker, delivery, snapshot source)
พร้อมกับการแก้ OFF-05/06 และเพิ่มสอง test นี้ก่อนเปลี่ยน behavior.

## Finding ใหม่ที่ไม่อยู่ใน OFF-01..07

**Send-path ทิ้ง `Retry-After`.** เมื่อ heartbeat ใหม่ได้ 429 พร้อม `Retry-After: 120`,
`send_heartbeats` เรียก `queue.push_scoped(...)` ซึ่งไม่รับ retry delay → row มี
`next_retry_at = 0` และถูก flush ซ้ำทันทีในการเรียกครั้งถัดไป. ส่วน flush-path
(`flush_queue_inner` → `mark_retry_after`) เคารพ header ถูกต้อง. ควรรวมเข้า retry-policy
ของ Phase 03 (ตาราง policy ปัจจุบันสมมติว่ามี policy เดียวต่อ kind).
Test: `http_429_retry_after_is_respected_for_a_newly_queued_row`.

## Test เดิมที่ fail อยู่ก่อนแล้ว (ไม่เกี่ยวกับ Phase นี้)

`cargo test -p wakaclock-cli` มี unit test ใน `src/main.rs` fail หนึ่งตัว:
`generic_ai_ingress_tests::ai_sync_lock_allows_one_process_and_releases_after_drop`
(panic ที่ `main.rs:6827`). Phase 00 ไม่ได้แก้ `main.rs`; test นี้ fail บน `main` @ `94af261`
เหมือนกัน ต้องติดตามแยก.

## ข้อสังเกตเพิ่มเติม

- `today`/`status` อ่าน `agent_service::status()` ซึ่ง probe process ของเครื่องจริง —
  ใน HOME ชั่วคราวยังรายงาน `running: true` ถ้าเครื่องมี broker ทำงานอยู่. ไม่กระทบ
  assertion ใดใน Phase นี้ แต่ Phase 01 ไม่ควรใช้ field นี้ตัดสิน connection state.
- Mock API ใช้ `queue_owner_id` ใน response ของ `GET /api/v1/status_bar/today` เป็น
  same-account proof ตามข้อเสนอของ Phase 02. ถ้า Phase 02 เลือก endpoint/field อื่น
  ให้ปรับ mock ตาม แต่คง assertion เดิม.
- Contract field ที่ tests ใช้ (`connection.state`, `connection.last_error_kind`,
  `connection.reachable`, `queue.depth`, `queue.seconds_today`) มาจาก Phase 01.
- Desktop เพิ่ม devDependency `jsdom` เพื่อรัน React test (ไม่มีผลกับ production bundle).
- Desktop Rust gate (`cargo test --manifest-path src-tauri/Cargo.toml`) ไม่ได้รันใน Phase นี้
  เพราะไม่มีการแก้ไฟล์ใน `src-tauri`.

## Fixture safety

- ทุก CLI test ใช้ `env_clear()` + `HOME` ชั่วคราวต่อ test และลบทิ้งใน `Drop`;
- ไม่มี public network: mock API และ dead port อยู่บน `127.0.0.1` เท่านั้น;
- API key เป็น fixture string (`fixture-key-...`) ไม่ใช่ key จริง;
- queue inspection อ่านเฉพาะ metadata (id, scope, retry, lease, created/next_retry);
- payload fixture ไม่มี source content หรือ prompt.
