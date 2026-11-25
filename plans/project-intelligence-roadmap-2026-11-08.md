# AtoAxis — แผน Project Intelligence และ Flagship Features

วันที่: 8 พฤศจิกายน 2026 · Asia/Bangkok

สถานะ: **แผนรอบถัดไป / queued — ยังไม่เริ่ม implementation**

## 1. เป้าหมายและลำดับต่อจากงานปัจจุบัน

จัดเก็บ 13 ฟีเจอร์ที่เคยระดมไอเดียให้เป็นแผนพัฒนาที่ดำเนินต่อได้จริง:
เห็นวิวัฒนาการโค้ด → ย้อนดูกิจกรรมคน/agent → อธิบายด้วยหลักฐาน → สรุปและแชร์
→ วิเคราะห์ผลลัพธ์/ความเสี่ยง → สำรวจผลกระทบก่อนเปลี่ยนโค้ด

คำสั่งรอบนี้คือจัดทำแผนไว้สำหรับพัฒนาต่อภายหลัง ไม่ใช่เริ่มแก้ application,
เปิด flags, เรียก models, กลับไปเดินงานที่พักไว้ หรืออนุมัติเปลี่ยน protected code

ลำดับที่ใช้ในแผนนี้:

1. จบขอบเขตงานปัจจุบันที่เจ้าของกำลังดำเนินการอยู่ และบันทึกผลส่งมอบ/ข้อค้าง
2. เมื่อเริ่มแผนนี้ ให้ยืนยัน source และสถานะจริงใหม่ใน P0
3. ส่งมอบ P1–P2 เป็นรุ่นแรกที่ใช้ดูวิวัฒนาการและ replay ได้
4. ต่อ P3–P4 เพื่ออธิบาย สรุป และแชร์ แล้ว P5–P6 เพื่อ analytics/impact/control

ไม่อนุมานว่างานปัจจุบันคือ Receipt หรือ Team เพียงงานเดียว: ทั้งสองมี handoff
ที่แยกกัน และบางรายการเคยพักตามคำสั่งเจ้าของ ต้องระบุแผนต้นทาง/ผลตรวจล่าสุดใน P0
ไม่ใช้รายงานเก่าประกาศว่างานเหล่านั้นเสร็จแล้ว

แผนนี้เป็น workstream ใหม่ ไม่แทนที่ [AI attribution roadmap](ROADMAP.md),
[Receipt strategy](ai-era-product-strategy-audit-2026-09-28.md),
[Receipt readiness](receipt-readiness-fixes-2026-10-04.md) หรือ
[Team handoff](../docs/atoaxis-team-non-stripe-handoff-2026-11-02.md)
ไม่รวมงาน Stripe ที่พักไว้ และไม่กำหนดให้ต้องปิด commercial Team ทุกข้อก่อนทำ local MVP

## 2. สถานะตั้งต้นที่ตรวจจริง

Source อ้างอิง: `2669132067fa4998088ceeec341a45d576a0ef7f` บน local `main`
วันที่ตรวจ 8 พ.ย. 2026 เป็นการอ่าน source ไม่ได้รัน build/test/provider ในรอบวางแผน
สถานะด้านล่างไม่รับรอง deployment หรือ live certification

