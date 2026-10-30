-- ============================================================
-- Copy the final Bloom's levels of a review submission onto its questions
--
-- An instructor or reviewer can now correct the classifier's Bloom's level
-- for a question. The corrected level lives in the submission's
-- analysis_results; this function copies each question's final level to
-- questions.blooms_level (the six levels) and questions.cognitive_level
-- (LOTS / HOTS), so student performance reports use the corrected levels.
--
-- Reviewers can't update questions directly (only the exam owner can), so
-- this runs as SECURITY DEFINER and checks the caller itself: the submitting
-- instructor, the assigned reviewer, Senior Faculty or a Department Head.
-- Only the newest submission of an exam writes levels, so editing an older
-- submission can't overwrite the current ones.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_question_blooms_levels(p_submission_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub record;
  updated_count integer;
BEGIN
  SELECT s.id, s.quiz_id, s.instructor_id, s.assigned_reviewer_id, s.analysis_results, s.created_at
  INTO sub
  FROM public.quiz_analysis_submissions s
  WHERE s.id = p_submission_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    auth.uid() = sub.instructor_id
    OR auth.uid() = sub.assigned_reviewer_id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND (p.is_admin = true OR p.is_faculty_head = true)
    )
  ) THEN
    RAISE EXCEPTION 'Not allowed to update this exam''s Bloom''s levels' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.quiz_analysis_submissions newer
    WHERE newer.quiz_id = sub.quiz_id
      AND newer.created_at > sub.created_at
  ) THEN
    RETURN 0;
  END IF;

  UPDATE public.questions q
  SET blooms_level = a.level,
      cognitive_level = a.thinking_order
  FROM (
    SELECT
      elem->>'questionId' AS question_id,
      elem->>'bloomsLevel' AS level,
      elem->>'thinkingOrder' AS thinking_order
    FROM jsonb_array_elements(COALESCE(sub.analysis_results->'analysis', '[]'::jsonb)) AS elem
  ) a
  WHERE a.question_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND q.id = a.question_id::uuid
    AND a.level IN ('Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating')
    AND a.thinking_order IN ('LOTS', 'HOTS')
    AND (
      q.quiz_id = sub.quiz_id
      OR EXISTS (
        SELECT 1 FROM public.quiz_questions qq
        WHERE qq.quiz_id = sub.quiz_id AND qq.question_id = q.id
      )
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_question_blooms_levels(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_question_blooms_levels(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
