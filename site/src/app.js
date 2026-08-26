const main = document.querySelector('#main');
const RESCUE_CONTEXT_KEY = 'fde.rescue.context.v1';

function consumeRescueHandoff() {
  try {
    if (globalThis.sessionStorage?.getItem('fde.rescue.handoff') !== '1') return false;
    globalThis.sessionStorage.removeItem('fde.rescue.handoff');
    return true;
  } catch {
    return false;
  }
}

function readRescueContext() {
  try {
    const raw = globalThis.sessionStorage?.getItem(RESCUE_CONTEXT_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw);
    const value = String(parsed?.startingPoint || '');
    globalThis.sessionStorage?.removeItem(RESCUE_CONTEXT_KEY);
    return parsed?.version === 1 && value.length <= 12000 ? value : '';
  } catch {
    return '';
  }
}

function showRescueContext() {
  const startingPoint = readRescueContext();
  const work = main.querySelector('#decision-work');
  if (!startingPoint || !work) return;
  const details = document.createElement('details');
  details.className = 'soft-panel rescue-starting-context';
  const summary = document.createElement('summary');
  const title = document.createElement('strong');
  title.textContent = 'Starting context from Decision Rescue';
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
  let rescueHandoff = false;
  if (path === '/') {
    document.title = 'Frontier Decision Engine';
    const { renderDecisionRescue } = await import('./rescue-ui.js');
    renderDecisionRescue(main);
  } else {
    const decisionRoute = ['/decision', '/decision/new', '/decision/example', '/decision/open', '/method'].includes(path);
    if (decisionRoute) {
      document.title = 'Frontier Decision Engine';
      const { renderDecisionLab } = await import('./decision-ui.js');
      rescueHandoff = path === '/decision' && consumeRescueHandoff();
      renderDecisionLab(main, {
        openFile: path === '/decision/open',
        entryMode: path === '/decision/new' ? 'blank' : path === '/decision/example' ? 'ready-example' : null,
        focusMethod: path === '/method',
      });
      if (rescueHandoff) {
        main.querySelector('#resume-browser-draft')?.click();
        showRescueContext();
      }
    } else {
      document.title = 'Page Not Found | Frontier Decision Engine';
      main.innerHTML = `<section class="panel stack"><h1>Page not found</h1><a href="#/">Return to Frontier Decision Engine</a></section>`;
    }
  }
  main.dataset.route = path;
  if (!rescueHandoff) main.focus({ preventScroll: true });
  if (path !== '/method') window.scrollTo({ top: 0, behavior: 'auto' });
}

window.addEventListener('hashchange', router);
router();
