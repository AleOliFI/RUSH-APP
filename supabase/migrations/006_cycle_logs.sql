-- Add hormonal profile column to profiles
ALTER TABLE profiles
  ADD COLUMN hormonal_profile text
  CHECK (hormonal_profile IN ('regular', 'sop', 'ahf_reds'))
  DEFAULT NULL;

-- Menstrual cycle tracking
CREATE TABLE cycle_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  cycle_start_date date NOT NULL,
  cycle_length_days integer DEFAULT 28,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, cycle_start_date)
);

ALTER TABLE cycle_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own cycle logs" ON cycle_logs
  FOR ALL USING (auth.uid() = user_id);
