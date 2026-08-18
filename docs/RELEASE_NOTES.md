# v0.3.1

## Complete decision authoring and recording lifecycle

Application version is 0.3.1. The compatible decision schema 0.2.10 remains available alongside the explicitly versioned 0.3.0 semantic decision schema.

This corrective release completes the bounded blank-to-recorded Decision Lab workflow while preserving the existing decision model, human authority, and published schema contracts.

### Changes

- Makes the bounded goals, choices, thresholds, comparison values, futures, and future effects visibly authorable from a true blank decision.
- Separates Required to Continue, Required to Compare, and Required to Record so optional planning fields do not block truthful analysis.
- Preserves blank, unknown, and explicit numeric zero as distinct states; No Modeled Change is an explicit human declaration.
- Separates a selected human choice from a recorded human decision.
- Adds a browser-local Decision Record with an immutable snapshot and deterministic substantive-state fingerprint.
- Marks material edits after recording as Changed since recording and requires explicit re-recording for a current recorded output.
- Preserves legacy completed imports without inventing a v0.3.1 recording event.
- Strengthens validation routing, keyboard focus, mobile workflow coverage, import preservation, and recorded-output consistency while keeping internal IDs and raw validator detail out of normal views.
- Keeps schemas 0.2.10 and 0.3.0 unchanged.

### Evidence boundary

FDE provides transparent software decision support. Recording documents human judgment; it is not approval, authorization, certification, qualification, consent, or investment authority. Browser-local storage is not encrypted confidential storage.

### Release-candidate date

2026-08-15
