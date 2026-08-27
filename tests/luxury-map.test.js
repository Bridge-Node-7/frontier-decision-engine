import test from 'node:test';
import assert from 'node:assert/strict';
import { decisionMapReadiness, whyThisMatters } from '../site/src/luxury-map.js';

function card(label, count) {
  const list = Array.from({ length: count }, () => ({}));
  return {
    querySelector(selector) {
      if (selector === '.universal-card-label') return { textContent: label };
      return null;
    },
    querySelectorAll(selector) {
      return selector === '.universal-list > li' ? list : [];
    },
  };
}

function rootFrom({ decision = 0, choices = 0, goals = 0, futures = 0 } = {}) {
  const cards = [
    card('Possible decision', decision),
    card('Choices mentioned', choices),
    card('What may matter', goals),
    card('What could change the answer', futures),
  ];
  return {
    querySelector(selector) {
      if (selector === '.universal-surface') {
        return {
          querySelectorAll(target) { return target === '.universal-card' ? cards : []; },
        };
      }
      return null;
    },
  };
}

test('Decision Map readiness uses a minimum explicit model, not a completion percentage', () => {
  assert.equal(decisionMapReadiness(rootFrom({ decision: 1, choices: 2, goals: 2, futures: 2 })).state, 'ready');
  assert.equal(decisionMapReadiness(rootFrom({ decision: 1, choices: 2, goals: 1, futures: 2 })).state, 'clarify');
  assert.equal(decisionMapReadiness(rootFrom({})).state, 'start');
});

test('Decision Map readiness explanations reduce effort instead of demanding more work', () => {
  assert.match(whyThisMatters({ state: 'start' }), /start with whatever you have/i);
  assert.match(whyThisMatters({ state: 'clarify' }), /before doing more work/i);
  assert.match(whyThisMatters({ state: 'ready' }), /enough explicit choices, priorities, and changing conditions/i);
});
