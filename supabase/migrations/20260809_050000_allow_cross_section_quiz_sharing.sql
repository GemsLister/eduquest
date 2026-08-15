-- Allow cross-section quiz sharing within the same subject
-- This enables instructors to see and use quizzes from other sections within the same subject
-- Example: Section C's "Database Review" quiz can be seen by Section A if both sections are in the same subject

-- Update quiz_sections SELECT policy to include cross-section visibility within same subject
DROP POLICY IF EXISTS "Users can view quiz sections for published quizzes" ON public.quiz_sections;

CREATE POLICY "Users can view quiz sections for accessible quizzes" ON public.quiz_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        -- Own quizzes
        q.instructor_id = auth.uid()
        OR
        -- Published quizzes
        q.is_published = TRUE
        OR
        -- Quizzes from co-instructors in the same subject
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
  );

-- Update quiz_sections INSERT/UPDATE/DELETE policies to allow cross-section sharing
DROP POLICY IF EXISTS "Instructors can manage their quiz sections" ON public.quiz_sections;

CREATE POLICY "Instructors can manage quiz sections for accessible quizzes" ON public.quiz_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        -- Own quizzes
        q.instructor_id = auth.uid()
        OR
        -- Quizzes from co-instructors in the same subject
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
  );

-- Update the quizzes SELECT policy to ensure cross-section visibility is maintained
DROP POLICY IF EXISTS "Instructors can view quizzes from co-instructors in same subject" ON public.quizzes;

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

-- Add a function to share a quiz with other sections in the same subject
CREATE OR REPLACE FUNCTION share_quiz_with_subject_sections(
  p_quiz_id UUID,
  p_subject_id UUID
)
RETURNS TABLE (section_id UUID, section_name VARCHAR, success BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor_id UUID;
BEGIN
  -- Get the quiz instructor to verify permissions
  SELECT instructor_id INTO v_instructor_id
  FROM public.quizzes
  WHERE id = p_quiz_id;
  
  -- Verify the current user is the quiz owner or a co-instructor in the same subject
  IF NOT EXISTS (
    SELECT 1 FROM public.instructor_subjects iss
    WHERE iss.instructor_id = auth.uid()
    AND iss.subject_id = p_subject_id
    AND (
      iss.instructor_id = v_instructor_id
      OR
      EXISTS (
        SELECT 1 FROM public.instructor_subjects iss2
        WHERE iss2.instructor_id = v_instructor_id
        AND iss2.subject_id = p_subject_id
      )
    )
  ) THEN
    RAISE EXCEPTION 'You do not have permission to share this quiz';
  END IF;
  
  -- Return all sections in the subject that don't already have this quiz
  RETURN QUERY
  SELECT 
    sec.id AS section_id,
    sec.name AS section_name,
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.quiz_sections qs
        WHERE qs.quiz_id = p_quiz_id AND qs.section_id = sec.id
      ) THEN true
      ELSE false
    END AS success
  FROM public.sections sec
  WHERE sec.is_archived = false
  AND EXISTS (
    SELECT 1 FROM public.instructor_subject_sections iss
    JOIN public.instructor_subjects isub ON iss.instructor_subject_id = isub.id
    WHERE isub.subject_id = p_subject_id AND iss.section_id = sec.id
  );
END;
$$;

-- Add a function to automatically share a quiz with all sections in the same subject
CREATE OR REPLACE FUNCTION auto_share_quiz_with_subject_sections(p_quiz_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id UUID;
  v_instructor_id UUID;
  v_count INT;
BEGIN
  -- Get the quiz's subject via instructor_subjects
  SELECT iss.subject_id, q.instructor_id
  INTO v_subject_id, v_instructor_id
  FROM public.quizzes q
  JOIN public.instructor_subjects iss ON iss.instructor_id = q.instructor_id
  WHERE q.id = p_quiz_id
  LIMIT 1;
  
  IF v_subject_id IS NULL THEN
    RAISE EXCEPTION 'Quiz is not assigned to any subject';
  END IF;
  
  -- Verify permissions
  IF v_instructor_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.instructor_subjects iss
    WHERE iss.instructor_id = auth.uid()
    AND iss.subject_id = v_subject_id
  ) THEN
    RAISE EXCEPTION 'You do not have permission to share this quiz';
  END IF;
  
  -- Insert quiz-section relationships for all sections in the subject
  INSERT INTO public.quiz_sections (quiz_id, section_id)
  SELECT p_quiz_id, sec.id
  FROM public.sections sec
  WHERE sec.is_archived = false
  AND EXISTS (
    SELECT 1 FROM public.instructor_subject_sections iss
    JOIN public.instructor_subjects isub ON iss.instructor_subject_id = isub.id
    WHERE isub.subject_id = v_subject_id AND iss.section_id = sec.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.quiz_sections qs
    WHERE qs.quiz_id = p_quiz_id AND qs.section_id = sec.id
  );
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  
  RETURN v_count;
END;
$$;