# Frontier Decision Engine

Browser-local decision support for deep uncertainty.

[Open the live application](https://bridgenode7.com/frontier-decision-engine/)

![Frontier Decision Engine](docs/screenshots/v0.2.10/desktop-decision-frame.png)

## What it does

- Frames decisions, objectives, uncertainties, strategies, and plausible futures.
- Stress-tests strategies against explicit thresholds.
- Exposes critical failures and strategy vulnerabilities.
- Keeps final selection, rationale, and next action human-owned.
- Exports portable decision and evidence records.
- Includes an Open Phenomenon Verification profile for local evidence handling.

The application is static and browser-local. It has no backend, account system,
analytics, cookies, or default upload endpoint.

## Sample data

The public site includes measured or derived morphology data, a synthetic event
registry, and an analyst-mapped reference dataset. These samples demonstrate the
interfaces and evidence boundaries. They are not proof of object identity,
external origin, or scientific confirmation.

No personal chronology, private narrative, exact private location, medical
information, credentials, client data, or source workbook is included.

## Run locally

```bash
python3 -m http.server 8000 --directory site
```

Open `http://localhost:8000`.

## Verify

Requirements: Node.js 22+, Python 3.11+, and Chromium or Google Chrome.

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
npm ci --ignore-scripts --no-audit --no-fund
npm run check
```

Current generated counts and versions are recorded in
[`project-facts.json`](project-facts.json).

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Methodology](docs/METHODOLOGY.md)
- [Data](docs/DATA_DICTIONARY.md)
- [Privacy](docs/PRIVACY.md)
- [Releasing](docs/RELEASING.md)

## Project

Contributions must preserve evidence boundaries, human decision authority,
privacy, accessibility, and the complete validation gate. See
[CONTRIBUTING.md](CONTRIBUTING.md).

Report vulnerabilities through GitHub private vulnerability reporting as
described in [SECURITY.md](SECURITY.md).

Apache-2.0 licensed. See [LICENSE](LICENSE).
