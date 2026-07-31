#!/usr/bin/env python3
"""Verify stable and prerelease identities without coupling app and schema versions."""
from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE_IDENTIFIER = r"(?:0|[1-9]\d*)"
PRERELEASE_IDENTIFIER = r"(?:0|[1-9]\d*|[A-Za-z-][0-9A-Za-z-]*)"
TAG_PATTERN = re.compile(
    rf"^v(?P<major>{CORE_IDENTIFIER})\.(?P<minor>{CORE_IDENTIFIER})\.(?P<patch>{CORE_IDENTIFIER})"
    rf"(?P<prerelease>-(?:{PRERELEASE_IDENTIFIER})(?:\.(?:{PRERELEASE_IDENTIFIER}))*)?$"
)


def classify_tag(tag: str) -> dict[str, str]:
    match = TAG_PATTERN.fullmatch(tag.strip())
    if not match:
        raise ValueError(f"invalid release tag: {tag!r}")
    base_version = f"{match.group('major')}.{match.group('minor')}.{match.group('patch')}"
    prerelease = match.group('prerelease') or ""
    return {
        "tag": tag.strip(),
        "version": f"{base_version}{prerelease}",
        "base_version": base_version,
        "release_kind": "prerelease" if prerelease else "stable",
        "notes_file": f"docs/releases/{tag.strip()}.md",
    }


def verify_repository_identity(identity: dict[str, str]) -> None:
    package_version = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))["version"]
    if identity["version"] != package_version:
        raise ValueError(
            f"tag {identity['tag']} does not match package version {package_version}"
        )

    citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
    if not re.search(
        rf"^version:\s*{re.escape(identity['version'])}\s*$",
        citation,
        flags=re.MULTILINE,
    ):
        raise ValueError(f"CITATION.cff does not declare version {identity['version']}")

    schema = json.loads((ROOT / "schemas" / "decision.schema.json").read_text(encoding="utf-8"))
    schema_version = schema["properties"]["schema_version"]["const"]
    if schema_version != identity["base_version"]:
        raise ValueError(
            "decision schema version must match the release base version "
            f"{identity['base_version']}, found {schema_version}"
        )


def write_github_outputs(identity: dict[str, str]) -> None:
    output_path = os.environ.get("GITHUB_OUTPUT")
    if not output_path:
        return
    with Path(output_path).open("a", encoding="utf-8") as handle:
        for key in ("release_kind", "version", "base_version", "notes_file"):
            handle.write(f"{key}={identity[key]}\n")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("tag")
    parser.add_argument("--classify-only", action="store_true")
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    try:
        identity = classify_tag(args.tag)
        if not args.classify_only:
            verify_repository_identity(identity)
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    write_github_outputs(identity)
    if args.json:
        print(json.dumps(identity, sort_keys=True))
    else:
        print(
            f"release tag verified: {identity['tag']} "
            f"({identity['release_kind']}, schema {identity['base_version']})"
        )


if __name__ == "__main__":
    main()
