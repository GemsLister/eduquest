-- Add is_private column to quizzes table and enforce default Private visibility
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT TRUE;

-- Update any null values to default TRUE (Private)
UPDATE public.quizzes SET is_private = TRUE WHERE is_private IS NULL;

-- Quizzes SELECT policy: Owners can view their own quizzes (private or public).
-- Non-owners can only view Public quizzes (is_private = false).
DROP POLICY IF EXISTS "Instructors can view quizzes from co-instructors in same subject" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors and users can view quizzes based on privacy" ON public.quizzes;

CREATE POLICY "Instructors and users can view quizzes based on privacy" ON public.quizzes
  FOR SELECT USING (
    -- Own quizzes regardless of privacy
    instructor_id = auth.uid()
    OR
    -- Public quizzes
    is_private = false
  );

-- Quiz_questions RLS SELECT policy
DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;

CREATE POLICY "Users can view quiz questions they have access to" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
  );

-- Quiz_questions RLS INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Instructors can manage quiz questions for accessible quizzes" ON public.quiz_questions;
CREATE POLICY "Instructors can manage quiz questions for accessible quizzes" ON public.quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
  );

DROP POLICY IF EXISTS "Instructors can update quiz question order for accessible quizzes" ON public.quiz_questions;
CREATE POLICY "Instructors can update quiz question order for accessible quizzes" ON public.quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
  );

DROP POLICY IF EXISTS "Instructors can delete quiz questions for accessible quizzes" ON public.quiz_questions;
CREATE POLICY "Instructors can delete quiz questions for accessible quizzes" ON public.quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
  );

-- Questions SELECT policy: Questions belonging to private quizzes are visible ONLY to the quiz owner.
-- Questions belonging to public quizzes are visible to non-owners.
DROP POLICY IF EXISTS "Users can view questions from accessible quizzes or bank" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes or bank" ON public.questions
  FOR SELECT USING (
    -- Direct relationship via questions.quiz_id
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = questions.quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
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

-- Questions INSERT/UPDATE/DELETE policies
DROP POLICY IF EXISTS "Instructors can create questions for accessible quizzes or bank" ON public.questions;
CREATE POLICY "Instructors can create questions for accessible quizzes or bank" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
    OR
    (
      quiz_id IS NULL AND (
        (
          section_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.sections s
            WHERE s.id = section_id AND s.instructor_id = auth.uid()
          )
        )
        OR
        (
          section_id IS NULL
        )
      )
    )
  );

DROP POLICY IF EXISTS "Instructors can update questions for accessible quizzes or bank" ON public.questions;
CREATE POLICY "Instructors can update questions for accessible quizzes or bank" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = questions.quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.quiz_questions qq
      JOIN public.quizzes q ON q.id = qq.quiz_id
      WHERE qq.question_id = questions.id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
    OR
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

DROP POLICY IF EXISTS "Instructors can delete questions for accessible quizzes or bank" ON public.questions;
CREATE POLICY "Instructors can delete questions for accessible quizzes or bank" ON public.questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = questions.quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
    OR
    EXISTS (
      SELECT 1 FROM public.quiz_questions qq
      JOIN public.quizzes q ON q.id = qq.quiz_id
      WHERE qq.question_id = questions.id AND (
        q.instructor_id = auth.uid()
        OR q.is_private = false
      )
    )
    OR
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

-- Update get_accessible_quizzes RPC function to restrict private quizzes to owner only
CREATE OR REPLACE FUNCTION get_accessible_quizzes()
RETURNS TABLE (
  quiz_id UUID,
  title VARCHAR(255),
  subject_id UUID,
  subject_name VARCHAR(255),
  subject_code VARCHAR(50),
  owner_id UUID,
  owner_name VARCHAR(255),
  is_collaborative BOOLEAN,
  is_published BOOLEAN,
  is_private BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id AS quiz_id,
    q.title,
    q.subject_id,
    s.name AS subject_name,
    s.code AS subject_code,
    q.instructor_id AS owner_id,
    CONCAT(p.first_name, ' ', p.last_name) AS owner_name,
    q.is_collaborative,
    q.is_published,
    q.is_private,
    q.created_at
  FROM public.quizzes q
  LEFT JOIN public.subjects s ON s.id = q.subject_id
  LEFT JOIN public.profiles p ON p.id = q.instructor_id
  WHERE
    -- User is the owner (can see own quizzes regardless of privacy)
    q.instructor_id = auth.uid() OR
    -- Quiz is public (is_private = false)
    q.is_private = FALSE
  ORDER BY q.created_at DESC;
END;
$$;
