# F8 release and maintenance rehearsal — 2026-09-08

สถานะรอบนี้: **F8-01/F8-02 ทำ implementation และ local checks แล้ว; ยังไม่ใช่
release certification**

## F8-01 compatibility rehearsal

`[compatibility-matrix-v1.json](../scripts/ai-coverage/compatibility-matrix-v1.json)`
เป็น matrix แบบ metadata-only ครอบคลุม local hook/CLI/broker, CLI/API,
ClickHouse/PostgreSQL semantics และ F7 topology. Runner คือ
`[rehearse_compatibility.py](../scripts/ai-coverage/rehearse_compatibility.py)`
ซึ่งทำงานแบบ fail-closed:

- synthetic cases ตรวจ old-shape read, duplicate identity, additive topology
  downlevel, privacy rejection, unsupported schema, unavailable-vs-zero,
  revision winner, catalog resolution และ topology scope
- cases ที่ต้องใช้ previous binary, release digest หรือ live database เป็น
  `blocked` จนกว่าจะมีหลักฐานจริง
- report เก็บเฉพาะ case id, boundary, status และ bounded reason; ไม่ echo
  payload, prompt, path หรือ source content
- exit code `0` คือผ่านทั้งหมด, `1` คือ failure และ `2` คือมี blocked gate

ผลจาก matrix ที่ commit มาด้วยใน workspace นี้คือ `12 passed`, `0 failed`,
`6 blocked` เพราะ repository ยังไม่มี previous release commit/build digest
ที่ owner ยืนยัน จึงยังไม่เรียก F8-01 ว่า released compatibility proof.

## F8-02 shipped artifact verification

`[verify_release_artifacts.py](../scripts/ai-coverage/verify_release_artifacts.py)`
ถูกต่อเข้ากับ `.github/workflows/release-extension.yml` ทั้งใน package job และ
publish job. Verifier ตรวจ:

- VSIX target, package/CLI version และ protocol
- SHA-256 ของ VSIX ด้านนอกผ่าน sidecar ที่ upload ไปพร้อม package
- SHA-256 ของ CLI ที่ฝังอยู่เทียบกับ `resources/cli-manifest.json`
- file set, per-file SHA-256 และ aggregate digest ของ AI bundle
- terminal archive checksum sidecar และ bundle contents
- duplicate, absolute, `..`, backslash และ symlink archive entries
- จำนวน artifact ต่อ release (`8` VSIX และ `6` terminal archives) ใน publish gate

การมีไฟล์หรือมี checksum อย่างเดียวไม่ทำให้ artifact ผ่าน: bytes ที่จะถูกติดตั้ง
ต้องตรงกับ manifest ภายใน package ก่อน publish. การ smoke หลังติดตั้งเข้า
globalStorage และการตรวจ sign/notarize ยังต้องทำบน release runner; ไม่ถูกอนุมาน
จาก local macOS.

## หลักฐาน local

```text
python3 -m unittest discover -s scripts/ai-coverage/tests -p 'test_*.py' -v
30 tests passed
```

การตรวจ matrix ที่ต้องคงสถานะ blocked จนกว่าจะเติม baseline:

```text
python3 scripts/ai-coverage/rehearse_compatibility.py \
  --report /tmp/wakaclock-f8-compatibility.json
# exit 2; status=blocked; passed=12; failed=0; blocked=6
```

ยังไม่ได้ทำในรอบนี้:

- build/checkout previous release binary และรัน old/new process matrix จริง
- ClickHouse/PostgreSQL integration rehearsal และ downgrade proof
- internal live หรือ opt-in beta rollout
- disable/revoke/rollback queue replay drill (F8-04)
- support matrix/release notes และ parser-renewal ownership (F8-05/F8-06)

จึงยังคง topology เป็น local-only context และยังไม่เพิ่ม field ใหม่เข้า strict
broker v1 wire.
