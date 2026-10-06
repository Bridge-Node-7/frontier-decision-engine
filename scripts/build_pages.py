#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse

MANIFEST_NAME = "manifest.sha256"
OG_URL = re.compile(r'(<meta property="og:url" content=")([^"]+)(">)')
CANONICAL = re.compile(r'(<link rel="canonical" href=")([^"]+)(">)')
ALLOWED_CHANGED_FILES = {"index.html", "start.html", MANIFEST_NAME}


def normalize_public_url(value: str) -> str:
    candidate = str(value).strip()
    parsed = urlparse(candidate)
    if (
        parsed.scheme != "https"
        or not parsed.hostname
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(
            "public URL must be an absolute HTTPS URL without credentials, query, or fragment"
        )
    return candidate.rstrip("/") + "/"


def extract_one(text: str, pattern: re.Pattern[str], label: str) -> str:
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise RuntimeError(
            f"{label} field count changed: expected 1, observed {len(matches)}"
        )
    return normalize_public_url(matches[0].group(2))


def replace_one(text: str, pattern: re.Pattern[str], public_url: str, label: str) -> str:
    matches = list(pattern.finditer(text))
    if len(matches) != 1:
        raise RuntimeError(
            f"{label} field count changed: expected 1, observed {len(matches)}"
        )
    return pattern.sub(
        lambda match: f"{match.group(1)}{public_url}{match.group(3)}",
        text,
        count=1,
    )


def manifest_text(root: Path) -> str:
    rows = []
    for path in sorted(
        p for p in root.rglob("*") if p.is_file() and p.name != MANIFEST_NAME
    ):
        relative = path.relative_to(root).as_posix()
        rows.append(f"{hashlib.sha256(path.read_bytes()).hexdigest()}  {relative}")
    return "\n".join(rows) + "\n"


def file_map(root: Path) -> dict[str, bytes]:
    return {
        path.relative_to(root).as_posix(): path.read_bytes()
        for path in sorted(p for p in root.rglob("*") if p.is_file())
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("site"))
    parser.add_argument("--output", type=Path, default=Path("_site"))
    parser.add_argument("--public-url", default=None)
    args = parser.parse_args()

    source = args.source.resolve()
    output = args.output.resolve()
    if not source.is_dir():
        raise SystemExit(f"STOP - source directory not found: {source}")
    if source == output or source in output.parents or output in source.parents:
        raise SystemExit("STOP - source and output directories must not contain each other")

    source_index = (source / "index.html").read_text(encoding="utf-8")
    source_start = (source / "start.html").read_text(encoding="utf-8")
    source_urls = [
        extract_one(source_index, OG_URL, "index og:url"),
        extract_one(source_index, CANONICAL, "index canonical"),
        extract_one(source_start, CANONICAL, "start canonical"),
    ]
    if len(set(source_urls)) != 1:
        raise SystemExit("STOP - source self URL fields disagree")

    source_public_url = source_urls[0]
    try:
        target_public_url = normalize_public_url(args.public_url or source_public_url)
    except ValueError as exc:
        raise SystemExit(f"STOP - {exc}") from exc

    source_files = file_map(source)

    if output.exists():
        shutil.rmtree(output)
    shutil.copytree(source, output)

    output_index = (output / "index.html").read_text(encoding="utf-8")
    output_index = replace_one(
        output_index, OG_URL, target_public_url, "index og:url"
    )
    output_index = replace_one(
        output_index, CANONICAL, target_public_url, "index canonical"
    )
    (output / "index.html").write_text(
        output_index, encoding="utf-8", newline="\n"
    )

    output_start = (output / "start.html").read_text(encoding="utf-8")
    output_start = replace_one(
        output_start, CANONICAL, target_public_url, "start canonical"
    )
    (output / "start.html").write_text(
        output_start, encoding="utf-8", newline="\n"
    )

    observed_urls = [
        extract_one(output_index, OG_URL, "output index og:url"),
        extract_one(output_index, CANONICAL, "output index canonical"),
        extract_one(output_start, CANONICAL, "output start canonical"),
    ]
    if set(observed_urls) != {target_public_url}:
        raise SystemExit("STOP - generated deployment self URLs disagree")

    (output / MANIFEST_NAME).write_text(
        manifest_text(output), encoding="utf-8", newline="\n"
    )

    output_files = file_map(output)
    if set(source_files) != set(output_files):
        raise SystemExit("STOP - deployment artifact file set differs from source")

    changed = {
        path for path in source_files if source_files[path] != output_files[path]
    }
    expected_changed = (
        set()
        if target_public_url == source_public_url
        else ALLOWED_CHANGED_FILES
    )
    if changed != expected_changed:
        raise SystemExit(
            "STOP - deployment artifact changed outside the envelope allowlist: "
            + json.dumps(
                {
                    "expected": sorted(expected_changed),
                    "observed": sorted(changed),
                }
            )
        )

    print(
        json.dumps(
            {
                "source_public_url": source_public_url,
                "target_public_url": target_public_url,
                "changed_files": sorted(changed),
                "status": "PASS",
            },
            sort_keys=True,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
