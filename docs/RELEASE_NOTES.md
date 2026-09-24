# v0.5.7

Application version is 0.5.7.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This release reduces first-run effort while preserving the existing deterministic comparison and human-authority model. Natural-language intake now accepts broader situation and context framing, keeps advanced routes behind progressive disclosure, and can surface a conservative decision-hinge candidate when an explicit requirement, time gate, dependency, conditional, or blocker is present in the user's own words.

Decision-hinge candidates preserve exact source provenance, begin as suggestions with no formal influence, and require human confirmation before they can populate bounded comparison inputs. When no grounded hinge can materially advance the model, FDE falls back to the existing choices → goals → futures clarification order.

Long first-run input is no longer silently clipped by a browser text limit. FDE preserves the entered text on screen and shows an explicit bounded-processing message. Regression coverage includes negation and Unicode/source-span behavior.

The Decision Case, scoring model, Decision Receipt v2, authority roles, Mission Graph context contract, evidence semantics, and browser-local architecture are unchanged. The public application still has no backend, account system, analytics, telemetry, remote AI provider, or default upload endpoint. Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only. Human judgment remains authoritative.
