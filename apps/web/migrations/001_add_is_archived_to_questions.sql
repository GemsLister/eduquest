-- Migration: Add is_archived column to questions table
-- This enables the Question Bank feature to archive and restore questions

-- Add is_archived column to questions table (defaults to false for existing questions)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- Create index for faster queries on archived questions
CREATE INDEX IF NOT EXISTS idx_questions_is_archived ON questions(is_archived);

-- Create index for querying by quiz_id and is_archived together
CREATE INDEX IF NOT EXISTS idx_questions_quiz_archived ON questions(quiz_id, is_archived);

-- Comment to document the column
COMMENT ON COLUMN questions.is_archived IS 'Indicates if a question has been archived in the Question Bank (true) or is active (false)';

