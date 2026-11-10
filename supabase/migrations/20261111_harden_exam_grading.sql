-- ============================================================
-- Harden and speed up exam answer saving and submission
--
-- 1) save_quiz_response: one atomic upsert (INSERT ... ON CONFLICT) instead of
--    SELECT-then-INSERT/UPDATE. Two saves for the same question arriving at
--    the same time (answer click + time tracking) no longer collide on the
--    unique constraint and silently drop one of them. A time-only save
--    (p_answer IS NULL) no longer wipes the stored answer.
--
-- 2) submit_quiz_attempt: set-based. Writes the final answers in one
--    statement, re-grades every stored response in one statement, and sums
--    the score in one query (was ~2 queries per question in a loop).
--    Empty answers in the payload never overwrite a saved answer, so a client
--    that lost its state cannot wipe a student's work on submit.
--
-- 3) Both functions now check that:
--      - the caller is logged in and owns the attempt
--        (same user_id, or same email for cross-device resume)
--      - the attempt is still in progress
--      - the question belongs to the attempt's quiz
--    Re-submitting a completed attempt returns the stored score instead of
--    re-grading, so client retries are safe. Points are always recomputed
--    from the questions table, never trusted from stored rows.
--
-- Also: questions flagged auto_answer are credited on the server. The browser
-- used to fill them in from correct_answer, which (a) exposed the answer key
-- and (b) never worked, because it sent the option text instead of the
-- option index.
--
-- Requires the unique constraint quiz_responses_attempt_question_unique
-- (added in 20260326_add_quiz_autosave_support.sql).
-- ============================================================

BEGIN;

-- Guard: ON CONFLICT below needs the (attempt_id, question_id) unique constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.quiz_responses'::regclass
       AND contype = 'u'
       AND conname = 'quiz_responses_attempt_question_unique'
  ) THEN
    RAISE EXCEPTION
      'Missing unique constraint quiz_responses_attempt_question_unique on quiz_responses(attempt_id, question_id). Add it (after removing duplicate rows) before running this migration.';
  END IF;
END;
$$;


ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS auto_answer BOOLEAN DEFAULT FALSE;


-- ------------------------------------------------------------
-- Does a question belong to a quiz? Same rule the exam page uses to load
-- questions: linked through quiz_questions, or directly via questions.quiz_id.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.quiz_contains_question(
  p_quiz_id     UUID,
  p_question_id UUID
) RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM questions q
            WHERE q.id = p_question_id AND q.quiz_id = p_quiz_id
         )
      OR EXISTS (
           SELECT 1 FROM quiz_questions qq
            WHERE qq.quiz_id = p_quiz_id AND qq.question_id = p_question_id
         );
$$;


-- ------------------------------------------------------------
-- Shared grading rule (same logic as before, in one place)
--   mcq:        answer is the 0-based option index; correct when that
--               option's text equals correct_answer
--   true_false: '0' = True, '1' = False
--   other types are not auto-graded
-- A non-numeric MCQ answer is graded wrong instead of raising an error.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.grade_quiz_answer(
  p_type    TEXT,
  p_options TEXT[],
  p_correct TEXT,
  p_answer  TEXT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_answer IS NULL OR p_answer = '' THEN FALSE
    WHEN p_type = 'mcq' THEN
      CASE
        WHEN p_answer ~ '^[0-9]{1,6}$'
          THEN COALESCE(p_options[p_answer::INTEGER + 1] = p_correct, FALSE)
        ELSE FALSE
      END
    WHEN p_type = 'true_false' THEN
      (p_answer = '0' AND p_correct = 'true')
      OR (p_answer = '1' AND p_correct = 'false')
    ELSE FALSE
  END;
$$;


-- ------------------------------------------------------------
-- 1) Auto-save a single response
-- ------------------------------------------------------------

-- Old 3-argument overload from 20260326_server_side_grading.sql has no
-- ownership checks; the app only calls the 4-argument version.
DROP FUNCTION IF EXISTS public.save_quiz_response(UUID, UUID, TEXT);

