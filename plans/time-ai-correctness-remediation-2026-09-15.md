# แผนแก้ความถูกต้องของเวลาและ AI attribution

วันที่: 2026-09-15
สถานะ: **กำลังดำเนินการ — ดูสถานะรายขั้นและข้อจำกัดใน [progress](time-ai-correctness-progress-2026-09-16.md)**
ฐานการตรวจ: commit `00d03b64225bcf831dfe6909e83c4fd8182ba48f`
อ้างอิง: [รายงานตรวจ](../docs/time-ai-review-2026-09-15.md)

แผนนี้เป็นรายละเอียดงานแก้ไขเพิ่มเติมภายใต้ [ROADMAP](ROADMAP.md) ไม่แทนที่
งาน coverage ทั้งหมด และไม่ใช้สถานะผ่านของงานเก่ามาปิดข้อผิดพลาดที่พบใหม่
ใช้กติกา [accuracy over coverage](decision-accuracy-over-coverage.md) และ
[unknown authorship](decision-unknown-authorship-vs-unattributed-ai.md) ต่อไป

## 1. ผลลัพธ์ที่ต้องได้

1. AI จะถูกนับว่าแก้โค้ดแล้วต่อเมื่อมีหลักฐานการแก้สำเร็จ; คำสั่งที่เพียงเสนอ patch ไม่พอ
2. จำนวนบรรทัดถูกต้องตามนิยามเดียวกัน พร้อมแยกค่าศูนย์ออกจากค่าที่วัดไม่ได้
3. Agent, provider และ model มีหลักฐานผูกกับ operation/turn เดียวกัน
4. เวลา editor, เวลา AI ที่วัดได้ และเวลารวมไม่ถูกนับซ้ำ และทุกหน้าคำนวณสอดคล้องกัน
5. หลักฐานเทียบ WakaTime มาจากข้อมูลจริงของทั้งสองระบบและเงื่อนไขที่ตรวจสอบได้
6. ข้อมูลย้อนหลังแก้ได้อย่างมีหลักฐาน ตรวจสอบย้อนหลังและทำซ้ำได้โดยไม่เพิ่มยอด
7. รุ่นที่ปล่อยแสดงขอบเขตการรองรับตามผลรับรองจริง

ไม่ประกาศว่า “แม่นกว่า WakaTime” จากการผ่าน unit tests หรือยอดรวมที่ใกล้กันเท่านั้น
การพิสูจน์ว่าเหนือกว่าต้องมีผลเทียบกับกิจกรรมอ้างอิงที่บันทึกแยกจากทั้งสองระบบ
และระบุ client/version/scenario ที่ผลนั้นครอบคลุม

## 2. ลำดับงานและ dependency

| รหัส | งาน | ระดับ | ต้องเสร็จก่อน | ผลส่งมอบ |
| --- | --- | --- | --- | --- |
| TA-00 | ตรึงนิยามและ baseline | P1 | — | สัญญาข้อมูล/รายการ regression/ผลทดสอบก่อนแก้ |
| TA-01 | ตรวจผลสำเร็จจริงของ tool | P1 | TA-00 | หยุด false verified edits |
| TA-02 | แก้ parser diff และจำนวนลบที่ไม่ทราบ | P2 | TA-00 | ตัวนับที่ถูกต้องและรักษา null |
| TA-03 | ทำหน่วยการนับ editor ให้สอดคล้อง | P2 | TA-00, TA-02 | versioned line metrics และ attribution ต่อช่วงแก้ |
| TA-04 | ยืนยัน model และแสดง coverage ทุกชั้น | P1 | TA-01–03 | API/UI ที่แยก identity, outcome, measurement |
| TA-05 | ทำการวัดเวลาและเครื่องมือเทียบให้ตรวจสอบได้ | P1 | TA-00 | controlled comparison runner + duration regressions |
| TA-06 | ตรวจและแก้ข้อมูลย้อนหลัง | P1 | TA-01–05 | dry-run, revision repair, audit และ rollback |
| TA-07 | รับรอง runtime และเวลาแบบ end-to-end | P1 | TA-01–06 | live certificates + ช่วงเทียบเวลาใหม่ |
| TA-08 | ปล่อยรุ่น ติดตาม และปิดงาน | P1 | TA-07 ตาม scope ที่จะปล่อย | artifact verification, rollout/rollback, closeout |

