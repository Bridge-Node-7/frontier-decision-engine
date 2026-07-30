# Architecture

## System boundary

Frontier Decision Engine v0.2.10 is a static, local-first browser application hosted directly from `site/`.

```text
Browser
├── Decision Lab
│   ├── Decision frame
│   ├── XLRM Decision Map
│   ├── Strategies
│   ├── Plausible futures
│   ├── Threshold stress test
│   ├── Vulnerability map
│   └── Robust Decision Brief
└── Open Phenomenon Verification profile
    ├── Local evidence hashing
    ├── Calibration
    ├── Image measurement
    ├── Evidence Ladder
    ├── Public-safe datasets
    └── Portable case export
```

No server, account, database, remote runtime dependency, or mandatory Python process is required.

## Decision calculation

For each strategy, scenario, and objective:

```text
performance = clamp(strategy baseline + scenario modifier, 0, 100)
```

An objective passes when its declared threshold is met.

The reference candidate ranking is:

1. Highest worst-scenario threshold pass rate
2. Highest overall threshold pass rate
3. Fewest critical-objective failures

This ranking is advisory. It does not select the human decision.

## Data integrity

Decision exports record that:

- no probability model was used
- values are analyst assigned
- the model is a transparent scenario matrix
- the human-selected decision may differ from the machine-generated candidate

## Profile boundary

`profiles/phenomena/profile.json` defines domain prompts, evidence classes, and safeguards. The existing OPV evidence case remains schema version `0.1.0`; the broader decision case uses schema version `0.2.10`.

## Future analytical integration

Advanced ensemble analysis should be added through optional adapters rather than embedded as an opaque browser dependency. Candidate ecosystems include robust decision-making and exploratory-modeling tools, but integrations must preserve provenance and expose model assumptions.
