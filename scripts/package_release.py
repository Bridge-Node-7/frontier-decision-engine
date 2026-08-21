#!/usr/bin/env python3
"""Build a deterministic public release archive and SHA-256 checksum."""
from __future__ import annotations

import hashlib
import json
import stat
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "dist"
VERSION = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
STEM = f"frontier-decision-engine-v{VERSION}"
ARCHIVE = DIST / f"{STEM}.zip"
CHECKSUM = DIST / f"{STEM}.zip.sha256"

EXCLUDED_PARTS = {".git", "dist", "node_modules", ".private-input", "coverage", "__pycache__", "hosted-verification"}
EXCLUDED_SUFFIXES = {".xlsx", ".xls", ".pyc", ".pyo"}
FIXED_TIME = (2026, 8, 20, 0, 0, 0)
def include(path: Path) -> bool:
    relative = path.relative_to(ROOT)
    return not EXCLUDED_PARTS.intersection(relative.parts) and path.suffix.lower() not in EXCLUDED_SUFFIXES


DIST.mkdir(exist_ok=True)
ARCHIVE.unlink(missing_ok=True)
CHECKSUM.unlink(missing_ok=True)

files = sorted(path for path in ROOT.rglob("*") if path.is_file() and include(path))
with zipfile.ZipFile(ARCHIVE, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=9) as output:
    for path in files:
        relative = path.relative_to(ROOT).as_posix()
        info = zipfile.ZipInfo(f"{STEM}/{relative}", FIXED_TIME)
        mode = path.stat().st_mode
        permissions = 0o755 if mode & stat.S_IXUSR else 0o644
        info.external_attr = (permissions & 0xFFFF) << 16
        info.compress_type = zipfile.ZIP_DEFLATED
        output.writestr(info, path.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)

digest = hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()
CHECKSUM.write_bytes(f"{digest}  {ARCHIVE.name}\n".encode("utf-8"))
print(ARCHIVE.relative_to(ROOT))
print(CHECKSUM.relative_to(ROOT))
print(digest)
