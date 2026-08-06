#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
errors: list[str] = []

def require(relative: str) -> None:
    if not (ROOT / relative).exists():
        errors.append(f"missing required path: {relative}")

def load_json(relative: str):
    try:
        return json.loads((ROOT / relative).read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {relative}: {exc}")
        return {}

required = [
    "README.md",
    "LICENSE",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
    "CITATION.cff",
    "docs/ARCHITECTURE.md",
    "docs/METHODOLOGY.md",
    "docs/DATA_DICTIONARY.md",
    "docs/PRIVACY.md",
    "docs/RELEASING.md",
    "site/index.html",
    "site/assets/styles.css",
    "site/src/app.js",
    "site/src/decision-ui.js",
    "site/src/lib/decision.js",
    "site/data/morphology.json",
    "site/data/experiences.json",
    "site/data/references.json",
    "scripts/browser_e2e.py",
    "scripts/package_release.py",
    "requirements-dev.txt",
    "schemas/case.schema.json",
    "schemas/decision.schema.json",
    "schemas/profile.schema.json",
    "profiles/phenomena/profile.json",
    "examples/phenomena-second-station/decision.fde.json",
    ".github/workflows/ci.yml",
    ".github/workflows/pages.yml",
    ".github/workflows/release.yml",
]
for item in required:
    require(item)

package = load_json("package.json")
decision = load_json("examples/phenomena-second-station/decision.fde.json")
profile = load_json("profiles/phenomena/profile.json")
morphology = load_json("site/data/morphology.json")
experiences = load_json("site/data/experiences.json")
references = load_json("site/data/references.json")

if package.get("name") != "frontier-decision-engine":
    errors.append("package name mismatch")
if package.get("version") != "0.2.11":
    errors.append("package version mismatch")
if decision.get("schema_version") != "0.2.10":
    errors.append("decision example schema version mismatch")
if profile.get("profile_id") != "phenomena":
    errors.append("phenomena profile identity mismatch")
if "generated-visualization" not in profile.get("evidence_classes", []):
    errors.append("phenomena profile evidence boundary is incomplete")

if len(decision.get("objectives", [])) < 2:
    errors.append("decision example lacks objective diversity")
if len(decision.get("strategies", [])) < 2:
    errors.append("decision example lacks strategy diversity")
if len(decision.get("scenarios", [])) < 2:
    errors.append("decision example lacks scenario diversity")
if decision.get("provenance", {}).get("probability_model_used") is not False:
    errors.append("reference decision must disclose no probability model")
if decision.get("provenance", {}).get("values_are_analyst_assigned") is not True:
    errors.append("reference decision must disclose analyst-assigned values")
if not str(decision.get("human_decision", {}).get("rationale", "")).strip():
    errors.append("reference decision lacks human rationale")
if not str(decision.get("human_decision", {}).get("next_action", "")).strip():
    errors.append("reference decision lacks a next action")

for schema in (ROOT / "schemas").glob("*.json"):
    parsed = load_json(str(schema.relative_to(ROOT)))
    expected_id = (
        "https://bridge-node-7.github.io/frontier-decision-engine/schemas/"
        + schema.name
    )
    if parsed.get("$id") != expected_id:
        errors.append(f"schema ID drift: {schema.name}")
    published = SITE / "schemas" / schema.name
    if published.exists() and published.read_bytes() != schema.read_bytes():
        errors.append(f"published schema drift: {schema.name}")

expected_counts = {
    "morphology objects": (morphology.get("summary", {}).get("objects"), 41),
    "morphology sequences": (morphology.get("summary", {}).get("sequences"), 40),
    "morphology intervals": (
        morphology.get("summary", {}).get("valid_intervals"),
        169,
    ),
    "synthetic primary events": (
        experiences.get("summary", {}).get("primary_encounters"),
        41,
    ),
    "synthetic subphases": (
        experiences.get("summary", {}).get("nested_subphases"),
        22,
    ),
    "synthetic analytic units": (
        experiences.get("summary", {}).get("analytic_units"),
        63,
    ),
    "reference clusters": (
        references.get("summary", {}).get("reference_clusters"),
        53,
    ),
}
for label, (actual, wanted) in expected_counts.items():
    if actual != wanted:
        errors.append(f"{label}: expected {wanted}, got {actual}")

if experiences.get("dataset_id") != "opv-experiences-synthetic-v1":
    errors.append("event registry is not the approved synthetic dataset")
if experiences.get("evidence_class") != "synthetic-demonstration":
    errors.append("synthetic event evidence class mismatch")
if experiences.get("privacy", {}).get("status") != "synthetic-no-personal-source":
    errors.append("synthetic event privacy status mismatch")
if experiences.get("source", {}).get("included_in_public_repository") is not True:
    errors.append("synthetic source inclusion marker mismatch")
if len(experiences.get("primary_events", [])) != 41:
    errors.append("synthetic primary event count mismatch")
if len(experiences.get("subphases", [])) != 22:
    errors.append("synthetic subphase count mismatch")

serialized_experiences = json.dumps(experiences, ensure_ascii=False)
personal_tokens = [
    "4D_" + "Experiences_" + "Integrated",
    "Longitudinal " + "Experience Registry",
    "Child" + "hood",
    "Te" + "ens",
    "2019" + "\u2013" + "2022",
    "OBEs over " + "Bribie",
    "Malevolent " + "wrinkled figure",
    "Approx_" + "Age",
]
for token in personal_tokens:
    if token.lower() in serialized_experiences.lower():
        errors.append(f"personal-history token remains in synthetic data: {token}")

for record in (
    experiences.get("primary_events", [])
    + experiences.get("subphases", [])
):
    if not str(record.get("label", "")).startswith("Synthetic "):
        errors.append(f"non-synthetic event label: {record.get('event_id')}")
    if record.get("event_type") == "subphase" and not record.get("parent_event_id"):
        errors.append(f"subphase lacks parent: {record.get('event_id')}")

for dataset in (morphology, experiences, references):
    source = dataset.get("source", {})
    if not re.fullmatch(r"[a-f0-9]{64}", source.get("sha256", "")):
        errors.append(f"invalid source fingerprint: {dataset.get('dataset_id')}")

if any(path.suffix.lower() in {".xlsx", ".xls"} for path in ROOT.rglob("*")):
    errors.append("source spreadsheet detected in public repository")
if any(
    "__pycache__" in path.parts or path.suffix.lower() in {".pyc", ".pyo"}
    for path in ROOT.rglob("*")
):
    errors.append("compiled Python cache detected")
if (ROOT / "hosted-verification").exists():
    errors.append("hosted verification downloads detected in source tree")

root_markdown = {
    path.name for path in ROOT.glob("*.md")
}
allowed_root_markdown = {
    "README.md",
    "SECURITY.md",
    "CONTRIBUTING.md",
    "CODE_OF_CONDUCT.md",
}
if root_markdown != allowed_root_markdown:
    errors.append(
        "root Markdown surface mismatch: "
        + ", ".join(sorted(root_markdown))
    )

docs_markdown = {
    str(path.relative_to(ROOT)).replace("\\", "/")
    for path in (ROOT / "docs").rglob("*.md")
}
allowed_docs = {
    "docs/ARCHITECTURE.md",
    "docs/METHODOLOGY.md",
    "docs/DATA_DICTIONARY.md",
    "docs/PRIVACY.md",
    "docs/RELEASING.md",
    "docs/releases/v0.2.10.md",
    "docs/releases/v0.2.11.md",
}
if docs_markdown != allowed_docs:
    errors.append(
        "docs Markdown surface mismatch: "
        + ", ".join(sorted(docs_markdown))
    )

readme = (ROOT / "README.md").read_text(encoding="utf-8")
if len(readme.splitlines()) > 100:
    errors.append("README exceeds 100 lines")
readme_normalized = re.sub(r"\s+", " ", readme)
for required_text in [
    "project-facts.json",
    "synthetic critical-material source-qualification case",
    "browser-local",
    "no backend",
]:
    if required_text.lower() not in readme_normalized.lower():
        errors.append(f"README missing required boundary: {required_text}")

index = (SITE / "index.html").read_text(encoding="utf-8")
if "Content-Security-Policy" not in index:
    errors.append("site index lacks Content-Security-Policy")
if re.search(r"<script[^>]+src=[\"']https?://", index, re.I):
    errors.append("site index loads an external script")

for path in (SITE / "src").rglob("*.js"):
    text = path.read_text(encoding="utf-8")
    if re.search(r"fetch\([\"']https?://", text):
        errors.append(f"remote runtime fetch: {path.relative_to(ROOT)}")
    if "ai-owned decision" in text.lower():
        errors.append(f"prohibited decision authority: {path.relative_to(ROOT)}")

app_text = (SITE / "src/app.js").read_text(encoding="utf-8")
decision_text = (SITE / "src/decision-ui.js").read_text(encoding="utf-8")
if decision_text.count('id="decision-step-heading" tabindex="-1"') != 7:
    errors.append("Decision Lab must expose six focusable steps and one incomplete-analysis heading")
if 'id="case-step-heading"' in app_text:
    errors.append("removed case-wizard heading remains in the public application")
for stale in [
    "Real source data",
    "Longitudinal " + "experience registry",
    "privacy-reduced chronology",
]:
    if stale.lower() in app_text.lower():
        errors.append(f"stale personal-data presentation remains: {stale}")

runner = (ROOT / "scripts/browser_e2e.py").read_text(encoding="utf-8")
requirements = (ROOT / "requirements-dev.txt").read_text(encoding="utf-8")
for required_flow in ("decision_flow", "route_suite", "print_flow"):
    if required_flow not in runner:
        errors.append(f"browser end-to-end flow is not wired: {required_flow}")
if "phenomena_flow" in runner:
    errors.append("removed Phenomena browser flow remains wired")
if "playwright==1.57.0" not in requirements:
    errors.append("expected browser tool pin is missing")

citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
if not re.search(r"(?m)^version:\s*0\.2\.11\s*$", citation):
    errors.append("citation version mismatch")

contributing = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
if not contributing.startswith("# Contributing to Frontier Decision Engine"):
    errors.append("contribution guide title mismatch")

if errors:
    print("REPOSITORY VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("REPOSITORY VALIDATION PASS")
print("- lean public documentation surface")
print("- single Decision Lab public workflow with browser-local persistence")
print("- application, compatible schema, privacy, and browser boundaries preserved")
print("- static site has no external runtime dependencies")