ทำ TA-01/02 ก่อนการขยาย integrations; เตรียม TA-05 ระหว่างแก้ความถูกต้องได้
แยก PR ตามรหัสงาน ยกเว้น wire/storage changes ที่ต้องส่งร่วมกันเพื่อรักษาความเข้ากันได้
สถานะรายงานใช้ `planned`, `in_progress`, `implemented`, `validated_local`,
`validated_live`, `released`, `blocked` พร้อมหลักฐาน ห้ามใช้ `done` ครอบทุกระดับ

## 3. TA-00 — นิยามและ baseline

- [ ] ย้ายตัวอย่างจำลองใน `/tmp/wakaclock-audit-20260915/` เป็น regression fixtures
  แบบสังเคราะห์ใน repo; ไม่ให้การทดสอบพึ่งไฟล์ชั่วคราวหรือ source ส่วนตัว
- [ ] บันทึก commit, parser version, protocol, runtime และผลทดสอบก่อนแก้
- [ ] ตรึง 4 แกนที่เป็นอิสระ: ใครแก้ / ใช้ model ใด / แก้สำเร็จหรือไม่ / วัดได้เท่าไหร่
- [ ] กำหนดผล tool เป็น success, failure, partial หรือ unavailable ในชั้น normalize;
  เลือกชื่อ wire fields หลังตรวจ compatibility inventory ไม่เพิ่ม enum ลง strict wire โดยตรง
- [ ] กำหนด line metric เป็น **จำนวนบรรทัดเพิ่ม/ลบจาก before/after ของช่วงแก้ที่กำหนด**
  ไม่ใช่จำนวนบรรทัดที่ยังเหลือใน repository หรือคะแนน productivity
- [ ] ตัวเลขคนและ AI ที่นำมาเทียบต้องใช้ metric version, ช่วงวัด และกฎ diff เดียวกัน;
  ข้อมูลคนละนิยามต้องแยกหรือระบุว่าเปรียบเทียบไม่ได้
- [ ] คง `chars_added/deleted` เป็นจำนวนอักขระ และหยุดแสดง `keystrokes` เดิมเป็น
  จำนวนกดแป้นจริง หากไม่มี input evidence ที่วัดการกดแป้นได้

**เกณฑ์ผ่าน:** มี decision table สำหรับ success/failure/partial/unknown,
known/unknown model และ known/unknown lines; tests ใหม่ทำให้เห็นข้อผิดพลาดเดิมก่อนแก้

## 4. TA-01 — Tool outcome ที่เชื่อถือได้

จุดแก้หลัก: `backend/api/crates/wakaclock-core/src/ai/codex.rs`, `event.rs`,
`parser.rs`, และ hook/producer ที่มีการแปลงผล tool ซ้ำ

- [ ] แยก “wrapper ทำงานเสร็จ” จาก “file tool ภายในแก้สำเร็จ”
- [ ] รองรับ result envelope ที่มีหลักฐานรูปแบบจริง; อ่านเฉพาะส่วนจำเป็นในเครื่อง
  แล้วทิ้งข้อความ ไม่ส่งหรือเก็บ output/source/patch ใน telemetry
- [ ] ผลไม่มี status: รับรองได้เฉพาะมีผลสำเร็จในรูปแบบที่ adapter รู้จัก;
  หากพิสูจน์ไม่ได้ให้ outcome unavailable และไม่ใช้จำนวนจาก patch ที่ร้องขอเป็นยอดที่แก้สำเร็จ
- [ ] failure/no-op ไม่สร้างบรรทัดที่แก้สำเร็จ; partial นับเฉพาะไฟล์ที่ยืนยันแล้ว
- [ ] คง session/usage และช่วงเวลาที่สังเกตได้จริงแยกจากผลแก้ไฟล์;
  ไม่ลบเวลาที่วัดจริงเพียงเพราะการแก้ล้มเหลว
