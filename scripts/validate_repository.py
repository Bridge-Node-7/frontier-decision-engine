#!/usr/bin/env python3
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


def load_json(relative: str):
    return json.loads((ROOT / relative).read_text(encoding="utf-8"))


package = load_json("package.json")
version = package["version"]

required = [
    "CITATION.cff", "CONTRIBUTING.md", "LICENSE", "README.md", "SECURITY.md",
    "docs/ARCHITECTURE.md", "docs/METHODOLOGY.md", "docs/DATA_DICTIONARY.md", "docs/PRIVACY.md",
    "docs/RELEASE_NOTES.md", "docs/RELEASING.md", "docs/STYLE_LAYERS.md",
    "site/schemas/decision.schema.json", "site/schemas/decision-0.3.0.schema.json",
    "site/index.html", "site/404.html",
    "site/assets/styles.css", "site/assets/bridge-node-7-shell.css", "site/assets/beginner-first.css", "site/assets/rescue.css", "site/assets/universal-decision.css",
    "site/src/app.js", "site/src/decision-ui.js", "site/src/rescue-ui.js", "site/src/universal-ui.js", "site/src/theme.js",
    "site/src/lib/case.js", "site/src/lib/decision-core.js", "site/src/lib/decision.js", "site/src/lib/intake.js",
    "site/src/lib/persistence.js", "site/src/lib/recording.js", "site/src/lib/semantics.js", "site/src/lib/synthesis.js",
    "site/src/decision-map.js",
    "scripts/browser_e2e.py", "scripts/browser_rescue_e2e.py", "scripts/browser_closeout_regressions.py",
    "scripts/validate_version_integrity.py", "scripts/package_release.py", "scripts/verify_release_tag.py",
    "tests/universal-response.test.js",
    "requirements-dev.txt", ".github/workflows/ci.yml", ".github/workflows/pages.yml", ".github/workflows/release.yml",
]
errors: list[str] = []
for item in required:
    if not (ROOT / item).exists():
        errors.append(f"required public/release path missing: {item}")

root_markdown = {str(path.relative_to(ROOT)).replace("\\", "/") for path in ROOT.glob("*.md")}
expected_root_markdown = {"CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "README.md", "SECURITY.md"}
if root_markdown != expected_root_markdown:
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
for required_text in ["project-facts.json", "browser-local", "no backend", "Decision Map"]:
    if required_text.lower() not in readme_normalized.lower():
        errors.append(f"README missing required boundary: {required_text}")

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
if "./assets/universal-decision.css" not in index:
    errors.append("site index does not load the Universal Decision Map stylesheet")
if "./assets/rescue.css" not in index:
    errors.append("site index does not load the Decision Rescue stylesheet")

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
universal_text = (SITE / "src/universal-ui.js").read_text(encoding="utf-8")
map_text = (SITE / "src/decision-map.js").read_text(encoding="utf-8")
if len(re.findall(r'id="decision-step-heading-[0-5]" tabindex="-1"', decision_text)) != 7:
    errors.append("FDE must expose six focusable decision-stage headings and one incomplete-analysis variant")
if "rescue-intake" not in rescue_text or "Decision Frame" not in rescue_text:
    errors.append("Decision Rescue public entry is incomplete")
if "fde.rescue.session.v1" not in rescue_text:
    errors.append("Decision Rescue session recovery is missing")
if "A decision is already saved in this browser." not in rescue_text:
    errors.append("Decision Rescue saved-work collision boundary is missing")
if "renderUniversalDecisionExperience" not in app_text:
    errors.append("Universal Response is not the public root experience")
if "./decision-map.js" not in app_text:
    errors.append("Decision Map enhancer is not using the sanitized public module path")
for token in ("draftFromInput", "responseFor", "What FDE sees so far", "Possible is not confirmed", "Decision Map"):
    if token not in universal_text:
        errors.append(f"Universal Decision Map is missing required boundary: {token}")
if "data-fde-decision-map-enhanced" not in map_text or "fdeDecisionMapObserver" not in map_text:
    errors.append("Decision Map enhancer uses an invalid public state marker")

runner = (ROOT / "scripts/browser_e2e.py").read_text(encoding="utf-8")
universal_runner = (ROOT / "scripts/browser_rescue_e2e.py").read_text(encoding="utf-8")
requirements = (ROOT / "requirements-dev.txt").read_text(encoding="utf-8")
for required_flow in ("decision_flow", "route_suite", "print_flow"):
    if required_flow not in runner:
        errors.append(f"browser end-to-end flow is not wired: {required_flow}")
for required_rescue_check in ("sessionStorage", "rescue-collision", "color_scheme"):
    if required_rescue_check not in universal_runner:
        errors.append(f"Universal/Decision Rescue browser regression missing: {required_rescue_check}")
if "playwright==1.57.0" not in requirements:
    errors.append("expected browser tool pin is missing")

citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
if not re.search(rf"(?m)^version:\s*{re.escape(version)}\s*$", citation):
    errors.append("citation version mismatch")

shell = (SITE / "assets/bridge-node-7-shell.css").read_text(encoding="utf-8")
rescue_css = (SITE / "assets/rescue.css").read_text(encoding="utf-8")
universal_css = (SITE / "assets/universal-decision.css").read_text(encoding="utf-8")
if "--line-strong:" not in shell:
    errors.append("interactive boundary token is missing")
if "--focus-ring:" not in rescue_css:
    errors.append("theme-aware focus token is missing")
if ".rescue-frame{position:static;order:-1}" in rescue_css.replace(" ", ""):
    errors.append("mobile Rescue frame still precedes the active question")
if "--surface-glow:" not in universal_css or ".universal-layout" not in universal_css:
    errors.append("Universal Decision Map stylesheet is incomplete")
if "Bridge Node 7 Home" not in index:
    errors.append("explicit Bridge Node 7 Home path is missing")

not_found = (SITE / "404.html").read_text(encoding="utf-8")
if "Page not found" not in not_found or "/frontier-decision-engine/#/decision" not in not_found:
    errors.append("branded FDE 404 contract is incomplete")

expected_stylesheet_order = [
    "./assets/styles.css", "./assets/bridge-node-7-shell.css", "./assets/beginner-first.css", "./assets/rescue.css", "./assets/universal-decision.css",
]
positions = [index.find(item) for item in expected_stylesheet_order]
if any(position < 0 for position in positions) or positions != sorted(positions):
    errors.append("stylesheet ownership order is invalid")

contributing = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
if not contributing.startswith("# Contributing to Frontier Decision Engine"):
    errors.append("contribution guide title mismatch")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("REPOSITORY VALIDATION PASS")
print("- Universal Response and Decision Map are part of the public product boundary")
print("- Decision Rescue and Decision Lab preserve human authority and browser-local boundaries")
print("- public decision schemas, release identity, accessibility controls, and OPSEC checks are aligned")
print("- static site has no external runtime dependencies")
