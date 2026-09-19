# Frontier Decision Engine

**Trustworthy decision infrastructure for choices under deep uncertainty.**

[Open the live application](https://bridgenode7.com/frontier-decision-engine/)

![Frontier Decision Engine Decision Lab reference](docs/screenshots/reference/desktop-decision-frame.png)

*Stable Decision Lab reference surface. The public root begins with a single natural-language decision input before any formal comparison.*

## Start with one input

The first screen asks one question: **What are you considering?**

Share a situation, decision, question, options, constraints, notes, or other context in your own words. **Natural-language intake currently supports English.** FDE then does one of three things:

- shows only decision structure that is supportable from the words provided;
- asks exactly one useful clarification question when the decision is still too sparse; or
- states an honest capability boundary and a useful next action when the request is outside the browser-local decision-support scope.

Supportable first-run structure uses four human-facing concepts: **Decision, What matters, Options, What may change.** Nothing inferred becomes a canonical model input until a person confirms it.

The browser does not call a remote AI provider, retrieve outside facts, invent evidence, probabilities, scores, thresholds, scenario effects, or recommendations.

## Governed Mission Graph context

The **Governed context** route accepts Mission Graph Decision Context Packet 0.3.0 for `FDE_PREPARATION_ONLY` use. FDE verifies payload and envelope SHA-256 integrity locally while keeping **integrity, origin, evidence assurance, freshness, and human authority** as separate trust properties.

Only PRIVATE or PROTECTED packets with explicit non-release handling are accepted. A self-asserted authenticated origin is rejected unless a future external trust-policy verifier can independently establish it; a valid digest proves integrity, not authorship. Future-dated context fails closed. Review-due, expired, or freshness-not-established context remains inspectable but cannot enter active decision preparation. Legacy Decision Context Packet 0.2.0 remains inspection-only and is never silently upgraded to current trust semantics.

Accepted context stays in JavaScript page memory only and is discarded on refresh; it is not placed in normal browser autosave or silently promoted into the canonical decision model. Source lineage and packet identity remain behind **Show me why**. The accountable human remains the decision authority.

## Decision Lab

After confirmation, FDE asks only for the additional explicit inputs required for a deterministic comparison. The formal Decision Lab preserves the existing ranking semantics, published schemas, saved-work protections, and truthful alternate outcomes including ties, no acceptable option, and insufficient information.

The comparison informs. A person decides.

## Assurance on demand

Technical users can inspect the underlying inputs, assumptions, evidence state, uncertainty, thresholds, scenario effects, calculations, provenance, and decision record without forcing that depth into the first-run experience.

Technical documentation and exports may still use Decision Map and decision-science terminology where those terms improve precision; first-time users do not need to learn that vocabulary before receiving value.

## Synthetic reference

The repository includes a synthetic critical-material source-qualification case to demonstrate the formal Decision Lab without making claims about a real supplier, material, capacity, compliance status, investment, or forecast.

## Privacy and authority

The application is static and browser-local. It has no backend, account system, analytics, telemetry, cookies, remote AI provider, or default upload endpoint. Session recovery and browser autosave are convenience features for ordinary FDE drafts, not encrypted confidential storage. Governed Mission Graph context uses a separate memory-only path.

FDE provides decision support. It does not approve, authorize, certify, qualify, consent, authenticate unsigned evidence, or make an investment or other consequential decision. Human final decision authority is preserved.

## Verify

Requirements: Node.js 22+, Python 3.11+, and Chromium or Google Chrome.

macOS / Linux:

```bash
node scripts/run-python.mjs -m venv .venv
source .venv/bin/activate
node scripts/run-python.mjs -m pip install -r requirements-dev.txt
node scripts/run-python.mjs -m playwright install chromium
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

Windows PowerShell:

```powershell
node scripts/run-python.mjs -m venv .venv
.\.venv\Scripts\Activate.ps1
node scripts/run-python.mjs -m pip install -r requirements-dev.txt
node scripts/run-python.mjs -m playwright install chromium
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

Generated release facts and current application identity are recorded in [`project-facts.json`](project-facts.json). The full verification gate is defined by the repository's `npm run check` command.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Methodology](docs/METHODOLOGY.md)
- [Privacy](docs/PRIVACY.md)
- [Releasing](docs/RELEASING.md)

## Project

Changes must preserve human decision authority, privacy, accessibility, and the complete validation gate. See [CONTRIBUTING.md](CONTRIBUTING.md).

Report vulnerabilities through GitHub private vulnerability reporting as described in [SECURITY.md](SECURITY.md).

Apache-2.0 licensed. See [LICENSE](LICENSE).