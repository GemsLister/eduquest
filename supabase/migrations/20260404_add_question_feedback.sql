-- Add per-question feedback column to quiz_analysis_submissions
-- Stores feedback as JSONB: { "questionId1": "feedback text", "questionId2": "feedback text" }
ALTER TABLE quiz_analysis_submissions
ADD COLUMN IF NOT EXISTS question_feedback JSONB DEFAULT '{}'::jsonb;
