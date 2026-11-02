# Approval Gate Template

ใช้ก่อนเริ่มทุก phase ที่แก้ไฟล์ใน protected scope ตาม
[`.context/heartbeat-safety.md`](../../.context/heartbeat-safety.md)
คำว่า "ทำต่อ", "ช่วยดู", "แก้ให้หน่อย" หรือการมีแผนนี้อยู่แล้ว **ไม่ถือเป็นการอนุมัติ**

## ส่วนที่ต้องมีครบทุกครั้ง

### 1. ไฟล์ที่จะเปลี่ยน
- ระบุ repository path ทุกไฟล์ แยก "แก้" กับ "เพิ่มใหม่"
- ระบุว่าไฟล์ใดเป็น source of truth ของ contract
- ระบุ test/fixture ที่จะเพิ่มหรือแก้ (นับเป็น protected ด้วย)

### 2. สิ่งที่จะทำ
- logic หรือ contract ที่เปลี่ยน แบบสั้นและเฉพาะเจาะจง
- parser/manifest/agent ID ที่เพิ่ม
- ยืนยันว่า wire format ไม่เปลี่ยน (หรือถ้าเปลี่ยน ต้องเปลี่ยน server model + ClickHouse DDL พร้อมกัน)

### 3. เหตุผลและผลลัพธ์ที่คาดหวัง
- behavior ก่อน/หลัง
- ผลต่อผู้ใช้และข้อมูล (แถว heartbeat/usage ที่จะเพิ่ม, label ใน dashboard)

### 4. ความเสี่ยง
ต้องพูดถึงทุกข้อ ถ้าไม่เกี่ยวให้เขียนว่าไม่เกี่ยวพร้อมเหตุผล:
- event หาย (cursor ข้าม record)
- event ซ้ำ (re-parse, hook + transcript, snapshot rewrite)
- idle over-count / under-count
- ordering และ timestamp/timezone
- retry และ offline queue
- backward compatibility ของ `parser_state` เดิมและ client รุ่นเก่า
- privacy (path/prompt/โค้ดหลุดออกจากเครื่อง)
- การ lock database ของ tool อื่น

### 5. หลักฐานที่จะเก็บ
- unit/conformance/integration tests ที่ต้องผ่าน (ชื่อไฟล์จริง)
- fixture: สังเคราะห์หรือจากไฟล์จริงที่ลบเนื้อหาแล้ว (เก็บแค่ key/โครงสร้าง)
- live cert ต่อ OS (macOS, Windows, Linux)
- query วัด duplicate และยอด 1%
- rollback plan

## ส่วนเพิ่มสำหรับ locked baseline

ทุก phase ในแผนนี้ตั้งใจให้กระทบเวลา **0%** (time-neutral) แต่ต้องเขียนยืนยัน 3 ข้อนี้:

1. แถวใดในตาราง Locked baseline ที่อาจได้รับผล (ปกติคือ "ไม่มี") และค่าเดิม → ค่าใหม่
2. ผลต่อยอดเวลาต่อวันที่คาด (เพิ่ม/ลดกี่ % และกรณีไหน)
3. หลักฐานเทียบก่อน/หลังบนข้อมูลจริงหรือ fixture ที่ครอบคลุมแถวที่ได้รับผล

การปลด time-neutral ของ adapter (Phase 11) **ต้องใช้คำขอแยก** และระบุตัวเลขจริงของ 7 วัน

## Checklist ก่อนแก้

- [ ] อยู่บน branch/worktree ใหม่จาก `main` (ไม่ใช่ `codex/team-closure-wip`)
- [ ] อ่าน [`.context/dead-code.md`](../../.context/dead-code.md) ถ้าแตะ `server/`
- [ ] อ่าน [`.context/backend/crates.md`](../../.context/backend/crates.md) ถ้าแตะ `core/`
- [ ] อ่าน [`.context/storage.md`](../../.context/storage.md) ก่อน build
- [ ] ได้คำตอบคำถามเปิดของ phase นี้ใน [README](README.md) แล้ว
- [ ] ได้รับคำตอบ "อนุญาต" ที่อ้างถึง scope นี้โดยตรง

## Checklist หลังทำเสร็จ (รายงานเจ้าของ)

- [ ] actual result เทียบกับ expected result
- [ ] รายชื่อไฟล์ที่แก้จริง (ถ้าเกิน scope ต้องแจ้งและขอใหม่)
- [ ] test/evidence ที่ผ่านและไม่ผ่าน พร้อม output
- [ ] ความเสี่ยงที่เหลือ
- [ ] ผลต่อ production
- [ ] อัปเดต [coverage-matrix.md](coverage-matrix.md)

## Checklist ก่อน commit / push

- [ ] ได้รับคำสั่ง commit แยกจากการอนุมัติให้แก้
- [ ] ไม่มี credential, transcript จริง, path ส่วนตัว หรือ build artifact ใน diff
- [ ] fixture ที่มาจากไฟล์จริงถูกลบเนื้อหา prompt/โค้ดแล้ว
- [ ] ได้รับคำสั่ง push แยก และปลายทาง **ไม่ใช่** `main`

## ตัวอย่างข้อความขออนุมัติ (ย่อ)

```
ขออนุญาตเริ่ม Phase 0X — <ชื่อ>
1) ไฟล์: แก้ core/src/ai/parser.rs, core/src/ai/state.rs; เพิ่ม core/src/ai/sqlite_source.rs ...
2) ทำ: เพิ่ม SourceKind/SourceCheckpoint (serde default = Jsonl) ...
3) ผล: parser เดิมให้ผลเท่าเดิมทุก byte; parser ใหม่ใช้ cursor แบบ SQLite ได้
4) ความเสี่ยง: cursor regression → event หาย/ซ้ำ; ป้องกันด้วย golden test ...
5) หลักฐาน: cargo test -p wakaclock-core ai::, scripts/ai-attribution-integration.py ...
Baseline: ไม่แตะแถวใด, ผลต่อเวลา 0% (time-neutral), หลักฐาน: query 1% ก่อน/หลัง
อนุญาตให้แก้ scope นี้ไหมครับ (ยังไม่รวม commit/push)
```
