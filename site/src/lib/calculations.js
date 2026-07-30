export function angularExtentFromPixels(pixelExtent, horizontalFieldOfViewDeg, horizontalPixels) {
  const values = [pixelExtent, horizontalFieldOfViewDeg, horizontalPixels].map(Number);
  if (values.some((value) => !Number.isFinite(value)) || values[0] < 0 || values[1] <= 0 || values[2] <= 0) {
    throw new RangeError('Pixel extent must be non-negative and calibration values must be positive.');
  }
  return values[0] * values[1] / values[2];
}

export function physicalExtentAtRange(angularExtentDeg, rangeMeters) {
  const angle = Number(angularExtentDeg);
  const range = Number(rangeMeters);
  if (!Number.isFinite(angle) || !Number.isFinite(range) || angle < 0 || angle >= 180 || range <= 0) {
    throw new RangeError('Angle must be between 0 and 180 degrees and range must be positive.');
  }
  return 2 * range * Math.tan((angle * Math.PI / 180) / 2);
}

export function pointDistance(first, second) {
  if (!first || !second) return 0;
  return Math.hypot(Number(second.x) - Number(first.x), Number(second.y) - Number(first.y));
}

export function calculateEvidenceLevel(caseData) {
  const hasAsset = Boolean(caseData?.assets?.some((asset) => asset.asset_class === 'original' && asset.is_evidence === true && /^[a-f0-9]{64}$/.test(asset.sha256 || '')));
  const calibration = caseData?.calibration || {};
  const hasCalibration = Number(calibration.horizontal_field_of_view_deg) > 0
    && Number(calibration.horizontal_pixels) > 0
    && ['partially-calibrated', 'calibrated'].includes(calibration.status);
  const hasMeasurement = Boolean(caseData?.measurements?.some((measurement) => Number(measurement.pixel_extent) > 0));
  if (hasAsset && hasCalibration && hasMeasurement) return 2;
  if (hasAsset) return 1;
  return 0;
}

export function scenarioTable(angularExtentDeg, ranges = [5, 10, 20, 50]) {
  return ranges.map((rangeMeters) => ({
    range_m: rangeMeters,
    physical_extent_m: physicalExtentAtRange(angularExtentDeg, rangeMeters),
    status: 'assumption-based',
  }));
}

export function round(value, digits = 4) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
