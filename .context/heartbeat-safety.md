# Heartbeat and Time-Counting Safety Context

สถานะ: **protected domain**

เอกสารนี้เป็นกฎบังคับสำหรับ AI/agent ทุกตัวที่ทำงานกับ heartbeat, activity,
duration, timeline, ingest, queue หรือการนับเวลาใน Wakaclock/AtoAxis.

## Non-negotiable rule

ห้ามเปลี่ยน logic การนับเวลา หรือแก้ไฟล์ใน protected scope โดยอาศัยการอนุมานเอง
แม้เป็น bug fix, refactor, formatting, migration, performance change หรือการทำตาม
แผนที่เขียนไว้แล้วก็ตาม ต้องขออนุญาตผู้ใช้ก่อนทุกครั้ง

การอ่านไฟล์, `rg`, ตรวจ diff, รัน test/read-only diagnostics ทำได้โดยไม่ต้องขออนุญาต
แต่การเขียนไฟล์, แก้ test/fixture ที่ครอบคลุม behavior นี้, เปลี่ยน migration,
commit หรือ push ที่เกี่ยวข้องกับงานนี้ ต้องหยุดรอ explicit approval ก่อน.

การอนุมัติให้แก้ไฟล์ **ไม่เท่ากับ** การอนุมัติให้ commit หรือ push.

## Locked time-counting baseline — ห้ามแก้เด็ดขาดโดยไม่ได้รับอนุญาต

สถานะ: **LOCKED by the project owner (2026-10-04); delivery recovery exception approved 2026-10-07**

เจ้าของโปรเจกต์ตรวจแล้วว่าอัลกอริทึมชุดนี้ให้ผลตรงกับ WakaTime จริง (วันที่ 4 ต.ค. 2026
AtoAxis 3h 6m เทียบกับ WakaTime 3h 4m จากการใช้งาน editor ชุดเดียวกัน รวม heartbeat
ที่ค้างในคิวออฟไลน์ 2 วันซึ่งถูกส่งย้อนหลังครบ) และต้องการให้คงไว้ตามนี้

**ห้ามแก้ค่าหรือพฤติกรรมใดๆ ในตารางด้านล่างเด็ดขาด** จนกว่าจะได้รับอนุญาตจากเจ้าของโปรเจกต์
**ทุกครั้ง** การอนุญาตครั้งก่อนไม่ครอบคลุมครั้งถัดไป และกฎนี้ใช้กับทุกกรณีที่ทำให้ค่าหรือ
พฤติกรรมเหล่านี้เปลี่ยน เช่น bug fix, refactor, performance, cleanup, การย้ายโค้ด,
การรวม/แยก constant, การเปลี่ยน default ของ env var, และการแก้ test/fixture ให้ผ่าน
ถ้าพบว่าส่วนใดดูผิด ให้รายงานพร้อมหลักฐานแล้วรอคำตอบ ห้ามแก้เอง

