-- Migration: Add Quiz Versioning Support
-- Purpose: Enable automatic quiz versioning for Item Analysis revisions

-- Add versioning columns to quizzes table if they don't exist
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS parent_quiz_id uuid;

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS version_number int DEFAULT 1;

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS has_revision boolean DEFAULT false;

ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS latest_version_id uuid;

-- Create index for finding quiz versions
CREATE INDEX IF NOT EXISTS idx_quizzes_parent_quiz_id
ON public.quizzes(parent_quiz_id, version_number);

-- Create foreign key constraint for parent quiz
ALTER TABLE public.quizzes
ADD CONSTRAINT fk_quizzes_parent_quiz_id
FOREIGN KEY (parent_quiz_id) REFERENCES public.quizzes(id)
ON DELETE CASCADE;

-- Add revision_history column to questions table if it doesn't exist
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS revision_history jsonb DEFAULT '[]'::jsonb;

-- Create index for questions with revision history
CREATE INDEX IF NOT EXISTS idx_questions_revision_history
ON public.questions USING gin(revision_history);

-- Comment on the new columns
COMMENT ON COLUMN public.quizzes.parent_quiz_id IS 'ID of the original quiz if this is a revision version';
COMMENT ON COLUMN public.quizzes.version_number IS 'Version number of this quiz (1 for original, 2+ for revisions)';
COMMENT ON COLUMN public.quizzes.has_revision IS 'Whether this quiz has been revised and has a newer version';
COMMENT ON COLUMN public.quizzes.latest_version_id IS 'ID of the latest version of this quiz';
COMMENT ON COLUMN public.questions.revision_history IS 'JSON array tracking all revisions made to this question';
