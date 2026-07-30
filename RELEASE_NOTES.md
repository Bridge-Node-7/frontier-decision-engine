# Release Notes

## v0.2.10 · Hosted delivery closure

- **Windows manifest-path correction:** `build-manifest.mjs` now converts file URLs with Node's cross-platform `fileURLToPath()` API instead of reading URL `.pathname`, preventing duplicated drive prefixes such as `C:\\C:\\...` in Git Bash and Windows Node.

This is the final pre-publication release candidate. Application behavior, decision results, datasets, and evidence boundaries remain unchanged from the verified baseline.

### Added

- Automatic end-to-end UX verification against the live GitHub Pages HTTPS URL after deployment.
- External-origin browser mode through `FDE_BASE_URL`; it fails closed and does not use the sandbox fallback.
- GitHub API enforcement that the annotated release tag is cryptographically signed and marked `verified: true` with reason `valid`.
- A release-workflow precondition that repository release immutability is enabled before publishing.
- Post-publication verification of release attestations and both hosted assets.
- Explicit immutable-release setup and verification in the GitHub runbook, setup guide, and release checklist.
- Five delivery-specific release-integrity tests covering the live Pages gate, protected immutable-release precheck, signed release gate, clean hosted-asset download, and hosted delivery documentation.

### Retained

- 49 automated Node tests and the complete repository, browser, accessibility, export, print, security, and deterministic packaging gates.
- Immutable GitHub Action pins, lockfile installation, disabled package-manager caching, cross-platform line-ending normalization, Python and Actions Dependabot coverage, PR review template, and artifact attestations.
- Strategy-specific scenario effects, critical-objective gating, mandatory human rationale, critical-gap disclosure, complete exports, and public-safe evidence boundaries.

### Release rule

Do not publish the tag until hosted CI, the live Pages UX gate, repository security settings, signed-tag preflight, and immutable releases are all green. Do not create another local version unless the hosted gate reveals a real defect.
