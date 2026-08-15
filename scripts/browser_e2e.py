#!/usr/bin/env python3
"""Real-browser end-to-end verification for Frontier Decision Engine."""
from __future__ import annotations

import hashlib
import mimetypes
import threading
import tempfile
import time
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import os
import re
import shutil
from pathlib import Path
from urllib.parse import unquote, urlparse

try:
    from playwright.sync_api import Error as PlaywrightError
    from playwright.sync_api import Page, sync_playwright
except ImportError as exc:  # pragma: no cover - environment guidance
    raise SystemExit(
        "Browser E2E requires Playwright. Run: python3 -m pip install -r requirements-dev.txt "
        "and python3 -m playwright install chromium"
    ) from exc

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"
INDEX_HTML = (SITE / "index.html").read_text(encoding="utf-8")



class QuietStaticHandler(SimpleHTTPRequestHandler):
    def log_message(self, _format: str, *_args) -> None:
        return


def start_static_server() -> tuple[ThreadingHTTPServer, str]:
    handler = partial(QuietStaticHandler, directory=str(SITE))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    host, port = server.server_address
    return server, f"http://{host}:{port}"


def native_http_available(
    browser, base: str, *, attempts: int = 1, timeout_ms: int = 5_000, retry_seconds: float = 2.0
) -> bool:
    for attempt in range(attempts):
        context = browser.new_context()
        page = context.new_page()
        try:
            page.goto(base, wait_until="networkidle", timeout=timeout_ms)
            page.locator("#main h1").wait_for(state="visible", timeout=timeout_ms)
            if page.locator("#main").count() == 1 and page.evaluate("!!crypto.subtle"):
                return True
        except PlaywrightError:
            pass
        finally:
            context.close()
        if attempt + 1 < attempts:
            time.sleep(retry_seconds)
    return False


def browser_executable() -> str | None:
    explicit = os.environ.get("CHROME_BIN")
    if explicit:
        return explicit
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        found = shutil.which(name)
        if found:
            return found
    return None


def install_static_route(context) -> None:
    def handle(route) -> None:
        parsed = urlparse(route.request.url)
        relative = unquote(parsed.path.lstrip("/")) or "index.html"
        candidate = (SITE / relative).resolve()
        try:
            candidate.relative_to(SITE.resolve())
        except ValueError:
            route.fulfill(status=403, body="Forbidden")
            return
        if candidate.is_dir():
            candidate = candidate / "index.html"
        if not candidate.exists() or not candidate.is_file():
            route.fulfill(status=404, body="Not found")
            return
        media_type = mimetypes.guess_type(candidate.name)[0] or "application/octet-stream"
        route.fulfill(status=200, path=str(candidate), content_type=media_type, headers={"Access-Control-Allow-Origin": "*"})

    context.route("http://fde.test/**", handle)


