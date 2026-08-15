# Data

The repository retains three public-safe reference datasets. They are not
loaded by the current Decision Lab routes; validators and tests preserve their
classification, provenance boundaries, and compatibility value.

| Dataset | Class | Purpose |
| --- | --- | --- |
| `morphology.json` | Measured / derived reference material | Retained image-plane morphology and angular-motion summaries. |
| `experiences.json` | Synthetic validation fixture | Retained event hierarchy, classification, filtering, and limitations fixture. |
| `references.json` | Referenced / interpreted reference material | Retained research-navigation mappings and analyst scores. |

The synthetic event registry contains no personal source history. The other
datasets exclude original workbooks and source media. A stored source
fingerprint identifies the derivation input but does not establish authenticity,
identity, range, causation, or scientific confirmation.

`profiles/phenomena/profile.json` and the `examples/` cases are retained
reference/profile and compatibility materials. They do not restore legacy
phenomena or dataset surfaces to primary FDE navigation.

## Decision semantic contracts

| Contract | Meaning |
|---|---|
| `schemas/decision.schema.json` | Supported legacy portable decision schema `0.2.10`. |
| `schemas/decision-0.3.0.schema.json` | Portable decision schema `0.3.0` with explicit optional Decision semantics. |
| `decision_semantics.mode` | `general` or `sustainability-seer`; does not repurpose top-level `profile`. |
| `decision_semantics.criteria` | Independent evidence state, outcome, Four-P/General dimension, and explicit must-be-true declaration. |
| `decision_semantics.proceed_conditions_state` | Human review state: `unreviewed`, `declared`, or deliberately `none-required`. |
| conditions / safeguards / monitoring | Small declared records used to derive posture and change conditions; not a workflow engine. |
| affected parties / dissent | Qualitative context. Participation never means consent, representation, agreement, or approval. |

Derived comparison, Four-P summaries, Decision posture, Why text, change text,
and next-evidence output are not persisted. The existing comparison never reads
`decision_semantics`.
