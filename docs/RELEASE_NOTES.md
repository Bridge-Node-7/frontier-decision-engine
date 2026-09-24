# v0.5.13

Application version is 0.5.13.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This corrective release closes the remaining scope-policy gaps without changing FDE's published decision, receipt, ranking, or authority contracts.

- Personal-safety scope classification now evaluates semantic families for explicit self-directed action, life-ending intent, hopelessness and absence/burden language, acute ending-language, and dangerous all-medication intent rather than depending on a small set of exact phrasings.
- Organizational supplier, project, mission, prevention, and policy language remains in scope when it does not express personal self-directed intent.
- Organizational nouns no longer suppress explicit first-person crisis language.
- Receipt v2 recordability now evaluates the recorded human rationale in addition to the question, choices, plans, next action, and other operative decision surfaces.
- Browser UAT verifies that an out-of-scope rationale cannot create a Decision Receipt.
- CI now includes a generated semantic-family generalization gate with organizational negative controls.

The Decision Case schemas, Mission Graph context contract, Decision Receipt v2 format, ranking semantics, reassessment behavior, and authority roles are unchanged. Human judgment remains authoritative.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only.
