import contextlib
import importlib
import io
import json
import sys
import tempfile
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

    def test_milvus_manifest_patch_overwrites_existing_target(self) -> None:
        try:
            from milvus_lite.storage import manifest as manifest_module
        except ImportError:
            self.skipTest("milvus_lite is not installed")

        original_save = manifest_module.Manifest.save
        original_rename = manifest_module.os.rename
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = manifest_module.Manifest(str(root))
            manifest.save()

            def windows_rename(src, dst):  # noqa: ANN001
                if Path(dst).exists():
                    raise FileExistsError(
                        183,
                        "Cannot create a file when that file already exists",
                        str(src),
                        str(dst),
                    )
                return original_rename(src, dst)

            manifest_module.os.rename = windows_rename
            try:
                with self.assertRaises(FileExistsError):
                    manifest.save()

                self.assertTrue(
                    stashbase_daemon._patch_milvus_manifest_windows_replace(force=True)
                )
                manifest.save()

                payload = json.loads(
                    (root / "manifest.json").read_text(encoding="utf-8")
                )
                self.assertEqual(payload["version"], 2)
                self.assertEqual(manifest._version, 2)
            finally:
                manifest_module.os.rename = original_rename
                manifest_module.Manifest.save = original_save


if __name__ == "__main__":
    unittest.main()