| ID | ฟีเจอร์ | ฐานปัจจุบัน | ช่องว่างที่ต้องพัฒนา | ช่วงส่งมอบ |
|---|---|---|---|---|
| F01 | Code Evolution Viewer | Time Machine City แสดงข้อมูลไฟล์/โมดูลรายวัน | Git version pairs, local Diff, revision history | P1 |
| F02 | AI Agent Replay | Activity replay, AI session bands และ Receipt/evidence | ลำดับ operation/tool ที่มีหลักฐานและการนำทางถึง local change | P2 |
| F03 | Why Did This Change? | Commit/PR metadata และ operation evidence แยกกัน | Evidence retrieval, verified links และคำอธิบายพร้อม citations | P3 |
| F04 | Development Pulse | Sessions, Human/AI analytics, PR/CI events | ภาพรวมช่วงงานพร้อม coverage และสถานะผลงานที่แยกจาก activity | P2 |
| F05 | AI Story Mode | มีเหตุการณ์หลายแหล่ง | Story assembler, evidence citations และ revision invalidation | P3 |
| F06 | Shareable Replay | Replay ส่วนตัว; generic public sharing ยังมี runtime gate | Sanitized replay snapshot, preview, expiry/revoke และ public viewer | P4 |
| F07 | Agent Universe | มีหน้า/API, hourly usage และ recent-activity Live แบบ experimental | เชื่อมไป Receipt/Replay; แยก historical/live/unknown; ทดสอบ runtime | P2 |
| F08 | Code Universe | มีเมืองโมดูล 3D จาก daily file facts | Versioned static dependency graph และรายการที่ resolve ไม่ได้ | P1 |
| F09 | Future Simulator | ยังไม่พบ implementation ตามนิยาม | Change impact preview พร้อม assumptions/unknown; ไม่รับรองผลในอนาคต | P6 |
| F10 | Risk Radar | มีบางสัญญาณ CI/การเปลี่ยนแปลง | กฎ risk signals ที่อธิบายได้ พร้อม baseline และการประเมินข้อผิดพลาด | P5 |
| F11 | AI Efficiency Lab | Usage/cost, Receipt, Team cost/PR foundations | Task cohorts, outcome denominators, intervention/rework และการเทียบอย่างมีข้อจำกัด | P5 |
| F12 | Project Memory | มีประวัติ facts/Receipt; ยังไม่มี memory workflow | Decision records, searchable evidence index, version/permission fences | P3 |
| F13 | Mission Control | Dashboard/Agent Universe/Trust เป็นฐาน | ภาพรวมงานและปัญหาที่ต้องจัดการ; MVP อ่านอย่างเดียว | P2 shell / P6 รวมครบ |

คำว่า “ยังไม่พบ” หมายถึงการค้น source ในขอบเขตนี้ ไม่ใช่หลักฐานว่าทุก branch
หรือทุกแชตไม่เคยมี prototype

Source anchors ที่ใช้ต่อ:

- `backend/api/src/services/{replay,project_city,agent_universe}.rs`
- `backend/api/src/model/{replay,project_city,team_replay}.rs`
- `backend/api/src/handlers/v2/work_sessions.rs` และ operation evidence ใน `handlers/v2.rs`
- `backend/api/src/services/{ai_usage,team_insights,team_merged_cost,team_comparison}.rs`
- `frontend/app/components/wakaclock/analytics/time-machine.native.tsx` และ `.classic.tsx`
- `frontend/app/lib/wakaclock/{replay,project-city,agent-universe,work-sessions}.ts`
- `backend/api/crates/wakaclock-ast/` เป็นจุดสำรวจ parser เดิม ไม่ถือว่ามี graph สำเร็จแล้ว

## 3. รูปแบบผลิตภัณฑ์และขอบเขตข้อมูล

ใช้หน้าโปรเจกต์เป็นทางเข้า มีมุมมอง Overview/Pulse, Evolution, Replay, Code Map,
Memory และ Insights; Agent Universe เปิดเจาะต่อเข้า project/session เดิมได้
Mission Control เป็นภาพรวมที่เชื่อมมุมมองเหล่านี้ ไม่สร้างฐานข้อมูลสำเนาแยก 13 ชุด
ยังไม่ล็อกชื่อเมนูหรือจำนวนหน้าจนผ่าน prototype ใน P0

### 3.1 สองขอบเขตที่ต้องแยกให้ชัด

**Hosted metadata:** เวลา/usage ที่ได้รับแล้ว, operation metadata ที่อนุญาต,
opaque references, coverage, version, confirmed links และผลสรุปที่ผ่าน allowlist
ใช้ ClickHouse/PostgreSQL/worker เดิมตามบทบาท ไม่สร้าง broker ใหม่โดยไม่มีเหตุผล

**Local code view:** อ่าน Git revisions และแสดง source/Diff บนเครื่องผู้ใช้เท่านั้น
MVP ไม่เพิ่มการเก็บ snapshots เนื้อหาโค้ดถาวร และไม่ส่ง source, Diff, prompt,
raw tool arguments/output หรือ agent transcript ไป backend/model ภายนอก
อ่าน working tree แบบ read-only; ไม่ checkout/reset/เปลี่ยน branch ให้ผู้ใช้

