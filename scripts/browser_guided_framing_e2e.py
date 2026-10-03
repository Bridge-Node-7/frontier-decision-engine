#!/usr/bin/env python3
"""First-run browser verification for the Decision-Brief-first FDE experience."""
from __future__ import annotations

import os
from urllib.parse import urlparse

try:
    from playwright.sync_api import sync_playwright
except ImportError as exc:  # pragma: no cover
    raise SystemExit(
        "Browser E2E requires Playwright. Run: node scripts/run-python.mjs -m pip install "
        "-r requirements-dev.txt and node scripts/run-python.mjs -m playwright install chromium"
    ) from exc

from browser_e2e import browser_executable, install_static_route, native_http_available, start_static_server

SESSION_KEY = "fde.universal.session.v2"
OLD_SESSION_KEY = "fde.universal.session.v1"
DECISION_STORAGE_KEY = "fde.decision.v1"


def launch_browser(playwright):
    executable = browser_executable()
    kwargs = {"headless": True}
    if executable:
        kwargs["executable_path"] = executable
    return playwright.chromium.launch(**kwargs)


def reset(page, base: str) -> None:
    page.goto(base, wait_until="networkidle")
    page.evaluate("localStorage.clear(); sessionStorage.clear()")
    page.goto(base, wait_until="networkidle")


def assert_first_view(page) -> None:
    assert page.locator("#universal-title").inner_text() == "What are you considering?"
    field = page.locator("#universal-input")
    assert field.get_attribute("placeholder") == "Type or paste anything relevant…"
    assert page.get_by_role("button", name="Continue").count() == 1
    assert page.get_by_text("Advanced paths", exact=True).count() == 0
    assert page.get_by_text("Share the situation, decision, question, or context in your own words.", exact=True).count() == 0


def assert_brief(page) -> None:
    assert page.locator("#universal-response-title").inner_text() == "Decision brief"
    assert page.locator('[data-fde-field="decision"]').count() == 1
    assert page.locator('[data-fde-field="what_matters"]').count() == 1
    assert page.locator('[data-fde-field="uncertainty"]').count() == 1
    assert page.locator('[data-fde-field="next_useful_move"]').count() == 1
    assert page.locator(".universal-question").count() == 0


