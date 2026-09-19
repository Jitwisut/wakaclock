# Phase 02 — Stable Queue Ownership and Safe API-Key Rotation

สถานะ: Planned  
ครอบคลุม: OFF-03  
ขึ้นกับ: Phase 00–01

## ปัญหา

ปัจจุบัน `QueueScope.owner` เป็น hash ของ API key. การ regenerate key ของ account เดิม
จึงสร้าง owner scope ใหม่ และ rows ใน scope เก่าไม่ถูก claim อีก แม้ `Queue::len()` ยังนับ
เจออยู่. การแก้ด้วยการย้ายทุก row ไป key ใหม่ทันทีไม่ปลอดภัย เพราะ key ใหม่อาจเป็นของ
คนละ account.

## Security invariant

การ rebind queue ทำได้เมื่อพิสูจน์จาก server แล้วเท่านั้นว่า credential เก่าและใหม่เป็น
account เดียวกันบน server origin เดียวกัน. ห้ามใช้ local `user_id`, email, key prefix,
queue contents หรือการที่ผู้ใช้กดปุ่มเป็น proof.

## Proposed ownership model

ใช้ stable, opaque server-issued owner identity:

```text
QueueOwnerV2 = hash(normalized_server_origin || authenticated_owner_id)
CredentialFingerprint = hash(api_key)
```

- `authenticated_owner_id` ต้อง stable ข้าม API-key rotation แต่ต่างกันทุก account;
- server คืนค่าเฉพาะหลัง auth สำเร็จ เช่น `queue_owner_id` ใน verify response;
- ไม่จำเป็นต้องเปิดเผย email/username;
- client เก็บ mapping ต่อ origin:
  `credential_fingerprint → queue_owner_id → verified_at`;
- queue row ใหม่ใช้ owner v2 เมื่อมี verified mapping;
- credential ที่ยังไม่เคย verify ใช้ provisional key scope และห้าม auto-merge;
- legacy rows เก็บไว้จนพิสูจน์ owner ได้ ห้าม delete หรือส่งข้าม scope.

## Server/API changes

ไฟล์ที่คาดว่าจะเปลี่ยน:

- `backend/api/src/handlers/v1/status_bar.rs` หรือ authenticated identity endpoint ที่เหมาะสม;
- `backend/api/src/middleware/auth.rs` เฉพาะการ expose opaque subject จาก context;
- `backend/api/crates/wakaclock-core/src/api_client.rs` สำหรับ typed verify response;
- `backend/api/crates/wakaclock-cli/src/main.rs` สำหรับ `verify --json`.

`queue_owner_id` ต้องเป็น opaque identifier ที่ไม่มี privilege และใช้ authentication
context ที่ server resolve แล้ว ห้ามเชื่อ owner id ที่ client ส่งกลับโดยไม่ตรวจ auth.

## Queue schema/migration

เพิ่ม schema version และ metadata แบบ additive เช่น:

- `owner_version INTEGER NOT NULL DEFAULT 1`
- `credential_fingerprint TEXT`
- `verified_owner_scope TEXT`
- migration/audit table สำหรับ `from_scope`, `to_scope`, row count, timestamp, reason

เพิ่ม API ภายใน `Queue`:

- `rebind_scope_transactional(from, to, proof)`;
- `legacy_scope_summary(origin)`;
- `orphaned_scope_count(current_scope)`;
- `scope_rows(scope)` สำหรับ tests/diagnostics โดยไม่คืน payload ใน UI.

Transaction ต้อง:

1. ตรวจ origin เท่ากันแบบ normalized;
2. ตรวจ proof ว่า owner id เท่ากัน;
3. update rows ทั้งหมด atomically;
4. จัดการ unique conflict ด้วย transport identity/revision เดิม;
5. deduplicate เฉพาะ row ที่ wire identity เหมือนกันทุกมิติ;
6. ไม่ลบ row หาก transaction fail;
7. บันทึก audit metadata ที่ไม่มี API key หรือ payload.

## Credential lifecycle ใน VS Code

ไฟล์:

- `extensions/vscode/src/secrets.ts`
- `extensions/vscode/src/cli.ts`
- `extensions/vscode/src/commands.ts`
- `extensions/vscode/src/extension.ts`

Flow:

