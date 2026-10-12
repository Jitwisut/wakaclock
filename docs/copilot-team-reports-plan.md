# แผนพัฒนา Copilot รายงาน Team และ CSV

ฐาน source `2c44b16` · วางแผน 12 ต.ค. 2026 · implementation และ local evidence อัปเดต 13 ต.ค. 2026

ผลส่งมอบและ runbook: [Copilot Team implementation](copilot-team-reports-implementation-2026-10-13.md) ยังไม่รับรอง GitHub/live staging หรือ production

## 1. เป้าหมายและขอบเขต

ต่อ connector/checkpoint/facts/self readback ที่มีแล้วให้หัวหน้าดู **ยอด Copilot ขององค์กร/ทีมรายสัปดาห์ตามข้อมูลที่สมาชิกอนุญาต** พร้อมความครบของข้อมูลและ CSV ที่ใช้ projection ชุดเดียวกัน

เจ้าของเลือก **สัปดาห์จันทร์–อาทิตย์ UTC สำหรับ Copilot แยกชัดเจน** รายงานอื่นขององค์กรยังคง timezone เดิม เช่น Asia/Bangkok ห้ามเปลี่ยนนโยบายทั้งองค์กรให้เป็น UTC หรือแบ่งยอดรายวันตามชั่วโมงโดยประมาณ

รุ่นแรก:
- องค์กรและทีม AtoAxis ที่ผู้ดูมีสิทธิ์; feature dimensions ตาม metadata ที่รับจริง
- 7 counters เดิม: generation/acceptance activity, suggested additions/deletions, actual additions/deletions และ user-initiated interactions ตาม provider definition
- รวมเฉพาะข้อมูลที่รับจริงภายใต้ verified identity, membership และ aggregate consent; รายละเอียดตนเองใช้ self endpoint เดิม
- ไม่มี ranking พนักงาน ไม่มี arbitrary day range และไม่มี leaderboard/individual drill-down จาก aggregate
- ยังไม่เพิ่ม acceptance-rate formula, token/model/cost, repository/PR/session allocation หรือ GitHub-team analytics; ต้องมี contract และ scope แยกก่อนเพิ่ม
- มุมมองที่พิสูจน์ suppression ไม่ได้เป็น withheld ไม่ลด threshold เพื่อให้ dashboard มีตัวเลข

## 2. นิยามสัปดาห์และ metric

หนึ่งสัปดาห์คือ `[Monday 00:00 UTC, next Monday 00:00 UTC)` รับได้เฉพาะสัปดาห์ที่จบแล้ว UI/API/CSV ใช้ selector เดียวกัน ช่วงอื่นหรือ timezone อื่นคืน error ชัดเจน

- `provider_timezone=UTC`, `report_timezone=UTC`, `organization_timezone` เป็น metadata แยก
- รวมแต่ละ counter ภายใน feature เดียวกัน; คงความหมาย suggested/accepted/agent edits ตาม provider ไม่แปลง line additions ทั้งหมดเป็น accepted inline completions
- `0` ใช้เมื่อ provider ยืนยันค่าศูนย์จริง; row/feature/counter ที่ไม่มีหลักฐานเป็น unknown ไม่สร้างศูนย์
- counter ที่มีบางข้อมูลแสดง **ยอดที่สังเกตได้** พร้อม partial; ไม่มีค่าที่อ่านได้หรือถูก suppression เป็น null พร้อมเหตุผล
- contributor threshold ใช้ผู้ร่วมข้อมูลจริงของ metric/scope นั้นอย่างน้อย 5 คน ไม่ใช้จำนวนสมาชิก/seat; แยก known/unknown และ positive/zero cohorts ร่วมตรวจการอนุมาน กลุ่มศูนย์ไม่ใช้เติมจำนวนเพื่อซ่อนผู้ใช้ที่มีกิจกรรมเพียงคนเดียว
- completeness ของการดาวน์โหลด, ความพร้อมของ metric, consent coverage และ capture coverage เป็นคนละเรื่อง 7 daily jobs สำเร็จไม่พิสูจน์ telemetry ของทุกคนครบ
- ใบรายงานระบุ source, exact window, observed_at, provider definition/calculation version, source revision และ privacy generation
- cohort/coverage counts และกลุ่มที่ไม่มีข้อมูลใช้ suppression เช่นเดียวกับยอด ไม่เผยจำนวนกลุ่มเล็กผ่าน tooltip/health/CSV

