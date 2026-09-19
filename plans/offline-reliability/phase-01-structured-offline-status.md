# Phase 01 — Structured Offline Status

สถานะ: Implemented (branch `feat/offline-phase01-structured-status`)  
ครอบคลุม: OFF-01, OFF-02  
ขึ้นกับ: Phase 00

## เป้าหมาย

เลิกอนุมานสถานะจากข้อความ `REFUSED`/stderr และสร้าง machine-readable contract เดียวที่
จำแนกอย่างน้อย:

- `online`
- `offline` — DNS/connect/timeout ไม่มี HTTP response
- `auth_rejected` — 401/invalid key
- `subscription_required` — 402/entitlement inactive
- `retryable_server_error` — 408/429/5xx
- `validation_rejected` — permanent 4xx เช่น 400/422
- `unknown_error`

สถานะต้องแยกจากคำถามว่า queue มีข้อมูลหรือไม่: server อาจ offline ขณะ queue ยังว่าง และ
server อาจ online แต่ POST ถูก 402 ขณะที่ GET today สำเร็จ.

## Contract design

เพิ่ม additive fields ใน `wakaclock today --json`:

```json
{
  "connection": {
    "state": "offline",
    "reachable": false,
    "authenticated": null,
    "http_status": null,
    "last_error_kind": "network",
    "last_error_at": 1789740000
  },
  "queue": {
    "depth": 3,
    "seconds_today": 42.0,
    "eligible_now": 2
  }
}
```

ข้อกำหนด:

- fields เดิมใน JSON/text ต้องคงอยู่ใน Phase นี้เพื่อ backward compatibility;
- raw error message อาจใช้ใน diagnostic แต่ UI decision ใช้ enum/code เท่านั้น;
- `offline + depth=0` ยังต้องแสดง offline;
- `network` ห้าม map เป็น subscription;
- `402` ต้องคง queue และแสดง action เรื่อง subscription;
- `401` ต้องแสดง action เปลี่ยน key แต่ห้ามอ้างว่า network offline;
- `429/5xx` แสดง degraded/retrying ไม่ใช่ invalid key.

## ไฟล์ที่คาดว่าจะเปลี่ยน

### Rust source of truth

- `backend/api/crates/wakaclock-core/src/api_client.rs`
  - ทำ typed `DeliveryFailureKind` ให้เป็น serialization contract;
  - ให้ `today_with_timezone`/probe คืน typed reachability outcome แทน string parsing;
  - รักษา retry classification เดิม.
- `backend/api/crates/wakaclock-cli/src/main.rs`
  - เติม structured `connection` และ `queue` ใน `today --json`;
  - text mode แสดง `Offline`, `Authentication rejected`, `Subscription required`
    ตาม kind จริง;
  - `verify --json` ใช้ classifier เดียวกัน ไม่สร้าง mapping ซ้ำ.

### VS Code

- `extensions/vscode/src/types.ts`
  - เพิ่ม typed connection snapshot.
- `extensions/vscode/src/cli.ts`
  - เรียก `today --json` เป็น primary path;
  - fallback ไป text parser เฉพาะ legacy CLI ที่ไม่รู้จัก `--json`;
  - ห้ามทิ้ง `server_error`/connection fields.
- `extensions/vscode/src/statusBar.ts`
  - render จาก typed state;
  - network → `cloud-offline`, 402 → warning subscription, 401 → key rejected;
  - queue depth/seconds เป็นข้อมูลประกอบ ไม่ใช่ตัวตัดสิน online/offline.
- `extensions/vscode/src/commands.ts`
  - user messages ใช้ state เดียวกัน.

## ลำดับ implementation

1. ทำ enum + classifier ให้ทุก transport error path คืนค่าเดียวกัน.
2. เพิ่ม JSON fields แบบ additive และ snapshot test.
3. เพิ่ม CLI text output ที่ไม่เรียก network failure ว่า `REFUSED`.
4. เปลี่ยน VS Code `getToday()` ไป JSON พร้อม legacy fallback.
5. เปลี่ยน status bar state machine และลบ regex decision ที่ใช้ข้อความ error.
6. รัน regression จาก Phase 00 และเพิ่ม compatibility test กับ legacy CLI output.

## State transition ที่ต้องยืนยัน

```text
connecting → online
connecting → offline
online → offline → online
online → subscription_required → online
online → auth_rejected → connecting → online
offline(queue=0) → offline(queue>0) → online(queue draining) → online(queue=0)
```

Response เก่าที่มาถึงช้าห้าม override state ใหม่; concurrency guard ทำเต็มใน Phase 05
แต่ Phase นี้ต้องทำ state model ให้รองรับ sequence/revision.

## Tests

### Rust

- `network_transport_maps_to_offline`
- `http_402_maps_only_to_subscription_required`
- `http_401_maps_only_to_auth_rejected`
- `http_429_and_503_are_retryable_server_errors`
- `today_json_reports_offline_even_when_queue_is_empty`
- `today_json_keeps_legacy_top_level_fields`

### VS Code

- `renders_cloud_offline_for_network_failure_with_empty_queue`
- `renders_subscription_required_only_for_payment_402`
- `renders_key_rejected_only_for_auth_401`
- `parses_structured_today_json`
- `falls_back_to_legacy_text_without_losing_timezone_behavior`

## Acceptance criteria

