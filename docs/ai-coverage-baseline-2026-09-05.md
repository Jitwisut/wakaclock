# AI coverage — F0-01 baseline snapshot

วันที่: 2026-09-05 · Task: [F0-01](../plans/ai-coverage-task-ledger.md) · ไม่ใช่ implementation, บันทึกสถานะก่อนเริ่ม F0-02 เป็นต้นไป

## 1. Branch/commit

- Branch งานนี้: `features/ai-coverage-f0-baseline`
- แตกจาก `main` @ `98e24552a2ac4e79ab5c92f04b72d2891dd48eb8` (`Merge branch 'phase8/production-wiring'`) — จุดแตก branch เดิม ยังเป็นข้อเท็จจริงทางประวัติศาสตร์
- **อัปเดต (เดียวกันวันนี้):** ผู้ใช้สั่งให้ commit+push งานที่ dirty ก่อนแตก branch เข้า `main` แล้วเริ่ม F0 ต่อ ลำดับที่เกิดขึ้นจริง:
  1. Commit งาน "editor self-declaration" (10 ไฟล์ code, ไม่รวม ROADMAP.md/plan docs) → `main` @ `c4d36f5`
  2. Commit งาน frontend analytics query-keys/endpoint (2 ไฟล์) → `main` @ `04077bf`
  3. `git push origin main` — สอง commit นี้อยู่บน `origin/main` แล้ว
  4. กลับมาที่ branch นี้ แล้ว `git merge main --ff-only` → tip ของ branch นี้ตอนนี้คือ `04077bf`
  5. Commit ROADMAP.md + เอกสารแผนทั้งหมด (รวมไฟล์นี้) → branch นี้ @ `a1e32c7`
- **Branch tip ปัจจุบัน: `a1e32c7`** (บน `features/ai-coverage-f0-baseline`, ยังไม่ push/merge กลับ `main`)

## 2. Dirty-tree boundary ตอนแตก branch (ประวัติศาสตร์ ณ เวลาที่เขียน §1 เดิม)

งานเหล่านี้มีอยู่ก่อน F0 เริ่ม (ไม่ใช่ผลจาก F0) — **ตอนนี้ commit แล้วทั้งหมด ไม่ได้ค้างเป็น dirty tree อีกต่อไป**:

Modified → commit แล้วที่ `c4d36f5` (`main`, feature "editor self-declaration"):
- `backend/api/crates/wakaclock-cli/src/broker.rs`
- `backend/api/crates/wakaclock-cli/src/main.rs`
- `backend/api/crates/wakaclock-cli/tests/broker_process.rs`
- `backend/api/crates/wakaclock-core/src/ai/adapter.rs`
- `backend/api/crates/wakaclock-core/src/ai/producer.rs`
- `backend/api/crates/wakaclock-core/src/broker.rs`
- `extensions/ai-agents/common/emit-event.sh`
- `extensions/ai-agents/common/tests/emit-event.test.sh`

Modified → commit แล้วที่ `04077bf` (`main`, frontend analytics query-keys):
- `frontend/app/lib/wakaclock/endpoints.ts`
- `frontend/app/lib/wakaclock/query-keys.ts`

Modified/new → commit แล้วที่ `a1e32c7` (branch นี้เท่านั้น ยังไม่อยู่บน `main`):
- `plans/ROADMAP.md` (modified)
- `docs/ai-coverage-gap-audit-2026-09-05.md` (new)
- `plans/ai-coverage-execution-plan.md` (new)
- `plans/ai-coverage-task-ledger.md` (new)
- `plans/ai-coverage-validation-plan.md` (new)
- `docs/ai-coverage-baseline-2026-09-05.md` (new, ไฟล์นี้เอง)

หมายเหตุ: working tree ของ branch นี้สะอาดแล้ว (`git status` ไม่มี pending change) commit ทั้งหมดข้างบนยังไม่ผ่านการรัน `cargo test`/`npm run validate`/shell test suite แบบเต็มหลัง commit — ดู §6 สำหรับสถานะการตรวจสอบ

