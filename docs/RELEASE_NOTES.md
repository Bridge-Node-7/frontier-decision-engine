# v0.5.6

Application version is 0.5.6.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This bounded pilot-readiness release adds explicit decision-authority routing, SHA-256 Decision Receipt v2 integrity, human attestation, deterministic evidence-readiness gating, explicit residual-uncertainty acceptance, independent-review receipt output, and public/sanitized handling guidance.

Legacy v1 FNV-1a records remain readable as change-detection records and are never relabeled as cryptographic receipts. The Decision Case and scoring model are not replaced. Advisors can frame and compare but cannot record an accountable-owner receipt; recording a human decision does not mean organizational approval or execution authorization.

The public application remains browser-local with no backend, account system, analytics, telemetry, remote AI provider, or default upload endpoint. Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only. Human judgment remains authoritative.