เสนอ VS Code local viewer เป็นจุดเริ่มต้น ใช้ workspace trust, explicit repo selection
และ CSP/message validation; ทดลองจาก artifact ที่ติดตั้งจริงก่อนล็อกวิธีเชื่อม Dashboard
ลิงก์จากเว็บต้องให้ผู้ใช้เลือกเปิด local viewer อย่างชัดเจน ถ้ายังไม่มี trusted bridge
ให้เปิด viewer จาก command ใน VS Code แทน ไม่เปิด localhost service ที่อ่านไฟล์ได้ทั่วไป
Browser-only ยังดู metadata replay ได้ แต่ source/Diff แสดงว่าเปิดจาก local viewer เท่านั้น

Why/Story รุ่นแรกสร้างจาก metadata และ decision ที่ผู้ใช้ยืนยัน:
มี deterministic summary ที่ใช้ได้โดยไม่เรียก LLM เสมอ
หากใช้ model ให้เลือก on-device หรือเชื่อมเครื่องมือ local ที่ผู้ใช้เปิดใช้งานแล้ว
โดยไม่อ่าน credential หรือเปิด model calls อัตโนมัติ; เมื่อไม่พร้อมใช้ fallback
การส่ง source/Diff/context ไป hosted model เป็น **scope decision ใหม่** นอกแผน MVP นี้
ไม่ถือว่าการใช้ local CLI ซึ่งอาจส่งข้อมูลต่อ cloud ทำให้ข้อมูลเป็น local โดยอัตโนมัติ

### 3.2 ความหมายตัวเลขและหลักฐาน

- Duration ใช้ canonical timeline เดิม; ไม่คำนวณจากช่องว่างของ events/session อีกชุด
- Agent Universe Live หมายถึง recent observed activity ไม่ใช่ยืนยันว่า process ยังรัน
- Event ที่หาย/จับคู่ไม่ได้เป็น unknown; ไม่มีข้อมูลไม่เท่ากับ 0, failure หรือ completion
- การแก้ไฟล์, tool สำเร็จ, user-confirmed outcome, commit, merged PR และ CI pass เป็นคนละหลักฐาน
- ไม่เชื่อม operation→commit หรือหลาย sessions เป็น task จากเวลาใกล้กัน/ชื่อ branch อย่างเดียว
- กราฟ imports เป็น static dependencies ไม่เท่ากับ runtime call graph
- Retained code ไม่เท่ากับโค้ดถูกต้อง และ activity สูงไม่เท่ากับความคืบหน้ามาก
- คำตอบ AI แยก recorded reason, observed change และ inferred explanation;
  ไม่มีหลักฐานเหตุผลต้องตอบว่าไม่ทราบ ไม่แต่ง intent จาก Diff

## 4. โครงสร้างข้อมูลร่วมที่เสนอ

รายการนี้คือ design proposal ต้องเทียบ schema/route จริงใน P0 ก่อนตั้ง migration หรือ API

| Contract | หน้าที่ | ข้อกำหนด |
|---|---|---|
| ProjectEvidenceRef | อ้างถึง receipt/operation/commit/CI/decision | owner/repo scope, source revision, observed time, coverage; ไม่ใส่ native session ID/raw logs |
| ProjectEvent | ลำดับเหตุการณ์หลายแหล่ง | stable source ID, occurred/received time แยก, schema version, correction/superseded state |
| CodeRevisionPair | เปรียบเทียบ Git objects บนเครื่อง | immutable revision IDs, repo-local identity, explicit parent selection; rename/ambiguous state |
| DependencySnapshot | แผนที่โค้ดต่อ revision | parser/version, nodes/edges, resolved/unresolved coverage; metadata allowlist ก่อน sync |
| DecisionRecord | บริบทที่ผู้ใช้ยืนยัน | evidence refs, author/source, effective time, revision และ withdrawal |
| Explanation/Story | คำอธิบายที่สร้างจากหลักฐาน | evidence-set fingerprint, schema/model version, sentence citations, stale/unsupported states |
| ReplayShareSnapshot | สำเนาสำหรับ public viewer | allowlisted metadata, immutable snapshot version, expiry/revocation, current access check |
| InsightResult | Pulse/risk/efficiency/impact | formula/rule version, numerator/denominator ที่ใช้ได้, exclusions, missing data และ evidence |

