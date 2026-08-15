-- Fix public quiz questions visibility and RLS policies
-- 1. Sections SELECT policy: break cyclic dependency between quizzes and sections
-- 2. Quizzes SELECT policy: allow owners, published quizzes, and ALL public quizzes (is_private = false)
-- 3. Quiz_questions RLS policies: allow access to quiz-question links for accessible quizzes
-- 4. Questions RLS policies: allow access if question belongs to an accessible quiz (via direct quiz_id OR junction quiz_questions)
-- 5. Ensure each quiz_sections record has a unique distinct share_token for separate section URLs
-- 6. Update get_accessible_quizzes() to list all public quizzes

-- Fix sections SELECT policy to prevent RLS recursion loops with quizzes table
DROP POLICY IF EXISTS "Anyone can view sections with published quizzes" ON public.sections;
DROP POLICY IF EXISTS "Instructors can view their own sections" ON public.sections;
DROP POLICY IF EXISTS "Users can view active sections" ON public.sections;

CREATE POLICY "Users can view active sections" ON public.sections
  FOR SELECT USING (true);

-- Update SELECT policy for quizzes
DROP POLICY IF EXISTS "Instructors can view quizzes from co-instructors in same subject" ON public.quizzes;

CREATE POLICY "Instructors can view quizzes from co-instructors in same subject" ON public.quizzes
  FOR SELECT USING (
    -- Own quizzes regardless of privacy
    instructor_id = auth.uid()
    OR
    -- Published quizzes (for students & public links)
    is_published = true
    OR
    -- Public quizzes (everyone can view public quizzes)
    is_private = false
  );

-- Update SELECT policy for quiz_questions
DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;

CREATE POLICY "Users can view quiz questions they have access to" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_published = true
        OR q.is_private = false
      )
    )
  );

-- Update INSERT policy for quiz_questions
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

-- Update UPDATE policy for quiz_questions
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

-- Update DELETE policy for quiz_questions
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

-- Update SELECT policy for questions (Crucial fix for junction table quiz_questions + direct quiz_id)
DROP POLICY IF EXISTS "Users can view questions from accessible quizzes or bank" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes or bank" ON public.questions
  FOR SELECT USING (
    -- Direct relationship via questions.quiz_id
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = questions.quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_published = true
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
        OR q.is_published = true
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

-- Update INSERT policy for questions
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

-- Update UPDATE policy for questions
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

-- Update DELETE policy for questions
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

-- Update get_accessible_quizzes RPC function to include all public quizzes
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
    -- User is the owner
    q.instructor_id = auth.uid() OR
    -- Quiz is published (for students)
    q.is_published = TRUE OR
    -- Quiz is public (is_private = false)
    q.is_private = FALSE
  ORDER BY q.created_at DESC;
END;
$$;

-- Regenerate distinct unique share_tokens for any quiz_sections that share duplicate or quiz-level share_tokens
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN 
    SELECT qs.id
    FROM public.quiz_sections qs
    LEFT JOIN public.quizzes q ON q.id = qs.quiz_id
    WHERE qs.share_token IS NULL 
       OR qs.share_token = '' 
       OR qs.share_token = q.share_token
       OR qs.share_token IN (
         SELECT share_token 
         FROM public.quiz_sections 
         WHERE share_token IS NOT NULL 
         GROUP BY share_token 
         HAVING count(*) > 1
       )
  LOOP
    UPDATE public.quiz_sections
    SET share_token = generate_share_token()
    WHERE id = r.id;
  END LOOP;
END;
$$;
