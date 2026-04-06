-- Fix quiz_attempts foreign key constraint issues
-- Step 1: Remove invalid user_id references that don't exist in auth.users

-- Delete quiz attempts with invalid user_ids
DELETE FROM public.quiz_attempts 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Step 2: Drop the existing foreign key constraint if it exists
ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;

-- Step 3: Re-add the user_id column with proper default and constraint
ALTER TABLE public.quiz_attempts 
ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 4: Update any NULL user_ids to a valid user or delete the records
-- First, let's see if there are any quiz attempts without user_id
UPDATE public.quiz_attempts 
SET user_id = NULL 
WHERE user_id IS NULL;

-- Delete any remaining records that still have NULL user_id (they're invalid)
DELETE FROM public.quiz_attempts WHERE user_id IS NULL;

-- Step 5: Make user_id NOT NULL for future records
ALTER TABLE public.quiz_attempts 
ALTER COLUMN user_id SET NOT NULL;

-- Step 6: Re-create the foreign key constraint
ALTER TABLE public.quiz_attempts 
ADD CONSTRAINT quiz_attempts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 7: Create index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);

-- Step 8: Add comment
COMMENT ON COLUMN public.quiz_attempts.user_id IS 'Reference to the user who made the quiz attempt';