ไม่กำหนดชื่อ tables/endpoints ตายตัวก่อนทบทวนของเดิม:
reuse v1 read routes และ v2 envelopes; เพิ่ม typed v2 routes เฉพาะ contract ใหม่
API → service → repository; new services ต้องต่อ AppState และ module/router จริง
Receipt เดิมมี queries ใน handler อยู่แล้ว แต่โค้ดใหม่ต้องตาม layer rule;
ไม่ทำ refactor ใหญ่ของ protected domain เป็นเงื่อนไขแฝงของฟีเจอร์
Migration เป็น additive และตรวจ live startup ordering; ไม่จองเลข migration ล่วงหน้า
PostgreSQL ไม่พร้อมให้ transactional features unavailable แทน panic/แกล้งสำเร็จ

## 5. ลำดับพัฒนาและเกณฑ์ผ่าน

### P0 — ยืนยันฐานและออกแบบ contract (ประมาณ 1–2 engineer-weeks)

งาน:

- [ ] บันทึกแผนงานต้นทางที่จบแล้ว, source SHA, pending gates และ exclusions ล่าสุด
- [ ] ตรวจ Receipt, canonical replay, Team/GitHub และ native candidate จริง;
      tests จากคนละ build หรือรายงานหมดอายุไม่ใช้ certify source ใหม่
- [ ] ทำ contract matrix ของ Claude Code/Codex/Gemini CLI ราย version/OS/metric;
      เริ่ม MVP สอง adapters ที่มีหลักฐานพร้อมจริง ไม่อ้างรองรับสามตัวครบโดยปริยาย
- [ ] ทดลอง local Git Diff/viewer และ AST parser เดิมแบบ read-only ด้วย fixture repo
- [ ] กำหนด feature flags, identity/privacy/retention, bounds และ latency baselines
- [ ] Prototype user flow: เลือกโปรเจกต์ → change → replay → evidence → explanation
- [ ] แยก exact files ที่จะเข้า protected scope เพื่อขออนุมัติตามขั้นตอนก่อนแก้

เกณฑ์ผ่าน: ADR ระบุ metadata vs local content ชัด, schema/identity/revision fixtures,
support matrix และ acceptance ledger ที่ยังไม่ปิดครบ; ไม่มี source/Diff หลุดจาก local view
หาก Receipt live gates ยังไม่ผ่าน ทำ local Git viewer แยกได้ แต่ห้ามเปิด agent-linked
features เป็น verified จน prerequisites ที่เกี่ยวข้องผ่าน

### P1 — Code Evolution Viewer + Code Universe (ประมาณ 3–5 engineer-weeks)

งาน:

- [ ] Local viewer เลือก Git revision สองฝั่ง ดู unified/side-by-side Diff และ timeline
- [ ] รองรับ add/modify/delete, merge-parent selection และ rename ที่ยืนยันได้;
      rename ที่กำกวม, binary, large/generated files แสดงเหตุผลที่เปิดไม่ได้
- [ ] Missing object/shallow history แสดง incomplete; ไม่ auto-fetch หรือเปลี่ยน checkout
- [ ] Code Map สำหรับ TypeScript/JavaScript และ Rust ก่อน ตาม parser ที่ spike ผ่าน
      มี file/module imports, search, incoming/outgoing edges และ unresolved imports
- [ ] เชื่อม City เดิมเป็นอีกมุมมอง; โตขึ้นตาม daily facts ไม่อ้างว่า reconstruct โค้ดทุกวันได้
- [ ] ใช้งานผ่านรายการ/2D ได้เมื่อไม่มี WebGL และรองรับ keyboard/reduced motion

เกณฑ์ผ่าน: Git fixture matrix เทียบ Diff กับ Git reference ตรงใน supported cases,
เปิด malicious path/symlink ออกนอก repo ไม่ได้, graph fixture edges ถูกต้อง,
unsupported language/generated/dynamic edges ระบุขอบเขต และไม่มี source network egress

ส่งมอบ: Evolution/Code Map local alpha ที่ใช้ได้แม้ไม่มี agent หรือ hosted PostgreSQL
Uncommitted history replay และ full symbol/runtime graph ยังไม่อยู่ใน MVP

### P2 — Agent Replay + Development Pulse + Agent Universe (ประมาณ 3–5 engineer-weeks)

งาน:

- [ ] ต่อ Receipt และ canonical evidence เป็น event timeline; play/pause/scrub/step,
      filter project/agent/session และเปิด evidence ของแต่ละเหตุการณ์
- [ ] แสดง tool kind/status/verified file relation เท่าที่ provider ให้จริง;
      ไม่ส่ง command text/tool args/raw output; duration มีเฉพาะ explicit intervals
- [ ] Local Diff เปิดได้เมื่อมี revision/checkpoint relation ที่พิสูจน์ได้;
      ไม่มี historical checkpoint ให้ unavailable ไม่เปิด current file แทนอดีต
- [ ] Human/AI overlap, retry, out-of-order และ correction ใช้นิยามเดิม;
      approval/wait lanes เปิดเฉพาะ adapter ที่มี paired IDs จริง
- [ ] Pulse รวม coding sessions, observed AI activity และ confirmed PR/CI outcomes
      โดยใช้ coverage และ owner GitHub permissions เดิม
- [ ] Agent Universe drill-down สู่ session/replay; live, historical และ stale state แยกชัด
- [ ] Mission Control shell อ่านภาพรวม projects, recent agents, pending evidence และ CI

เกณฑ์ผ่าน: replay event/total ไม่เปลี่ยนเมื่อ retry, revision ใหม่ไม่ฟื้น old facts,
late response หลังเปลี่ยนบัญชีไม่แสดงข้อมูลเดิม, idle/sleep ไม่สร้างกิจกรรมเพิ่ม,
agent unsupported ไม่ได้รับชื่อ verified และ live UI มี stale/delivery caveat ตรงจริง
ตรวจ actual installed artifact ของสอง adapters กับ independently recorded sessions

ส่งมอบ: metadata replay alpha + Pulse + Universe navigation;
Gemini CLI เปิดเพิ่มเมื่อ runtime/metric evidence ของ tuple นั้นผ่านเท่านั้น

### P3 — Project Memory + Why Did This Change? + AI Story Mode (ประมาณ 4–6 engineer-weeks)

ทำ Memory ก่อน เพื่อให้ Why/Story อ้างหลักฐานชุดเดียวกัน:

- [ ] Versioned evidence index และ structured decision records ที่ผู้ใช้ยืนยัน/ถอนเองได้
      เริ่ม keyword/filter retrieval ก่อนเพิ่ม embeddings เมื่อพิสูจน์ว่าจำเป็น
- [ ] Index tenant/repo/revision scope; ตรวจสิทธิ์ก่อน retrieval และก่อนส่งผลทุกครั้ง
- [ ] Why รับ selected change/revision ใน local viewer หรือ metadata event ในเว็บ
      แสดง what changed, recorded reason, relevant evidence และสิ่งที่ยังไม่ทราบ
- [ ] Story เป็น ordered chapters จาก events/decisions; ทุก factual claim มี citation
      ผู้ใช้แก้ข้อความได้ โดยแยก authored text จาก generated text และไม่แก้ facts
- [ ] Prompt injection จาก commit messages/logs/decisions เป็น untrusted reference;
      ไม่ให้เนื้อหาใน repo สั่ง tools, เปิดไฟล์อื่น หรือส่งข้อมูลออก
- [ ] แก้ evidence/revoke consent แล้ว answers/index/cache ถูก invalidated;
      local-only evidence เปิดจาก hosted reader ไม่ได้ต้องบอก unavailable

เกณฑ์ผ่าน: ทุก factual sentence มี valid scoped reference หรือแสดง unsupported,
ชุด fixture ที่ไม่มีเหตุผลต้องไม่แต่งเหตุผล, injection corpus ไม่มี tool/network action,
revoke/delete ทำให้ retrieval เดิมใช้ไม่ได้, model unavailable ยังใช้ deterministic mode ได้
ประเมิน citation correctness/คำตอบผิดกับ reviewed corpus แยกจากความลื่นไหลของภาษา

ส่งมอบ: evidence-backed Memory/Why/Story beta ภายใน;
free-form private context และ cloud source analysis ต้องเป็นแผนเพิ่มเติม

### P4 — Shareable Replay (ประมาณ 2–4 engineer-weeks)

งาน:

- [ ] สร้าง metadata snapshot จากช่วง/project/session ที่ผู้ใช้เลือก; ไม่เผย live private query
- [ ] Allowlist/redaction: project alias, coarse timestamps และ event categories เป็นค่าเริ่มต้น
      ไม่รวม source/Diff, raw paths/logs/prompts, repo URLs/commit hashes หรือชื่อบุคคล
      ข้อมูลเพิ่มต้องมี explicit selection และผ่าน current source permissions
- [ ] Private preview ก่อน publish; กำหนด expiry, revoke และ rotating unguessable token
      เก็บ token แบบ hash; ป้องกัน token ใน logs/referrers/search indexing
- [ ] ตรวจ source permission/consent generation ทุก read; revocation ซ่อน artifact ทันที
      และลบ blobs/derived copies ตาม retention; ไม่มี shared cache ที่ข้าม revoke
- [ ] Public viewer แสดง observed/unknown และ snapshot date; ไม่เปิดลิงก์ไป private evidence
- [ ] ออกแบบ capability เฉพาะ replay share โดยตรวจ generic sharing gate เดิม;
      ไม่ปลดล็อก PublicProfilesAndEmbeds ทั้งระบบเพียงเพื่อเปิดฟีเจอร์นี้

เกณฑ์ผ่าน: unauthorized create/read, revoke, expiry, source access withdrawal,
mixed-person evidence, preview/final mismatch และ payload privacy ผ่าน end-to-end
การดาวน์โหลดโดยบุคคลภายนอกเรียกคืนไม่ได้ ต้องอธิบายตรง publish flow

ส่งมอบ: metadata-only share beta; การแชร์ Diff/agent conversations อยู่นอก MVP

### P5 — AI Efficiency Lab + Risk Radar (ประมาณ 3–5 engineer-weeks)

งาน Efficiency:

- [ ] Reuse cost/pricing versions และ eligible confirmed PR/outcome contracts เดิม
- [ ] เปรียบเทียบในกลุ่มงานที่ผู้ใช้กำหนดชนิด/ขนาด พร้อม sample size, coverage,
      unknown prices, exclusions และ denominator; เงินที่ estimate ไม่ใช่ใบแจ้งหนี้
- [ ] แสดง intervention/rework เฉพาะ provenance ที่มี; survival ต้องรอ observation ครบ
      ไม่มี lineage ห้ามใช้ line edits เป็น retained/deleted outcome
- [ ] Team aggregate ใช้ consent/small-cohort/publication rules เดิม ไม่สร้างทางลัดผ่าน personal APIs

งาน Risk:

- [ ] เริ่มกฎอธิบายได้จาก observed CI failures, unresolved dependencies,
      change concentration และ incomplete observations; ไม่ใช้ LOC สูงเป็น risk เพียงลำพัง
- [ ] Rule version, evidence, baseline window, severity และ unknown state ชัดเจน
- [ ] ประเมิน false positives/negatives จาก reviewed fixtures และ pilot;
      ไม่มี labels พอให้เป็น informational signal ไม่ประกาศ predictive accuracy

เกณฑ์ผ่าน: totals/CSV/UI ตรง independent ledger, nullable != zero,
cohort withdrawal ระงับ publication, small-group inference tests ผ่าน,
rules มีเหตุผลตรวจกลับได้ และไม่มีคำกล่าว causal ROI/คุณภาพพนักงานจาก activity

ส่งมอบ: descriptive comparison และ explainable risk signals;
ไม่สร้าง universal agent ranking หรือคะแนน productivity ของบุคคล

### P6 — Future Simulator + Mission Control รุ่นรวม (ประมาณ 3–5 engineer-weeks)

งาน:

- [ ] Future Simulator MVP = **Change Impact Preview** จาก versioned static graph
      เลือกไฟล์/โมดูล/patch บนเครื่อง → เห็น dependency paths, affected candidates,
      explicit assumptions, unresolved boundaries และ test candidates ที่มี mapping รองรับ
- [ ] เปรียบเทียบ graph ก่อน/หลังแบบ read-only; ไม่เรียกสิ่งนี้ว่าพิสูจน์พฤติกรรมใน production
      เมื่อไม่มี test mapping ห้ามเดารายการ tests ว่าครบถ้วน
- [ ] ไม่ execute code/tests, install dependencies, mutate repo หรือเริ่ม agents อัตโนมัติ;
      dynamic sandbox experiments ต้องมีแผน permission/resource isolation แยกภายหลัง
