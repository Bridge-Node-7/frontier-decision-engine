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
    "README.md", "LICENSE", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "CITATION.cff",
    "docs/ARCHITECTURE.md", "docs/METHODOLOGY.md", "docs/PRIVACY.md", "docs/RELEASE_NOTES.md", "docs/RELEASING.md",
    "schemas/decision.schema.json", "schemas/decision-0.3.0.schema.json",
    "schemas/asset.schema.json", "schemas/calibration.schema.json", "schemas/case.schema.json",
    "schemas/dataset.schema.json", "schemas/measurement.schema.json", "schemas/profile.schema.json",
    "site/data/experiences.json", "site/data/morphology.json", "site/data/references.json",
    "profiles/phenomena/profile.json", "examples/phenomena-second-station/decision.fde.json",
    "docs/DATA_DICTIONARY.md", "docs/STYLE_LAYERS.md",
    "site/schemas/decision.schema.json", "site/schemas/decision-0.3.0.schema.json",
    "site/index.html", "site/404.html",
    "site/assets/styles.css", "site/assets/bridge-node-7-shell.css", "site/assets/beginner-first.css", "site/assets/luxury-rescue.css",
    "site/src/app.js", "site/src/decision-ui.js", "site/src/rescue-ui.js", "site/src/theme.js",
    "site/src/lib/case.js", "site/src/lib/decision-core.js", "site/src/lib/decision.js", "site/src/lib/intake.js",
    "site/src/lib/persistence.js", "site/src/lib/recording.js", "site/src/lib/semantics.js", "site/src/lib/synthesis.js",
    "scripts/browser_e2e.py", "scripts/browser_rescue_e2e.py", "scripts/browser_closeout_regressions.py",
    "scripts/validate_version_integrity.py", "scripts/package_release.py", "scripts/verify_release_tag.py",
    "requirements-dev.txt", ".github/workflows/ci.yml", ".github/workflows/pages.yml", ".github/workflows/release.yml",
]
for item in required:
    require(item)

package = load_json("package.json")
package_lock = load_json("package-lock.json")
facts = load_json("project-facts.json")
example = load_json("examples/phenomena-second-station/decision.fde.json")
decision_schema = load_json("schemas/decision.schema.json")
semantic_schema = load_json("schemas/decision-0.3.0.schema.json")

if package.get("name") != "frontier-decision-engine":
    errors.append("package name mismatch")
version = str(package.get("version", ""))
if not re.fullmatch(r"\d+\.\d+\.\d+", version):
    errors.append("package version is not semantic")
if str(package_lock.get("version", "")) != version:
    errors.append("package-lock top-level version mismatch")
if str(package_lock.get("packages", {}).get("", {}).get("version", "")) != version:
    errors.append("package-lock root package version mismatch")
if str(facts.get("applicationVersion", "")) != version:
    errors.append("project-facts application version mismatch")

schema_versions = {
    "decision": decision_schema.get("properties", {}).get("schema_version", {}).get("const"),
    "semanticDecision": semantic_schema.get("properties", {}).get("schema_version", {}).get("const"),
}
if schema_versions != {"decision": "0.2.10", "semanticDecision": "0.3.0"}:
    errors.append("decision schema versions changed unexpectedly")
facts_schema_versions = facts.get("schemaVersions", {})
if facts_schema_versions.get("decision") != schema_versions["decision"] or facts_schema_versions.get("semanticDecision") != schema_versions["semanticDecision"]:
    errors.append("project-facts decision schema versions mismatch")
if example.get("schema_version") != schema_versions["decision"]:
    errors.append("reference decision example schema mismatch")
if example.get("provenance", {}).get("probability_model_used") is not False:
    errors.append("reference decision must disclose no probability model")
if example.get("provenance", {}).get("values_are_analyst_assigned") is not True:
    errors.append("reference decision must disclose analyst-assigned values")
