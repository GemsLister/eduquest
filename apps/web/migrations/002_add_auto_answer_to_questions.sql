-- Migration: Add auto_answer column to questions table
-- This flag indicates if a question should be auto-answered for students during quiz taking
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS auto_answer BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.questions.auto_answer IS 'Flag indicating if a question should be auto-answered for students';
