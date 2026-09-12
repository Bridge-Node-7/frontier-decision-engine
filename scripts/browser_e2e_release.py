#!/usr/bin/env python3
"""Release wrapper for the retained browser E2E suite with the v0.3.3 root-route contract."""
from __future__ import annotations

import browser_e2e as suite


def route_suite(page, base: str) -> None:
    checks = [
        ("/", '[data-surface="fde-hero"] h1', "What are you considering?"),
        ("/method", '[data-surface="integrated-method"]', "Frame"),
        ("/decision", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
        ("/decision/open", '[data-surface="fde-hero"] h1', "Frontier Decision Engine"),
    ]
    for route_path, selector, expected in checks:
        suite.route(page, base, route_path, selector, expected)


if __name__ == "__main__":
    suite.route_suite = route_suite
    suite.main()
