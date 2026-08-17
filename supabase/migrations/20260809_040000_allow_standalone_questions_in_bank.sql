-- Allow instructors to create standalone questions in the question bank
-- These questions have quiz_id = NULL but are assigned to a section via section_id

-- Drop existing INSERT policy for questions
DROP POLICY IF EXISTS "Instructors can create questions for accessible quizzes" ON public.questions;

-- Create new INSERT policy that allows both:
-- 1. Questions in quizzes (existing behavior)
-- 2. Standalone questions in the bank (quiz_id = NULL) assigned to instructor's sections
CREATE POLICY "Instructors can create questions for accessible quizzes or bank" ON public.questions
  FOR INSERT WITH CHECK (
    -- Allow if question belongs to an accessible quiz
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        )
        OR q.is_published = true
      )
    )
    OR
    -- Allow if question is standalone (quiz_id IS NULL) and assigned to instructor's section
    (
      quiz_id IS NULL AND
      section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid() AND s.is_archived = false
      )
    )
  );

-- Update SELECT policy to include standalone questions
DROP POLICY IF EXISTS "Users can view questions from accessible quizzes" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes or bank" ON public.questions
  FOR SELECT USING (
    -- Allow viewing questions in accessible quizzes
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR q.is_published = true
        OR
        EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        )
      )
    )
    OR
    -- Allow viewing standalone questions in instructor's own sections
    (
      quiz_id IS NULL AND
      section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid()
      )
    )
  );

-- Update UPDATE policy to include standalone questions
DROP POLICY IF EXISTS "Instructors can update questions for accessible quizzes" ON public.questions;

CREATE POLICY "Instructors can update questions for accessible quizzes or bank" ON public.questions
  FOR UPDATE USING (
    -- Allow updating questions in accessible quizzes
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        )
      )
    )
    OR
    -- Allow updating standalone questions in instructor's own sections
    (
      quiz_id IS NULL AND
      section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid()
      )
    )
  );

-- Update DELETE policy to include standalone questions
DROP POLICY IF EXISTS "Instructors can delete questions for accessible quizzes" ON public.questions;

CREATE POLICY "Instructors can delete questions for accessible quizzes or bank" ON public.questions
  FOR DELETE USING (
    -- Allow deleting questions in accessible quizzes
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid()
        OR
        EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        )
      )
    )
    OR
    -- Allow deleting standalone questions in instructor's own sections
    (
      quiz_id IS NULL AND
      section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid()
      )
    )
  );
