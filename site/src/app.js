import { renderDecisionLab } from './decision-ui.js';

const main = document.querySelector('#main');

async function router() {
  const path = location.hash.slice(1) || '/';
  const decisionRoute = ['/', '/decision', '/decision/new', '/decision/example', '/decision/open', '/method'].includes(path);
  if (decisionRoute) {
    document.title = 'Frontier Decision Engine';
    renderDecisionLab(main, {
      openFile: path === '/decision/open',
      entryMode: path === '/decision/new' ? 'blank' : path === '/decision/example' ? 'ready-example' : null,
      focusMethod: path === '/method',
    });
  } else {
    document.title = 'Page Not Found | Frontier Decision Engine';
    main.innerHTML = `<section class="panel stack"><h1>Page not found</h1><a href="#/">Return to Frontier Decision Engine</a></section>`;
  }
  main.dataset.route = path;
  main.focus({ preventScroll: true });
  if (path !== '/method') window.scrollTo({ top: 0, behavior: 'auto' });
}

window.addEventListener('hashchange', router);
router();
