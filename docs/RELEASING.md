# Releasing

1. Update the application version in the package, citation, and generated project facts.
2. Keep each schema and its examples synchronized. A compatible schema may remain at an earlier version than the application release.
3. Update `docs/RELEASE_NOTES.md` for the current supported release. Use versioned GitHub Releases for published release notes.
4. Refresh the stable reference screenshot when the public interface materially changes.
5. Merge only after the repository gate passes. Deploy Pages then reruns the complete gate, deploys the exact `main` commit, and verifies the live HTTPS experience.
6. Stable publication is separate from routine Pages deployment. When a stable milestone should be published, explicitly run the Release workflow. It checks out current `main`, proves that exact SHA has a successful Pages deployment and a valid GitHub commit signature, derives the version-matched tag, reruns the complete release gate, builds deterministic assets, and attests them.
7. The Release workflow creates an annotated version tag that points only to that verified commit, publishes the GitHub Release, then re-downloads and verifies the hosted checksums, release assets, and attestations.

Release workflows remain pinned and minimally privileged. Routine validated source and Pages updates do not automatically create stable GitHub Releases. Stable publication requires explicit release invocation, successful live Pages UAT for the exact current `main` SHA, and a GitHub-verified commit; no operator credential, manual signing step, or manual deployment approval is required.

Repository, deployment, commit-signature, and artifact verification establish release integrity within the tested controls. They do not alter the human-governed decision model or establish external certification, approval, or operational fitness.
