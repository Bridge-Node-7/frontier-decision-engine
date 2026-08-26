#!/usr/bin/env python3
"""Focused browser verification for the universal FDE response surface."""
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
SESSION_KEY = "fde.universal.session.v1"
DECISION_KEY = "fde.decision.autosave.v0.2.11"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def browser_executable() -> str | None:
    return os.environ.get("CHROME_BIN") or None


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

                    hero = page.locator('[data-surface="fde-hero"]')
                    headline = hero.locator('h1').inner_text()
                    assert headline.startswith('Bring the whole mess. Find the decision.')
                    assert page.title() == 'Frontier Decision Engine'
                    assert page.locator('#universal-input').is_visible()
                    assert page.locator('#universal-input').get_attribute('aria-describedby') == 'universal-help'
                    assert page.locator('#universal-response-title').inner_text()
                    assert page.locator('.universal-surface').is_visible()
                    assert page.locator('#universal-input').bounding_box()['height'] >= 160
                    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

                    page.locator('#universal-analyze').click()
                    page.locator('#universal-status').wait_for(state='attached')
                    assert page.locator('#universal-response-title').inner_text()
                    assert page.get_by_text('Most useful next step', exact=True).count() >= 1

                    messy = 'Should we build internally or partner externally? Time and quality matter, but the supplier may be late. <script>alert(1)</script>'
                    page.locator('#universal-input').fill(messy)
                    page.locator('#universal-analyze').click()
                    assert 'decision forming' in page.locator('#universal-response-title').inner_text().lower()
                    assert page.get_by_text('Should we build internally', exact=True).is_visible()
                    assert page.get_by_text('partner externally', exact=True).is_visible()
                    assert page.get_by_text('Time', exact=True).is_visible()
                    assert page.get_by_text('Quality', exact=True).is_visible()
                    assert page.get_by_text('Timing gets worse', exact=True).is_visible()
                    assert page.get_by_text('Possible is not confirmed.', exact=True).is_visible()
                    assert page.locator('script').filter(has_text='alert(1)').count() == 0
                    assert page.locator('#universal-confirm').count() == 0
                    assert page.get_by_role('link', name='Help me shape the missing pieces →').is_visible()

                    first_remove = page.locator('[data-remove-kind="choices"]').first
                    assert first_remove.is_visible()
                    first_remove.click()
                    assert page.locator('[data-remove-kind="choices"]').count() == 1
                    assert 'Updated. Review the map' in page.locator('#universal-next-title').locator('..').inner_text()

                    page.locator('#universal-input').fill('How much does a new MRI machine cost?')
                    page.locator('#universal-analyze').click()
                    assert 'information question' in page.locator('#universal-response-title').inner_text().lower()
                    assert 'does not fetch outside facts' in page.locator('#universal-response-title').locator('..').inner_text()

                    page.locator('#universal-input').fill('Should we hire someone? Should we expand next year?')
                    page.locator('#universal-analyze').click()
                    assert 'more than one possible decision' in page.locator('#universal-response-title').inner_text().lower()
                    assert page.locator('#universal-confirm').count() == 0

                    page.locator('#universal-input').fill('Should we build internally or partner externally? Time, quality, and cost matter. The supplier may be late and demand changes.')
                    page.locator('#universal-analyze').click()
                    page.locator('#universal-confirm').wait_for(state='visible')

                    # Saved-work regression / rescue-collision: never silently replace an existing Lab draft.
                    page.evaluate(f"localStorage.setItem('{DECISION_KEY}', JSON.stringify({{sentinel:'keep-me'}}))")
                    page.locator('#universal-confirm').click()
                    assert page.evaluate(f"localStorage.getItem('{DECISION_KEY}')") == '{"sentinel":"keep-me"}'
                    assert 'A saved FDE decision already exists' in page.locator('#universal-next-title').locator('..').inner_text()
                    assert page.url.endswith('/') and '#/decision' not in page.url

                    page.locator('#universal-input').fill('banana moon 777')
                    page.locator('#universal-analyze').click()
                    assert page.locator('#universal-response-title').inner_text()
                    assert page.get_by_text('Most useful next step', exact=True).count() >= 1

                    page.locator('#universal-input').fill('Refresh should not erase this situation.')
                    assert page.evaluate(f"Boolean(sessionStorage.getItem('{SESSION_KEY}'))")
                    page.reload(wait_until='networkidle')
                    assert page.locator('#universal-input').input_value() == 'Refresh should not erase this situation.'

                    page.goto(f'{base}#/rescue', wait_until='networkidle')
                    assert page.locator('#rescue-intake').is_visible()
                    assert 'What’s going on?' in page.locator('#rescue-question').inner_text()

                    assert not remote_requests, f"Universal FDE made unexpected remote requests: {remote_requests}"
                    context.close()

                    theme = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme='light')
                    theme_page = theme.new_page()
                    theme_page.goto(base, wait_until='networkidle')
                    assert theme_page.locator('html').get_attribute('data-theme') == 'light'
                    assert theme_page.locator('html').get_attribute('data-theme-preference') == 'system'
                    theme_page.emulate_media(color_scheme='dark')
                    theme_page.locator('html[data-theme="dark"]').wait_for(state='attached')
                    assert theme_page.locator('html').get_attribute('data-theme-preference') == 'system'
                    theme.close()
                finally:
                    browser.close()
        finally:
            server.shutdown()
            thread.join(timeout=5)


if __name__ == '__main__':
    run()
    print('UNIVERSAL RESPONSE E2E PASS')
