#!/usr/bin/env python3
"""Capture reproducible UX evidence from the exact Frontier Decision Engine source."""
from __future__ import annotations

import hashlib
import sys

sys.dont_write_bytecode = True
from pathlib import Path

from browser_e2e import (
    browser_executable,
    install_static_route,
    load_application,
    route,
    sync_playwright,
)

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "docs" / "screenshots" / "v0.2.10"


def prepare_page(browser, viewport: dict[str, int], color_scheme: str):
    context = browser.new_context(
        viewport=viewport,
        color_scheme=color_scheme,
        accept_downloads=True,
        reduced_motion="reduce",
        device_scale_factor=1,
    )
    install_static_route(context)
    page = context.new_page()
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
    return context, page


def advance_decision(page, steps: int) -> None:
    for _ in range(steps):
        page.locator("#decision-next").click()
        page.locator("#decision-step-heading").wait_for(state="visible")
        page.locator("#decision-step-heading:focus").wait_for(state="attached")


def capture(browser) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)

    context, page = prepare_page(browser, {"width": 1440, "height": 1200}, "light")
    route(page, "http://fde.test", "/decision", "#decision-step-heading", "Frame the real decision")
    page.screenshot(path=str(OUTPUT / "desktop-decision-frame.png"), full_page=False)
    advance_decision(page, 5)
    page.screenshot(path=str(OUTPUT / "desktop-decision-brief.png"), full_page=False)
    context.close()

    context, page = prepare_page(browser, {"width": 1440, "height": 1200}, "dark")
    route(page, "http://fde.test", "/decision", "#decision-step-heading", "Frame the real decision")
    advance_decision(page, 4)
    page.screenshot(path=str(OUTPUT / "desktop-stress-test-dark.png"), full_page=False)
    context.close()

    context, page = prepare_page(browser, {"width": 390, "height": 844}, "light")
    route(page, "http://fde.test", "/decision", "#decision-step-heading", "Frame the real decision")
    advance_decision(page, 5)
    page.screenshot(path=str(OUTPUT / "mobile-decision-brief.png"), full_page=False)
    context.close()


def main() -> None:
    executable = browser_executable()
    with sync_playwright() as playwright:
        launch_kwargs = {"headless": True}
        if executable:
            launch_kwargs["executable_path"] = executable
        browser = playwright.chromium.launch(**launch_kwargs)
        try:
            capture(browser)
        finally:
            browser.close()
    print(f"wrote current UX evidence to {OUTPUT}")


if __name__ == "__main__":
    main()