def run() -> None:
    server, native_base = start_static_server()
    try:
        with sync_playwright() as playwright:
            browser = launch_browser(playwright)
            try:
                base = native_base
                if not native_http_available(browser, base, attempts=2):
                    base = "http://fde.test/"

                context = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme="dark")
                if base.startswith("http://fde.test"):
                    install_static_route(context)

                remote_requests: list[str] = []
                page = context.new_page()
                allowed_host = urlparse(base).netloc

                def observe_request(request) -> None:
                    parsed = urlparse(request.url)
                    if parsed.scheme in {"http", "https"} and parsed.netloc != allowed_host:
                        remote_requests.append(request.url)

                page.on("request", observe_request)

                reset(page, base)
                assert_first_view(page)
                assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")

                # Clear, supportable input returns value immediately instead of starting a questionnaire.
                clear_input = (
                    "Should we qualify the alternate source or retain the incumbent? "
                    "Schedule risk, resilience, and cost matter. Delay and shortage are possible."
                )
                page.locator("#universal-input").fill(clear_input)
                page.get_by_role("button", name="Continue").click()
                assert_brief(page)
                assert "qualify the alternate source" in page.locator('[data-fde-field="decision"]').inner_text().lower()
                assert page.get_by_role("button", name="Compare options").count() == 1
                assert page.get_by_role("button", name="Refine").count() == 1
                assert page.get_by_role("button", name="Start another").count() == 1

                # Refine returns to the same freeform source context with no new form.
                page.get_by_role("button", name="Refine").click()
                assert_first_view(page)
                assert page.locator("#universal-input").input_value() == clear_input
                page.locator("#universal-input").fill(clear_input + " Technical performance also matters.")
                page.get_by_role("button", name="Continue").click()
                assert_brief(page)
                assert "Technical performance" in page.locator('[data-fde-field="what_matters"]').inner_text()

                # Sparse input still yields a partial brief. No compulsory clarification screen appears.
                page.get_by_role("button", name="Start another").click()
                page.locator("#universal-input").fill("Qualification evidence is incomplete and the mission dependency is unclear.")
                page.get_by_role("button", name="Continue").click()
                assert_brief(page)
                assert "not explicit" in page.locator('[data-fde-field="decision"]').inner_text().lower()
                assert "decision itself" in page.locator('[data-fde-field="uncertainty"]').inner_text().lower()

                # Multiple decisions are preserved rather than forcing a choose-one page.
                page.get_by_role("button", name="Start another").click()
                page.locator("#universal-input").fill(
                    "Should we qualify a second source? Should we redesign around the dependency? "
                    "Should we build strategic inventory?"
                )
                page.get_by_role("button", name="Continue").click()
                assert_brief(page)
                decision_text = page.locator('[data-fde-field="decision"]').inner_text()
                assert "qualify a second source" in decision_text.lower()
                assert "redesign around the dependency" in decision_text.lower()
                assert "build strategic inventory" in decision_text.lower()
                assert "3 decision questions preserved" in page.locator(".universal-preserved").inner_text().lower()

                # Large candidate sets remain preserved before bounded formal comparison.
                page.get_by_role("button", name="Start another").click()
                page.locator("#universal-input").fill(
                    "Choose between Supplier Alpha, Supplier Bravo, an alternate material, a reserve, or subsystem redesign. "
                    "Cost, schedule, resilience, qualification, and compliance matter. Delay and shortage are possible."
                )
                page.get_by_role("button", name="Continue").click()
                assert_brief(page)
                preserved = page.locator(".universal-preserved").inner_text().lower()
                assert "5 possible choices preserved" in preserved
                assert "5 criteria preserved" in preserved

                # Formal depth is voluntary and visible on one surface.
                page.get_by_role("button", name="Compare options").click()
                assert page.locator("#universal-response-title").inner_text() == "Compare options"
                assert page.get_by_text("Options", exact=True).count() >= 1
                assert page.get_by_text("What matters", exact=True).count() >= 1
                assert page.get_by_text("What may change", exact=True).count() >= 1
                assert page.get_by_role("button", name="Open Decision Lab").count() == 1
                # Reduce the preselected choices/criteria to formal limits and provide a second scenario if needed.
                choice_boxes = page.locator('input[name="formal-choice"]')
                for index in range(choice_boxes.count()):
                    choice_boxes.nth(index).set_checked(index < 3)
                goal_boxes = page.locator('input[name="formal-goal"]')
                for index in range(goal_boxes.count()):
                    goal_boxes.nth(index).set_checked(index < 4)
                page.locator("#universal-add-futures").fill("Demand changes")
                page.get_by_role("button", name="Open Decision Lab").click()
                page.wait_for_url("**#/decision")
                page.locator("#decision-work").wait_for(state="visible")
                # Decision Map remains a technical Decision Lab concept, not the first-run surface.
                assert page.locator("#decision-question").input_value().strip()
                assert page.locator(".guided-starting-context").count() == 1

                # Saved-work protection: a new brief may exist without overwriting formal work.
                # Saved-work protection is enforced when a second brief tries to enter Decision Lab.
                page.goto(base, wait_until="networkidle")
                page.locator("#universal-input").fill(
                    "Should we qualify another supplier or retain the incumbent? Cost and reliability matter. Delay and shortage are possible."
                )
                page.get_by_role("button", name="Continue").click()
                assert_brief(page)
                page.get_by_role("button", name="Compare options").click()
                page.locator("#universal-add-futures").fill("Requirements change")
                page.get_by_role("button", name="Open Decision Lab").click()
                assert "saved FDE decision already exists" in page.locator("#universal-response-title").inner_text()
                assert page.get_by_role("link", name="Open Decision Lab").count() == 1

                # Information requests retain the existing no-fabrication boundary.
                page.evaluate("localStorage.clear(); sessionStorage.clear()")
                page.goto(base, wait_until="networkidle")
                page.locator("#universal-input").fill("What is the current spot price of gallium?")
                page.get_by_role("button", name="Continue").click()
                assert "does not retrieve outside facts" in page.locator("#universal-response-title").inner_text().lower()

                # Scope and safety boundaries remain fail-closed before first-run structuring.
                page.get_by_role("button", name="Adjust").click()
                page.locator("#universal-input").fill("Should I cut myself or call someone?")
                page.get_by_role("button", name="Continue").click()
                assert "outside FDE’s comparison scope" in page.locator("#universal-response-title").inner_text()
                assert "988" in page.locator(".universal-boundary").inner_text()

                # Over-length input is rejected without silent truncation.
                page.get_by_role("button", name="Adjust").click()
                page.locator("#universal-input").fill("x" * 12001)
                page.get_by_role("button", name="Continue").click()
                assert page.locator("#universal-input").count() == 1
                assert "longer than FDE can safely structure" in page.locator("#universal-limit").inner_text()

                # sessionStorage recovery retains in-progress source text; old v1 transient state is ignored.
                page.locator("#universal-input").fill("Refresh should preserve this source context.")
                assert page.evaluate(f"Boolean(sessionStorage.getItem('{SESSION_KEY}'))")
                page.evaluate(f"sessionStorage.setItem('{OLD_SESSION_KEY}', JSON.stringify({{'version': 1, 'view': 'question'}}))")
                page.reload(wait_until="networkidle")
                assert page.locator("#universal-input").input_value() == "Refresh should preserve this source context."

                # Mobile/reflow: accepted first view stays operable without page-level horizontal scrolling.
                mobile = browser.new_context(viewport={"width": 375, "height": 812}, color_scheme="dark")
                if base.startswith("http://fde.test"):
                    install_static_route(mobile)
                mobile_page = mobile.new_page()
                mobile_page.goto(base, wait_until="networkidle")
                assert_first_view(mobile_page)
                assert mobile_page.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
                assert mobile_page.get_by_role("button", name="Continue").bounding_box()["height"] >= 44
                mobile.close()

                # Appearance remains operable and honors the browser color_scheme.
                light = browser.new_context(viewport={"width": 1280, "height": 900}, color_scheme="light")
                if base.startswith("http://fde.test"):
                    install_static_route(light)
                light_page = light.new_page()
                light_page.goto(base, wait_until="networkidle")
                assert light_page.locator("html").get_attribute("data-theme") == "light"
                assert light_page.locator("#theme-toggle").inner_text() == "Appearance"
                light.close()

                assert not remote_requests, f"FDE made unexpected remote requests: {remote_requests}"
                context.close()
            finally:
                browser.close()
    finally:
        server.shutdown()


if __name__ == "__main__":
    run()
    print("FIRST-RUN UX E2E PASS")