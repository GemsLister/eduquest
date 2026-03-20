-- Add is_archived column to quizzes table
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;
