# Contributing to Frontier Decision Engine

Frontier Decision Engine welcomes improvements that make decision framing, evidence handling, uncertainty analysis, adaptive planning, privacy, accessibility, and reproducibility more useful and trustworthy. Open Phenomenon Verification remains the flagship phenomena profile.

## Before contributing

1. Read `PUBLIC_SAFE_BOUNDARY.md`, `WORLD_IMPROVEMENT_GATE.md`, and `docs/METHODOLOGY.md`.
2. Do not submit private media, identifying experience narratives, medical information, precise private locations, credentials, client data, or unverified accusations.
3. Keep measured, reported, derived, interpreted, reconstructed, enhanced, and generated material explicitly separated.
4. Do not describe analyst-assigned desirability scores as probabilities, forecasts, or facts.
5. Preserve human ownership of consequential decisions.

## Development

The browser application has no runtime package dependencies. Local verification requires Node.js 22+, Python 3.11+, and Chromium or Google Chrome.

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm run check
```

This executes unit tests, repository and public-boundary validation, manifest generation, and real-browser end-to-end tests in desktop light, mobile light, and desktop dark modes.

Serve the site manually with:

```bash
python3 -m http.server 8000 --directory site
```

Then open `http://localhost:8000`.

## Pull requests

A pull request should explain:

- the user problem
- the evidence or test supporting the change
- decision-quality impact
- privacy and security impact
- accessibility impact
- schema or export impact
- rollback considerations

Add or update tests for calculation, decision-model, route, export, focus, data-integrity, and release changes.