1. key ปัจจุบันที่ verified ยังคง primary ระหว่าง server offline;
2. key ใหม่เก็บเป็น pending candidate โดยไม่ใช้ claim queue เก่า;
3. เมื่อ server กลับมา verify candidate และได้ `queue_owner_id`;
4. ถ้า owner id ตรงกับ mapping ของ key เก่า ให้ CLI ทำ transactional rebind;
5. rebind สำเร็จแล้วจึง promote candidate เป็น primary และ clear pending;
6. ถ้า owner ต่างกัน ให้หยุดและถามผู้ใช้ว่าจะสลับ account หรือไม่ โดย queue เก่ายังคงอยู่;
7. หากไม่มี legacy proof ให้แสดง `recovery required` ห้ามเดา.

## Recovery สำหรับ install เก่าที่ไม่มี owner mapping

- ถ้า key เก่ายัง verify ได้: backfill owner mapping ก่อน rotation;
- ถ้า key เก่าถูก revoke แล้ว: ไม่ auto-migrate;
- แสดง queue summary และเสนอ explicit recovery workflow ที่ต้องได้ server-side
  same-account proof หรือ export metadata-safe support bundle;
- ห้ามลบ orphaned queue อัตโนมัติ;
- `status`/`doctor` ต้องแสดง `orphaned_scopes` และ row counts.

## Tests

### Queue/database

- `same_owner_rebind_is_atomic_and_preserves_every_row`
- `rebind_preserves_heartbeat_id_timestamp_revision_and_payload_bytes`
- `different_owner_proof_is_rejected_without_mutation`
- `different_origin_rebind_is_rejected`
- `rebind_conflict_deduplicates_only_exact_delivery_identity`
- `crash_before_commit_leaves_the_old_scope_intact`
- `legacy_rows_are_visible_as_recovery_required_not_deleted`

### Credential flow

- `pending_key_does_not_replace_primary_while_offline`
- `verified_same_account_candidate_promotes_after_rebind`
- `different_account_candidate_never_claims_old_queue`
- `failed_rebind_does_not_clear_pending_or_old_mapping`

### End-to-end

1. queue N heartbeats ด้วย key A;
2. verify key B ซึ่งเป็น account เดียวกัน;
3. rebind แล้ว reconnect;
4. server รับ N unique heartbeats;
5. local queue เหลือศูนย์;
6. canonical duration/rows ไม่เพิ่มซ้ำ.

## Acceptance criteria

- key rotation account เดิมไม่ strand หรือ duplicate queue;
- key คนละ account อ่าน/claim/rebind queue เดิมไม่ได้;
- origin ใหม่ไม่รับ rows ของ origin เก่า;
- legacy queue ที่พิสูจน์ owner ไม่ได้ยัง recoverable และมองเห็นใน diagnostics;
- ไม่มี raw API key ใน SQLite migration/audit/log;
- migration rerun ได้และ idempotent.

## ความเสี่ยง

- ร้ายแรงที่สุดคือ cross-account data disclosure จาก rebind ผิด;
- unique-index conflict อาจทำ row หายถ้า dedup กว้างเกินไป;
- rollout ที่ server/client คนละเวอร์ชันต้องรองรับ owner v1/v2 พร้อมกัน;
- API response ใหม่ต้องไม่ทำให้ WakaTime-compatible client พัง.

## Rollout

1. deploy server field ก่อน โดย client เก่ายัง ignore;
2. release CLI ที่อ่าน owner id และเขียน schema v2 แต่ยังไม่ auto-rebind;
3. เปิด diagnostics เพื่อวัด legacy/orphan counts;
4. เปิด same-owner auto-rebind หลัง certification;
5. release VS Code credential flow ใหม่.

## Rollback

- ปิด auto-rebind feature flag;
- owner-v2 rows ยังอ่าน/flush ได้ด้วย CLI ใหม่;
- migration เป็น additive และห้าม downgrade ด้วยการลบ columns;
- หาก rebind defect ให้หยุด claim affected scope แต่ห้ามลบ queue.

## Gates

```bash
cd backend/api
cargo fmt --all -- --check
cargo clippy --workspace --all-targets -- -D warnings
cargo test --workspace

python3 scripts/duration-audit/verify_port.py
python3 scripts/duration-audit/golden.py
python3 scripts/duration-audit/verify_actor_migration.py

cd extensions/vscode
npm run lint
npm test
```

