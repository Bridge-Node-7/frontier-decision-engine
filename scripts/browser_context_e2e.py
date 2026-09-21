#!/usr/bin/env python3
"""Browser verification for Mission Graph governed-context intake and memory-only handoff."""
from __future__ import annotations

import functools
import hashlib
import http.server
import json
import os
import socketserver
import threading
from copy import deepcopy
from pathlib import Path

from playwright.sync_api import sync_playwright

import browser_e2e as shared

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "site"


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def browser_executable() -> str | None:
    return os.environ.get("CHROME_BIN") or None


def _digest(value: dict) -> str:
    canonical = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(canonical).hexdigest()


def packet_fixture() -> dict:
    packet = {
        "schema_version": "0.3.0",
        "packet_id": "DCP-E2E-001",
        "compatibility": "FDE_PREPARATION_ONLY",
        "classification": "PRIVATE",
        "handling": {
            "label": "BN7_PRIVATE",
            "government_classification": False,
            "release_eligible": False,
            "instruction": "BN7 internal preparation context only; not a government classification marking.",
        },
        "freshness": {
            "issued_at": "2026-09-13T17:00:00Z",
            "source_as_of": "2026-09-13T16:00:00Z",
            "review_due_at": "2099-01-01T00:00:00Z",
            "valid_until": "2099-12-31T23:59:59Z",
            "supersedes_packet_id": None,
            "state": "CURRENT",
        },
        "integrity": {
            "payload_sha256": "0" * 64,
            "envelope_sha256": "0" * 64,
            "payload_scope": "decision-relevant packet content excluding integrity, origin, freshness, and provenance",
            "envelope_scope": "packet excluding the envelope digest field and origin.attestation_ref",
        },
        "origin": {
            "authentication_state": "UNAUTHENTICATED",
            "issuer_ref": "mission-graph:MG-E2E-001",
            "attestation_ref": None,
        },
        "evidence_assurance": {
            "state": "REVIEW_REQUIRED",
            "limitations": ["synthetic unresolved evidence remains"],
        },
        "source_graph_id": "MG-E2E-001",
        "question": "Which pathway should the accountable human review?",
        "decision_owner": "Human Owner",
        "evidence_summary": {
            "known": ["E-1: Direct observation"],
            "assumed": ["E-2: Planning assumption"],
            "unknown": ["E-3: Capacity remains unknown"],
            "contradicted": ["E-4: Sources conflict"],
            "expired": ["E-5: Prior observation is stale"],
        },
        "critical_unknowns": ["PR-1: Verify current capacity"],
        "candidate_pathways": [],
        "shared_failure_domains": [],
        "false_redundancy_pairs": [],
        "proof_requests": [
            {
                "proof_request_id": "PR-1",
                "question": "Verify current capacity",
                "human_owner": "Human Owner",
                "status": "DRAFT",
            }
        ],
        "attention_queue": [],
        "conditions_to_watch": ["Supplier status changes"],
        "provenance": {
            "source_record_id": "CLM-E2E-001",
            "source_record_sha256": "a" * 64,
            "model_type": "evidence-bound interoperability context",
            "probability_model_used": False,
            "values_are_analyst_assigned": False,
            "fde_recorded_decision": False,
        },
    }
    payload = deepcopy(packet)
    for key in ("integrity", "origin", "freshness", "provenance"):
        payload.pop(key, None)
    packet["integrity"]["payload_sha256"] = _digest(payload)
    envelope = deepcopy(packet)
    envelope["integrity"].pop("envelope_sha256", None)
    envelope["origin"].pop("attestation_ref", None)
    packet["integrity"]["envelope_sha256"] = _digest(envelope)
    return packet


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
                    for width in (1366, 1280):
                        layout_context = browser.new_context(viewport={"width": width, "height": 900})
                        layout_page = layout_context.new_page()
                        layout_page.goto(f"{base}#/context", wait_until="networkidle")
                        shared.assert_page_clean(layout_page)
                        layout_context.close()

                    context = browser.new_context(viewport={"width": 1280, "height": 900})
                    remote_requests: list[str] = []
                    context.on("request", lambda request: remote_requests.append(request.url) if not request.url.startswith(base) else None)
                    page = context.new_page()
                    page.goto(f"{base}#/context", wait_until="networkidle")

                    assert page.title() == "Governed Context | Frontier Decision Engine"
                    assert page.get_by_role("heading", name="Open governed Mission Graph context").is_visible()
                    assert page.get_by_text("No upload occurs. The file is read only by this browser page.", exact=True).is_visible()
                    assert page.get_by_text("BN7 PRIVATE/PROTECTED are internal handling labels, not U.S. Government classification markings.", exact=False).is_visible()

                    packet = packet_fixture()
                    raw = json.dumps(packet, ensure_ascii=False).encode("utf-8")
                    page.locator("#mission-context-file").set_input_files(
                        {"name": "decision-context.json", "mimeType": "application/json", "buffer": raw}
                    )
                    page.get_by_text("Integrity VERIFIED", exact=True).wait_for(state="visible")
                    assert page.get_by_text("Origin UNAUTHENTICATED", exact=True).is_visible()
                    assert page.get_by_text("Freshness CURRENT", exact=True).is_visible()
                    assert page.get_by_role("heading", name="Trust state").is_visible()
                    assert page.get_by_role("heading", name="What we know").is_visible()
                    assert page.get_by_text("E-1: Direct observation", exact=True).is_visible()
                    assert page.get_by_role("heading", name="What remains assumed").is_visible()
                    assert page.get_by_text("E-2: Planning assumption", exact=True).is_visible()
                    assert page.get_by_role("heading", name="What is disputed").is_visible()
                    assert page.get_by_text("E-4: Sources conflict", exact=True).is_visible()
                    assert page.get_by_role("heading", name="What we do not know").is_visible()
                    assert page.get_by_role("heading", name="What needs proof").is_visible()
                    assert page.get_by_text("Supplier status changes", exact=True).is_visible()
                    shared.assert_page_clean(page)

                    lineage = page.locator("details").filter(has_text="Show me why")
                    assert lineage.get_attribute("open") is None
                    page.get_by_text("Show me why", exact=True).click()
                    assert lineage.get_attribute("open") is not None
                    assert "DCP-E2E-001" in lineage.inner_text()
                    assert "Envelope SHA-256" in lineage.inner_text()

                    open_button = page.get_by_role("button", name="Open Decision Lab with this context")
                    assert open_button.is_enabled()
                    open_button.click()
                    page.get_by_text("Verified Mission Graph preparation context", exact=True).wait_for(state="visible")
                    assert "DCP-E2E-001" not in page.evaluate("JSON.stringify(Object.fromEntries(Object.entries(localStorage)))")
                    assert "DCP-E2E-001" not in page.evaluate("JSON.stringify(Object.fromEntries(Object.entries(sessionStorage)))")
                    assert page.get_by_text("Memory-only preparation context — not autosaved, scored, treated as evidence, or recorded as the decision.", exact=True).is_visible()

                    page.reload(wait_until="networkidle")
                    assert "Verified Mission Graph preparation context" not in page.locator("body").inner_text()
                    assert not remote_requests, f"FDE made unexpected remote requests: {remote_requests}"
                    context.close()
                finally:
                    browser.close()
        finally:
            server.shutdown()
            thread.join(timeout=5)


if __name__ == "__main__":
    run()
    print("GOVERNED CONTEXT E2E PASS")
