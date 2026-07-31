# Contributing to Frontier Decision Engine

Keep changes focused, public-safe, and testable.

## Requirements

- Do not add personal histories, private narratives, exact private locations,
  medical information, credentials, client data, or unpublished source files.
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

Open a focused pull request that states the user value, public-data impact, and
validation result.
