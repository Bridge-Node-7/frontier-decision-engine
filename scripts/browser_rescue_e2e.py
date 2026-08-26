#!/usr/bin/env python3
"""Focused browser verification for the human-first Decision Rescue entry."""
from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def browser_executable() -> str | None:
    explicit = os.environ.get("CHROME_BIN")
    if explicit:
        return explicit
    return None


def complete_frame(page) -> None:
    page.locator('#rescue-intake').fill('We need to decide whether to move now or test first.')
    page.locator('#rescue-start').click()
    page.get_by_role('button', name='Compare choices I already have').click()
    page.get_by_role('button', name='Continue →').click()
    page.locator('#rescue-decision').fill('Should we move now or test first?')
    page.get_by_role('button', name='Continue →').click()
    page.get_by_role('button', name='Time').click()
    assert page.evaluate("document.activeElement?.textContent.trim()") == 'Time'
    page.get_by_role('button', name='Reliability').click()
    page.get_by_role('button', name='Continue →').click()
    page.get_by_role('button', name='Keep things as they are').click()
    page.get_by_role('button', name='Test or pilot first').click()
    page.get_by_role('button', name='Continue →').click()
    page.get_by_role('button', name='Things stay roughly the same').click()
    page.get_by_role('button', name='A key dependency fails').click()
    page.get_by_role('button', name='Build my Decision Frame →').click()
    assert 'Decision Frame is ready' in page.locator('#rescue-question').inner_text()
    assert page.locator('#rescue-open-lab').is_enabled()


def run() -> None:
    handler = functools.partial(QuietHandler, directory=str(SITE))
    with socketserver.TCPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        base = f"http://127.0.0.1:{server.server_address[1]}/"
        try:
            with sync_playwright() as p:
                launch = {"headless": True}
                executable = browser_executable()
                if executable:
                    launch["executable_path"] = executable
                browser = p.chromium.launch(**launch)
                try:
                    context = browser.new_context(viewport={"width": 390, "height": 844})
                    remote_requests: list[str] = []
                    context.on("request", lambda request: remote_requests.append(request.url) if not request.url.startswith(base) else None)
                    page = context.new_page()
                    page.goto(base, wait_until="networkidle")

                    assert page.locator('main h1').inner_text() == 'Frontier Decision Engine'
                    assert page.locator('#rescue-intake').is_visible()
                    assert page.locator('#rescue-start').bounding_box()["height"] >= 44
                    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

                    page.locator('#rescue-start').click()
                    assert 'few words' in page.locator('[role="alert"]').inner_text().lower()

                    messy = '<script>alert("no")</script> Supplier is late 🚀 and I do not know what to do.'
                    page.locator('#rescue-intake').fill(messy)
                    page.locator('#rescue-start').click()
                    assert page.locator('#rescue-question').inner_text() == 'What would help most?'
                    assert messy in page.locator('.rescue-starting-point').inner_text()
                    assert page.locator('script').filter(has_text='alert("no")').count() == 0

                    page.get_by_role('button', name="I'm not sure").first.click()
                    page.get_by_role('button', name='Continue →').click()
                    assert 'If one choice had to be made first' in page.locator('#rescue-question').inner_text()
                    for _ in range(4):
                        page.locator('[data-rescue-skip]').click()
                    assert 'taking shape' in page.locator('#rescue-question').inner_text()
                    assert page.locator('#rescue-open-lab').is_disabled()
                    assert 'No recommendation has been made' in page.locator('body').inner_text()

                    page.goto(base, wait_until="networkidle")
                    complete_frame(page)
                    page.locator('#rescue-open-lab').click()
                    page.wait_for_load_state('networkidle')
                    page.locator('#decision-question').wait_for(state='visible')
                    assert page.locator('#decision-question').input_value() == 'Should we move now or test first?'
                    assert page.locator('[id^="objective-label-"]').count() == 2
                    assert page.locator('[id^="strategy-label-"]').count() == 2
                    assert page.locator('[id^="scenario-label-"]').count() == 2
                    assert page.locator('#objective-label-0').input_value() == 'Time'
                    assert page.locator('#objective-label-1').input_value() == 'Reliability'
                    assert page.locator('#strategy-label-0').input_value() == 'Keep things as they are'
                    assert page.locator('#strategy-label-1').input_value() == 'Test or pilot first'
                    assert page.locator('#scenario-label-0').input_value() == 'Things stay roughly the same'
                    assert page.locator('#scenario-label-1').input_value() == 'A key dependency fails'
                    assert 'Saved in this browser' in page.locator('body').inner_text()

                    assert not remote_requests, f"Decision Rescue made unexpected remote requests: {remote_requests}"
                    context.close()

                    blocked = browser.new_context(viewport={"width": 390, "height": 844})
                    blocked.add_init_script("Storage.prototype.setItem = function(){ throw new Error('blocked by test'); };")
                    blocked_page = blocked.new_page()
                    blocked_page.goto(base, wait_until="networkidle")
                    complete_frame(blocked_page)
                    blocked_page.locator('#rescue-open-lab').click()
                    assert blocked_page.locator('#rescue-status').is_visible()
                    assert 'Autosave unavailable' in blocked_page.locator('#rescue-status').inner_text()
                    assert 'Decision Frame is ready' in blocked_page.locator('#rescue-question').inner_text()
                    blocked.close()
                finally:
                    browser.close()
        finally:
            server.shutdown()
            thread.join(timeout=5)


if __name__ == '__main__':
    run()
    print('DECISION RESCUE E2E PASS')
