# Architecture

Frontier Decision Engine is a static browser application served from `site/`. There is no backend or account service.

## Runtime

- Decision Rescue is the human-language front door.
- Decision Lab is the structured six-stage comparison workflow.
- The ranking engine is deterministic and runs in the browser.
- Portable decision schemas remain versioned under `schemas/`.
- Validation and release checks run from `scripts/` and GitHub Actions.

## Human-first entry

The root experience accepts bounded inert text and asks for the smallest useful human contribution next. It does not claim to understand arbitrary prose, retrieve external facts, infer evidence, assign probabilities, create scores, or recommend an action.

A Decision Frame can remain incomplete and still be useful. Full comparison is available only after the person has confirmed a decision, at least two goals, two choices, and two plausible futures.

Guided comparison supports:

- 2–4 objectives
- 2–3 strategies
- 2–4 scenarios

The ready example remains a larger synthetic reference case. Missing thresholds, scores, modifiers, critical flags, and evidence stay missing until a person supplies them.

## Browser storage

Decision Rescue uses tab-scoped session storage for accidental-refresh recovery. The original starting context remains context only and is not scored or promoted into model evidence.

Decision Lab uses bounded browser autosave for in-progress structured work. If a browser draft already exists, Decision Rescue does not replace it silently; replacement requires an explicit human choice.

Browser storage is not encrypted confidential storage. Local files are processed in the browser and are not uploaded by the default application.

## Decision result

The engine evaluates explicit human-supplied inputs across the same named futures. It preserves honest outcomes including:

- a unique leader under the tested model;
- tied leaders;
- no acceptable strategy under declared boundaries; and
- insufficient data.

The result is advisory. A person selects the strategy and records the rationale and next action.

## Compatibility

Legacy completed decision schema `0.2.10` remains supported. Optional decision-semantics state uses schema `0.3.0`. The guided browser editor is intentionally bounded even though portable schemas may permit broader cases.

The deterministic ranking core is isolated from the human-entry layer so UX changes do not silently alter comparison semantics.

## Security and privacy boundaries

The public runtime has no account system, analytics, telemetry, remote AI provider, or default upload endpoint. User-entered text is rendered as text rather than executable markup.

Generated visualizations and software calculations are not evidence. FDE does not provide legal approval, organizational authorization, certification, qualification, consent, or investment approval.
