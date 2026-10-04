# Certification inventory

The catalog currently contains historical, non-promoting evidence. The original
v1 records retain their original dates and bytes; they do not certify today's
collector, editor, or agent runtime.

Run the CI integrity check from the repository root:

```sh
python3 scripts/ai-coverage/verify_inventory.py certifications/ai-adapters
```

The verifier checks catalog references and hashes, artifact schema/privacy,
catalog/artifact agreement, and the original bytes linked by each historical
import. It validates archived v1 records at their recorded check date **only**
after proving that archival identity. Current artifacts still undergo normal
expiry checks. An unlinked v1 record, altered archive, missing adapter, or false
promotion fails the check.

For current approved live certification of the two Receipt adapters:

```sh
python3 scripts/ai-coverage/verify_inventory.py certifications/ai-adapters \
  --require-live codex claude-code
```

This command currently fails because neither adapter has current approved live
certification. Kilo, Kimi, and Deep Code likewise remain `not_certified`. A passing
historical integrity check does not establish runtime readiness. Receipt campaign
reports remain `review_status=pending` and `promotable=false`; they cannot promote
an adapter automatically or open the observation window by themselves.
