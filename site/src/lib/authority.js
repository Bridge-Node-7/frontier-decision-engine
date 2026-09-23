export const AUTHORITY_ROLES = Object.freeze([
  'accountable_owner',
  'delegated_decider',
  'advisor',
  'ownership_unknown',
]);

export const AUTHORITY_LABELS = Object.freeze({
  accountable_owner: 'I am the accountable decision-maker',
  delegated_decider: 'I have delegated authority to decide',
  advisor: 'I am supporting or recommending to the decision-maker',
  ownership_unknown: 'I am not sure who owns this decision',
});

export function createAuthority({ role = 'ownership_unknown', owner = '', basis = '' } = {}) {
  return { role: AUTHORITY_ROLES.includes(role) ? role : 'ownership_unknown', owner: String(owner || '').trim(), basis: String(basis || '').trim() };
}

export function authorityPermissions(authority) {
  const value = createAuthority(authority);
  return {
    mayFrame: true,
    mayCompare: value.role !== 'ownership_unknown',
    mayPrepareBrief: true,
    mayRecordDecision: ['accountable_owner', 'delegated_decider'].includes(value.role),
  };
}

export function authorityValidation(authority, { forRecord = false } = {}) {
  const value = createAuthority(authority);
  const errors = [];
  if (value.role === 'ownership_unknown') errors.push('Confirm the accountable decision owner before moving into comparison.');
  if (value.role !== 'ownership_unknown' && !value.owner) errors.push('Name the accountable decision owner or role.');
  if (value.role === 'delegated_decider' && !value.basis) errors.push('State the basis for delegated decision authority.');
  if (forRecord && !authorityPermissions(value).mayRecordDecision) errors.push('Only an accountable owner or delegated decider can record the human decision.');
  return { valid: errors.length === 0, errors, authority: value };
}
