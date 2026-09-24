#!/usr/bin/env python3
"""Release wrapper for the retained browser E2E suite with the v0.3.3 root-route contract."""
from __future__ import annotations

import browser_e2e as suite


def route_suite(page, base: str) -> None:
    checks = [
        ("/", '[data-surface="fde-hero"] h1', "What are you considering?"),
        ("/method", '[data-surface="integrated-method"]', "Frame"),
        ("/decision", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
        ("/decision/new", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
        ("/decision/example", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
        ("/decision/open", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
        ("/context", '.governed-context-hero h1', "Open governed Mission Graph context"),
        ("/framing", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
    ]
    for route_path, selector, expected in checks:
        suite.route(page, base, route_path, selector, expected)


def no_js_one_page(browser) -> None:
    context = browser.new_context(viewport={"width": 1280, "height": 900}, java_script_enabled=False)
    suite.install_static_route(context)
    page = context.new_page()
    page.goto("http://fde.test/index.html", wait_until="domcontentloaded")
    body = page.locator("body").inner_text()
    for text in [
        "Bridge Node 7",
        "Frontier Decision Engine",
        "How it works",
        "Decision Lab",
        "Appearance",
        "What are you considering?",
        "Share the situation, decision, question, or context in your own words.",
        "Advanced paths",
        "Private by design. Your working decision stays in this browser unless you choose to export it.",
        "Human authority",
        "FDE structures and calculates; it does not approve or authorize the decision.",
        "confidential or controlled information",
    ]:
        assert text in body
    for removed in ["Bring the whole mess", "Decision Map", "Find the decision"]:
        assert removed not in body
    assert page.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
    context.close()
    print("no-js-one-page-fallback: PASS")


if __name__ == "__main__":
    suite.route_suite = route_suite
    suite.no_js_one_page = no_js_one_page
    suite.main()