def assert_page_clean(page: Page) -> None:
    audit = page.evaluate(
        """
        () => {
          const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
          const unnamedButtons = [...document.querySelectorAll('button')].filter(
            (button) => !button.textContent.trim() && !button.getAttribute('aria-label')
          ).length;
          const unnamedLinks = [...document.querySelectorAll('a')].filter(
            (link) => !link.textContent.trim() && !link.getAttribute('aria-label') && !link.querySelector('img[alt]')
          ).length;
          const unlabeledControls = [...document.querySelectorAll('input, select, textarea')].filter(
            (control) => !(control.labels && control.labels.length) &&
              !control.getAttribute('aria-label') && !control.getAttribute('aria-labelledby')
          ).length;
          const emptyHeadings = [...document.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(
            (heading) => !heading.textContent.trim()
          ).length;
          const imagesMissingAlt = [...document.querySelectorAll('img')].filter(
            (image) => !image.hasAttribute('alt')
          ).length;
          const tablesMissingCaption = [...document.querySelectorAll('table')].filter(
            (table) => !table.querySelector(':scope > caption')
          ).length;
          const fieldsetsMissingLegend = [...document.querySelectorAll('fieldset')].filter(
            (fieldset) => !fieldset.querySelector(':scope > legend')
          ).length;
          const detailsMissingSummary = [...document.querySelectorAll('details')].filter(
            (details) => !details.querySelector(':scope > summary')
          ).length;
          const navMissingLabel = [...document.querySelectorAll('nav')].filter(
            (nav) => !nav.getAttribute('aria-label') && !nav.getAttribute('aria-labelledby')
          ).length;
          const primary = [...document.querySelectorAll('button.primary, a.primary')]
            .find((element) => element.getClientRects().length > 0);
          const parseRgb = (value) => {
            const match = String(value).match(/rgba?\\((\\d+)[, ]+(\\d+)[, ]+(\\d+)/i);
            return match ? match.slice(1, 4).map(Number) : null;
          };
          const luminance = (rgb) => rgb.map((value) => {
            const normalized = value / 255;
            return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
          }).reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
          let contrast = null;
          let primaryHeight = null;
          if (primary) {
            const style = getComputedStyle(primary);
            const foreground = parseRgb(style.color);
            const background = parseRgb(style.backgroundColor);
            if (foreground && background) {
              const first = luminance(foreground);
              const second = luminance(background);
              contrast = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
            }
            primaryHeight = primary.getBoundingClientRect().height;
          }
          const uncontainedOverflow = [...document.querySelectorAll('body *')].filter((element) => {
            const rect = element.getBoundingClientRect();
            return (rect.right > window.innerWidth + 1 || rect.left < -1) && !element.closest('.table-wrap');
          }).length;
          const originalX = window.scrollX;
          const originalY = window.scrollY;
          window.scrollTo({ left: 100000, top: originalY, behavior: 'instant' });
          const horizontalScroll = window.scrollX;
          window.scrollTo({ left: originalX, top: originalY, behavior: 'instant' });
          return {
            duplicateIds: ids.length - new Set(ids).size,
            unnamedButtons,
            unnamedLinks,
            unlabeledControls,
            emptyHeadings,
            imagesMissingAlt,
            tablesMissingCaption,
            fieldsetsMissingLegend,
            detailsMissingSummary,
            navMissingLabel,
            h1Count: document.querySelectorAll('main h1').length,
            mainCount: document.querySelectorAll('main').length,
            overflow: document.documentElement.scrollWidth - window.innerWidth,
            uncontainedOverflow,
            horizontalScroll,
            contrast,
            primaryHeight,
          };
        }
        """
    )
    assert audit["duplicateIds"] == 0, f"duplicate IDs: {audit}"
    assert audit["unnamedButtons"] == 0, f"unnamed buttons: {audit}"
    assert audit["unnamedLinks"] == 0, f"unnamed links: {audit}"
    assert audit["unlabeledControls"] == 0, f"unlabeled form controls: {audit}"
    assert audit["emptyHeadings"] == 0, f"empty headings: {audit}"
    assert audit["imagesMissingAlt"] == 0, f"images missing alt: {audit}"
    assert audit["tablesMissingCaption"] == 0, f"tables missing captions: {audit}"
    assert audit["fieldsetsMissingLegend"] == 0, f"fieldsets missing legends: {audit}"
    assert audit["detailsMissingSummary"] == 0, f"details missing summaries: {audit}"
    assert audit["navMissingLabel"] == 0, f"navigation missing accessible label: {audit}"
    assert audit["h1Count"] == 1, f"expected one main h1: {audit}"
    assert audit["mainCount"] == 1, f"expected one main landmark: {audit}"
    aria_snapshot = page.locator("#main").aria_snapshot()
    assert "heading" in aria_snapshot and "main" in aria_snapshot, f"incomplete accessibility tree: {aria_snapshot}"
    assert audit["uncontainedOverflow"] == 0, f"uncontained overflow: {audit}"
    assert audit["horizontalScroll"] <= 1, f"page can scroll horizontally: {audit}"
    if audit["contrast"] is not None:
        assert audit["contrast"] >= 4.5, f"primary contrast below 4.5:1: {audit}"
    if audit["primaryHeight"] is not None:
        assert audit["primaryHeight"] >= 44, f"primary control below 44px: {audit}"


def load_application(page: Page) -> None:
    if page.locator("#main").count():
        return
    page.goto("http://fde.test/index.html", wait_until="networkidle")
    page.locator("#main").wait_for(state="attached")


