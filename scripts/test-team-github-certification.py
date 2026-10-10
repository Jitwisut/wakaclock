import importlib.util
from pathlib import Path
import unittest
from datetime import datetime,timezone,timedelta
spec=importlib.util.spec_from_file_location('cert',Path(__file__).with_name('team-github-certification.py'))
cert=importlib.util.module_from_spec(spec);spec.loader.exec_module(cert)
class CertificationTests(unittest.TestCase):
 def record(self):
  now=datetime.now(timezone.utc)
  return dict(schema_version=1,session_id='a'*64,tool='codex',os='macos',architecture='arm64',provider_version='1.0',client_version='1.0',build_sha='b'*40,activity_origin='user',started_at=(now-timedelta(minutes=3)).isoformat(),ended_at=(now-timedelta(minutes=1)).isoformat(),metrics={m:'observed' for m in cert.METRICS},expected_ledger_sha256='c'*64,server_evidence_sha256='d'*64)
 def test_reject_monitor_and_raw_fields(self):
  for field,value in [('activity_origin','monitor'),('prompt','secret'),('credential','secret')]:
   r=self.record();r[field]=value
   with self.assertRaises(ValueError):cert.validate(r)
 def test_unavailable_requires_reason_and_review(self):
  r=self.record();r['metrics']['usage']='unavailable'
  with self.assertRaises(ValueError):cert.validate(r)
  r['availability_reasons']={'usage':'provider_not_exposed'};cert.validate(r)
  v=cert.verdict([r],{'matrix':10});self.assertIn('provider_limitation_requires_owner_review',v['blockers'])
  r['approved_limitation_refs']={'usage':'e'*64};self.assertNotIn('provider_limitation_requires_owner_review',cert.verdict([r],{'matrix':10})['blockers'])
 def test_complete_count_never_masks_failed_metric_or_missing_evidence(self):
  r=self.record();r['metrics']['branch']='failed';r['availability_reasons']={'branch':'branch_mismatch'}
  cert.validate(r);v=cert.verdict([r],{'matrix':10})
  self.assertIn('metric_pending_or_failed',v['blockers']);self.assertIn('second_github_account_pending',v['blockers']);self.assertEqual(v['certificate_status'],'pending')
 def test_timestamp_and_inline_ledger(self):
  r=self.record();r['ended_at']='2099-01-01T00:00:00Z'
  with self.assertRaises(ValueError):cert.validate(r)
  r=self.record();r['tool']='cursor_ide'
  with self.assertRaises(ValueError):cert.validate(r)
if __name__=='__main__':unittest.main()
