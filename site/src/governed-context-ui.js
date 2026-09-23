import {
  clearGovernedContextHandoff,
  decisionContextView,
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
    item.append(element('strong', `${proof.id}: ${proof.question}`));
    if (proof.owner || proof.status) item.append(document.createTextNode(` — owner: ${proof.owner || 'unspecified'}; status: ${proof.status || 'unspecified'}`));
    list.append(item);
  }
  section.append(list);
  return section;
}

function nextProofSection(proof) {
  const section = element('section', '', 'panel stack');
  section.append(element('h2', 'Next proof to reduce uncertainty'));
  const question = element('p');
  question.append(element('strong', `${proof.id}: ${proof.question}`));
  section.append(question);

  const attention = proof.attention || {};
  const dimensions = [
    ['Human priority', attention.human_priority],
    ['Decision imminence', attention.decision_imminence],
    ['Mission consequence', attention.mission_consequence],
    ['Uncertainty', attention.uncertainty],
  ].filter(([, value]) => value);

  if (dimensions.length) {
    const detail = element('p', '', 'muted');
    detail.textContent = dimensions.map(([label, value]) => `${label}: ${value}`).join(' · ');
    section.append(detail);
  }
  section.append(element(
    'p',
    'This is the first active item carried in Mission Graph’s human-owned attention queue. FDE does not calculate a priority score or make a recommendation.',
    'muted',
  ));
  return section;
}

function trustPanel(packet, result) {
  const section = element('section', '', 'panel stack');
  section.append(element('h2', 'Trust state'));
  const trust = result.trust || {};
  const rows = [
    ['Integrity', trust.integrity || 'NOT ASSESSED'],
    ['Origin', trust.origin || 'NOT ASSESSED'],
    ['Evidence assurance', trust.evidence || 'NOT ASSESSED'],
    ['Freshness', trust.freshness || 'NOT ASSESSED'],
    ['Authority', trust.authority || 'HUMAN-OWNED'],
  ];
  for (const [label, value] of rows) {
    const row = element('p');
    row.append(element('strong', `${label}: `));
    row.append(document.createTextNode(String(value)));
    section.append(row);
  }
  if (packet.schema_version === '0.3.0') {
    section.append(element('p', 'Integrity verification does not authenticate the packet issuer. Public FDE accepts only explicitly unauthenticated origin state unless a future external trust-policy verifier is configured.', 'muted'));
  } else {
    section.append(element('p', 'Legacy packet: origin authentication and freshness are not proven by the 0.2.0 contract.', 'muted'));
  }
  return section;
}

function renderVerified(main, packet, result) {
  const view = decisionContextView(packet);
  main.replaceChildren();

  const hero = element('section', '', 'fde-hero governed-context-hero');
  hero.append(element('span', 'Governed context', 'eyebrow'));
  hero.append(element('h1', 'Mission Graph context'));
  hero.append(element('p', packet.question, 'hero-line'));
  hero.append(element('p', 'Locally verified preparation context. Integrity, origin, evidence assurance, freshness, and human authority are separate properties.', 'lede'));

  const badges = element('p', '', 'actions');
  badges.append(element('span', packet.classification, 'badge'));
  badges.append(element('span', packet.compatibility, 'badge'));
  badges.append(element('span', `Integrity ${result.trust?.integrity || 'NOT ASSESSED'}`, 'badge'));
  badges.append(element('span', `Origin ${result.trust?.origin || 'NOT ASSESSED'}`, 'badge'));
  badges.append(element('span', `Freshness ${result.trust?.freshness || 'NOT ASSESSED'}`, 'badge'));
  hero.append(badges);
  main.append(hero);

  const boundary = element('section', '', 'panel stack');
  boundary.append(element('h2', 'Authority and handling boundary'));
  boundary.append(element('p', `Accountable human: ${packet.decision_owner}`));
  const label = packet.schema_version === '0.3.0' ? packet.handling.label : `BN7_${packet.classification}`;
  boundary.append(element('p', `${label} — internal BN7 handling label; not a U.S. Government classification marking.`, 'muted'));
  boundary.append(element('p', packet.handling.instruction, 'muted'));
  boundary.append(element('p', 'This context is held only in page memory. Refreshing or closing the page discards it. FDE does not place it in normal browser autosave.', 'muted'));
  if (!result.activeEligible) {
    boundary.append(element('p', 'This packet may be inspected, but it is not eligible to enter active decision preparation until its freshness/trust requirements are satisfied.', 'notice'));
  }
  main.append(boundary);
  main.append(trustPanel(packet, result));
  if (view.nextProof) main.append(nextProofSection(view.nextProof));

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
  summary.append(element('span', 'Source lineage, packet identity, and freshness', 'help'));
  why.append(summary);
  const body = element('div', '', 'decision-section-body stack');
  const identityRows = [
    ['Packet', packet.packet_id],
    ['Source graph', packet.source_graph_id],
    ['Source record', packet.provenance.source_record_id],
    ['Source record SHA-256', packet.provenance.source_record_sha256],
    ['Model type', packet.provenance.model_type],
  ];
  if (packet.schema_version === '0.3.0') {
    identityRows.push(
      ['Payload SHA-256', packet.integrity.payload_sha256],
      ['Envelope SHA-256', packet.integrity.envelope_sha256],
      ['Issued at', packet.freshness.issued_at],
      ['Source as of', packet.freshness.source_as_of],
      ['Review due at', packet.freshness.review_due_at ?? 'not established'],
      ['Valid until', packet.freshness.valid_until ?? 'not established'],
      ['Issuer reference', packet.origin.issuer_ref],
    );
  } else {
    identityRows.push(
      ['Legacy packet SHA-256', packet.content_sha256],
      ['Generated at', packet.provenance.generated_at],
    );
  }
  for (const [label, value] of identityRows) {
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
  open.disabled = !result.activeEligible;
  if (!result.activeEligible) open.setAttribute('aria-disabled', 'true');
  open.addEventListener('click', () => {
    if (!result.activeEligible) return;
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
    <section class="fde-hero governed-context-hero" aria-labelledby="context-title">
      <span class="eyebrow">Frontier Decision Engine</span>
      <h1 id="context-title">Open governed Mission Graph context</h1>
      <p class="hero-line">Bring bounded preparation context into a human-owned decision.</p>
      <p class="lede">FDE validates the packet locally and keeps BN7 PRIVATE or BN7 PROTECTED context in page memory only. Integrity is not authorship; freshness is evaluated separately.</p>
    </section>
    <section class="panel stack" aria-labelledby="context-open-title">
      <h2 id="context-open-title">Choose a Decision Context Packet</h2>
      <p>No upload occurs. The file is read only by this browser page.</p>
      <label class="field" for="mission-context-file">Mission Graph Decision Context Packet (.json)
        <input id="mission-context-file" type="file" accept="application/json,.json">
        <span class="help">Current contract: Decision Context Packet 0.3.0 · FDE_PREPARATION_ONLY · BN7 PRIVATE or BN7 PROTECTED. Legacy 0.2.0 packets are inspection-only.</span>
      </label>
      <p class="muted">BN7 PRIVATE/PROTECTED are internal handling labels, not U.S. Government classification markings. Do not use this public route as an approved controlled-information environment.</p>
      <p class="muted">Refreshing the page intentionally clears accepted context.</p>
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
      renderVerified(main, packet, result);
    } catch {
      showErrors(status, ['Decision Context Packet is not valid UTF-8 JSON or cannot be verified in this browser.']);
    }
  });
}
