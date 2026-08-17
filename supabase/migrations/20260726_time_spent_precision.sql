-- Store fractional seconds (0.1s) for per-question time tracking
ALTER TABLE public.quiz_responses
  ALTER COLUMN time_spent_seconds TYPE NUMERIC(12, 1)
  USING ROUND(COALESCE(time_spent_seconds, 0)::numeric, 1);

COMMENT ON COLUMN public.quiz_responses.time_spent_seconds IS
  'Seconds spent on this question (one decimal place, e.g. 12.3)';
