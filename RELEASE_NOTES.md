# Release Notes

## v0.2.10 · Historical initial public release

- **Windows manifest-path correction:** `build-manifest.mjs` converts file URLs with Node's cross-platform `fileURLToPath()` API instead of reading URL `.pathname`, preventing duplicated drive prefixes such as `C:\C:\...` in Git Bash and Windows Node.

v0.2.10 is the immutable historical initial public release. Application behavior, decision results, datasets, and evidence boundaries remain those of the verified reference implementation.
### Included
- Browser workflow and public-safe data validation.
- Decision Lab and Open Phenomenon Verification reference workflows.
- Deterministic packaging implementation and adjacent SHA-256 checksum.
- Production workflow implementation for signed tags, release immutability, attestations, and hosted verification.
- Repository, browser, accessibility, export, print, security, and public-boundary checks.
### Evidence boundary

Public workflow history shows that the production Release workflow was not exercised for v0.2.10. Do not cite signed-tag enforcement, attestations, immutable-release precheck, or hosted-asset verification as completed delivery evidence for this release.
### Next release rule

v0.3.0 will be the first stable release required to pass the complete signed, automated, attested, and hosted-verified production pipeline. A public release candidate must be explicitly marked prerelease and non-Latest before publication.
