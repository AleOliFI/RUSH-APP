-- Enrich readiness_assessments with V2 algorithm scores and hormonal flags
ALTER TABLE readiness_assessments
  ADD COLUMN s_vfc numeric,
  ADD COLUMN s_fcr numeric,
  ADD COLUMN e_wb numeric,
  ADD COLUMN hormonal_adjustment numeric DEFAULT 1.0,
  ADD COLUMN false_readiness_flag boolean DEFAULT false,
  ADD COLUMN cycle_phase text CHECK (cycle_phase IN ('follicular', 'luteal', 'menstrual', 'unknown')),
  ADD COLUMN hormonal_profile text CHECK (hormonal_profile IN ('regular', 'sop', 'ahf_reds'));
