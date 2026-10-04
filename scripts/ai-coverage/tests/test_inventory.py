import copy
import hashlib
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from verify_inventory import verify_inventory


class InventoryTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name) / 'inventory'
        shutil.copytree(Path(__file__).resolve().parents[3] / 'certifications/ai-adapters', self.root)
        self.catalog_path = self.root / 'catalog-v1.json'
        self.catalog = json.loads(self.catalog_path.read_text())

    def save(self):
        self.catalog_path.write_text(json.dumps(self.catalog))

    def test_history_passes_integrity_without_current_certification(self):
        errors, current = verify_inventory(self.root)
        self.assertEqual(errors, [])
        self.assertEqual(set(current.values()), {'not_certified'})
        errors, _ = verify_inventory(self.root, ['codex', 'claude-code'])
        self.assertEqual(len(errors), 2)

    def test_history_cannot_be_promoted_by_changing_catalog(self):
        self.catalog['entries'][0]['promotable'] = True
        self.save()
        errors, current = verify_inventory(self.root)
        self.assertTrue(errors)
        self.assertNotIn('verified', current.values())

    def test_catalog_cannot_claim_another_runtime_than_its_evidence(self):
        for key, value in [('provider_id', 'different-provider'), ('runtime', 'different-runtime'),
                           ('model_id', 'different-model'), ('edit_modes', ['unmeasured-mode'])]:
            with self.subTest(field=key):
                entry = self.catalog['entries'][0]
                original = entry['tuple'][key]
                entry['tuple'][key] = value
                self.save()
                errors, current = verify_inventory(self.root)
                self.assertTrue(any('tuple mismatch' in error for error in errors))
                self.assertNotIn('verified', current.values())
                entry['tuple'][key] = original

    def test_every_entry_requires_a_hashed_artifact(self):
        del self.catalog['entries'][0]['artifact_ref']
        self.save()
        self.assertTrue(verify_inventory(self.root)[0])

    def test_history_digest_change_fails(self):
        entry = self.catalog['entries'][0]
        with (self.root / entry['artifact_ref']).open('a') as stream:
            stream.write(' ')
        self.assertTrue(verify_inventory(self.root)[0])

    def test_original_bytes_are_preserved(self):
        original = next((self.root / 'codex').glob('*.json'))
        original.write_text(original.read_text() + ' ')
        self.assertIn('historical original missing or digest changed', verify_inventory(self.root)[0])

    def test_missing_adapter_cannot_silently_shrink_inventory(self):
        self.catalog['entries'].pop()
        self.save()
        self.assertIn('required adapter missing from inventory', verify_inventory(self.root)[0])

    def test_current_expiry_is_not_ignored_alongside_history(self):
        from test_validate_certification import artifact
        report = artifact()
        report['certificate_id'] = 'expired-current'
        report['expires_at_utc'] = '2026-09-06T00:00:00Z'
        path = self.root / 'codex/current.json'
        path.write_text(json.dumps(report))
        entry = copy.deepcopy(next(e for e in self.catalog['entries'] if e['tuple']['adapter_id'] == 'codex'))
        for key in ('certificate_id', 'status', 'review_status', 'promotable', 'evidence_kind',
                    'expires_at_utc', 'build_sha256', 'evidence_digest'):
            entry[key] = report[key]
        entry['artifact_ref'] = 'codex/current.json'
        entry['artifact_sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        entry['checked_at_utc'] = report['completed_at_utc']
        self.catalog['entries'].append(entry)
        self.save()
        errors, current = verify_inventory(self.root)
        self.assertTrue(any('expired' in error for error in errors))
        self.assertEqual(current['codex'], 'not_certified')

    def test_private_fields_fail_even_if_hash_is_updated(self):
        entry = self.catalog['entries'][0]
        path = self.root / entry['artifact_ref']
        report = json.loads(path.read_text())
        report['prompt'] = 'forbidden fixture field'
        path.write_text(json.dumps(report))
        entry['artifact_sha256'] = hashlib.sha256(path.read_bytes()).hexdigest()
        self.save()
        self.assertTrue(any('privacy' in error for error in verify_inventory(self.root)[0]))
