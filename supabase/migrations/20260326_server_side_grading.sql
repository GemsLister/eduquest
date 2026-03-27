-- ============================================================
-- Server-side grading: students never see correct_answer
-- ============================================================

-- 1) Auto-save a single response (graded server-side)
CREATE OR REPLACE FUNCTION save_quiz_response(
  p_attempt_id UUID,
  p_question_id UUID,
  p_answer TEXT
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_correct_answer TEXT;
  v_type           VARCHAR(50);
  v_options        TEXT[];
  v_points         INTEGER;
  v_is_correct     BOOLEAN := FALSE;
  v_points_earned  INTEGER := 0;
  v_existing_id    UUID;
BEGIN
  -- Look up the question (only the DB can see correct_answer)
  SELECT correct_answer, type, options, COALESCE(points, 1)
    INTO v_correct_answer, v_type, v_options, v_points
    FROM questions
   WHERE id = p_question_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Grade the answer
  IF p_answer IS NOT NULL AND p_answer <> '' THEN
    IF v_type = 'mcq' THEN
      IF v_options[CAST(p_answer AS INTEGER) + 1] = v_correct_answer THEN
        v_is_correct := TRUE;
        v_points_earned := v_points;
      END IF;
    ELSIF v_type = 'true_false' THEN
      IF (p_answer = '0' AND v_correct_answer = 'true')
      OR (p_answer = '1' AND v_correct_answer = 'false') THEN
        v_is_correct := TRUE;
        v_points_earned := v_points;
      END IF;
    END IF;
  END IF;

  -- Upsert response
  SELECT id INTO v_existing_id
    FROM quiz_responses
   WHERE attempt_id = p_attempt_id
     AND question_id = p_question_id;

  IF v_existing_id IS NOT NULL THEN
    UPDATE quiz_responses
       SET answer = p_answer,
           is_correct = v_is_correct,
           points_earned = v_points_earned
     WHERE id = v_existing_id;
  ELSE
    INSERT INTO quiz_responses (attempt_id, question_id, answer, is_correct, points_earned)
    VALUES (p_attempt_id, p_question_id, p_answer, v_is_correct, v_points_earned);
  END IF;
END;
$$;


-- 2) Submit & grade an entire quiz attempt (returns total score)
CREATE OR REPLACE FUNCTION submit_quiz_attempt(
  p_attempt_id UUID,
  p_answers    JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_elem          JSONB;
  v_question_id   UUID;
  v_answer        TEXT;
  v_correct       TEXT;
  v_type          VARCHAR(50);
  v_options       TEXT[];
  v_points        INTEGER;
  v_is_correct    BOOLEAN;
  v_points_earned INTEGER;
  v_total_score   INTEGER := 0;
  v_existing_id   UUID;
BEGIN
  -- Process each answer
  FOR v_elem IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    v_question_id := (v_elem->>'question_id')::UUID;
    v_answer      := COALESCE(v_elem->>'answer', '');

    -- Look up question
    SELECT correct_answer, type, options, COALESCE(points, 1)
      INTO v_correct, v_type, v_options, v_points
      FROM questions
     WHERE id = v_question_id;

    IF NOT FOUND THEN CONTINUE; END IF;

    -- Grade
    v_is_correct := FALSE;
    v_points_earned := 0;

    IF v_answer <> '' THEN
      IF v_type = 'mcq' THEN
        IF v_options[CAST(v_answer AS INTEGER) + 1] = v_correct THEN
          v_is_correct := TRUE;
          v_points_earned := v_points;
        END IF;
      ELSIF v_type = 'true_false' THEN
        IF (v_answer = '0' AND v_correct = 'true')
        OR (v_answer = '1' AND v_correct = 'false') THEN
          v_is_correct := TRUE;
          v_points_earned := v_points;
        END IF;
      END IF;
    END IF;

    v_total_score := v_total_score + v_points_earned;

    -- Upsert response
    SELECT id INTO v_existing_id
      FROM quiz_responses
     WHERE attempt_id = p_attempt_id
       AND question_id = v_question_id;

    IF v_existing_id IS NOT NULL THEN
      UPDATE quiz_responses
         SET answer = v_answer,
             is_correct = v_is_correct,
             points_earned = v_points_earned
       WHERE id = v_existing_id;
    ELSE
      INSERT INTO quiz_responses (attempt_id, question_id, answer, is_correct, points_earned)
      VALUES (p_attempt_id, v_question_id, v_answer, v_is_correct, v_points_earned);
    END IF;
  END LOOP;

  -- Finalize the attempt
  UPDATE quiz_attempts
     SET score = v_total_score,
         status = 'completed',
         completed_at = NOW()
   WHERE id = p_attempt_id;

  RETURN v_total_score;
END;
$$;
