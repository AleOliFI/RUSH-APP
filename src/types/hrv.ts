export type MeasurementMethod =
  | 'ble_hrm'
  | 'strava'
  | 'garmin'
  | 'apple_health'
  | 'google_fit'
  | 'manual';

/**
 * Which variability metric a reading carries.
 * BLE straps expose RR intervals so we compute RMSSD ourselves; Apple Health
 * only publishes SDNN. They are not interchangeable — baselines are computed
 * per metric so the two never mix.
 */
export type HRVMetric = 'rmssd' | 'sdnn';

export interface HRVReading {
  id: string;
  user_id: string;
  measured_at: string;
  /** Value of the metric named by `hrv_metric`, in ms. */
  rmssd: number;
  hrv_metric: HRVMetric;
  rhr: number | null;
  measurement_method: MeasurementMethod;
  duration_seconds: number | null;
  quality_score: number | null;
  raw_rr_intervals: number[] | null;
  created_at: string;
}

export type HRVStatus = 'elevated' | 'baseline' | 'below_baseline' | 'low_trend' | 'calibrating';
export type RHRStatus = 'reduced' | 'normal' | 'elevated';
export type WellbeingStatus = 'excellent' | 'good' | 'poor' | 'very_poor';

export type CyclePhase = 'follicular' | 'luteal' | 'menstrual' | 'unknown';
export type HormonalProfile = 'regular' | 'sop' | 'ahf_reds' | null;

export interface CycleLog {
  id: string;
  user_id: string;
  cycle_start_date: string;
  cycle_length_days: number;
  created_at: string;
}

export interface WellbeingLog {
  id: string;
  user_id: string;
  logged_at: string;
  sleep_quality: number;
  doms_level: number;
  stress_level: number;
  fatigue_level: number;
  wellbeing_score: number;
}

export interface WellbeingInput {
  sleep_quality: number;
  doms_level: number;
  stress_level: number;
  fatigue_level: number;
}
