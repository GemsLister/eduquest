-- Add parent_quiz_id to quizzes table to track quiz versions and revisions
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS parent_quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_quizzes_parent_quiz_id
ON public.quizzes(parent_quiz_id);

-- Add RLS policy to allow instructors to create quiz versions for their quizzes
DROP POLICY IF EXISTS "Instructors can create quiz versions for their quizzes" ON public.quizzes;
CREATE POLICY "Instructors can create quiz versions for their quizzes" ON public.quizzes
  FOR INSERT WITH CHECK (
    instructor_id = auth.uid()
  );

-- Add RLS policy to allow instructors to view quiz versions for their quizzes
DROP POLICY IF EXISTS "Instructors can view quiz versions for their quizzes" ON public.quizzes;
CREATE POLICY "Instructors can view quiz versions for their quizzes" ON public.quizzes
  FOR SELECT USING (
    instructor_id = auth.uid()
  );
