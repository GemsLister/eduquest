-- Fix: Archiving a question in the question bank should NOT hide it from quizzes.
-- The is_archived flag should only control question bank visibility, not quiz visibility.

-- 1. Ensure the is_archived column exists on questions
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT FALSE;

-- 2. Drop any RLS policies that might be filtering archived questions
-- and recreate them WITHOUT is_archived filtering.

-- Drop and recreate the public SELECT policy (for students/guests viewing published quiz questions)
DROP POLICY IF EXISTS "Anyone can view published quiz questions" ON public.questions;
CREATE POLICY "Anyone can view published quiz questions" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.is_published = TRUE
    )
  );

-- Drop and recreate the instructor SELECT policy
DROP POLICY IF EXISTS "Instructors can view questions in their quizzes" ON public.questions;
CREATE POLICY "Instructors can view questions in their quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- Drop and recreate the combined SELECT policy (if it exists from older migrations)
DROP POLICY IF EXISTS "Users can view questions in published quizzes or their own" ON public.questions;
CREATE POLICY "Users can view questions in published quizzes or their own" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (q.instructor_id = auth.uid() OR q.is_published = TRUE)
    )
  );

-- Ensure indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_questions_is_archived ON public.questions(is_archived);
CREATE INDEX IF NOT EXISTS idx_questions_quiz_archived ON public.questions(quiz_id, is_archived);
