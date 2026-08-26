# Architecture

Frontier Decision Engine is a static browser application served from `site/`.
There is no backend or account service.

## Main components

- `site/src/rescue-ui.js`: human-language Decision Rescue front door and Decision Frame.
- `site/src/lib/intake.js`: bounded intake and Decision Frame helpers; it performs no semantic inference.
- `site/src/decision-ui.js`: full six-stage Decision Lab workflow and exports.
- `site/src/app.js`: public hash-route states and the explicit Rescue-to-Lab handoff.
- `site/src/lib/decision.js`: bounded guided-topology facade and draft-readiness compatibility layer.
- `site/src/lib/decision-core.js`: unchanged scenario evaluation, reference factories, legacy draft validation, and robust-candidate ranking core.
- `site/src/lib/semantics.js`: optional Four-P summaries, proceed-condition validation, and deterministic Decision posture; it does not participate in comparative ranking.
- `site/src/lib/persistence.js`: bounded browser autosave, draft backup, and safe file parsing.
- `site/src/lib/case.js`, `site/src/lib/calculations.js`, and `site/src/lib/datasets.js`: retained compatibility/reference modules covered by validation; they are not primary navigation surfaces.
- `schemas/`: portable JSON contracts.
- `scripts/`: validation, browser tests, packaging, and release verification.

## Human-first entry

The root route is a Universal Response Gateway rather than a decision-science form. It accepts bounded inert text, preserves it as human input, and always offers a useful next action. Private/browser-local Decision Rescue does not claim to understand arbitrary prose, retrieve external facts, infer evidence, invent objectives or choices, assign probabilities, or recommend an action.

The interaction doctrine is: one brain dump, then the smallest useful human contribution. Tap-first prompts are preferred to repeated typing. `I am not sure` remains a valid path. A Decision Frame can remain incomplete and still be downloaded without being represented as a comparison result or recommendation.

A full-comparison handoff is enabled only after the person has confirmed a decision, at least two things that matter, two choices, and two plausible futures. The handoff preserves every confirmed label and creates a bounded Decision Lab draft with the exact active comparison topology supported by the public UI:

- 2 to 4 objectives
- 2 to 3 strategies
- 2 to 4 scenarios

The default guided handoff is therefore a true 2 × 2 × 2 comparison, not a larger hidden model. The ready example remains 4 × 3 × 4. Thresholds, scores, critical flags, modifiers, evidence, and probabilities remain unset until the human supplies them in the Decision Lab.

## Epistemic states

FDE keeps four current meanings separate:

1. **You said** — direct human input.
2. **You confirmed** — human-approved decision-model input.
3. **FDE calculated** — deterministic output from confirmed model inputs.
4. **You decided** — the human-owned choice, rationale, and next action.

Decision Rescue does not generate a semantic interpretation of arbitrary prose.

## Decision ranking

The reference candidate ranking is transparent and deterministic:

1. Minimize scenarios containing critical-objective failures.
2. Maximize worst-case critical-objective pass rate.
3. Maximize worst-case overall pass rate.
4. Maximize overall pass rate.
5. Minimize total critical failures.

The result is advisory. A human selects the strategy and records the rationale and next action.

## Boundaries

All source data and assumptions remain visible. Generated visualizations are not evidence. Local files are processed in the browser and are not uploaded by the default application.

Browser autosave is a recovery convenience, not confidential storage. A valid saved Decision Lab draft is presented for an explicit resume/download/clear/start choice on return. Blank, guided, ready-example, restored-draft, and imported-file Lab entry modes preserve bounded model state and replace state explicitly. Decision Rescue itself remains in memory until its frame is downloaded or handed into the Decision Lab.

Draft lifecycle validation is separate from analysis readiness and completed portable-decision validation. Browser autosave and the in-progress backup wrapper preserve a bounded partial Lab state without claiming that it is a completed schema `0.2.10` decision. Analysis remains blocked until its required inputs are complete; portable decision and readable-summary export remain blocked until the human selection, rationale, and next action are complete.

The public schemas allow portable decisions beyond the interactive draft limits. The current browser UI deliberately bounds in-progress guided editing to the topology ranges above so the interface can preserve every confirmed value without silently truncating data.

## Optional decision semantics

Legacy portable schema `0.2.10` remains available and is not silently migrated. Explicit use of the optional Sustainability · SEER-informed lens or Decision posture creates schema `0.3.0` state under `decision_semantics`; the top-level `profile` retains its domain/reference meaning. The draft wrapper remains the same three-field contract and dispatches its bounded inner decision by schema version.

Four-P criteria persist evidence state separately from criterion outcome. People, Planet, Profits, and Product summaries consider every criterion in the dimension and are never averaged. `must_be_true` drives only Decision posture; existing objective `critical` drives only comparative robustness. Calculated Four-P summaries, posture, explanations, and next-evidence output are recomputed and are not persisted. Next evidence is emitted only from an explicit `evidence_need`.

Decision posture is software decision support, not legal approval, organizational authorization, certification, qualification, consent, or investment approval. A human can apply only a more cautious posture override.

The continuing doctrine remains: simple on the surface, rigorous underneath; meaning before numbers; human decides.