CREATE OR REPLACE FUNCTION public.save_quiz_response(
  p_attempt_id  UUID,
  p_question_id UUID,
  p_answer      TEXT,
  p_time_spent  NUMERIC(12, 1) DEFAULT 0
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_email      TEXT := lower(auth.jwt() ->> 'email');
  v_time       NUMERIC(12, 1) := GREATEST(COALESCE(p_time_spent, 0), 0);
  v_attempt    RECORD;
  v_question   RECORD;
  v_is_correct BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to save answers.'
      USING ERRCODE = '42501';
  END IF;

  -- KEY SHARE lets many saves for the same attempt run together, but makes
  -- them wait for (and then see the result of) a concurrent submit.
  SELECT id, quiz_id, user_id, student_email, status
    INTO v_attempt
    FROM quiz_attempts
   WHERE id = p_attempt_id
     FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_attempt.user_id = v_uid
    OR (v_email IS NOT NULL AND lower(v_attempt.student_email) = v_email)
  ) THEN
    RAISE EXCEPTION 'You can only save answers to your own exam attempt.'
      USING ERRCODE = '42501';
  END IF;

  IF v_attempt.status = 'completed' THEN
    -- Late time-tracking pings right after submit are harmless: record the
    -- time, but never change an answer or a grade on a submitted attempt.
    IF v_time > 0 THEN
      UPDATE quiz_responses
         SET time_spent_seconds = time_spent_seconds + v_time
       WHERE attempt_id = p_attempt_id
         AND question_id = p_question_id;
    END IF;
    RETURN;
  END IF;

  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'This exam attempt is no longer open.';
  END IF;

  -- The question must belong to this attempt's quiz
  -- (linked through quiz_questions, or directly through questions.quiz_id).
  SELECT q.type, q.options, q.correct_answer, COALESCE(q.points, 1) AS points,
         COALESCE(q.auto_answer, FALSE) AS auto_answer
    INTO v_question
    FROM questions q
   WHERE q.id = p_question_id
     AND quiz_contains_question(v_attempt.quiz_id, q.id);

  IF NOT FOUND THEN
    RETURN;
  END IF;

  IF p_answer IS NULL THEN
    -- Time-only save: keep whatever answer is already stored.
    INSERT INTO quiz_responses
      (attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds)
    VALUES
      (p_attempt_id, p_question_id, NULL, FALSE, 0, v_time)
    ON CONFLICT (attempt_id, question_id) DO UPDATE
      SET time_spent_seconds =
            quiz_responses.time_spent_seconds + EXCLUDED.time_spent_seconds;
  ELSE
    v_is_correct := v_question.auto_answer OR grade_quiz_answer(
      v_question.type, v_question.options, v_question.correct_answer, p_answer
    );

    INSERT INTO quiz_responses
      (attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds)
    VALUES
      (p_attempt_id, p_question_id, p_answer, v_is_correct,
       CASE WHEN v_is_correct THEN v_question.points ELSE 0 END, v_time)
    ON CONFLICT (attempt_id, question_id) DO UPDATE
      SET answer             = EXCLUDED.answer,
          is_correct         = EXCLUDED.is_correct,
          points_earned      = EXCLUDED.points_earned,
          time_spent_seconds =
            quiz_responses.time_spent_seconds + EXCLUDED.time_spent_seconds;
  END IF;
END;
$$;