def route(page: Page, base: str, path: str, selector: str, expected: str) -> None:
    del base
    load_application(page)
    page.evaluate(
        """
        (path) => {
          const next = `#${path}`;
          if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
          else location.hash = path;
        }
        """,
        path,
    )
    matched_locator = page.locator(selector).filter(has_text=re.compile(re.escape(expected), re.IGNORECASE)).first
    matched_locator.wait_for(state="visible")
    matched = matched_locator.inner_text()
    assert expected.lower() in matched.lower(), f"{path} did not contain {expected!r}; found {matched!r}"
    expected_title = {
        "/": "Frontier Decision Engine",
        "/method": "Frontier Decision Engine",
        "/decision": "Frontier Decision Engine",
        "/decision/new": "Frontier Decision Engine",
        "/decision/example": "Frontier Decision Engine",
        "/decision/open": "Frontier Decision Engine",
    }.get(path)
    if expected_title:
        assert page.title() == expected_title, f"{path} title was {page.title()!r}"
    assert_page_clean(page)


def set_hash_route(page: Page, path: str) -> None:
    page.evaluate(
        """(path) => {
          const next = `#${path}`;
          if (location.hash === next) window.dispatchEvent(new HashChangeEvent('hashchange'));
          else location.hash = path;
        }""",
        path,
    )
    page.locator(f'#main[data-route="{path}"]').wait_for(state="attached")


def open_stage(page: Page, index: int) -> None:
    stage = page.locator(f'[data-decision-stage="{index}"]')
    if stage.get_attribute("open") is None:
        stage.locator(":scope > summary").click()
    page.locator(f"#decision-step-heading-{index}").wait_for(state="visible")


def decision_flow(page: Page, base: str) -> str:
    route(page, base, "/decision", '[data-surface="fde-hero"] h1', "Frontier Decision Engine")
    assert page.locator('[data-surface="integrated-method"]').is_visible()
    assert page.locator('[data-decision-stage]').count() == 6
    assert page.locator('[data-decision-stage][open]').count() == 1
    assert page.locator("#decision-question").is_visible()
    assert page.locator("#decision-question").input_value() == ""
    page.locator('[data-surface="decision-entry"] > summary').click()
    assert page.locator("#use-ready-example").is_visible()
    assert page.locator("#open-decision-file").is_visible()
    with page.expect_file_chooser() as chooser_info:
        page.locator("#open-decision-file").click()
    chooser_info.value.set_files([])
    page.on("dialog", lambda dialog: dialog.accept())
    page.locator("#use-ready-example").click()
    assert "Synthetic example" in page.locator("#decision-save-status").inner_text()
    page.locator("#decision-step-heading-0").wait_for(state="visible")

    headings = [
        "What are you deciding?",
        "What must be true?",
        "What can you actually do?",
        "What could change?",
        "What did we learn?",
        "What do you choose?",
    ]

    for index, expected in enumerate(headings[1:]):
        next_button = page.locator('[data-decision-stage][open] [data-stage-next]')
        if index == 0:
            next_button.focus()
            page.keyboard.press("Enter")
        else:
            next_button.click()

        heading = page.locator(f"#decision-step-heading-{index + 1}")
        heading.wait_for(state="visible")
        page.locator(f"#decision-step-heading-{index + 1}:focus").wait_for(state="attached")
        actual = heading.inner_text()
        assert expected in actual, f"expected {expected!r}; found {actual!r}"

        heading_box = heading.bounding_box()
        assert heading_box is not None, "decision step heading has no layout box"
        viewport_height = page.evaluate("window.innerHeight")
        assert -2 <= heading_box["y"] <= viewport_height - 100, (
            f"decision step heading is not visible: {heading_box['y']}"
        )

        if expected == "What did we learn?":
            brief = page.locator("body").inner_text()
            assert "Strongest tested alternative" in brief
            assert "81%" not in brief
            page.locator('[data-projection="review"] > summary').click()
            page.locator('[data-projection="inspect"] > summary').click()
            inspected = page.locator("body").inner_text()
            assert "Strongest alignment in this comparison" in inspected
            assert "81%" in inspected

    page.locator("#human-rationale").fill("")
    page.locator("#human-next-action").fill("")
    page.locator("#record-decision").click()
    page.locator("#human-rationale:focus").wait_for(state="attached")
    assert page.locator("#human-rationale").get_attribute("aria-invalid") == "true"

    page.locator("#human-rationale").fill(
        "The second-source pathway provides the strongest tested alignment while preserving flexibility."
    )
    page.locator("#human-next-action").fill(
        "Confirm the qualification evidence plan, owner, milestones, and review date."
    )
    page.locator("#human-strategy").select_option("STR-002")
    page.locator("#record-decision").click()
    page.locator("#decision-recorded-heading").wait_for(state="visible")

    with page.expect_download() as json_download:
        page.locator("#export-decision-json").click()
    assert json_download.value.suggested_filename.endswith(".fde.json")
    completed_file = json_download.value.path()
    assert completed_file is not None

    with page.expect_download() as html_download:
        page.locator("#export-decision-html").click()
    assert html_download.value.suggested_filename.endswith(".decision.html")

    assert_page_clean(page)
    return completed_file


