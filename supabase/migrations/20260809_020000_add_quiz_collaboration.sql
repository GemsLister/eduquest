-- ============================================================
-- Shared Quiz Management Feature
-- Allows instructors to share quizzes through subject-level authorization
-- Uses existing sections-based authorization (no new tables needed)
-- ============================================================

-- 1) Add is_collaborative flag to quizzes for better UI indication
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS is_collaborative BOOLEAN DEFAULT FALSE;

-- 2) Update RLS policies for quizzes to allow subject-level access
-- Instructors can access quizzes if:
-- - They created the quiz (instructor_id = auth.uid())
-- - The quiz is published (is_published = TRUE)
-- - They have a section with the same subject_id as the quiz

DROP POLICY IF EXISTS "Instructors can view their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can view their own quizzes or collaborative quizzes" ON public.quizzes;

CREATE POLICY "Instructors can view quizzes from their subjects" ON public.quizzes
  FOR SELECT USING (
    auth.uid() = instructor_id OR
    is_published = TRUE OR
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.subject_id = quizzes.subject_id AND s.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors can update their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can update their own quizzes or collaborative quizzes" ON public.quizzes;

CREATE POLICY "Instructors can update quizzes from their subjects" ON public.quizzes
  FOR UPDATE USING (
    auth.uid() = instructor_id OR
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.subject_id = quizzes.subject_id AND s.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors can create quizzes" ON public.quizzes;

CREATE POLICY "Instructors can create quizzes for their subjects" ON public.quizzes
  FOR INSERT WITH CHECK (
    auth.uid() = instructor_id OR
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.subject_id = quizzes.subject_id AND s.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors can delete their own quizzes" ON public.quizzes;

CREATE POLICY "Instructors can delete quizzes from their subjects" ON public.quizzes
  FOR DELETE USING (
    auth.uid() = instructor_id OR
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.subject_id = quizzes.subject_id AND s.instructor_id = auth.uid()
    )
  );

-- 3) Update RLS policies for questions to allow subject-level access
DROP POLICY IF EXISTS "Users can view questions in published quizzes or their own" ON public.questions;
DROP POLICY IF EXISTS "Users can view questions in published quizzes or their own or collaborative" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes" ON public.questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid() OR
        q.is_published = TRUE OR
        EXISTS (
          SELECT 1 FROM public.sections s
          WHERE s.subject_id = q.subject_id AND s.instructor_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Instructors can create questions" ON public.questions;
DROP POLICY IF EXISTS "Instructors can create questions in their own quizzes or collaborative quizzes" ON public.questions;

CREATE POLICY "Instructors can create questions for accessible quizzes" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.sections s
          WHERE s.subject_id = q.subject_id AND s.instructor_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Instructors can update their own questions" ON public.questions;

CREATE POLICY "Instructors can update questions for accessible quizzes" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.sections s
          WHERE s.subject_id = q.subject_id AND s.instructor_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Instructors can delete their own questions" ON public.questions;

CREATE POLICY "Instructors can delete questions for accessible quizzes" ON public.questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM public.sections s
          WHERE s.subject_id = q.subject_id AND s.instructor_id = auth.uid()
        )
      )
    )
  );

-- 4) Create RPC function to get quizzes accessible to an instructor
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
    q.created_at
  FROM public.quizzes q
  LEFT JOIN public.subjects s ON s.id = q.subject_id
  LEFT JOIN public.profiles p ON p.id = q.instructor_id
  WHERE
    -- User is the owner
    q.instructor_id = auth.uid() OR
    -- User has a section with the same subject
    EXISTS (
      SELECT 1 FROM public.sections sec
      WHERE sec.subject_id = q.subject_id AND sec.instructor_id = auth.uid()
    )
  ORDER BY q.created_at DESC;
END;
$$;
