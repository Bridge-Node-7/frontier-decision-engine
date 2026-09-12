#!/usr/bin/env python3
"""Focused browser verification for the frictionless FDE first-run surface."""
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
RESCUE_SESSION_KEY = "fde.rescue.session.v1"


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

                    assert page.title() == "Frontier Decision Engine"
                    assert page.locator("h1").inner_text() == "What are you considering?"
                    assert page.get_by_text("Share a situation, decision, question, or context in your own words.", exact=True).is_visible()
                    assert page.get_by_role("button", name="Continue").is_visible()
                    assert page.get_by_role("link", name="Already know the decision and options? Open Decision Lab →").is_visible()
                    assert page.get_by_text("Private by design. Your working decision stays in this browser unless you choose to export it.", exact=True).is_visible()
                    assert page.locator("#universal-input").get_attribute("placeholder") == "Decision, question, options, constraints, notes, or other context…"
                    assert page.locator(".universal-surface").count() == 0
                    assert "Decision Map" not in page.locator("main").inner_text()
                    assert "Bring the whole mess" not in page.locator("body").inner_text()
                    assert page.locator("#theme-toggle").inner_text() == "Appearance"
                    assert "Current:" in (page.locator("#theme-toggle").get_attribute("aria-label") or "")
                    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

                    # Sparse input yields one question, not an invalid state or empty structural cards.
                    page.locator("#universal-input").fill("banana moon 777")
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "Which decision or question should we focus on?"
                    assert page.locator("[data-fde-field='next_required_input']").count() == 1
                    assert page.locator("[data-fde-field='decision']").count() == 0
                    assert "Invalid input" not in page.locator("body").inner_text()

                    page.get_by_role("button", name="Adjust original input").click()
                    clear_input = "Should we build internally or partner externally? Time and quality matter, but the supplier may be late. <script>alert(1)</script>"
                    page.locator("#universal-input").fill(clear_input)
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "Decision structure"
                    assert page.get_by_text("Needs confirmation", exact=True).is_visible()
                    assert page.locator("[data-fde-field='decision']").is_visible()
                    assert page.locator("[data-fde-field='what_matters']").is_visible()
                    assert page.locator("[data-fde-field='options']").is_visible()
                    assert page.locator("[data-fde-field='what_may_change']").is_visible()
                    assert page.get_by_text("build internally", exact=True).is_visible()
                    assert page.get_by_text("partner externally", exact=True).is_visible()
                    assert page.get_by_text("Time", exact=True).is_visible()
                    assert page.get_by_text("Quality", exact=True).is_visible()
                    assert page.get_by_text("Timing gets worse", exact=True).is_visible()
                    assert page.locator("script").filter(has_text="alert(1)").count() == 0

                    # Confirmation requests only the next required input.
                    page.get_by_role("button", name="Yes").click()
                    assert page.locator("#universal-response-title").inner_text() == "What else could change the choice?"
                    page.locator("#universal-input").fill("Requirements change")

                    # Saved-work protection: never silently replace a Decision Lab draft.
                    page.evaluate(f"localStorage.setItem('{DECISION_KEY}', JSON.stringify({{sentinel:'keep-me'}}))")
                    page.get_by_role("button", name="Continue").click()
                    assert page.evaluate(f"localStorage.getItem('{DECISION_KEY}')") == '{"sentinel":"keep-me"}'
                    assert page.locator("#universal-response-title").inner_text() == "A saved FDE decision already exists."
                    assert page.get_by_role("link", name="Open Decision Lab →").is_visible()

                    # Information requests receive a capability boundary with a useful next action.
                    page.evaluate(f"localStorage.removeItem('{DECISION_KEY}')")
                    page.goto(base, wait_until="networkidle")
                    page.locator("#universal-input").fill("How much does a new MRI machine cost?")
                    page.get_by_role("button", name="Continue").click()
                    assert "does not retrieve outside facts" in page.locator("#universal-response-title").inner_text().lower()
                    assert "Gather the fact first" in page.locator("main").inner_text()

                    # Ctrl/Cmd + Enter activates Continue.
                    page.get_by_role("button", name="Adjust").click()
                    page.locator("#universal-input").fill("Should we stay or go? Safety and cost matter. Delay and demand changes are possible.")
                    page.locator("#universal-input").press("Control+Enter")
                    assert page.locator("#universal-response-title").inner_text() == "Decision structure"

                    # Refresh preserves in-progress first-run work.
                    page.get_by_role("button", name="Adjust").click()
                    page.locator("#universal-input").fill("Refresh should not erase this situation.")
                    assert page.evaluate(f"Boolean(sessionStorage.getItem('{SESSION_KEY}'))")
                    page.reload(wait_until="networkidle")
                    assert page.locator("#universal-input").input_value() == "Refresh should not erase this situation."

                    # Decision Rescue remains reachable and intact.
                    page.evaluate(f"sessionStorage.removeItem('{RESCUE_SESSION_KEY}')")
                    page.goto(f"{base}#/rescue", wait_until="networkidle")
                    page.locator("#rescue-question").wait_for(state="visible")
                    assert page.locator("#rescue-intake").is_visible()

                    assert not remote_requests, f"FDE made unexpected remote requests: {remote_requests}"
                    context.close()

                    # Appearance follows system, then remains operable in dark mode.
                    theme = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme="light")
                    theme_page = theme.new_page()
                    theme_page.goto(base, wait_until="networkidle")
                    assert theme_page.locator("html").get_attribute("data-theme") == "light"
                    assert theme_page.locator("html").get_attribute("data-theme-preference") == "system"
                    assert theme_page.locator("#theme-toggle").inner_text() == "Appearance"
                    theme_page.emulate_media(color_scheme="dark")
                    theme_page.locator('html[data-theme="dark"]').wait_for(state="attached")
                    assert theme_page.locator("html").get_attribute("data-theme-preference") == "system"
                    assert theme_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
                    theme.close()
                finally:
                    browser.close()
        finally:
            server.shutdown()
            thread.join(timeout=5)


if __name__ == "__main__":
    run()
    print("FIRST-RUN UX E2E PASS")
