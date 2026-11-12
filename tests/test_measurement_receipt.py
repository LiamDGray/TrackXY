"""Tests for the measurement receipt tool.

The receipt is the bridge between TrackXY's derived numbers and RealPeep's
capture attestation: it binds a CSV to its inputs so a verifier can tell
whether the numbers are the ones that came out of that video.
"""

import json
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
TOOL = REPO_ROOT / "tools" / "measurement_receipt.py"

CSV = """samplenumber, milliseconds, x_px, y_px, x_cal, y_cal, status
0, 0, 0, 0, 0, 0, Start: 2026-01-01 00:00:00
1, 33, 100.0, 200.0, 10.0, 20.0, tracking
2, 66, 101.5, 201.0, 10.15, 20.1, tracking
3, 99, 103.0, 202.0, 10.3, 20.2, tracking
"""

CALIB = "origin: [ 0.0, 0.0 ]\npixelsPerUnit: 10.0\n"


def run(args, cwd=None):
    return subprocess.run(
        [sys.executable, str(TOOL), *args],
        capture_output=True,
        text=True,
        timeout=120,
        check=False,
        cwd=cwd,
    )


class Workspace:
    def __init__(self, root: Path):
        self.root = root
        self.csv = root / "output.csv"
        self.calib = root / "calibration.yml"
        self.receipt = root / "measurement.receipt.json"
        self.csv.write_text(CSV)
        self.calib.write_text(CALIB)

    def emit(self):
        return run(
            [
                "emit",
                "--csv",
                str(self.csv),
                "--calibration",
                str(self.calib),
                "--out",
                str(self.receipt),
            ]
        )

    def verify(self):
        return run(["verify", "--receipt", str(self.receipt)])


class TestEmit(unittest.TestCase):
    def test_emits_receipt_with_required_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            result = ws.emit()
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(ws.receipt.read_text())

        self.assertEqual(receipt["schema"], "trackxy-measurement-receipt/v1")
        self.assertEqual(receipt["inputs"]["csv"]["rows"], 4)
        self.assertEqual(len(receipt["inputs"]["csv"]["sha256"]), 64)
        self.assertEqual(len(receipt["inputs"]["calibration"]["sha256"]), 64)
        self.assertEqual(len(receipt["rows"]["chain_root"]), 64)
        self.assertEqual(len(receipt["manifest_root"]), 64)

    def test_emit_is_deterministic_except_for_created_at(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            ws.emit()
            first = json.loads(ws.receipt.read_text())
            ws.emit()
            second = json.loads(ws.receipt.read_text())

        a = {k: v for k, v in first.items() if k != "created_at"}
        b = {k: v for k, v in second.items() if k != "created_at"}
        self.assertEqual(a, b)

    def test_missing_input_fails_cleanly(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            ws.csv.unlink()
            result = ws.emit()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("not found", result.stderr.lower())

    def test_capture_session_passthrough(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            result = run(
                [
                    "emit",
                    "--csv",
                    str(ws.csv),
                    "--calibration",
                    str(ws.calib),
                    "--capture-root",
                    "a" * 64,
                    "--out",
                    str(ws.receipt),
                ]
            )
            self.assertEqual(result.returncode, 0, result.stderr)
            receipt = json.loads(ws.receipt.read_text())
        self.assertEqual(receipt["capture"]["session_root"], "a" * 64)


class TestVerify(unittest.TestCase):
    def test_clean_receipt_verifies(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            ws.emit()
            result = ws.verify()
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertIn("OK", result.stdout)

    def test_modified_row_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            ws.emit()
            ws.csv.write_text(CSV.replace("103.0", "113.0"))
            result = ws.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("csv", result.stdout.lower())

    def test_appended_row_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            ws.emit()
            ws.csv.write_text(CSV + "4, 132, 104.0, 203.0, 10.4, 20.3, tracking\n")
            result = ws.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("row count", result.stdout.lower())

    def test_modified_calibration_is_reported(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            ws.emit()
            ws.calib.write_text("origin: [ 0.0, 0.0 ]\npixelsPerUnit: 9.5\n")
            result = ws.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("calibration", result.stdout.lower())

    def test_truncated_receipt_fails_cleanly(self):
        with tempfile.TemporaryDirectory() as tmp:
            ws = Workspace(Path(tmp))
            ws.emit()
            ws.receipt.write_text('{"schema": "trackxy-measurement-receipt/v1"}')
            result = ws.verify()
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("malformed", result.stderr.lower())


if __name__ == "__main__":
    unittest.main()
