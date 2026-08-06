import type { HRVMetric, HRVReading, HRVStatus, RHRStatus, WellbeingStatus } from '../../types/hrv';

/** Root Mean Square of Successive Differences — primary HRV metric */
export function calculateRMSSD(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  const squaredDiffs = [];
  for (let i = 1; i < rrIntervals.length; i++) {
    squaredDiffs.push((rrIntervals[i] - rrIntervals[i - 1]) ** 2);
  }
  return Math.sqrt(squaredDiffs.reduce((s, v) => s + v, 0) / squaredDiffs.length);
}

/** Standard Deviation of NN intervals — the metric Apple Health exposes */
export function calculateSDNN(rrIntervals: number[]): number {
  if (rrIntervals.length < 2) return 0;
  const avg = rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length;
  const variance =
    rrIntervals.reduce((s, v) => s + (v - avg) ** 2, 0) / rrIntervals.length;
  return Math.sqrt(variance);
}

/**
 * Linearisation envelopes per metric, in ms.
 *
 * RMSSD is the primary metric (BLE straps expose RR intervals, so we compute it
 * ourselves). Apple Health only publishes SDNN, so readings imported from a
 * watch carry that instead.
 *
 * The two are NOT interchangeable — they capture different components of
 * variability and a value of 40 ms means different things in each. That is why
 * baselines are partitioned by metric (see calculateBaselines): the readiness
 * zones are driven by how far today sits from the user's own history for the
 * same metric, which stays valid even where the absolute envelope is only an
 * approximation.
 */
const SVFC_ENVELOPE: Record<HRVMetric, { min: number; max: number }> = {
  rmssd: { min: Math.log(5), max: Math.log(250) },
  sdnn: { min: Math.log(5), max: Math.log(250) },
};

/**
 * Convert an HRV value to a 0–100 linearised score (S_VFC).
 * S_VFC = (ln(v) - ln(min)) / (ln(max) - ln(min)) × 100
 */
export function calculateSVFC(value: number, metric: HRVMetric = 'rmssd'): number {
  if (value <= 0) return 0;
  const { min, max } = SVFC_ENVELOPE[metric];
  return Math.min(100, Math.max(0, ((Math.log(value) - min) / (max - min)) * 100));
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

/**
 * Compute all baselines needed by the V2 readiness engine.
 *
 * `metric` partitions the history: an SDNN reading from a watch is never
 * averaged together with RMSSD readings from a strap, because the same number
 * means different things in each and the mix would skew µ28/σ28 — the very
 * values the readiness zones are measured against.
 */
export function calculateBaselines(
  readings: HRVReading[],
  metric: HRVMetric = 'rmssd',
): HRVBaselines {
  const sameMetric = readings.filter((r) => (r.hrv_metric ?? 'rmssd') === metric);
  const r7 = filterByDays(sameMetric, 7);
  const r28 = filterByDays(sameMetric, 28);

  const mu7 = avg(r7.map((r) => r.rmssd));
  const mu28 = avg(r28.map((r) => r.rmssd));

  const svc28 = r28.map((r) => calculateSVFC(r.rmssd, metric));
  const svc7 = r7.map((r) => calculateSVFC(r.rmssd, metric));
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