## 3. ปิดฐานข้อมูลก่อนเปิดยอดรวม

ต่อจาก `036_team_copilot_daily.sql` ด้วย additive migration ถัดไปหลังตรวจ HEAD ไม่เปลี่ยน canonical heartbeat/usage

เพิ่ม:
1. Report policy ของ family `copilot_daily_weekly` ที่ UTC และ locked หลังเผยแพร่ครั้งแรก; organization policy เดิมคงอยู่
2. Provider-day revision/manifest: account/user identity ที่ยืนยัน ณ เวลารับ, schema/definition, source hash, projection revision, dispositions และ completeness ที่มีหลักฐาน
3. Membership scope history/snapshot ที่มี effective interval จริง ทั้งองค์กรและ AtoAxis teams; joined_at ที่มีอยู่ใช้ได้เมื่อพิสูจน์ต้นทาง แต่ missing historical rows ไม่เติมจาก roster ปัจจุบัน เริ่มเก็บประวัติใหม่ไปข้างหน้าและ backfill เฉพาะหลักฐานที่เชื่อถือได้
4. Publication identity ที่มี family/explicit UTC start–end/timezone/calculation version/scope และ bundle ของ equations/facts/revisions; ใช้ทะเบียนความเป็นส่วนตัว **ร่วมทั้งองค์กร** เดิม รวม export/restore และ schema version ของ independent ledger
5. รายงาน correction barriers และ checkpoints ที่ privacy worker/restore เข้าใจได้

การจัดทีม:
- ใช้ membership ที่ยืนยันว่ามีผลครบ provider UTC day; ย้ายทีม/เข้าทีมกลางวันแล้วแยกยอดภายในวันไม่ได้ ให้ excluded/partial ตามหลักฐาน
- การไม่มีประวัติไม่อนุญาตให้ย้ายข้อมูลส่วนตัวเก่าเข้า Team ย้อนหลัง
- สมาชิกซ้อนหลายทีมต้องไม่ถูกบวกซ้ำในยอดองค์กร และยอดทีมไม่จำเป็นต้องบวกเท่ากับองค์กร
- ถอนสมาชิกหรือ scope บล็อกอ่านทันที; historical membership เป็นหลักฐานการจัดกลุ่ม ไม่ได้คืนสิทธิ์ที่ถูกถอน
- Legacy facts ที่ไม่มี snapshot/provenance ใหม่ต้องเป็น legacy-unconfirmed หรือได้รับการ reconcile ด้วย provider evidence จริง ห้ามใช้ identity ปัจจุบันแทนย้อนหลัง

## 4. Privacy projection และ publication

สร้าง projection กลางที่ dashboard/API/CSV เรียกร่วมกัน แทนเพิ่ม SQL SUM แยกในแต่ละหน้า

ลำดับอ่าน:
1. ตรวจ organization role/team scope, rollout/feature flag, provider installation/identity, consent version/time และ retention cutoff
2. โหลด facts ของ exact UTC week และ membership ที่มีหลักฐาน; deduplicate ด้วย provider account/user/day/feature/metric identity ไม่ใช้ installation ID เป็นเหตุเพิ่มยอดซ้ำ
3. สร้าง candidate bundle ของ feature × counter รวม main total, subtotals, null masks, contributor/fact support, membership/consent versions และ source manifests ไม่ปล่อย 7 counters เป็น scalar releases ที่ไม่ตรวจร่วมกัน
4. ตรวจ ≥5 คนราย metric และทุก nonempty distinguishable cohort จาก intersections/complements รวมองค์กร/ทีมซ้อน/feature/known–unknown/positive–zero/วันร่วมข้อมูล และทะเบียนรายงานเดิมทุก family; หาก proof ไม่พอให้ withheld
5. เลือก safe cells อย่าง deterministic และบันทึกทั้ง bundle/การตัดสินถาวรใน publication registry ก่อนส่งตัวเลข UI/API/CSV เลือกจากการตัดสินเดียวกัน ไม่เติม cell ที่เคยซ่อนไว้เมื่อมีข้อมูลใหม่
6. ตรวจ privacy generation, source revision, integration/identity/scope อีกครั้งก่อนส่ง JSON หรือ CSV bytes ถ้าเปลี่ยนให้ยกเลิกผลและโหลดใหม่

