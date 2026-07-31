# Frontier Decision Engine v0.2.10 Comprehensive V&V and UX Audit

**Audit date:** 2026-07-29  
**Controlling source:** Frontier Decision Engine v0.2.10 release tree  
**Steward:** Bridge Node 7  
**Checksum:** distributed externally beside the deterministic archive

## Executive verdict
> v0.2.10 is an immutable historical public reference release. The repository implements a protected signed-tag, release-immutability, attestation, and hosted-verification workflow, but public workflow history shows that the Release workflow was not exercised for v0.2.10. Application behavior and reference-case results are unchanged.


| Scope | Verdict |
|---|---|
| Controlled public GitHub source and methodology demonstration | GREEN |
| Education, methodology demonstration, and partner review | GREEN |
| General-purpose external-user pilot | RED until preservation, import, and dynamic modeling are complete |
| Sole basis for irreversible or safety-critical decisions | RED |
| Predictive system, full RDM/MoRDM ensemble, or phenomenon-origin proof | RED |

v0.2.10 is a working reference implementation for framing decisions under deep uncertainty, stress-testing transparent strategies across plural futures, exposing critical failures, preserving human authority, and exporting decision-ready records.

## Corrective actions closed

- Decision Lab renderer regression
- strategy-specific scenario effects
- critical-objective candidate gating
- mandatory human rationale and next action
- critical-gap-aware candidate language
- complete JSON and HTML decision exports
- dark-mode contrast and focus management
- visible scrolling to wizard headings
- public package hygiene and deterministic packaging
- current-only provenance and synchronized release identity
- affordability modeled as an at-least desirability objective
- accessible captions and scoped headers for public tables
- progressive disclosure for the dense stress-test matrix
- semantic accessibility-tree smoke
- 200% and 400% reflow-equivalent checks
- forced-colors and PDF print verification
- tag-to-version verification and production Release workflow implementation
- deployed HTTPS Pages workflow implementation
- signed-tag enforcement design
- release-immutability and hosted-asset-verification design

## Automated verification

The controlling command is:

```bash
npm run check
```

Expected v0.2.10 results:

- Node test count is generated in `project-facts.json`; all discovered tests must pass
- repository validation passes
- 18-entry site manifest is current
- desktop-light browser mode passes
- mobile-light browser mode passes
- desktop-dark browser mode passes
- 200%-equivalent reflow passes
- 400%-equivalent reflow passes
- forced-colors mode passes

The browser gate covers all public routes, all six Decision Lab stages, all five phenomena stages, local hashing, calibration, keyboard coordinate measurement, validation focus, four export products, semantic structure, responsive behavior, and print/PDF generation.

## Decision-model verification

The included reference case has three strategies, four scenarios, four objectives, and 48 strategy × scenario × objective results.

| Strategy | Overall pass | Worst future | Critical-failure futures | Critical misses |
|---|---:|---:|---:|---:|
| Reanalyze existing evidence | 75% | 75% | 4 | 4 |
| Deploy two stations immediately | 43.75% | 25% | 4 | 5 |
| Stage conditional deployment | 87.5% | 75% | 2 | 2 |

The staged strategy is the leading relative candidate. It is not universally robust. The UI and exports disclose the remaining critical gaps.

## Evidence and privacy verification

The public-safe collections preserve:

- 41 morphology objects
- 40 motion sequences
- 169 valid intervals
- 41 primary experiences
- 22 nested subphases
- 53 reference clusters

The release excludes source workbooks, original sensitive media, personal narratives, exact private locations, credentials, private inputs, Python caches, `node_modules`, and `dist`.

Observation, reported experience, candidate mechanism, interpretation, and generated visualization remain separate evidence classes. Analyst mappings and scenario scores are not probabilities or scientific confirmation.

## UX and accessibility verification

The application begins with the decision rather than an upload. It provides progressive six-step and five-step workflows, visible assumptions, critical-gap disclosure, human-owned action, and portable end products.

Automated checks verify:

- accessible names and labels
- one main landmark and one page-level heading
- labeled navigation
- legends and summaries
- table captions and scoped headers
- image alternative text
- no duplicate IDs or empty headings
- primary contrast and target size
- keyboard activation
- step focus and visible scroll
- invalid-field focus
- 200% and 400% reflow-equivalent layouts
- forced-colors behavior
- print CSS and generated PDF output

These are baseline checks, not external accessibility certification.

## Security and release engineering

- static, local-first, zero backend
- no accounts, cookies, analytics, or default upload
- restrictive CSP and Permissions-Policy
- official GitHub Actions pinned to full commit SHAs
- read-only CI permissions and scoped Pages permissions
- deterministic timestamps, ordering, compression, and permissions
- production workflow implementation for GitHub-verified signed annotated tags
- release-immutability precheck implementation
- tag-driven workflow implementation for the full gate, deterministic artifacts, SHA-256, attestations, publication, and hosted verification; not exercised for v0.2.10
- live Pages workflow that tests the deployed HTTPS origin

## Remaining external gates

The following require the public repository or independent reviewers:

- GitHub-hosted CI
- live GitHub Pages route verification
- repository rules and branch protection
- private vulnerability reporting
- secret scanning and push protection
- first end-to-end signed-tag and immutable-release execution for v0.3.0
- NVDA and VoiceOver walkthroughs
- physical 200%/400% zoom and Windows High Contrast review
- external DMDU, accessibility, and security review
- real benchmark cases and institutional pilot outcomes

## Final decision

Preserve v0.2.10 as the historical reference release and complete v0.3.0 through the genuine signed, automated, attested, and hosted-verified release path. Do not market the product as predictive, institutionally validated, or proof of any phenomenon’s origin or mechanism.


The conflicting prior audit result involving Playwright `wait_for_function` and the strict CSP is closed in v0.2.10. The release tooling contains no `wait_for_function` calls.
