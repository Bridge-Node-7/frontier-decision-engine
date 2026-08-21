#!/usr/bin/env python3
# Verify release identity while allowing compatible schema versions.
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
    prerelease = match.group("prerelease") or ""
    return {
        "tag": tag.strip(),
        "version": f"{base_version}{prerelease}",
        "base_version": base_version,
        "release_kind": "prerelease" if prerelease else "stable",
        "notes_file": "docs/RELEASE_NOTES.md",
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

    facts = json.loads((ROOT / "project-facts.json").read_text(encoding="utf-8"))
    if facts.get("applicationVersion") != package_version:
        raise ValueError(
            "project-facts applicationVersion does not match package version "
            f"{package_version}"
        )

    schema = json.loads((ROOT / "schemas/decision.schema.json").read_text(encoding="utf-8"))
    schema_version = schema["properties"]["schema_version"]["const"]
    if facts.get("schemaVersions", {}).get("decision") != schema_version:
        raise ValueError(
            "project-facts decision schema version does not match the decision schema "
            f"{schema_version}"
        )

    semantic_schema = json.loads(
        (ROOT / "schemas/decision-0.3.0.schema.json").read_text(encoding="utf-8")
    )
    semantic_schema_version = semantic_schema["properties"]["schema_version"]["const"]
    if facts.get("schemaVersions", {}).get("semanticDecision") != semantic_schema_version:
        raise ValueError(
            "project-facts semantic decision schema version does not match the semantic "
            f"decision schema {semantic_schema_version}"
        )

    example = json.loads(
        (ROOT / "examples/phenomena-second-station/decision.fde.json").read_text(
            encoding="utf-8"
        )
    )
    if example.get("schema_version") != schema_version:
        raise ValueError(
            "reference decision example schema version does not match the decision schema "
            f"{schema_version}"
        )

    notes_path = ROOT / identity["notes_file"]
    if not notes_path.is_file():
        raise ValueError(f"release notes file is missing or empty: {identity['notes_file']}")
    notes = notes_path.read_text(encoding="utf-8").strip()
    if not notes:
        raise ValueError(f"release notes file is missing or empty: {identity['notes_file']}")
    expected_heading = f"# {identity['tag']}"
    if notes.splitlines()[0].strip() != expected_heading:
        raise ValueError(
            f"release notes heading must be {expected_heading!r}: {identity['notes_file']}"
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
        facts = json.loads((ROOT / "project-facts.json").read_text(encoding="utf-8"))
        print(
            f"release tag verified: {identity['tag']} "
            f"({identity['release_kind']}, decision schemas "
            f"{facts['schemaVersions']['decision']} and "
            f"{facts['schemaVersions']['semanticDecision']})"
        )


if __name__ == "__main__":
    main()
