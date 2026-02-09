-- Update RLS policies to allow guest access to published quizzes via share token

-- Drop existing policies that might be too restrictive
DROP POLICY IF EXISTS "Users can view questions in published quizzes or their own" ON public.questions;
DROP POLICY IF EXISTS "Users can create attempts" ON public.quiz_attempts;
DROP POLICY IF EXISTS "Instructors can create questions" ON public.questions;

-- New policy: Allow anyone to view questions in published quizzes (accessed via share token)
CREATE POLICY "Anyone can view published quiz questions" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.is_published = TRUE
    )
  );

-- Instructors can still create questions in their quizzes
CREATE POLICY "Instructors can create questions" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- New policy: Allow anyone (including anonymous) to create quiz attempts for published quizzes
CREATE POLICY "Anyone can create quiz attempts for published quizzes" ON public.quiz_attempts
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.is_published = TRUE
    ) OR auth.uid() IS NOT NULL
  );

-- Update policy: Allow users and guests to view their attempts
CREATE POLICY "Users can view their own attempts or instructors can view all" ON public.quiz_attempts
  FOR SELECT USING (
    auth.uid() = user_id OR
    guest_name IS NOT NULL OR
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- Allow anyone to insert quiz responses for ongoing attempts
CREATE POLICY "Users can create quiz responses" ON public.quiz_responses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_id AND (qa.user_id = auth.uid() OR qa.guest_name IS NOT NULL)
    )
  );

-- Allow viewing quiz responses
CREATE POLICY "Users can view quiz responses for their attempts" ON public.quiz_responses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quiz_attempts qa
      WHERE qa.id = attempt_id AND (qa.user_id = auth.uid() OR qa.guest_name IS NOT NULL OR
        EXISTS (
          SELECT 1 FROM public.quizzes q
          WHERE q.id = qa.quiz_id AND q.instructor_id = auth.uid()
        )
      )
    )
  );
