# Frontier Decision Engine

**Bring a messy situation. Find the decision. Test choices when useful. Keep the final judgment human-owned.**

[Open the live application](https://bridgenode7.com/frontier-decision-engine/)

![Frontier Decision Engine](docs/screenshots/reference/desktop-decision-frame.png)

## Start with Decision Rescue

The public front door accepts ordinary human language first. A visitor can brain-dump what is happening, choose one useful next action, and build a calm Decision Frame without knowing decision-science terminology.

Decision Rescue is deliberately conservative: it preserves what the person typed, offers tap-first prompts, and never pretends browser JavaScript semantically inferred evidence, probabilities, thresholds, or a recommendation. A partial Decision Frame is a valid stopping point.

When a confirmed frame is ready, the visitor can continue into the deterministic Decision Lab with the exact bounded comparison they confirmed. Guided work can use 2–4 objectives, 2–3 choices, and 2–4 plausible futures, so the minimum comparison is a true 2 × 2 × 2 model rather than a larger hidden form. FDE does not silently discard confirmed items or fabricate the remaining analytical inputs.

## What the Decision Lab does

- Frames decisions, objectives, uncertainties, strategies, and plausible futures.
- Evaluates choices across explicit goals and named future conditions.
- Shows unmet goals, ties, incomplete outcomes, and conditions to watch.
- Keeps final selection, rationale, and next action human-owned.
- Exports an editable decision file and a readable decision summary.

The application is static and browser-local. It has no backend, account system, analytics, cookies, or default upload endpoint.

## Ready reference case

The default public workflow retains a clearly labeled synthetic critical-material source-qualification case. It demonstrates the full comparison and does not certify a supplier, qualify a material, confirm production capacity, guarantee compliance, recommend an investment, or predict commodity prices.

The Decision Lab autosaves in-progress work in the local browser and asks before reopening a structurally safe draft on return. Anyone with access to that browser profile may be able to reopen it; browser storage is not encrypted confidential storage. An incomplete draft can be downloaded and reopened as an explicitly labeled draft backup. Completed legacy schema `0.2.10` decisions remain supported. Explicit use of Sustainability · SEER-informed or Decision-posture semantics uses schema `0.3.0`; both published schema contracts remain unchanged. A recorded output requires a decision owner, human choice, rationale, and next action, and recording remains distinct from approval or authorization. Legacy completed files without verified recording metadata open without inventing a recording event.

SEER-informed is an optional lens inside the same six-stage Decision Lab workflow. People, Planet, Profits, and Product remain independent; there is no composite sustainability score. The existing comparison and the separately derived Decision posture are advisory, and a human owns the final decision.

## Run locally

```bash
node scripts/run-python.mjs -m http.server 8000 --directory site
```

Open `http://localhost:8000`.

## Verify

Requirements: Node.js 22+, Python 3.11+, and Chromium or Google Chrome. The npm commands locate `python3`, `python`, or `py -3` as appropriate for the platform.

```bash
node scripts/run-python.mjs -m pip install -r requirements-dev.txt
node scripts/run-python.mjs -m playwright install chromium
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

`npm run check` includes focused Decision Rescue browser verification in addition to the existing unit, repository, version, manifest, Decision Lab browser, and closeout gates.

Current generated counts and versions are recorded in [`project-facts.json`](project-facts.json). Its discovered hash-route count is a count of route literals in HTML/JavaScript, and its retained-reference counts describe repository artifacts rather than active Decision Lab datasets.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Methodology](docs/METHODOLOGY.md)
- [Data](docs/DATA_DICTIONARY.md)
- [Privacy](docs/PRIVACY.md)
- [Releasing](docs/RELEASING.md)

## Project

Contributions must preserve evidence boundaries, human decision authority, privacy, accessibility, and the complete validation gate. See [CONTRIBUTING.md](CONTRIBUTING.md).

Report vulnerabilities through GitHub private vulnerability reporting as described in [SECURITY.md](SECURITY.md).

Apache-2.0 licensed. See [LICENSE](LICENSE).
