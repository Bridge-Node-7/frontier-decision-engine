const ENHANCED_ATTR = 'data-fde-luxury-map-enhanced';

function text(value) {
  return String(value ?? '').trim();
}

function countListItems(card) {
  return card?.querySelectorAll('.universal-list > li').length || 0;
}

export function decisionMapReadiness(root) {
  const surface = root?.querySelector?.('.universal-surface');
  if (!surface) return { state: 'start', label: 'Start anywhere', detail: 'Give FDE the situation first. The map will grow from what you provide.' };

  const cards = [...surface.querySelectorAll('.universal-card')];
  const possibleDecision = cards.find((card) => text(card.querySelector('.universal-card-label')?.textContent).toLowerCase() === 'possible decision');
  const choices = cards.find((card) => text(card.querySelector('.universal-card-label')?.textContent).toLowerCase() === 'choices mentioned');
  const goals = cards.find((card) => text(card.querySelector('.universal-card-label')?.textContent).toLowerCase() === 'what may matter');
  const futures = cards.find((card) => text(card.querySelector('.universal-card-label')?.textContent).toLowerCase() === 'what could change the answer');

  const hasDecision = countListItems(possibleDecision) > 0;
  const choiceCount = countListItems(choices);
  const goalCount = countListItems(goals);
  const futureCount = countListItems(futures);
  const ready = hasDecision && choiceCount >= 2 && goalCount >= 2 && futureCount >= 2;

  if (ready) return { state: 'ready', label: 'Ready to compare', detail: 'FDE has enough explicit structure for the formal comparison. You can still correct the map first.' };
  if (hasDecision || choiceCount || goalCount || futureCount) {
    return { state: 'clarify', label: 'One useful step at a time', detail: 'Review the map. Only add or correct something when it would materially improve the decision.' };
  }
  return { state: 'start', label: 'Start anywhere', detail: 'You do not need a complete decision before FDE can help.' };
}

export function whyThisMatters(readiness) {
  if (readiness.state === 'ready') return 'The map is ready because FDE has a possible decision plus enough explicit choices, priorities, and changing conditions to enter the bounded comparison. You remain free to correct it before continuing.';
  if (readiness.state === 'clarify') return 'FDE is showing provisional structure first so you can see progress before doing more work. Add only the detail that materially changes what should be compared.';
  return 'The first job is relief, not completeness. Start with whatever you have; FDE can organize a useful starting point without pretending missing information is known.';
}

function addElement(parent, tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  parent.append(node);
  return node;
}

export function enhanceUniversalDecisionExperience(root) {
  const surface = root?.querySelector?.('.universal-surface');
  if (!surface || surface.getAttribute(ENHANCED_ATTR) === '1') return false;

  const readiness = decisionMapReadiness(root);
  const head = surface.querySelector('.universal-surface-head');
  if (head) {
    const badge = head.querySelector('.universal-badge');
    if (badge) badge.textContent = readiness.state === 'ready' ? 'Ready' : 'Draft';
    const pulse = addElement(head, 'span', 'universal-pulse');
    pulse.dataset.state = readiness.state;
    pulse.setAttribute('aria-label', readiness.label);
    pulse.textContent = readiness.label;
  }

  const next = surface.querySelector('.universal-next');
  if (next && !next.querySelector('.universal-why')) {
    const why = document.createElement('details');
    why.className = 'universal-why';
    const summary = document.createElement('summary');
    summary.textContent = 'Why this matters';
    const body = document.createElement('p');
    body.textContent = whyThisMatters(readiness);
    why.append(summary, body);
    next.append(why);
  }

  if (next && !surface.querySelector('.universal-stop')) {
    const stop = addElement(next, 'p', 'universal-stop', readiness.state === 'ready'
      ? 'You can compare now, or keep refining the map. There is no requirement to keep going.'
      : 'You can stop here. A useful partial map is still progress.');
    stop.setAttribute('role', 'note');
  }

  surface.setAttribute(ENHANCED_ATTR, '1');
  return true;
}

export function installUniversalDecisionEnhancer(root) {
  if (!root || root.dataset.fdeLuxuryObserver === '1') return () => {};
  root.dataset.fdeLuxuryObserver = '1';
  let scheduled = false;
  const apply = () => {
    scheduled = false;
    enhanceUniversalDecisionExperience(root);
  };
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    queueMicrotask(apply);
  });
  observer.observe(root, { childList: true, subtree: true });
  apply();
  return () => observer.disconnect();
}
