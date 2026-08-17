-- Migration: Add time_spent_seconds to quiz_responses
-- Run in Supabase Dashboard → SQL Editor if the column is missing.

ALTER TABLE public.quiz_responses
ADD COLUMN IF NOT EXISTS time_spent_seconds NUMERIC(12, 1) NOT NULL DEFAULT 0;

ALTER TABLE public.quiz_responses
  ALTER COLUMN time_spent_seconds TYPE NUMERIC(12, 1)
  USING ROUND(COALESCE(time_spent_seconds, 0)::numeric, 1);

COMMENT ON COLUMN public.quiz_responses.time_spent_seconds IS
  'Seconds the student spent on this question during the attempt';

CREATE INDEX IF NOT EXISTS idx_quiz_responses_question_time
  ON public.quiz_responses (question_id, time_spent_seconds);
