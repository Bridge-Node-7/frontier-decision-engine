# Releasing

1. Update the package, schema, citation, and example versions together.
2. Add concise notes at `docs/releases/<tag>.md`.
3. Run `npm run check` and `npm run package:release`.
4. Create and push a verified signed tag.
5. Let the tag-only release workflow verify identity, immutable-release
   configuration, deterministic artifacts, hosted checksums, and attestations.
6. Verify the published release and deployed Pages site independently.

Release workflows and Actions remain pinned and minimally privileged.
