-- Add flag column to questions table
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS flag VARCHAR(50) DEFAULT 'pending' CHECK (flag IN ('pending', 'approved', 'needs_revision', 'discard'));

-- Update RLS policy for questions to include flag column in SELECT
-- (The existing policy should work, but let's make sure flag is readable)
DO $$
BEGIN
    -- Check if policy exists and recreate if needed
    IF EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Users can view questions in published quizzes or their own' 
        AND tablename = 'questions'
    ) THEN
        DROP POLICY IF EXISTS "Users can view questions in published quizzes or their own" ON public.questions;
    END IF;

    CREATE POLICY "Users can view questions in published quizzes or their own" ON public.questions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_id AND (q.instructor_id = auth.uid() OR q.is_published = TRUE)
        )
    );
END $$;

-- Update the INSERT policy to allow setting flag
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Instructors can create questions' 
        AND tablename = 'questions'
    ) THEN
        DROP POLICY IF EXISTS "Instructors can create questions" ON public.questions;
    END IF;

    CREATE POLICY "Instructors can create questions" ON public.questions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.quizzes q
            WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
        )
    );
END $$;

-- Add UPDATE policy to allow instructors to update flags
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Instructors can update their own questions' 
        AND tablename = 'questions'
    ) THEN
        CREATE POLICY "Instructors can update their own questions" ON public.questions
        FOR UPDATE USING (
            EXISTS (
                SELECT 1 FROM public.quizzes q
                WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
            )
        );
    END IF;
END $$;