ทะเบียนเดิม conservative มาก: มุมมองผู้ร่วมข้อมูลซ้อนกันที่ต่าง equation ถูก withheld ต้องออกแบบ report family/equation ด้วย proof ก่อนเปิดหลาย view ไม่แก้ด้วย registry ใหม่หรือข้าม `safe_views` การจัด namespace ไม่เป็นหลักฐานว่าข้อมูลไม่สัมพันธ์กัน

ขอบเขต P3 ที่ใช้หลังเจ้าของสั่งลงมือ: deterministic organization-week bundle ขององค์กรและทุกทีม ตรวจ joint partitions ก่อนเปิดตัวเลข มุมมององค์กรและทีมที่ผ่าน proof จึงดูพร้อมกันได้ ส่วนมุมมองที่พิสูจน์ไม่ได้คง withheld และ Owner/Admin ข้าม consent ไม่ได้

Legacy ledger ที่ไม่มี explicit window/support proof ยังเป็น opaque conservative barrier ไม่สรุปว่าไม่เกี่ยวข้องจาก report family คนละชื่อ และไม่ลดกฎเดิมเพื่อให้เผยยอดได้

## 5. Corrections, withdrawal และวงจรข้อมูล

ช่องที่ต้องแก้ก่อนอ่านรวม: ปัจจุบัน `CopilotDailyRepository::stage` replace facts ของ provider day แต่ยังไม่มี weekly source revision/publication invalidation ที่รับรอง

- เปรียบเทียบ old/new normalized day manifest ภายใต้ organization publication lock เดียวกัน: presence/absence, null masks, eligibility, conflict/rejection disposition และ committed ingestion completeness; facts/eligibility/manifest เดิมไม่ invalidate จาก polling อย่างเดียว
- Replace day facts, advance source revision และสร้าง affected-publication barrier ใน transaction เดียวกัน รวมกรณี changed-to-empty, late-added rows และ missing→known metric; stable fact identities ไม่เปลี่ยนตาม payload hash/revision เพื่อป้องกัน correction ปลอมเป็นข้อมูล disjoint ใหม่
- ถ้าเป็นข้อมูลใหม่/correction/conflict disposition/consent/roster/identity/scope ที่เปลี่ยนยอดเผยแพร่แล้ว ให้บล็อก exact affected publication windows และบันทึก reason/revision ใน transaction ที่ serialize กับ publication
- Copilot UTC window และรายงาน timezone อื่นที่เกี่ยวข้องต้องถูกค้นจาก actual fact/window dependencies ไม่ตีความ Monday date ว่าเป็นช่วงเดียวกัน
- สัปดาห์ที่เผยแพร่แล้วถูกยกเลิกและ **ไม่เผยยอดแก้ไขซ้ำ** ตาม Phase 2; UI แสดง invalidated พร้อมเหตุผลที่ไม่เปิดกลุ่มเล็ก
- Data correction ที่ไม่เคย publish ยัง reconcile ได้ เมื่อพร้อมจึง publish ครั้งแรก; partial/missing facts ที่เพิ่มภายหลัง publish ถือเป็น correction เช่นกัน
- Database กับ independent registry ไม่ใช่ atomic store เดียวกัน: ถ้า crash/registry fsync ล้มหลัง DB barrier ให้ fail closed จน reconcile head ได้ ไม่เปิด old/corrected totals
- Weekly release ตรวจ source revisions อีกครั้งภายใต้ release lock และตรวจ fence หลัง export ledger; fact support สำหรับ numeric Copilot releases เป็นข้อบังคับ ไม่ใช้ optional proof
- Retention 12 เดือนปฏิทิน: cutoff ตอนอ่านทันที; cleanup แบบ batch/lease/checkpoint รวม manifests, membership evidence, publications และ derived metadata
- deletion/revocation markers อยู่แยกจาก backup ตาม Phase 2; restore ก่อนถอนสิทธิ์ต้องใช้ทะเบียนล่าสุดก่อนเปิดอ่าน ถ้าขาดหรือ stale ปิดรายงาน
- คง heartbeat/usage ส่วนบุคคล, accepted IDs, daily checkpoints และ migration เมื่อ rollback

