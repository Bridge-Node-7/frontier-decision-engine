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
