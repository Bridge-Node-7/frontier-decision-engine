# Methodology

## Governing sequence

> Frame → Preserve → Map → Explore → Stress-test → Decide → Monitor → Adapt

## Decision framing

Every analysis begins with a decision owner, question, time horizon, stakeholders, constraints, urgency, and reversibility.

## Decision Map

The public UX expresses XLRM as:

- **Uncertainties:** What could change or remain unknown?
- **Levers:** What can we do?
- **Relationships:** How might actions produce consequences?
- **Measures:** What outcomes matter?

## Robustness

Robustness is not certainty. In v0.2.10 it is the proportion of declared objective thresholds met across the included scenario matrix.

The app shows:

- overall threshold pass rate
- worst-scenario pass rate
- critical-objective failures and the number of futures containing them
- scenario-specific vulnerabilities

Each scenario can affect each strategy differently. The app does not calculate a hidden aggregate utility or assign scenario probabilities. Critical objectives are treated as gates before broader performance comparisons.

## Human decision authority

The engine generates a relative leading candidate. When that candidate still fails critical objectives in one or more included futures, the interface and export disclose the gaps rather than describing the strategy as fully robust. The decision owner selects, modifies, rejects, or defers the candidate and records a rationale and single next action.

## Adaptive pathway

A robust decision brief should identify:

- actions justified now
- indicators to monitor
- observable trigger conditions
- contingencies
- reassessment timing

## Phenomena evidence doctrine

Observation, reported experience, candidate mechanism, analyst interpretation, and generated visualization remain separate evidence classes.

The platform does not automatically declare extraordinary origin, intent, agency, or mechanism.