- ปิด server ก่อนเปิด VS Code: status bar ต้องขึ้น offline ภายใน refresh แรก;
- ส่ง heartbeat ขณะ offline: ยังขึ้น offline พร้อม queue count ไม่ใช่ subscription;
- mock 402: ขึ้น subscription required;
- mock 401: ขึ้น key rejected;
- reconnect: เปลี่ยนเป็น online หลัง successful probe โดยไม่ต้อง reload extension;
- ไม่มี UI decision ที่ตรวจ `/REFUSED|402|subscription/` จาก free-form message อีก.

## ความเสี่ยง

- packaged VS Code อาจ bundle CLI เก่า: ต้องมี fallback ที่ bounded และมี warning;
- เปลี่ยน CLI output อาจกระทบ external parsers: text fields เดิมจึงยังอยู่;
- classifier ผิดอาจทำให้ permanent error ถูก retry: Phase นี้ห้ามเปลี่ยน retry policy
  พร้อม status mapping โดยไม่มี test แยก.

## Rollback

- VS Code rollback ไป legacy parser ได้โดยไม่เปลี่ยน queue schema;
- JSON fields เป็น additive จึงคงไว้ได้แม้ rollback UI;
- ห้าม rollback ด้วยการกลับไป map network เป็น subscription.

## Gates

```bash
cd backend/api
cargo fmt --all -- --check
cargo test -p wakaclock-core --lib
cargo test -p wakaclock-cli

cd extensions/vscode
npm run lint
npm test
```

## Implementation notes (2026-09-19)

สิ่งที่ทำจริงเทียบกับแผน:

- `DeliveryFailureKind::from_error` เป็น source of truth: transport error ที่ไม่มี HTTP
  response = `network` เสมอ ไม่ว่า URL/message จะมี "402" หรือไม่.
- `classify_delivery_failure` (สำหรับ record เก่าที่ไม่มี `kind`) อ่าน status เฉพาะรูป
  `HTTP status NNN:` และ `HTTP status client/server error (NNN ...)`.
- `DeliveryFailure` เก็บ `kind` และ `http_status` เพิ่ม (additive; record เก่ายังอ่านได้).
- เพิ่ม `DeliveryFailureKind::ServerError` (408/429/5xx): `wakaclock doctor ai` จะแสดง
  `category: "server_error"` แทน `"other"` สำหรับกรณีนี้.
- `today --json` เพิ่ม `connection` และ `queue.{depth,seconds_today}`; `queue.eligible_now`
  **ยังไม่ทำ** เพราะต้องเพิ่ม query ใน `queue.rs` ซึ่งอยู่นอก scope ที่อนุมัติ — ย้ายไป Phase 03.
- `today --json` บน 401 คืน exit 0 + `auth_rejected`; text mode ยัง exit ≠ 0 เพื่อ extension เก่า.
- Text mode: `Connection: <state>` และ `Delivery: OFFLINE|RETRYING|REFUSED - ...`
  (`REFUSED` เฉพาะ 401/402/400/422).
- เมื่อ GET today สำเร็จ: refusal ที่บันทึกไว้แบบ 402 หรือ 400/422 ยังชนะ; 401 ที่บันทึกไว้
  **ไม่ชนะ** เพราะ GET ที่สำเร็จใช้ key เดียวกันจึงพิสูจน์ว่า key ใช้ได้ (ป้องกัน state
  `auth_rejected` + `authenticated: true` ที่ขัดกันเอง); network/5xx เก่าถูกแทนด้วย `online`
  และเหลือเพียง `last_error_kind`.
- `kind` ใน `last-delivery-failure.json` ใช้ชื่อเดียวกับ `as_str()` (`auth_401`,
  `payment_402`, ...). Rollback ปลอดภัย: binary เก่าไม่มี field `kind` จึงข้ามไป; binary
  ใหม่อ่านค่า `kind` ที่ไม่รู้จักเป็น "ไม่มี" แล้ว classify จาก message แทนการทิ้งทั้ง record.
- `verify --json` ใช้ classifier เดียวกัน ค่า status เดิม (403 เปลี่ยนจาก `server_error`
  เป็น `invalid_key`).
- VS Code: `getToday` ใช้ `today --json` → fallback text เมื่อ CLI ไม่รู้จัก flag (จำไว้ต่อ
  service instance); status bar ตัดสินจาก `connection.state`; legacy CLI ที่ไม่มี field
  ใช้ rule แคบ (REFUSED + `HTTP status 402`/`trial expired` เท่านั้นจึงเป็น subscription).
- พบระหว่างทำ: `syncAndVerifyApiKey` (legacy path) อาศัย `getToday()` throw เมื่อ key ผิด
  → แก้ให้ตรวจ `connection.state === "auth_rejected"` ด้วย มี test ครอบ.

ยังเปิดอยู่ (ไม่อยู่ใน Phase นี้): OFF-03 (Phase 02), OFF-04 และ send-path `Retry-After`
(Phase 03), OFF-07 single-flight (Phase 05). failure file ยัง global จึงอาจเห็น 402 ของ
scope อื่นจนกว่า Phase 03 จะเสร็จ.

Clippy: `cargo clippy --all-targets -- -D warnings` บน toolchain 1.96 fail อยู่แล้วบน `main`
จาก 3 lint ในไฟล์ที่ไม่ได้แตะ (`ai/codex.rs`: `needless_option_as_deref`,
`too_many_arguments`; `agent_service.rs`: `needless_return`). โค้ดที่เปลี่ยนใน Phase นี้ผ่าน
clippy เมื่อ allow เฉพาะ 3 lint นั้น.
