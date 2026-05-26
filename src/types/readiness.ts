import type { HRVStatus, RHRStatus, WellbeingStatus } from './hrv';

export type ReadinessColor = 'green' | 'yellow' | 'orange' | 'red' | 'dark_red' | 'gray';
export type TrainingDirective =
  | 'high_intensity'
  | 'moderate'
  | 'regenerative'
  | 'rest'
  | 'calibrating';

export interface ReadinessState {
  state: 1 | 2 | 3 | 4 | 5;
  color: ReadinessColor;
  score: number;
  directive: TrainingDirective;
  title: string;
  description: string;
  example_session: string;
}

export interface ReadinessAssessment {
  id: string;
  user_id: string;
  assessed_at: string;
  hrv_reading_id: string;
  wellbeing_log_id: string | null;
  hrv_status: HRVStatus;
  rhr_status: RHRStatus;
  wellbeing_status: WellbeingStatus;
  readiness_state: 1 | 2 | 3 | 4 | 5;
  readiness_color: ReadinessColor;
  readiness_score: number;
  training_directive: TrainingDirective;
  prescription_text: string;
  example_session: string;
  baseline_rmssd_7d: number | null;
  cv_7d: number | null;
  created_at: string;
}
