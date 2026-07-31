# Architecture

Frontier Decision Engine is a static browser application served from `site/`.
There is no backend or account service.

## Main components

- `site/src/decision-ui.js`: decision workflow and exports.
- `site/src/app.js`: routing, datasets, and evidence-case workflow.
- `site/src/lib/decision.js`: scenario evaluation and robust-candidate logic.
- `site/src/lib/case.js`: case validation, hashing, and export.
- `schemas/`: portable JSON contracts.
- `scripts/`: validation, browser tests, packaging, and release verification.

## Decision ranking

The reference candidate ranking is transparent and deterministic:

1. Minimize scenarios containing critical-objective failures.
2. Maximize worst-case critical-objective pass rate.
3. Maximize worst-case overall pass rate.
4. Maximize overall pass rate.
5. Minimize total critical failures.

The result is advisory. A human selects the strategy and records the rationale
and next action.

## Boundaries

All source data and assumptions remain visible. Generated visualizations are
not evidence. Local files are processed in the browser and are not uploaded by
the default application.
