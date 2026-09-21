import { installUniversalDecisionEnhancer } from './decision-map.js';

const main = document.querySelector('#main');
const GUIDED_CONTEXT_KEY = 'fde.guided-framing.context.v1';
const UNIVERSAL_CONTEXT_KEY = 'fde.universal.context.v1';

function consumeHandoff() {
  try {
    if (globalThis.sessionStorage?.getItem('fde.universal.handoff') === '1') {
      globalThis.sessionStorage.removeItem('fde.universal.handoff');
      return 'universal';
    }
    if (globalThis.sessionStorage?.getItem('fde.guided-framing.handoff') === '1') {
      globalThis.sessionStorage.removeItem('fde.guided-framing.handoff');
      return 'guided';
    }
  } catch { /* keep normal navigation working */ }
  return '';
}

function readContext(kind) {
  const key = kind === 'universal' ? UNIVERSAL_CONTEXT_KEY : GUIDED_CONTEXT_KEY;
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const value = String(parsed?.startingPoint || '');
    globalThis.sessionStorage?.removeItem(key);
    return parsed?.version === 1 && value.length <= 12000 ? value : '';
  } catch { return ''; }
}

async function consumeGovernedContext() {
  try {
    const { consumeGovernedContextHandoff, governedContextSummary } = await import('./lib/governed-context.js');
    const packet = consumeGovernedContextHandoff();
    return packet ? governedContextSummary(packet) : '';
  } catch { return ''; }
}

function showContext(kind, governedText = '') {
  const startingPoint = kind === 'governed' ? governedText : readContext(kind);
  const work = main.querySelector('#decision-work');
  if (!startingPoint || !work) return;
  const details = document.createElement('details');
  details.className = 'soft-panel guided-starting-context';
  const summary = document.createElement('summary');
  const title = document.createElement('strong');
  title.textContent = kind === 'universal'
    ? 'Starting context from FDE'
    : kind === 'governed'
      ? 'Verified Mission Graph preparation context'
      : 'Starting context from Guided framing';
  const help = document.createElement('span');
  help.className = 'help';
  help.textContent = kind === 'governed'
    ? 'Memory-only preparation context — not autosaved, scored, treated as evidence, or recorded as the decision.'
    : 'Context only — it is not scored or treated as evidence.';
  summary.append(title, help);
  const body = document.createElement('pre');
  body.className = 'decision-section-body guided-context-text';
  body.textContent = startingPoint;
  details.append(summary, body);
  work.prepend(details);
}

async function router() {
  const path = location.hash.slice(1) || '/';
  let handoff = '';
  let governedText = '';
  if (path === '/') {
    document.title = 'Frontier Decision Engine';
    const { renderUniversalDecisionExperience } = await import('./universal-ui.js');
    renderUniversalDecisionExperience(main);
  } else if (path === '/framing') {
    document.title = 'Frontier Decision Engine';
    const { renderGuidedFraming } = await import('./guided-framing-ui.js');
    renderGuidedFraming(main);
  } else if (path === '/context') {
    document.title = 'Governed Context | Frontier Decision Engine';
    const { renderGovernedContext } = await import('./governed-context-ui.js');
    renderGovernedContext(main);
  } else {
    const decisionRoute = ['/decision', '/decision/new', '/decision/example', '/decision/open', '/method'].includes(path);
    if (decisionRoute) {
      document.title = 'Frontier Decision Engine';
      const { renderDecisionLab } = await import('./decision-ui.js');
      handoff = path === '/decision' ? consumeHandoff() : '';
      if (path === '/decision') {
        governedText = await consumeGovernedContext();
        if (governedText) handoff = 'governed';
      }
      renderDecisionLab(main, {
        openFile: path === '/decision/open',
        entryMode: path === '/decision/new' ? 'blank' : path === '/decision/example' ? 'ready-example' : null,
        focusMethod: path === '/method',
      });
      if (handoff) {
        main.querySelector('#resume-browser-draft')?.click();
        showContext(handoff, governedText);
      }
    } else {
      document.title = 'Page Not Found | Frontier Decision Engine';
      main.innerHTML = `<section class="panel stack"><h1>Page not found</h1><p>This route is not part of the current Frontier Decision Engine.</p><div class="actions"><a class="button primary" href="#/">Return to Frontier Decision Engine</a><a class="button" href="#/framing">Use Guided framing</a></div></section>`;
    }
  }
  main.dataset.route = path;
  if (!handoff && path !== '/method') main.focus({ preventScroll: true });
  if (path !== '/method') window.scrollTo({ top: 0, behavior: 'auto' });
}

installUniversalDecisionEnhancer(main);
window.addEventListener('hashchange', router);
router();