| ขั้น | สิ่งที่ล็อกไว้ (ค่าปัจจุบัน) | ที่อยู่ |
| --- | --- | --- |
| 1. วัดที่ client | กิจกรรมของคนหนึ่งครั้ง lease เวลาได้สูงสุด **15 วินาที** (`ACTIVE_LEASE_SECONDS = 15`) ส่งเป็น `activity_segments`; จังหวะการส่ง heartbeat (~120 วินาที) **ห้าม**ถูกนับเป็นเวลา | `extensions/vscode/src/activity.ts`, `wakaclock-core/src/heartbeat.rs` |
| 2. แปลงเป็นช่วงเวลา | heartbeat รุ่นเก่า/WakaTime import ถูกตัดที่ **120 วินาที** (`MAX_ACTIVITY_GAP_SECONDS`); งาน AI tool ถูกตัดที่ **6 ชั่วโมง** (`MAX_AI_TOOL_DURATION_SECONDS`); heartbeat ไฟล์เดียวกันภายใน **120 วินาที** ถือว่าซ้ำ (`DEDUP_WINDOW_SECONDS`) | `wakaclock-core/src/heartbeat.rs`, `backend/api/src/services/activity_timeline.rs` |
| 3. ไทม์ไลน์ไม่ซ้อน | `canonicalize`: แต่ละวินาทีมีเจ้าของ**เดียว**; ลำดับ `source_priority` คือ editor (`editor`, `editor_active_v1`) > AI (`ai`, `ai_tool_v1`) > อื่นๆ; เสมอกันตัดสินด้วย heartbeat/segment ID | `activity_timeline.rs` |
| 4. เชื่อมช่วงพัก | `IDLE_TIMEOUT_MINUTES` default **15**: ช่องว่าง ≤ 15 นาทีนับเป็นเวลาทำงาน, เกินไม่นับ; เวลาพักยกให้ช่วง**ก่อนหน้า**; ช่วงท้ายหลังกิจกรรมสุดท้าย**ไม่นับ**; anchor (heartbeat ที่ไม่มี duration) ใช้ต่อ chain ได้ | `bridge_idle_gaps_with_anchors`, `bridge_by_attendance` ใน `activity_timeline.rs`, `config/mod.rs` |
| 5. แยกคนกับ AI | `AGENT_IDLE_TIMEOUT_MINUTES` default = ค่าเดียวกับ `IDLE_TIMEOUT_MINUTES`; ค่า `off` คือรวมทุก source ไว้ timeline เดียว | `config/mod.rs`, `BridgeConfig` |
| 6. ค่าที่แสดงหลัก | `DURATION_PRIMARY_MODE` default **`wakatime_compatible`**; `DURATION_CALCULATION_MODE` default **`legacy`**; `active_v1` / `combined_v2` เป็น canary ที่ต้องเปิดเองเท่านั้น | `config/mod.rs`, `services/duration.rs` |
| 7. คิวออฟไลน์ | error แบบต่อไม่ติด/retry ได้ **ไม่มีเพดานจำนวนครั้งและไม่มีเพดานอายุ** (ห้ามทิ้ง heartbeat); backoff 60s → 120 → 240 → 480 → 960 → 1920 → สูงสุด **3600s**; `Retry-After` สูงสุด 86,400s; dead-letter เฉพาะ error ที่ retry ไม่ได้; ข้อยกเว้นที่อนุมัติ 2026-10-07: recovery probe เฉพาะ network/5xx ที่ทราบเหตุผล หลัง POST จริงสำเร็จ, สูงสุดหนึ่ง probe ต่อ scope ต่อ 60s; เคารพ `Retry-After` และ legacy ที่ไม่ทราบเหตุผลต้องรอ due เดิม | `wakaclock-core/src/queue.rs`, `wakaclock-core/src/api_client.rs` |

เป้าหมายที่ล็อกไว้: ยอดแบบ `wakatime_compatible` ต้องห่างจาก WakaTime **ไม่เกิน 1%**
บนข้อมูลชุดเดียวกัน การเปลี่ยนใดๆ ที่อาจทำให้ยอดนี้ขยับ ถือว่าแตะ baseline นี้

การขออนุญาตต้องใช้ template ใน "Approval gate" ด้านล่าง และต้องเพิ่ม 3 ข้อนี้:

1. ระบุว่าจะเปลี่ยนแถวไหนในตารางนี้ และค่าเดิม → ค่าใหม่
2. ผลต่อยอดเวลาต่อวันที่คาดไว้ (เพิ่ม/ลดกี่ % และในกรณีไหน)
3. หลักฐานเทียบก่อน/หลังบนข้อมูลจริงหรือ fixture ที่ครอบคลุมทุกแถวที่ได้รับผล

ถ้าได้รับอนุญาตให้เปลี่ยน ต้องอัปเดตตารางนี้และวันที่ใน commit เดียวกัน

การอนุมัติ 2026-10-07: ผู้ใช้สั่ง “PLEASE IMPLEMENT THIS PLAN” สำหรับ durable queue, delivery-only worker, snapshot v2, UI และ canary 7 วันทำงาน โดยรักษาแถว 1–6 และสูตร duration เดิม; ไม่ครอบคลุม commit/push หรือการขยายกฎ capture.

## Approval gate — ต้องถามก่อนแก้

การอนุมัติ 2026-10-08 (Team Phase 2): ผู้ใช้สั่ง “PLEASE IMPLEMENT THIS PLAN” สำหรับ closed-week privacy registry, consent/read concurrency, Team-only retention/restore guard, measurement health/Trust UI และ canary day-scoped revisions พร้อม isolated fixtures. ไม่เปลี่ยน heartbeat/capture/duration baseline และไม่อนุญาต push/merge เข้า main.

การอนุมัติเผยแพร่ 2026-10-08 (Team Phase 2): ผู้ใช้สั่ง “commit แล้ว push ให้หน่อย” หลังการส่งมอบ Phase 2 อนุญาต commit/push source, migration, tests และเอกสารของงานนี้ไปยัง `codex/atoaxis-team` รวม lifecycle/recovery และ canary ที่อยู่ในแผนที่อนุมัติไว้ ไม่รวม credential, incident output, backup หรือ runtime/build artifacts; ไม่อนุญาต push/merge เข้า main และไม่ใช่การอนุมัติ production release.


