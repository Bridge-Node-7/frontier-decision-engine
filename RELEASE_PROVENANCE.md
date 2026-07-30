# Release Provenance

## Controlling release

- Product: Frontier Decision Engine
- Version: 0.2.10
- Steward: Bridge Node 7
- Release archive: `frontier-decision-engine-v0.2.10.zip`
- Checksum file: `frontier-decision-engine-v0.2.10.zip.sha256`
- Release date: 2026-07-29

The GitHub workflows use the current immutable `actions/setup-node` v7.0.0 commit and explicitly disable automatic package-manager caching because caching is unnecessary for this release gate.
Hosted workflows also verify `package-lock.json` with `npm ci --ignore-scripts --no-audit --no-fund` before running the release gate. The Pages workflow executes the complete browser suite against the deployed HTTPS URL, and the Release workflow requires a GitHub-verified signature plus repository release immutability before publication.

The authoritative archive checksum is distributed beside the archive in the `.sha256` file. It is intentionally not embedded in the archive because embedding an archive's own checksum would create a self-referential build problem.

## Reproducibility rule

A release is accepted only when:

1. `npm run check` passes from a clean extraction.
2. `npm run package:release` succeeds.
3. A second clean build produces a byte-identical archive and checksum.
4. The packaged archive is re-extracted and verified again.
5. The release tag matches `package.json`, `CITATION.cff`, and the decision schema.
6. GitHub Actions and the automatic live Pages HTTPS end-to-end gate pass.
7. GitHub verifies the signed annotated tag.
8. Release immutability is enabled before publication.
9. Both hosted assets pass release and attestation verification.

## Evidence boundary

The release contains public-safe normalized data, synthetic controls, methods, schemas, tests, and browser code. It does not contain the original workbooks, original observation media, personal narratives, precise private locations, credentials, or institutional case data.

## Historical corrections

Earlier development artifacts identified and corrected renderer, decision-logic, candidate-language, contrast, focus, packaging, documentation, reflow, table-accessibility, release-automation, dependency-version, action-pin, and screenshot-provenance issues. Those artifacts are historical audit evidence and are not controlling release packages. Current release documentation refers only to v0.2.10.
