import { renderDecisionLab } from './decision-ui.js';
import { APPLICATION_VERSION } from './version.js';

const main = document.querySelector('#main');

const escapeHtml = (value) => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

function breadcrumbs(items) {
  return `<div class="breadcrumbs">${items.map((item, index) => {
    const divider = index ? '<span aria-hidden="true">/</span>' : '';
    return `${divider}${item.href ? `<a href="${item.href}">${escapeHtml(item.label)}</a>` : `<span>${escapeHtml(item.label)}</span>`}`;
  }).join('')}</div>`;
}

function badge(label, className = '') {
  return `<span class="badge ${className}">${escapeHtml(label)}</span>`;
}

function renderHome() {
  main.innerHTML = `
    <section class="engine-launch" data-surface="engine-launch">
      <div class="engine-intro stack">
        <span class="eyebrow">Bridge Node 7 · Frontier Decision Engine</span>
        <h1><span class="gradient-text">Compare choices</span><br>when the future is uncertain.</h1>
        <p class="lede">Frontier Decision Engine is a working decision interface. It helps you compare practical choices across the same possible futures and record why a decision advances.</p>
        <div class="actions">
          ${badge('Open source')}${badge('Runs in your browser')}${badge('Transparent inputs')}${badge('Human decides')}
        </div>
      </div>

      <aside class="launch-panel panel stack" aria-labelledby="launch-title">
        <span class="interface-label">Working application</span>
        <h2 id="launch-title">Start here.</h2>
        <p>Start with an empty bounded decision, or explore a synthetic critical-material example.</p>
        <a class="button primary launch-primary" data-action="start-decision" href="#/decision/new">Start a decision</a>
        <span class="launch-note">Opens the six-stage Decision Lab with user content empty.</span>
        <a class="button" data-action="open-decision-lab" href="#/decision/example">Try the ready example</a>
        <span class="launch-note">Opens the same Decision Lab with synthetic analysis inputs and no human decision preselected.</span>
        <a class="button" data-action="open-saved-decision" href="#/decision/open">Open an FDE file</a>
        <span class="launch-note">Open a completed decision file or an in-progress draft backup.</span>
        <a class="quiet-link" data-action="open-walkthrough" href="./start.html">See the walkthrough first →</a>
        <div class="launch-privacy">No account. No default upload. Changes save in this browser.</div>
      </aside>
    </section>

    <section class="stack after-click" aria-labelledby="after-click-title">
      <div class="section-head">
        <div><span class="eyebrow">After you open the Decision Lab</span><h2 id="after-click-title">Three things happen.</h2></div>
        <p>The interface stays focused on the decision from beginning to end.</p>
      </div>
      <div class="final-three-grid">
        <article class="final-card"><small>01</small><h3>Edit the ready case</h3><p>Define the decision, goals, choices, and future conditions.</p></article>
        <article class="final-card"><small>02</small><h3>Compare the choices</h3><p>See which goals each choice meets across the same futures.</p></article>
        <article class="final-card"><small>03</small><h3>Download the record</h3><p>Record the human decision, the reason, and the next action.</p></article>
      </div>
    </section>

    <section class="stack final-domain-section" aria-labelledby="domain-title">
      <div class="section-head">
        <div><span class="eyebrow">Critical materials and supply chains</span><h2 id="domain-title">From source to readiness.</h2></div>
        <p>The ready case compares source qualification and supply options while keeping evidence, assumptions, and trade-offs visible.</p>
      </div>
      <div class="final-supply-path" aria-label="Critical-material supply path">
        <span>Source</span><i aria-hidden="true">→</i>
        <span>Processing</span><i aria-hidden="true">→</i>
        <span>Component</span><i aria-hidden="true">→</i>
        <span>Qualification</span><i aria-hidden="true">→</i>
        <span>Readiness</span>
      </div>
    </section>

    <section class="final-scope-grid" aria-label="Current release scope">
      <article class="panel stack">
        <span class="eyebrow">What you can do now</span>
        <h2>Complete one decision from start to finish.</h2>
        <p class="muted">Edit three choices, four futures, and four goals. Save locally, reopen the decision file, and export a readable summary.</p>
        <a class="button primary" data-action="start-decision" href="#/decision/new">Start a decision</a>
      </article>
      <article class="panel stack">
        <span class="eyebrow">Clear boundary</span>
        <h2>The comparison informs. A person decides.</h2>
        <p class="muted">The ready case is synthetic. FDE does not certify a supplier, qualify a material, confirm capacity or compliance, or make an investment recommendation.</p>
        <a class="button" href="#/method">Review the Method</a>
      </article>
    </section>`;
}

function renderMethod() {
  main.innerHTML = `
    ${breadcrumbs([{ label: 'Home', href: '#/' }, { label: 'Method' }])}
    <section class="stack" data-surface="method">
      <div class="section-head">
        <div><span class="eyebrow">Method</span><h1 style="font-size:clamp(2rem,5vw,3.8rem)">Decision-making under deep uncertainty.</h1></div>
        <p>Use this approach when no single forecast is reliable. Compare the same choices across several plausible futures, keep the goals separate, and preserve the human judgment.</p>
      </div>

      <div class="final-three-grid">
        <article class="panel stack"><small>01</small><h2>Frame</h2><p class="muted">State the decision, the goals, the owner, and the assumptions.</p></article>
        <article class="panel stack"><small>02</small><h2>Compare</h2><p class="muted">Review the same choices against the same futures and goals.</p></article>
        <article class="panel stack"><small>03</small><h2>Decide</h2><p class="muted">Show unmet goals, ties, and incomplete information before recording the decision.</p></article>
      </div>

      <article class="panel stack">
        <span class="eyebrow">Current calculation</span>
        <h2>Visible and bounded.</h2>
        <p class="muted">Version ${APPLICATION_VERSION} uses three editable choices, four named futures, four separate goals, and 48 visible checks. It does not assign probabilities or combine every goal into one hidden score.</p>
        <div class="actions">${badge('48 visible checks')}${badge('Incomplete results pause comparison')}${badge('Ties remain visible')}${badge('Human decision')}</div>
      </article>

      <article class="panel stack">
        <span class="eyebrow">Reference-case boundary</span>
        <h2>Decision support, not certification.</h2>
        <p class="muted">The public critical-material case is synthetic. FDE does not certify suppliers, qualify materials, confirm production capacity, determine compliance, predict commodity prices, or recommend investments.</p>
      </article>
    </section>`;
}
async function router() {
  const path = location.hash.slice(1) || '/';
  if (path === '/') {
    document.title = 'Overview | Frontier Decision Engine';
    renderHome();
  } else if (path === '/decision' || path === '/decision/new' || path === '/decision/example' || path === '/decision/open') {
    document.title = path === '/decision/open' ? 'Open Decision | Frontier Decision Engine' : 'Decision Lab | Frontier Decision Engine';
    renderDecisionLab(main, {
      openFile: path === '/decision/open',
      entryMode: path === '/decision/new' ? 'blank' : path === '/decision/example' ? 'ready-example' : null,
    });
  } else if (path === '/method') {
    document.title = 'Method | Frontier Decision Engine';
    renderMethod();
  } else {
    document.title = 'Page Not Found | Frontier Decision Engine';
    main.innerHTML = `<section class="panel stack"><h1>Page not found</h1><a href="#/">Return home</a></section>`;
  }
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

window.addEventListener('hashchange', router);
router();