if not str(example.get("human_decision", {}).get("rationale", "")).strip():
    errors.append("reference decision lacks human rationale")
if not str(example.get("human_decision", {}).get("next_action", "")).strip():
    errors.append("reference decision lacks a next action")

for schema in (ROOT / "schemas").glob("*.json"):
    published = SITE / "schemas" / schema.name
    if not published.exists() or published.read_bytes() != schema.read_bytes():
        errors.append(f"published schema drift: {schema.name}")

release_notes = ROOT / "docs" / "RELEASE_NOTES.md"
if not release_notes.is_file() or not re.search(
    rf"(?m)^#\s+v{re.escape(version)}\s*$", release_notes.read_text(encoding="utf-8") if release_notes.exists() else ""
):
    errors.append("current release notes version mismatch")

if any(path.suffix.lower() in {".xlsx", ".xls"} for path in ROOT.rglob("*")):
    errors.append("source spreadsheet detected in public repository")
if any("__pycache__" in path.parts or path.suffix.lower() in {".pyc", ".pyo"} for path in ROOT.rglob("*")):
    errors.append("compiled Python cache detected")
if (ROOT / "hosted-verification").exists():
    errors.append("hosted verification downloads detected in source tree")

allowed_root_markdown = {"README.md", "SECURITY.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md"}
root_markdown = {path.name for path in ROOT.glob("*.md")}
if root_markdown != allowed_root_markdown:
    errors.append("root Markdown surface mismatch: " + ", ".join(sorted(root_markdown)))

allowed_docs_markdown = {
    "docs/ARCHITECTURE.md", "docs/METHODOLOGY.md", "docs/DATA_DICTIONARY.md", "docs/PRIVACY.md",
    "docs/RELEASE_NOTES.md", "docs/RELEASING.md", "docs/STYLE_LAYERS.md",
}
docs_markdown = {str(path.relative_to(ROOT)).replace("\\", "/") for path in (ROOT / "docs").rglob("*.md")}
if docs_markdown != allowed_docs_markdown:
    errors.append("docs Markdown surface mismatch: " + ", ".join(sorted(docs_markdown)))

readme = (ROOT / "README.md").read_text(encoding="utf-8")
if len(readme.splitlines()) > 100:
    errors.append("README exceeds 100 lines")
readme_normalized = re.sub(r"\s+", " ", readme)
for required_text in ["project-facts.json", "browser-local", "no backend"]:
    if required_text.lower() not in readme_normalized.lower():
        errors.append(f"README missing required boundary: {required_text}")

# Generic public-surface OPSEC checks avoid embedding confidential source phrases in public code.
scan_roots = [ROOT / "README.md", ROOT / "docs", ROOT / "examples", ROOT / "site" / "src"]
path_patterns = [
    re.compile(r"[A-Za-z]:\\\\Users\\\\[^\\\s]+", re.I),
    re.compile(r"/Users/[^/\s]+/", re.I),
    re.compile(r"/home/[^/\s]+/", re.I),
    re.compile(r"\b(?:OneDrive|Dropbox)\b", re.I),
]
for root in scan_roots:
    files = [root] if root.is_file() else [p for p in root.rglob("*") if p.is_file() and p.suffix.lower() in {".md", ".js", ".py", ".json", ".html", ".css", ".txt"}]
    for path in files:
        try:
            text = path.read_text(encoding="utf-8")
        except Exception:
            continue
        for pattern in path_patterns:
            if pattern.search(text):
                errors.append(f"local-machine path or sync-folder marker detected: {path.relative_to(ROOT)}")
                break

index = (SITE / "index.html").read_text(encoding="utf-8")
if "Content-Security-Policy" not in index:
    errors.append("site index lacks Content-Security-Policy")
if re.search(r"<script[^>]+src=[\"']https?://", index, re.I):
    errors.append("site index loads an external script")

