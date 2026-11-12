#!/usr/bin/env python3
"""Emit and verify a TrackXY measurement receipt.

A receipt binds a measurement CSV to the inputs it came from: the video (if
kept), the calibration file, the analysis parameters, and a hash chain over the
CSV rows. Verification recomputes all of it, so an edited row, an appended
sample, or a nudged calibration is reported rather than silently accepted.

The optional ``--capture-root`` field is the seam to RealPeep: pass the frame
chain root of an attested capture session, and the receipt becomes a claim that
*these numbers came from that capture*. Anchoring the manifest root (for example
with OpenTimestamps) turns "these numbers existed" into "these numbers existed
by this time".

Usage:
    measurement_receipt.py emit   --csv output.csv --calibration calibration.yml
                                 [--video clip.mp4] [--capture-root HEX] --out receipt.json
    measurement_receipt.py verify --receipt receipt.json
"""

import argparse
import hashlib
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

SCHEMA = "trackxy-measurement-receipt/v1"
TOOL_VERSION = "0.1.0"

# Analysis constants that change the numbers but not the CSV bytes. Recorded so
# a reader can tell whether a receipt was produced with the same configuration.
DEFAULT_PARAMETERS = {
    "max_points": 3,
    "win_size": [31, 31],
    "sub_pix_win_size": [10, 10],
    "max_level": 3,
    "term_criteria": {"type": "count_or_eps", "count": 20, "eps": 0.03},
    "feature_quality": 0.01,
    "feature_min_distance": 10,
    "feature_block_size": 3,
    "feature_k": 0.04,
    "analysis_window": 500,
    "min_samples_for_frequency": 10,
    "min_crossings_for_frequency": 4,
}


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def chain_rows(lines):
    """Hash chain over the CSV lines; returns (root, per-line hashes)."""
    running = hashlib.sha256(SCHEMA.encode()).digest()
    hashes = []
    for line in lines:
        running = hashlib.sha256(running + line.rstrip(b"\r\n")).digest()
        hashes.append(running.hex())
    return running.hex(), hashes


def canonical_json(payload) -> bytes:
    return json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()


def manifest_root(receipt) -> str:
    hashed = {k: v for k, v in receipt.items() if k not in ("created_at", "manifest_root")}
    return hashlib.sha256(canonical_json(hashed)).hexdigest()


def build(csv_path: Path, calib_path: Path, video_path, capture_root, parameters):
    for label, path in (("csv", csv_path), ("calibration", calib_path), ("video", video_path)):
        if path is not None and not path.is_file():
            raise FileNotFoundError(f"{label} file not found: {path}")

    raw = csv_path.read_bytes()
    lines = raw.splitlines()
    if not lines:
        raise ValueError(f"csv file is empty: {csv_path}")

    root, _ = chain_rows(lines)
    receipt = {
        "schema": SCHEMA,
        "tool": {"name": "trackxy", "version": TOOL_VERSION},
        "inputs": {
            "csv": {
                "path": str(csv_path),
                "sha256": hashlib.sha256(raw).hexdigest(),
                "rows": max(len(lines) - 1, 0),
            },
            "calibration": {"path": str(calib_path), "sha256": sha256_file(calib_path)},
        },
        "parameters": parameters,
        "rows": {"chain_root": root},
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
    }
    if video_path is not None:
        receipt["inputs"]["video"] = {
            "path": str(video_path),
            "sha256": sha256_file(video_path),
        }
    if capture_root:
        receipt["capture"] = {"provider": "realpeep", "session_root": capture_root}

    receipt["manifest_root"] = manifest_root(receipt)
    return receipt


def verify(receipt_path: Path):
    try:
        receipt = json.loads(receipt_path.read_text())
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"malformed receipt: {exc}") from exc

    required = ("schema", "inputs", "parameters", "rows", "manifest_root")
    if receipt.get("schema") != SCHEMA or any(k not in receipt for k in required):
        raise ValueError(f"malformed receipt: expected schema {SCHEMA} with {', '.join(required)}")

    problems = []
    csv_info = receipt["inputs"].get("csv", {})
    calib_info = receipt["inputs"].get("calibration", {})

    csv_path = Path(csv_info.get("path", ""))
    if not csv_path.is_file():
        problems.append(f"csv missing: {csv_path}")
    else:
        raw = csv_path.read_bytes()
        lines = raw.splitlines()
        actual_rows = max(len(lines) - 1, 0)
        if actual_rows != csv_info.get("rows"):
            problems.append(
                f"csv row count mismatch: receipt says {csv_info.get('rows')}, file has {actual_rows}"
            )
        elif hashlib.sha256(raw).hexdigest() != csv_info.get("sha256"):
            problems.append(f"csv sha256 mismatch: {csv_path}")
        else:
            root, _ = chain_rows(lines)
            if root != receipt["rows"].get("chain_root"):
                problems.append(f"csv chain root mismatch: {csv_path}")

    calib_path = Path(calib_info.get("path", ""))
    if not calib_path.is_file():
        problems.append(f"calibration missing: {calib_path}")
    elif sha256_file(calib_path) != calib_info.get("sha256"):
        problems.append(f"calibration sha256 mismatch: {calib_path}")

    video_info = receipt["inputs"].get("video")
    if video_info:
        video_path = Path(video_info.get("path", ""))
        if not video_path.is_file():
            problems.append(f"video missing: {video_path}")
        elif sha256_file(video_path) != video_info.get("sha256"):
            problems.append(f"video sha256 mismatch: {video_path}")

    if manifest_root(receipt) != receipt["manifest_root"]:
        problems.append("receipt manifest_root does not match its contents (receipt edited)")

    return problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)

    emit = sub.add_parser("emit", help="Create a receipt for a measurement run")
    emit.add_argument("--csv", required=True)
    emit.add_argument("--calibration", required=True)
    emit.add_argument("--video", help="Optional source video to hash")
    emit.add_argument("--capture-root", help="RealPeep session root (hex) this measurement derives from")
    emit.add_argument("--parameters", help="JSON file overriding the recorded analysis parameters")
    emit.add_argument("--out", required=True)

    check = sub.add_parser("verify", help="Recompute a receipt and report divergence")
    check.add_argument("--receipt", required=True)

    args = parser.parse_args()

    if args.command == "emit":
        parameters = dict(DEFAULT_PARAMETERS)
        if args.parameters:
            parameters.update(json.loads(Path(args.parameters).read_text()))
        try:
            receipt = build(
                Path(args.csv),
                Path(args.calibration),
                Path(args.video) if args.video else None,
                args.capture_root,
                parameters,
            )
        except (FileNotFoundError, ValueError) as exc:
            print(f"error: {exc}", file=sys.stderr)
            return 2
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(receipt, indent=2) + "\n")
        print(f"receipt: {out} (manifest_root {receipt['manifest_root'][:16]}...)")
        return 0

    try:
        problems = verify(Path(args.receipt))
    except ValueError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    if problems:
        print("FAILED: receipt does not match its inputs")
        for problem in problems:
            print(f"  - {problem}")
        return 1

    print("OK: receipt matches its inputs")
    return 0


if __name__ == "__main__":
    sys.exit(main())
