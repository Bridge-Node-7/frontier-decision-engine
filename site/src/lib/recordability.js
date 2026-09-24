import { boundaryForInput } from './input-boundaries.js';

function addField(fields, path, value) {
  const text = String(value ?? '').trim();
  if (text) fields.push({ path, value: text });
}

function addArrayFields(fields, path, values) {
  if (!Array.isArray(values)) return;
  values.forEach((value, index) => addField(fields, `${path}[${index}]`, value));
}

export function decisionBearingFields(decision) {
  const fields = [];
  addField(fields, 'question', decision?.question);
  addField(fields, 'title', decision?.title);

  (decision?.objectives || []).forEach((objective, index) => {
    addField(fields, `objectives[${index}].label`, objective?.label);
  });

  (decision?.strategies || []).forEach((strategy, index) => {
    addField(fields, `strategies[${index}].label`, strategy?.label);
    addField(fields, `strategies[${index}].description`, strategy?.description);
    addField(fields, `strategies[${index}].action_now`, strategy?.action_now);
    addField(fields, `strategies[${index}].trigger`, strategy?.trigger);
    addField(fields, `strategies[${index}].contingency`, strategy?.contingency);
  });

  addField(fields, 'human_decision.rationale', decision?.human_decision?.rationale);
  addField(fields, 'human_decision.next_action', decision?.human_decision?.next_action);

  addArrayFields(fields, 'adaptive_pathway.act_now', decision?.adaptive_pathway?.act_now);
  addArrayFields(fields, 'adaptive_pathway.triggers', decision?.adaptive_pathway?.triggers);
  addArrayFields(fields, 'adaptive_pathway.contingencies', decision?.adaptive_pathway?.contingencies);

  const semantics = decision?.decision_semantics;
  (semantics?.conditions || []).forEach((condition, index) => {
    addField(fields, `decision_semantics.conditions[${index}].statement`, condition?.statement);
  });
  (semantics?.safeguards || []).forEach((condition, index) => {
    addField(fields, `decision_semantics.safeguards[${index}].statement`, condition?.statement);
  });
  (semantics?.monitoring || []).forEach((item, index) => {
    addField(fields, `decision_semantics.monitoring[${index}].response`, item?.response);
  });

  return fields;
}

export function decisionRecordability(decision) {
  for (const field of decisionBearingFields(decision)) {
    const boundary = boundaryForInput(field.value);
    if (boundary) return { recordable: false, field: field.path, boundary };
  }
  return { recordable: true, field: '', boundary: null };
}
