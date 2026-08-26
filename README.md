# Frontier Decision Engine

**Bring the whole mess. FDE gives you something useful back, helps make uncertainty visible, and keeps the final decision human-owned.**

[Open the live application](https://bridgenode7.com/frontier-decision-engine/)

## Start with one input

The FDE front door now starts with one free-form input. Put down a problem, question, worry, idea, decision, or a complete mess. FDE responds immediately with a provisional Decision Surface showing only what can be safely organized from the words provided.

The surface is a draft, not a hidden machine decision. Possible signals stay possible until a person confirms them. When enough explicit structure exists, the surface can continue into the deterministic Decision Lab. Otherwise, it offers a simple path to shape the missing pieces without pretending the missing information is known.

The experience is designed around a simple rule: **every meaningful input receives a useful response, and questions are used only when human judgment is actually needed to move the decision forward.**

## Decision Surface

The surface can show:

- a possible decision;
- choices mentioned explicitly;
- things that may matter;
- conditions that could change the answer; and
- the smallest useful next step.

This is deliberately conservative. The browser does not call a remote AI service, retrieve outside facts, invent probabilities, or promote provisional text into verified evidence.

## Decision Lab

When a person confirms enough structure, FDE can hand the work into its existing deterministic comparison engine. Guided work supports 2–4 objectives, 2–3 choices, and 2–4 plausible futures. The minimum comparison is a true 2 × 2 × 2 model.

The comparison informs. A person decides.

## Privacy and authority

The application is static and browser-local. It has no backend, account system, analytics, telemetry, cookies, remote AI provider, or default upload endpoint. Session recovery and browser autosave are convenience features, not encrypted confidential storage.

FDE provides decision support. It does not approve, authorize, certify, qualify, consent, or make an investment decision.

## Verify

Requirements: Node.js 22+, Python 3.11+, and Chromium or Google Chrome.

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Methodology](docs/METHODOLOGY.md)
- [Privacy](docs/PRIVACY.md)
- [Releasing](docs/RELEASING.md)

## Project

Changes must preserve human decision authority, privacy, accessibility, and the complete validation gate. See [CONTRIBUTING.md](CONTRIBUTING.md).

Report vulnerabilities through GitHub private vulnerability reporting as described in [SECURITY.md](SECURITY.md).

Apache-2.0 licensed. See [LICENSE](LICENSE).
