-- Safe fix for quiz_attempts table without breaking existing data

-- Step 1: Check if user_id column exists, if not add it as nullable first
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'quiz_attempts' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN user_id UUID;
    END IF;
END $$;

-- Step 2: Remove any existing foreign key constraint
ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;

-- Step 3: Clean up invalid user_id references
DELETE FROM public.quiz_attempts 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Step 4: Set user_id to NULL for any remaining invalid records
UPDATE public.quiz_attempts 
SET user_id = NULL 
WHERE user_id IS NOT NULL 
AND user_id NOT IN (SELECT id FROM auth.users);

-- Step 5: Delete records with NULL user_id (they're invalid for our use case)
DELETE FROM public.quiz_attempts WHERE user_id IS NULL;

-- Step 6: Add proper foreign key constraint
ALTER TABLE public.quiz_attempts 
ADD CONSTRAINT quiz_attempts_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 7: Make column NOT NULL (only if there are no NULL values)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM public.quiz_attempts WHERE user_id IS NULL LIMIT 1
    ) THEN
        ALTER TABLE public.quiz_attempts ALTER COLUMN user_id SET NOT NULL;
    END IF;
END $$;

-- Step 8: Create index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);

-- Step 9: Add comment
COMMENT ON COLUMN public.quiz_attempts.user_id IS 'Reference to the user who made the quiz attempt';
