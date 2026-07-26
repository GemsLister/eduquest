-- Add time_spent_seconds column to quiz_responses table
ALTER TABLE public.quiz_responses
ADD COLUMN IF NOT EXISTS time_spent_seconds NUMERIC(12, 1) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.quiz_responses.time_spent_seconds IS
  'Seconds the student spent on this question during the attempt';

-- Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_quiz_responses_question_time ON public.quiz_responses(question_id, time_spent_seconds);
