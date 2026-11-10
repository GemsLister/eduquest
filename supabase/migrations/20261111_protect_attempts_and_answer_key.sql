-- ============================================================
-- Exam integrity follow-ups (run after 20261111_harden_exam_grading.sql)
--
-- 1) quiz_attempts: students can no longer set their own score, status,
--    completed_at or started_at through the API. New attempts always start
--    as in_progress with score 0; only server functions (submit_quiz_attempt)
--    and the service role can change those columns.
--
-- 2) get_public_quiz_questions: rewritten. The old version failed on every
--    call ("column reference \"id\" is ambiguous"), so the exam page always
--    fell back to reading the questions table directly, answer key included.
--    The new version works and returns auto_answer but never correct_answer.
--
-- 3) Logged-out (anon) users can no longer read the answer-key columns of
--    questions. Instructors are signed in and are not affected.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Lock grading columns on quiz_attempts
-- ------------------------------------------------------------
-- SECURITY INVOKER on purpose: current_user is 'anon' / 'authenticated' for
-- direct API calls, but is the function owner inside SECURITY DEFINER
-- functions such as submit_quiz_attempt, which must be allowed through.
CREATE OR REPLACE FUNCTION public.protect_quiz_attempt_grading()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.status       := 'in_progress';
    NEW.score        := 0;
    NEW.completed_at := NULL;
    NEW.started_at   := NOW();
  ELSE
    NEW.status       := OLD.status;
    NEW.score        := OLD.score;
    NEW.completed_at := OLD.completed_at;
    NEW.started_at   := OLD.started_at;   -- protects the exam timer
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_quiz_attempt_grading ON public.quiz_attempts;
CREATE TRIGGER protect_quiz_attempt_grading
  BEFORE INSERT OR UPDATE ON public.quiz_attempts
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_quiz_attempt_grading();


-- ------------------------------------------------------------
-- 2) Question loader for the exam page, without the answer key
-- ------------------------------------------------------------
-- Return columns change, so the old function must be dropped first.
DROP FUNCTION IF EXISTS public.get_public_quiz_questions(UUID);

CREATE FUNCTION public.get_public_quiz_questions(p_quiz_id UUID)
RETURNS TABLE (
  id          UUID,
  quiz_id     UUID,
  type        TEXT,
  text        TEXT,
  options     TEXT[],
  points      INTEGER,
  auto_answer BOOLEAN,
  created_at  TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
#variable_conflict use_column
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM quizzes z WHERE z.id = p_quiz_id AND z.is_published = TRUE
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id = p_quiz_id) THEN
    RETURN QUERY
    SELECT q.id, q.quiz_id, q.type::TEXT, q.text::TEXT, q.options::TEXT[],
           q.points::INTEGER, COALESCE(q.auto_answer, FALSE), q.created_at::TIMESTAMPTZ
      FROM quiz_questions qq
      JOIN questions q ON q.id = qq.question_id
     WHERE qq.quiz_id = p_quiz_id
     ORDER BY qq.order_index ASC, q.created_at ASC;
  ELSE
    RETURN QUERY
    SELECT q.id, q.quiz_id, q.type::TEXT, q.text::TEXT, q.options::TEXT[],
           q.points::INTEGER, COALESCE(q.auto_answer, FALSE), q.created_at::TIMESTAMPTZ
      FROM questions q
     WHERE q.quiz_id = p_quiz_id
     ORDER BY q.created_at ASC;
  END IF;
END;
$$;

-- The exam page loads questions before the student signs in.
GRANT EXECUTE ON FUNCTION public.get_public_quiz_questions(UUID) TO anon, authenticated, service_role;


-- ------------------------------------------------------------
-- 3) Hide answer-key columns of questions from logged-out users
-- ------------------------------------------------------------
-- Postgres can't revoke one column while the table-level grant remains, so
-- anon's table-level SELECT is replaced by SELECT on every other column.
-- NOTE: a column added to questions later is NOT readable by anon until it
-- is granted (re-run this block, or GRANT SELECT (new_col) ... TO anon).
REVOKE SELECT ON public.questions FROM anon;

DO $$
DECLARE
  v_cols TEXT;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
   WHERE table_schema = 'public'
     AND table_name   = 'questions'
     AND column_name NOT IN ('correct_answer', 'original_correct_answer', 'previous_correct_answer');

  EXECUTE format('GRANT SELECT (%s) ON public.questions TO anon', v_cols);
END;
$$;

COMMIT;
