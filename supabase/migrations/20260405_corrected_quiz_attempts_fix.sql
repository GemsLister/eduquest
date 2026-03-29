-- Corrected fix for quiz_attempts table without breaking existing data

-- Step 1: Add user_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'quiz_attempts' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN user_id UUID;
        RAISE NOTICE 'Added user_id column to quiz_attempts table';
    ELSE
        RAISE NOTICE 'user_id column already exists in quiz_attempts table';
    END IF;
END $$;

-- Step 2: Remove any existing foreign key constraint
ALTER TABLE public.quiz_attempts DROP CONSTRAINT IF EXISTS quiz_attempts_user_id_fkey;

-- Step 3: Clean up invalid user_id references (only if user_id column exists)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'quiz_attempts' 
        AND column_name = 'user_id'
    ) THEN
        DELETE FROM public.quiz_attempts 
        WHERE user_id IS NOT NULL 
        AND user_id NOT IN (SELECT id FROM auth.users);
        RAISE NOTICE 'Cleaned up invalid user_id references';
    END IF;
END $$;

-- Step 4: Add proper foreign key constraint
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'quiz_attempts' 
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.quiz_attempts 
        ADD CONSTRAINT quiz_attempts_user_id_fkey 
        FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added foreign key constraint to quiz_attempts table';
    END IF;
END $$;

-- Step 5: Make user_id NOT NULL (only if no NULL values exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'quiz_attempts' 
        AND column_name = 'user_id'
    ) AND NOT EXISTS (
        SELECT 1 FROM public.quiz_attempts WHERE user_id IS NULL LIMIT 1
    ) THEN
        ALTER TABLE public.quiz_attempts ALTER COLUMN user_id SET NOT NULL;
        RAISE NOTICE 'Made user_id column NOT NULL';
    END IF;
END $$;

-- Step 6: Create index for performance
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON public.quiz_attempts(user_id);

-- Step 7: Add comment
COMMENT ON COLUMN public.quiz_attempts.user_id IS 'Reference to the user who made the quiz attempt';