- [ ] ตรวจการเรียกซ้อน หลาย apply_patch ใน wrapper เดียว และ checkpoint/restart
  เพื่อไม่ทำผลสำเร็จไฟล์หนึ่งกลายเป็นหลักฐานของทุกไฟล์

**Regression:** failed-without-status, explicit failure, string/content-block output,
outer success/inner failure, mixed success/failure, cancellation, no-op,
multiple calls, delayed output, truncated record, replay/restart

**เกณฑ์ผ่าน:** กรณีล้มเหลวใน audit สร้าง verified edits = 0;
ทุก negative case ให้ false verified = 0; success fixtures ยังนับครบและ replay ไม่เพิ่มยอด

## 5. TA-02 — Diff และ unavailable line counts

จุดแก้: `ai/patch.rs`, `codex.rs`, `claude.rs`, `producer.rs` และ counters ใน hooks

- [ ] แยก parser ของ unified diff, structured hunk และ apply_patch DSL
- [ ] ข้าม `+++`/`---` เฉพาะเมื่อเป็น file header ตามสถานะ parser;
  ใน hunk body ให้นับ sign ตัวแรกเสมอ
- [ ] ทดสอบ `++counter`, `--counter`, Markdown horizontal rules,
  CRLF, Unicode, empty file, ไม่มี newline ปิดท้าย, หลาย hunk และหลายไฟล์
- [ ] whole-file delete ไม่มี before-content: ส่ง deleted=null พร้อมเหตุผล;
  ใช้ 0 เฉพาะมีหลักฐานว่าไฟล์ว่างหรือไม่มีบรรทัดถูกลบจริง
- [ ] ใช้ before-content เฉพาะที่ผูกกับ operation นั้นได้ ห้ามใช้ Git HEAD
  หรือไฟล์ปัจจุบันแทนโดยสมมติว่าไม่มี uncommitted/concurrent changes
- [ ] ตรวจ rename, delete+add path เดิม และ repeated path ใน call เดียว
- [ ] ไล่ null ผ่าน core → hook/CLI → broker → API → ClickHouse → aggregation → UI;
  หาก schema เดิมทำให้ null หาย เพิ่ม measurement status แบบเข้ากันได้

**เกณฑ์ผ่าน:** ตัวอย่าง triple-sign ได้ +1/-1; deletion ที่ไม่รู้จำนวนไม่กลายเป็น 0;
ผลทุก parser ตรง expected before/after และ frontend แสดง unavailable ได้

## 6. TA-03 — หน่วยนับ editor และการจับคู่การแก้

จุดแก้: `extensions/vscode/src/utils.ts`, `buffer.ts`, `aiAttribution.ts`,
`types.ts`, และคู่สัญญาใน Rust core/broker

- [ ] สร้าง baseline document version ในหน่วยความจำ; เก็บเฉพาะ counters/metadata ออกนอกเครื่อง
- [ ] คำนวณ before/after ภายในช่วงแก้ที่มีขอบเขตชัดเจน เช่น save/flush/จบ native AI operation;
  cadence เปลี่ยนได้แต่ต้องไม่ทำ metric definition เปลี่ยนโดยไม่ระบุ version
- [ ] แยกช่วงเมื่อมี identity ที่พิสูจน์ได้ว่าผู้แก้เปลี่ยน; ถ้าปนหลายผู้แก้แล้ว
  แยกไม่ได้ให้ unknown ห้ามรวมแล้วให้เครดิต model ของ event แรก
- [ ] editor observation ที่ตรง AI operation เดิมเป็นหลักฐานประกอบ ไม่สร้าง line total ซ้ำ
- [ ] กรณีไม่มี baseline, ไฟล์ใหญ่เกินขีดจำกัด, editor restart หรือ external reload
  ให้ unavailable พร้อมเหตุผล ห้ามเดาจากไฟล์ปลายทาง
- [ ] กำหนด undo/redo: กลับสู่ baseline ในช่วงเดียวกันให้ delta=0;
  undo ข้ามช่วงเป็น change ใหม่ตามนิยาม churn แต่ไม่เป็น generation ใหม่ของ model เดิม
- [ ] กำหนด partial accept/reject, paste, formatter, autocomplete และ multi-cursor
  ให้ Unknown เมื่อไม่มีหลักฐานผู้แก้; ไม่ถือว่าไม่มี AI event แปลว่าเป็น Human
