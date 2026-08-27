import { installUniversalDecisionEnhancer } from './luxury-map.js';

const main = document.querySelector('#main');
const RESCUE_CONTEXT_KEY = 'fde.rescue.context.v1';
const UNIVERSAL_CONTEXT_KEY = 'fde.universal.context.v1';

function consumeHandoff() {
  try {
    if (globalThis.sessionStorage?.getItem('fde.universal.handoff') === '1') {
      globalThis.sessionStorage.removeItem('fde.universal.handoff');
      return 'universal';
    }
    if (globalThis.sessionStorage?.getItem('fde.rescue.handoff') === '1') {
      globalThis.sessionStorage.removeItem('fde.rescue.handoff');
      return 'rescue';
    }
  } catch { /* keep normal navigation working */ }
  return '';
}

function readContext(kind) {
  const key = kind === 'universal' ? UNIVERSAL_CONTEXT_KEY : RESCUE_CONTEXT_KEY;
  try {
    const raw = globalThis.sessionStorage?.getItem(key);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const value = String(parsed?.startingPoint || '');
    globalThis.sessionStorage?.removeItem(key);
    return parsed?.version === 1 && value.length <= 12000 ? value : '';
  } catch { return ''; }
}

function showContext(kind) {
  const startingPoint = readContext(kind);
  const work = main.querySelector('#decision-work');
  if (!startingPoint || !work) return;
  const details = document.createElement('details');
  details.className = 'soft-panel rescue-starting-context';
  const summary = document.createElement('summary');
  const title = document.createElement('strong');
  title.textContent = kind === 'universal' ? 'Starting context from FDE' : 'Starting context from Decision Rescue';
  const help = document.createElement('span');
  help.className = 'help';
  help.textContent = 'Context only — it is not scored or treated as evidence.';
  summary.append(title, help);
  const body = document.createElement('p');
  body.className = 'decision-section-body rescue-context-text';
  body.textContent = startingPoint;
  details.append(summary, body);
  work.prepend(details);
}

async function router() {
  const path = location.hash.slice(1) || '/';
  let handoff = '';
  if (path === '/') {
    document.title = 'Frontier Decision Engine';
    const { renderUniversalDecisionExperience } = await import('./universal-ui.js');
    renderUniversalDecisionExperience(main);
  } else if (path === '/rescue') {
    document.title = 'Frontier Decision Engine';
    const { renderDecisionRescue } = await import('./rescue-ui.js');
    renderDecisionRescue(main);
  } else {
    const decisionRoute = ['/decision', '/decision/new', '/decision/example', '/decision/open', '/method'].includes(path);
    if (decisionRoute) {
      document.title = 'Frontier Decision Engine';
      const { renderDecisionLab } = await import('./decision-ui.js');
      handoff = path === '/decision' ? consumeHandoff() : '';
      renderDecisionLab(main, {
        openFile: path === '/decision/open',
        entryMode: path === '/decision/new' ? 'blank' : path === '/decision/example' ? 'ready-example' : null,
        focusMethod: path === '/method',
      });
      if (handoff) {
        main.querySelector('#resume-browser-draft')?.click();
        showContext(handoff);
      }
    } else {
      document.title = 'Page Not Found | Frontier Decision Engine';
      main.innerHTML = `<section class="panel stack"><h1>Page not found</h1><a href="#/">Return to Frontier Decision Engine</a></section>`;
    }
  }
  main.dataset.route = path;
  if (!handoff && path !== '/method') main.focus({ preventScroll: true });
  if (path !== '/method') window.scrollTo({ top: 0, behavior: 'auto' });
}

installUniversalDecisionEnhancer(main);
window.addEventListener('hashchange', router);
router();
