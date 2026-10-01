#!/usr/bin/env python3
from __future__ import annotations

import hashlib
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
errors: list[str] = []

required = [
    "CITATION.cff", "CONTRIBUTING.md", "INTERFACES.json", "LICENSE", "README.md", "SECURITY.md",
    "docs/ARCHITECTURE.md", "docs/METHODOLOGY.md", "docs/DATA_DICTIONARY.md", "docs/PRIVACY.md",
    "docs/DECISION_RECEIPTS.md", "docs/PILOT_READINESS.md",
    "docs/RELEASE_NOTES.md", "docs/RELEASING.md", "docs/STYLE_LAYERS.md",
    "docs/contracts/BN7_TOKEN_CONTRACT_CURRENT.txt",
    "docs/contracts/BN7_TOKEN_CONTRACT_v1.1.0.json",
    "docs/contracts/BN7_TOKEN_CONTRACT_v1.1.0_SHA256.txt",
    "site/schemas/decision.schema.json", "site/schemas/decision-0.3.0.schema.json",
    "site/index.html", "site/404.html",
    "site/assets/styles.css", "site/assets/bridge-node-7-shell.css", "site/assets/beginner-first.css", "site/assets/guided-framing.css", "site/assets/universal-decision.css",
    "site/src/app.js", "site/src/decision-ui.js", "site/src/guided-framing-ui.js", "site/src/universal-ui.js", "site/src/theme.js",
    "site/src/lib/case.js", "site/src/lib/decision-core.js", "site/src/lib/decision.js", "site/src/lib/intake.js",
    "site/src/lib/persistence.js", "site/src/lib/recording.js", "site/src/lib/recordability.js", "site/src/lib/semantics.js", "site/src/lib/synthesis.js",
    "site/src/lib/decision-hinge.js", "site/src/lib/decision-brief.js", "site/src/lib/reassessment.js",
    "site/src/lib/authority.js", "site/src/lib/evidence-readiness.js", "site/src/lib/integrity.js",
    "schemas/decision-receipt-v2.schema.json", "schemas/pilot-proof-envelope-1.schema.json",
    "site/schemas/decision-receipt-v2.schema.json", "site/schemas/pilot-proof-envelope-1.schema.json",
    "site/src/decision-map.js",
    "scripts/browser_e2e.py", "scripts/browser_guided_framing_e2e.py", "scripts/browser_release_regressions.py",
    "scripts/validate_version_integrity.py", "scripts/package_release.py", "scripts/verify_release_tag.py",
    "tests/universal-response.test.js", "tests/input-boundary-generalization.test.js", "tests/recordability.test.js", "tests/decision-hinge.test.js", "tests/decision-brief.test.js", "tests/reassessment.test.js", "tests/receipt-history.test.js", "site/src/lib/input-boundaries.js",
    "requirements-dev.txt", ".github/workflows/ci.yml", ".github/workflows/pages.yml", ".github/workflows/release.yml",
]
for item in required:
    if not (ROOT / item).exists():
        errors.append(f"required public/release path missing: {item}")

current_token_name = (ROOT / "docs/contracts/BN7_TOKEN_CONTRACT_CURRENT.txt").read_text(encoding="utf-8").strip()
if current_token_name != "BN7_TOKEN_CONTRACT_v1.1.0.json":
    errors.append("current visual token contract pointer mismatch")
current_token_path = ROOT / "docs/contracts" / current_token_name
if current_token_path.is_file():
    current_token = json.loads(current_token_path.read_text(encoding="utf-8"))
    if current_token.get("version") != "1.1.0":
        errors.append("current visual token contract version mismatch")
    source = current_token.get("source")
    if not isinstance(source, dict) or set(source) != {"files", "mode", "origin"}:
        errors.append("current visual token contract provenance shape mismatch")
    elif source.get("mode") != "public-release-baseline" or source.get("origin") != "https://bridgenode7.com/":
        errors.append("current visual token contract public origin mismatch")
    checksum_path = ROOT / "docs/contracts/BN7_TOKEN_CONTRACT_v1.1.0_SHA256.txt"
    if checksum_path.is_file():
        expected = checksum_path.read_text(encoding="utf-8").strip()
        digest = hashlib.sha256(current_token_path.read_bytes()).hexdigest()
        if expected != f"{digest}  {current_token_name}":
            errors.append("current visual token contract checksum mismatch")

