# Releasing

1. Update the application version in the package, citation, and generated
   project facts.
2. Keep each schema and its examples synchronized. A compatible schema may
   remain at an earlier version than the application release.
3. Add concise notes at `docs/releases/<tag>.md`.
4. Run `npm run check`, verify the release tag identity, and run
   `npm run package:release`.
5. Create and push a verified signed annotated tag.
6. Let the tag-only release workflow verify identity, immutable-release
   configuration, deterministic artifacts, hosted checksums, and attestations.
7. Verify the published release and deployed Pages site independently.

Release workflows and Actions remain pinned and minimally privileged.

## Automated immutable-release boundary

Immediately before creating a release tag, the closeout gate must use the
already-authenticated repository owner session for a read-only API check that
immutable releases are enabled. The token remains local and is never copied
into GitHub Actions or stored as an environment secret.

The tag-only workflow then verifies the signed annotated tag, publishes with
the minimally privileged workflow token, downloads the hosted assets, checks
their hashes, and runs `gh release verify`, `gh release verify-asset`, and
attestation verification. A failed immutable-release or hosted-asset check
fails the release gate and blocks closeout.
