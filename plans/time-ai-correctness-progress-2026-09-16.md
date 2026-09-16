# สถานะแผนแก้ความถูกต้องของเวลาและ AI attribution

วันที่ตรวจล่าสุด: 2026-09-17
แผนหลัก: [time-ai-correctness-remediation-2026-09-15.md](time-ai-correctness-remediation-2026-09-15.md)
รายงานการตรวจตั้งต้น: [time-ai-review-2026-09-15.md](../docs/time-ai-review-2026-09-15.md)

เอกสารนี้แยกสถานะ implementation, การตรวจในเครื่อง และการรับรอง runtime จริงออกจากกัน
ผล unit test ไม่ถูกนับเป็น live certification และยังไม่มีการประกาศว่า Wakaclock แม่นกว่า
WakaTime จนกว่าจะมีข้อมูลอิสระจากทั้งสองระบบครบตามเกณฑ์ใน TA-07

## สรุปสถานะ

| ขั้น | สถานะ | หลักฐานปัจจุบัน | สิ่งที่ยังค้าง |
| --- | --- | --- | --- |
| TA-00 | `validated_local` | นิยาม/decision table อยู่ในแผนหลัก, regression fixtures และ conformance tests | ยังไม่มี release baseline และ live artifact ของ build ที่จะปล่อย |
| TA-01 | `validated_local` | Codex outcome normalizer, parser/hook fail-closed, success/failed/partial/wrapper/replay tests | ต้องรันกับ payload จริงของ Codex CLI และ Desktop แยกกัน |
| TA-02 | `validated_local` | unified diff/apply_patch body-sign fixes, bodyless delete เป็น `null`, core/hook tests | ต้องตรวจ payload และ storage จริงใน live campaign |
| TA-03 | `validated_local` | VS Code bounded before/after metric `editor-before-after-v1`, version continuity, replay/large-file/mixed-window tests | legacy heartbeat wire ยังไม่มี metric-version field จึงส่ง line totals จาก editor ไม่ได้จนกว่าจะมี wire/storage rollout |
| TA-04 | `validated_local` | model/provider/session correlation guards, nullable line coverage fields, API/UI unavailable/partial labels, explicit Unknown handling | ยังไม่มี end-to-end model-switch/nested-session readback จาก runtime จริง |
| TA-05 | `validated_local` | summaries calculation contract, comparison parameter guards, external runner, internal replay relabeling | external WakaTime campaign ใหม่ยังไม่ได้รัน และยังไม่มี independent activity oracle |
| TA-06 | `implemented` | metadata-only read-only repair inventory; stable reference/hash; unresolved/conflict cases stay unresolved | revision apply สำหรับแก้ outcome/line ยังไม่ทำ; identity-only repair ห้ามใช้แทน |
| TA-07 | `blocked` | readiness probe ยืนยัน Codex CLI `0.154.0-alpha.6.2` และ Claude Code `2.1.266`; local tests ผ่าน | Claude Code ยัง `loggedIn=false`; ไม่มี `WAKATIME_API_KEY`/`WAKACLOCK_API_KEY`; ไม่มี server/database/Docker สำหรับ readback; Codex Desktop ยังไม่มี campaign แยก |
| TA-08 | `blocked` | release notes/monitoring semantics เริ่มบันทึกใน README และ progress นี้ | ยังไม่ควร promote/release scope Codex+Claude จนผ่าน live gate และแก้ quality gate ที่อยู่นอก scope |

การ rollout เวลา Active v1 เริ่มมี implementation ในรอบนี้แล้ว แต่ยังอยู่สถานะ
`validated_local`: VS Code ส่ง editor lease ที่ติด marker `editor_active_v1` สูงสุด 15 วินาที
ต่อช่วง, AI tool hook ส่ง `ai_tool_v1` จาก start/end สูงสุด 6 ชั่วโมง, API คำนวณ union
human/AI และ overlap แยกจาก WakaTime-compatible bridge, และ response ใหม่มี
`active_*` กับ `wakatime_compatible_seconds` แบบ additive. ค่า primary เปลี่ยนผ่าน
`DURATION_PRIMARY_MODE=wakatime_compatible|active_v1` โดยค่าเริ่มต้นยังคง compatibility
จนกว่าจะผ่าน shadow/live parity campaign.

## สิ่งที่แก้แล้ว

- Codex parser และ `extensions/ai-agents/codex/heartbeat-hook.sh` ไม่สร้าง verified edit
  จาก status ของ wrapper เพียงอย่างเดียว ต้องมี success summary ที่รู้จักและตรงกับทุก
  operation; failed, no-op, ambiguous wrapper, partial ที่จับคู่ไม่ได้ และ truncated patch
  จะไม่สร้าง file edit
