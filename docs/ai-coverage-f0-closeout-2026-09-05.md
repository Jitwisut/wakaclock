# AI coverage — F0 closeout evidence

วันที่: 2026-09-05 · Phase: F0 · สถานะ: `validated`

เอกสารนี้ปิด gate ของ F0 ตาม [execution plan](../plans/ai-coverage-execution-plan.md)
โดยยืนยันว่าแต่ละช่องว่างมี expected/actual และมี regression ที่ชี้พฤติกรรมปัจจุบัน
อย่างชัดเจน งานนี้ไม่ได้อ้างว่า F1/F2 แก้ช่องว่างเหล่านั้นแล้ว และไม่ได้อ้าง live
certification ของ AI tool ใด

## F0-02 reproducer matrix

| Scenario | Expected | Actual ที่ล็อกไว้ | Evidence |
| --- | --- | --- | --- |
| Unmatched AI edit | `unattributed` เมื่อไม่มี human proof | `human` จาก empty sidecar candidate | `extensions/vscode/test/aiAttribution.test.ts` — `it.fails` |
| Delayed sidecar | editor flush ต้องคง pending/`unattributed` และ late event ต้อง reconcile ได้ | first flush เป็น `human`; ไม่มี pending ledger; late retry จึงเป็นคนละ call | `extensions/vscode/test/aiAttribution.test.ts` — `it.fails` |
| Mixed human + AI edit | แยก ownership ต่อ change เช่น AI 4 lines + human 6 lines | classifier ปัจจุบันให้ scalar verdict เดียว และกรณีนี้ตกเป็น `unattributed` ทั้ง 10 lines | `extensions/vscode/test/aiAttribution.test.ts` — `it.fails` |
| Doctor placeholders | `ai doctor` และ `doctor ai` ต้องใช้ broker health เดียวกัน | `doctor ai` เห็น broker running แต่ `ai doctor` รายงาน `running: false` | `backend/api/crates/wakaclock-cli/tests/broker_process.rs` — ignored reproducer |

`it.fails` และ `#[ignore]` เป็นเจตนา: F0 บันทึกช่องว่างที่พิสูจน์ได้เพื่อส่งต่อให้
F1/F2; ไม่เปิด heuristic attribution เพื่อทำให้ gate เขียวปลอม

## F0-03–F0-07 evidence

- F0-03: [unknown-authorship ADR](../plans/decision-unknown-authorship-vs-unattributed-ai.md)
  แยก `Unknown` กับ `Unattributed AI` และกำหนดไม่ให้ `Unknown` ถูกเลื่อนเป็น AI
  โดยปริยาย
- F0-04: [VS Code capability spike](vscode-human-input-capability-spike-2026-09-05.md)
  ระบุขอบเขตจริงของ typing, IME, paste, formatter และ version identity
- F0-05: [canonical operation/revision protocol](../plans/design-canonical-operation-and-revision-protocol.md)
  กำหนด alias proof, correction row และ max-revision read semantics
- F0-06: [wire/schema inventory](../plans/wire-schema-compatibility-inventory-2026-09-05.md)
  ระบุ boundary, owner, additive migration และ downgrade semantics
- F0-07: [ground-truth manifest](../plans/ai-coverage-ground-truth-manifest.md)
  ระบุ Tier 1/Tier 2, runner/account requirements และงบวัดผลโดยไม่ใส่ผลปลอม
- [retention policy](../plans/ai-coverage-retention-policy.md) ล็อกค่าเริ่มต้น
  pending 24 ชั่วโมง, alias/superseded revision 30 วัน และ grace 15 วินาที

## Gate result

- F0 baseline, decision records, capability inventory, schema ownership และ
  reproduction matrix มี artifact ใน repository แล้ว
- Known failures ถูกแยกเป็น expected failing regressions; ไม่มีการนับเป็น production pass
- F1 เป็นระยะถัดไปสำหรับ pending observation, sidecar sequence/resume,
  reconciliation และ canonical revision projections
- Live ground-truth/certification ยังเป็นงาน F4/F5 ตาม dependency ไม่ใช่เงื่อนไขปิด F0