การอนุมัติ 2026-10-08 (Team): ผู้ใช้สั่ง “PLEASE IMPLEMENT THIS PLAN” สำหรับ AtoAxis Team: metadata-only, consent มีเวอร์ชัน/เวลาเริ่มแชร์, tenant/team/repository scope, suppression ขั้นต่ำ 5 ผู้ร่วมข้อมูลจริง, GitHub durable inbox, confirmed work links, provider certification และ billing ที่ปิดจนมี configuration/evidence. รักษา heartbeat ID/timestamp และ baseline ทุกแถว; ทำบน branch `codex/...` เท่านั้น. ไม่อนุญาต push/merge เข้า main และไม่ถือว่า external release gates ผ่านโดยไม่มีผลทดสอบจริง.

การอนุมัติเผยแพร่ 2026-10-08 (Team): ผู้ใช้สั่ง “commit แล้ว push ให้หน่อย” อนุญาต commit/push งาน Team foundation ที่ทำเสร็จไปยัง `codex/atoaxis-team` พร้อมบันทึกกฎห้าม push เข้า main. ไม่รวม credential, ข้อมูล incident ส่วนตัว, backup หรือ runtime/build artifacts; ไม่อนุญาต push/merge เข้า main และไม่ใช่การอนุมัติ production release.

การอนุมัติเพิ่มเติม 2026-10-07: ผู้ใช้สั่ง “PLEASE IMPLEMENT THIS PLAN” สำหรับ capture กิจกรรม Codex จาก task/tool/message metadata, collector 15s พร้อม durable cursor/inbox, replay event จริง, capture health และ supervision ของบริการเดิมเมื่อ login. เพิ่มข้อมูลนำเข้าโดยรักษาค่าทุกแถวของ baseline และสูตรเดิม; ไม่ครอบคลุม commit/push หรือสร้างฐานข้อมูลใหม่แทน volume เดิม.

การอนุมัติ 2026-10-08: ผู้ใช้สั่ง “แก้ code ส่วนไหนไปบ้าง commit แล้ว push ให้หน่อย” อนุญาต commit/push งาน delivery, capture และ service recovery ตามสองแผนข้างต้น โดยไม่รวม credential, backup ฐานข้อมูล, runtime binary และหลักฐาน incident ส่วนตัว.

ก่อนแก้ protected scope ให้ส่งคำขอที่ระบุครบทุกข้อ:

1. **ไฟล์ที่จะเปลี่ยน** — ใช้ absolute/repository path และระบุว่าไฟล์ใดเป็น source of truth
2. **สิ่งที่จะทำ** — อธิบาย logic หรือ contract ที่จะเปลี่ยนแบบสั้นและเฉพาะเจาะจง
3. **เหตุผลและผลลัพธ์ที่คาดหวัง** — behavior ก่อน/หลัง และผลต่อผู้ใช้หรือข้อมูล
4. **ความเสี่ยง** — โดยเฉพาะ accepted event loss, duplicate, idle over-count,
   under-count, ordering, retry, timezone และ backward compatibility
5. **หลักฐานที่จะเก็บ** — tests, fixtures, replay, metrics, migration check และ rollback plan

จากนั้นถามตรง ๆ ว่าอนุญาตให้แก้ scope นี้หรือไม่ และต้องรอคำตอบยืนยันก่อนลงมือ
คำว่า “ช่วยดู”, “ทำต่อ”, “แก้ให้หน่อย” หรือมีแผนอยู่แล้ว ไม่ถือเป็น approval สำหรับ
protected change หากยังไม่ได้บอก scope และผลลัพธ์ตามรายการข้างต้น.

## หลังได้รับอนุญาต

- เปลี่ยนให้น้อยที่สุดและห้ามแก้ไฟล์นอก scope โดยไม่แจ้งใหม่
- ห้ามทำ formatting/bulk rewrite ปนกับ logic change
- รักษา wire format, idempotency, deduplication, retry และ rollback contract เดิม
  เว้นแต่ผู้ใช้อนุมัติให้เปลี่ยนอย่างชัดเจน
- เพิ่มหรือปรับ regression test ของ invariant ที่ได้รับผลกระทบ
- หลังทำเสร็จต้องรายงาน **actual result** เทียบกับ expected result, รายชื่อไฟล์ที่แก้,
  test/evidence ที่ผ่านหรือไม่ผ่าน, ความเสี่ยงที่เหลือ และผลต่อ production

## สิ่งที่ถือว่าเป็น time-counting logic