- parser รองรับ output string/object/content block ที่กำหนดขอบเขตไว้ แต่ไม่เก็บ output,
  prompt หรือ patch ลง telemetry; call ID ซ้ำข้าม input/turn ถูกปฏิเสธ
- unified diff นับ `+++`/`---` ใน hunk body เป็นเนื้อหาจริง และ apply_patch แยก
  `Delete File` ที่ไม่มี before-content เป็น `lines_deleted: null`; rename, repeated path,
  delete+add และ multi-file มี operation identity แยกกัน
- VS Code เปลี่ยนจากการบวก line count ตาม event มาเป็น snapshot before/after แบบมีขอบเขต
  และงบคำนวณ; restart, missing baseline, external reload, version jump และไฟล์ใหญ่ให้
  `unavailable`; ไม่ส่ง `keystrokes` ที่เป็นการเดาจากจำนวนอักขระ และไม่ส่ง editor line
  totals แบบ legacy ที่ไม่มี metric version
- การจับคู่ editor กับ sidecar ต้องมี shared tool identity หรือ content fingerprint;
  mixed/replay/unavailable windows ไม่ถูกยกให้ model ใด และ AI producer line totals ไม่ถูก
  ส่งซ้ำจาก editor; save ที่จับคู่ AI ได้ส่ง metadata-only provenance โดยไม่ทำให้ save กลาย
  เป็น Human
- API/UI แยก measured zero, partial และ unavailable ผ่านจำนวน heartbeat ที่มี nullable
  line counters; explicit `actor_type=unknown` ไม่ถูกยกระดับเป็น Human จาก `write` หรือ
  character activity เพียงอย่างเดียว
- `/summaries` ส่ง additive `calculation` metadata และปฏิเสธ timeout/writes-only/project/
  branch/category override ที่ service ยังไม่รองรับ แทนการคำนวณผิดแล้วรายงานเทียบได้
- duration comparison runner ตรวจ effective timezone/timeout/scope/category partition,
  วันที่ขาดข้อมูล, queue settlement และ dirty worktree; `certify_live.py` ระบุชัดว่าเป็น
  internal replay consistency ไม่ใช่ผลจาก WakaTime จริง
- historical repair เป็น dry-run inventory เท่านั้น: ใช้ stable event/session reference,
  hash reference ก่อนรายงาน, ไม่แก้เวลา/identity/source rows, และปล่อย missing/conflicting
  source เป็น unresolved
- offline heartbeat queue แยกตาม server/credential owner, เก็บ correction revision ครบ,
  lease การส่งครั้งละไม่เกิน 100 rows, เก็บ 401/403 ไว้ retry และย้าย payload ที่เสียถาวร
  ไป dead-letter แทนการลบเงียบ; หน้าสรุป local นับเฉพาะ queue scope ปัจจุบัน
- duration range ใช้ timestamp จริงตัดสิน idle timeout ก่อน clip เข้า range และ anchor
  หลังเปลี่ยนไฟล์/project เป็นเจ้าของช่วงเวลาถัดไป จึงไม่ยกเวลาทั้ง chain ให้ project แรก
- VS Code เก็บ timestamp ตอนเกิดกิจกรรมไว้ข้าม retry, force-flush ทุก buffer ตอน shutdown
  แบบ await, และยุติ CLI child ที่ค้างเกิน 45 วินาที
- Active timing v1 แยก delivery cadence 120 วินาทีออกจาก evidence lease 15 วินาที:
  gap 16 วินาทีขึ้นไปไม่สร้างเวลา, ช่วงเขียนต่อเนื่องยังรวมเป็น union ของ lease สั้น ๆ,
  และช่วง AI tool ใช้ start/end ที่สังเกตได้จริงโดยไม่คูณตามจำนวนไฟล์
- `editor_active_v1` ยังคงเป็นหลักฐานเวลา human presence แม้ `actor_type=unknown`
  จาก mixed/unavailable line baseline; source นี้ถูกปฏิเสธเมื่อ actor เป็น AI เพื่อไม่ให้
  เวลาเขียนของ AI ถูกย้ายเข้าฝั่งคน
- เส้นทาง legacy ที่รับ `active_seconds` ค่าเดียวไม่แบ่ง claim ยาวเป็นช่วงติดกันอีกต่อไป:
  เก็บเฉพาะ trailing evidence window สูงสุด 120 วินาที และต้องมี heartbeat ข้างเคียง
  จึงจะ bridge ช่วงพักได้ ป้องกัน heartbeat เดียวสร้าง session ยาวปลอม
