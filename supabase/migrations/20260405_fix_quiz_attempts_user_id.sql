-- Ensure user_id column exists in quiz_attempts table
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS user_id UUID NOT NULL DEFAULT gen_random_uuid() REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for better query performance on user_id
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id
ON public.quiz_attempts(user_id);

-- Add comment for documentation
COMMENT ON COLUMN public.quiz_attempts.user_id IS 'Reference to the user who made the quiz attempt';
