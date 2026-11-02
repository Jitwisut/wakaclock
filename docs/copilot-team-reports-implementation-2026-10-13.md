# Copilot Team weekly reports — implementation และหลักฐาน

ตรวจ 13 ต.ค. 2026 (Asia/Bangkok) บน `codex/heartbeat-capture-release` ต่อจาก `2c44b16ddff9c6780253338f05e79f03115eddd0` รายงานนี้รวมอยู่ใน commit ส่งมอบงาน Copilot Team; หลักฐานทดสอบถูกบันทึกก่อน commit พร้อม source hashes ไม่ใช่การรับรอง release candidate

## ผลส่งมอบ

| งาน | พัฒนา | Local evidence | Live/staging |
|---|---|---|---|
| Closed Monday–Sunday UTC, 7 nullable counters | เสร็จ | Week boundary, missing/null/zero, duplicate/overflow tests | pending |
| Migration 037, provider identity snapshot, day manifest/revision | เสร็จ | PG migration ซ้ำ, unchanged poll, changed-to-empty, correction barrier | pending |
| Historical membership และ joint organization/team projection | เสร็จ | 4/5 คน, positive/zero, complements, daily support, rare feature, deterministic bundle | pending |
| Immutable publication, final authorization/source fence | เสร็จ | Consent/identity/user status changes, source regression, ledger/export checks | pending |
| Shared JSON/CSV API และ Team UI | เสร็จ | 18 frontend regressions; typecheck; targeted ESLint | actual UI/API/CSV pending |
| Independent privacy ledger v2 / restore | เสร็จ | Native PostgreSQL backup → fresh instance → latest ledger; old read denied | Cloud/real deployment pending |
| Retention inventory / read cutoff | เสร็จในขอบเขตข้อมูลใหม่ | UTC calendar cutoff และ Team cleanup regression | backup expiry policy/Cloud gate แยก |
| Performance | Local service ผ่าน | 100 คน, 90 วัน, 9,000 facts, 20 samples, p95 1.567233s | HTTP/browser/concurrent staging load pending |

สถานะนี้รับรองโค้ดและการตรวจในเครื่องตามรายการหลักฐานข้างล่าง ยังไม่ใช่ “รับรองใช้งานจริงครบ” และไม่เปิด production โดยอัตโนมัติ

## พฤติกรรมที่เพิ่ม

- API `/api/v2/organizations/:id/copilot/reports` และ `/export` รับ `week_start=YYYY-MM-DD&timezone=UTC` กับ optional `team_id`; ปฏิเสธ open week, arbitrary range และ timezone อื่น
- องค์กรยังใช้ timezone เดิม เช่น Asia/Bangkok ส่วน Copilot window คือ `[Monday 00:00 UTC, next Monday 00:00 UTC)`
- Report/CSV ใช้ projection และ publication เดียวกัน: null/withheld ไม่เป็นศูนย์, ไม่ส่ง contributor IDs/counts หรือ private publication proof; CSV ป้องกัน spreadsheet formula injection
- ตรวจ consent, current role/scope, verified provider identity, retention และ membership ที่มีผลครบ provider day; migration เริ่มประวัติจากเวลาที่สังเกต ไม่เติม roster ในอดีต
- Org/team/features/counters ตรวจร่วมกันกับ participation รายวัน, zero/missing/positive groups และ complements; ส่วนที่พิสูจน์ไม่ได้ withheld และไม่เปิดชื่อ rare feature ผ่านแถวว่าง
- กติกาอื่นในทะเบียนองค์กรยังเป็น conservative barriers: legacy history ที่พิสูจน์ไม่ได้อาจทำให้รายงานใหม่ withheld แม้คนในแต่ละทีมครบ 5 คน
- เปลี่ยน daily facts และ manifest/revision/invalidation ใน transaction เดียวกัน; poll เดิมเปลี่ยนเฉพาะ observation time ไม่ invalidate สัปดาห์ สัปดาห์ที่เผยแพร่แล้วถูก correction/withdrawal ไม่เผยยอดแก้ใหม่
- JSON/CSV ตรวจ fence อีกครั้งหลังสร้างผล; UI ซ่อนข้อมูลเก่าเมื่อ reload ล้มเหลว เปลี่ยนบัญชี/องค์กร/ทีม หรือสิทธิ์หาย และไม่ดาวน์โหลด CSV ที่ตอบกลับภายหลัง scope เปลี่ยน
- Provider jobs/facts ที่รับแล้วไม่ถูกแปลงเป็น heartbeat, session, PR cost หรือ token estimate; capture completeness ยังคง `unconfirmed` แม้ดาวน์โหลด daily reports ครบ
- Privacy generation เปลี่ยนเมื่อ consent/roster/provider identity/installation/account status เปลี่ยน แต่ token refresh ที่ไม่เปลี่ยนสิทธิ์ไม่ทำให้รายงานสัปดาห์ invalidated

