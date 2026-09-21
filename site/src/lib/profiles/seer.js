export const SEER_PROFILE_ID = 'sustainability-seer';
export const SEER_PROFILE_LABEL = 'SEER sustainability reminder';

export const SEER_DIMENSIONS = Object.freeze(['people', 'planet', 'profits', 'product']);

export const SEER_DIMENSION_PROMPTS = Object.freeze({
  people: 'Who could be affected, and what must remain true?',
  planet: 'What environmental or resource boundary matters?',
  profits: 'Is the pathway economically durable?',
  product: 'Does the product or system meet the mission requirement?',
});

export function isSeerProfile(mode) {
  return mode === SEER_PROFILE_ID;
}

export function createSeerCriteria(startIndex = 0) {
  return SEER_DIMENSIONS.map((dimension, index) => ({
    criterion_id: `CRT-${String(startIndex + index + 1).padStart(3, '0')}`,
    dimension,
    label: '',
    requirement: '',
    must_be_true: false,
    evidence_state: 'unknown',
    outcome: 'not-assessable',
    source_refs: [],
    evidence_need: '',
    affected_party_ids: [],
    missing_perspectives: [],
    assumptions: [],
    limitations: [],
  }));
}
