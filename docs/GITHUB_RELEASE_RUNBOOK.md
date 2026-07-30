# GitHub Public Release Runbook

This runbook separates verified local preparation from public and potentially irreversible GitHub actions.

## 1. Preflight the exact source and identity

Use only the controlling v0.2.10 release tree and adjacent checksum. Do not substitute another ZIP or working directory.

```bash
gh auth status
gh api user --jq .login
git status --short
npm ci --ignore-scripts --no-audit --no-fund
npm run check
python3 scripts/verify_release_tag.py v0.2.10
```

Confirm that the authenticated identity has permission to create repositories under `Bridge-Node-7` and that `Bridge-Node-7/frontier-decision-engine` does not already contain unrelated work.

## 2. Bootstrap the new repository

A pull request cannot target `main` until `main` exists. For a brand-new repository, the independently audited source is allowed one initial bootstrap push to `main`.

```bash
git init -b main
git add .
git commit -m "feat: launch frontier decision engine v0.2.10"
gh repo create Bridge-Node-7/frontier-decision-engine \
  --public \
  --description "Open-source decision infrastructure for deep uncertainty." \
  --source . \
  --remote origin \
  --push
```

Creating a public repository is an explicit public action. Execute this step only after final confirmation. Do not tag or announce the release yet. Require protected pull requests for every subsequent change.

## 3. Require verification and protect `main`

Configure repository rules for `main`:

- require a pull request before merging
- require the `verify` status check
- require conversation resolution
- block force pushes and branch deletion
- require linear history when compatible with the team workflow

Confirm the hosted CI run is green before continuing.

## 4. Enable security, the protected release environment, and immutable releases

Create a GitHub environment named `release` and require an authorized reviewer before deployment. Add an environment secret named `RELEASE_ADMIN_TOKEN`. Use a repository-scoped fine-grained personal access token with only **Administration: read** and **Metadata: read** for `Bridge-Node-7/frontier-decision-engine`, set a short expiration, and rotate or revoke it when no longer needed.

The default workflow `GITHUB_TOKEN` cannot read the immutable-releases administration endpoint. The Release workflow therefore fails closed when `RELEASE_ADMIN_TOKEN` is missing or cannot confirm that immutability is enabled. Never commit or print this token.

Enable:

- private vulnerability reporting
- dependency graph and Dependabot alerts
- secret scanning and push protection where available
- **release immutability before the first release is published**

In GitHub, open **Settings → General → Releases** and enable release immutability. It applies only to releases published after the setting is enabled.

API alternative:

```bash
gh api --method PUT \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  repos/Bridge-Node-7/frontier-decision-engine/immutable-releases

gh api \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  repos/Bridge-Node-7/frontier-decision-engine/immutable-releases \
  --jq '.enabled'
```

The final command must return `true`. Store the administration-read token as the protected `release` environment secret described above. The release workflow checks the setting with that separate token and fails closed if the secret is missing, lacks permission, or immutability is not enabled.

Do not publish sensitive evidence, credentials, private case data, source workbooks, or original observation media.

## 5. Enable and verify GitHub Pages

Set Pages source to **GitHub Actions**. The included workflow verifies the source, deploys `site/`, then reruns all six browser modes and both end-to-end workflows against `${{ steps.deployment.outputs.page_url }}`.

The live Pages workflow must complete successfully. It checks:

- every public route
- Decision Lab and Phenomena workflows
- desktop, mobile, and dark mode
- keyboard operation and visible focus
- 200% and 400% reflow equivalents
- forced-colors behavior
- exports and printed/PDF Decision Brief output

Complete the remaining manual checks on the live URL:

- NVDA or VoiceOver
- physical 200% and 400% browser zoom
- Windows High Contrast or equivalent OS mode
- real-device mobile review

Record the Pages deployment URL and workflow run.

## 6. Verify signing before creating the release tag

The release workflow accepts only an annotated tag whose signature GitHub marks as verified and valid. An unsigned `git tag -a` fallback is not accepted.

Confirm your GPG, SSH, or S/MIME signing key is associated with the GitHub account. Then create and locally verify a temporary signed tag without pushing it:

```bash
git tag -s signing-preflight -m "Signing preflight"
git tag -v signing-preflight
git tag -d signing-preflight
```

Do not proceed until local verification succeeds and the configured signing identity belongs to the authenticated GitHub account.

## 7. Create the release tag

Only after hosted CI, live Pages, security settings, release immutability, and the accessibility checklist are green:

```bash
git checkout main
git pull --ff-only origin main
python3 scripts/verify_release_tag.py v0.2.10
git tag -s v0.2.10 -m "Frontier Decision Engine v0.2.10"
git push origin v0.2.10
```

The tag workflow then:

1. verifies the annotated tag object
2. confirms GitHub marks its signature as verified and valid
3. confirms release immutability is enabled
4. reruns the complete gate
5. builds the deterministic ZIP and checksum
6. verifies the checksum from `dist/`
7. generates attestations for both artifacts
8. creates the immutable GitHub Release
9. downloads both published assets into a clean hosted-verification directory
10. verifies the downloaded checksum, release attestation, both release assets, and both build-provenance attestations

## 8. Independently verify the hosted delivery

Download the published artifacts into a clean directory and verify the hosted copies rather than relying only on the local `dist/` directory:

```bash
rm -rf release-verification
mkdir release-verification

gh release download v0.2.10 \
  --repo Bridge-Node-7/frontier-decision-engine \
  --dir release-verification \
  --pattern 'frontier-decision-engine-v0.2.10.zip*'

cd release-verification
sha256sum --check frontier-decision-engine-v0.2.10.zip.sha256

gh release verify v0.2.10 \
  --repo Bridge-Node-7/frontier-decision-engine

gh release verify-asset v0.2.10 frontier-decision-engine-v0.2.10.zip \
  --repo Bridge-Node-7/frontier-decision-engine

gh release verify-asset v0.2.10 frontier-decision-engine-v0.2.10.zip.sha256 \
  --repo Bridge-Node-7/frontier-decision-engine

gh attestation verify frontier-decision-engine-v0.2.10.zip \
  --repo Bridge-Node-7/frontier-decision-engine

gh attestation verify frontier-decision-engine-v0.2.10.zip.sha256 \
  --repo Bridge-Node-7/frontier-decision-engine
```

Recheck the immutable-release setting:

```bash
gh api \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  repos/Bridge-Node-7/frontier-decision-engine/immutable-releases \
  --jq '.enabled'
```

## 9. Capture final evidence

Record:

- CI run URL
- Pages deployment URL and live-E2E result
- manual accessibility results
- release URL
- tag and commit SHA
- GitHub tag signature verification result
- immutable-release setting
- ZIP SHA-256
- release and asset verification outputs
- artifact-attestation verification outputs
- known limitations and prohibited claims

Do not announce completion until these records are captured.
