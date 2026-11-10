-- ============================================================
-- Only staff can read the questions table directly
-- (run after 20261111_protect_attempts_and_answer_key.sql)
--
-- Several permissive SELECT policies on questions let any signed-in user read
-- every published quiz's questions, including correct_answer:
--   "Anyone can view published quiz questions"
--   "Users can view questions from accessible quizzes or bank"
--   "Users can view questions in published quizzes or their own or collaborative"
-- The live policies have drifted from the migration files, so instead of
-- rewriting them this adds one RESTRICTIVE policy. Postgres requires a row to
-- pass every restrictive policy AND at least one permissive policy, so all
-- existing instructor rules keep working, but only for staff.
--
-- Staff = Senior Faculty (is_admin), Department Head (is_faculty_head), or an
-- approved instructor. These flags can't be self-assigned
-- (protect_profile_role_columns, 20261023_senior_faculty_hardening.sql).
--
-- Students load exam questions through get_public_quiz_questions, which runs
-- with the owner's rights and never returns correct_answer, so they are not
-- affected.
--
-- Side effect: a student can no longer load an UNPUBLISHED quiz that is
-- marked public (is_private = false); get_public_quiz_questions only serves
-- published quizzes.
-- ============================================================

BEGIN;

-- Guard: the exam functions read questions while auth.uid() is the student.
-- They only keep working if their owner is not subject to RLS on questions
-- (owns the table, or has BYPASSRLS). Stop here instead of breaking grading.
DO $$
DECLARE
  v_table_owner TEXT;
  v_forced      BOOLEAN;
  v_fn          RECORD;
BEGIN
  SELECT pg_get_userbyid(c.relowner), c.relforcerowsecurity
    INTO v_table_owner, v_forced
    FROM pg_class c
   WHERE c.oid = 'public.questions'::regclass;

  FOR v_fn IN
    SELECT p.proname, r.rolname, r.rolbypassrls
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace AND n.nspname = 'public'
      JOIN pg_roles r ON r.oid = p.proowner
     WHERE p.proname IN ('save_quiz_response', 'submit_quiz_attempt', 'get_public_quiz_questions')
  LOOP
    IF NOT (v_fn.rolbypassrls OR (v_fn.rolname = v_table_owner AND NOT v_forced)) THEN
      RAISE EXCEPTION
        'Function % is owned by %, which is subject to RLS on questions (table owner: %). Students would lose access to grading. Not applying.',
        v_fn.proname, v_fn.rolname, v_table_owner;
    END IF;
  END LOOP;

  IF (SELECT count(*) FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public'
         AND p.proname IN ('save_quiz_response', 'submit_quiz_attempt', 'get_public_quiz_questions')) < 3 THEN
    RAISE EXCEPTION 'Run 20261111_harden_exam_grading.sql and 20261111_protect_attempts_and_answer_key.sql first.';
  END IF;
END;
$$;

-- SECURITY DEFINER so the check doesn't depend on (or recurse into) the
-- profiles table's own RLS policies.
CREATE OR REPLACE FUNCTION public.is_exam_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM profiles p
     WHERE p.id = auth.uid()
       AND (
         COALESCE(p.is_admin, FALSE)
         OR COALESCE(p.is_faculty_head, FALSE)
         OR (COALESCE(p.is_instructor, FALSE) AND COALESCE(p.is_approved, FALSE))
       )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.is_exam_staff() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.is_exam_staff() TO anon, authenticated, service_role;

ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only staff can read questions directly" ON public.questions;

-- "(SELECT ...)" makes Postgres evaluate the check once per query instead of
-- once per row, which matters for question-bank pages with many rows.
CREATE POLICY "Only staff can read questions directly" ON public.questions
  AS RESTRICTIVE
  FOR SELECT
  TO anon, authenticated
  USING ((SELECT public.is_exam_staff()));

COMMIT;
