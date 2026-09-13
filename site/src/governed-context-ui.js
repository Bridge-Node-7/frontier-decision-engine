import {
  clearGovernedContextHandoff,
  decisionContextView,
  governedContextSummary,
  setGovernedContextHandoff,
  validateDecisionContextPacket,
} from './lib/governed-context.js';

const MAX_CONTEXT_BYTES = 1024 * 1024;

function element(tag, text = '', className = '') {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}

function listSection(title, values, emptyText) {
  const section = element('section', '', 'panel stack');
  section.append(element('h2', title));
  if (!values.length) {
    section.append(element('p', emptyText, 'muted'));
    return section;
  }
  const list = document.createElement('ul');
  for (const value of values) {
    const item = document.createElement('li');
    item.textContent = String(value);
    list.append(item);
  }
  section.append(list);
  return section;
}

function proofSection(items) {
  const section = element('section', '', 'panel stack');
  section.append(element('h2', 'What needs proof'));
  if (!items.length) {
    section.append(element('p', 'No active ProofRequests are carried in this packet.', 'muted'));
    return section;
  }
  const list = document.createElement('ul');
  for (const proof of items) {
    const item = document.createElement('li');
    const title = element('strong', `${proof.id}: ${proof.question}`);
    item.append(title);
    if (proof.owner || proof.status) item.append(document.createTextNode(` — owner: ${proof.owner || 'unspecified'}; status: ${proof.status || 'unspecified'}`));
    list.append(item);
  }
  section.append(list);
  return section;
}

function renderVerified(main, packet) {
  const view = decisionContextView(packet);
  main.replaceChildren();

  const hero = element('section', '', 'fde-hero');
  hero.append(element('span', 'Governed context', 'eyebrow'));
  hero.append(element('h1', 'Mission Graph context'));
  hero.append(element('p', packet.question, 'hero-line'));
  hero.append(element('p', 'Verified local preparation context. It is not a recommendation, approval, certification, or recorded FDE decision.', 'lede'));

  const badges = element('p', '', 'actions');
  badges.append(element('span', packet.classification, 'badge'));
  badges.append(element('span', packet.compatibility, 'badge'));
  badges.append(element('span', 'SHA-256 verified', 'badge'));
  hero.append(badges);
  main.append(hero);

  const boundary = element('section', '', 'panel stack');
  boundary.append(element('h2', 'Authority boundary'));
  boundary.append(element('p', `Accountable human: ${packet.decision_owner}`));
  boundary.append(element('p', packet.handling.instruction, 'muted'));
  boundary.append(element('p', 'This context is held only in page memory. Refreshing or closing the page discards it. FDE does not place it in normal browser autosave.', 'muted'));
  main.append(boundary);

  const grid = element('div', '', 'grid-2');
  grid.append(listSection('What we know', view.known, 'No supported evidence statements are carried in this packet.'));
  grid.append(listSection('What remains assumed', view.assumed, 'No explicit assumptions are carried in this packet.'));
  grid.append(listSection('What is disputed', view.disputed, 'No contradicted evidence statements are carried in this packet.'));
  grid.append(listSection('What we do not know', view.unknown, 'No unresolved unknowns are carried in this packet.'));
  grid.append(proofSection(view.needsProof));
  grid.append(listSection('What may change', view.conditionsToWatch, 'No explicit reassessment conditions are carried in this packet.'));
  grid.append(listSection('What is stale or expired', view.expired, 'No expired evidence statements are carried in this packet.'));
  main.append(grid);

  const why = document.createElement('details');
  why.className = 'panel stack';
  const summary = element('summary');
  summary.append(element('strong', 'Show me why'));
  summary.append(element('span', 'Source lineage and packet identity', 'help'));
  why.append(summary);
  const body = element('div', '', 'decision-section-body stack');
  for (const [label, value] of [
    ['Packet', packet.packet_id],
    ['Source graph', packet.source_graph_id],
    ['Source record', packet.provenance.source_record_id],
    ['Source record SHA-256', packet.provenance.source_record_sha256],
    ['Packet SHA-256', packet.content_sha256],
    ['Generated at', packet.provenance.generated_at],
    ['Model type', packet.provenance.model_type],
  ]) {
    const row = element('p');
    row.append(element('strong', `${label}: `));
    row.append(document.createTextNode(String(value)));
    body.append(row);
  }
  why.append(body);
  main.append(why);

  const actions = element('div', '', 'actions');
  const open = element('button', 'Open Decision Lab with this context');
  open.type = 'button';
  open.addEventListener('click', () => {
    setGovernedContextHandoff(packet);
    location.hash = '#/decision';
  });
  const clear = element('button', 'Clear context', 'secondary');
  clear.type = 'button';
  clear.addEventListener('click', () => {
    clearGovernedContextHandoff();
    renderGovernedContext(main);
  });
  actions.append(open, clear);
  main.append(actions);

  const hiddenSummary = element('pre', governedContextSummary(packet), 'sr-only');
  hiddenSummary.setAttribute('aria-hidden', 'true');
  main.append(hiddenSummary);
}

function showErrors(status, messages) {
  status.replaceChildren();
  status.className = 'panel stack';
  status.append(element('h2', 'Context not accepted'));
  status.append(element('p', 'FDE rejected this packet before using it.', 'muted'));
  const list = document.createElement('ul');
  for (const message of messages.slice(0, 8)) list.append(element('li', message));
  status.append(list);
}

export function renderGovernedContext(main) {
  clearGovernedContextHandoff();
  main.innerHTML = `
    <section class="fde-hero" aria-labelledby="context-title">
      <span class="eyebrow">Frontier Decision Engine</span>
      <h1 id="context-title">Open governed Mission Graph context</h1>
      <p class="hero-line">Bring verified preparation context into a human-owned decision.</p>
      <p class="lede">FDE validates the packet locally, verifies its SHA-256 content digest, and keeps PRIVATE or PROTECTED context in page memory only.</p>
    </section>
    <section class="panel stack" aria-labelledby="context-open-title">
      <h2 id="context-open-title">Choose a Decision Context Packet</h2>
      <p>No upload occurs. The file is read only by this browser page.</p>
      <label class="field" for="mission-context-file">Mission Graph Decision Context Packet (.json)
        <input id="mission-context-file" type="file" accept="application/json,.json">
        <span class="help">Supported contract: Mission Graph Decision Context Packet 0.2.0 · FDE_PREPARATION_ONLY · PRIVATE or PROTECTED.</span>
      </label>
      <p class="muted">Do not use this route as a publishing surface. Refreshing the page intentionally clears accepted context.</p>
    </section>
    <div id="mission-context-status" aria-live="polite"></div>`;

  const input = main.querySelector('#mission-context-file');
  const status = main.querySelector('#mission-context-status');
  input?.addEventListener('change', async () => {
    clearGovernedContextHandoff();
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_CONTEXT_BYTES) {
      showErrors(status, ['Decision Context Packet exceeds the 1 MiB local intake limit.']);
      return;
    }
    try {
      const text = await file.text();
      const packet = JSON.parse(text);
      const result = await validateDecisionContextPacket(packet);
      if (!result.valid) {
        showErrors(status, result.errors);
        return;
      }
      renderVerified(main, packet);
    } catch {
      showErrors(status, ['Decision Context Packet is not valid UTF-8 JSON or cannot be verified in this browser.']);
    }
  });
}
