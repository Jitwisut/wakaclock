import tempfile
import unittest
from pathlib import Path

from atoaxis.core import ActivityQueue, HeartbeatIntent, build_cli_args, resolve_cli


class ActivityQueueTests(unittest.TestCase):
    def test_coalesces_non_write_activity_until_interval(self):
        queue = ActivityQueue(non_write_interval_seconds=120)
        queue.mark("/project/scene.blend")
        self.assertEqual(queue.drain(1), HeartbeatIntent("/project/scene.blend", False))
        queue.mark("/project/scene.blend")
        self.assertIsNone(queue.drain(60))
        self.assertEqual(queue.drain(121), HeartbeatIntent("/project/scene.blend", False))

    def test_write_upgrades_pending_activity_and_sends_immediately(self):
        queue = ActivityQueue(non_write_interval_seconds=120)
        queue.mark("/project/scene.blend")
        queue.drain(1)
        queue.mark("/project/scene.blend")
        queue.mark("/project/scene.blend", True)
        self.assertEqual(queue.drain(2), HeartbeatIntent("/project/scene.blend", True))

    def test_blank_unsaved_entity_is_ignored(self):
        queue = ActivityQueue()
        queue.mark("   ")
        self.assertIsNone(queue.drain(1, force=True))


class CliContractTests(unittest.TestCase):
    def test_cli_args_are_metadata_only_and_mark_save_as_write(self):
        args = build_cli_args("/usr/local/bin/wakaclock", HeartbeatIntent("/p/scene.blend", True))
        self.assertEqual(
            args,
            [
                "/usr/local/bin/wakaclock",
                "heartbeat",
                "--entity",
                "/p/scene.blend",
                "--type",
                "file",
                "--category",
                "modeling",
                "--plugin",
                "atoaxis-blender/0.1.0",
                "--write",
            ],
        )

    def test_explicit_cli_path_must_exist(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "wakaclock"
            path.write_text("binary")
            self.assertEqual(resolve_cli(str(path)), str(path))
            self.assertIsNone(resolve_cli(str(path) + "-missing"))


if __name__ == "__main__":
    unittest.main()
