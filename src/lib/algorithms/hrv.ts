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

// lnRMSSD linearisation constants
const LN_RMSSD_MIN = Math.log(5);   // ln(5 ms)
const LN_RMSSD_MAX = Math.log(250); // ln(250 ms)

/**
 * Convert RMSSD to a 0–100 linearised HRV score (S_VFC).
 * S_VFC = (ln(RMSSD) - ln(5)) / (ln(250) - ln(5)) × 100
 */
export function calculateSVFC(rmssd: number): number {
  if (rmssd <= 0) return 0;
  const lnRmssd = Math.log(rmssd);
  return Math.min(100, Math.max(0, ((lnRmssd - LN_RMSSD_MIN) / (LN_RMSSD_MAX - LN_RMSSD_MIN)) * 100));
}

/**
 * Resting Heart Rate score (S_FCR 0–100).
 * Full score when RHR is at or below baseline; decays 10 pts per bpm above it.
 */
export function calculateSFCR(rhrDaily: number, rhrBaseline28: number): number {
  if (rhrBaseline28 === 0) return 100;
  const delta = rhrDaily - rhrBaseline28;
  if (delta <= 0) return 100;
  if (delta >= 10) return 0;
  return Math.round(100 - delta * 10);
}

/**
 * Normalised well-being score (E_WB 0–100).
 * WB_raw = sleep + (6 - stress) + (6 - fatigue) + (6 - doms)  [range 4–20]
 * E_WB   = (WB_raw - 4) / 16 × 100
 */
export function calculateEWB(
  sleep: number,
  stress: number,
  fatigue: number,
  doms: number,
): number {
  const wbRaw = sleep + (6 - stress) + (6 - fatigue) + (6 - doms);
  return Math.min(100, Math.max(0, ((wbRaw - 4) / 16) * 100));
}

export interface HRVBaselines {
  mu7: number;
  mu28: number;
  sigma28: number;
  rhrMu28: number;
  mu7SVC: number;
  mu28SVC: number;
  sigma28SVC: number;
}

function filterByDays(readings: HRVReading[], days: number): HRVReading[] {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return readings.filter((r) => new Date(r.measured_at) >= cutoff);
}

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

function stddev(arr: number[], mean: number): number {
  if (arr.length < 2) return 0;
  return Math.sqrt(arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length);
}

/** Compute all baselines needed by the V2 readiness engine. */
export function calculateBaselines(readings: HRVReading[]): HRVBaselines {
  const r7 = filterByDays(readings, 7);
  const r28 = filterByDays(readings, 28);

  const mu7 = avg(r7.map((r) => r.rmssd));
  const mu28 = avg(r28.map((r) => r.rmssd));

  const svc28 = r28.map((r) => calculateSVFC(r.rmssd));
  const svc7 = r7.map((r) => calculateSVFC(r.rmssd));
  const mu28SVC = avg(svc28);
  const mu7SVC = avg(svc7);
  const sigma28SVC = stddev(svc28, mu28SVC);

  const sigma28 = stddev(r28.map((r) => r.rmssd), mu28);

  const rhrValues = r28.filter((r) => r.rhr != null && r.rhr! > 0).map((r) => r.rhr!);
  const rhrMu28 = avg(rhrValues);

  return { mu7, mu28, sigma28, rhrMu28, mu7SVC, mu28SVC, sigma28SVC };
}

/** Legacy single-window baseline (kept for backward compat in hooks) */
export function calculateBaseline(readings: HRVReading[], days: 7 | 28): number {
  return avg(filterByDays(readings, days).map((r) => r.rmssd));
}

/** Coefficient of Variation — measures ANS stability */
export function calculateCV(readings: HRVReading[]): number {
  if (readings.length < 2) return 0;
  const rmssdValues = readings.map((r) => r.rmssd);
  const mean = avg(rmssdValues);
  if (mean === 0) return 0;
  return (stddev(rmssdValues, mean) / mean) * 100;
}

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

export function calculateRHRBaseline(readings: HRVReading[]): number {
  const withRHR = readings.filter((r) => r.rhr !== null && r.rhr! > 0);
  if (withRHR.length === 0) return 0;
  return avg(withRHR.map((r) => r.rhr!));
}
