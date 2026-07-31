import {
  angularExtentFromPixels,
  pointDistance,
  round,
  scenarioTable,
} from './lib/calculations.js';
import {
  buildHtmlReport,
  createCase,
  downloadText,
  hashFile,
  refreshEvidenceLevel,
  safeFilename,
  validateCase,
} from './lib/case.js';
import { evidenceBadge, loadDataset, sortedEntries } from './lib/datasets.js';
import { renderDecisionLab } from './decision-ui.js';

const main = document.querySelector('#main');
const MAX_BROWSER_HASH_BYTES = 250 * 1024 * 1024;
const state = {
  caseData: createCase(),
  caseStep: 0,
  selectedFile: null,
  selectedImageUrl: null,
  image: null,
  measurementPoints: [],
  selectedDataset: null,
};

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const formatNumber = (value, digits = 2) => Number.isFinite(Number(value))
  ? Number(value).toLocaleString(undefined, { maximumFractionDigits: digits })
  : '—';

function navigate(path) {
  location.hash = path;
}

function breadcrumbs(items) {
  return `<div class="breadcrumbs">${items.map((item, index) => {
    const divider = index ? '<span aria-hidden="true">/</span>' : '';
    return `${divider}${item.href ? `<a href="${item.href}">${escapeHtml(item.label)}</a>` : `<span>${escapeHtml(item.label)}</span>`}`;
  }).join('')}</div>`;
}

