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
GUIDED_SESSION_KEY = "fde.guided-framing.session.v1"


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
                    assert page.get_by_text("Share a technical, organizational, mission, or strategic decision in your own words.", exact=True).is_visible()
                    assert page.get_by_role("button", name="Continue").is_visible()
                    assert page.get_by_role("link", name="Already know the decision and choices? Open Decision Lab →").is_visible()
                    assert page.get_by_role("link", name="Need more help framing the decision? Use guided framing →").is_visible()
                    assert page.get_by_text("Private by design. Your working decision stays in this browser unless you choose to export it.", exact=True).is_visible()
                    assert page.locator("#universal-input").get_attribute("placeholder") == "Decision, choices, criteria, uncertainties, notes, or context…"
                    assert page.locator(".universal-surface").count() == 0
                    assert "Decision Map" not in page.locator("main").inner_text()
                    assert "Bring the whole mess" not in page.locator("body").inner_text()
                    assert page.locator("#theme-toggle").inner_text() == "Appearance"
                    assert "Current:" in (page.locator("#theme-toggle").get_attribute("aria-label") or "")
                    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

                    # Sparse input yields one question, not an invalid state or empty structural cards.
                    page.locator("#universal-input").fill("qualification evidence incomplete")
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "Which decision or question should we focus on?"
                    assert page.locator("[data-fde-field='next_required_input']").count() == 1
                    assert page.locator("[data-fde-field='decision']").count() == 0
                    assert "Invalid input" not in page.locator("body").inner_text()

                    page.get_by_role("button", name="Adjust original input").click()
                    clear_input = "Should we qualify an alternate source or redesign around the dependency? Schedule risk and resilience matter, but qualification may be late. <script>alert(1)</script>"
                    page.locator("#universal-input").fill(clear_input)
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "Decision structure"
                    assert page.get_by_text("Needs confirmation", exact=True).is_visible()
                    assert page.locator("[data-fde-field='decision']").is_visible()
                    assert page.locator("[data-fde-field='what_matters']").is_visible()
                    assert page.locator("[data-fde-field='options']").is_visible()
                    assert page.locator("[data-fde-field='what_may_change']").is_visible()
                    assert page.get_by_text("qualify an alternate source", exact=True).is_visible()
                    assert page.get_by_text("redesign around the dependency", exact=True).is_visible()
                    assert page.get_by_text("Schedule risk", exact=True).is_visible()
                    assert page.get_by_text("Resilience", exact=True).is_visible()
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

                    # A completely new decision entered during a follow-up must not inherit
                    # criteria or options from the abandoned decision.
                    page.evaluate(f"localStorage.removeItem('{DECISION_KEY}')")
                    page.evaluate(f"sessionStorage.removeItem('{SESSION_KEY}')")
                    page.goto(base, wait_until="networkidle")
                    diligence_input = "Should we qualify a second gallium nitride wafer supplier in Japan or keep our current Chinese supplier? We care about cost, schedule risk, and DFARS compliance."
                    page.locator("#universal-input").fill(diligence_input)
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "Decision structure"
                    assert page.get_by_text("Cost", exact=True).is_visible()
                    assert page.get_by_text("Schedule risk", exact=True).is_visible()
                    assert page.get_by_text("Compliance", exact=True).is_visible()
                    page.get_by_role("button", name="Yes").click()
                    assert page.locator("#universal-response-title").inner_text() == "What conditions or uncertainties could change the choice?"
                    page.locator("#universal-input").fill("Should we retire the legacy test stand?")
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "Decision structure"
                    assert page.get_by_text("Should we retire the legacy test stand", exact=True).is_visible()
                    current_text = page.locator("main").inner_text()
                    assert "Cost" not in current_text
                    assert "Schedule risk" not in current_text
                    assert "Compliance" not in current_text
                    assert "Japanese supplier" not in current_text
                    assert "Chinese supplier" not in current_text

                    # Information-request UAT is a separate first-run scenario. Clear only the
                    # tab-scoped intake session; the persistence behavior itself is tested below.
                    page.evaluate(f"localStorage.removeItem('{DECISION_KEY}')")
                    page.evaluate(f"sessionStorage.removeItem('{SESSION_KEY}')")
                    page.goto(base, wait_until="networkidle")
                    page.locator("#universal-input").fill("What is the current spot price of gallium?")
                    page.get_by_role("button", name="Continue").click()
                    assert "does not retrieve outside facts" in page.locator("#universal-response-title").inner_text().lower()
                    assert "Gather the fact first" in page.locator("main").inner_text()

                    # High-risk personal input fails closed before ordinary decision structuring.
                    page.evaluate(f"localStorage.removeItem('{DECISION_KEY}')")
                    page.evaluate(f"sessionStorage.removeItem('{SESSION_KEY}')")
                    page.goto(base, wait_until="networkidle")
                    page.locator("#universal-input").fill("Should I hurt myself or not?")
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "This decision is outside FDE’s comparison scope."
                    assert "does not compare or optimize self-harm" in page.locator("main").inner_text()

                    # Mission-focused criteria remain choices/criteria, not an ambiguous option list.
                    page.evaluate(f"sessionStorage.removeItem('{SESSION_KEY}')")
                    page.goto(base, wait_until="networkidle")
                    page.locator("#universal-input").fill("Should we impose export controls or negotiate supply agreements with allies? National security, cost, and time matter.")
                    page.get_by_role("button", name="Continue").click()
                    assert page.locator("#universal-response-title").inner_text() == "Decision structure"
                    assert page.get_by_text("National security", exact=True).is_visible()
                    assert page.get_by_text("Cost", exact=True).is_visible()
                    assert page.get_by_text("Time", exact=True).is_visible()
                    assert page.get_by_text("impose export controls", exact=True).is_visible()
                    assert page.get_by_text("negotiate supply agreements with allies", exact=True).is_visible()

                    # Ctrl/Cmd + Enter activates Continue.
                    page.get_by_role("button", name="Adjust").click()
                    page.locator("#universal-input").fill("Should we qualify the alternate source or hold for evidence? Mission safety and cost exposure matter. Schedule slips and demand changes are possible.")
                    page.locator("#universal-input").press("Control+Enter")
                    assert page.locator("#universal-response-title").inner_text() == "Decision structure"

                    # Refresh preserves in-progress first-run work.
                    page.get_by_role("button", name="Adjust").click()
                    page.locator("#universal-input").fill("Refresh should not erase this qualification context.")
                    assert page.evaluate(f"Boolean(sessionStorage.getItem('{SESSION_KEY}'))")
                    page.reload(wait_until="networkidle")
                    assert page.locator("#universal-input").input_value() == "Refresh should not erase this qualification context."

                    # Guided framing remains reachable and intact.
                    page.evaluate(f"sessionStorage.removeItem('{GUIDED_SESSION_KEY}')")
                    page.goto(f"{base}#/framing", wait_until="networkidle")
                    page.locator("#guided-question").wait_for(state="visible")
                    assert page.locator("#guided-intake").is_visible()

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
