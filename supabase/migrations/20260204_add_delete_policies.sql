-- Add DELETE policies for quizzes (instructors can delete their own quizzes)
CREATE POLICY "Instructors can delete their own quizzes" ON public.quizzes
  FOR DELETE USING (auth.uid() = instructor_id);

-- Add UPDATE policy for quizzes (instructors can update their own quizzes)
CREATE POLICY "Instructors can update their own quizzes" ON public.quizzes
  FOR UPDATE USING (auth.uid() = instructor_id);

-- Add DELETE policy for questions (allow deletion of questions in quizzes owned by the instructor)
CREATE POLICY "Instructors can delete questions in their quizzes" ON public.questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- Add UPDATE policy for questions
CREATE POLICY "Instructors can update questions in their quizzes" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- Add INSERT policy for questions (allow insertion of questions in quizzes owned by the instructor)
CREATE POLICY "Instructors can insert questions in their quizzes" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );
