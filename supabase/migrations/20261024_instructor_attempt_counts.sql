-- ============================================================
-- Attempt counts for the Senior Faculty instructor detail page
--
-- quiz_attempts is only readable by the quiz owner, so Senior Faculty can't
-- count another instructor's attempts directly. This returns per-quiz totals
-- (no student data) and only answers Senior Faculty.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_instructor_attempt_counts(p_instructor_id uuid)
RETURNS TABLE (
  quiz_id uuid,
  completed_attempts bigint,
  student_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    q.id AS quiz_id,
    COUNT(a.id) FILTER (WHERE a.status = 'completed') AS completed_attempts,
    COUNT(DISTINCT a.user_id) FILTER (WHERE a.status = 'completed') AS student_count
  FROM public.quizzes q
  LEFT JOIN public.quiz_attempts a ON a.quiz_id = q.id
  WHERE q.instructor_id = p_instructor_id
    AND EXISTS (
      SELECT 1 FROM public.profiles caller
      WHERE caller.id = auth.uid() AND caller.is_admin = true
    )
  GROUP BY q.id;
$$;

GRANT EXECUTE ON FUNCTION public.get_instructor_attempt_counts(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
