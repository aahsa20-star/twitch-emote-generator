-- AI Animation Generation rate limiting table
-- Run this in Supabase SQL Editor before using the feature

CREATE TABLE ai_animation_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text NOT NULL,
  description text NOT NULL,
  code_length int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_ai_animation_logs_user_date ON ai_animation_logs(user_id, created_at DESC);
