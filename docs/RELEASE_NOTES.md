# v0.5.8

Application version is 0.5.8.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This release improves decision-value presentation without changing the deterministic comparison model or decision-authority boundary. The comparison result now leads with what held up, why, what could change it, the next required proof, the next action, and the reminder that the person decides.

`Next Proof` is derived only from the existing deterministic evidence-readiness proof requests. When no required proof blocks the formal evidence gate, FDE says so rather than inventing an evidence source.

A lightweight Decision Brief can now be copied or downloaded before a Decision Receipt is recorded. The brief is explicitly non-authoritative; the Decision Receipt remains the formal historical record of the accountable human decision.

The decision schemas, Mission Graph context contract, Decision Receipt v2, evidence semantics, scoring model, browser-local architecture, and human-authority model are unchanged.
