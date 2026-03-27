-- Add question_order column to quiz_attempts to preserve shuffled question order across sessions
ALTER TABLE quiz_attempts ADD COLUMN IF NOT EXISTS question_order JSONB;

-- Add unique constraint on quiz_responses so we can upsert individual answers during auto-save
ALTER TABLE quiz_responses
  ADD CONSTRAINT quiz_responses_attempt_question_unique
  UNIQUE (attempt_id, question_id);
