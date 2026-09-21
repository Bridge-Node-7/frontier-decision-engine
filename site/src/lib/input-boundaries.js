function normalize(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

const selfHarmPattern = /\b(?:suicid(?:e|al)|self[\s-]?harm)\b|\b(?:kill|harm|hurt|injure)\s+(?:myself|ourselves)\b|\b(?:end|take)\s+(?:my|our)\s+(?:life|lives)\b|\b(?:don['’]?t|do not)\s+want\s+to\s+(?:live|be\s+alive)\b/i;
const treatmentActionPattern = /\b(?:stop|start|skip|miss|discontinue|quit|change|adjust|increase|decrease|reduce|raise|lower|halve|double|ration|taper|pause|delay)\b/i;
const treatmentSubjectPattern = /\b(?:medication|medicine|prescription|dose|treatment|therapy|insulin|chemotherapy|antidepressants?|antibiotics?|inhaler|steroids?|hormones?)\b/i;
const dangerousRestrictionPattern = /\b(?:stop\s+eating|starv(?:e|ing)(?:\s+myself)?|skip\s+(?:all\s+)?meals?|not\s+eat(?:ing)?|fast(?:ing)?\s+(?:for\s+)?(?:(?:[2-9]|[1-9]\d+)\s+days?|(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?|(?:a|one|two|three|four)\s+weeks?))\b/i;
const selfDosingSubjectPattern = /\b(?:medications?|medicines?|prescriptions?|drugs?|substances?|doses?|pills?|tablets?|capsules?|ibuprofen|acetaminophen|paracetamol|aspirin|naproxen|diphenhydramine|benadryl|nyquil|dayquil|cough\s+syrup|cough\s+medicine|antihistamines?|painkillers?|pain\s+relievers?|sleep\s+aids?|supplements?)\b/i;
const quantityComparisonPattern = /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b[^.!?\n]{0,48}\b(?:or|versus|vs\.?|instead\s+of|rather\s+than)\b[^.!?\n]{0,48}\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const ingestionActionPattern = /\b(?:take|taking|eat|eating|drink|drinking|swallow|swallowing|ingest|ingesting|dose|dosing|redose|redosing)\b/i;
const doseUnitPattern = /\b(?:mg|g|mcg|ug|ml|units?|pills?|tablets?|capsules?|doses?)\b/i;
const emergencyDelayPattern = /\b(?:(?:go|head|drive(?:\s+myself)?|take\s+\w+|bring\s+\w+)\s+(?:to\s+)?(?:the\s+)?(?:ER|emergency\s+room|emergency\s+department|urgent\s+care|hospital)|seek\s+(?:emergency|urgent)\s+care|call\s+(?:911|an\s+ambulance|emergency\s+services))\b[^.!?\n]{0,120}\b(?:or|versus|vs\.?|instead\s+of)\b[^.!?\n]{0,120}\b(?:wait(?:\s+it\s+out)?|delay|later|tomorrow|stay\s+home)\b|\b(?:wait(?:\s+it\s+out)?|delay|later|tomorrow|stay\s+home)\b[^.!?\n]{0,120}\b(?:or|versus|vs\.?|instead\s+of)\b[^.!?\n]{0,120}\b(?:(?:go|head|drive(?:\s+myself)?|take\s+\w+|bring\s+\w+)\s+(?:to\s+)?(?:the\s+)?(?:ER|emergency\s+room|emergency\s+department|urgent\s+care|hospital)|seek\s+(?:emergency|urgent)\s+care|call\s+(?:911|an\s+ambulance|emergency\s+services))\b/i;

function hasTreatmentChangeRequest(text) {
  return treatmentActionPattern.test(text) && treatmentSubjectPattern.test(text);
}

function hasDangerousRestrictionRequest(text) {
  return dangerousRestrictionPattern.test(text);
}

function hasSelfDosingEscalationRequest(text) {
  if (!quantityComparisonPattern.test(text)) return false;
  return selfDosingSubjectPattern.test(text) || (ingestionActionPattern.test(text) && doseUnitPattern.test(text));
}

function hasEmergencyCareDelayRequest(text) {
  return emergencyDelayPattern.test(text);
}

export function boundaryForInput(value) {
  const text = normalize(value);
  if (!text) return null;

  if (selfHarmPattern.test(text)) {
    return {
      kind: 'out_of_scope_self_harm',
      title: 'This decision is outside FDE’s comparison scope.',
      body: 'FDE is designed for technical, organizational, mission, and strategic decision support. It does not compare or optimize self-harm. If there may be immediate danger, contact local emergency services or a crisis service now.',
    };
  }

  if (hasEmergencyCareDelayRequest(text)) {
    return {
      kind: 'out_of_scope_immediate_safety',
      title: 'This decision is outside FDE’s comparison scope.',
      body: 'FDE is designed for technical, organizational, mission, and strategic decision support. It does not compare delaying potentially urgent personal safety or emergency-care decisions. Use qualified real-time support for the immediate issue.',
    };
  }

  if (hasTreatmentChangeRequest(text) || hasDangerousRestrictionRequest(text) || hasSelfDosingEscalationRequest(text)) {
    return {
      kind: 'out_of_scope_personal_health',
      title: 'This decision is outside FDE’s comparison scope.',
      body: 'FDE is designed for technical, organizational, mission, and strategic decision support. It does not compare personal medical-treatment, dosing, starvation, or severe food-restriction decisions. Use qualified support for the immediate issue; FDE can still structure related organizational or logistical decisions.',
    };
  }

  return null;
}