interfaces = load_json("INTERFACES.json")
if interfaces.get("format") != "bn7.interfaces/0.1":
    errors.append("portable interface manifest format mismatch")
if interfaces.get("system") != "frontier-decision-engine":
    errors.append("portable interface manifest system mismatch")
if "application_version" in interfaces:
    errors.append("portable interface manifest must not couple compatibility to the application version")
provided = interfaces.get("provides")
if not isinstance(provided, list) or len(provided) != 1:
    errors.append("Decision Receipt v2 must be the single declared provided portable contract")
else:
    receipt = provided[0]
    if receipt.get("contract_id") != "urn:bn7:decision-receipt:2":
        errors.append("Decision Receipt portable contract identity mismatch")
    if receipt.get("contract_version") != "2":
        errors.append("Decision Receipt portable contract version mismatch")
    if receipt.get("schema_path") != "schemas/decision-receipt-v2.schema.json":
        errors.append("Decision Receipt portable schema path mismatch")
    if receipt.get("authority") != "PRODUCER_OWNED_PORTABLE_CONTRACT":
        errors.append("Decision Receipt portable authority mismatch")
    receipt_schema = ROOT / "schemas/decision-receipt-v2.schema.json"
    if receipt_schema.is_file():
        receipt_sha256 = hashlib.sha256(receipt_schema.read_bytes()).hexdigest()
        if receipt.get("sha256") != receipt_sha256:
            errors.append("Decision Receipt portable schema digest mismatch")

root_markdown = {str(path.relative_to(ROOT)).replace("\\", "/") for path in ROOT.glob("*.md")}
expected_root_markdown = {"CODE_OF_CONDUCT.md", "CONTRIBUTING.md", "README.md", "SECURITY.md"}
if root_markdown != expected_root_markdown:
    errors.append("root Markdown surface mismatch: " + ", ".join(sorted(root_markdown)))

allowed_docs_markdown = {
    "docs/ARCHITECTURE.md", "docs/METHODOLOGY.md", "docs/DATA_DICTIONARY.md", "docs/PRIVACY.md",
    "docs/DECISION_RECEIPTS.md", "docs/PILOT_READINESS.md",
    "docs/RELEASE_NOTES.md", "docs/RELEASING.md", "docs/STYLE_LAYERS.md",
}
docs_markdown = {str(path.relative_to(ROOT)).replace("\\", "/") for path in (ROOT / "docs").rglob("*.md")}
if docs_markdown != allowed_docs_markdown:
    errors.append("docs Markdown surface mismatch: " + ", ".join(sorted(docs_markdown)))

readme = (ROOT / "README.md").read_text(encoding="utf-8")
if len(readme.splitlines()) > 100:
    errors.append("README exceeds 100 lines")
readme_normalized = re.sub(r"\s+", " ", readme)
for required_text in ["project-facts.json", "browser-local", "no backend", "human"]:
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
        if any(pattern.search(text) for pattern in path_patterns):
            errors.append(f"local-machine path or sync-folder marker detected: {path.relative_to(ROOT)}")

index = (SITE / "index.html").read_text(encoding="utf-8")
if "Content-Security-Policy" not in index:
    errors.append("site index lacks Content-Security-Policy")
if re.search(r"<script[^>]+src=[\"']https?://", index, re.I):
    errors.append("site index loads an external script")
for stylesheet in ["./assets/styles.css", "./assets/bridge-node-7-shell.css", "./assets/beginner-first.css", "./assets/guided-framing.css", "./assets/universal-decision.css"]:
    if stylesheet not in index:
        errors.append(f"site index does not load required stylesheet: {stylesheet}")
if "Bridge Node 7 Home" not in index:
    errors.append("explicit Bridge Node 7 Home path is missing")

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
guided_text = (SITE / "src/guided-framing-ui.js").read_text(encoding="utf-8")
universal_text = (SITE / "src/universal-ui.js").read_text(encoding="utf-8")
theme_text = (SITE / "src/theme.js").read_text(encoding="utf-8")

if len(re.findall(r'id="decision-step-heading-[0-5]" tabindex="-1"', decision_text)) != 7:
    errors.append("FDE must expose six focusable decision-stage headings and one incomplete-analysis variant")
if "guided-intake" not in guided_text or "Decision Frame" not in guided_text or "fde.guided-framing.session.v1" not in guided_text or "Guided framing" not in guided_text:
    errors.append("Guided framing public entry/session boundary is incomplete")
