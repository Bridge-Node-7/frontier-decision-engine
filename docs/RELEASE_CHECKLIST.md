# Release Checklist

## Local source gate

- [ ] Extract or clone into a clean directory.
- [ ] Confirm Node.js 22+, Python 3.11+, and Chromium or Google Chrome.
- [ ] Run `npm ci --ignore-scripts --no-audit --no-fund`.
- [ ] Run `npm run check` and confirm **49/49** Node tests pass.
- [ ] Confirm repository validation and all six browser modes pass.
- [ ] Run `git diff --exit-code` in a Git checkout.

## Release artifact gate

- [ ] Run `npm run package:release`.
- [ ] Record the external `.sha256` checksum.
- [ ] Repeat packaging from a second clean tree and confirm byte-identical output.
- [ ] Re-extract the final archive and rerun `npm run check`.
- [ ] Confirm no source workbook, private input, credential, cache, `node_modules`, or `dist` content is inside the archive.

## GitHub repository gate

- [ ] Verify the authenticated GitHub identity and target owner permissions.
- [ ] For a brand-new repository only, bootstrap the exact audited tree to `main`; use protected pull requests for every later change.
- [ ] Require the `verify` check and protect `main`.
- [ ] Enable private vulnerability reporting.
- [ ] Enable Dependabot alerts, secret scanning, and push protection where available.
- [ ] Create a protected `release` environment with an authorized reviewer.
- [ ] Add the `RELEASE_ADMIN_TOKEN` environment secret with repository-scoped Administration: read and Metadata: read only.
- [ ] Enable release immutability **before** publishing the first release.
- [ ] Confirm the immutable-releases API returns `true` using the administration-read token.

## Live Pages gate

- [ ] Set Pages source to GitHub Actions.
- [ ] Confirm the Pages workflow deploys successfully.
- [ ] Confirm its post-deployment `FDE_BASE_URL` live UX gate passes against the HTTPS Pages URL.
- [ ] Verify every live route, both workflows, exports, dark mode, reflow, forced colors, and print/PDF behavior.
- [ ] Complete NVDA or VoiceOver, physical 200%/400% zoom, Windows High Contrast, and real-device review.

## Signed release gate

- [ ] Run `python3 scripts/verify_release_tag.py v0.2.10`.
- [ ] Confirm local tag signing works with `git tag -s` and `git tag -v`.
- [ ] Create the signed annotated `v0.2.10` tag. Do not use an unsigned fallback.
- [ ] Confirm the workflow reports GitHub tag verification as `verified: true`, reason `valid`.
- [ ] Confirm the release workflow verifies immutability before publishing.
- [ ] Confirm attestations exist for both the ZIP and checksum.

## Hosted delivery gate

- [ ] Download both assets from the GitHub Release into a clean directory.
- [ ] Verify the downloaded ZIP with the downloaded `.sha256` file.
- [ ] Run `gh release verify v0.2.10`.
- [ ] Confirm the workflow downloaded both hosted assets into a clean verification directory.
- [ ] Verify the downloaded ZIP with the downloaded checksum.
- [ ] Run `gh release verify-asset` for both downloaded assets.
- [ ] Run `gh attestation verify` for both downloaded assets.
- [ ] Reconfirm immutable releases remain enabled.
- [ ] Publish the maturity statement and prohibited-claims boundary.
- [ ] Request external DMDU, accessibility, and security review.
