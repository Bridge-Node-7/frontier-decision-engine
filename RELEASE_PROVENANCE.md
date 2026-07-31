# Release Provenance
## Controlling historical release

- Product: Frontier Decision Engine
- Version: 0.2.10
- Steward: Bridge Node 7
- Release archive: `frontier-decision-engine-v0.2.10.zip`
- Checksum file: `frontier-decision-engine-v0.2.10.zip.sha256`
- Artifact freeze: 2026-07-29
- Public publication: 2026-07-30

v0.2.10 is the immutable historical initial public release. The repository contains a tag-driven workflow that requires a GitHub-verified signed annotated tag, enabled release immutability, artifact attestations, and hosted-asset verification. Public workflow history shows that this workflow was not exercised for v0.2.10, so those delivery controls are implemented controls rather than evidence for that release.

The authoritative archive checksum is distributed beside the archive in the `.sha256` file. It is intentionally not embedded in the archive because embedding an archive's own checksum would create a self-referential build problem.
## Reproducibility rule for v0.3.0 and later

A production release is accepted only when:
1. `npm run check` passes from a clean extraction.
2. `npm run package:release` succeeds.
3. A second canonical Ubuntu build produces a byte-identical archive and checksum.
4. The packaged archive is re-extracted and verified again.
5. The full tag version matches `package.json` and `CITATION.cff`.
6. Portable schema compatibility is validated independently from application release identity.
7. GitHub Actions and the live Pages HTTPS end-to-end gate pass.
8. GitHub verifies the signed annotated tag.
9. Release immutability is enabled before publication.
10. Hosted assets pass checksum, release, and attestation verification.

Cross-platform builds must demonstrate archive-entry and content equivalence unless byte identity has been independently established.
## Evidence boundary

The release contains public-safe normalized data, synthetic controls, methods, schemas, tests, and browser code. It does not contain the original workbooks, original observation media, personal narratives, precise private locations, credentials, or institutional case data.
## Historical corrections

Earlier development artifacts identified and corrected renderer, decision-logic, candidate-language, contrast, focus, packaging, documentation, reflow, table-accessibility, release-automation, dependency-version, action-pin, and screenshot-provenance issues. Those artifacts are historical audit evidence and are not controlling release packages.