function badge(label, className = '') {
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function metric(label, value, note = '') {
  return `<div class="metric"><span class="label">${escapeHtml(label)}</span><span class="value">${escapeHtml(value)}</span>${note ? `<span class="help">${escapeHtml(note)}</span>` : ''}</div>`;
}

function limitationsPanel(items) {
  return `<div class="callout warning stack"><h3>Evidence boundaries</h3><ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>`;
}

function barList(entries) {
  const maximum = Math.max(1, ...entries.map(([, value]) => Number(value)));
  return `<div class="bar-list">${entries.map(([label, value]) => `
    <div class="bar-row">
      <span>${escapeHtml(label)}</span>
      <div class="bar-track" aria-hidden="true"><div class="bar-fill" style="width:${Math.max(2, Number(value) / maximum * 100)}%"></div></div>
      <strong>${formatNumber(value, 0)}</strong>
    </div>`).join('')}</div>`;
}

function renderHome() {
  main.innerHTML = `
    <section class="hero">
      <div class="stack">
        <span class="eyebrow">Open decision infrastructure for deep uncertainty</span>
        <h1>Decide well when prediction fails.</h1>
        <p class="lede">Frontier Decision Engine preserves evidence, exposes assumptions, explores plausible futures, stress-tests strategies, and produces a human-owned decision brief. Open Phenomenon Verification is the flagship frontier-sensing profile.</p>
        <div class="actions">
          <a class="button primary" href="#/decision">Open Decision Lab</a>
          <a class="button" href="#/case">Open Phenomena Case</a>
          <a class="button ghost" href="#/datasets">Explore sample data</a>
        </div>
        <div class="actions">
          ${badge('Local-first')}${badge('Zero backend')}${badge('No account')}${badge('Apache-2.0')}
        </div>
      </div>
      <aside class="panel stack" aria-label="Trust promise">
        <span class="eyebrow">Trust promise</span>
        <h2>Values, evidence, and uncertainty stay visible.</h2>
        <p class="muted">The platform does not hide stakeholder values in one score, convert assumptions into facts, or let AI own consequential decisions.</p>
        <div class="stack">
          ${badge('Evidence traceable', 'measured')}
          ${badge('Assumptions explicit', 'reported')}
          ${badge('Strategies stress-tested', 'interpreted')}
          ${badge('Judgment stays human', 'assumed')}
        </div>
      </aside>
    </section>

    <section class="stack" aria-labelledby="workflow-title">
      <div class="section-head"><div><span class="eyebrow">End-to-end workflow</span><h2 id="workflow-title">From uncertainty to accountable action</h2></div><p>Version 0.2.10 provides a verified DMDU decision vertical slice while retaining the auditable OPV evidence foundation.</p></div>
      <div class="flow">
        ${['Frame','Preserve','Map','Explore','Stress-test','Decide'].map((step, index) => `<div class="flow-step"><strong>${index + 1}. ${step}</strong><span class="muted">${['Define the real decision','Protect evidence and provenance','Expose uncertainty and objectives','Consider plausible futures','Find failure conditions','Choose and adapt'][index]}</span></div>`).join('')}
      </div>
    </section>

    <section class="stack" style="margin-top:3rem" aria-labelledby="datasets-title">
      <div class="section-head"><div><span class="eyebrow">Sample data</span><h2 id="datasets-title">Three datasets, three evidence classes</h2></div><a href="#/datasets">View all datasets</a></div>
      <div class="grid-3">
        ${datasetCard('morphology', 'Karijini morphology and motion', '41 objects · 40 sequences', 'Measured and derived single-camera analysis.', 'Measured / derived', 'measured')}
        ${datasetCard('experiences', 'Synthetic event registry', '41 primary · 22 subphases', 'Generated records for hierarchy and classification testing.', 'Synthetic', 'reported')}
        ${datasetCard('references', 'Thematic research map', '53 reference clusters', 'Analyst-mapped candidate research relationships.', 'Referenced / interpreted', 'interpreted')}
      </div>
    </section>`;
}

function datasetCard(key, title, metricText, description, evidence, className) {
  return `<a class="card card-link stack" href="#/dataset/${key}">
    ${badge(evidence, className)}
    <h3>${escapeHtml(title)}</h3>
    <strong>${escapeHtml(metricText)}</strong>
    <p class="muted">${escapeHtml(description)}</p>
    <span>Explore dataset →</span>
  </a>`;
}

function renderDatasets() {
  main.innerHTML = `
    ${breadcrumbs([{ label: 'Home', href: '#/' }, { label: 'Datasets' }])}
    <section class="stack">
      <div class="section-head"><div><span class="eyebrow">Sample collections</span><h1 style="font-size:clamp(2rem,5vw,3.8rem)">Explore before you build.</h1></div><p>Each collection is published as stable JSON with an explicit evidence class and limitations.</p></div>
      <div class="grid-3">
        ${datasetCard('morphology', 'Karijini morphology and motion', '41 objects · 169 valid intervals', 'Angular morphology and image-plane motion. No true range or physical identity is established.', 'Measured / derived', 'measured')}
        ${datasetCard('experiences', 'Synthetic event registry', '63 analytic units', 'Generated parent and subphase records for interface testing.', 'Synthetic', 'reported')}
        ${datasetCard('references', 'Thematic research map', '9 themes · 59 signature associations', 'Research navigation and analyst relevance mapping, not scientific confirmation.', 'Referenced / interpreted', 'interpreted')}
      </div>
      <div class="soft-panel stack"><h3>Why stable JSON?</h3><p class="muted">The website reads validated JSON so structures and limitations remain explicit and portable.</p></div>
    </section>`;
}

async function renderDataset(name) {
  main.innerHTML = `<div class="panel"><p>Loading dataset…</p></div>`;
  try {
    const data = await loadDataset(name);
    state.selectedDataset = data;
    if (name === 'morphology') renderMorphology(data);
    if (name === 'experiences') renderExperiences(data);
    if (name === 'references') renderReferences(data);
  } catch (error) {
    main.innerHTML = `<div class="panel stack"><h1>Dataset unavailable</h1><p>${escapeHtml(error.message)}</p><a href="#/datasets">Return to datasets</a></div>`;
  }
}

function datasetHeader(data, className) {
  return `
    ${breadcrumbs([{ label: 'Home', href: '#/' }, { label: 'Datasets', href: '#/datasets' }, { label: data.title }])}
    <section class="dataset-head">
      <div class="actions">${badge(evidenceBadge(data.dataset_type), className)}${badge(`Schema ${data.schema_version}`)}</div>
      <h1 style="font-size:clamp(2rem,5vw,3.8rem)">${escapeHtml(data.title)}</h1>
      <p class="lede">${escapeHtml(data.evidence_class.replaceAll('-', ' '))}</p>
      <div class="soft-panel"><strong>Source fingerprint</strong><div class="hash">${escapeHtml(data.source.sha256)}</div><p class="help">${escapeHtml(data.source.note || (data.source.included_in_public_repository ? "The source is included in this repository." : "The source file is not included in this repository."))}</p></div>
    </section>`;
}

function renderMorphology(data, filter = {}) {
  const search = String(filter.search || '').toLowerCase();
  const morphology = filter.morphology || 'All';
  const rows = data.objects.filter((item) => (morphology === 'All' || item.morphology === morphology) && (!search || item.object_id.toLowerCase().includes(search)));
  main.innerHTML = `
    ${datasetHeader(data, 'measured')}
    <section class="metrics">
      ${metric('Objects', data.summary.objects)}${metric('Orbs', data.summary.orb_objects)}${metric('Rods', data.summary.rod_objects)}${metric('Valid intervals', data.summary.valid_intervals)}
    </section>
    <section class="grid-2" style="margin-top:1rem">
      <div class="panel stack"><h2>Sequence-level angular motion</h2><p class="muted">One mean per sequence reduces, but does not eliminate, dependence concerns.</p>${barList(sortedEntries(data.summary.sequence_mean_angular_speed_deg_s))}<p class="help">Degrees per second. This is image-plane angular motion, not confirmed physical velocity.</p></div>
      <div class="panel stack"><h2>Calibration status</h2><div class="grid-2">${metric('HFOV', `${data.calibration.horizontal_field_of_view_deg}°`)}${metric('Resolution', `${data.calibration.horizontal_pixels} × ${data.calibration.vertical_pixels}`)}${metric('Boundary tolerance', `±${data.calibration.boundary_tolerance_px} px`)}${metric('Rod threshold', `${data.calibration.rod_extended_threshold_deg ?? 8}°`)}</div></div>
    </section>
    <section class="panel stack" style="margin-top:1rem">
      <div class="section-head"><div><h2>Object measurements</h2><p>${rows.length} of ${data.objects.length} records shown</p></div><a class="button" href="./data/morphology.json" download>Download JSON</a></div>
      <div class="toolbar">
        <label class="field">Search object ID<input id="morph-search" type="search" value="${escapeHtml(filter.search || '')}" placeholder="e.g. 2022rod"></label>
        <label class="field">Morphology<select id="morph-filter"><option>All</option><option ${morphology === 'Orb' ? 'selected' : ''}>Orb</option><option ${morphology === 'Rod' ? 'selected' : ''}>Rod</option></select></label>
      </div>
      <div class="table-wrap"><table><caption>Public-safe morphology measurements</caption><thead><tr><th scope="col">Object ID</th><th scope="col">Class</th><th scope="col">Pixel length</th><th scope="col">Angular length</th><th scope="col">Angular width</th><th scope="col">Aspect ratio</th><th scope="col">Replicates</th></tr></thead><tbody>
        ${rows.slice(0, 100).map((item) => `<tr><td><code>${escapeHtml(item.object_id)}</code></td><td>${escapeHtml(item.morphology)}${item.rod_class ? ` · ${escapeHtml(item.rod_class)}` : ''}</td><td>${formatNumber(item.pixel_length)}</td><td>${formatNumber(item.angular_length_deg, 4)}°</td><td>${formatNumber(item.angular_width_deg, 4)}°</td><td>${formatNumber(item.aspect_ratio, 3)}</td><td>${item.length_replicates_px.length}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">No matching objects.</td></tr>'}
      </tbody></table></div>
    </section>
    <section style="margin-top:1rem">${limitationsPanel(data.limitations)}</section>`;
  document.querySelector('#morph-search')?.addEventListener('input', (event) => renderMorphology(data, { ...filter, search: event.target.value }));
  document.querySelector('#morph-filter')?.addEventListener('change', (event) => renderMorphology(data, { ...filter, morphology: event.target.value }));
}

function renderExperiences(data, filter = {}) {
  const type = filter.type || 'primary';
  const source = type === 'subphase' ? data.subphases : data.primary_events;
  const search = String(filter.search || '').toLowerCase();
  const rows = source.filter((item) => !search || item.label.toLowerCase().includes(search));
  const categoryDelta = Object.fromEntries(Object.entries(data.summary.category_counts_all_units).map(([key, value]) => [key, value - (data.summary.category_counts_primary[key] || 0)]));
  main.innerHTML = `
    ${datasetHeader(data, 'reported')}
    <section class="metrics">
      ${metric('Primary events', data.summary.primary_encounters)}${metric('Nested subphases', data.summary.nested_subphases)}${metric('Analytic units', data.summary.analytic_units)}${metric('Synthetic source', 'Yes', 'No personal history')}
    </section>
    <section class="grid-2" style="margin-top:1rem">
      <div class="panel stack"><h2>Primary stage counts</h2>${barList(sortedEntries(data.summary.stage_counts_primary))}</div>
      <div class="panel stack"><h2>Subphase coding effect</h2><p class="muted">The synthetic subphases share one deterministic four-code template.</p>${barList(sortedEntries(categoryDelta).filter(([, value]) => value > 0))}<p class="help">The exact +22 increases reflect the coding template, not 22 independent confirmations.</p></div>
    </section>
    <section class="panel stack" style="margin-top:1rem">
      <div class="section-head"><div><h2>Synthetic event structure</h2><p>No personal source data is used.</p></div><a class="button" href="./data/experiences.json" download>Download JSON</a></div>
      <div class="toolbar">
        <label class="field">Search label<input id="exp-search" type="search" value="${escapeHtml(filter.search || '')}"></label>
        <label class="field">Event type<select id="exp-type"><option value="primary" ${type === 'primary' ? 'selected' : ''}>Primary events</option><option value="subphase" ${type === 'subphase' ? 'selected' : ''}>Nested subphases</option></select></label>
      </div>
      <div class="table-wrap"><table><caption>Synthetic event records</caption><thead><tr><th scope="col">ID</th><th scope="col">Label</th><th scope="col">Parent</th><th scope="col">Life period</th><th scope="col">Stage</th><th scope="col">Categories</th></tr></thead><tbody>
        ${rows.map((item) => `<tr><td>${item.event_id}</td><td>${escapeHtml(item.label)}</td><td>${item.parent_event_id ?? '—'}</td><td>${escapeHtml(item.life_period)}</td><td>${escapeHtml(item.stage_code)}</td><td>${item.category_codes.map((code) => badge(code)).join(' ')}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">No matching events.</td></tr>'}
      </tbody></table></div>
    </section>
    <section style="margin-top:1rem">${limitationsPanel(data.limitations)}</section>`;
  document.querySelector('#exp-search')?.addEventListener('input', (event) => renderExperiences(data, { ...filter, search: event.target.value }));
  document.querySelector('#exp-type')?.addEventListener('change', (event) => renderExperiences(data, { ...filter, type: event.target.value }));
}

function renderReferences(data, filter = {}) {
  const themes = [...new Set(data.references.map((item) => item.theme))].sort();
  const theme = filter.theme || 'All';
  const search = String(filter.search || '').toLowerCase();
  const rows = data.references.filter((item) => (theme === 'All' || item.theme === theme) && (!search || item.citation_as_entered.toLowerCase().includes(search)));
  main.innerHTML = `
    ${datasetHeader(data, 'interpreted')}
    <section class="metrics">
      ${metric('Reference clusters', data.summary.reference_clusters)}${metric('Themes', Object.keys(data.summary.theme_counts).length)}${metric('Boundary average', formatNumber(data.summary.average_boundary_link_score, 2), 'Analyst score 1–5')}${metric('SRMS average', formatNumber(data.summary.average_srms_link_score, 2), 'Analyst score 1–5')}
    </section>
    <section class="grid-2" style="margin-top:1rem">
      <div class="panel stack"><h2>Theme distribution</h2>${barList(sortedEntries(data.summary.theme_counts))}</div>
      <div class="panel stack"><h2>Signature associations</h2>${barList(sortedEntries(data.summary.signature_association_counts).map(([key, value]) => [key.replaceAll('_', ' '), value]))}<p class="help">Associations are analyst assignments, not observed effect counts.</p></div>
    </section>
    <section class="panel stack" style="margin-top:1rem">
      <div class="section-head"><div><h2>Research-navigation map</h2><p>${rows.length} of ${data.references.length} clusters shown</p></div><a class="button" href="./data/references.json" download>Download JSON</a></div>
      <div class="toolbar">
        <label class="field">Search citation<input id="ref-search" type="search" value="${escapeHtml(filter.search || '')}"></label>
        <label class="field">Theme<select id="ref-theme"><option>All</option>${themes.map((item) => `<option ${theme === item ? 'selected' : ''}>${escapeHtml(item)}</option>`).join('')}</select></label>
      </div>
      <div class="table-wrap"><table><caption>Research-navigation reference mappings</caption><thead><tr><th scope="col">Reference as entered</th><th scope="col">Theme</th><th scope="col">Boundary</th><th scope="col">SRMS</th><th scope="col">Verification</th></tr></thead><tbody>
        ${rows.map((item) => `<tr><td>${escapeHtml(item.citation_as_entered)}</td><td>${escapeHtml(item.theme)}</td><td>${item.scores.boundary_link_score ?? '—'} / 5</td><td>${item.scores.srms_link_score ?? '—'} / 5</td><td>${badge('Workbook mapping only', 'interpreted')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No matching references.</td></tr>'}
      </tbody></table></div>
    </section>
    <section style="margin-top:1rem">${limitationsPanel(data.limitations)}</section>`;
  document.querySelector('#ref-search')?.addEventListener('input', (event) => renderReferences(data, { ...filter, search: event.target.value }));
  document.querySelector('#ref-theme')?.addEventListener('change', (event) => renderReferences(data, { ...filter, theme: event.target.value }));
}

const caseSteps = ['Case', 'Evidence', 'Calibration', 'Measure', 'Review'];

function renderCase({ focusStep = false } = {}) {
  refreshEvidenceLevel(state.caseData);
  main.innerHTML = `
    ${breadcrumbs([{ label: 'Home', href: '#/' }, { label: 'Create case' }])}
    <div class="section-head"><div><span class="eyebrow">Local evidence compiler</span><h1 style="font-size:clamp(2rem,5vw,3.8rem)">Create a reproducible case.</h1></div><p>Files are hashed locally. The default application has no upload endpoint.</p></div>
    <section class="wizard">
      <nav class="panel wizard-nav" aria-label="Case steps">
        ${caseSteps.map((label, index) => `<button class="wizard-step" type="button" data-step="${index}" ${state.caseStep === index ? 'aria-current="step"' : ''}><span class="number">${index + 1}</span><span class="step-label">${label}</span></button>`).join('')}
      </nav>
      <div class="panel wizard-content">
        <div id="case-step-content"></div>
        <div class="wizard-actions"><button id="case-back" type="button" ${state.caseStep === 0 ? 'disabled' : ''}>Back</button><span class="status-line" id="case-status" aria-live="polite">Evidence level ${state.caseData.evidence_level} of 7</span><button id="case-next" type="button" class="primary">${state.caseStep === 4 ? 'Validate case' : 'Continue'}</button></div>
      </div>
    </section>`;
  renderCaseStep();
  document.querySelectorAll('[data-step]').forEach((button) => button.addEventListener('click', () => {
    syncCurrentStep();
    state.caseStep = Number(button.dataset.step);
    renderCase({ focusStep: true });
  }));
  document.querySelector('#case-back')?.addEventListener('click', () => {
    syncCurrentStep();
    state.caseStep = Math.max(0, state.caseStep - 1);
    renderCase({ focusStep: true });
  });
  document.querySelector('#case-next')?.addEventListener('click', () => {
    syncCurrentStep();
    if (state.caseStep < 4) { state.caseStep += 1; renderCase({ focusStep: true }); }
    else validateAndAnnounce();
  });
  if (focusStep) requestAnimationFrame(() => {
    const heading = document.querySelector('#case-step-heading');
    if (!heading) return;
    heading.focus({ preventScroll: true });
    heading.scrollIntoView({ block: 'start', behavior: 'auto' });
  });
}

function renderCaseStep() {
  const container = document.querySelector('#case-step-content');
  const renderers = [caseDetailsStep, evidenceStep, calibrationStep, measurementStep, reviewStep];
  container.innerHTML = renderers[state.caseStep]();
  bindCaseStep();
}

function caseDetailsStep() {
  return `<div class="stack"><div><span class="eyebrow">Step 1</span><h2 id="case-step-heading" tabindex="-1">Describe only what is needed</h2><p class="muted">Keep direct observation separate from interpretation.</p></div>
    <div class="grid-2"><label class="field">Case title<input id="case-title" value="${escapeHtml(state.caseData.title)}" maxlength="160"></label><label class="field">Privacy<select id="case-privacy"><option value="private" ${state.caseData.privacy === 'private' ? 'selected' : ''}>Private</option><option value="public-safe-draft" ${state.caseData.privacy === 'public-safe-draft' ? 'selected' : ''}>Public-safe draft</option><option value="public" ${state.caseData.privacy === 'public' ? 'selected' : ''}>Public</option></select></label></div>
    <label class="field">Observation summary<textarea id="case-summary" placeholder="Describe what the source visibly or audibly records. Avoid declaring origin or intent.">${escapeHtml(state.caseData.observation_summary)}</textarea></label>
    <div class="callout"><strong>UX guardrail</strong><p class="muted">A case may remain incomplete. The tool never requires a dramatic conclusion to proceed.</p></div>
  </div>`;
}

function evidenceStep() {
  const asset = state.caseData.assets[0];
  return `<div class="stack"><div><span class="eyebrow">Step 2</span><h2 id="case-step-heading" tabindex="-1">Preserve source identity</h2><p class="muted">Select a local file to compute SHA-256. The file is not uploaded.</p></div>
    <label class="dropzone"><strong>Choose image, video, workbook, or sensor file</strong><span class="help">The first image can also be measured in Step 4.</span><input id="case-file" type="file" hidden></label>
    ${asset ? `<div class="soft-panel file-summary"><div><strong>${escapeHtml(asset.name)}</strong><p class="help">${formatNumber(asset.size_bytes, 0)} bytes · ${escapeHtml(asset.media_type || 'unknown type')}</p></div><div class="hash">${asset.sha256}</div><div class="actions">${badge(asset.asset_class)}${badge(asset.is_evidence ? 'Evidence asset' : 'Not evidence')}</div></div>` : '<div class="empty">No source asset selected yet.</div>'}
    <label class="field">Asset class<select id="asset-class"><option value="original" ${asset?.asset_class === 'original' ? 'selected' : ''}>Original</option><option value="derived" ${asset?.asset_class === 'derived' ? 'selected' : ''}>Derived</option><option value="enhanced" ${asset?.asset_class === 'enhanced' ? 'selected' : ''}>Enhanced</option><option value="reconstruction" ${asset?.asset_class === 'reconstruction' ? 'selected' : ''}>Reconstruction</option><option value="generated" ${asset?.asset_class === 'generated' ? 'selected' : ''}>Generated</option></select></label>
    <div class="callout warning"><strong>Hash meaning</strong><p class="muted">SHA-256 verifies that two files are byte-for-byte identical. It does not prove when, where, or how the file was created.</p></div>
  </div>`;
}

function calibrationStep() {
  const calibration = state.caseData.calibration;
  return `<div class="stack"><div><span class="eyebrow">Step 3</span><h2 id="case-step-heading" tabindex="-1">Declare the measurement boundary</h2><p class="muted">Unknown values stay unknown. Estimated values do not become calibrated.</p></div>
    <div class="grid-2">
      <label class="field">Horizontal field of view, degrees<input id="hfov" type="number" min="0.01" max="360" step="0.01" value="${calibration.horizontal_field_of_view_deg ?? ''}"></label>
      <label class="field">Horizontal pixels<input id="hpixels" type="number" min="1" step="1" value="${calibration.horizontal_pixels ?? ''}"></label>
      <label class="field">Vertical pixels<input id="vpixels" type="number" min="1" step="1" value="${calibration.vertical_pixels ?? ''}"></label>
      <label class="field">Frame rate, fps<input id="fps" type="number" min="0.01" step="0.001" value="${calibration.frame_rate_fps ?? ''}"></label>
      <label class="field">Calibration status<select id="cal-status"><option value="unknown" ${calibration.status === 'unknown' ? 'selected' : ''}>Unknown</option><option value="estimated" ${calibration.status === 'estimated' ? 'selected' : ''}>Estimated</option><option value="partially-calibrated" ${calibration.status === 'partially-calibrated' ? 'selected' : ''}>Partially calibrated</option><option value="calibrated" ${calibration.status === 'calibrated' ? 'selected' : ''}>Calibrated</option></select></label>
    </div>
    <div class="callout"><strong>Level 2 gate</strong><p class="muted">A source hash, horizontal field of view, image width, and at least one measurement are required. This still does not establish range.</p></div>
  </div>`;
}

function measurementStep() {
  const measurement = state.caseData.measurements[0];
  const scenarios = measurement?.scenarios || [];
  return `<div class="stack"><div><span class="eyebrow">Step 4</span><h2 id="case-step-heading" tabindex="-1">Measure what is visible</h2><p class="muted">For an image, click two endpoints. The result is angular extent, not object identity.</p></div>
    <div class="canvas-shell"><canvas id="measurement-canvas" width="960" height="540" aria-label="Image measurement canvas"></canvas><div id="canvas-empty" class="canvas-empty" ${state.image ? 'hidden' : ''}>Select an image in Step 2 to enable point measurement.</div></div>
    <div class="actions"><button id="clear-points" type="button">Clear points</button>${badge(`${state.measurementPoints.length} / 2 points`)}</div>
    <details class="soft-panel">
      <summary><strong>Enter endpoints precisely</strong> <span class="help">Keyboard-accessible alternative to clicking the canvas</span></summary>
      <div class="grid-2" style="margin-top:1rem">
        <label class="field">Point 1 X<input id="point-1-x" type="number" min="0" step="0.01" value="${state.measurementPoints[0]?.x ?? ''}"></label>
        <label class="field">Point 1 Y<input id="point-1-y" type="number" min="0" step="0.01" value="${state.measurementPoints[0]?.y ?? ''}"></label>
        <label class="field">Point 2 X<input id="point-2-x" type="number" min="0" step="0.01" value="${state.measurementPoints[1]?.x ?? ''}"></label>
        <label class="field">Point 2 Y<input id="point-2-y" type="number" min="0" step="0.01" value="${state.measurementPoints[1]?.y ?? ''}"></label>
      </div>
      <button id="apply-coordinates" type="button" style="margin-top:1rem">Apply coordinates</button>
    </details>
    <div class="result-grid">
      <div class="result"><span class="help">Pixel extent</span><strong>${measurement ? formatNumber(measurement.pixel_extent, 2) : '—'}</strong></div>
      <div class="result"><span class="help">Angular extent</span><strong>${measurement ? `${formatNumber(measurement.angular_extent_deg, 5)}°` : '—'}</strong></div>
      <div class="result"><span class="help">Status</span><strong>${measurement ? 'Derived' : 'Waiting'}</strong></div>
    </div>
    ${scenarios.length ? `<div class="table-wrap"><table><caption>Assumption-based physical-extent scenarios</caption><thead><tr><th scope="col">Assumed range</th><th scope="col">Physical extent scenario</th><th scope="col">Status</th></tr></thead><tbody>${scenarios.map((item) => `<tr><td>${item.range_m} m</td><td>${formatNumber(item.physical_extent_m, 4)} m</td><td>${badge('Assumption-based', 'assumed')}</td></tr>`).join('')}</tbody></table></div>` : ''}
    <div class="callout warning"><strong>Do not publish scenario values as measured size.</strong><p class="muted">Without independent range, the same angular extent can represent a small nearby object or a large distant object.</p></div>
  </div>`;
}

function reviewStep() {
  refreshEvidenceLevel(state.caseData);
  const level = state.caseData.evidence_level;
  const result = validateCase(state.caseData);
  return `<div class="stack"><div><span class="eyebrow">Step 5</span><h2 id="case-step-heading" tabindex="-1">Conclude only what the case supports</h2><p class="muted">Limitations sit beside findings and travel with the export.</p></div>
    <div class="metrics">${metric('Evidence level', `${level} / 7`)}${metric('Assets', state.caseData.assets.length)}${metric('Measurements', state.caseData.measurements.length)}${metric('Validation', result.valid ? 'Ready' : 'Needs work')}</div>
    <div><div class="evidence-ladder" aria-label="Evidence level ${level} of 7">${Array.from({ length: 8 }, (_, index) => `<div class="evidence-segment ${index <= level ? 'active' : ''}"></div>`).join('')}</div><p class="help">Version 0.1 can establish at most Level 2. Higher levels require corroboration not implemented here.</p></div>
    <label class="field">Human-reviewed verdict<select id="verdict"><option value="identified" ${state.caseData.verdict === 'identified' ? 'selected' : ''}>Identified</option><option value="probably-identified" ${state.caseData.verdict === 'probably-identified' ? 'selected' : ''}>Probably identified</option><option value="unresolved" ${state.caseData.verdict === 'unresolved' ? 'selected' : ''}>Unresolved</option><option value="insufficient-evidence" ${state.caseData.verdict === 'insufficient-evidence' ? 'selected' : ''}>Insufficient evidence</option></select></label>
    <fieldset class="panel stack"><legend><strong>Conventional checks</strong></legend>${['Aircraft or transponder data','Satellite or celestial source','Known camera artifact','Insect, bird, bat, or debris','Weather or atmospheric source'].map((label) => `<label class="check-row"><input type="checkbox" value="${escapeHtml(label)}" ${state.caseData.review.conventional_checks.includes(label) ? 'checked' : ''}><span>${escapeHtml(label)}</span></label>`).join('')}</fieldset>
    <label class="field">Reviewer notes<textarea id="review-notes">${escapeHtml(state.caseData.review.reviewer_notes)}</textarea></label>
    <div class="grid-2"><div class="callout"><strong>Supported</strong><p class="muted">Source identity, declared calibration, and angular measurement when present.</p></div><div class="callout warning"><strong>Not established</strong><p class="muted">Origin, intent, true range, physical size, and extraordinary mechanism.</p></div></div>
    <div class="actions"><button id="export-json" type="button" class="primary">Download .opv.json</button><button id="export-html" type="button">Download HTML report</button><button id="reset-case" type="button" class="ghost">Start over</button></div>
    <div id="validation-errors" class="status-line" aria-live="polite">${result.valid ? 'Case structure passes v0.1 validation.' : result.errors.map(escapeHtml).join(' ')}</div>
  </div>`;
}

function bindCaseStep() {
  document.querySelector('#case-file')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const status = document.querySelector('#case-status');
    if (file.size > MAX_BROWSER_HASH_BYTES) {
      status.textContent = 'This file exceeds the 250 MB browser-safe limit. Preserve it externally and use a future streaming or desktop verifier.';
      event.target.value = '';
      return;
    }
    status.textContent = 'Hashing locally…';
    let sha256;
    try {
      sha256 = await hashFile(file);
    } catch (error) {
      status.textContent = `Hashing failed: ${error.message}`;
      return;
    }
    if (state.selectedImageUrl) URL.revokeObjectURL(state.selectedImageUrl);
    state.selectedImageUrl = null;
    state.image = null;
    state.measurementPoints = [];
    state.caseData.measurements = [];
    state.selectedFile = file;
    const assetClass = document.querySelector('#asset-class')?.value || 'original';
    state.caseData.assets = [{
      asset_id: `ASSET-${String(Date.now())}`,
      name: file.name,
      asset_class: assetClass,
      is_evidence: assetClass !== 'generated',
      sha256,
      size_bytes: file.size,
      media_type: file.type || 'application/octet-stream',
      last_modified: file.lastModified ? new Date(file.lastModified).toISOString() : null,
    }];
    if (file.type.startsWith('image/')) {
      state.selectedImageUrl = URL.createObjectURL(file);
      try {
        state.image = await loadImage(state.selectedImageUrl);
        state.caseData.calibration.horizontal_pixels ||= state.image.naturalWidth;
        state.caseData.calibration.vertical_pixels ||= state.image.naturalHeight;
      } catch {
        status.textContent = 'The source was hashed, but the image could not be decoded for measurement.';
        state.image = null;
      }
    }
    refreshEvidenceLevel(state.caseData);
    renderCase();
  });

  document.querySelector('#asset-class')?.addEventListener('change', (event) => {
    const asset = state.caseData.assets[0];
    if (!asset) return;
    asset.asset_class = event.target.value;
    asset.is_evidence = event.target.value !== 'generated';
    refreshEvidenceLevel(state.caseData);
  });

  const canvas = document.querySelector('#measurement-canvas');
  if (canvas) {
    drawCanvas(canvas);
    canvas.addEventListener('click', (event) => handleCanvasClick(event, canvas));
  }
  document.querySelector('#clear-points')?.addEventListener('click', () => {
    state.measurementPoints = [];
    state.caseData.measurements = [];
    renderCaseStep();
  });
  document.querySelector('#apply-coordinates')?.addEventListener('click', () => {
    const values = [
      numericOrNull(document.querySelector('#point-1-x')?.value),
      numericOrNull(document.querySelector('#point-1-y')?.value),
      numericOrNull(document.querySelector('#point-2-x')?.value),
      numericOrNull(document.querySelector('#point-2-y')?.value),
    ];
    if (values.some((value) => value === null || value < 0)) {
      const status = document.querySelector('#case-status');
      if (status) status.textContent = 'Enter four non-negative endpoint coordinates.';
      return;
    }
    state.measurementPoints = [
      { x: values[0], y: values[1] },
      { x: values[2], y: values[3] },
    ];
    updateMeasurement();
    renderCaseStep();
  });

  document.querySelector('#export-json')?.addEventListener('click', () => {
    syncCurrentStep();
    refreshEvidenceLevel(state.caseData);
    const result = validateCase(state.caseData);
    if (!result.valid) return validateAndAnnounce();
    downloadText(safeFilename(state.caseData.title, 'opv.json'), JSON.stringify(state.caseData, null, 2) + '\n', 'application/json');
  });
  document.querySelector('#export-html')?.addEventListener('click', () => {
    syncCurrentStep();
    refreshEvidenceLevel(state.caseData);
    const result = validateCase(state.caseData);
    if (!result.valid) return validateAndAnnounce();
    downloadText(safeFilename(state.caseData.title, 'opv.html'), buildHtmlReport(state.caseData), 'text/html');
  });
  document.querySelector('#reset-case')?.addEventListener('click', () => {
    if (state.selectedImageUrl) URL.revokeObjectURL(state.selectedImageUrl);
    state.caseData = createCase();
    state.caseStep = 0;
    state.selectedFile = null;
    state.selectedImageUrl = null;
    state.image = null;
    state.measurementPoints = [];
    renderCase();
  });
}

function syncCurrentStep() {
  if (state.caseStep === 0) {
    state.caseData.title = document.querySelector('#case-title')?.value.trim() || state.caseData.title;
    state.caseData.privacy = document.querySelector('#case-privacy')?.value || state.caseData.privacy;
    state.caseData.observation_summary = document.querySelector('#case-summary')?.value.trim() || '';
  }
  if (state.caseStep === 2) {
    state.caseData.calibration.horizontal_field_of_view_deg = numericOrNull(document.querySelector('#hfov')?.value);
    state.caseData.calibration.horizontal_pixels = integerOrNull(document.querySelector('#hpixels')?.value);
    state.caseData.calibration.vertical_pixels = integerOrNull(document.querySelector('#vpixels')?.value);
    state.caseData.calibration.frame_rate_fps = numericOrNull(document.querySelector('#fps')?.value);
    state.caseData.calibration.status = document.querySelector('#cal-status')?.value || 'unknown';
    updateMeasurement();
  }
  if (state.caseStep === 4) {
    state.caseData.verdict = document.querySelector('#verdict')?.value || state.caseData.verdict;
    state.caseData.review.reviewer_notes = document.querySelector('#review-notes')?.value.trim() || '';
    state.caseData.review.conventional_checks = [...document.querySelectorAll('.check-row input:checked')].map((input) => input.value);
  }
  refreshEvidenceLevel(state.caseData);
}

function numericOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) && value !== '' ? number : null;
}
function integerOrNull(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) && value !== '' ? number : null;
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

function drawCanvas(canvas) {
  const context = canvas.getContext('2d');
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!state.image) {
    context.fillStyle = '#0f1720';
    context.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }
  canvas.width = state.image.naturalWidth;
  canvas.height = state.image.naturalHeight;
  context.drawImage(state.image, 0, 0);
  if (state.measurementPoints.length) {
    context.save();
    context.strokeStyle = '#70d4ff';
    context.fillStyle = '#70d4ff';
    context.lineWidth = Math.max(2, canvas.width / 700);
    for (const point of state.measurementPoints) {
      context.beginPath();
      context.arc(point.x, point.y, Math.max(5, canvas.width / 240), 0, Math.PI * 2);
      context.fill();
    }
    if (state.measurementPoints.length === 2) {
      context.beginPath();
      context.moveTo(state.measurementPoints[0].x, state.measurementPoints[0].y);
      context.lineTo(state.measurementPoints[1].x, state.measurementPoints[1].y);
      context.stroke();
    }
    context.restore();
  }
}

function handleCanvasClick(event, canvas) {
  if (!state.image) return;
  const rect = canvas.getBoundingClientRect();
  const point = {
    x: (event.clientX - rect.left) * canvas.width / rect.width,
    y: (event.clientY - rect.top) * canvas.height / rect.height,
  };
  if (state.measurementPoints.length >= 2) state.measurementPoints = [];
  state.measurementPoints.push(point);
  updateMeasurement();
  renderCaseStep();
}

function updateMeasurement() {
  if (state.measurementPoints.length !== 2) return;
  const pixels = pointDistance(state.measurementPoints[0], state.measurementPoints[1]);
  const calibration = state.caseData.calibration;
  if (!(calibration.horizontal_field_of_view_deg > 0 && calibration.horizontal_pixels > 0)) return;
  const angle = angularExtentFromPixels(pixels, calibration.horizontal_field_of_view_deg, calibration.horizontal_pixels);
  state.caseData.measurements = [{
    measurement_id: 'MEASUREMENT-001',
    asset_id: state.caseData.assets[0]?.asset_id || null,
    pixel_extent: round(pixels, 4),
    angular_extent_deg: round(angle, 7),
    formula: 'pixel_extent * horizontal_field_of_view_deg / horizontal_pixels',
    status: 'derived',
    points: state.measurementPoints.map((point) => ({ x: round(point.x, 3), y: round(point.y, 3) })),
    scenarios: scenarioTable(angle).map((item) => ({ ...item, physical_extent_m: round(item.physical_extent_m, 7) })),
  }];
  refreshEvidenceLevel(state.caseData);
}

function validateAndAnnounce() {
  syncCurrentStep();
  const result = validateCase(state.caseData);
  const element = document.querySelector('#validation-errors') || document.querySelector('#case-status');
  if (element) {
    element.textContent = result.valid ? 'Case structure passes v0.1 validation.' : result.errors.join(' ');
    if (!result.valid) {
      element.setAttribute('tabindex', '-1');
      element.focus({ preventScroll: true });
    }
  }
}

function renderMethod() {
  main.innerHTML = `
    ${breadcrumbs([{ label: 'Home', href: '#/' }, { label: 'Method' }])}
    <section class="stack">
      <div class="section-head"><div><span class="eyebrow">Method before mystery</span><h1 style="font-size:clamp(2rem,5vw,3.8rem)">A trustworthy encounter with ambiguity.</h1></div><p>The method remains useful whether an event is ultimately explained conventionally, remains unresolved, or leads to a new scientific question.</p></div>
      <div class="flow">${['Capture','Calibrate','Corroborate','Characterize','Challenge','Communicate'].map((step, index) => `<div class="flow-step"><strong>${index + 1}. ${step}</strong></div>`).join('')}</div>
      <div class="grid-2">
        <article class="panel stack"><h2>Evidence ladder</h2>${barList([['Level 0 · Report',1],['Level 1 · Hashed source',2],['Level 2 · Calibrated measurement',3],['Level 3 · Multi-sensor',4],['Level 4 · Reconstruction',5],['Level 5 · Repeatability',6],['Level 6 · Replication',7],['Level 7 · Mechanism',8]])}<p class="help">Bar lengths illustrate progression, not current evidence volume.</p></article>
        <article class="panel stack"><h2>Default conclusion language</h2><div class="stack">${badge('Identified')}${badge('Probably identified')}${badge('Unresolved')}${badge('Insufficient evidence')}</div><p class="muted">The application never automatically declares non-human origin, exotic propulsion, dimensional transition, or conscious intent.</p></article>
      </div>
      <article class="panel stack"><h2>OPV profile v0.1 scope</h2><div class="grid-3"><div><h3>Included</h3><p class="muted">Local hashing, image-line measurement, transparent formulas, sample datasets, portable JSON, and HTML reports.</p></div><div><h3>Deliberately deferred</h3><p class="muted">Accounts, central hosting, AI classification, live sensors, radar integrations, and multi-station reconstruction.</p></div><div><h3>Why</h3><p class="muted">The first release must be small enough for the public to understand, validate, fork, and improve.</p></div></div></article>
    </section>`;
}

async function router() {
  const path = location.hash.slice(1) || '/';
  if (path === '/') renderHome();
  else if (path === '/decision') renderDecisionLab(main);
  else if (path === '/datasets') renderDatasets();
  else if (path === '/case') renderCase();
  else if (path === '/method') renderMethod();
  else if (path.startsWith('/dataset/')) await renderDataset(path.split('/')[2]);
  else main.innerHTML = `<section class="panel stack"><h1>Page not found</h1><a href="#/">Return home</a></section>`;
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

window.addEventListener('hashchange', router);
router();

