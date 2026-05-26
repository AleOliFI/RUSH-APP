import type { HRVReading, HRVStatus, RHRStatus, WellbeingStatus } from '../../types/hrv';

/** Root Mean Square of Successive Differences — primary HRV metric */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  const squaredDiffs = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    squaredDiffs.push((rrIntervals[i] - rrIntervals[i - 1]) ** 2);
  }
  return Math.sqrt(squaredDiffs.reduce((s, v) => s + v, 0) / squaredDiffs.length);
}

/** Moving average RMSSD over the last N days */
export function calculateBaseline(readings: HRVReading[], days: 7 | 28): number {
  if (readings.length === 0) return 0;
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - days);

  const recent = readings.filter((r) => new Date(r.measured_at) >= cutoff);
  if (recent.length === 0) return 0;

  return recent.reduce((s, r) => s + r.rmssd, 0) / recent.length;
}

/** Coefficient of Variation — measures ANS stability */
export function calculateCV(readings: HRVReading[]): number {
  if (readings.length < 2) return 0;
  const rmssdValues = readings.map((r) => r.rmssd);
  const avg = rmssdValues.reduce((s, v) => s + v, 0) / rmssdValues.length;
  if (avg === 0) return 0;
  const variance = rmssdValues.reduce((s, v) => s + (v - avg) ** 2, 0) / rmssdValues.length;
  return (Math.sqrt(variance) / avg) * 100;
}

/** Minimum readings needed before classification is meaningful */
const CALIBRATION_THRESHOLD = 7;

export function classifyHRVStatus(
  rmssd: number,
  baseline7d: number,
  readingCount: number,
): HRVStatus {
  if (readingCount < CALIBRATION_THRESHOLD) return 'calibrating';
  if (baseline7d === 0) return 'calibrating';

  const ratio = rmssd / baseline7d;

  if (ratio >= 1.15) return 'elevated';
  if (ratio >= 0.85) return 'baseline';
  if (ratio >= 0.65) return 'below_baseline';
  return 'low_trend';
}

export function classifyRHRStatus(currentRHR: number, baselineRHR: number): RHRStatus {
  if (baselineRHR === 0) return 'normal';
  const ratio = currentRHR / baselineRHR;
  if (ratio <= 0.93) return 'reduced';
  if (ratio <= 1.07) return 'normal';
  return 'elevated';
}

export function classifyWellbeingStatus(wellbeingScore: number): WellbeingStatus {
  if (wellbeingScore >= 4.0) return 'excellent';
  if (wellbeingScore >= 3.0) return 'good';
  if (wellbeingScore >= 2.0) return 'poor';
  return 'very_poor';
}

/** Compute RHR baseline from historical readings */
export function calculateRHRBaseline(readings: HRVReading[]): number {
  const withRHR = readings.filter((r) => r.rhr !== null && r.rhr! > 0);
  if (withRHR.length === 0) return 0;
  return withRHR.reduce((s, r) => s + r.rhr!, 0) / withRHR.length;
}