-- ------------------------------------------------------------
-- 2) Submit and grade an attempt (returns total score)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_quiz_attempt(
  p_attempt_id UUID,
  p_answers    JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_email   TEXT := lower(auth.jwt() ->> 'email');
  v_attempt RECORD;
  v_total   INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to submit an exam.'
      USING ERRCODE = '42501';
  END IF;

  -- Row lock: a second submit (double click, retry after a timeout) waits
  -- here, then sees status = 'completed' and returns the stored score.
  SELECT id, quiz_id, user_id, student_email, status, score
    INTO v_attempt
    FROM quiz_attempts
   WHERE id = p_attempt_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Exam attempt not found.' USING ERRCODE = 'P0002';
  END IF;

  IF NOT (
    v_attempt.user_id = v_uid
    OR (v_email IS NOT NULL AND lower(v_attempt.student_email) = v_email)
  ) THEN
    RAISE EXCEPTION 'You can only submit your own exam attempt.'
      USING ERRCODE = '42501';
  END IF;

  IF v_attempt.status = 'completed' THEN
    RETURN COALESCE(v_attempt.score, 0);
  END IF;

  IF v_attempt.status <> 'in_progress' THEN
    RAISE EXCEPTION 'This exam attempt is no longer open.';
  END IF;

  -- a) Store the final answers in one statement. Grades are filled in by (b).
  --    An empty answer only creates a row for an unanswered question; it never
  --    overwrites an answer that was already auto-saved.
  IF jsonb_typeof(p_answers) = 'array' THEN
    INSERT INTO quiz_responses
      (attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds)
    SELECT p_attempt_id, a.question_id, COALESCE(a.answer, ''), FALSE, 0, 0
      FROM (
        SELECT DISTINCT ON (x.question_id) x.question_id, x.answer
          FROM jsonb_to_recordset(p_answers) AS x(question_id UUID, answer TEXT)
         WHERE x.question_id IS NOT NULL
      ) a
      JOIN questions q ON q.id = a.question_id
    ON CONFLICT (attempt_id, question_id) DO UPDATE
      SET answer = EXCLUDED.answer
      WHERE EXCLUDED.answer <> '';
  END IF;

  -- a2) Auto-answer questions are credited even if the student skipped them.
  --     The stored answer is the correct choice, so item analysis reads it
  --     like any other correct response.
  INSERT INTO quiz_responses
    (attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds)
  SELECT p_attempt_id, q.id,
         COALESCE(
           CASE q.type
             WHEN 'mcq' THEN (array_position(q.options, q.correct_answer) - 1)::TEXT
             WHEN 'true_false' THEN
               CASE q.correct_answer WHEN 'true' THEN '0' WHEN 'false' THEN '1' END
           END, ''),
         FALSE, 0, 0
    FROM questions q
   WHERE COALESCE(q.auto_answer, FALSE)
     AND quiz_contains_question(v_attempt.quiz_id, q.id)
  ON CONFLICT (attempt_id, question_id) DO NOTHING;

  -- b) Re-grade every response of this attempt from the answer key.
  --    Responses to questions outside this quiz are worth 0; auto-answer
  --    questions are always correct.
  WITH graded AS (
    SELECT r.id,
           (
             quiz_contains_question(v_attempt.quiz_id, q.id)
             AND (
               COALESCE(q.auto_answer, FALSE)
               OR grade_quiz_answer(q.type, q.options, q.correct_answer, r.answer)
             )
           ) AS ok,
           COALESCE(q.points, 1) AS points
      FROM quiz_responses r
      JOIN questions q ON q.id = r.question_id
     WHERE r.attempt_id = p_attempt_id
  )
  UPDATE quiz_responses r
     SET is_correct    = g.ok,
         points_earned = CASE WHEN g.ok THEN g.points ELSE 0 END
    FROM graded g
   WHERE r.id = g.id
     AND (r.is_correct IS DISTINCT FROM g.ok
          OR r.points_earned IS DISTINCT FROM CASE WHEN g.ok THEN g.points ELSE 0 END);

  -- c) Total score
  SELECT COALESCE(SUM(points_earned), 0)::INTEGER
    INTO v_total
    FROM quiz_responses
   WHERE attempt_id = p_attempt_id;

  UPDATE quiz_attempts
     SET score        = v_total,
         status       = 'completed',
         completed_at = NOW()
   WHERE id = p_attempt_id;

  RETURN v_total;
END;
$$;


-- ------------------------------------------------------------
-- Permissions: exam takers are always signed in, so anonymous callers
-- don't need these functions.
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.save_quiz_response(UUID, UUID, TEXT, NUMERIC) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.save_quiz_response(UUID, UUID, TEXT, NUMERIC) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.submit_quiz_attempt(UUID, JSONB) TO authenticated, service_role;

COMMIT;
