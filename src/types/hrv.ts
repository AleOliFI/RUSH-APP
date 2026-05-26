export type MeasurementMethod =
  | 'camera_ppg'
  | 'accelerometer_scg'
  | 'strava'
  | 'garmin'
  | 'apple_health'
  | 'google_fit'
  | 'manual';

export interface HRVReading {
  id: string;
  user_id: string;
  measured_at: string;
  rmssd: number;
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