for path in (SITE / "src").rglob("*.js"):
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        errors.append(f"non-UTF-8 JavaScript source: {path.relative_to(ROOT)}")
        continue
    if re.search(r"fetch\([\"']https?://", text):
        errors.append(f"remote runtime fetch: {path.relative_to(ROOT)}")
    if "ai-owned decision" in text.lower():
        errors.append(f"prohibited decision authority: {path.relative_to(ROOT)}")

app_text = (SITE / "src/app.js").read_text(encoding="utf-8")
decision_text = (SITE / "src/decision-ui.js").read_text(encoding="utf-8")
rescue_text = (SITE / "src/rescue-ui.js").read_text(encoding="utf-8")
if len(re.findall(r'id="decision-step-heading-[0-5]" tabindex="-1"', decision_text)) != 7:
    errors.append("FDE must expose six focusable decision-stage headings and one incomplete-analysis variant")
if "rescue-intake" not in rescue_text or "Decision Frame" not in rescue_text:
    errors.append("Decision Rescue public entry is incomplete")
if "fde.rescue.session.v1" not in rescue_text:
    errors.append("Decision Rescue session recovery is missing")
if "A decision is already saved in this browser." not in rescue_text:
    errors.append("Decision Rescue saved-work collision boundary is missing")

runner = (ROOT / "scripts/browser_e2e.py").read_text(encoding="utf-8")
rescue_runner = (ROOT / "scripts/browser_rescue_e2e.py").read_text(encoding="utf-8")
requirements = (ROOT / "requirements-dev.txt").read_text(encoding="utf-8")
for required_flow in ("decision_flow", "route_suite", "print_flow"):
    if required_flow not in runner:
        errors.append(f"browser end-to-end flow is not wired: {required_flow}")
for required_rescue_check in ("sessionStorage", "rescue-collision", "color_scheme"):
    if required_rescue_check not in rescue_runner:
        errors.append(f"Decision Rescue browser regression missing: {required_rescue_check}")
if "playwright==1.57.0" not in requirements:
    errors.append("expected browser tool pin is missing")

citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
if not re.search(rf"(?m)^version:\s*{re.escape(version)}\s*$", citation):
    errors.append("citation version mismatch")

shell = (SITE / "assets/bridge-node-7-shell.css").read_text(encoding="utf-8")
rescue_css = (SITE / "assets/luxury-rescue.css").read_text(encoding="utf-8")
if "--line-strong:" not in shell:
    errors.append("interactive boundary token is missing")
if "--focus-ring:" not in rescue_css:
    errors.append("theme-aware focus token is missing")
if ".rescue-frame{position:static;order:-1}" in rescue_css.replace(" ", ""):
    errors.append("mobile Rescue frame still precedes the active question")
if "Bridge Node 7 Home" not in index:
    errors.append("explicit Bridge Node 7 Home path is missing")

not_found = (SITE / "404.html").read_text(encoding="utf-8")
if "Page not found" not in not_found or "/frontier-decision-engine/#/decision" not in not_found:
    errors.append("branded FDE 404 contract is incomplete")

expected_stylesheet_order = [
    "./assets/styles.css", "./assets/bridge-node-7-shell.css", "./assets/beginner-first.css", "./assets/luxury-rescue.css",
]
positions = [index.find(item) for item in expected_stylesheet_order]
if any(position < 0 for position in positions) or positions != sorted(positions):
    errors.append("stylesheet ownership order is invalid")

contributing = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
if not contributing.startswith("# Contributing to Frontier Decision Engine"):
    errors.append("contribution guide title mismatch")

if errors:
    print("REPOSITORY VALIDATION FAILED")
    for error in errors:
        print(f"- {error}")
    sys.exit(1)

print("REPOSITORY VALIDATION PASS")
print("- public product surface and compatibility artifacts are bounded by repository validation")
print("- Decision Rescue and Decision Lab preserve human authority and browser-local boundaries")
print("- public decision schemas, release identity, accessibility controls, and OPSEC checks are aligned")
print("- static site has no external runtime dependencies")
