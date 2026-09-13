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

The **Governed context** route accepts Mission Graph Decision Context Packet 0.2.0 for `FDE_PREPARATION_ONLY` use. FDE verifies the packet locally, including its canonical SHA-256 content digest, and exposes what is known, assumed, disputed, unknown, stale, needs proof, or may change.

Only PRIVATE or PROTECTED packets with explicit non-release handling and no recorded-decision claim are accepted. Accepted context stays in JavaScript page memory only and is discarded on refresh; it is not placed in normal browser autosave or silently promoted into the canonical decision model. Source-lineage details remain collapsed until the user deliberately opens **Show me why**.

## Decision Lab

After confirmation, FDE asks only for the additional explicit inputs required for a deterministic comparison. The formal Decision Lab preserves the existing ranking semantics, published schemas, saved-work protections, and truthful alternate outcomes including ties, no acceptable option, and insufficient information.

The comparison informs. A person decides.

## Assurance on demand

Technical users can inspect the underlying inputs, assumptions, evidence state, uncertainty, thresholds, scenario effects, calculations, provenance, and decision record without forcing that depth into the first-run experience.
