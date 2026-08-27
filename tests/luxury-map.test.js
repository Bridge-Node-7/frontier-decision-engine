import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionMapReadiness, whyThisMatters } from '../site/src/luxury-map.js';

function surfaceMarkup({ decision = 0, choices = 0, goals = 0, futures = 0 } = {}) {
  const card = (label, count) => `<section class="universal-card"><div class="universal-card-label">${label}</div><ul class="universal-list">${'<li><span>item</span></li>'.repeat(count)}</ul></section>`;
  return `<aside class="universal-surface">${card('Possible decision', decision)}${card('Choices mentioned', choices)}${card('What may matter', goals)}${card('What could change the answer', futures)}</aside>`;
}

function rootFrom(options) {
  const template = globalThis.document?.createElement?.('div');
  if (!template) return null;
  template.innerHTML = surfaceMarkup(options);
  return template;
}

test('Decision Map readiness uses a minimum explicit model, not a completion percentage', () => {
  const ready = rootFrom({ decision: 1, choices: 2, goals: 2, futures: 2 });
  assert.equal(decisionMapReadiness(ready).state, 'ready');

  const partial = rootFrom({ decision: 1, choices: 2, goals: 1, futures: 2 });
  assert.equal(decisionMapReadiness(partial).state, 'clarify');

  const empty = rootFrom({});
  assert.equal(decisionMapReadiness(empty).state, 'start');
});

test('Decision Map readiness explanations reduce effort instead of demanding more work', () => {
  assert.match(whyThisMatters({ state: 'start' }), /start with whatever you have/i);
  assert.match(whyThisMatters({ state: 'clarify' }), /before doing more work/i);
  assert.match(whyThisMatters({ state: 'ready' }), /enough explicit structure/i);
});
