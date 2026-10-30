# v0.6.1

Application version is 0.6.1.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This patch keeps the public Decision Lab and first-run experience unchanged while making release-please publish annotated tags and GitHub Releases automatically so Pages immutable-release verification stays green.

- The public root keeps one freeform input: **What are you considering?**
- **Continue** produces a working Decision Brief for ordinary in-scope text rather than beginning a compulsory clarification sequence.
- Sparse and multi-decision context can produce a partial brief while unresolved structure remains explicit.
- Original source context and detected candidate decisions, choices, criteria, and conditions remain preserved before formal comparison.
- Formal comparison is voluntary and uses one bounded setup surface before entering the existing Decision Lab.
- The formal comparison contract remains 2–4 objectives, 2–3 strategies, and 2–4 scenarios.
- Provisional decision hinges remain source-derived and require explicit human handling before they can affect formal comparison inputs.
- Existing saved Decision Lab work is not silently overwritten by a new first-run brief.
- Product-scope, safety, evidence-readiness, authority, Decision Receipt v2, governed-context, reassessment, and ranking semantics remain unchanged.
- Annotated tags and GitHub Releases are published automatically when a release-please version PR merges; no manual tagging is required.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only. Human judgment remains authoritative. The comparison informs; a person decides.
