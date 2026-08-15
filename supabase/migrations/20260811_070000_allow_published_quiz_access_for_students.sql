-- Migration: 20260811_070000_allow_published_quiz_access_for_students.sql
-- Allow students & test takers to access published quizzes (private or public) when answering a quiz via share link

-- 1. Quizzes SELECT policy: allow viewing own quizzes, public quizzes, OR published quizzes
DROP POLICY IF EXISTS "Instructors and users can view quizzes based on privacy" ON public.quizzes;

CREATE POLICY "Instructors and users can view quizzes based on privacy" ON public.quizzes
  FOR SELECT USING (
    -- Own quizzes regardless of privacy
    instructor_id = auth.uid()
    OR
    -- Public quizzes
    is_private = false
    OR
    -- Published quizzes accessible to students via share link
    is_published = true
  );

-- 2. Quiz_questions SELECT policy
DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;

CREATE POLICY "Users can view quiz questions they have access to" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
        OR q.is_published = true
      )
    )
  );

-- 3. Questions SELECT policy
DROP POLICY IF EXISTS "Users can view questions from accessible quizzes or bank" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes or bank" ON public.questions
  FOR SELECT USING (
    -- Direct relationship via questions.quiz_id
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = questions.quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
        OR q.is_published = true
      )
    )
    OR
    -- Junction table relationship via quiz_questions
    EXISTS (
      SELECT 1 FROM public.quiz_questions qq
      JOIN public.quizzes q ON q.id = qq.quiz_id
      WHERE qq.question_id = questions.id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
        OR q.is_published = true
      )
    )
    OR
    -- Standalone questions / Question bank
    (
      questions.quiz_id IS NULL AND (
        (
          questions.section_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.sections s
            WHERE s.id = questions.section_id AND s.instructor_id = auth.uid()
          )
        )
        OR
        (
          questions.section_id IS NULL
        )
      )
    )
  );
