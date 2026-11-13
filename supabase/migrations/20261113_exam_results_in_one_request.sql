-- ============================================================
-- Load exam results with one fast request each for attempts and answers
--
-- The instructor results page (QuizResults.jsx) and item analysis page
-- (ItemAnalysisPage.jsx) loaded results like this:
--   - attempts:  GET quiz_attempts ... with no paging. Supabase returns at
--                most 1,000 rows per request, so attempts beyond 1,000 were
--                silently left out.
--   - answers:   GET quiz_responses?attempt_id=in.(id1,id2,...) - every
--                attempt id in the URL. Measured on the test project: fine up
--                to 300 attempts (11 KB URL), broken from about 400, and
--                "400 Bad Request" at 1,000 (37 KB URL).
--
-- These functions return everything as one JSON value each (no URL limit, no
-- 1,000-row cap).
--
-- Access is checked ONCE per request instead of row by row: running the
-- existing row-level security policies on 1,000 attempts + 50,000 answers took
-- 7-7.5 s per call (Supabase stops signed-in users' queries at 8 s), and
-- failed under load. Who may see results:
--   - the exam's owner (quizzes.instructor_id)
--   - Senior Faculty (profiles.is_admin) and Department Heads
--     (profiles.is_faculty_head)
-- Anyone else gets an empty result.
-- ============================================================

BEGIN;

-- Of the given exams, the ones whose results the caller may see.
CREATE OR REPLACE FUNCTION public.exam_results_visible_quiz_ids(p_quiz_ids UUID[])
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(z.id), '{}'::UUID[])
    FROM quizzes z
   WHERE z.id = ANY (p_quiz_ids)
     AND auth.uid() IS NOT NULL
     AND (
       z.instructor_id = auth.uid()
       OR EXISTS (
         SELECT 1
           FROM profiles p
          WHERE p.id = auth.uid()
            AND (COALESCE(p.is_admin, FALSE) OR COALESCE(p.is_faculty_head, FALSE))
       )
     );
$$;


-- ------------------------------------------------------------
-- All attempts of one exam (and its revisions), newest first.
-- Each element is the full quiz_attempts row, like select("*").
-- With a section, attempts with no section are included too.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_attempts(
  p_quiz_ids       UUID[],
  p_section_id     UUID    DEFAULT NULL,
  p_completed_only BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT exam_results_visible_quiz_ids(p_quiz_ids) AS ids
  )
  SELECT COALESCE(
           jsonb_agg(to_jsonb(a) ORDER BY a.completed_at DESC NULLS LAST, a.id),
           '[]'::jsonb
         )
    FROM quiz_attempts a, visible v
   WHERE a.quiz_id = ANY (v.ids)
     AND (NOT p_completed_only OR a.status = 'completed')
     AND (p_section_id IS NULL OR a.section_id = p_section_id OR a.section_id IS NULL);
$$;


-- ------------------------------------------------------------
-- All answers of the given attempts, packed to keep the download small:
--   {
--     "q": ["<question id>", ...],                        each question once
--     "r": { "<attempt id>": [[q index, answer, is_correct,
--                              points_earned, time_spent_seconds], ...] }
--   }
-- Answers of one attempt keep the order they were saved in. Attempts of exams
-- the caller may not see are left out.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_responses(
  p_attempt_ids UUID[]
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH visible AS (
    SELECT exam_results_visible_quiz_ids(
             (SELECT array_agg(DISTINCT a.quiz_id) FROM quiz_attempts a WHERE a.id = ANY (p_attempt_ids))
           ) AS ids
  ),
  resp AS (
    SELECT r.attempt_id, r.question_id, r.answer, r.is_correct,
           r.points_earned, r.time_spent_seconds, r.created_at, r.id
      FROM quiz_responses r
      JOIN quiz_attempts a ON a.id = r.attempt_id
      CROSS JOIN visible v
     WHERE r.attempt_id = ANY (p_attempt_ids)
       AND a.quiz_id = ANY (v.ids)
  ),
  qs AS (
    SELECT question_id, (row_number() OVER (ORDER BY question_id) - 1)::INT AS qi
      FROM (SELECT DISTINCT question_id FROM resp) d
  ),
  per_attempt AS (
    SELECT rw.attempt_id,
           jsonb_agg(
             jsonb_build_array(qs.qi, rw.answer, rw.is_correct, rw.points_earned, rw.time_spent_seconds)
             ORDER BY rw.created_at, rw.id
           ) AS items
      FROM resp rw
      JOIN qs ON qs.question_id = rw.question_id
     GROUP BY rw.attempt_id
  )
  SELECT jsonb_build_object(
           'q', COALESCE((SELECT jsonb_agg(question_id ORDER BY qi) FROM qs), '[]'::jsonb),
           'r', COALESCE((SELECT jsonb_object_agg(attempt_id, items) FROM per_attempt), '{}'::jsonb)
         );
$$;

REVOKE EXECUTE ON FUNCTION public.exam_results_visible_quiz_ids(UUID[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_exam_attempts(UUID[], UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_exam_responses(UUID[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.exam_results_visible_quiz_ids(UUID[]) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.get_exam_attempts(UUID[], UUID, BOOLEAN) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.get_exam_responses(UUID[]) TO authenticated, service_role;

COMMIT;
