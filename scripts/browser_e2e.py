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
          const primary = document.querySelector('button.primary, a.primary');
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
    html = INDEX_HTML.replace(
        '<head>',
        '<head><base href="http://fde.test/">',
        1,
    )
    html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', html, count=1)
    page.set_content(html, wait_until="networkidle")
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
    assert_page_clean(page)


def decision_flow(page: Page, base: str) -> None:
    route(page, base, "/decision", "#decision-step-heading", "Frame the real decision")
    headings = [
        "Frame the real decision",
        "Make uncertainty and values visible",
        "Compare meaningful strategies",
        "Describe plausible conditions, not one forecast",
        "Stress-test every strategy",
        "Robust Decision Brief",
    ]
    for index, expected in enumerate(headings[1:]):
        if index == 0:
            page.locator("#decision-next").focus()
            page.keyboard.press("Enter")
        else:
            page.locator("#decision-next").click()
        page.locator("#decision-step-heading").wait_for(state="visible")
        page.locator("#decision-step-heading:focus").wait_for(state="attached")
        assert expected in page.locator("#decision-step-heading").inner_text()
        heading_top = page.locator("#decision-step-heading").bounding_box()["y"]
        viewport_height = page.evaluate("window.innerHeight")
        assert 0 <= heading_top <= viewport_height - 100, f"decision step heading is not visible: {heading_top}"
        if expected == "Stress-test every strategy":
            assert "Leading candidate · critical gaps remain" in page.locator("body").inner_text()

    page.locator("#human-rationale").fill("")
    page.locator("#human-next-action").fill("")
    page.locator("#export-decision-json").click()
    page.locator("#human-rationale:focus").wait_for(state="attached")
    assert page.locator("#human-rationale").get_attribute("aria-invalid") == "true"

    page.locator("#human-rationale").fill(
        "The staged strategy preserves learning, privacy, reversibility, and explicit trigger conditions."
    )
    page.locator("#human-next-action").fill(
        "Complete known-target controls and approve the deployment trigger checklist."
    )
    with page.expect_download() as json_download:
        page.locator("#export-decision-json").click()
    assert json_download.value.suggested_filename.endswith(".fde.json")
    with page.expect_download() as html_download:
        page.locator("#export-decision-html").click()
    assert html_download.value.suggested_filename.endswith(".decision.html")
    assert_page_clean(page)


def phenomena_flow(page: Page, base: str) -> None:
    route(page, base, "/case", "h1", "Create a reproducible case")
    page.locator("#case-title").fill("Synthetic local hashing and measurement control")
    page.locator("#case-summary").fill(
        "A synthetic text source used only to verify the local evidence workflow."
    )
    page.locator("#case-next").click()
    page.locator("#case-file").wait_for(state="attached")
    page.locator("#case-step-heading:focus").wait_for(state="attached")
    heading_top = page.locator("#case-step-heading").bounding_box()["y"]
    viewport_height = page.evaluate("window.innerHeight")
    assert 0 <= heading_top <= viewport_height - 100, f"phenomena step heading is not visible: {heading_top}"
    page.locator("#case-file").set_input_files(
        files=[
            {
                "name": "synthetic-control.txt",
                "mimeType": "text/plain",
                "buffer": b"frontier-decision-engine-e2e-control",
            }
        ]
    )
    page.locator(".file-summary").wait_for(state="visible")
    digest = page.locator(".hash").inner_text().strip()
    assert len(digest) == 64 and all(character in "0123456789abcdef" for character in digest)

    page.locator("#case-next").click()
    page.locator("#hfov").fill("40")
    page.locator("#hpixels").fill("1920")
    page.locator("#vpixels").fill("1080")
    page.locator("#fps").fill("30")
    page.locator("#cal-status").select_option("calibrated")

    page.locator("#case-next").click()
    page.locator("details.soft-panel summary").click()
    page.locator("#point-1-x").fill("100")
    page.locator("#point-1-y").fill("100")
    page.locator("#point-2-x").fill("220")
    page.locator("#point-2-y").fill("100")
    page.locator("#apply-coordinates").click()
    assert "2.5°" in page.locator(".result-grid").inner_text()

    page.locator("#case-next").click()
    page.locator("#export-json").wait_for(state="visible")
    assert "2 / 7" in page.locator("body").inner_text()
    page.locator("#verdict").select_option("insufficient-evidence")
    with page.expect_download() as json_download:
        page.locator("#export-json").click()
    assert json_download.value.suggested_filename.endswith(".opv.json")
    with page.expect_download() as html_download:
        page.locator("#export-html").click()
    assert html_download.value.suggested_filename.endswith(".opv.html")
    assert_page_clean(page)


def route_suite(page: Page, base: str) -> None:
    checks = [
        ("/", "h1", "Decide well when prediction fails"),
        ("/datasets", "h1", "Explore before you build"),
        ("/dataset/morphology", "h1", "Karijini morphology and motion"),
        ("/dataset/experiences", "h1", "Longitudinal experience registry"),
        ("/dataset/references", "h1", "Thematic research map"),
        ("/method", "h1", "A trustworthy encounter with ambiguity"),
    ]
    for path, selector, expected in checks:
        route(page, base, path, selector, expected)




def print_flow(page: Page) -> None:
    assert page.locator(".decision-brief").is_visible()
    page.emulate_media(media="print")
    assert page.locator(".decision-brief").is_visible()
    assert page.locator(".site-header").evaluate("element => getComputedStyle(element).display") == "none"
    assert page.locator(".wizard-nav").evaluate("element => getComputedStyle(element).display") == "none"
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
        decision_flow(page, base)
        print_flow(page)
        phenomena_flow(page, base)
    else:
        route(page, base, "/decision", "#decision-step-heading", "Frame the real decision")
    assert not console_errors, f"console errors in {label}: {console_errors}"
    assert not page_errors, f"page errors in {label}: {page_errors}"
    assert_page_clean(page)
    context.close()
    print(f"{label}: PASS ({execution_mode})")


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
                native_http = native_http_available(browser, base)

            run_mode(browser, base, "desktop-light", {"width": 1440, "height": 1200}, "light", True, native_http)
            run_mode(browser, base, "mobile-light", {"width": 390, "height": 844}, "light", False, native_http)
            run_mode(browser, base, "desktop-dark", {"width": 1440, "height": 1200}, "dark", False, native_http)
            run_mode(browser, base, "reflow-200-equivalent", {"width": 640, "height": 900}, "light", False, native_http)
            run_mode(browser, base, "reflow-400-equivalent", {"width": 320, "height": 800}, "light", False, native_http)
            run_mode(
                browser, base, "forced-colors", {"width": 1280, "height": 900},
                "light", False, native_http, forced_colors="active"
            )
        finally:
            browser.close()
            if server is not None:
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    main()
