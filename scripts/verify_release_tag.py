#!/usr/bin/env python3
"""Verify that a Git tag matches the release identity in the repository."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: verify_release_tag.py vX.Y.Z")
    tag = sys.argv[1].strip()
    match = re.fullmatch(r"v(\d+\.\d+\.\d+)", tag)
    if not match:
        raise SystemExit(f"invalid release tag: {tag!r}")
    version = match.group(1)

    package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    if version != package_version:
        raise SystemExit(f"tag {tag} does not match package version {package_version}")

    citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    if not re.search(rf"^version:\s*{re.escape(version)}\s*$", citation, flags=re.MULTILINE):
        raise SystemExit(f"CITATION.cff does not declare version {version}")

    schema = json.loads((ROOT / "schemas" / "decision.schema.json").read_text(encoding="utf-8"))
    if schema["properties"]["schema_version"]["const"] != version:
        raise SystemExit("decision schema version does not match release tag")

    print(f"release tag verified: {tag}")


if __name__ == "__main__":
    main()