- [ ] เพิ่มขีดจำกัดขนาด/เวลา diff และทดสอบ editor responsiveness ด้วยไฟล์ใหญ่

**เกณฑ์ผ่าน:** initial/final document และขอบเขตช่วงเดียวกันให้ตัวเลขเดียวกัน
ไม่ว่าพิมพ์ทีละตัวหรือส่งเป็น change เดียว; ไม่มี line double count ระหว่าง editor กับ AI;
human/AI ratio ไม่รวม metric version ที่เทียบกันไม่ได้

## 7. TA-04 — Model identity และ coverage ที่อธิบายได้

จุดแก้/ตรวจ: `ai/identity.rs`, `codex.rs`, `claude.rs`, `canonical.rs`, `revision.rs`,
`backend/api/src/services/ai_stats.rs`, `dashboard_analytics.rs`, `ai_diagnostics.rs`,
frontend `lib/wakaclock/ai-display.ts` และ components AI table/legend/diagnostics

- [ ] ผูก agent/provider/model กับ session+turn+tool identity เดียวกัน;
  ไม่ใช้ model ล่าสุดของ session ย้อนให้ operation ก่อนหน้า
- [ ] ทดสอบ switch model, subagent/nested call, concurrent sessions, reused call ID,
  missing/internal model, unknown provider และ conflicting evidence
- [ ] จำกัด named model totals ให้ operation ที่ outcome และ identity ผ่าน;
  จำนวนบรรทัดที่ไม่ทราบไม่ถูกเติมเป็น 0
- [ ] แสดงแยก: AI ที่ยืนยัน, AI ที่ไม่ทราบ model, ไม่ทราบผู้เขียน,
  tool outcome ที่ยังพิสูจน์ไม่ได้ และจำนวนบรรทัดที่วัดไม่ได้
- [ ] นิยาม coverage โดยใช้ canonical unique file operations หลังเลือก revision:
  model coverage = confirmed model / proven successful AI operations;
  line coverage = operations ที่วัด added และ deleted ได้ / proven successful AI operations
- [ ] แสดง numerator/denominator และ unavailable เมื่อ denominator=0;
  coverage นี้ครอบคลุม **event ที่ตรวจพบ** ไม่ใช่กิจกรรมจริงทั้งหมด
- [ ] รายงาน capture recall เฉพาะ campaign ที่มี ground truth ภายนอก;
  ห้ามบอกว่าตรวจครบ 100% จากข้อมูลที่ระบบมองเห็นเอง
- [ ] token/cost ที่รายงานระดับ turn ต้องไม่ทำซ้ำต่อไฟล์;
  การกระจายต่อไฟล์ให้ระบุว่าเป็นประมาณการ

**เกณฑ์ผ่าน:** ทุก model switch/conflict test ไม่ระบุผิด; unknown ไม่ถูกยกระดับเป็น Human/AI
จากการไม่มีหลักฐาน; dashboard/API/canonical totals ตรงกันหลัง retry และ repair

## 8. TA-05 — เวลาและการเปรียบเทียบที่ถูกเงื่อนไข

จุดแก้: `scripts/duration-audit/{certify_live,compare_wakatime,timeline}.py`,
`backend/api/src/services/activity_timeline.rs`, `config/mod.rs` และ duration consumers

- [ ] ตั้งชื่อหลักฐานให้ชัด: algorithm replay, internal API consistency,
  external WakaTime comparison และ independently observed activity
- [ ] เปลี่ยนชื่อ/metadata ของ reference จำลองใน `certify_live.py` ให้ไม่ดูเหมือน
  เป็นคำตอบจาก WakaTime จริง; รองรับรายงานเก่าในฐานะ historical evidence
- [ ] pin และตรวจ timezone, timeout, writes_only, project/category/language filters,
  date completeness, client versions, server mode และ queue settlement
