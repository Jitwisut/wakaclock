import subprocess
import sys
from pathlib import Path
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from local_lab import failure_code


class LabErrorTests(unittest.TestCase):
    def test_known_readiness_blockers_are_actionable(self):
        for code in ('source_build_mismatch', 'frontend_build_mismatch', 'receipts_disabled',
                     'lab_process_build_mismatch_api', 'lab_process_not_ready_worker',
                     'collector_sha256_mismatch', 'lab_port_in_use_55439'):
            with self.subTest(code=code):
                self.assertEqual(failure_code(ValueError(code)), code)

    def test_raw_exception_details_never_enter_shareable_status(self):
        for error in (ValueError('private-fixture-token'), OSError('/private/fixture/path'),
                      KeyError('secret'), subprocess.CalledProcessError(1, ['fixture', 'secret']),
                      ValueError('source_build_mismatch private-fixture-token')):
            with self.subTest(kind=type(error).__name__):
                self.assertEqual(failure_code(error), 'lab_command_failed')
