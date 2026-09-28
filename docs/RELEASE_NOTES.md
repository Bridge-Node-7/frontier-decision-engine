# v0.5.15

Application version is 0.5.15.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0. Decision Receipt format: 2. Pilot Proof Envelope: 1.

This corrective UX release makes the supportable prepared bottom line the first substantive result on the final decision surface and in the downloadable Decision Brief.

- Required unresolved evidence produces a HOLD prepared bottom line even when another declared posture would otherwise permit advancement.
- STOP, HOLD, REWORK, ADVANCE WITH CONDITIONS, and ADVANCE retain their existing semantic authority and are translated into plain-language prepared output.
- An inactive assurance posture remains comparison-only rather than being promoted into an automated recommendation.
- The visible prepared bottom line shows the controlling issue, the next required proof when one exists, and an explicit reminder that the accountable human still decides.
- Browser UAT now requires the prepared bottom-line surface and its human-authority boundary.
- The Decision Case schemas, Mission Graph context contract, Decision Receipt v2 format, ranking semantics, reassessment behavior, authority roles, and portable interfaces are unchanged. Accountable human judgment remains authoritative.

Browser-local storage is not encrypted confidential storage. Public deployment is for public or sanitized decision material only.
