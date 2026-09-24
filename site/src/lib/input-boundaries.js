function normalize(value) {
  return String(value ?? '').replace(/\r\n?/g, '\n').trim();
}

const selfDirectedActionPattern = /\b(?:kill(?:ing)?|harm(?:ing)?|hurt(?:ing)?|injur(?:e|ing)|cut(?:ting)?)\s+(?:myself|ourselves)\b/i;
const firstPersonSuicidalStatePattern = /\b(?:i(?:['’]?m| am| feel| felt| have been)|we(?:['’]?re| are| feel| felt| have been))\s+(?:very\s+)?(?:suicidal|thinking (?:about|of) suicide|considering suicide|thinking (?:about|of) self[\s-]?harm|considering self[\s-]?harm)\b/i;
const firstPersonDeathWishPattern = /\b(?:i|we)\s+(?:want|wish|plan|intend|might|may|could|should|need|hope)\s+(?:to\s+)?(?:die|kill\s+myself|harm\s+myself|hurt\s+myself|cut\s+myself|end\s+(?:my|our)\s+(?:life|lives)|take\s+(?:my|our)\s+(?:life|lives))\b/i;
const firstPersonSelfHarmVerbPattern = /\b(?:should|do|might|may|could|would)\s+(?:i|we)\s+(?:self[\s-]?harm|cut\s+myself|hurt\s+myself|harm\s+myself|kill\s+myself|end\s+(?:my|our)\s+(?:life|lives)|take\s+(?:my|our)\s+(?:life|lives))\b/i;
const firstPersonSingularCuePattern = /\b(?:i|me|my|myself)\b/i;
const firstPersonPluralCuePattern = /\b(?:we|us|our|ourselves)\b/i;
const firstPersonSingularEndItAllPattern = /\b(?:(?:i)\s+(?:(?:really|just|simply|finally)\s+)?(?:want|wish|plan|intend|might|may|could|should|need|hope)\s+(?:to\s+)?|(?:should|do|might|may|could|would)\s+i\s+(?:(?:really|just|simply|finally)\s+)?|i\s+(?:think|feel)\s+i\s+(?:should|might|could)\s+(?:(?:really|just|simply|finally)\s+)?)end\s+it\s+all\b/i;
const firstPersonPluralEndItAllPattern = /\b(?:(?:we)\s+(?:(?:really|just|simply|finally)\s+)?(?:want|wish|plan|intend|might|may|could|should|need|hope)\s+(?:to\s+)?|(?:should|do|might|may|could|would)\s+we\s+(?:(?:really|just|simply|finally)\s+)?|we\s+(?:think|feel)\s+we\s+(?:should|might|could)\s+(?:(?:really|just|simply|finally)\s+)?)end\s+it\s+all\b/i;
const organizationalEndItAllContinuationPattern = /\bend\s+it\s+all\b[^.!?\n]{0,48}\b(?:with|for|on|at|in)\s+(?:(?:this|the|our|a|an)\s+)?(?:supplier|vendor|contract|project|program|initiative|agreement|relationship|process|operation|mission|product|service|deal|partnership|effort|workstream|system|platform|deployment|qualification|engagement)\b/i;
const organizationalEndingThingsContinuationPattern = /\bending\s+(?:things|it)\b[^.!?\n]{0,48}\b(?:with|for|on|at|in)\s+(?:(?:this|the|our|a|an)\s+)?(?:supplier|vendor|contract|project|program|initiative|agreement|relationship|process|operation|mission|product|service|deal|partnership|effort|workstream|system|platform|deployment|qualification|engagement)\b/i;
const firstPersonNoLifePattern = /\b(?:i|we)\s+(?:don['’]?t|do not)\s+want\s+to\s+(?:live|be\s+alive)\b|\bi\s+(?:can['’]?t|cannot)\s+(?:go\s+on|keep\s+living)\b|\bi\s+should\s+(?:keep|continue)\s+living\b/i;
const explicitLifeEndingPattern = /\b(?:end(?:ing)?\s+(?:my|our)\s+(?:life|lives)|stop(?:ping)?\s+living|give\s+up\s+on\s+life|done\s+living)\b/i;
const hopelessnessPattern = /\b(?:i\s+(?:don['’]?t|do not)\s+see\s+(?:a\s+)?reason\s+to\s+(?:keep\s+)?living|life\s+(?:isn['’]?t|is not)\s+worth\s+(?:it|living)|i\s+(?:feel\s+like\s+)?i['’]?d\s+be\s+better\s+off\s+dead|i\s+(?:would|could)\s+be\s+better\s+off\s+dead|i['’]?m\s+done\s+living|i\s+(?:can['’]?t|cannot)\s+do\s+this\s+anymore|nothing\s+matters\s+anymore)\b/i;
const absenceBurdenPattern = /\b(?:should\s+i\s+be\s+here\s+anymore|(?:would\s+)?(?:everyone|people|others)\s+(?:would\s+)?be\s+(?:happier|better\s+off)\s+(?:if\s+i\s+weren['’]?t\s+around|without\s+me)|should\s+i\s+disappear\s+completely)\b/i;
const notWakeUpPattern = /\b(?:i(?:['’]?ve| have)?\s+been\s+)?(?:thinking|planning)\s+(?:about|of|how\s+to)\s+(?:not\s+wake\s+up|never\s+wake\s+up)\b/i;
const acuteEndingThingsPattern = /\b(?:thinking|planning)\s+(?:about|of|to)\s+end(?:ing)?\s+(?:things|it)\b/i;
const acuteTimeCuePattern = /\b(?:tonight|right\s+now|today|this\s+morning|this\s+evening)\b/i;
const allPillsPattern = /\b(?:should|would|could|might|may)\s+i\s+(?:take|swallow)\s+all\s+(?:of\s+)?(?:my\s+)?(?:pills|medication|medicine|tablets|capsules)\b/i;
const standaloneCrisisPhrasePattern = /^(?:please\s+)?(?:end\s+it\s+all|nothing\s+to\s+live\s+for)[.!?]*$/i;
const treatmentActionPattern = /\b(?:stop|start|skip|miss|discontinue|quit|change|adjust|increase|decrease|reduce|raise|lower|halve|double|ration|taper|pause|delay)\b/i;
const treatmentSubjectPattern = /\b(?:medication|medicine|prescription|dose|treatment|therapy|insulin|chemotherapy|antidepressants?|antibiotics?|inhaler|steroids?|hormones?)\b/i;
const dangerousRestrictionPattern = /\b(?:stop\s+eating|starv(?:e|ing)(?:\s+myself)?|skip\s+(?:all\s+)?meals?|not\s+eat(?:ing)?|fast(?:ing)?\s+(?:for\s+)?(?:(?:[2-9]|[1-9]\d+)\s+days?|(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+days?|(?:a|one|two|three|four)\s+weeks?))\b/i;
const selfDosingSubjectPattern = /\b(?:medications?|medicines?|prescriptions?|drugs?|substances?|doses?|pills?|tablets?|capsules?|ibuprofen|acetaminophen|paracetamol|aspirin|naproxen|diphenhydramine|benadryl|nyquil|dayquil|cough\s+syrup|cough\s+medicine|antihistamines?|painkillers?|pain\s+relievers?|sleep\s+aids?|supplements?)\b/i;
const quantityComparisonPattern = /\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b[^.!?\n]{0,48}\b(?:or|versus|vs\.?|instead\s+of|rather\s+than)\b[^.!?\n]{0,48}\b(?:\d+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten)\b/i;
const ingestionActionPattern = /\b(?:take|taking|eat|eating|drink|drinking|swallow|swallowing|ingest|ingesting|dose|dosing|redose|redosing)\b/i;
const doseUnitPattern = /\b(?:mg|g|mcg|ug|ml|units?|pills?|tablets?|capsules?|doses?)\b/i;
const emergencyDelayPattern = /\b(?:(?:go|head|drive(?:\s+myself)?|take\s+\w+|bring\s+\w+)\s+(?:to\s+)?(?:the\s+)?(?:ER|emergency\s+room|emergency\s+department|urgent\s+care|hospital)|seek\s+(?:emergency|urgent)\s+care|call\s+(?:911|an\s+ambulance|emergency\s+services))\b[^.!?\n]{0,120}\b(?:or|versus|vs\.?|instead\s+of)\b[^.!?\n]{0,120}\b(?:wait(?:\s+it\s+out)?|delay|later|tomorrow|stay\s+home)\b|\b(?:wait(?:\s+it\s+out)?|delay|later|tomorrow|stay\s+home)\b[^.!?\n]{0,120}\b(?:or|versus|vs\.?|instead\s+of)\b[^.!?\n]{0,120}\b(?:(?:go|head|drive(?:\s+myself)?|take\s+\w+|bring\s+\w+)\s+(?:to\s+)?(?:the\s+)?(?:ER|emergency\s+room|emergency\s+department|urgent\s+care|hospital)|seek\s+(?:emergency|urgent)\s+care|call\s+(?:911|an\s+ambulance|emergency\s+services))\b/i;

function hasPersonalCrisisRequest(text) {
  const singular = firstPersonSingularCuePattern.test(text);
  const plural = firstPersonPluralCuePattern.test(text);
  const singularEndItAll = firstPersonSingularEndItAllPattern.test(text);
  const pluralEndItAll = firstPersonPluralEndItAllPattern.test(text)
    && !organizationalEndItAllContinuationPattern.test(text);
  const acuteEndingThings = acuteEndingThingsPattern.test(text)
    && !organizationalEndingThingsContinuationPattern.test(text)
    && (singular || acuteTimeCuePattern.test(text));

  return selfDirectedActionPattern.test(text)
    || firstPersonSuicidalStatePattern.test(text)
    || firstPersonDeathWishPattern.test(text)
    || firstPersonSelfHarmVerbPattern.test(text)
    || firstPersonNoLifePattern.test(text)
    || standaloneCrisisPhrasePattern.test(text)
    || singularEndItAll
    || pluralEndItAll
    || (singular && explicitLifeEndingPattern.test(text))
    || (singular && hopelessnessPattern.test(text))
    || absenceBurdenPattern.test(text)
    || notWakeUpPattern.test(text)
    || acuteEndingThings
    || allPillsPattern.test(text);
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

  return null;
}
