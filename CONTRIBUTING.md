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

Public bug and method-improvement forms are retained under
`.github/ISSUE_TEMPLATE/`. If a non-owner cannot open one, enabling public issue
submission is a later repository-settings ADMIN GATE; do not send security
reports through a public issue. Use the private path in [SECURITY.md](SECURITY.md).
