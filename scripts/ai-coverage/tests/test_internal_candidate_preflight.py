import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from internal_candidate_preflight import validate
class NativeRunnerTest(unittest.TestCase):
    def test_all_four_real_hosts_are_distinct(self):
        for target,system,machine,node,rust in [('darwin-x64','Darwin','x86_64','x64','x86_64-apple-darwin'),('darwin-arm64','Darwin','arm64','arm64','aarch64-apple-darwin'),('win32-x64','Windows','AMD64','x64','x86_64-pc-windows-msvc'),('win32-arm64','Windows','ARM64','arm64','aarch64-pc-windows-msvc')]:validate(target,system,machine,node,rust)
    def test_emulation_and_cross_compilation_do_not_pass(self):
        for args in [('win32-arm64','Windows','ARM64','x64','aarch64-pc-windows-msvc'),('darwin-arm64','Darwin','x86_64','arm64','aarch64-apple-darwin'),('win32-arm64','Windows','ARM64','arm64','x86_64-pc-windows-msvc')]:
            with self.assertRaisesRegex(ValueError,'native_runner_mismatch'):validate(*args)
