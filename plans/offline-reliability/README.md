# Offline Reliability Remediation Plan

วันที่จัดทำ: 2026-09-19  
สถานะ: **Planning only — ยังไม่ได้รับอนุญาตให้แก้ protected heartbeat/offline logic**

## เป้าหมาย

แก้บัคที่เกิดเมื่อ API server ไม่ทำงาน, network ขาด, request timeout, มี heartbeat
ค้างใน durable queue หรือมีการเปลี่ยน API key ระหว่าง offline โดยต้องรักษา invariant
ต่อไปนี้:

- heartbeat ที่รับไว้ในเครื่องต้องไม่หายและไม่ส่งซ้ำ;
- retry ต้องใช้ `heartbeat_id`, timestamp, revision และ activity segments เดิม;
- queue ของคนละ account หรือคนละ server origin ห้ามข้ามกัน;
- network outage, credential rejection และ entitlement failure ต้องแสดงเป็นคนละสถานะ;
- foreground sampling ต้องเดินต่อแม้ network I/O ช้า;
- UI polling ต้องไม่สร้าง request/CLI process ซ้อนกันแบบไม่จำกัด;
- การแก้ readback/status ห้ามเปลี่ยนความหมายของ duration โดยไม่ได้ตั้งใจ.

## บัคที่แผนครอบคลุม

| ID | อาการ | Phase หลัก |
|---|---|---|
| OFF-01 | Network outage ถูกแสดงเป็น `Subscription required` | Phase 01 |
| OFF-02 | Server ดับแต่ queue ว่างกลับแสดงเหมือน verified/online | Phase 01 |
| OFF-03 | เปลี่ยน API key แล้ว queue ที่ผูก key เก่าอาจค้างถาวร | Phase 02 |
| OFF-04 | Delivery failure เป็น global state ข้าม account/origin และค้างหลัง recovery | Phase 03 |
| OFF-05 | Desktop ซ่อน queue จริงและแสดง Today/queued เป็นศูนย์ตอน offline | Phase 04 |
| OFF-06 | Desktop sampling loop หยุดรอ network และอาจนับเวลาขาด | Phase 04 |
| OFF-07 | Desktop/VS Code polling ซ้อนกันระหว่าง timeout | Phase 05 |

## ลำดับ Phase

1. [Phase 00 — Baseline, contracts and regression harness](phase-00-baseline-and-regression-harness.md)
2. [Phase 01 — Structured offline status](phase-01-structured-offline-status.md)
3. [Phase 02 — Stable queue ownership and safe key rotation](phase-02-queue-ownership-and-key-rotation.md)
4. [Phase 03 — Scoped delivery failure and recovery lifecycle](phase-03-delivery-failure-and-recovery.md)
5. [Phase 04 — Desktop offline-safe tracking and local snapshot](phase-04-desktop-offline-resilience.md)
6. [Phase 05 — Single-flight polling, end-to-end certification and rollout](phase-05-concurrency-certification-and-rollout.md)

Phase 00 → 01 → 02 → 03 เป็น critical path เพราะ Phase 04 ต้องใช้ structured state และ
queue ownership contract ที่นิ่งแล้ว ส่วน Phase 05 ทำหลังทุก behavior change เสร็จ.

## Source of truth ที่ได้รับผลกระทบ

- `backend/api/crates/wakaclock-core/src/api_client.rs` — transport, retry,
  queue scope และ delivery failure;
- `backend/api/crates/wakaclock-core/src/queue.rs` — durable SQLite queue;
- `backend/api/crates/wakaclock-cli/src/main.rs` — `today`, `verify`, `status` contract;
- `backend/api/src/handlers/v1/status_bar.rs` — authenticated server readback;
- `extensions/vscode/src/{cli,statusBar,commands,extension}.ts` — client parsing,
  state rendering และ credential transition;
- `apps/desktop/src-tauri/src/{engine,lib,state,models}.rs` — native sampling,
  delivery และ dashboard snapshot;
- `apps/desktop/src/{App,types}.tsx?` — desktop polling/presentation.

## Approval gate

ไฟล์ heartbeat, queue, retry, readback และ test/fixture ที่ยืนยัน behavior เหล่านี้อยู่ใน
protected scope ตาม `.context/heartbeat-safety.md`. เอกสารชุดนี้ไม่ถือเป็น authorization
ให้ implement. ก่อนเริ่มแต่ละ Phase ต้องระบุไฟล์จริง, behavior ก่อน/หลัง, ความเสี่ยง,
tests และ rollback แล้วขออนุญาตผู้ใช้อีกครั้ง.

## Definition of Done ระดับโครงการ

- บัค OFF-01 ถึง OFF-07 มี regression test ที่ fail บน baseline และ pass หลังแก้;
- ปิด server ระหว่าง activity แล้ว queue count/seconds ตรงกับ SQLite จริง;
- restart client ระหว่าง offline ไม่ทำ heartbeat หาย;
- reconnect แล้ว backlog ถูก drain โดยไม่ต้องสร้างเวลาหรือ heartbeat ซ้ำ;
- key rotation ของ account เดิมย้าย queue ได้แบบ transactional;
- key ของคนละ account และ server origin อื่น claim queue เดิมไม่ได้;
- Desktop sampling cadence ไม่ขึ้นกับ HTTP latency;
- ไม่มี concurrent refresh เกินหนึ่งงานต่อ surface;
- duration audit ยังคง `total_error: 0.0`;
- full Rust, VS Code และ Desktop gates ผ่าน;
- rollout มี telemetry ที่ไม่เก็บ source/prompt/title และมี rollback ที่ไม่ลบ queue.

## Non-goals

- ไม่เปลี่ยน canonical duration algorithm หรือ idle/bridge semantics;
- ไม่เปลี่ยน heartbeat wire fields ที่ไม่จำเป็นกับ offline contract;
- ไม่รวม browser extension ซึ่งยังเป็น protocol/privacy scaffold;
- ไม่เพิ่มการเก็บ source code, prompt, response, diff หรือ raw window title;
- ไม่ auto-migrate queue ข้าม account เพียงเพราะผู้ใช้เปลี่ยน key.