if "A decision is already saved in this browser." not in guided_text:
    errors.append("Guided framing saved-work collision boundary is missing")
if "renderUniversalDecisionExperience" not in app_text:
    errors.append("first-run decision intake is not the public root experience")

required_front_door = [
    "What are you considering?",
    "Share the situation, decision, question, or context in your own words.",
    "Decision, choices, criteria, uncertainties, notes, or context…",
    ">Continue<",
    "Advanced paths",
    "Already know the decision and choices? Open Decision Lab →",
    "deriveDecisionHinge",
    "This decision may turn on",
    "Need more help framing the decision? Use guided framing →",
    "Private by design. Your working decision stays in this browser unless you choose to export it.",
    "supportableSection('Decision', 'decision'",
    "supportableSection('What matters', 'what_matters'",
    "supportableSection('Choices', 'options'",
    "supportableSection('What may change', 'what_may_change'",
    "Which decision or question should we focus on?",
    "Needs confirmation",
]
for token in required_front_door:
    if token not in universal_text:
        errors.append(f"first-run UX missing required contract: {token}")
for prohibited in ["Bring the whole mess", "Find the decision", "What FDE sees so far", "Invalid input"]:
    if prohibited in universal_text or prohibited in index:
        errors.append(f"first-run UX still contains prohibited pre-input copy: {prohibited}")
if "button.textContent = 'Appearance'" not in theme_text or "Current:" not in theme_text:
    errors.append("Appearance control does not preserve a stable visible name plus accessible state")

runner = (ROOT / "scripts/browser_e2e.py").read_text(encoding="utf-8")
universal_runner = (ROOT / "scripts/browser_guided_framing_e2e.py").read_text(encoding="utf-8")
requirements = (ROOT / "requirements-dev.txt").read_text(encoding="utf-8")
for required_flow in ("decision_flow", "route_suite", "print_flow"):
    if required_flow not in runner:
        errors.append(f"browser end-to-end flow is not wired: {required_flow}")
for required_check in ("sessionStorage", "Saved-work protection", "color_scheme", "What are you considering?", "Decision Map"):
    if required_check not in universal_runner:
        errors.append(f"first-run browser regression missing: {required_check}")
if "playwright==1.57.0" not in requirements:
    errors.append("expected browser tool pin is missing")

citation = (ROOT / "CITATION.cff").read_text(encoding="utf-8")
if not re.search(rf"(?m)^version:\s*{re.escape(version)}\s*$", citation):
    errors.append("citation version mismatch")

shell = (SITE / "assets/bridge-node-7-shell.css").read_text(encoding="utf-8")
guided_css = (SITE / "assets/guided-framing.css").read_text(encoding="utf-8")
universal_css = (SITE / "assets/universal-decision.css").read_text(encoding="utf-8")
if "--line-strong:" not in shell:
    errors.append("interactive boundary token is missing")
if "color-scheme:dark" not in shell:
    errors.append("dark application shell must declare its color scheme")
if re.search(r"(?:^|[;{])\s*color\s*:\s*transparent", shell) or "-webkit-text-fill-color:transparent" in shell:
    errors.append("gradient text must retain a visible text-fill floor")
if "--focus-ring:" not in guided_css:
    errors.append("theme-aware focus token is missing")
for token in ["@media(max-width:620px)", "@media(forced-colors:active)", "@media(prefers-reduced-motion:reduce)"]:
    if token not in universal_css:
        errors.append(f"first-run stylesheet missing accessibility/responsive contract: {token}")

not_found = (SITE / "404.html").read_text(encoding="utf-8")
if "Page not found" not in not_found or "/frontier-decision-engine/#/decision" not in not_found:
    errors.append("branded FDE 404 contract is incomplete")

contributing = (ROOT / "CONTRIBUTING.md").read_text(encoding="utf-8")
if not contributing.startswith("# Contributing to Frontier Decision Engine"):
    errors.append("contribution guide title mismatch")

if errors:
    for error in errors:
        print(f"ERROR: {error}")
    sys.exit(1)

print("REPOSITORY VALIDATION PASS")
print("- first-run UX provides structure, one clarification, or an explicit capability boundary")
print("- Guided framing and deterministic Decision Lab preserve human authority and browser-local boundaries")
print("- public decision schemas, release identity, accessibility controls, and publication checks are aligned")
print("- static site has no external runtime dependencies")
