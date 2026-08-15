# Architecture

Frontier Decision Engine is a static browser application served from `site/`.
There is no backend or account service.

## Main components

- `site/src/decision-ui.js`: decision workflow and exports.
- `site/src/app.js`: public hash-route states and page-level copy.
- `site/src/lib/decision.js`: scenario evaluation and robust-candidate logic.
- `site/src/lib/semantics.js`: optional Four-P summaries, proceed-condition validation, and deterministic Decision posture; it does not participate in comparative ranking.
- `site/src/lib/case.js`: case validation, hashing, and export.
- `site/src/lib/case.js`, `site/src/lib/calculations.js`, and `site/src/lib/datasets.js`: retained compatibility/reference modules covered by validation; they are not primary navigation surfaces.
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

Browser autosave is a recovery convenience, not confidential storage. A valid
saved draft is presented for an explicit resume/download/clear/start choice on
return. Blank, ready-example, restored-draft, and imported-file entry modes use
one bounded decision shape and replace state explicitly.

Draft lifecycle validation is separate from analysis readiness and completed
portable-decision validation. Browser autosave and the small in-progress backup
wrapper preserve a bounded partial state without claiming that it is a completed
schema `0.2.10` decision. Analysis remains blocked until its inputs are complete;
portable decision and readable-summary export remain blocked until the human
selection, rationale, and next action are complete.

## Optional decision semantics

Legacy portable schema `0.2.10` remains available and is not silently migrated.
Explicit use of the optional Sustainability · SEER-informed lens or Decision
posture creates schema `0.3.0` state under `decision_semantics`; the top-level
`profile` retains its domain/reference meaning. The draft wrapper remains the
same three-field contract and dispatches its bounded inner decision by schema
version.

Four-P criteria persist evidence state separately from criterion outcome.
People, Planet, Profits, and Product summaries consider every criterion in the
dimension and are never averaged. `must_be_true` drives only Decision posture;
existing objective `critical` drives only comparative robustness. Calculated
Four-P summaries, posture, explanations, and next-evidence output are recomputed
and are not persisted. Next evidence is emitted only from an explicit
`evidence_need`.

Decision posture is software decision support, not legal approval,
organizational authorization, certification, qualification, consent, or
investment approval. A human can apply only a more cautious posture override.

## Deferred Checkpoint C observations

Record only; not implemented in Checkpoint A: move the mobile Overview action
closer to first glance, reduce Step 2 and Step 5 default density, avoid making a
highlighted percentage resemble machine approval, simplify secondary recovery
actions, and strengthen progressive disclosure. The future doctrine remains:
simple on the surface, rigorous underneath; meaning before numbers; human decides.
