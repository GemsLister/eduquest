-- Fix auto_share_quiz_with_subject_sections to correctly find subject_id from quizzes, sections, or instructor_subjects
-- This ensures all sections in the same subject (e.g. Database Management - Class A, Class D) get assigned their own unique share codes.

CREATE OR REPLACE FUNCTION auto_share_quiz_with_subject_sections(p_quiz_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subject_id UUID;
  v_instructor_id UUID;
  v_count INT := 0;
BEGIN
  -- 1. Get quiz instructor_id and subject_id directly from quizzes if available
  SELECT q.subject_id, q.instructor_id
  INTO v_subject_id, v_instructor_id
  FROM public.quizzes q
  WHERE q.id = p_quiz_id;

  -- 2. If quiz.subject_id is NULL, fallback to checking subject_id of assigned sections in quiz_sections
  IF v_subject_id IS NULL THEN
    SELECT s.subject_id INTO v_subject_id
    FROM public.quiz_sections qs
    JOIN public.sections s ON s.id = qs.section_id
    WHERE qs.quiz_id = p_quiz_id AND s.subject_id IS NOT NULL
    LIMIT 1;
  END IF;

  -- 3. If still NULL, fallback to instructor_subjects
  IF v_subject_id IS NULL THEN
    SELECT iss.subject_id INTO v_subject_id
    FROM public.instructor_subjects iss
    WHERE iss.instructor_id = v_instructor_id
    LIMIT 1;
  END IF;

  -- If no subject_id could be determined, return 0
  IF v_subject_id IS NULL THEN
    RETURN 0;
  END IF;

  -- Insert quiz-section relationships for all sections in the subject
  INSERT INTO public.quiz_sections (quiz_id, section_id)
  SELECT p_quiz_id, sec.id
  FROM public.sections sec
  WHERE sec.is_archived = false
  AND (
    sec.subject_id = v_subject_id
    OR EXISTS (
      SELECT 1 FROM public.instructor_subject_sections iss
      JOIN public.instructor_subjects isub ON iss.instructor_subject_id = isub.id
      WHERE isub.subject_id = v_subject_id AND iss.section_id = sec.id
    )
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.quiz_sections qs
    WHERE qs.quiz_id = p_quiz_id AND qs.section_id = sec.id
  );

  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Ensure all quiz_sections for this quiz have share tokens
  PERFORM generate_share_tokens_for_quiz(p_quiz_id);

  RETURN v_count;
END;
$$;

-- Auto-share existing published quizzes with all sections in their respective subjects
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.quizzes LOOP
    PERFORM auto_share_quiz_with_subject_sections(r.id);
  END LOOP;
END $$;
