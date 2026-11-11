-- ============================================================
-- Fewer requests per student while taking an exam
-- (run after the three 20261111_* migrations)
--
-- The spike test showed the Free-tier server running out of memory when 1,000
-- students sent ~460 requests per second. These changes cut the requests each
-- student sends:
--
-- 1) start_exam_attempt: ONE request to start or resume an exam. It replaces
--    up to 7 (student profile lookup + create/update, attempt lookup, create
--    attempt, save shuffled order, and on resume: load order, load answers,
--    load times). The question order is shuffled on the server.
--
-- 2) save_question_times: time spent per question is sent in batches (about
--    once a minute) instead of one extra request every time a student moves to
--    another question. Each answer is still saved immediately.
--
-- 3) submit_quiz_attempt: also accepts the time not yet sent, so the final
--    batch rides along with the submission.
--
-- The old request paths still work, so the web app can be updated after this
-- migration runs.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Start or resume an exam in one request
-- ------------------------------------------------------------
-- Returns JSON:
--   { "status": "completed" }                      already submitted
--   { "status": "in_progress", "attempt_id", "started_at", "server_now",
--     "question_order": [ids], "answers": {qid: answer}, "times": {qid: seconds} }
CREATE OR REPLACE FUNCTION public.start_exam_attempt(
  p_quiz_id      UUID,
  p_section_id   UUID DEFAULT NULL,
  p_student_name TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_email     TEXT := auth.jwt() ->> 'email';   -- stored as the app stored it
  v_name      TEXT;
  v_quiz      RECORD;
  v_attempt   RECORD;
  v_exam_code TEXT;
  v_order     JSONB;
BEGIN
  IF v_uid IS NULL OR v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'You must be signed in to start an exam.' USING ERRCODE = '42501';
  END IF;

  SELECT z.id, z.is_published, z.is_open, z.section_id
    INTO v_quiz
    FROM quizzes z
   WHERE z.id = p_quiz_id;

  IF NOT FOUND OR NOT COALESCE(v_quiz.is_published, FALSE) THEN
    RAISE EXCEPTION 'Exam not found.' USING ERRCODE = 'P0002';
  END IF;
  IF v_quiz.is_open = FALSE THEN
    RAISE EXCEPTION 'This exam is currently closed by the instructor.';
  END IF;

  v_name := COALESCE(NULLIF(btrim(p_student_name), ''), split_part(v_email, '@', 1));

  -- Student profile (the Student Profiles page reads it). A clash on the
  -- student_id column must not stop the student from taking the exam.
  SELECT s.exam_code INTO v_exam_code
    FROM sections s
   WHERE s.id = COALESCE(p_section_id, v_quiz.section_id);
  BEGIN
    INSERT INTO student_profile (student_email, student_name, student_id, exam_code)
    VALUES (v_email, v_name, split_part(v_email, '@', 1), v_exam_code)
    ON CONFLICT (student_email) DO UPDATE
      SET student_name = EXCLUDED.student_name,
          student_id   = EXCLUDED.student_id,
          exam_code    = EXCLUDED.exam_code;
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  -- Existing attempt for this exam and section (one per student, any device)
  SELECT a.id, a.status, a.started_at, a.question_order
    INTO v_attempt
    FROM quiz_attempts a
   WHERE a.quiz_id = p_quiz_id
     AND a.student_email = v_email
     AND a.section_id IS NOT DISTINCT FROM p_section_id
     AND a.status IN ('in_progress', 'completed')
   ORDER BY (a.status = 'completed') DESC
   LIMIT 1;

  IF FOUND AND v_attempt.status = 'completed' THEN
    RETURN jsonb_build_object('status', 'completed');
  END IF;

  IF NOT FOUND THEN
    -- Shuffled order of this exam's questions (same rule as get_public_quiz_questions)
    IF EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id = p_quiz_id) THEN
      SELECT jsonb_agg(qq.question_id ORDER BY random()) INTO v_order
        FROM quiz_questions qq
       WHERE qq.quiz_id = p_quiz_id;
    ELSE
      SELECT jsonb_agg(q.id ORDER BY random()) INTO v_order
        FROM questions q
       WHERE q.quiz_id = p_quiz_id;
    END IF;

    BEGIN
      INSERT INTO quiz_attempts
        (quiz_id, section_id, user_id, student_name, student_email, status, question_order)
      VALUES
        (p_quiz_id, p_section_id, v_uid, v_name, v_email, 'in_progress', v_order)
      RETURNING id, status, started_at, question_order INTO v_attempt;
    EXCEPTION WHEN unique_violation THEN
      -- Another tab or device started it at the same moment: use that one.
      SELECT a.id, a.status, a.started_at, a.question_order
        INTO v_attempt
        FROM quiz_attempts a
       WHERE a.quiz_id = p_quiz_id
         AND a.student_email = v_email
         AND a.section_id IS NOT DISTINCT FROM p_section_id
         AND a.status IN ('in_progress', 'completed')
       ORDER BY (a.status = 'completed') DESC
       LIMIT 1;
      IF v_attempt.status = 'completed' THEN
        RETURN jsonb_build_object('status', 'completed');
      END IF;
    END;
  ELSIF v_attempt.question_order IS NULL THEN
    -- Older attempt without a saved order
    IF EXISTS (SELECT 1 FROM quiz_questions qq WHERE qq.quiz_id = p_quiz_id) THEN
      SELECT jsonb_agg(qq.question_id ORDER BY random()) INTO v_order
        FROM quiz_questions qq WHERE qq.quiz_id = p_quiz_id;
    ELSE
      SELECT jsonb_agg(q.id ORDER BY random()) INTO v_order
        FROM questions q WHERE q.quiz_id = p_quiz_id;
    END IF;
    UPDATE quiz_attempts SET question_order = v_order WHERE id = v_attempt.id;
    v_attempt.question_order := v_order;
  END IF;

  RETURN jsonb_build_object(
    'status',         'in_progress',
    'attempt_id',     v_attempt.id,
    'started_at',     v_attempt.started_at,
    'server_now',     NOW(),
    'question_order', COALESCE(v_attempt.question_order, '[]'::jsonb),
    'answers', COALESCE((
       SELECT jsonb_object_agg(r.question_id, r.answer)
         FROM quiz_responses r
        WHERE r.attempt_id = v_attempt.id
          AND r.answer IS NOT NULL AND r.answer <> ''
     ), '{}'::jsonb),
    'times', COALESCE((
       SELECT jsonb_object_agg(r.question_id, r.time_spent_seconds)
         FROM quiz_responses r
        WHERE r.attempt_id = v_attempt.id
          AND r.time_spent_seconds > 0
     ), '{}'::jsonb)
  );
