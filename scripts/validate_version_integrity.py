#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


def fail(message: str, errors: list[str]) -> None:
    errors.append(message)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--root", default=None)
    args = parser.parse_args()
    root = Path(args.root).resolve() if args.root else Path(__file__).resolve().parents[1]
    errors: list[str] = []

    def load_json(path: str):
        try:
            return json.loads((root / path).read_text(encoding="utf-8"))
        except Exception as exc:
            fail(f"invalid JSON {path}: {exc}", errors)
            return {}

    package = load_json("package.json")
    lock = load_json("package-lock.json")
    facts = load_json("project-facts.json")
    decision = load_json("examples/phenomena-second-station/decision.fde.json")

    version = str(package.get("version", ""))
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        fail(f"invalid package version: {version!r}", errors)

    if str(lock.get("version", "")) != version:
        fail("package-lock top-level version does not match package.json", errors)
    if str(lock.get("packages", {}).get("", {}).get("version", "")) != version:
        fail("package-lock root package version does not match package.json", errors)

    citation = (root / "CITATION.cff").read_text(encoding="utf-8")
    if not re.search(rf"(?m)^version:\s*{re.escape(version)}\s*$", citation):
        fail("CITATION.cff version does not match package.json", errors)

    if str(facts.get("applicationVersion", "")) != version:
        fail("project-facts applicationVersion does not match package.json", errors)

    release_note = root / "docs" / "releases" / f"v{version}.md"
    if not release_note.is_file():
        fail(f"current release note is missing: {release_note.relative_to(root)}", errors)

    schema = str(facts.get("schemaVersions", {}).get("decision", ""))
    if schema != str(decision.get("schema_version", "")):
        fail("decision example schema does not match project-facts", errors)
    if schema != "0.2.10":
        fail(f"unexpected decision schema change: {schema}", errors)

    if errors:
        print("VERSION INTEGRITY FAILED")
        for error in errors:
            print(f"- {error}")
        return 1

    print(f"VERSION INTEGRITY PASS — application {version}; decision schema {schema}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