- Timeline/API เพิ่ม `active_seconds`, `active_human_seconds`, `active_ai_seconds`,
  `active_overlap_seconds`, `active_coverage` และค่า compatibility สำหรับเปรียบเทียบ;
  dashboard ใช้ Active เป็น primary เมื่อ coverage เป็น `measured` และ fallback เป็น
  WakaTime-compatible สำหรับข้อมูลเก่า; status API ส่ง `active_intervals` แบบ raw เพื่อให้
  CLI union กับ queue ได้โดยไม่บวกซ้ำหลัง crash/retry และไม่เอา legacy queue มาปน Active

## การตรวจที่ผ่านล่าสุด

- `cargo fmt --manifest-path backend/api/Cargo.toml --all -- --check`
- `cargo clippy --manifest-path backend/api/Cargo.toml --all-targets --offline -- -D warnings`
- `cargo test -p wakaclock-core --lib`: 294 ผ่าน, 0 ตก
- `cargo test -p wakaclock-server --lib`: 323 ผ่าน, 0 ตก, 27 ignored (integration dependencies)
- `cargo test -p wakaclock-cli --bin wakaclock`: 66 unit tests ผ่าน, 0 ตก
- `cargo test -p wakaclock-cli --test broker_process -- --test-threads=1`: 7 ผ่าน, 0 ตก
- `cargo test -p wakaclock-core --test attribution_conformance --offline`: ผ่าน
- `npm test --prefix extensions/vscode`: 12 files, 129 tests ผ่าน (รวม regression
  7 นาทีเขียน + 1 นาที idle ไม่กลายเป็น 8 นาที)
- `npm run compile --prefix extensions/vscode`: ผ่าน
- `cargo check -p wakaclock-server --manifest-path backend/api/Cargo.toml`: ผ่าน
- `NEXT_PUBLIC_APP_URL=https://atoaxis.com npm run build --prefix frontend/app -- --webpack`: ผ่าน
- `npm run lint --prefix extensions/vscode`: ผ่าน
- `npm run typecheck --prefix frontend/app`: ผ่าน
- `python3 scripts/duration-audit/verify_port.py`: ผ่าน
- `python3 scripts/duration-audit/golden.py`: ผ่าน
- `python3 -m unittest discover -s scripts/duration-audit -p 'test_*.py'`: 14 ผ่าน
- `python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test_*.py'`: 38 ผ่าน
- `python3 scripts/ai-coverage/validate_catalog.py certifications/ai-adapters/catalog-v1.json`: ผ่าน
- `bash extensions/ai-agents/codex/tests/heartbeat-hook.test.sh`: ผ่าน
- frontend targeted AI table tests: 8 ผ่าน
- live-certification harness dry-run + `validate_certification.py`: artifact schema ผ่าน;
  ทุก runtime stage ยังคง `not_run` ตามเจตนาของ dry-run

## ข้อจำกัดและขั้นถัดไป

การรับรอง live ชุดแรกที่ผู้ใช้เลือกคือ Codex + Claude Code แต่เครื่องนี้ยังไม่มีเงื่อนไข
สำหรับทำ campaign จริง: Claude Code ยังไม่ได้ login, ไม่มี API keys สำหรับอ่านผลทั้งสอง
ระบบ, และไม่มี Docker/ClickHouse test service. Codex CLI มี binary และ version ที่ตรวจได้
แต่ยังไม่มี authenticated server readback; Codex Desktop ต้องแยกตรวจ surface และ payload
จาก CLI แม้ใช้ backend parser ร่วมกัน

เมื่อ credentials/runtime/server พร้อม ให้รัน TA-07 ตาม [ai-live-certification-test-plan](ai-live-certification-test-plan.md)
โดยเก็บ exact client/version/OS/arch/model tuple, operation IDs, broker/API/canonical/
dashboard readback, retry/offline/replay และช่วงเวลาอ้างอิงอิสระอย่างน้อย 7 วันเต็ม.
จากนั้นจึงสร้าง release artifact ของ scope ที่ผ่านจริงและค่อยเปิด TA-08

การรัน `npm test` ทั้ง frontend ตอนนี้ได้ 341 ผ่านจาก 342 และมี 1 failure เดิมนอก scope
การแก้ครั้งนี้ใน `test/marketing-parity.test.ts` (เอกสารภาษาไทยมี section `docs-2` และ
`docs-3` เพิ่มจาก expected `docs-1`). จึงไม่อ้างว่า repository quality gate ทั้งหมดผ่าน
และยังไม่ใช้ผลนี้เป็นหลักฐาน release readiness ของงานเวลา/AI