- [ ] ถ้า API ไม่รองรับ option ห้ามละเลยเงียบ ๆ; ตรวจค่าจริงหรือทำ report เป็น blocked/non-comparable
- [ ] ตรวจ semantics ปัจจุบันของ WakaTime ว่า total รวม AI หรือไม่;
  เลือก editor-equivalent scope ที่เทียบได้จริง ไม่เทียบ `comparable_seconds`
  กับยอดที่มี AI เพิ่มโดยไม่ได้ระบุ
- [ ] คง 3 ตัวเลขแยก: editor-comparable, measured AI และ union total;
  union ไม่เกินผลบวกและไม่ต่ำกว่าช่วงใดช่วงหนึ่ง; AI additional = union − comparable
- [ ] เก็บ actual deployment mode แบบ read-only ก่อนวาง rollout;
  ยังไม่เปลี่ยน `legacy` เป็น `combined_v2` จนผ่าน staging gate
- [ ] ทดสอบ timeout edges, focus/idle/sleep, offline/restart, duplicates,
  concurrent agents/editors/machines, midnight และ DST
- [ ] ตรวจ summaries/stats/projects/goals/dashboard ใช้ canonical definition เดียวกัน;
  ผลแยกกลุ่มรวมกลับได้ภายใน rounding tolerance 0.5 วินาที

**เกณฑ์ผ่าน local:** Rust timeline, Python replay และ comparison fixtures ผ่าน;
parameter mismatch/ไม่มีข้อมูลต้องไม่รายงาน pass หรือแทนเป็น zero

**เกณฑ์ผ่าน live:** อย่างน้อย 7 วันปฏิทินที่จบแล้วและมีการเก็บคู่ครบ;
วันปัจจุบัน provisional, วันที่ไม่มีข้อมูล unavailable, วันว่างไม่ใช้เติมจำนวนวันขั้นต่ำ
ความต่าง editor-comparable ต่อวัน ≤120 วินาที ตามเกณฑ์เดิม และแสดง relative error ด้วย;
ทุกช่องว่างเกินเกณฑ์ต้องมีสาเหตุที่ตรวจสอบได้ก่อนปิดงาน
หลัง queue drain: ไม่มี event ใน campaign ที่หายโดยไม่อธิบายหรือซ้ำใน canonical
เกณฑ์นี้วัด parity; การอ้างความแม่นกว่าใช้ ground truth ใน TA-07 เพิ่มเติม

## 9. TA-06 — Historical repair และ compatibility

จุดตรวจ: `ai/revision.rs`, canonical heartbeat projection, repair handlers,
`backend/api/docs/ai-attribution.md` และ migrations/projection rebuild ที่เกี่ยวข้อง

- [ ] dry-run ระบุช่วงเวลาที่อาจได้รับผล, parser/client version, stable operation IDs,
  before/after totals, จำนวนแก้ได้และแก้ไม่ได้ พร้อมเหตุผล โดยไม่เปิดเผย source
- [ ] แยก identity-only repair ออกจาก line/outcome repair;
  endpoint identity เดิมต้องยังแก้ measured counters ไม่ได้
- [ ] ออกแบบ revision สำหรับ outcome/line correction โดยไม่ทำลาย operation identity;
  invalidated failed edit ไม่รวมใน applied-line totals แต่ยังเก็บ audit/usage/time evidence
- [ ] reparse เฉพาะเมื่อ source evidence ยังอยู่และจับคู่ canonical operation ได้;
  ไม่สร้าง heartbeat ปลอม ไม่เปลี่ยนเวลาเดิม และไม่คูณยอดด้วยเปอร์เซ็นต์ชดเชย
- [ ] ข้อมูลไม่มีหลักฐานให้ unresolved; กรณี legacy deletion=0 ห้ามแก้ทุกแถวเป็น null
  โดยไม่ตรวจรูปแบบและ version ที่ได้รับผล
- [ ] revision winner ต้องถูกเลือกก่อน aggregate; rebuild/invalidate cache
  ให้ครบทั้ง AI totals, model breakdown และ affected summaries
- [ ] ทำ rollback เป็น revision ที่ตรวจสอบได้ หรือคืน projection/version ตามขอบเขต;
  ไม่ลบ audit log และไม่เปลี่ยนกลับไป parser ที่นับ false verified เพียงเพื่อคืน UI
