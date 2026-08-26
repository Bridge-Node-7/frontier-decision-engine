# Architecture

Frontier Decision Engine is a static browser application served from `site/`. There is no backend or account service.

## Human-first runtime

The public root is a one-input response experience. A person can write a problem, question, worry, idea, decision, or incomplete thought without knowing decision-science vocabulary. FDE immediately returns a useful response and a provisional Decision Map.

The Decision Map can show:

- a possible decision;
- choices mentioned explicitly;
- things that may matter;
- conditions that could change the answer; and
- the most useful next step.

Possible elements are not silently promoted into facts. The map is a draft until a person confirms the information that belongs in the formal decision model.

## Minimum necessary human contribution

FDE follows this interaction rule:

> Continue without bothering the person when the system can proceed safely; otherwise ask for the smallest human contribution that materially advances the decision.

No normal input is treated as a dead end. Empty, vague, messy, ambiguous, and non-decision input receive a useful orientation response rather than an error-only state.

## Formal Decision Lab

Once enough explicit structure exists and the person confirms the map, the confirmed information is handed into the existing deterministic Decision Lab. Guided comparison supports 2–4 objectives, 2–3 strategies, and 2–4 scenarios. The minimum comparison is a true 2 × 2 × 2 model.

The comparison core is isolated from the Map layer so UX changes do not silently alter ranking semantics. Missing analytical values are not fabricated.

## Epistemic boundaries

The public experience separates:

1. **You said** — the original human input.
2. **FDE organized** — provisional structure derived from safe, explicit textual patterns.
3. **You confirmed** — information promoted into the formal model by a human.
4. **FDE calculated** — deterministic output from confirmed model inputs.
5. **You decided** — the human-owned choice, rationale, and next action.

The default runtime does not use a remote AI provider, retrieve external facts, infer evidence, assign probabilities, or make the final decision.

## Browser storage

The universal response experience uses bounded tab-scoped session storage for accidental-refresh recovery. Decision Lab uses bounded browser autosave for structured work. Browser storage is a convenience, not encrypted confidential storage.

## Privacy and security

The public application has no backend, account system, analytics, telemetry, cookies, remote AI provider, or default upload endpoint. User input is rendered as text, not executable markup. Local files remain in the browser unless the person explicitly downloads or shares them.

## Long-term direction

The architecture intentionally leaves room for an optional assisted-understanding adapter and later Decision Memory without making either a dependency of the deterministic core. Any future semantic provider must produce provisional output that passes through the same human-confirmation boundary.
