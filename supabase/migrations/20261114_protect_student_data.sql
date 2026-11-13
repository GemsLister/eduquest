-- ============================================================
-- Protect student data: attempts, answers and student profiles
-- (run after 20261113_exam_results_in_one_request.sql)
--
-- Found during stress testing (stress-test/RESULTS.md, problem 15). With the
-- public (anon) key that ships in the website, anyone could:
--   - read every attempt: name, email, score ("student_name IS NOT NULL" was
--     enough to see a row, and every attempt has a name)
--   - read every answer (same rule on quiz_responses)
--   - change any attempt ("Enable update for all users") and insert answers
--     into anyone's attempt ("Enable insert for all users")
--   - read and change every student profile (row-level security was OFF on
--     student_profile)
--   - read student_performance_summary and faculty_head_quiz_audit_trail
--     (views run with their owner's rights, so they ignore the rules above)
--
-- New rules. An attempt and its answers are visible to:
--   - the student who took it (same user, or same email on another device)
--   - the exam's owner
--   - the instructor of the section it was taken in (exams are shared with
--     other instructors' sections of the same subject)
--   - Senior Faculty (is_admin) and Department Heads (is_faculty_head)
-- Students start, save and submit exams only through the server functions
-- (start_exam_attempt, save_quiz_response, save_question_times,
-- submit_quiz_attempt), so they need no direct write access. Student profiles
-- are visible to staff and to the student; they are written by
-- start_exam_attempt.
--
-- The app no longer depends on the old open rules: the exam page, results page
-- and item analysis use server functions, and the remaining direct reads are by
-- the people listed above. Exam lists get attempt counts and the question bank
-- gets "has this question been answered?" from two small functions here.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Who may see an attempt (checked by the policies below)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.can_view_attempt(
  p_quiz_id       UUID,
  p_section_id    UUID,
  p_user_id       UUID,
  p_student_email TEXT
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
       p_user_id = auth.uid()
    OR (p_student_email IS NOT NULL AND lower(p_student_email) = lower(auth.jwt() ->> 'email'))
    OR EXISTS (SELECT 1 FROM quizzes z WHERE z.id = p_quiz_id AND z.instructor_id = auth.uid())
    OR EXISTS (SELECT 1 FROM sections s WHERE s.id = p_section_id AND s.instructor_id = auth.uid())
    OR EXISTS (
         SELECT 1 FROM profiles p
          WHERE p.id = auth.uid()
            AND (COALESCE(p.is_admin, FALSE) OR COALESCE(p.is_faculty_head, FALSE))
       )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_attempt_id(p_attempt_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT can_view_attempt(a.quiz_id, a.section_id, a.user_id, a.student_email)
       FROM quiz_attempts a
      WHERE a.id = p_attempt_id),
    FALSE
  );
$$;

-- Sections the caller teaches (used by the results functions)
CREATE OR REPLACE FUNCTION public.my_section_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(s.id), '{}'::UUID[])
    FROM sections s
   WHERE auth.uid() IS NOT NULL AND s.instructor_id = auth.uid();
$$;


-- ------------------------------------------------------------
-- Replace every existing policy on the three tables
-- ------------------------------------------------------------
DO $$
DECLARE
  v_policy RECORD;
BEGIN
  FOR v_policy IN
    SELECT policyname, tablename
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('quiz_attempts', 'quiz_responses', 'student_profile')
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', v_policy.policyname, v_policy.tablename);
  END LOOP;
END;
$$;

ALTER TABLE public.quiz_attempts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_responses  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_profile ENABLE ROW LEVEL SECURITY;

-- Attempts
CREATE POLICY "Attempts: the student, exam owner, section instructor, staff"
  ON public.quiz_attempts FOR SELECT TO authenticated
  USING (public.can_view_attempt(quiz_id, section_id, user_id, student_email));

-- Kept for older app versions; the exam page now uses start_exam_attempt.
-- The protect_quiz_attempt_grading trigger still forces in_progress / score 0.
CREATE POLICY "Students can start their own attempt"
  ON public.quiz_attempts FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
-- No UPDATE or DELETE policy: attempts change only through server functions.

-- Answers
CREATE POLICY "Answers are visible to whoever can see the attempt"
  ON public.quiz_responses FOR SELECT TO authenticated
  USING (public.can_view_attempt_id(attempt_id));
-- No INSERT / UPDATE / DELETE policy: answers are saved only through
-- save_quiz_response, save_question_times and submit_quiz_attempt.

-- Student profiles
CREATE POLICY "Student profiles are visible to staff and to the student"
  ON public.student_profile FOR SELECT TO authenticated
  USING (
    (SELECT public.is_exam_staff())
    OR lower(student_email) = lower((SELECT auth.jwt() ->> 'email'))
  );
-- No write policies: start_exam_attempt creates and updates profiles.

-- Logged-out visitors need none of these tables.
REVOKE ALL ON public.quiz_attempts   FROM anon;
REVOKE ALL ON public.quiz_responses  FROM anon;
REVOKE ALL ON public.student_profile FROM anon;


-- ------------------------------------------------------------
-- Views and the Bloom's performance table
-- ------------------------------------------------------------
DO $$
BEGIN
  -- Unused by the app; they ignore row-level security, so no client role may read them.
  IF to_regclass('public.student_performance_summary') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.student_performance_summary FROM anon, authenticated';
  END IF;
  IF to_regclass('public.faculty_head_quiz_audit_trail') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON public.faculty_head_quiz_audit_trail FROM anon, authenticated';
  END IF;

  -- "System can insert/update" allowed anyone to write; nothing in the app writes here.
  IF to_regclass('public.student_blooms_performance') IS NOT NULL THEN
    EXECUTE 'DROP POLICY IF EXISTS "System can insert blooms performance" ON public.student_blooms_performance';
    EXECUTE 'DROP POLICY IF EXISTS "System can update blooms performance" ON public.student_blooms_performance';
    EXECUTE 'REVOKE ALL ON public.student_blooms_performance FROM anon';
  END IF;
END;
$$;


-- ------------------------------------------------------------
-- Results functions: also show section instructors their sections' attempts
-- (same packing and ordering as in 20261113_exam_results_in_one_request.sql)
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
  WITH vq AS (SELECT exam_results_visible_quiz_ids(p_quiz_ids) AS ids),
       vs AS (SELECT my_section_ids() AS ids)
  SELECT COALESCE(
           jsonb_agg(to_jsonb(a) ORDER BY a.completed_at DESC NULLS LAST, a.id),
           '[]'::jsonb
         )
    FROM quiz_attempts a, vq, vs
   WHERE a.quiz_id = ANY (p_quiz_ids)
     AND (a.quiz_id = ANY (vq.ids) OR a.section_id = ANY (vs.ids))
     AND (NOT p_completed_only OR a.status = 'completed')
     AND (p_section_id IS NULL OR a.section_id = p_section_id OR a.section_id IS NULL);
$$;

CREATE OR REPLACE FUNCTION public.get_exam_responses(
  p_attempt_ids UUID[]
) RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vq AS (
    SELECT exam_results_visible_quiz_ids(
             (SELECT array_agg(DISTINCT a.quiz_id) FROM quiz_attempts a WHERE a.id = ANY (p_attempt_ids))
           ) AS ids
  ),
  vs AS (SELECT my_section_ids() AS ids),
  resp AS (
    SELECT r.attempt_id, r.question_id, r.answer, r.is_correct,
           r.points_earned, r.time_spent_seconds, r.created_at, r.id
      FROM quiz_responses r
      JOIN quiz_attempts a ON a.id = r.attempt_id
      CROSS JOIN vq
      CROSS JOIN vs
     WHERE r.attempt_id = ANY (p_attempt_ids)
       AND (a.quiz_id = ANY (vq.ids) OR a.section_id = ANY (vs.ids))
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


-- ------------------------------------------------------------
-- Exam lists: attempt ids per exam, for counts (no personal data, no
-- 1,000-row cap). Same visibility as get_exam_attempts.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_exam_attempt_refs(p_quiz_ids UUID[])
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH vq AS (SELECT exam_results_visible_quiz_ids(p_quiz_ids) AS ids),
       vs AS (SELECT my_section_ids() AS ids)
  SELECT COALESCE(
           jsonb_agg(jsonb_build_object('id', a.id, 'quiz_id', a.quiz_id, 'section_id', a.section_id)),
           '[]'::jsonb
         )
    FROM quiz_attempts a, vq, vs
   WHERE a.quiz_id = ANY (p_quiz_ids)
     AND (a.quiz_id = ANY (vq.ids) OR a.section_id = ANY (vs.ids));
$$;


-- ------------------------------------------------------------
-- Question bank: which of these questions has any student answered?
-- (staff only; returns question ids, no personal data)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.questions_with_answers(p_question_ids UUID[])
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT r.question_id), '{}'::UUID[])
    FROM quiz_responses r
   WHERE r.question_id = ANY (p_question_ids)
     AND (SELECT public.is_exam_staff());
$$;


REVOKE EXECUTE ON FUNCTION public.can_view_attempt(UUID, UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_view_attempt_id(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.my_section_ids() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_exam_attempt_refs(UUID[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.questions_with_answers(UUID[]) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.can_view_attempt(UUID, UUID, UUID, TEXT) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.can_view_attempt_id(UUID) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.my_section_ids() TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.get_exam_attempt_refs(UUID[]) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.questions_with_answers(UUID[]) TO authenticated, service_role;

COMMIT;