def route_suite(page: Page, base: str) -> None:
    checks = [
        ("/", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
        ("/method", '[data-surface="integrated-method"]', "Frame"),
        ("/decision", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
        ("/decision/open", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
    ]
    for route_path, selector, expected in checks:
        route(page, base, route_path, selector, expected)


def corrective_draft_and_entry_flow(page: Page, completed_file: str) -> None:
    set_hash_route(page, "/decision/new")
    open_stage(page, 0)
    page.locator("summary").filter(has_text=re.compile(r"^Add context")).click()
    page.locator("#decision-title").wait_for(state="visible")
    assert page.locator("#decision-title").input_value() == ""
    page.locator("#decision-title").fill("Partial blank recovery")
    page.locator("#decision-owner").fill("Partial owner")
    page.wait_for_timeout(350)
    assert page.evaluate("localStorage.getItem('fde.decision.autosave.v0.2.11')") is not None
    page.reload(wait_until="networkidle")
    page.locator("#saved-draft-title").wait_for(state="visible")
    assert page.locator("#saved-draft-title").inner_text() == "Welcome back."
    assert "Your decision is saved in this browser" in page.locator('[data-surface="saved-draft-return"]').inner_text()
    assert "not encrypted confidential storage" in page.locator("body").inner_text()
    assert page.locator("#resume-browser-draft").is_visible()
    page.locator('[data-surface="saved-draft-return"] details > summary').click()
    assert page.locator("#download-browser-draft").inner_text() == "Download draft backup"
    assert page.locator("#clear-browser-draft").is_visible()

    with page.expect_download() as backup_download:
        page.locator("#download-browser-draft").click()
    assert backup_download.value.suggested_filename.endswith(".fde-draft.json")
    backup_file = backup_download.value.path()
    assert backup_file is not None

    page.locator("#resume-browser-draft").click()
    page.locator("#decision-step-heading-0").wait_for(state="visible")
    assert "Saved in this browser" in page.locator("body").inner_text()
    assert page.locator("#decision-title").input_value() == "Partial blank recovery"
    assert page.locator("#decision-owner").input_value() == "Partial owner"
    assert page.locator("#decision-question").input_value() == ""

    open_stage(page, 4)
    incomplete_heading = page.locator("#decision-step-heading-4").inner_text()
    assert "One update is needed" in incomplete_heading, incomplete_heading
    open_stage(page, 5)
    page.locator("#record-decision").click()
    assert "Decision question is required" in page.locator("#decision-validation").inner_text()

    # Restored -> explicit ready example produces a fresh example and clears the old draft.
    set_hash_route(page, "/decision/example")
    assert page.locator("#decision-title").input_value() == "Critical-material source qualification decision"
    open_stage(page, 5)
    assert page.locator("#human-strategy").input_value() == ""
    stored_title = page.evaluate(
        """() => {
          const raw = localStorage.getItem('fde.decision.autosave.v0.2.11');
          return raw ? JSON.parse(raw).title : null;
        }"""
    )
    assert stored_title != "Partial blank recovery"

    # Ready -> explicit blank produces a fresh neutral blank.
    set_hash_route(page, "/decision/new")
    assert page.locator("#decision-title").input_value() == ""
    assert "Saved in this browser" in page.locator("body").inner_text()

    # Draft backup reopens exactly and remains incomplete.
    page.locator("#decision-file-input").set_input_files(backup_file)
    page.locator("#decision-title").wait_for(state="attached")
    assert "Saved decision opened" in page.locator("body").inner_text()
    assert page.locator("#decision-title").input_value() == "Partial blank recovery"
    assert page.locator("#decision-owner").input_value() == "Partial owner"
    assert page.locator("#decision-question").input_value() == ""

    # Imported draft -> explicit ready example does not retain imported state.
    set_hash_route(page, "/decision/example")
    assert page.locator("#decision-title").input_value() == "Critical-material source qualification decision"

    # Existing completed schema 0.2.10 export still opens, then explicit ready resets it.
    page.locator("#decision-file-input").set_input_files(completed_file)
    page.locator("#decision-title").wait_for(state="attached")
    assert "Saved decision opened" in page.locator("body").inner_text()
    set_hash_route(page, "/decision/example")
    page.locator("#decision-title").wait_for(state="attached")
    assert page.locator("#decision-title").input_value() == "Critical-material source qualification decision"
    assert "Synthetic example" in page.locator("body").inner_text()
    open_stage(page, 5)
    assert page.locator("#human-strategy").input_value() == ""
    assert_page_clean(page)


def checkpoint_b_semantics_flow(page: Page) -> None:
    set_hash_route(page, "/decision/example")
    page.locator("summary").filter(has_text=re.compile(r"^Choose a decision approach")).click()
    page.locator("#decision-semantic-mode").select_option("sustainability-seer")
    page.locator('[data-decision-stage="0"] [data-stage-next]').click()
    page.locator('[data-surface="decision-semantics-criteria"]').wait_for(state="visible")
    body = page.locator("body").inner_text()
    for dimension in ["People", "Planet", "Profits", "Product"]:
        assert dimension in body
    for index, dimension in enumerate(["People", "Planet", "Profits", "Product"]):
        dimension_panel = page.locator(f'[data-dimension="{dimension.lower()}"]')
        if dimension_panel.get_attribute("open") is None:
            dimension_panel.locator("summary").press("Enter")
        assert dimension_panel.get_attribute("open") is not None
        page.locator(f"#semantic-label-{index}").fill(f"{dimension} criterion")
        page.locator(f"#semantic-requirement-{index}").fill(f"Declared {dimension.lower()} requirement")
        if index == 0:
            page.locator(f"#semantic-required-{index}").check()
            page.locator(f"#semantic-evidence-{index}").select_option("unknown")
            page.locator(f"#semantic-outcome-{index}").select_option("not-assessable")
            page.locator(f"#semantic-evidence-need-{index}").fill("Obtain the declared People evidence.")
        else:
            page.locator(f"#semantic-evidence-{index}").select_option("supported")
            page.locator(f"#semantic-outcome-{index}").select_option("meets")
    page.locator('[data-decision-stage="1"] [data-stage-next]').click()
    open_stage(page, 4)
    page.locator('[data-surface="decision-posture"]').wait_for(state="visible")
    results = page.locator("body").inner_text()
    assert "Decision posture" in results
    assert "HOLD" in results
    assert "People" in results and "Needs evidence" in results
    assert "Planet" in results and "Meets" in results
    assert "Most decision-relevant next evidence" in results
    assert "composite sustainability score" not in results.lower()
    assert "81%" not in results
    page.locator('[data-projection="inspect"] > summary').click()
    assert "Strongest alignment in this comparison" in page.locator("body").inner_text()
    open_stage(page, 5)
    page.locator('[data-surface="advanced-governance"] summary').click()
    page.locator('[data-surface="semantic-controls"]').wait_for(state="visible")
    assert page.locator("#human-strategy").input_value() == ""
    assert "Your final decision remains below" in page.locator("body").inner_text()
    assert page.locator('[data-decision-stage]').count() == 6
    page.locator("#semantic-condition-statement").fill("Visible People remediation")
    page.locator("#semantic-condition-target").select_option("CRT-001")
    page.locator("#semantic-monitoring-observable").fill("Visible monitoring record")
    open_stage(page, 0)
    page.wait_for_timeout(350)
    page.evaluate(
        """() => {
          const key = 'fde.decision.autosave.v0.2.11';
          const saved = JSON.parse(localStorage.getItem(key));
          saved.decision_semantics.conditions.push({ id: 'CON-002', statement: 'Imported condition', required: false, state: 'satisfied', criterion_refs: ['CRT-002'], strategy_refs: ['STR-003'] });
          saved.decision_semantics.monitoring.push({ monitoring_id: 'MON-002', observable: 'Imported monitor', trigger: 'Imported trigger', response: 'Imported response', required: false, criterion_refs: ['CRT-002'], strategy_refs: ['STR-003'] });
          localStorage.setItem(key, JSON.stringify(saved));
        }"""
    )
    page.reload(wait_until="networkidle")
    page.locator("#resume-browser-draft").click()
    open_stage(page, 5)
    page.locator('[data-surface="advanced-governance"] summary').click()
    page.locator("#semantic-condition-statement").fill("Edited visible People remediation")
    page.locator("#semantic-monitoring-observable").fill("Edited visible monitoring record")
    open_stage(page, 0)
    preserved = page.evaluate("JSON.parse(localStorage.getItem('fde.decision.autosave.v0.2.11')).decision_semantics")
    assert len(preserved["conditions"]) == 2
    assert len(preserved["monitoring"]) == 2
    assert preserved["conditions"][0]["criterion_refs"] == ["CRT-001"]
    assert preserved["conditions"][1] == {"id": "CON-002", "statement": "Imported condition", "required": False, "state": "satisfied", "criterion_refs": ["CRT-002"], "strategy_refs": ["STR-003"]}
    assert preserved["monitoring"][1] == {"monitoring_id": "MON-002", "observable": "Imported monitor", "trigger": "Imported trigger", "response": "Imported response", "required": False, "criterion_refs": ["CRT-002"], "strategy_refs": ["STR-003"]}
    page.locator("summary").filter(has_text=re.compile(r"^Choose a decision approach")).click()
    page.locator("#decision-semantic-mode").select_option("general")
    page.locator("#enable-decision-posture").uncheck()
    page.locator('[data-decision-stage="0"] [data-stage-next]').click()
    open_stage(page, 4)
    assert page.locator('[data-surface="decision-posture"]').count() == 0
    stored = page.evaluate("JSON.parse(localStorage.getItem('fde.decision.autosave.v0.2.11'))")
    assert stored["schema_version"] == "0.3.0"
    assert len(stored["decision_semantics"]["criteria"]) == 4
    assert stored["decision_semantics"]["mode"] == "general"
    assert stored["decision_semantics"]["posture_enabled"] is False
    assert_page_clean(page)


def print_flow(page: Page) -> None:
    assert page.locator(".decision-brief").is_visible()
    page.emulate_media(media="print")
    assert page.locator(".decision-brief").is_visible()
    assert page.locator(".site-header").evaluate("element => getComputedStyle(element).display") == "none"
    assert page.locator(".stage-actions").first.evaluate("element => getComputedStyle(element).display") == "none"
    pdf_bytes = page.pdf(format="Letter", print_background=True, prefer_css_page_size=True)
    assert pdf_bytes.startswith(b"%PDF"), "print output is not a PDF"
    assert len(pdf_bytes) > 5_000, f"print PDF unexpectedly small: {len(pdf_bytes)}"
    page.emulate_media(media="screen")


def run_mode(
    browser,
    base: str,
    label: str,
    viewport: dict[str, int],
    color_scheme: str,
    full: bool,
    native_http: bool,
    forced_colors: str = "none",
) -> None:
    context = browser.new_context(
        viewport=viewport,
        color_scheme=color_scheme,
        forced_colors=forced_colors,
        accept_downloads=True,
        reduced_motion="reduce",
    )
    page = context.new_page()
    execution_mode = "native-http"
    if native_http:
        page.goto(base, wait_until="networkidle", timeout=20_000)
    else:
        execution_mode = "sandbox-fallback"
        install_static_route(context)
        # Some managed runtimes block all localhost navigation. In that case the
        # exact static modules run in an isolated document and a test-only digest
        # bridge substitutes for SubtleCrypto, which is unavailable on null origins.
        # Normal CI and GitHub Pages use native browser Web Crypto over a trustworthy
        # localhost or HTTPS origin.
        page.expose_function(
            "__fdeSha256",
            lambda values: list(hashlib.sha256(bytes(values)).digest()),
        )
        page.evaluate(
            """
            Object.defineProperty(window.crypto, 'subtle', {
              configurable: true,
              value: {
                digest: async (_algorithm, data) =>
                  new Uint8Array(await window.__fdeSha256([...new Uint8Array(data)])).buffer,
              },
            });
            """
        )
        load_application(page)
    console_errors: list[str] = []
    page_errors: list[str] = []
    page.on("console", lambda message: console_errors.append(message.text) if message.type == "error" else None)
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    route_suite(page, base)
    if full:
        completed_file = decision_flow(page, base)
        print_flow(page)
        corrective_draft_and_entry_flow(page, completed_file)
        checkpoint_b_semantics_flow(page)
    else:
        route(page, base, "/decision", '[data-surface="fde-hero"] h1', "Frontier Decision Engine")
    assert not console_errors, f"console errors in {label}: {console_errors}"
    assert not page_errors, f"page errors in {label}: {page_errors}"
    assert_page_clean(page)
    context.close()
    print(f"{label}: PASS ({execution_mode})")


def no_js_one_page(browser) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 900}, java_script_enabled=False)
    install_static_route(context)
    page = context.new_page()
    page.goto("http://fde.test/index.html", wait_until="domcontentloaded")
    body = page.locator("body").inner_text()
    for text in ["Frontier Decision Engine", "How it works", "Frame", "Compare", "Decide", "Your decision", "What matters", "Your choices", "What may change", "What we learned", "Choose next step", "Human authority", "stays in this browser"]:
        assert text in body
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    context.close()
    print("no-js-one-page-fallback: PASS")


def walkthrough_front_door(browser) -> None:
    for viewport in ({"width": 1440, "height": 900}, {"width": 375, "height": 812}):
        context = browser.new_context(viewport=viewport, reduced_motion="reduce")
        install_static_route(context)
        page = context.new_page()
        page.goto("http://fde.test/start.html", wait_until="domcontentloaded")
        hero = page.locator(".example-hero").inner_text()
        for text in ["WALKTHROUGH", "See the decision flow.", "Turn evidence and uncertainty into a clear next decision.", "Synthetic example · 6 steps", "Start walkthrough", "Open Decision Lab"]:
            assert text in hero
        for removed in ["Not the working interface", "Six-stage method", "Your work stays in this browser"]:
            assert removed not in hero
        assert page.locator('[data-action="start-walkthrough"]').is_visible()
        assert page.locator('[data-action="start-walkthrough"]').evaluate("el => getComputedStyle(el).minHeight === '44px' || el.getBoundingClientRect().height >= 44")
        page.locator('[data-action="start-walkthrough"]').click()
        page.locator("#stage-1:focus").wait_for(state="attached")
        assert page.locator("#stage-1").is_visible()
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        context.close()
    print("walkthrough-front-door-desktop-mobile: PASS")


def walkthrough_handoff(browser, base: str, native_http: bool) -> None:
    def open_walkthrough(viewport):
        context = browser.new_context(viewport=viewport, reduced_motion="reduce")
        if not native_http:
            install_static_route(context)
            url = "http://fde.test/start.html"
        else:
            url = f"{base}/start.html"
        page = context.new_page()
        page.goto(url, wait_until="networkidle")
        return context, page

    for viewport in ({"width": 1440, "height": 900}, {"width": 375, "height": 812}):
        context, page = open_walkthrough(viewport)
        assert page.locator(".example-hero").is_visible()
        assert not page.locator(".walkthrough-progress").is_visible()
        assert not page.locator('[data-panel="1"]').is_visible()
        page.locator('[data-action="start-walkthrough"]').focus()
        page.keyboard.press("Enter")
        assert page.locator('[data-panel="1"]:focus').is_visible()
        assert page.locator("#progress-count").inner_text() == "1 of 6"
        for number in range(2, 7):
            page.locator(f'[data-next="{number}"]').click()
            assert page.locator(f'[data-panel="{number}"]:focus').is_visible()
            assert page.locator("#progress-count").inner_text() == f"{number} of 6"
        page.locator('[data-panel="6"] [data-action="open-decision-lab"]').click()
        page.locator('[data-surface="working-interface"]').wait_for(state="visible")
        assert "Synthetic example." in page.locator('[data-surface="working-interface"]').inner_text()
        assert page.locator("#decision-step-heading").is_visible()
        assert page.locator("#human-decision").count() == 0 or page.locator("#human-decision").input_value() == ""
        page.go_back(wait_until="networkidle")
        assert page.locator('[data-panel="1"]').is_visible()
        context.close()

    for selector, activation in [
        ('.example-hero [data-action="open-decision-lab"]', "click"),
        ('#primary-navigation [data-action="open-decision-lab"]', "keyboard"),
    ]:
        context, page = open_walkthrough({"width": 1440, "height": 900})
        target = page.locator(selector)
        if activation == "keyboard":
            target.focus()
            page.keyboard.press("Enter")
        else:
            target.click()
        page.locator('[data-surface="working-interface"]').wait_for(state="visible")
        assert "Synthetic example." in page.locator('[data-surface="working-interface"]').inner_text()
        context.close()
    print("walkthrough-decision-lab-handoff-desktop-mobile-keyboard: PASS")


def compatibility_routes(browser) -> None:
    for viewport in ({"width": 1440, "height": 900}, {"width": 375, "height": 812}):
        context = browser.new_context(viewport=viewport, reduced_motion="reduce")
        install_static_route(context)
        page = context.new_page()
        page.goto("http://fde.test/start.html", wait_until="networkidle")
        page.wait_for_url(re.compile(r"/index\.html#/method$"))
        assert page.title() == "Frontier Decision Engine"
        assert page.locator('[data-surface="fde-hero"] h1').inner_text() == "Frontier Decision Engine"
        assert page.locator('[data-surface="integrated-method"]').is_visible()
        assert page.locator('[data-decision-stage]').count() == 6
        assert page.locator('[data-decision-stage][open]').count() == 1
        assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
        context.close()
    print("start-and-method-compatibility-routes: PASS")


def main() -> None:
    executable = browser_executable()
    external_base = os.environ.get("FDE_BASE_URL", "").strip().rstrip("/")
    server: ThreadingHTTPServer | None = None
    if external_base:
        base = external_base
    else:
        server, base = start_static_server()

    with sync_playwright() as playwright:
        launch_kwargs = {"headless": True}
        if executable:
            launch_kwargs["executable_path"] = executable
        try:
            browser = playwright.chromium.launch(**launch_kwargs)
        except PlaywrightError as exc:
            if server is not None:
                server.shutdown()
                server.server_close()
            raise SystemExit(
                "Chromium could not launch. Run: python3 -m playwright install chromium"
            ) from exc
        try:
            if external_base:
                native_http = native_http_available(
                    browser, base, attempts=12, timeout_ms=20_000, retry_seconds=5.0
                )
                if not native_http:
                    raise SystemExit(f"Live Pages URL did not become ready for browser verification: {base}")
            else:
                # The deterministic in-process route avoids intermittent loopback resets
                # while preserving the separate launcher validation against real HTTP.
                native_http = False

            run_mode(browser, base, "desktop-light", {"width": 1440, "height": 1200}, "light", True, native_http)
            run_mode(browser, base, "mobile-light", {"width": 390, "height": 844}, "light", False, native_http)
            run_mode(browser, base, "mobile-375", {"width": 375, "height": 812}, "light", True, native_http)
            run_mode(browser, base, "desktop-dark", {"width": 1440, "height": 1200}, "dark", False, native_http)
            run_mode(browser, base, "reflow-200-equivalent", {"width": 640, "height": 900}, "light", False, native_http)
            run_mode(browser, base, "reflow-400-equivalent", {"width": 320, "height": 800}, "light", True, native_http)
            run_mode(
                browser, base, "forced-colors", {"width": 1280, "height": 900},
                "light", False, native_http, forced_colors="active"
            )
            no_js_one_page(browser)
            compatibility_routes(browser)
        finally:
            browser.close()
            if server is not None:
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    main()