ถือว่าอยู่ใน protected scope ทันทีถ้าเกี่ยวข้องกับอย่างใดอย่างหนึ่งต่อไปนี้:

- `Heartbeat`, heartbeat wire format, `active_seconds`, timestamp, revision หรือ dedup
- `ActivitySegment`, `activity_intervals`, canonical timeline หรือ interval union
- idle timeout, gap/bridge, overlap, session/block boundary หรือ timezone clipping
- การเลือก accepted/rejected heartbeat, ordering, replay, retry, offline queue หรือ bulk ingest
- การคำนวณ duration, summary, stats, project analytics หรือ readback ที่ derived จาก heartbeat
- การเปลี่ยน event cadence, payload, source/actor attribution ที่ทำให้เวลา/กิจกรรมเปลี่ยน
- การเปลี่ยน ClickHouse schema/DDL, migration หรือ consumer/transport ที่อาจทำให้ event หาย/ซ้ำ

กฎจากเนื้อหานี้มีผลเหนือ file map ด้านล่าง: หากไฟล์ใหม่มี dependency หรือทำงานแบบใด
ข้างต้น ให้ถือว่า protected และถามก่อน แม้ชื่อไฟล์จะไม่มีคำว่า heartbeat ก็ตาม.

## Protected file map

ให้โหลดเฉพาะกลุ่มที่ตรงกับงาน ไม่ต้องอ่าน repository ทั้งหมด.

### 1. Server ingest, canonical timeline และ duration

| Path | หน้าที่ |
| --- | --- |
| `backend/api/src/handlers/v1/heartbeats.rs` | HTTP heartbeat/bulk ingress |
| `backend/api/src/handlers/v1/durations.rs` | duration/readback API |
| `backend/api/src/handlers/v1/wakatime_import.rs` | raw heartbeat import endpoint |
| `backend/api/src/services/heartbeat.rs` | heartbeat business flow |
| `backend/api/src/services/heartbeat_ingest.rs` | validation, ingest state และ transport path |
| `backend/api/src/services/activity_timeline.rs` | canonical, overlap-free activity intervals |
| `backend/api/src/services/duration.rs` | WakaTime-compatible duration calculation |
| `backend/api/src/services/kafka_heartbeat.rs` | Kafka heartbeat ingest/verification path |
| `backend/api/src/services/wakatime_import.rs` | imports raw heartbeat history into the canonical store |
| `backend/api/src/repository/heartbeat.rs` | ClickHouse heartbeat/activity persistence and DDL |
| `backend/api/src/model/heartbeat.rs` | server heartbeat wire/model contract |
| `backend/api/src/model/wakatime_import.rs` | imported heartbeat payload contract |
| `backend/api/src/model/duration.rs` | duration response contract |
| `backend/api/src/bin/heartbeat-*.rs` | enrichment/verifier processing |

Also protected: any live `backend/api/src/handlers/`, `services/`, `repository/`,
`model/` or `infrastructure/` file that reads/writes `wakaclock.heartbeats`,
`activity_intervals`, `active_seconds`, `IDLE_TIMEOUT_MINUTES`, `ActivitySegment`,
or calls the heartbeat/timeline/duration services.

Derived consumers such as `backend/api/src/services/{all_time.rs,stats.rs,insights.rs,
dashboard_analytics.rs,project_analytics.rs}` are protected whenever they build or
present values from `ActivityTimelineService` or heartbeat rows. Do not change one
derived surface's calculation independently from the canonical timeline.

### 2. Client wire format, transport and offline delivery

| Path | หน้าที่ |
| --- | --- |
| `backend/api/crates/wakaclock-core/src/heartbeat.rs` | canonical client heartbeat type and interval helpers |
| `backend/api/crates/wakaclock-core/src/api_client.rs` | API delivery, filtering and retry classification |
| `backend/api/crates/wakaclock-core/src/queue.rs` | durable offline heartbeat queue |
| `backend/api/crates/wakaclock-core/src/broker.rs` | client broker/transport boundary |
| `backend/api/crates/wakaclock-cli/src/**` | CLI heartbeat producer and queue flush |
| `frontend/app/lib/wakaclock/endpoints.ts` | dashboard heartbeat/duration read and send endpoints |
| `extensions/vscode/src/**` | editor events, buffering, CLI delivery and external-file events |
| `extensions/browser/shared/**` | browser activity producer |
| `extensions/desktop-tracker/src/**` | desktop activity producer/privacy boundary |
| `extensions/ai-agents/**` | AI-agent heartbeat/event hooks |

