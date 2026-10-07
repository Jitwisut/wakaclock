"""Fail-closed recovery checks; no Docker, real account, or user data writes."""
import importlib.util
import json
from pathlib import Path
import tempfile
import types
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location(
    "heartbeat_runtime", Path(__file__).with_name("heartbeat-local-runtime.py")
)
runtime = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)


class RecoveryBindingTests(unittest.TestCase):
    def test_missing_volume_blocks_start_without_creating_a_database(self):
        with tempfile.TemporaryDirectory() as directory:
            home = Path(directory)
            state = home / "backend-state.json"
            with patch.object(runtime, "HOME_DIR", home), patch.object(runtime, "STATE", state), \
                    patch.object(runtime, "docker", return_value=types.SimpleNamespace(returncode=0)), \
                    patch.object(runtime, "verify_binding", side_effect=ValueError("private diagnostic")), \
                    patch.object(runtime, "healthy", return_value=False), \
                    patch.object(runtime.subprocess, "Popen") as start:
                runtime.run(once=True)
            start.assert_not_called()
            observation = json.loads(state.read_text())
            self.assertFalse(observation["healthy"])
            self.assertEqual(observation["error_code"], "runtime_binding_or_start_failed")
            self.assertNotIn("private diagnostic", state.read_text())
            self.assertFalse(any(home.glob("*.db")))

    def test_an_unmanaged_listening_port_is_not_readiness(self):
        with patch.object(runtime, "docker", return_value=types.SimpleNamespace(returncode=1)), \
                patch.object(runtime, "connected", return_value=True):
            with self.assertRaisesRegex(ValueError, "dependency_endpoint_unmanaged"):
                runtime.dependency_readiness()

    def test_foreign_volume_cannot_replace_the_bound_database(self):
        container = {
            "Config": {"Labels": {"com.docker.compose.project": "wakaclock-heartbeat-runtime",
                                   "com.docker.compose.service": "postgres"}},
            "Mounts": [{"Name": "empty-replacement"}],
        }
        result = types.SimpleNamespace(returncode=0, stdout=json.dumps([container]))
        with patch.object(runtime, "docker", return_value=result):
            with self.assertRaisesRegex(ValueError, "dependency_container_binding_changed"):
                runtime.dependency_readiness()


if __name__ == "__main__":
    unittest.main()
