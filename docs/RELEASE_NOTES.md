# v0.3.2

## Verification, interface, and release integrity

Application version is 0.3.2. The compatible decision schema 0.2.10 remains available alongside the explicitly versioned 0.3.0 semantic decision schema.

This patch release improves cross-platform verification, focused progressive disclosure, and release commit identity while preserving the decision model, human authority, and published schema contracts.

### Changes

- Adds a portable Python launcher for npm verification on Windows and POSIX systems without adding dependencies.
- Reports both decision schema identities in generated project and release metadata.
- Places a mobile Overview action at the working-interface heading and keeps secondary Step 2 and Step 5 detail collapsed until requested.
- Verifies that a release tag resolves to the checked-out commit, that the commit is on `main`, and that GitHub Release publication targets that exact commit.
- Keeps schemas 0.2.10 and 0.3.0, ranking, thresholds, decision fingerprints, browser-local operation, and human decision authority unchanged.

### Evidence boundary

FDE provides transparent software decision support. Recording documents human judgment; it is not approval, authorization, certification, qualification, consent, or investment authority. Browser-local storage is not encrypted confidential storage.

### Release-candidate date

2026-08-20
