# Releasing

1. Update the application version in the package, citation, and generated project facts.
2. Keep each schema and its examples synchronized. A compatible schema may remain at an earlier version than the application release.
3. Update `docs/RELEASE_NOTES.md` for the current release. Do not add version-per-release narrative files to `main`; historical release narrative remains in Git history, tags, and GitHub Releases.
4. Refresh the stable reference screenshot when the public interface materially changes.
5. Run `npm run check`, verify release identity, and run `npm run package:release`.
6. Publish the version-matched signed tag and deterministic release artifacts.
7. Verify published checksums and the deployed Pages experience independently.

Release workflows remain pinned and minimally privileged.

Repository and artifact verification establish release integrity within the tested controls. They do not alter the human-governed decision model or establish external certification, approval, or operational fitness.
