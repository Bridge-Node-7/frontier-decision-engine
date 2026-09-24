const NEGATION_PATTERN = /\b(?:not|never|no longer|isn['’]t|is not|aren['’]t|are not|wasn['’]t|was not|weren['’]t|were not|not required|not mandatory)\b/iu;

const RULES = [
  {
    basis_type: 'hard_requirement',
    patterns: [
      /\b(?:must|mandatory|has to|required(?:\s+to)?)\b[^.!?\n]{2,120}/iu,
      /[^.!?\n]{3,100}\b(?:is|are)\s+(?:required|mandatory|a hard requirement|a hard constraint)\b[^.!?\n]{0,60}/iu,
    ],
  },
  {
    basis_type: 'deadline',
    patterns: [
      /\b(?:January|February|March|April|May|June|July|August|September|October|November|December|Q[1-4]|20\d{2}|\d{1,2}\/\d{1,2}(?:\/\d{2,4})?)\b[^.!?\n]{0,80}\b(?:deadline|due date|integration window|launch window|delivery window|readiness window)\b[^.!?\n]{0,40}/iu,
      /\b(?:by|before|no later than)\s+(?:launch|integration|deployment|qualification|delivery|readiness|January|February|March|April|May|June|July|August|September|October|November|December|Q[1-4]|20\d{2})\b[^.!?\n]{0,60}/iu,
    ],
  },
  { basis_type: 'dependency', patterns: [/\b(?:depends? on|hinges? on|turns? on)\s+[^.!?\n]{3,120}/iu] },
  { basis_type: 'conditional', patterns: [/\b(?:only if|unless)\s+[^.!?\n]{3,120}/iu] },
  {
    basis_type: 'blocker',
    patterns: [
      /\b(?:blocked by|blocker(?:\s+is|:))\s+[^.!?\n]{3,120}/iu,
      /\bcannot\b[^.!?\n]{0,60}\buntil\b[^.!?\n]{3,100}/iu,
    ],
  },
];

function candidateFromMatch(source, match, basisType) {
  const raw = match[0];
  const text = raw.trim();
  if (!text || NEGATION_PATTERN.test(text)) return null;
  const leading = raw.indexOf(text);
  const start = (match.index ?? 0) + Math.max(0, leading);
  const end = start + text.length;
  const sourceText = source.slice(start, end);
  if (sourceText !== text) return null;
  return Object.freeze({
    text,
    basis_type: basisType,
    source_text: sourceText,
    source_start: start,
    source_end: end,
    status: 'suggested',
    formal_influence: false,
  });
}

export function deriveDecisionHinge(input) {
  const source = String(input ?? '');
  if (!source.trim()) return null;
  for (const rule of RULES) {
    let best = null;
    for (const pattern of rule.patterns) {
      const match = pattern.exec(source);
      if (!match) continue;
      const candidate = candidateFromMatch(source, match, rule.basis_type);
      if (!candidate) continue;
      if (!best || candidate.source_start < best.source_start) best = candidate;
    }
    if (best) return best;
  }
  return null;
}
