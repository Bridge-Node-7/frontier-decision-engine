# v0.5.5

Application version is 0.5.5.

Compatible decision schema: 0.2.10. Semantic decision schema: 0.3.0. Mission Graph Decision Context Packet: 0.3.0.

This patch release preserves explicit decision criteria that fall outside the built-in intake vocabulary instead of silently dropping them, asks for bounded human selection when more than four criteria are supplied, and narrows comparison-language extraction so informational "versus" prompts are not converted into decision choices.

No decision schema, scoring model, recommendation authority, storage boundary, or external runtime dependency is added. First-run structure remains provisional until the user confirms it; human judgment remains authoritative. Browser-local storage is not encrypted confidential storage.
