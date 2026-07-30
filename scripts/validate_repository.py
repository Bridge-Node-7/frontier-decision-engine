#!/usr/bin/env python3
from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"

errors: list[str] = []


def require(path: Path) -> None:
    if not path.exists():
        errors.append(f"missing required path: {path.relative_to(ROOT)}")


for relative in [
    "README.md",
    "COMPREHENSIVE_VV_UX_AUDIT.md",
    "LICENSE",
    "SECURITY.md",
    "PUBLIC_SAFE_BOUNDARY.md",
    "WORLD_IMPROVEMENT_GATE.md",
    "FUNDING_BOUNDARY.md",
    "site/index.html",
    "scripts/package_release.py",
    "site/assets/styles.css",
    "site/src/app.js",
    "site/src/decision-ui.js",
    "site/src/lib/decision.js",
    "scripts/browser_e2e.py",
    "scripts/capture_screenshots.py",
    "requirements-dev.txt",
    "RELEASE_PROVENANCE.md",
    "docs/RELEASE_CHECKLIST.md",
    "site/data/morphology.json",
    "site/data/experiences.json",
    "site/data/references.json",
    "schemas/case.schema.json",
    "schemas/decision.schema.json",
    "schemas/profile.schema.json",
    "profiles/phenomena/profile.json",
    "examples/phenomena-second-station/decision.fde.json",
    "site/schemas/case.schema.json",
    ".github/workflows/ci.yml",
    ".github/workflows/pages.yml",
]:
    require(ROOT / relative)


def load_json(relative: str):
    path = ROOT / relative
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        errors.append(f"invalid JSON {relative}: {exc}")
        return {}


morphology = load_json("site/data/morphology.json")
experiences = load_json("site/data/experiences.json")
references = load_json("site/data/references.json")

package = load_json("package.json")
if package.get("name") != "frontier-decision-engine" or package.get("version") != "0.2.10":
    errors.append("package identity must be frontier-decision-engine v0.2.10")

decision = load_json("examples/phenomena-second-station/decision.fde.json")
profile = load_json("profiles/phenomena/profile.json")
if decision.get("schema_version") != "0.2.10":
    errors.append("decision example does not use schema version 0.2.10")
if len(decision.get("objectives", [])) < 2 or len(decision.get("strategies", [])) < 2 or len(decision.get("scenarios", [])) < 2:
    errors.append("decision example lacks the minimum objective, strategy, or scenario diversity")
if decision.get("provenance", {}).get("probability_model_used") is not False:
    errors.append("reference decision must disclose that no probability model is used")
if decision.get("provenance", {}).get("values_are_analyst_assigned") is not True:
    errors.append("reference decision must disclose analyst-assigned values")
selected = decision.get("human_decision", {}).get("selected_strategy_id")
if selected not in {item.get("strategy_id") for item in decision.get("strategies", [])}:
    errors.append("reference decision selects an unavailable strategy")
if not str(decision.get("human_decision", {}).get("rationale", "")).strip():
    errors.append("reference decision lacks a human rationale")
if not str(decision.get("human_decision", {}).get("next_action", "")).strip():
    errors.append("reference decision lacks a single next action")
objective_by_id = {item.get("objective_id"): item for item in decision.get("objectives", [])}
affordability = objective_by_id.get("OBJ-002", {})
if affordability.get("label") != "Affordability" or affordability.get("direction") != "at-least" or affordability.get("unit") != "desirability score":
    errors.append("OBJ-002 must remain an at-least affordability desirability objective")
for scenario in decision.get("scenarios", []):
    strategy_modifiers = scenario.get("strategy_modifiers", {})
    for strategy in decision.get("strategies", []):
        modifiers = strategy_modifiers.get(strategy.get("strategy_id"), {})
        for objective in decision.get("objectives", []):
            value = modifiers.get(objective.get("objective_id"))
            if not isinstance(value, (int, float)) or value < -100 or value > 100:
                errors.append(f"invalid strategy-specific modifier in {scenario.get('scenario_id')}/{strategy.get('strategy_id')}/{objective.get('objective_id')}")
if profile.get("profile_id") != "phenomena" or "generated-visualization" not in profile.get("evidence_classes", []):
    errors.append("phenomena profile boundary is incomplete")
for schema in (ROOT / "schemas").glob("*.json"):
    parsed_schema = load_json(str(schema.relative_to(ROOT)))
    if schema.name == "case.schema.json":
        serialized = json.dumps(parsed_schema)
        if '"$ref": "http' in serialized or '"$ref": "asset.schema.json"' in serialized or '"$ref": "calibration.schema.json"' in serialized or '"$ref": "measurement.schema.json"' in serialized:
            errors.append("case schema contains a network-bound or external component reference")
    published = SITE / "schemas" / schema.name
    if published.exists() and published.read_bytes() != schema.read_bytes():
        errors.append(f"published schema drift: {schema.name}")

expected = {
    "morphology objects": (morphology.get("summary", {}).get("objects"), 41),
    "morphology sequences": (morphology.get("summary", {}).get("sequences"), 40),
    "morphology intervals": (morphology.get("summary", {}).get("valid_intervals"), 169),
    "experience primary": (experiences.get("summary", {}).get("primary_encounters"), 41),
    "experience subphases": (experiences.get("summary", {}).get("nested_subphases"), 22),
    "experience units": (experiences.get("summary", {}).get("analytic_units"), 63),
    "reference clusters": (references.get("summary", {}).get("reference_clusters"), 53),
}
for label, (actual, wanted) in expected.items():
    if actual != wanted:
        errors.append(f"{label}: expected {wanted}, got {actual}")

