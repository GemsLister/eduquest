-- Migration: 20260811_080000_fix_private_quiz_student_access.sql
-- Fix Row Level Security policies and add RPC helper so students taking published private/public quizzes via share link can load questions

-- 1. SECURITY DEFINER RPC function to fetch questions for published quizzes (bypasses RLS for students taking the exam)
CREATE OR REPLACE FUNCTION get_public_quiz_questions(p_quiz_id UUID)
RETURNS TABLE (
  id UUID,
  quiz_id UUID,
  type TEXT,
  text TEXT,
  options JSONB,
  points INTEGER,
  correct_answer TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the quiz exists and is published
  IF NOT EXISTS (SELECT 1 FROM public.quizzes WHERE id = p_quiz_id AND is_published = TRUE) THEN
    RETURN;
  END IF;

  -- First try fetching questions via quiz_questions junction table
  IF EXISTS (SELECT 1 FROM public.quiz_questions WHERE quiz_id = p_quiz_id) THEN
    RETURN QUERY
    SELECT 
      q.id,
      q.quiz_id,
      q.type,
      q.text,
      q.options,
      q.points,
      q.correct_answer,
      q.created_at
    FROM public.quiz_questions qq
    JOIN public.questions q ON q.id = qq.question_id
    WHERE qq.quiz_id = p_quiz_id
    ORDER BY qq.order_index ASC, q.created_at ASC;
  ELSE
    -- Direct relationship via questions.quiz_id
    RETURN QUERY
    SELECT 
      q.id,
      q.quiz_id,
      q.type,
      q.text,
      q.options,
      q.points,
      q.correct_answer,
      q.created_at
    FROM public.questions q
    WHERE q.quiz_id = p_quiz_id
    ORDER BY q.created_at ASC;
  END IF;
END;
$$;

-- 2. Quizzes SELECT Policy
DROP POLICY IF EXISTS "Instructors and users can view quizzes based on privacy" ON public.quizzes;

CREATE POLICY "Instructors and users can view quizzes based on privacy" ON public.quizzes
  FOR SELECT USING (
    instructor_id = auth.uid()
    OR
    is_private = false
    OR
    is_published = true
  );

-- 3. Quiz_questions SELECT Policy
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

-- 4. Questions SELECT Policy
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