- [ ] ทดสอบ old client/new server, new client/old server, null/status preservation,
  schema migration และ duplicate/retry โดยใช้ compatibility inventory เดิม

**เกณฑ์ผ่าน:** apply ซ้ำได้ delta=0; original/corrected revision ไม่ถูกนับคู่;
identity repair ไม่เปลี่ยนเวลา/lines; line repair ไม่เปลี่ยนเวลา;
rollback คืนค่าที่ตั้งใจและไม่มีข้อมูล tenant อื่นได้รับผล

## 10. TA-07 — Live certification และหลักฐานเทียบคู่

ใช้ `scripts/ai-coverage/` และ `certifications/ai-adapters/` เดิม
พร้อม [live test plan](ai-live-certification-test-plan.md)

- [ ] เริ่ม Codex CLI และ Codex Desktop แยก tuple ตาม surface ที่ใช้งานจริง;
  ตามด้วย Claude Code แล้วค่อยเครื่องมืออื่นที่มี runtime/authentication พร้อม
- [ ] สำรวจรูปแบบจริงของแต่ละ version ก่อนสร้าง fixture และต่ออายุ certification
- [ ] เตรียม synthetic project, test account/home/database และชุด expected edits
  ที่บันทึกก่อนทดสอบ; เก็บ diff/source ใน test environment เท่านั้น
- [ ] ไล่ source → producer → broker → API → canonical → dashboard ด้วย operation IDs
  และตรวจ counters/model/time ทุกชั้น ไม่ใช้ผล parser แทนผลส่งถึง dashboard
- [ ] ครอบคลุม single/multi-file, create/delete/rename, switch model, multiple sessions,
  nested execution, failed/partial/cancelled calls, inline partial accept/reject,
  restart/offline/replay และการเปลี่ยน version
- [ ] สำหรับ controlled fixtures ที่มีข้อมูลครบ: expected edits/model/line counts ตรงทั้งหมด,
  false verified=0 และ duplicates=0; ถ้าข้อมูลต้นทางไม่มี model/lines ต้องได้ unavailable ตาม expected
- [ ] เก็บเวลาอ้างอิงแยกจากทั้งสองระบบสำหรับ typing, reading, debugging,
  unattended AI และพัก; รายงาน absolute error และนิยามเวลาแต่ละประเภท
- [ ] รันช่วงเทียบเวลา TA-05 ด้วย build เดียวกับ release candidate;
  ถ้ามีการแก้ที่เปลี่ยนการวัดระหว่าง campaign ต้องแยก version และเก็บช่วงใหม่ให้ครบ
- [ ] certification ระบุ exact runtime/client/tool/OS/arch/model tuple,
  commit/build digest, review status, expiry และ known limitations
- [ ] historical/promotable=false ไม่ยกระดับอัตโนมัติ; scope ที่ไม่มีเครื่องมือหรือ auth
  คง unavailable/blocked และไม่กีดกันการปล่อย scope อื่นที่ผ่านจริง

**เกณฑ์ผ่าน:** หลักฐาน event-bound readback ครบทุก stage และทุก mandatory scenario
ของ tuple ที่จะประกาศรองรับ; time campaign ผ่านโดยไม่ใช้วันขาดข้อมูลเติมช่องว่าง

## 11. TA-08 — Release และติดตามหลังปล่อย

- [ ] ตรวจ CLI/VSIX/bundle checksum และ runtime version หลังติดตั้งจริง
- [ ] จัด release notes ระบุ metric version, corrected bugs, unknown semantics,
  certified surfaces และผลกระทบต่อการเปรียบเทียบข้อมูลเก่า
- [ ] rollout ตามลำดับ staging → กลุ่มทดลอง → scope ที่รับรองแล้ว;
  เปลี่ยน duration mode แยกจาก parser update เพื่อวัดผลแต่ละอย่างได้
- [ ] ติดตาม parser failures/lag, delivery pending/failed, canonical duplicates,
  confirmed/unknown coverage และความต่างของ duration surfaces
- [ ] หากพบ false verified หรือ duplicate inflation ใหม่ ให้หยุด rollout และ
  ปิดการ promotion ของเส้นทางที่ได้รับผล; ใช้ last known-good artifact หรือเก็บเป็น unknown
