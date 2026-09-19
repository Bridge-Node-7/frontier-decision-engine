# Data contracts

Frontier Decision Engine uses portable decision contracts rather than domain-specific datasets.

| Contract | Meaning |
|---|---|
| `schemas/decision.schema.json` | Compatible portable decision schema `0.2.10`. |
| `schemas/decision-0.3.0.schema.json` | Portable decision schema `0.3.0` with explicit optional decision semantics. |
| `schemas/mission-graph-decision-context-0.2.0.schema.json` | Legacy Mission Graph context accepted for inspection only. |
| `schemas/mission-graph-decision-context-0.3.0.schema.json` | Current governed-context intake contract. |

The source-neutral example under `examples/synthetic-source-qualification/` demonstrates a synthetic critical-material qualification choice. Its scores are declared teaching inputs, not empirical forecasts or recommendations.

Derived comparisons and explanatory views are not promoted into canonical inputs until a person confirms them. Integrity, origin, evidence assurance, freshness, handling, and human authority remain distinct properties.
