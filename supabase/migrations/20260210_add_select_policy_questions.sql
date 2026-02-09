-- Add SELECT policy for questions table so instructors can read their own questions
DROP POLICY IF EXISTS "Instructors can view questions in their quizzes" ON public.questions;

CREATE POLICY "Instructors can view questions in their quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );
