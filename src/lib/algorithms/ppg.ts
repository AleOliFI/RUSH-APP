/**
 * PPG Signal Processing for HRV measurement via rear camera.
 *
 * Pipeline:
 * 1. Z-score normalization
 * 2. Bandpass filter (0.5–4 Hz) — isolates cardiac pulse
 * 3. Pan-Tompkins-inspired peak detection
 * 4. R-R interval extraction
 */

const SAMPLE_RATE = 30; // fps

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

export interface PPGResult {
  rrIntervals: number[];
  peakCount: number;
  qualityScore: number;
  estimatedHR: number;
}

/**
 * Main entry point: process an array of red-channel frame values
 * (one value per captured frame at ~30fps).
 */
export function processPPGSignal(redChannelValues: number[]): PPGResult {
  if (redChannelValues.length < SAMPLE_RATE * 15) {
    return { rrIntervals: [], peakCount: 0, qualityScore: 0, estimatedHR: 0 };
  }

  const normalized = normalize(redChannelValues);
  const filtered = bandpassFilter(normalized);
  const peaks = detectPeaks(filtered);
  const rrIntervals = peaksToRRIntervals(peaks);

  // Signal quality: ratio of valid RR intervals vs expected beats
  const durationSeconds = redChannelValues.length / SAMPLE_RATE;
  const expectedBeats = Math.round((durationSeconds / 60) * 75); // assume 75 bpm
  const qualityScore = Math.min(1, rrIntervals.length / Math.max(expectedBeats * 0.7, 1));

  const estimatedHR =
    rrIntervals.length > 0
      ? Math.round(60000 / (rrIntervals.reduce((s, v) => s + v, 0) / rrIntervals.length))
      : 0;

  return { rrIntervals, peakCount: peaks.length, qualityScore, estimatedHR };
}