## Ledger v2 และลำดับติดตั้ง

1. ปิด weekly flag ระหว่าง rollout; receiver/backend รองรับ migration 037 ก่อน worker/UI
2. สำรอง DB และ independent ledger เดิมแยกกัน แล้วใช้ backend/`team-privacy-worker` รุ่นใหม่ คู่กัน
3. Migration 037 ปิด legacy publications และเพิ่ม generation ครั้งเดียว; repeated migration ไม่เพิ่ม generation ซ้ำ
4. Worker รุ่นใหม่รับ ledger v1 เฉพาะ monotonic upgrade/closed restore และเขียน v2 แบบ fsync/atomic rename; normal read ต้องใช้ v2 สดไม่เกิน 5 นาที
5. v2 ทุก organization ต้องมี `copilot_sources` แม้เป็น map ว่าง; field หาย/schema ไม่รู้จัก/.tmp ที่พยายามย้อน v2→v1 ต้องถูกปฏิเสธ รุ่นเก่าที่รองรับเพียง v1 จึงเปิด/เขียน ledger ใหม่ไม่ได้
6. v1 ที่ไม่มี source heads แต่ DB มี Copilot publications ต้องปิด rollout และ invalidate publications ผ่าน restore reconciliation ก่อน upgrade ห้ามเติม proof แล้วอ้างว่ารายงานเดิมครบ
7. เปิด daily worker รุ่นใหม่ให้เก็บ verified GitHub user/account ณ ingestion แล้วจึงใช้ UI ใหม่ Legacy facts ที่ไม่มี snapshot ไม่เข้า aggregate จากการเดา identity ปัจจุบัน
8. เปิด `ATOAXIS_COPILOT_DAILY_ENABLED=1` และ `ATOAXIS_COPILOT_WEEKLY_ENABLED=1` เฉพาะองค์กรทดลองที่ Team rollout/provider configuration/ledger พร้อม ค่าเริ่มต้น weekly ปิด

ใช้ `ATOAXIS_TEAM_PRIVACY_LEDGER_PATH` ของ environment เดิมที่เก็บนอก database backup; ไม่สร้าง ledger ว่างทับ head ที่มีอยู่ เมื่อ restore ให้ใช้ `team-privacy-worker --reconcile-restore` กับทะเบียนล่าสุดก่อนอ่าน แล้ว export head ใหม่ sharing/rollout/integration ยังปิดจน reauthorize ตาม runbook เดิม

Rollback ด้วยการปิด weekly flag/ช่องทาง UI รักษา migration, accepted facts, source heads และ publication barriers ห้าม downgrade privacy worker ไป binary ที่รับเฉพาะ v1 หรือแก้เลข schema ในไฟล์เอง ต้องใช้ worker ที่เข้าใจ v2 ต่อไป ไม่ลบ heartbeat/queue ส่วนบุคคล

## Local verification ที่รัน

