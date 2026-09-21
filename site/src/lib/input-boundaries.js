function normalize(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

const selfDirectedActionPattern = /\b(?:kill|harm|hurt|injure|cut)\s+(?:myself|ourselves)\b/i;
const firstPersonSuicidalStatePattern = /\b(?:i(?:['’]?m| am| feel| felt| have been)|we(?:['’]?re| are| feel| felt| have been))\s+(?:very\s+)?(?:suicidal|thinking (?:about|of) suicide|considering suicide|thinking (?:about|of) self[\s-]?harm|considering self[\s-]?harm)\b/i;
const firstPersonDeathWishPattern = /\b(?:i|we)\s+(?:want|wish|plan|intend|might|may|could|should|need|hope)\s+(?:to\s+)?(?:die|kill\s+myself|harm\s+myself|hurt\s+myself|cut\s+myself|end\s+(?:my|our)\s+(?:life|lives)|take\s+(?:my|our)\s+(?:life|lives)|end\s+it\s+all)\b/i;
const firstPersonSelfHarmVerbPattern = /\b(?:should|do|might|may|could|would)\s+(?:i|we)\s+(?:self[\s-]?harm|cut\s+myself|hurt\s+myself|harm\s+myself|kill\s+myself|end\s+(?:my|our)\s+(?:life|lives)|take\s+(?:my|our)\s+(?:life|lives)|end\s+it\s+all)\b/i;
const firstPersonNoLifePattern = /\b(?:i|we)\s+(?:don['’]?t|do not)\s+want\s+to\s+(?:live|be\s+alive)\b|\bi\s+(?:can['’]?t|cannot)\s+(?:go\s+on|keep\s+living)\b/i;
const standaloneCrisisPhrasePattern = /^(?:please\s+)?(?:end\s+it\s+all|nothing\s+to\s+live\s+for)[.!?]*$/i;
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

  if (selfDirectedActionPattern.test(text) || firstPersonSuicidalStatePattern.test(text) || firstPersonDeathWishPattern.test(text) || firstPersonSelfHarmVerbPattern.test(text) || firstPersonNoLifePattern.test(text) || standaloneCrisisPhrasePattern.test(text)) {
    return {
      kind: 'out_of_scope_self_harm',
      title: 'This decision is outside FDE’s comparison scope.',
      body: 'FDE is designed for technical, organizational, mission, and strategic decision support. It does not compare or optimize self-harm. If you are in the U.S., call or text 988 for the 988 Lifeline. If there is immediate danger, contact local emergency services.',
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
