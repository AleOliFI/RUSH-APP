-- Daily behavior log for correlating habits with HRV recovery
CREATE TABLE behavior_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  behaviors text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, log_date)
);

ALTER TABLE behavior_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own behavior logs" ON behavior_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX behavior_logs_user_date_idx ON behavior_logs (user_id, log_date DESC);
