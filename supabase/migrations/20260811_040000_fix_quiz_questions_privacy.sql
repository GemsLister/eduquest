-- Update quiz_questions junction table RLS policies to respect is_private field
-- This ensures that quiz-question relationships for private quizzes are only visible to the quiz owner

-- Update SELECT policy for quiz_questions to respect quiz privacy
DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;

CREATE POLICY "Users can view quiz questions they have access to" ON public.quiz_questions
  FOR SELECT USING (
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
  );

-- Update INSERT policy for quiz_questions to respect quiz privacy
DROP POLICY IF EXISTS "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions;

CREATE POLICY "Instructors can manage quiz questions for accessible quizzes" ON public.quiz_questions
  FOR INSERT WITH CHECK (
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
  );

-- Update UPDATE policy for quiz_questions to respect quiz privacy
DROP POLICY IF EXISTS "Instructors can update quiz question order" ON public.quiz_questions;

CREATE POLICY "Instructors can update quiz question order for accessible quizzes" ON public.quiz_questions
  FOR UPDATE USING (
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
  );

-- Update DELETE policy for quiz_questions to respect quiz privacy
DROP POLICY IF EXISTS "Instructors can delete quiz questions" ON public.quiz_questions;

CREATE POLICY "Instructors can delete quiz questions for accessible quizzes" ON public.quiz_questions
  FOR DELETE USING (
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
  );