## 6. API, CSV และ UI

เสนอเพิ่มแบบ additive:
- `GET /api/v2/organizations/:id/copilot/reports?week_start=YYYY-MM-DD&timezone=UTC&team_id=...`
- `GET /api/v2/organizations/:id/copilot/reports/export?...` ใช้ projection/publication proof เดียวกัน
- Capability `copilot_weekly_reports` และ `copilot_weekly_csv` ปิดไว้จน local privacy gate ผ่าน

Metric envelope: nullable value, status/reason, observed coverage, provenance, exact window/timezone, source revision, privacy generation, freshness, calculation/provider-definition version และ publication ID

CSV ไม่เปิด user_id/login/contributor list ไม่มี hidden unsuppressed total ใน raw rows; withheld เป็น null พร้อม reason ไม่ใช้ 0; canonical row/window/metric/version ตรงกับหน้า report CSV ใช้ safe cell escaping และยกเลิกเมื่อ scope เปลี่ยนระหว่างสร้าง ก่อนส่ง bytes ตรวจ generation/revision อีกครั้ง

หน้ารายงาน:
- เลือก closed UTC week และทีมในสิทธิ์ แสดง timezone ชัด
- การ์ดยอด observed, ตาราง feature/counters, last update และ coverage ตามหลักฐาน
- สถานะ pending/partial/withheld/unavailable/invalidated แยกจาก zero; ไม่มีข้อมูลไม่ถูกนำเสนอว่าไม่ได้ใช้ Copilot
- export CSV ของมุมมองที่อนุญาต; ข้อมูลที่ถูก withholding ในหน้าจอไม่หลุดทาง export
- สลับบัญชี/องค์กร/ทีม, consent/scope เปลี่ยน หรือโหลดใหม่ล้มเหลว ซ่อน cache เก่าและยกเลิก download
- รายละเอียดรายคนไม่เพิ่มในรอบนี้; self readback เดิมยังผ่าน individual consent

## 7. ลำดับ implementation และจุดส่งมอบ

| ชุด | งาน | เกณฑ์จบ |
|---|---|---|
| P1 | UTC report contract, metric/coverage fixtures, suppression/correction regressions | expected ledger อิสระและ privacy equations ชัด; ไม่เริ่มเปิด numeric aggregate ก่อน regression |
| P2 | additive manifests/revisions/membership policy, correction barriers และ restore inventory | accepted facts ไม่หาย/ซ้ำ; unchanged poll ไม่ invalidate; changed published week fail closed |
| P3 | shared report projection + publication/independent ledger | final authorization/revision race, ≥5 และ cross-view/complement checks ผ่าน |
| P4 | authenticated report/CSV endpoints + capability flags | JSON/CSV ตรง ledger; same projection; no hidden personal/group data |
| P5 | Team UI/health/cache closure และ export | user flows และ account/consent switching ผ่าน; withheld ไม่ใช่ zero |
| P6 | isolated integration/restore/performance, runbook และ evidence | local development gate ผ่าน; live/provider/staging certification ยังตัดสินแยก |

ทำบน `codex/...` แยกจาก main ต่อจาก `2c44b16` และแยกไฟล์ค้างงานอื่น backend/migration → privacy worker → GitHub daily worker → UI เปิดเฉพาะองค์กรทดลอง

ไม่สร้าง service/container เพิ่มเพื่อ report: ใช้ worker/registry เดิมและ bounded jobs หาก materialization จำเป็นต้องมี immutable revisions/lease/checkpoint/retention proof ก่อนเปิด reader

## 8. Tests และเกณฑ์รับงานที่แยกจากการพัฒนา