END;
$$;


-- ------------------------------------------------------------
-- 2) Add time spent to several questions in one request
-- ------------------------------------------------------------
-- p_times: {"<question id>": <seconds to add>, ...}
CREATE OR REPLACE FUNCTION public.save_question_times(
  p_attempt_id UUID,
  p_times      JSONB
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_email   TEXT := lower(auth.jwt() ->> 'email');
  v_attempt RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to save answers.' USING ERRCODE = '42501';
  END IF;

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
    RAISE EXCEPTION 'You can only save answers to your own exam attempt.' USING ERRCODE = '42501';
  END IF;
  IF v_attempt.status NOT IN ('in_progress', 'completed') THEN
    RAISE EXCEPTION 'This exam attempt is no longer open.';
  END IF;
  IF jsonb_typeof(p_times) <> 'object' THEN
    RETURN;
  END IF;

  IF v_attempt.status = 'in_progress' THEN
    INSERT INTO quiz_responses
      (attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds)
    SELECT p_attempt_id, t.key::UUID, NULL, FALSE, 0,
           LEAST(GREATEST(t.value::NUMERIC, 0), 86400)
      FROM jsonb_each_text(p_times) t
     WHERE t.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND t.value ~ '^[0-9]+(\.[0-9]+)?$'
       AND quiz_contains_question(v_attempt.quiz_id, t.key::UUID)
    ON CONFLICT (attempt_id, question_id) DO UPDATE
      SET time_spent_seconds = quiz_responses.time_spent_seconds + EXCLUDED.time_spent_seconds;
  ELSE
    -- Late batch right after submitting: record the time, add no new rows.
    UPDATE quiz_responses r
       SET time_spent_seconds = r.time_spent_seconds + LEAST(GREATEST(t.value::NUMERIC, 0), 86400)
      FROM jsonb_each_text(p_times) t
     WHERE r.attempt_id = p_attempt_id
       AND t.key ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
       AND t.value ~ '^[0-9]+(\.[0-9]+)?$'
       AND r.question_id = t.key::UUID;
  END IF;
END;
$$;


-- ------------------------------------------------------------
-- 3) Submit: unchanged, except each answer may also carry "time_spent"
--    (seconds not yet sent), which is added to the stored time.
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

  -- a) Store the final answers (and any unsent time) in one statement.
  --    An empty answer never overwrites an answer that was already auto-saved.
  IF jsonb_typeof(p_answers) = 'array' THEN
    INSERT INTO quiz_responses
      (attempt_id, question_id, answer, is_correct, points_earned, time_spent_seconds)
    SELECT p_attempt_id, a.question_id, COALESCE(a.answer, ''), FALSE, 0,
           LEAST(GREATEST(COALESCE(a.time_spent, 0), 0), 86400)
      FROM (
        SELECT DISTINCT ON (x.question_id) x.question_id, x.answer, x.time_spent
          FROM jsonb_to_recordset(p_answers) AS x(question_id UUID, answer TEXT, time_spent NUMERIC)
         WHERE x.question_id IS NOT NULL
      ) a
      JOIN questions q ON q.id = a.question_id
    ON CONFLICT (attempt_id, question_id) DO UPDATE
      SET answer = CASE WHEN EXCLUDED.answer <> '' THEN EXCLUDED.answer ELSE quiz_responses.answer END,
          time_spent_seconds = quiz_responses.time_spent_seconds + EXCLUDED.time_spent_seconds;
  END IF;

  -- a2) Auto-answer questions are credited even if the student skipped them.
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
-- Permissions: exam takers are always signed in
-- ------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.start_exam_attempt(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.save_question_times(UUID, JSONB) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.start_exam_attempt(UUID, UUID, TEXT) TO authenticated, service_role;
GRANT  EXECUTE ON FUNCTION public.save_question_times(UUID, JSONB) TO authenticated, service_role;

COMMIT;