| ตรวจ | ผล |
|---|---|
| Server library | 429 passed, 37 ignored, 0 failed; ignored external tests ไม่ถูกนับเป็นผ่าน |
| Core library | 404 passed, 2 ignored, 0 failed |
| Strict server Clippy all-targets | ผ่าน `-D warnings` |
| Frontend Copilot weekly/daily, Team insights/Trust | 18 passed (weekly ใหม่ 6), 0 failed |
| Frontend TypeScript และ targeted ESLint | ผ่าน |
| Duration port และ golden | ผ่าน; synthetic total/daily errors = 0; input/formula เดิม |
| CLI idle delivery 1,191 across three days + one new heartbeat | 1 passed, drain 37.2553s, 1,192 distinct IDs; mock localhost/temporary HOME |
| Native PG weekly integration และ restore | ผ่าน seed/revoke/verify และ benchmark; ไม่มี Docker/ClickHouse service เพิ่ม |
| Existing PG daily connector / Team registry cleanup | ผ่าน 2 ignored integration tests ที่รันจริงทีละชุดบน fixture |
| Concurrent publication/readback | Reader รอ publication lock ขณะ correction; rollback ไม่เปลี่ยนยอด/barrier และ final JSON/CSV gate ปฏิเสธผลเก่า |
| Registry schema | v2 missing source heads/unknown version ปฏิเสธ; v1 upgrade→v2; abandoned .tmp downgrade ปฏิเสธ |
| Read-only GPT-6 Astra review | จุด P1 ที่พบถูกแก้; narrow final review ไม่พบ P1/P2 เพิ่ม ผลนี้ไม่แทน tests |

คำสั่งหลัก:

```sh
cargo test --manifest-path backend/api/Cargo.toml -p wakaclock-server --lib
cargo test --manifest-path backend/api/Cargo.toml -p wakaclock-core --lib
cargo clippy --manifest-path backend/api/Cargo.toml -p wakaclock-server --all-targets -- -D warnings
cargo test --manifest-path backend/api/Cargo.toml -p wakaclock-cli --test offline_lifecycle backlog_1191_across_three_days_drains_on_idle_worker_ticks -- --nocapture --test-threads=1
python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py
python3 scripts/copilot-reports-restore-drill.py
```

Restore drill ใช้ PostgreSQL 16 native จาก Homebrew, localhost ports 56437/56438 และ DB `atoaxis_team_test` เฉพาะ fixture สร้าง directory ใหม่ 0700 ทุกครั้ง เปิดครั้งละหนึ่ง instance และหยุดใน finally; ไม่อ่าน app env files/credentials หรือแตะฐานจริง Backup และ independent ledger เก็บใน private temporary directory; output เป็น metadata/log ของ fixture เท่านั้น

หลักฐาน machine-readable: `output/copilot-reports-local/restore.json` (สร้างในเครื่องโดย `scripts/copilot-reports-restore-drill.py` และไม่เก็บใน git) รวม UTC timestamp, base SHA, source hashes, backup hash และ benchmark scope สำเนารายรอบอยู่ใน `drill-*/restore.json` การวัด 1.57s เป็น service test รวม authorization/ledger fsync/JSON/CSV/final fence บน native PG และ debug build ไม่ใช่ HTTP p95 หรือ production-equivalent concurrent load certification

## สิ่งที่ยังไม่ผ่าน/ควรทำต่อ

1. สร้าง candidate build จาก commit ส่งมอบนี้ใน checkout สะอาด; build/runtime SHAs ต้องตรงก่อนรับรองจริง
2. ตรวจ payload/configuration/metrics permission กับ GitHub App จริง โดยไม่ขยาย scope เอง แล้ว reconcile expected ledger บน API/UI/CSV
3. ทดสอบ HTTP/browser จริง รวม account/consent switching และ HTTP concurrent correction/withdrawal/export, registry fsync interruption และ retention/fault/recovery ด้วย candidate เดียวกัน ขณะนี้ local regressions ไม่ใช่ live evidence
4. วัด staging-equivalent HTTP p95 ≤2s พร้อม concurrency/payload/query limits และ records 100 คน/90 วัน ผล local service ไม่ทดแทน gate นี้
5. Cloud backup/restore, provider certification, Stripe/commercial flow และ heartbeat canary 7 วันจริงยังเป็น gates แยก

ไม่ปรับ duration/timeout/capture ให้ยอดเท่ากับ provider ไม่แจก daily metrics ลง session/PR ไม่ประกาศว่ารายวัน provider ดาวน์โหลดครบหมายถึงจับกิจกรรมครบ งานส่งมอบ commit/push เฉพาะ branch `codex/heartbeat-capture-release`; ไม่มีการเปลี่ยน main
