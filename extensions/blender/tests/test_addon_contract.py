import unittest
from pathlib import Path


class AddonSourceContractTests(unittest.TestCase):
    def test_tracker_uses_blender_timer_not_python_threads(self):
        source = (Path(__file__).parents[1] / "atoaxis" / "tracker.py").read_text()
        self.assertIn("bpy.app.timers.register", source)
        self.assertNotIn("import threading", source)
        self.assertNotIn("Thread(", source)
        self.assertIn("subprocess.Popen", source)
        self.assertIn("except OSError", source)


if __name__ == "__main__":
    unittest.main()