การเปลี่ยน `wakaclock-core::heartbeat` ต้องเปลี่ยน server model และ ClickHouse DDL
พร้อมกันตาม [backend/crates.md](backend/crates.md); ห้ามแก้เพียงฝั่งเดียว.

### 3. Schema, audit และ data contracts

| Path | หน้าที่ |
| --- | --- |
| `backend/api/migrations/**` ที่แตะ heartbeat/activity/duration | schema หรือ audit ที่กระทบ ingest/readback |
| `migrations/**` ที่แตะ heartbeat/activity/duration | legacy/local schema contract |
| `backend/api/crates/wakaclock-core/src/ai/**` เมื่อ event ถูกแปลงเป็น activity/heartbeat | AI attribution ที่เปลี่ยน activity evidence |

ห้าม destructive migration ใน scope นี้โดยไม่มี approval แยกต่างหากและแผน rollback.

### 4. Dashboard/readback ที่ตีความเวลา

| Path | หน้าที่ |
| --- | --- |
| `frontend/app/app/dashboard/(auth)/wakaclock/heartbeats/**` | heartbeat inspection/send UI |
| `frontend/app/app/dashboard/(auth)/wakaclock/analytics/**` | timeline/analytics readback |
| `frontend/app/components/wakaclock/analytics/**` | duration/timeline presenters |
| `frontend/app/components/wakaclock/duration-timeline.tsx` | duration interval display |
| `frontend/app/components/wakaclock/range-picker.tsx` | range/timezone input boundary |
| `frontend/app/lib/wakaclock/{analytics.ts,dashboard-analytics-presenters.ts,format.ts}` | readback/formatting semantics |

Pure visual changesยังต้องถามก่อนถ้าแตะ label, unit, rounding, interval boundary,
empty state หรือข้อความที่อาจทำให้ผู้ใช้เข้าใจจำนวนเวลาเปลี่ยนไป.

## Safe investigation and token-efficient routing

เมื่อ task กล่าวถึง heartbeat/time/activity ให้ทำตามลำดับนี้:

1. อ่านเอกสารนี้ก่อน
2. อ่านเฉพาะไฟล์หลักในกลุ่มที่เกี่ยวข้อง ไม่โหลด `.context/` ทั้งหมด
3. ใช้ `rg` หา symbol/field ที่เกี่ยวข้องก่อนเปิดไฟล์ใหญ่:

```bash
rg -n "Heartbeat|ActivitySegment|active_seconds|activity_intervals|IDLE_TIMEOUT|union_activity_seconds|/heartbeats" \
  backend/api extensions frontend/app
```

4. ถ้าต้องแก้ protected scope ให้หยุดและขอ approval ตาม template ด้านบน
5. หลัง approval ค่อยเปิดไฟล์เต็ม, แก้ minimal diff และรัน test เฉพาะชั้นที่ได้รับผล

Reference หลักสำหรับ semantics คือ [docs/current-system-context.md](../docs/current-system-context.md),
[architecture.md](architecture.md), [backend/crates.md](backend/crates.md) และ
[extensions/overview.md](extensions/overview.md). เอกสารเหล่านี้อธิบาย behavior ปัจจุบัน;
แผนงานหรือ issue ไม่ใช่หลักฐานว่า logic ใดเปิดใช้แล้ว.

## Minimum evidence after an approved change

ต้องเลือก evidence ตาม scope แต่โดยทั่วไปประกอบด้วย:

- unit/regression tests ของ timeline, idle gap, overlap, dedup และ retry ที่ได้รับผล
- wire/serialization compatibility test ถ้าเปลี่ยน model หรือ client
- queue/offline/replay test ถ้าแตะ transport
- integration/readback test ยืนยัน accepted event ไม่หายและไม่นับซ้ำ
- `cargo fmt`, `cargo check`, targeted `cargo test` ใน `backend/api`
- test/lint/typecheck ของ client ที่แก้ และ evidence ของ migration ถ้ามี
- รายงานว่า default production mode และ rollback behavior ยังเหมือนเดิม

ห้ามสรุปว่า time-counting ถูกต้องจาก compile ผ่านอย่างเดียว.

Phase 2 lifecycle continuation: ตรวจพบ LaunchAgent เดิมทั้งสามมี persisted disabled override; แก้ explicit installer ให้ enable ก่อน bootstrap และเพิ่ม fixture จำลอง disabled state ภายในขอบเขต lifecycle/recovery ที่ผู้ใช้อนุมัติ ไม่เปลี่ยน producer/capture/duration/timeout หรือส่ง event สังเคราะห์เข้า account จริง.