if len(morphology.get("objects", [])) != 41:
    errors.append("morphology object array does not contain 41 records")
if len(morphology.get("sequences", [])) != 40:
    errors.append("morphology sequence array does not contain 40 records")
if sum(1 for point in morphology.get("track_points", []) if point.get("use_in_summary")) != 169:
    errors.append("morphology valid interval count does not reproduce 169")
if len(experiences.get("primary_events", [])) != 41 or len(experiences.get("subphases", [])) != 22:
    errors.append("experience arrays do not preserve 41 primary and 22 subphases")
if len(references.get("references", [])) != 53:
    errors.append("reference array does not contain 53 clusters")

banned_experience_keys = {"year_or_date", "age_or_range", "location", "brief_description", "direct_report"}
for record in experiences.get("primary_events", []) + experiences.get("subphases", []):
    present = banned_experience_keys.intersection(record)
    if present:
        errors.append(f"public-safe experience record exposes banned fields: {sorted(present)}")
    if record.get("event_type") == "subphase" and not record.get("parent_event_id"):
        errors.append(f"subphase {record.get('event_id')} lacks parent_event_id")

if not experiences.get("summary", {}).get("all_subphases_share_one_category_template"):
    errors.append("expected subphase coding-template warning is not preserved")
for dataset in (morphology, experiences, references):
    source = dataset.get("source", {})
    if not re.fullmatch(r"[a-f0-9]{64}", source.get("sha256", "")):
        errors.append(f"invalid source hash in {dataset.get('dataset_id')}")
    if source.get("included_in_public_repository") is not False:
        errors.append(f"source inclusion boundary changed in {dataset.get('dataset_id')}")

if any(path.suffix.lower() in {".xlsx", ".xls"} for path in ROOT.rglob("*")):
    errors.append("source spreadsheet detected inside public repository")
if any("__pycache__" in path.parts or path.suffix.lower() in {".pyc", ".pyo"} for path in ROOT.rglob("*")):
    errors.append("compiled Python cache detected inside public repository")
if (ROOT / "hosted-verification").exists():
    errors.append("hosted release verification downloads detected inside source repository")

index = (SITE / "index.html").read_text(encoding="utf-8")
if "Content-Security-Policy" not in index:
    errors.append("site index lacks Content-Security-Policy")
if re.search(r"<script[^>]+src=[\"']https?://", index, re.I):
    errors.append("site index loads an external script")

for path in (SITE / "src").rglob("*.js"):
    text = path.read_text(encoding="utf-8")
    if re.search(r"fetch\([\"']https?://", text):
        errors.append(f"remote runtime fetch in {path.relative_to(ROOT)}")
    if "non-human origin confirmed" in text.lower():
        errors.append(f"prohibited automatic conclusion language in {path.relative_to(ROOT)}")
    if "ai-owned decision" in text.lower():
        errors.append(f"prohibited decision-authority language in {path.relative_to(ROOT)}")

citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
if not re.search(r"(?m)^version:\s*0\.2\.10\s*$", citation):
    errors.append("CITATION.cff version does not match package version 0.2.10")
github_setup = (ROOT / "docs/GITHUB_SETUP.md").read_text(encoding="utf-8")
if "v0.1.0" in github_setup or "open phenomenon verification v0.1" in github_setup.lower():
    errors.append("GitHub setup instructions contain superseded release or commit language")
for schema in (ROOT / "schemas").glob("*.json"):
    parsed = load_json(str(schema.relative_to(ROOT)))
    expected_id = f"https://bridge-node-7.github.io/frontier-decision-engine/schemas/{schema.name}"
    if parsed.get("$id") != expected_id:
        errors.append(f"schema ID drift: {schema.name}")

contributing = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
if not contributing.lstrip().startswith("# Contributing to Frontier Decision Engine"):
    errors.append("CONTRIBUTING.md must identify Frontier Decision Engine as the primary project")
canonical_docs = [
    ROOT / "COMPREHENSIVE_VV_UX_AUDIT.md",
    ROOT / "V_AND_V_REPORT.md",
    ROOT / "RELEASE_PROVENANCE.md",
]
stale_tokens = [
    "88006d9f4ead8cf7c62141f4c2b5711bd320b362c35e2e12bd7f562c211bdfc2",
    "d0afa8f61473b8915d5d6393ae08abab9ba0683af48aef0c428f93df32893af7",
    "frontier-decision-engine-v0.2.1(1).zip",
    "frontier-decision-engine-v0.2.1-final.zip",
]
for document in canonical_docs:
    text = document.read_text(encoding="utf-8")
    for token in stale_tokens:
        if token in text:
            errors.append(f"stale release provenance in {document.name}: {token}")

app_text = (SITE / "src/app.js").read_text(encoding="utf-8")
runner_text = (ROOT / "scripts/browser_e2e.py").read_text(encoding="utf-8")
requirements = (ROOT / "requirements-dev.txt").read_text(encoding="utf-8")
capture_text = (ROOT / "scripts/capture_screenshots.py").read_text(encoding="utf-8")
if "decision_flow" not in runner_text or "phenomena_flow" not in runner_text or "playwright==1.57.0" not in requirements:
    errors.append("browser end-to-end verification harness is not wired correctly")
if app_text.count('id="case-step-heading" tabindex="-1"') != 5:
    errors.append("phenomena case wizard must expose five focusable step headings")

if errors:
    print("REPOSITORY VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("REPOSITORY VALIDATION PASS")
print("- public-safe datasets preserve controlling counts")
print("- observation, experience, and reference layers remain separate")
print("- source workbooks and sensitive experience fields are excluded")
print("- static site has no external runtime dependencies")
