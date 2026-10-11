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
    def test_paused_install_does_not_probe_docker(self):
        with patch.object(runtime,'backend_paused',return_value=True), patch.object(runtime,'verify_binding') as verify, patch.object(runtime,'docker') as docker:
            with self.assertRaises(runtime.RuntimePaused):runtime.install()
            verify.assert_not_called();docker.assert_not_called()

    def test_resume_rejects_unproven_supervisor_without_launching_anything(self):
        with tempfile.TemporaryDirectory() as directory:
            home=Path(directory); runtime_dir=home/'runtime';runtime_dir.mkdir();(runtime_dir/'supervisor.py').write_text('fixture-only')
            binding=home/'binding.json';binding.write_text(json.dumps({'account_verified':True,'canonical_data_verified':True,'supervisor_sha256':'wrong'}))
            with patch.object(runtime,'RUNTIME',runtime_dir),patch.object(runtime,'MANIFEST',binding),patch.object(runtime,'backend_paused',return_value=False),patch.object(runtime.subprocess,'run') as command,patch.object(runtime,'docker') as docker:
                with self.assertRaisesRegex(ValueError,'backend_resume_identity_or_build_unconfirmed'):runtime.resume()
                command.assert_not_called();docker.assert_not_called()
    def test_persistent_pause_never_opens_docker_or_dependencies(self):
        with tempfile.TemporaryDirectory() as directory:
            home=Path(directory); state=home/'backend-state.json'
            (home/'runtime-desired.json').write_text(json.dumps({'schema_version':1,'desired':{'backend-local':False}}))
            with patch.object(runtime,'HOME_DIR',home), patch.object(runtime,'STATE',state), \
                    patch.object(runtime,'docker') as docker, patch.object(runtime.subprocess,'Popen') as start, \
                    patch.object(runtime.subprocess,'run') as command, patch.object(runtime,'healthy',return_value=False):
                runtime.run(once=True)
            docker.assert_not_called(); start.assert_not_called(); command.assert_not_called()
            self.assertEqual(json.loads(state.read_text())['error_code'],'paused_by_user')

    def test_reinstall_enables_persistently_disabled_service_before_bootstrap(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); home=root/'home'; runtime_dir=home/'.wakaclock/runtime'
            runtime_dir.mkdir(parents=True); (home/'Library/LaunchAgents').mkdir(parents=True)
            for name in ['backend/api/.env','deployment/heartbeat-local/compose.yaml','backend/api/target/debug/wakaclock-server']:
                source=root/name; source.parent.mkdir(parents=True,exist_ok=True); source.write_text('fixture-only')
            manifest=home/'.wakaclock/backend-runtime-binding.json'; manifest.write_text('{}')
            disabled=True
            def control(command, **kwargs):
                nonlocal disabled
                if command[1]=='enable': disabled=False
                code=1 if command[1]=='print' else (5 if command[1]=='bootstrap' and disabled else 0)
                return types.SimpleNamespace(returncode=code)
            with patch.object(runtime,'ROOT',root), patch.object(runtime,'RUNTIME',runtime_dir), \
                    patch.object(runtime,'MANIFEST',manifest), patch.object(runtime,'verify_binding'), \
                    patch.object(runtime.pathlib.Path,'home',return_value=home), \
                    patch.object(runtime.subprocess,'run',side_effect=control), patch.object(runtime.time,'sleep'):
                runtime.install()
            self.assertFalse(disabled)

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
