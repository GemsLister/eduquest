-- Allow instructors to view quizzes from co-instructors in the same subject
-- This enables collaboration where instructors assigned to the same subject can see each other's quizzes

-- Update quizzes SELECT policy to include co-instructors in the same subject
DROP POLICY IF EXISTS "Instructors can view their own quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "Instructors can view quizzes in their subjects" ON public.quizzes;

CREATE POLICY "Instructors can view quizzes from co-instructors in same subject" ON public.quizzes
  FOR SELECT USING (
    -- Allow viewing own quizzes
    instructor_id = auth.uid()
    OR
    -- Allow viewing quizzes from instructors in the same subject
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss1
      WHERE iss1.instructor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.instructor_subjects iss2
        WHERE iss2.instructor_id = quizzes.instructor_id
        AND iss2.subject_id = iss1.subject_id
      )
    )
    OR
    -- Allow viewing published quizzes
    is_published = true
  );

-- Update questions SELECT policy to include questions from co-instructors' quizzes
DROP POLICY IF EXISTS "Users can view questions from accessible quizzes or bank" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes or bank" ON public.questions
  FOR SELECT USING (
    -- Allow viewing questions in accessible quizzes (including co-instructors)
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
        OR
        q.is_published = true
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

-- Update questions INSERT policy to allow creating questions in co-instructors' quizzes
DROP POLICY IF EXISTS "Instructors can create questions for accessible quizzes or bank" ON public.questions;

CREATE POLICY "Instructors can create questions for accessible quizzes or bank" ON public.questions
  FOR INSERT WITH CHECK (
    -- Allow if question belongs to an accessible quiz (including co-instructors)
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

-- Update questions UPDATE policy to allow updating questions in co-instructors' quizzes
DROP POLICY IF EXISTS "Instructors can update questions for accessible quizzes or bank" ON public.questions;

CREATE POLICY "Instructors can update questions for accessible quizzes or bank" ON public.questions
  FOR UPDATE USING (
    -- Allow updating questions in accessible quizzes (including co-instructors)
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

-- Update questions DELETE policy to allow deleting questions in co-instructors' quizzes
DROP POLICY IF EXISTS "Instructors can delete questions for accessible quizzes or bank" ON public.questions;

CREATE POLICY "Instructors can delete questions for accessible quizzes or bank" ON public.questions
  FOR DELETE USING (
    -- Allow deleting questions in accessible quizzes (including co-instructors)
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
