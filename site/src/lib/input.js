export function readTrimmedText(element, fallback = '') {
  return element ? String(element.value ?? '').trim() : fallback;
}
export function readOptionalNumber(element) {
  if (!element) return null;
  const raw = String(element.value ?? '').trim();
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}
