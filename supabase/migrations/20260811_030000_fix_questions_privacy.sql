-- Update questions RLS policy to respect is_private field
-- This ensures that questions from private quizzes are only visible to the quiz owner
-- Questions from public quizzes can be seen by co-instructors in the same subject

-- Update SELECT policy for questions to respect quiz privacy
DROP POLICY IF EXISTS "Users can view questions from accessible quizzes or bank" ON public.questions;

CREATE POLICY "Users can view questions from accessible quizzes or bank" ON public.questions
  FOR SELECT USING (
    -- Allow viewing questions in accessible quizzes
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        -- Own quizzes regardless of privacy
        q.instructor_id = auth.uid()
        OR
        -- Published quizzes (for students)
        q.is_published = true
        OR
        -- Public quizzes from co-instructors in the same subject
        (q.is_private = false AND EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        ))
      )
    )
    OR
    -- Allow viewing standalone questions
    (
      quiz_id IS NULL AND section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid()
      )
    )
  );

-- Update INSERT policy for questions to respect quiz privacy
DROP POLICY IF EXISTS "Instructors can create questions for accessible quizzes or bank" ON public.questions;

CREATE POLICY "Instructors can create questions for accessible quizzes or bank" ON public.questions
  FOR INSERT WITH CHECK (
    -- Allow creating questions in accessible quizzes
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        -- Own quizzes regardless of privacy
        q.instructor_id = auth.uid()
        OR
        -- Public quizzes from co-instructors in the same subject
        (q.is_private = false AND EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        ))
      )
    )
    OR
    -- Allow creating standalone questions
    (
      quiz_id IS NULL AND section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid()
      )
    )
  );

-- Update UPDATE policy for questions to respect quiz privacy
DROP POLICY IF EXISTS "Instructors can update questions for accessible quizzes or bank" ON public.questions;

CREATE POLICY "Instructors can update questions for accessible quizzes or bank" ON public.questions
  FOR UPDATE USING (
    -- Allow updating questions in accessible quizzes
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        -- Own quizzes regardless of privacy
        q.instructor_id = auth.uid()
        OR
        -- Public quizzes from co-instructors in the same subject
        (q.is_private = false AND EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        ))
      )
    )
    OR
    -- Allow updating standalone questions
    (
      quiz_id IS NULL AND section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid()
      )
    )
  );

-- Update DELETE policy for questions to respect quiz privacy
DROP POLICY IF EXISTS "Instructors can delete questions for accessible quizzes or bank" ON public.questions;

CREATE POLICY "Instructors can delete questions for accessible quizzes or bank" ON public.questions
  FOR DELETE USING (
    -- Allow deleting questions in accessible quizzes
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        -- Own quizzes regardless of privacy
        q.instructor_id = auth.uid()
        OR
        -- Public quizzes from co-instructors in the same subject
        (q.is_private = false AND EXISTS (
          SELECT 1 FROM public.instructor_subjects iss1
          WHERE iss1.instructor_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.instructor_subjects iss2
            WHERE iss2.instructor_id = q.instructor_id
            AND iss2.subject_id = iss1.subject_id
          )
        ))
      )
    )
    OR
    -- Allow deleting standalone questions
    (
      quiz_id IS NULL AND section_id IS NOT NULL AND
      EXISTS (
        SELECT 1 FROM public.sections s
        WHERE s.id = section_id AND s.instructor_id = auth.uid()
      )
    )
  );