| ชุด | ต้องพิสูจน์ |
|---|---|
| Week contract | closed Mon–Sun UTC; UTC/Bangkok boundary; future/open/custom ranges ถูกปฏิเสธ; report families ไม่เปลี่ยน policy เดิม |
| Counter ledger | 7 nullable fields, 0/null/missing/unknown feature, separate feature semantics, duplicate install/retry, report correction, overflow และ independent expected sums |
| Coverage | 6/7 report days, finished ingestion แต่ telemetry unknown, row quarantined, late data, missing metric; partial sums ไม่ถูกเรียกว่า full adoption |
| Identity/membership | verified numeric identity/account, account switch, consent mid-day, join/leave/transfer mid-day, historical membership missing, overlapping teams และ old facts ไม่มี provenance |
| Privacy | cohort 4/5 จริงราย metric, known/unknown/positive/zero, main/subtotal/complement, several viewers/CSV, nested/overlapping team views, same users แต่คนละ daily support, count/tooltip/coverage leakage และ correlated report families |
| Races | consent/repository or team scope revoked, installation disabled, source correction ระหว่าง build/read/export; result ถูกยกเลิกก่อน response |
| Publication | unchanged hashes/poll ไม่ invalidate; changed published facts block week; no corrected republish; concurrent first publication/CSV/retry serialize |
| Durability/restore | crash ก่อน/หลัง day commit/barrier/registry sync/export; registry unavailable/stale; old backup before withdrawal/correction; pending jobs resume without duplicate |
| Retention | 12 calendar months, leap/end-month cutoffs, derived metadata cleanup and current-read boundary; canonical personal facts ไม่ถูกลบ |
| Regression | Team/privacy/health เดิม, duration golden input เดิม และ backlog 1,191 รายการ |
| Performance | p95 weekly report ≤2s บน isolated staging-equivalent synthetic organization 100 คน/ประวัติ 90 วัน; bound payload/queries/registry growth; exact environment/build recorded |
| Live gate | actual GitHub App existing metrics permission/report payload, same ledger in UI/API/CSV, withdrawal/correction/restore flows และ deployment build จริง |

เกณฑ์ **พัฒนาเสร็จ**: P1–P6 ไม่มี code gap, local tests/typecheck/strict Clippy ผ่าน และรายงาน tests/gaps/build ครบ ไม่ใช้ fixture แทน live source evidence

เกณฑ์ **พร้อมทดลองบน staging**: actual configuration/permission พร้อม, build ตรง, privacy registry healthy, expected ledger/UI/API/CSV และ fault/withdrawal tests จริงผ่าน ไม่เปิด production/checkout/Marketplace จากผลนี้

หลังจบส่งรายงาน: เสร็จแล้ว / ยังไม่เสร็จ / รอเจ้าของหรือ external / งานถัดไป พร้อม commit, exact tests และ evidence ใช้ Docker เฉพาะ dependency จำเป็นข้อมูลแยก แล้วปิดบริการที่เปิดโดยเก็บ volumes

## 9. Sources และขอบเขตการอ้าง

- [GitHub Copilot example schema](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema): field/feature granularity; รุ่นนี้ใช้ 7 counters ที่ระบบเก็บอยู่ ไม่อ้างว่า provider ไม่มี field อื่น
- [REST Copilot usage reports](https://docs.github.com/en/rest/copilot/copilot-usage-metrics): provider report acquisition; ไม่เพิ่ม permissions หรือ credential surface โดยอัตโนมัติ
- นโยบาย consent/suppression/publication/retention ของ AtoAxis ใช้ [Team Phase 2](atoaxis-team-phase2.md)
- ฐานโค้ดและข้อจำกัดล่าสุด: [adapter closure](adapter-development-closure-2026-10-12.md)

จุดที่เจ้าของยืนยันแล้ว: Copilot ใช้ closed UTC week. GPT-6 Astra ทบทวน architecture แบบ read-only แล้วเมื่อ 12 ต.ค. 2026: เพิ่ม bundle semantics, stable fact support, day revision barrier, historical membership และ cross-family ledger/restore ในแผนแล้ว การทบทวนนี้ไม่ใช่ผลทดสอบหรือรับรอง implementation

Implement แบบ joint organization/team bundle ตามข้อ 4 แล้ว; ผลตรวจ implementation/local tests และหลักฐานภายนอกที่ยังขาดอยู่ในรายงานส่งมอบ ไม่ใช้การทบทวน architecture แทน live certification
