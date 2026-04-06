-- Simple foolproof fix for quiz_attempts table

-- Just try to add the column, ignore if it exists
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS user_id UUID;

-- Drop any existing constraint
ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;

-- Clean up invalid user references
DELETE FROM public.quiz_attempts 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Add the foreign key constraint
ALTER TABLE public.quiz_attempts 
ADD CONSTRAINT quiz_attempts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);

-- Add comment
COMMENT ON COLUMN public.quiz_attempts.user_id IS 'Reference to the user who made this quiz attempt';
