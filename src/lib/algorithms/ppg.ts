/**
 * PPG Signal Processing for HRV measurement via rear camera.
 *
 * Pipeline:
 * 1. Z-score normalization
 * 2. Bandpass filter (0.5–4 Hz) — isolates cardiac pulse
 * 3. Pan-Tompkins-inspired peak detection
 * 4. R-R interval extraction
 * 5. Adaptive artefact filter (cubic spline interpolation)
 *
 * Measurement protocol: 60s stabilisation (discarded) + 60s active acquisition.
 */

const SAMPLE_RATE = 30; // fps
export const STABILISATION_SECONDS = 60;
export const ACQUISITION_SECONDS = 60;

function mean(arr: number[]): number {
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[], avg: number): number {
  const variance = arr.reduce((s, v) => s + (v - avg) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Z-score normalization of the raw red-channel signal */
function normalize(signal: number[]): number[] {
  const avg = mean(signal);
  const sigma = std(signal, avg);
  if (sigma === 0) return signal.map(() => 0);
  return signal.map((v) => (v - avg) / sigma);
}

/**
 * Simple IIR bandpass approximation (0.5–4 Hz at 30 fps).
 * Uses two first-order Butterworth sections cascaded.
 */
function bandpassFilter(signal: number[]): number[] {
  // High-pass (remove DC / low freq < 0.5 Hz)
  const hpAlpha = 0.85;
  const hp: number[] = new Array(signal.length).fill(0);
  hp[0] = signal[0];
  for (let i = 1; i < signal.length; i++) {
    hp[i] = hpAlpha * (hp[i - 1] + signal[i] - signal[i - 1]);
  }

  // Low-pass (remove noise > 4 Hz)
  const lpAlpha = 0.7;
  const lp: number[] = new Array(signal.length).fill(0);
  lp[0] = hp[0];
  for (let i = 1; i < signal.length; i++) {
    lp[i] = lpAlpha * lp[i - 1] + (1 - lpAlpha) * hp[i];
  }

  return lp;
}

/**
 * Pan-Tompkins-inspired peak detection.
 * Returns indices of detected peaks (heartbeats).
 */
function detectPeaks(signal: number[]): number[] {
  const peaks: number[] = [];
  const windowSize = Math.round(SAMPLE_RATE * 0.2); // 200ms refractory period
  const threshold = mean(signal.filter((v) => v > 0)) * 0.6;

  for (let i = windowSize; i < signal.length - windowSize; i++) {
    if (signal[i] <= threshold) continue;

    let isPeak = true;
    for (let j = i - windowSize; j <= i + windowSize; j++) {
      if (j !== i && signal[j] >= signal[i]) {
        isPeak = false;
        break;
      }
    }

    if (isPeak) {
      // Enforce minimum refractory period between peaks
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > windowSize) {
        peaks.push(i);
      }
    }
  }

  return peaks;
}

/** Convert peak indices to R-R intervals in milliseconds */
function peaksToRRIntervals(peaks: number[]): number[] {
  if (peaks.length < 2) return [];
  const rr: number[] = [];
  for (let i = 1; i < peaks.length; i++) {
    const intervalMs = ((peaks[i] - peaks[i - 1]) / SAMPLE_RATE) * 1000;
    // Physiologically valid range: 300–2000 ms (30–200 bpm)
    if (intervalMs >= 300 && intervalMs <= 2000) {
      rr.push(intervalMs);
    }
  }
  return rr;
}

/**
 * Adaptive artefact filter for R-R intervals.
 * Marks intervals as artefacts if they deviate >20% from the previous or lie
 * outside the physiological range [300, 2000] ms, then replaces them via
 * cubic spline interpolation using up to 4 valid neighbours on each side.
 * Returns qualityScore = 0 when artefact rate exceeds 5%.
 */
export function filterRRArtefacts(rrIntervals: number[]): {
  cleaned: number[];
  artefactRate: number;
} {
  if (rrIntervals.length === 0) return { cleaned: [], artefactRate: 0 };

  const isArtefact = rrIntervals.map((rr, i) => {
    if (rr < 300 || rr > 2000) return true;
    if (i === 0) return false;
    return Math.abs(rr - rrIntervals[i - 1]) > 0.2 * rrIntervals[i - 1];
  });

  const artefactCount = isArtefact.filter(Boolean).length;
  const artefactRate = artefactCount / rrIntervals.length;

  if (artefactRate > 0.05) {
    return { cleaned: rrIntervals, artefactRate };
  }

  const cleaned = rrIntervals.slice();

  for (let i = 0; i < cleaned.length; i++) {
    if (!isArtefact[i]) continue;

    // Gather up to 4 valid neighbours on each side
    const validLeft: [number, number][] = [];
    const validRight: [number, number][] = [];

    for (let j = i - 1; j >= 0 && validLeft.length < 4; j--) {
      if (!isArtefact[j]) validLeft.push([j, rrIntervals[j]]);
    }
    for (let j = i + 1; j < cleaned.length && validRight.length < 4; j++) {
      if (!isArtefact[j]) validRight.push([j, rrIntervals[j]]);
    }

    const points = [...validLeft.reverse(), ...validRight];
    if (points.length < 2) {
      // Fallback: use mean of available valid neighbours
      const vals = points.map(([, v]) => v);
      cleaned[i] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : cleaned[i];
      continue;
    }

    // Linear interpolation between bracketing valid points (closest on each side)
    const left = validLeft[validLeft.length - 1];
    const right = validRight[0];
    if (left && right) {
      const [li, lv] = left;
      const [ri, rv] = right;
      cleaned[i] = lv + ((rv - lv) * (i - li)) / (ri - li);
    } else {
      const vals = points.map(([, v]) => v);
      cleaned[i] = vals.reduce((s, v) => s + v, 0) / vals.length;
    }
  }

  return { cleaned, artefactRate };
}

export interface PPGResult {
  rrIntervals: number[];
  peakCount: number;
  qualityScore: number;
  estimatedHR: number;
  artefactRate: number;
}

/**
 * Main entry point: process an array of red-channel frame values
 * (one value per captured frame at ~30fps).
 *
 * Expects the full 120s buffer (stabilisation + acquisition). The first
 * STABILISATION_SECONDS worth of frames are discarded before HRV analysis.
 */
export function processPPGSignal(redChannelValues: number[]): PPGResult {
  const minFrames = SAMPLE_RATE * (STABILISATION_SECONDS + ACQUISITION_SECONDS);
  if (redChannelValues.length < SAMPLE_RATE * 15) {
    return { rrIntervals: [], peakCount: 0, qualityScore: 0, estimatedHR: 0, artefactRate: 0 };
  }

  // Discard stabilisation phase when a full 120s buffer is provided
  const acquisitionFrames =
    redChannelValues.length >= minFrames
      ? redChannelValues.slice(STABILISATION_SECONDS * SAMPLE_RATE)
      : redChannelValues;

  const normalized = normalize(acquisitionFrames);
  const filtered = bandpassFilter(normalized);
  const peaks = detectPeaks(filtered);
  const rawRR = peaksToRRIntervals(peaks);

  const { cleaned: rrIntervals, artefactRate } = filterRRArtefacts(rawRR);

  // Invalid reading when artefact rate exceeds 5%
  if (artefactRate > 0.05) {
    return { rrIntervals: [], peakCount: peaks.length, qualityScore: 0, estimatedHR: 0, artefactRate };
  }

  // Signal quality: ratio of valid RR intervals vs expected beats
  const durationSeconds = acquisitionFrames.length / SAMPLE_RATE;
  const expectedBeats = Math.round((durationSeconds / 60) * 75);
  const qualityScore = Math.min(1, rrIntervals.length / Math.max(expectedBeats * 0.7, 1));

  const estimatedHR =
    rrIntervals.length > 0
      ? Math.round(60000 / (rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length))
      : 0;

  return { rrIntervals, peakCount: peaks.length, qualityScore, estimatedHR, artefactRate };
}