- [ ] duration rollback ใช้ configuration ที่ตรวจแล้ว; schema ต้องยังอ่านข้อมูลเก่า/ใหม่ได้
- [ ] หลังปล่อยตรวจครบอีกหนึ่งช่วงใช้งานเต็มวันก่อนปิด release task

**เกณฑ์ปิดงาน:** ทุก TA มีหลักฐานและสถานะตามจริง; ไม่มี confirmed defects ค้างใน scope
ที่ปล่อย; ส่วนที่ยังไม่ได้รับรองมีรายการข้อจำกัดชัดเจน; audit report มีลิงก์ไป PR/commit,
test results, live certificates และ repair report ที่สอดคล้องกับ artifact จริง

## 12. ชุดตรวจที่ต้องรันเมื่อ implementation เสร็จ

ใช้ตามส่วนที่เปลี่ยน; การวางแผนครั้งนี้ไม่ได้รันซ้ำหรืออ้างผลเหล่านี้ว่าผ่านหลังแก้แล้ว

```bash
# จาก repository root
python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py
python3 -m unittest discover -s scripts/duration-audit -p 'test_*.py'
python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test_*.py'
python3 scripts/ai-coverage/validate_catalog.py certifications/ai-adapters/catalog-v1.json
npm test --prefix extensions/vscode
npm run lint --prefix extensions/vscode

# จาก backend/api
cargo test -p wakaclock-core ai:: --lib --offline
cargo test -p wakaclock-core --test attribution_conformance --offline
cargo test -p wakaclock-server services::activity_timeline::tests --lib --offline
```

เพิ่ม SQL integration tests ใน isolated ClickHouse/PostgreSQL สำหรับ null, revisions,
dedup และ repair; รัน hook suites ที่แก้; frontend ทำ typecheck/lint/tests/coverage
ตาม AGENTS.md พร้อมตรวจ UI ของ unavailable/zero/partial และ legacy data
ก่อน release รัน repository quality gates และ artifact/compatibility gates ที่เกี่ยวข้อง

## 13. ข้อมูลที่ต้องมีเมื่อเริ่ม live phase

| สิ่งที่ต้องพร้อม | ใช้เพื่อ | หากยังไม่มี |
| --- | --- | --- |
| Test account/API credentials ของทั้งสองระบบ | เทียบ WakaTime และอ่านผลปลายทาง | ทำ local/staging tasks ต่อ; external campaign blocked |
| Runtime และ login ของ client ที่จะรับรอง | สร้าง native tool evidence | ไม่ประกาศรับรอง tuple นั้น |
| Server configuration/version แบบอ่านได้ | ยืนยัน duration mode และ filters | ไม่อ้างว่าผล local คือ production |
| Source evidence เก่าที่เก็บอยู่ในเครื่อง | repair ข้อมูลย้อนหลัง | คง unresolved ไม่เดายอด |
| เวลาเก็บคู่ ≥7 วันสมบูรณ์ | live parity certification | สถานะ implemented/local-tested ยังไม่เป็น live-certified |

ไม่ต้องมีข้อมูลเหล่านี้เพื่อเริ่ม TA-00–05; ตรวจความพร้อมอีกครั้งตอนเข้าขั้น live
ไม่ใส่ credentials, source code หรือ transcript ส่วนตัวในแผนหรือ certification

## 14. Checklist สรุปสำหรับติดตาม

- [ ] TA-00 นิยามและ baseline
- [ ] TA-01 outcome correctness
- [ ] TA-02 diff/null correctness
- [ ] TA-03 editor measurement consistency
- [ ] TA-04 identity/coverage/API/UI
- [ ] TA-05 duration/comparison semantics
- [ ] TA-06 historical repair/compatibility
- [ ] TA-07 live evidence ต่อ runtime และเวลา
- [ ] TA-08 release/monitoring/closeout

กำหนดเวลาจริงหลัง TA-00 เพราะขอบเขต schema และคุณภาพข้อมูลย้อนหลังยังต้องตรวจ
ช่วง live มีข้อจำกัดอย่างน้อย 7 วันสมบูรณ์; ห้ามย่นด้วยการจำลองหรือใช้ผล certification เก่า
