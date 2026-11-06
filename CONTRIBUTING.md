# Contributing to Frontier Decision Engine

Keep changes focused, public-safe, and testable.

## Requirements

- Use only material intended for unrestricted public release. If disclosure
  suitability is uncertain, do not add it to this repository.
- Keep measured, reported, interpreted, assumed, and synthetic material
  explicitly separated.
- Do not automate consequential human decisions.
- Avoid dependencies and documentation that do not provide clear user or
  maintenance value.
- Preserve accessibility and browser-local operation.

## Validate

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

Open a focused pull request that states the user value, release-scope impact,
and validation result.

Use the public bug and method-improvement forms in `.github/ISSUE_TEMPLATE/`.
Report security concerns through the private path in [SECURITY.md](SECURITY.md),
not a public issue.
