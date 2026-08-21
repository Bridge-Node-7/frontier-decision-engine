#!/usr/bin/env python3
from __future__ import annotations

import contextlib
import functools
import http.server
import math
import os
import re
import socketserver
import threading
import time
from pathlib import Path
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


def browser_executable() -> str | None:
    explicit = os.environ.get("CHROME_BIN")
    if explicit:
        return explicit
    if os.name == "nt":
        roots = [os.environ.get("PROGRAMFILES"), os.environ.get("PROGRAMFILES(X86)"), os.environ.get("LOCALAPPDATA")]
        for root in filter(None, roots):
            for relative in ("Google/Chrome/Application/chrome.exe", "Microsoft/Edge/Application/msedge.exe"):
                candidate = Path(root, relative)
                if candidate.is_file():
                    return str(candidate)
    return None


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


@contextlib.contextmanager
def local_server():
    handler = functools.partial(QuietHandler, directory=str(SITE))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield f"http://127.0.0.1:{server.server_address[1]}/"
        finally:
            server.shutdown()
            thread.join(timeout=5)


def rgba(value: str):
    value = value.strip().lower()
    if value.startswith("#"):
        h = value[1:]
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        if len(h) == 6:
            return tuple(int(h[i:i+2], 16) for i in (0, 2, 4)) + (1.0,)
    m = re.fullmatch(
        r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)",
        value,
    )
    if not m:
        raise AssertionError(f"Unsupported computed color: {value!r}")
    return (float(m[1]), float(m[2]), float(m[3]), float(m[4] or 1))


def composite(fg, bg):
    a = fg[3]
    return tuple(fg[i] * a + bg[i] * (1 - a) for i in range(3)) + (1.0,)


def luminance(color):
    channels = []
    for c in color[:3]:
        x = c / 255
        channels.append(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4)
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)


def assert_menu(page):
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(page.url.split("#")[0], wait_until="networkidle")
    toggle = page.locator("#mobile-menu-toggle")
    assert toggle.is_visible(), "mobile menu toggle is not visible"
    initial = toggle.inner_text().strip()
    toggle.click()
    assert toggle.get_attribute("aria-expanded") == "true"
    assert toggle.inner_text().strip() != initial
    page.keyboard.press("Escape")
    assert toggle.get_attribute("aria-expanded") == "false"
    assert page.evaluate("document.activeElement === document.querySelector('#mobile-menu-toggle')")
    toggle.click()
    page.locator("#primary-navigation a[href='#/method']").click()
    assert toggle.get_attribute("aria-expanded") == "false"
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")


def assert_boundaries(page):
    fixture = page.evaluate("""
    () => {
      const host = document.createElement('section');
      host.id = 'closeout-boundary-fixture';
      host.style.cssText = 'position:fixed;left:4px;bottom:4px;width:340px;padding:16px;background:var(--surface);z-index:99999;display:grid;gap:8px';
      host.innerHTML = `
        <button id="v-button" type="button">Button</button>
        <input id="v-input" aria-label="Input">
        <select id="v-select" aria-label="Select"><option>One</option></select>
        <textarea id="v-textarea" aria-label="Textarea"></textarea>
        <button id="v-menu" class="mobile-menu-toggle" type="button">Menu</button>
        <button id="v-theme" class="theme-toggle" type="button">Theme</button>`;
      document.body.append(host);
      return true;
    }
    """)
    assert fixture
    for theme in ("dark", "light"):
        page.evaluate("(theme) => document.documentElement.dataset.theme = theme", theme)
        for selector in ("#v-button", "#v-input", "#v-select", "#v-textarea", "#v-menu", "#v-theme"):
            data = page.locator(selector).evaluate("""
            el => {
              const e = getComputedStyle(el);
              const p = getComputedStyle(el.parentElement);
              return {border: e.borderTopColor, adjacent: p.backgroundColor, width: e.borderTopWidth};
            }
            """)
            assert float(data["width"].replace("px", "")) >= 1
            border = rgba(data["border"])
            adjacent = rgba(data["adjacent"])
            effective = composite(border, adjacent) if border[3] < 1 else border
            ratio = contrast(effective, adjacent)
            assert ratio >= 3.0, f"{theme} {selector} boundary contrast {ratio:.2f}:1"
    page.evaluate("document.querySelector('#closeout-boundary-fixture').remove()")


def assert_404(page, base):
    target = urljoin(base, "404.html")
    response = page.goto(target, wait_until="networkidle")
    assert response is not None
    assert page.locator("main").count() == 1
    assert page.locator("h1").count() == 1
    assert "Page not found" in page.locator("h1").inner_text()
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
    for href in (
        "/frontier-decision-engine/#/decision",
        "/frontier-decision-engine/",
        "/",
    ):
        assert page.locator(f'a[href="{href}"]').count() == 1


def assert_live_invalid(page, base):
    invalid = urljoin(base, f"invalid-closeout-path-{int(time.time())}")
    page.goto(invalid, wait_until="networkidle")
    assert page.locator("h1").count() == 1
    assert "Page not found" in page.locator("h1").inner_text()
    assert page.locator('a[href="/"]').count() == 1


def main():
    live_base = os.environ.get("FDE_BASE_URL", "").strip()
    with sync_playwright() as p:
        launch_kwargs = {"headless": True}
        executable = browser_executable()
        if executable:
            launch_kwargs["executable_path"] = executable
        browser = p.chromium.launch(**launch_kwargs)
        try:
            if live_base:
                page = browser.new_page(viewport={"width": 390, "height": 844})
                page.goto(live_base, wait_until="networkidle")
                assert_menu(page)
                assert_boundaries(page)
                assert_live_invalid(page, live_base)
                print("LIVE CLOSEOUT REGRESSIONS PASS")
            else:
                with local_server() as base:
                    page = browser.new_page(viewport={"width": 390, "height": 844})
                    page.goto(base, wait_until="networkidle")
                    assert_menu(page)
                    assert_boundaries(page)
                    assert_404(page, base)
                    print("LOCAL CLOSEOUT REGRESSIONS PASS")
        finally:
            browser.close()


if __name__ == "__main__":
    main()
