#!/usr/bin/env python3
"""Real-browser end-to-end verification for Frontier Decision Engine."""
from __future__ import annotations

import hashlib
import json
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
    from playwright.sync_api import Page, expect, sync_playwright
except ImportError as exc:  # pragma: no cover - environment guidance
    raise SystemExit(
        "Browser E2E requires Playwright. Run: node scripts/run-python.mjs -m pip install "
        "-r requirements-dev.txt and node scripts/run-python.mjs -m playwright install chromium"
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
    if os.name == "nt":
        roots = [os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")]
        for root in filter(None, roots):
            for relative in ("Google/Chrome/Application/chrome.exe", "Microsoft/Edge/Application/msedge.exe"):
                candidate = Path(root, relative)
                if candidate.is_file():
                    return str(candidate)
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
          return {duplicateIds: ids.filter((id, index) => ids.indexOf(id) !== index), unnamedButtons, unnamedLinks, unlabeledControls};
        }
        """
    )
    assert not audit["duplicateIds"]
    assert audit["unnamedButtons"] == 0
    assert audit["unnamedLinks"] == 0
    assert audit["unlabeledControls"] == 0


def no_js_one_page(browser) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 900}, java_script_enabled=False)
    install_static_route(context)
    page = context.new_page()
    page.goto("http://fde.test/index.html", wait_until="domcontentloaded")
    body = page.locator("body").inner_text()
    for text in [
        "Frontier Decision Engine",
        "How it works",
        "Bring the whole mess.",
        "provisional Decision Map",
        "Six stages:",
        "frame the decision",
        "define what matters",
        "define choices",
        "test plausible futures",
        "compare outcomes",
        "record the human decision",
        "Human authority",
        "stays in this browser",
    ]:
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


# remainder of file unchanged