- [ ] Mission Control รวม Pulse, recent agents, replay shortcuts, risk, memory และ usage
      ใช้ data freshness/permission ของแต่ละแหล่ง; แหล่งใดล่มไม่แสดงสถานะสำเร็จค้าง
- [ ] ส่วนที่ต้องตัดสินใจ เช่น CI ล้ม/หลักฐานขาด ให้ลิงก์ไป workflow เดิม;
      MVP ไม่รวม remote start/stop agent หรือ auto-approve permissions
- [ ] ทดสอบ responsive/keyboard/no-WebGL และลด background rendering/polling ใน hidden tab

เกณฑ์ผ่าน: fixture change-impact paths ตรง graph reference และระบุ incomplete scope,
ไม่มี repo/process mutation จากการ preview, dashboard ข้ามบัญชี/องค์กรไม่ได้,
ทุก card เปิดถึง evidence ได้และแสดง stale/error ตามข้อมูลจริง

ส่งมอบ: Project Intelligence รุ่นรวมตามขอบเขต MVP ทั้ง 13 ฟีเจอร์
full behavior simulation/remote agent orchestration เป็น future scope ไม่ถือว่าส่งแล้ว

## 6. Release milestones และเวลา

| Milestone | ขอบเขต | เงื่อนไข |
|---|---|---|
| M0 Ready to implement | P0 contracts/source/support matrix | สถานะงานก่อนหน้าชัดและ protected changes ได้รับอนุมัติตามขอบเขตจริง |
| M1 Local evolution alpha | P1: Evolution + Code Universe | local privacy, Git/graph fixture และ installed viewer ผ่าน |
| M2 Replay alpha | P2: Replay/Pulse/Universe/Control shell | Receipt/capture prerequisites ที่ใช้จริงผ่านบน candidate เดียวกัน |
| M3 Explainable beta | P3: Memory/Why/Story | scoped retrieval, citation/revision/deletion และ real user comprehension ผ่าน |
| M4 Share beta | P4 | sanitized payload, source permission fences, expiry/revoke ผ่าน |
| M5 Intelligence beta | P5 | ledger/cohort/privacy และ risk evaluation ผ่าน |
| M6 Integrated pilot | P6 + regression ของ M1–M5 | impact limitations, performance, source privacy และ usability ผ่าน |

รวมประมาณ **19–32 engineer-weeks** สำหรับ scoped MVP หลังเริ่มแผนนี้:
เป็น effort estimate เบื้องต้น ไม่ใช่วันส่งมอบรับประกัน ไม่รวมงานปัจจุบันที่ยังค้าง,
provider login/quota, signing/store reviews, observation windows, external permissions
หรือการแก้ defect ที่ยังไม่พบ ต้อง re-estimate หลัง P0/P1 จาก measured throughput
งาน 7/30-day cohorts ต้องรอข้อมูลอายุครบจริง เพิ่มคนไม่สามารถเร่งเวลาปฏิทินส่วนนี้ได้

ไม่ทำทั้ง 13 ตัวพร้อมกัน: M1/M2 ต้องใช้ได้โดยไม่รอ Story/Simulator;
แต่ละ milestone ปิด/rollback ได้แยกกันผ่าน capabilities โดยไม่ลบ facts เดิม
ไม่มีคำสั่ง deploy/publish/เปิด flag จากการที่ checklist ในแผนถูกติ๊กครบเพียงอย่างเดียว

## 7. การตรวจรับร่วมทุก milestone

- **Correctness:** independent fixtures/ledgers, duplicate/replay, out-of-order,
  late corrections, rename/merge/rebase และ missing evidence ตามฟีเจอร์ที่เปลี่ยน
- **Isolation:** owner/repo/org/session scoped queries, signed cursor/revision,
  account switching และ final permission recheck; query keys มี userId และ scope ที่จำเป็น
- **Privacy:** inspect outbound payload/log/export, local content egress,
  untrusted repo content, revoked permissions, account deletion/index/blob cleanup
- **Performance:** P0 กำหนด fixture เล็ก/กลาง/ใหญ่และ reference machine;
  เป้าตั้งต้น interactive read p95 ≤2s, local diff preview ≤2s, bounded graph build
  มี progress/cancel; validate ว่าทำได้จริงก่อนประกาศ SLA, LLM generation วัดแยก
  ไม่ truncate ยอดเงียบ ๆ; over-limit ตอบเหตุผลพร้อมให้ลดขอบเขต
