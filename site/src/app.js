const main = document.querySelector('#main');

function consumeRescueHandoff() {
  try {
    if (globalThis.sessionStorage?.getItem('fde.rescue.handoff') !== '1') return false;
    globalThis.sessionStorage.removeItem('fde.rescue.handoff');
    return true;
  } catch {
    return false;
  }
}

async function router() {
  const path = location.hash.slice(1) || '/';
  if (path === '/') {
    document.title = 'Frontier Decision Engine';
    const { renderDecisionRescue } = await import('./rescue-ui.js');
    renderDecisionRescue(main);
  } else {
    const decisionRoute = ['/decision', '/decision/new', '/decision/example', '/decision/open', '/method'].includes(path);
    if (decisionRoute) {
      document.title = 'Frontier Decision Engine';
      const { renderDecisionLab } = await import('./decision-ui.js');
      const rescueHandoff = path === '/decision' && consumeRescueHandoff();
      renderDecisionLab(main, {
        openFile: path === '/decision/open',
        entryMode: path === '/decision/new' ? 'blank' : path === '/decision/example' ? 'ready-example' : null,
        focusMethod: path === '/method',
      });
      if (rescueHandoff) main.querySelector('#resume-browser-draft')?.click();
    } else {
      document.title = 'Page Not Found | Frontier Decision Engine';
      main.innerHTML = `<section class="panel stack"><h1>Page not found</h1><a href="#/">Return to Frontier Decision Engine</a></section>`;
    }
  }
  main.dataset.route = path;
  main.focus({ preventScroll: true });
  if (path !== '/method') window.scrollTo({ top: 0, behavior: 'auto' });
}

window.addEventListener('hashchange', router);
router();
