# GitHub Setup

## Recommended repository

`Bridge-Node-7/frontier-decision-engine`

## Local release prerequisites

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

## Initial publication bootstrap

A brand-new repository has no `main` branch for a pull request to target. The audited source may therefore receive one bootstrap push to `main`; every later change should use protected pull requests. Creating the public repository requires explicit final approval.

```bash
gh auth status
gh api user --jq .login
git init -b main
git add .
git commit -m "feat: launch frontier decision engine v0.2.10"
gh repo create Bridge-Node-7/frontier-decision-engine \
  --public \
  --source . \
  --description "Open-source decision infrastructure for deep uncertainty." \
  --remote origin \
  --push
```

Immediately configure repository rules, security controls, and **release immutability**. Then open **Settings → Pages** and choose **GitHub Actions** as the source. The Pages workflow deploys `site/` and executes the complete browser suite against the live HTTPS URL.

## Required repository settings

Create a protected GitHub environment named `release`, require an authorized reviewer, and add an environment secret named `RELEASE_ADMIN_TOKEN`. The secret should be a short-lived, repository-scoped fine-grained token with only **Administration: read** and **Metadata: read**. The default `GITHUB_TOKEN` cannot query the immutable-releases administration endpoint.

- Require a pull request before merging to `main`
- Require the `verify` status check
- Require conversation resolution
- Block force pushes and branch deletion
- Enable private vulnerability reporting
- Enable Dependabot alerts
- Enable secret scanning and push protection when available
- Enable release immutability before the first tag is pushed
- Use squash merges with conventional commit titles

Verify immutability through the API:

```bash
gh api --method PUT \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  repos/Bridge-Node-7/frontier-decision-engine/immutable-releases

gh api \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  repos/Bridge-Node-7/frontier-decision-engine/immutable-releases \
  --jq '.enabled'
```

## First release

After hosted CI, the live Pages gate, repository security controls, and manual accessibility checks succeed, create a signed annotated tag. The workflow rejects unsigned or GitHub-unverified tags.

```bash
python3 scripts/verify_release_tag.py v0.2.10
git tag -s v0.2.10 -m "Frontier Decision Engine v0.2.10"
git push origin v0.2.10
```

The Release workflow reruns the complete gate, checks the GitHub tag signature, uses the protected administration-read secret to confirm immutability, builds deterministic artifacts, creates attestations, publishes the GitHub Release, downloads both hosted assets into a clean directory, and verifies their checksum plus release and build attestations.