- **UX:** desktop/mobile, keyboard, screen-reader labels, reduced motion,
  no-WebGL fallback, empty/partial/error/stale และเปิด evidence จาก insight ได้
- **Real use:** รุ่น beta ใช้ pilot ที่ยินยอมอย่างน้อย 5 คน;
  เป้าทดสอบอย่างน้อย 4 คนอธิบาย coverage/citation ได้ และ 3 คนกลับมาใช้ซ้ำใน 7 วัน
  เกณฑ์เหล่านี้เป็นเป้าประเมิน ไม่ใช่ผลที่เกิดขึ้นแล้ว และไม่แทน native certification
- **Evidence:** บันทึก source SHA/artifact/runtime tuple, expected/actual,
  passed/failed/pending/unsupported และ reviewer; ห้ามใช้ compile/coverage แทน live acceptance

การทดสอบเริ่มจาก affected tests แล้วรัน required checks ตาม `.context/commands.md`
ก่อน release; ไม่รันทุก infrastructure suite แบบกว้างโดยไม่ตรวจ fixture prerequisites
รักษา thresholds เดิมและไม่ suppress failures เพื่อปิด milestone

## 8. ข้อกำหนดการลงมือใน repository

อ่าน `CLAUDE.md` และ context ที่ trigger ทุกครั้งก่อนเปลี่ยน scope
Heartbeat/client producers/ingest/queue/timeline/duration/readback semantics และ tests
ที่เกี่ยวข้องอยู่ใน protected domain ตาม [.context/heartbeat-safety.md](../.context/heartbeat-safety.md)
แผนนี้ **ไม่ใช่ approval** ให้แก้ส่วนเหล่านั้น เมื่อเริ่มแต่ละ increment ต้องระบุไฟล์,
การเปลี่ยน, expected result และผลต่อ locked baseline ก่อนขออนุมัติ
รักษาสูตร/timeout/overlap เดิม; renderer/read model ใหม่ไม่ใช่เหตุผลให้เปลี่ยนการนับเวลา

Frontend ใช้ `lib/wakaclock`, TanStack Query, `QueryState` และ user-scoped keys เดิม
Cinema และ classic layouts ต้องรักษาพฤติกรรมร่วมและ theme boundaries;
อย่าสร้าง WebGL-only product flow หรือเปลี่ยนอีก theme โดยไม่ตั้งใจ

Reuse checkout/target ที่เหมาะสมตาม [.context/storage.md](../.context/storage.md)
วัดก่อน/หลัง substantial builds, คง profile ประหยัดพื้นที่ และล้างเฉพาะ disposable cache
ของงานนี้หลัง consumers หยุด ไม่สร้าง target/worktree ใหม่ทุก increment
Source/evidence/dependencies/active binaries และงานของผู้อื่นต้องอยู่ครบ

เมื่อมีคำสั่ง commit/push ภายหลัง ใช้ task branch `codex/…` และตรวจ uncommitted work
ของงานอื่นก่อน; แผนนี้ไม่อนุญาต commit/push/merge/deploy หรืออัปเดต remote `main`

## 9. งานแรกเมื่อกลับมาเริ่มแผนนี้

1. ระบุผลส่งมอบของงานปัจจุบันและ source candidate ใหม่ แทนการใช้ SHA ในเอกสารนี้ต่อทันที
2. เปิด acceptance ledger ของ P0 พร้อมสถานะจริงของ Receipt/Team/runtime dependencies
3. ทำ local Git viewer + parser spike กับ fixture repo โดยไม่แตะ timing/capture
4. สรุป ADR/contracts และรายการ protected files ที่จำเป็นต้องเปลี่ยนจริง
5. เริ่ม P1 เป็น vertical slice: เลือก repo → เลือกสอง revisions → ดู Diff → ดู Code Map

เมื่อจบแต่ละ milestone ให้อัปเดต source/status/evidence และแผนถัดไปในเอกสารนี้
แยก “พัฒนาเสร็จ”, “ตรวจผ่าน” และ “เปิดใช้จริง” ทุกครั้ง
