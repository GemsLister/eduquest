-- Make user_id nullable for guest quiz attempts
ALTER TABLE public.quiz_attempts
ALTER COLUMN user_id DROP NOT NULL;

-- Add constraint to ensure at least one identifier is present
ALTER TABLE public.quiz_attempts
ADD CONSTRAINT check_attempt_identifier CHECK (
  user_id IS NOT NULL OR guest_name IS NOT NULL
);
