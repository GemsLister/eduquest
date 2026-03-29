-- Fix quiz_attempts table to support both authenticated users and student profiles
-- This migration allows either user_id (for authenticated users) or student_id (for student profiles)

-- Step 1: Make user_id nullable to allow student profiles
ALTER TABLE public.quiz_attempts
ALTER COLUMN user_id DROP NOT NULL;

-- Step 2: Add student_id column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND table_name = 'quiz_attempts' 
        AND column_name = 'student_id'
    ) THEN
        ALTER TABLE public.quiz_attempts ADD COLUMN student_id UUID REFERENCES public.student_profile(id) ON DELETE CASCADE;
        RAISE NOTICE 'Added student_id column to quiz_attempts table';
    ELSE
        RAISE NOTICE 'student_id column already exists in quiz_attempts table';
    END IF;
END $$;

-- Step 3: Add constraint to ensure at least one identifier is present
ALTER TABLE public.quiz_attempts
ADD CONSTRAINT IF NOT EXISTS check_attempt_identifier CHECK (
  user_id IS NOT NULL OR student_id IS NOT NULL
);

-- Step 4: Update RLS policies to support both user_id and student_id
DROP POLICY IF EXISTS "Users can view their own attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Users can create attempts" ON public.quiz_attempts;

-- Create updated RLS policies
CREATE POLICY "Users can view their own attempts" ON public.quiz_attempts
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (
      SELECT instructor_id FROM public.quizzes q WHERE q.id = quiz_id
    ) OR
    EXISTS (
      SELECT 1 FROM public.student_profile sp 
      WHERE sp.id = student_id AND sp.student_email = auth.email()
    )
  );

CREATE POLICY "Users can create attempts" ON public.quiz_attempts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR
    -- Allow student profile based attempts (for manual entry)
    (student_id IS NOT NULL AND user_id IS NULL)
  );

-- Step 5: Create index for student_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_id ON public.quiz_attempts(student_id);

-- Step 6: Add comments
COMMENT ON COLUMN public.quiz_attempts.user_id IS 'Reference to authenticated user (for Google login users)';
COMMENT ON COLUMN public.quiz_attempts.student_id IS 'Reference to student profile (for manual entry)';
