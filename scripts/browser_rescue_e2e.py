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
DECISION_KEY = "fde.decision.autosave.v0.2.11"
RECORD_KEY = "fde.decision.record.v0.3.1"
RESCUE_SESSION_KEY = "fde.rescue.session.v1"


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


def assert_handoff(page) -> None:
    page.locator('#decision-question').wait_for(state='visible')
    assert page.locator('#decision-question').input_value() == 'Should we move now or test first?'
    assert page.locator('input[id^="objective-label-"]').count() == 2
    assert page.locator('input[id^="strategy-label-"]').count() == 2
    assert page.locator('input[id^="scenario-label-"]').count() == 2
    assert page.locator('#objective-label-0').input_value() == 'Time'
    assert page.locator('#objective-label-1').input_value() == 'Reliability'
    assert page.locator('#strategy-label-0').input_value() == 'Keep things as they are'
    assert page.locator('#strategy-label-1').input_value() == 'Test or pilot first'
    assert page.locator('#scenario-label-0').input_value() == 'Things stay roughly the same'
    assert page.locator('#scenario-label-1').input_value() == 'A key dependency fails'
    assert page.locator('.rescue-starting-context').is_visible()
    assert 'not scored or treated as evidence' in page.locator('.rescue-starting-context').inner_text()


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
                    assert page.locator('#rescue-intake').get_attribute('aria-describedby') == 'rescue-intake-help'
                    assert page.locator('#rescue-status').count() == 1
                    assert not page.locator('#rescue-status').is_visible()
                    assert page.locator('#rescue-start').bounding_box()["height"] >= 44
                    assert page.locator('html').evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

                    page.locator('#rescue-start').click()
                    page.locator('#rescue-status').wait_for(state='visible')
                    empty_status = page.locator('#rescue-status').inner_text().strip()
                    assert empty_status, 'empty intake must produce a visible, useful status message'

                    messy = '<script>alert("no")</script> Supplier is late 🚀 and I do not know what to do.'
                    page.locator('#rescue-intake').fill(messy)
                    page.locator('#rescue-start').click()
                    assert page.locator('#rescue-question').inner_text() == 'What would help most?'
                    assert messy in page.locator('.rescue-starting-point').inner_text()
                    assert page.locator('script').filter(has_text='alert("no")').count() == 0
                    continue_button = page.get_by_role('button', name='Continue →')
                    assert continue_button.get_attribute('aria-describedby') == 'rescue-next-hint'
                    assert continue_button.is_disabled()
                    focus_box = page.locator('.rescue-focus').bounding_box()
                    frame_box = page.locator('.rescue-frame').bounding_box()
                    assert focus_box and frame_box and focus_box['y'] < frame_box['y'], 'mobile prompt must appear before accumulated frame'

                    page.get_by_role('button', name="I'm not sure").first.click()
                    page.get_by_role('button', name='Continue →').click()
                    assert 'If one choice had to be made first' in page.locator('#rescue-question').inner_text()
                    assert page.locator('#rescue-question').bounding_box()['y'] < 844
                    for _ in range(4):
                        page.locator('[data-rescue-skip]').click()
                    assert 'taking shape' in page.locator('#rescue-question').inner_text()
                    assert page.locator('#rescue-open-lab').is_disabled()
                    assert 'No recommendation has been made' in page.locator('body').inner_text()
                    assert not remote_requests, f"Decision Rescue made unexpected remote requests: {remote_requests}"
                    context.close()

                    recovery = browser.new_context(viewport={"width": 390, "height": 844})
                    recovery_page = recovery.new_page()
                    recovery_page.goto(base, wait_until='networkidle')
                    recovery_page.locator('#rescue-intake').fill('Refresh should not erase this starting point.')
                    recovery_page.locator('#rescue-start').click()
                    recovery_page.get_by_role('button', name='Figure out what I need to decide').click()
                    recovery_page.get_by_role('button', name='Continue →').click()
                    recovery_page.locator('#rescue-decision').fill('Should we proceed now?')
                    assert recovery_page.evaluate(f"Boolean(sessionStorage.getItem('{RESCUE_SESSION_KEY}'))")
                    recovery_page.reload(wait_until='networkidle')
                    assert recovery_page.locator('#rescue-decision').input_value() == 'Should we proceed now?'
                    assert 'Refresh should not erase this starting point.' in recovery_page.locator('.rescue-starting-point').inner_text()
                    recovery.close()

                    handoff = browser.new_context(viewport={"width": 390, "height": 844})
                    handoff_page = handoff.new_page()
                    handoff_page.goto(base, wait_until='networkidle')
                    complete_frame(handoff_page)
                    handoff_page.locator('#rescue-open-lab').click()
                    handoff_page.wait_for_load_state('networkidle')
                    assert_handoff(handoff_page)
                    assert 'Saved in this browser' in handoff_page.locator('body').inner_text()
                    handoff.close()

                    collision = browser.new_context(viewport={"width": 390, "height": 844})
                    collision_page = collision.new_page()
                    collision_page.goto(base, wait_until='networkidle')
                    collision_page.evaluate(f"localStorage.setItem('{DECISION_KEY}', JSON.stringify({{sentinel:'keep-me'}})); localStorage.setItem('{RECORD_KEY}', 'keep-record');")
                    complete_frame(collision_page)
                    collision_page.locator('#rescue-open-lab').click()
                    assert collision_page.locator('.rescue-collision').is_visible()
                    assert collision_page.evaluate(f"localStorage.getItem('{DECISION_KEY}')") == '{"sentinel":"keep-me"}'
                    assert collision_page.evaluate(f"localStorage.getItem('{RECORD_KEY}')") == 'keep-record'
                    collision_page.get_by_role('button', name='Replace saved browser draft and continue').click()
                    collision_page.wait_for_load_state('networkidle')
                    assert_handoff(collision_page)
                    assert collision_page.evaluate(f"localStorage.getItem('{RECORD_KEY}')") is None
                    collision.close()

                    blocked = browser.new_context(viewport={"width": 390, "height": 844})
                    blocked.add_init_script("Storage.prototype.setItem = function(){ throw new Error('blocked by test'); };")
                    blocked_page = blocked.new_page()
                    blocked_page.goto(base, wait_until="networkidle")
                    complete_frame(blocked_page)
                    blocked_page.locator('#rescue-open-lab').click()
                    blocked_page.locator('#rescue-status').wait_for(state='visible')
                    assert 'Autosave unavailable' in blocked_page.locator('#rescue-status').inner_text()
                    assert 'Decision Frame is ready' in blocked_page.locator('#rescue-question').inner_text()
                    blocked.close()

                    theme = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme='light')
                    theme_page = theme.new_page()
                    theme_page.goto(base, wait_until='networkidle')
                    assert theme_page.locator('html').get_attribute('data-theme') == 'light'
                    assert theme_page.locator('html').get_attribute('data-theme-preference') == 'system'
                    toggle = theme_page.locator('#theme-toggle')
                    assert toggle.inner_text() in toggle.get_attribute('aria-label')
                    danger = theme_page.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--danger').trim()")
                    assert danger.lower() == '#9d3030'
                    theme_page.emulate_media(color_scheme='dark')
                    theme_page.locator('html[data-theme="dark"]').wait_for(state='attached')
                    assert theme_page.locator('html').get_attribute('data-theme-preference') == 'system'
                    toggle.click()
                    assert theme_page.locator('html').get_attribute('data-theme') == 'dark'
                    assert theme_page.locator('html').get_attribute('data-theme-preference') == 'dark'
                    toggle.click()
                    assert theme_page.locator('html').get_attribute('data-theme') == 'light'
                    assert toggle.inner_text() in toggle.get_attribute('aria-label')
                    theme.close()
                finally:
                    browser.close()
        finally:
            server.shutdown()
            thread.join(timeout=5)


if __name__ == '__main__':
    run()
    print('DECISION RESCUE E2E PASS')
