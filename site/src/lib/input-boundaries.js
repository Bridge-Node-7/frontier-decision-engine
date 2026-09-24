function normalize(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

const selfDirectedActionPattern = /\b(?:kill(?:ing)?|harm(?:ing)?|hurt(?:ing)?|injur(?:e|ing)|cut(?:ting)?)\s+(?:myself|ourselves)\b/i;
const firstPersonSuicidalStatePattern = /\b(?:i(?:['’]?m| am| feel| felt| have been)|we(?:['’]?re| are| feel| felt| have been))\s+(?:very\s+)?(?:suicidal|thinking (?:about|of) suicide|considering suicide|thinking (?:about|of) self[\s-]?harm|considering self[\s-]?harm)\b/i;
const firstPersonDeathWishPattern = /\b(?:i|we)\s+(?:want|wish|plan|intend|might|may|could|should|need|hope)\s+(?:to\s+)?(?:die|kill\s+myself|harm\s+myself|hurt\s+myself|cut\s+myself|end\s+(?:my|our)\s+(?:life|lives)|take\s+(?:my|our)\s+(?:life|lives))\b/i;
const firstPersonSelfHarmVerbPattern = /\b(?:should|do|might|may|could|would)\s+(?:i|we)\s+(?:self[\s-]?harm|self[\s-]?terminate|cut\s+myself|hurt\s+myself|harm\s+myself|kill\s+myself|end\s+(?:my|our)\s+(?:life|lives)|take\s+(?:my|our)\s+(?:life|lives))\b/i;
const firstPersonSingularEndItAllPattern = /\b(?:(?:i)\s+(?:(?:really|just|simply|finally)\s+)?(?:want|wish|plan|intend|might|may|could|should|need|hope)\s+(?:to\s+)?|(?:should|do|might|may|could|would)\s+i\s+(?:(?:really|just|simply|finally)\s+)?|i\s+(?:think|feel)\s+i\s+(?:should|might|could)\s+(?:(?:really|just|simply|finally)\s+)?)end\s+it\s+all\b/i;
const firstPersonPluralEndItAllPattern = /\b(?:(?:we)\s+(?:(?:really|just|simply|finally)\s+)?(?:want|wish|plan|intend|might|may|could|should|need|hope)\s+(?:to\s+)?|(?:should|do|might|may|could|would)\s+we\s+(?:(?:really|just|simply|finally)\s+)?|we\s+(?:think|feel)\s+we\s+(?:should|might|could)\s+(?:(?:really|just|simply|finally)\s+)?)end\s+it\s+all\b/i;
const organizationalEndItAllContinuationPattern = /\bend\s+it\s+all\b[^.!?\n]{0,48}\b(?:with|for|on|at|in)\s+(?:(?:this|the|our|a|an)\s+)?(?:supplier|vendor|contract|project|program|initiative|agreement|relationship|process|operation|mission|product|service|deal|partnership|effort|workstream|system|platform|deployment|qualification|engagement)\b/i;
const firstPersonDirectNoLifePattern = /\bi\s+(?:don['’]?t|do not)\s+want\s+to\s+(?:live|be\s+alive)(?:\s+anymore)?(?:[.!?]|$)|\bi\s+(?:can['’]?t|cannot)\s+keep\s+living(?:\s+(?:like\s+this|anymore))?(?:[.!?]|$)/i;
const allMedicationPattern = /\b(?:should|would|could|might|may)\s+i\s+(?:take|swallow)\s+all\s+(?:of\s+)?(?:my\s+)?(?:pills|medication|medicine|tablets|capsules)\b/i;
const standaloneCrisisPhrasePattern = /^(?:please\s+)?end\s+it\s+all[.!?]*$/i;

const firstPersonSingularCuePattern = /\b(?:i|me|my|myself|i['’]?m|i['’]?ve|i['’]?d)\b/i;
const firstPersonSingularDecisionPattern = /\b(?:should|do|can|could|would|might|may|will)\s+i\b|\bi\s+(?:want|need|plan|intend|am|feel|think|have|keep|can['’]?t|cannot|don['’]?t|do\s+not|would|could|might|may|should)\b/i;
const organizationalObjectPattern = /\b(?:supplier|vendor|contract|project|program|initiative|mission|workstream|feature|product|service|system|platform|deployment|qualification|procurement|portfolio|policy|budget|investment|board|committee|agency|ministry|department|organization|organisation|company|business|enterprise|team|client|customer|facility|site|operations?|architecture|engineering|technology|material|component|subsystem|network|software|hardware|data|cyber(?:security)?|release|pilot|joint\s+venture|partnership|market|source|supply\s+chain)\b/i;
const decisionSupportContextPattern = /\b(?:evidence|objective|criterion|scenario|strategy|option|choice|alternative|comparison|analysis|decision|model|score|readiness|risk|trade[-\s]?off)\b/i;
const personalReflexivePattern = /\bmyself\b/i;
const personalLifeContextPattern = /\b(?:alive|being\s+alive|stop\s+existing|goodbye|funeral|my\s+will|my\s+(?:wife|husband|partner|family|children|kids|therapist|doctor|gp|home|house|car)|living\s+in|move\s+to|career|annual\s+leave|life\s+coaching|not\s+be\s+around|was\s+gone|wasn['’]?t\s+here|carry(?:ing)?\s+on|go\s+through\s+with\s+it|disappear(?:ing)?|vanish(?:ing)?)\b/i;

const treatmentActionPattern = /\b(?:stop|start|skip|miss|discontinue|quit|change|adjust|increase|decrease|reduce|raise|lower|halve|double|ration|taper|pause|delay)\b/i;
const treatmentSubjectPattern = /\b(?:medication|medicine|prescription|dose|treatment|therapy|insulin|chemotherapy|antidepressants?|antibiotics?|inhaler|steroids?|hormones?)\b/i;
const dangerousRestrictionPattern = /\b(?:stop\s+eating|starv(?:e|ing)(?:\s+myself)?|skip\s+(?:all\s+)?meals?|not\s+eat(?:ing)?|fast(?:ing)?\s+(?:for\s+)?(?:(?:[2-9]|[1-9]\d+)\s+days?|(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?|(?:a|one|two|three|four)\s+weeks?))\b/i;
const selfDosingSubjectPattern = /\b(?:medications?|medicines?|prescriptions?|drugs?|substances?|doses?|pills?|tablets?|capsules?|ibuprofen|acetaminophen|paracetamol|aspirin|naproxen|diphenhydramine|benadryl|nyquil|dayquil|cough\s+syrup|cough\s+medicine|antihistamines?|painkillers?|pain\s+relievers?|sleep\s+aids?|supplements?)\b/i;
const quantityComparisonPattern = /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b[^.!?\n]{0,48}\b(?:or|versus|vs\.?|instead\s+of|rather\s+than)\b[^.!?\n]{0,48}\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const ingestionActionPattern = /\b(?:take|taking|eat|eating|drink|drinking|swallow|swallowing|ingest|ingesting|dose|dosing|redose|redosing)\b/i;
const doseUnitPattern = /\b(?:mg|g|mcg|ug|ml|units?|pills?|tablets?|capsules?|doses?)\b/i;
const emergencyDelayPattern = /\b(?:(?:go|head|drive(?:\s+myself)?|take\s+\w+|bring\s+\w+)\s+(?:to\s+)?(?:the\s+)?(?:ER|emergency\s+room|emergency\s+department|urgent\s+care|hospital)|seek\s+(?:emergency|urgent)\s+care|call\s+(?:911|an\s+ambulance|emergency\s+services))\b[^.!?\n]{0,120}\b(?:or|versus|vs\.?|instead\s+of)\b[^.!?\n]{0,120}\b(?:wait(?:\s+it\s+out)?|delay|later|tomorrow|stay\s+home)\b|\b(?:wait(?:\s+it\s+out)?|delay|later|tomorrow|stay\s+home)\b[^.!?\n]{0,120}\b(?:or|versus|vs\.?|instead\s+of)\b[^.!?\n]{0,120}\b(?:(?:go|head|drive(?:\s+myself)?|take\s+\w+|bring\s+\w+)\s+(?:to\s+)?(?:the\s+)?(?:ER|emergency\s+room|emergency\s+department|urgent\s+care|hospital)|seek\s+(?:emergency|urgent)\s+care|call\s+(?:911|an\s+ambulance|emergency\s+services))\b/i;

function hasPersonalCrisisRequest(text) {
  return selfDirectedActionPattern.test(text)
    || firstPersonSuicidalStatePattern.test(text)
    || firstPersonDeathWishPattern.test(text)
    || firstPersonSelfHarmVerbPattern.test(text)
    || firstPersonSingularEndItAllPattern.test(text)
    || (firstPersonPluralEndItAllPattern.test(text) && !organizationalEndItAllContinuationPattern.test(text))
    || firstPersonDirectNoLifePattern.test(text)
    || allMedicationPattern.test(text)
    || standaloneCrisisPhrasePattern.test(text);
}

function hasPersonalDecisionScope(text) {
  if (!firstPersonSingularCuePattern.test(text)) return false;
  const clearlyOrganizational = decisionSupportContextPattern.test(text)
    || organizationalObjectPattern.test(text);
  return personalReflexivePattern.test(text)
    || personalLifeContextPattern.test(text)
    || (firstPersonSingularDecisionPattern.test(text) && !clearlyOrganizational);
}

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

  if (hasPersonalCrisisRequest(text)) {
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

  if (hasPersonalDecisionScope(text)) {
    return {
      kind: 'out_of_scope_personal_decision',
      title: 'This decision is outside FDE’s supported scope.',
      body: 'FDE is designed for technical, organizational, mission, and strategic decision support. It does not evaluate personal-life decisions. Reframe the question around an accountable organizational choice if that is the actual decision. This boundary is not a clinical judgment. For personal health or safety concerns, use appropriate qualified support; in the U.S., 988 is available for crisis support.',
    };
  }

  return null;
}
