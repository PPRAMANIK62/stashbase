import contextlib
import importlib
import io
import sys
import types
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

with contextlib.redirect_stdout(io.StringIO()):
    stashbase_daemon = importlib.import_module("stashbase_daemon")


class StashbaseDaemonTests(unittest.TestCase):
    def test_termination_signals_skip_missing_sighup(self) -> None:
        fake_signal = types.SimpleNamespace(SIGTERM=15, SIGINT=2)

        self.assertEqual(
            stashbase_daemon._termination_signals(fake_signal),
            (15, 2),
        )

    def test_termination_signals_include_sighup_when_available(self) -> None:
        fake_signal = types.SimpleNamespace(SIGTERM=15, SIGINT=2, SIGHUP=1)

        self.assertEqual(
            stashbase_daemon._termination_signals(fake_signal),
            (15, 2, 1),
        )


if __name__ == "__main__":
    unittest.main()