## 3. Component versions ณ จุดนี้

| Component | Version | ที่มา |
| --- | --- | --- |
| Rust workspace (`wakaclock-server`, `-core`, `-cli`, `-ast`, `-ls`) | `0.1.0` (ทุก crate ใช้ `version.workspace = true`) | [backend/api/Cargo.toml:18](../backend/api/Cargo.toml) |
| Frontend (`frontend/app`) | `1.2.0` | frontend/app/package.json |
| VS Code extension | `0.1.0` | extensions/vscode/package.json |
| Browser extension (chromium/firefox) | `0.1.0` / `0.1.0` | extensions/browser/{chromium,firefox}/manifest.json |
| Kilo Code ai-agent script package | `0.1.0` | extensions/ai-agents/kilo-code/package.json |
| Figma extension | `0.1.0` | extensions/figma/package.json |
| Zed / desktop-tracker / Blender extensions | ไม่มี version field แยก — ต้องตรวจ `extension.toml`/`Cargo.toml` เฉพาะทางเมื่อ task แตะส่วนนั้น | — |

ทุก Rust crate ใช้ workspace version เดียวกัน (`0.1.0`) — ไม่มีการ diverge ระหว่าง core/cli/server ณ commit นี้

## 4. Module wiring snapshot

อ้างอิงตาราง baseline ใน [execution plan §3](../plans/ai-coverage-execution-plan.md) เป็นหลัก เพิ่มจุดที่ตรวจยืนยันเจาะจงสำหรับ F0-01:

- **Observer/shadow gate default**: `ObserverConfig::default()` ใน `wakaclock-core/src/ai/shadow.rs` ยืนยันด้วย test `observer_config_round_trips_and_defaults_to_off_and_observe_only` — ปิดและ `observe_only` เป็นค่าเริ่มต้นจริงในโค้ด ไม่ใช่แค่ตามเอกสาร ตรงกับ [[decision-accuracy-over-coverage]]
- **⚠ ชื่อชนกัน**: มี `pub struct ObserverConfig` สองตัวคนละไฟล์ — `ai/diagnostics.rs:50` (privacy-safe integration health, ไม่แตะ attribution) และ `ai/shadow.rs:111` (universal-detection shadow-mode gate, planai2 Phase 7) คนละ scope คนละหน้าที่ แต่ชื่อซ้ำกันเสี่ยงสับสนเวลาแก้โค้ดหรือ import ผิดตัว — บันทึกไว้เป็นข้อสังเกต ยังไม่ใช่ scope ที่ F0-01 แก้
- **CorrelationEngine**: อยู่ใน `ai/shadow.rs` และ `ai/correlation_engine.rs` เท่านั้น (ยังเป็น shadow-mode, ไม่ feed attribution จริงตาม default ด้านบน)
- **`supported_ai_parsers()`**: `wakaclock-cli/src/main.rs:2991` — จุดเดียวที่ประกาศ parser ที่ CLI รองรับจริง (ใช้เทียบกับ registry/manifest claim ใน F3)
- **`ai_diagnostics` service**: wire เข้า AppState แล้วที่ `backend/api/src/infrastructure/app/init.rs`, handler อยู่ที่ `handlers/v1/ai_diagnostics.rs` — ตรงกับที่ execution plan ระบุว่า `sanitize_report` ลด Verified ทุกครั้ง (ยังไม่แก้ใน F0-01)

## 5. ยังไม่ทำใน commit นี้

F0-01 ครอบคลุมเฉพาะการบันทึกสถานะข้างบน งานถัดไปตาม [task ledger](../plans/ai-coverage-task-ledger.md):

- F0-02: fixture/reproducer สำหรับ unmatched AI edit, delayed sidecar, mixed edits, doctor placeholders
- F0-03/F0-04: ADR unknown-vs-Unattributed-AI + VS Code capability spike (ต้องรอ F0-02)
