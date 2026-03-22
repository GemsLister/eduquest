-- Add guest support for quiz attempts (for non-authenticated students)
ALTER TABLE public.quiz_attempts 
ADD COLUMN guest_name VARCHAR(255),
ADD COLUMN guest_email VARCHAR(255),
ADD COLUMN share_token VARCHAR(20) UNIQUE;

-- Add share_token to quizzes table for generating shareable URLs
ALTER TABLE public.quizzes
ADD COLUMN share_token VARCHAR(20) UNIQUE;

-- Create index for share_token lookups
CREATE INDEX IF NOT EXISTS idx_quizzes_share_token ON public.quizzes(share_token);
