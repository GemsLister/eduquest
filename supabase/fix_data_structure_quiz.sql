-- ============================================================
-- Fix the Data Structures and Algorithm quiz
-- ============================================================

-- 1) Get the quiz ID first
DO $$
DECLARE
  v_quiz_id UUID;
  v_question_count INTEGER;
  v_bank_count INTEGER;
BEGIN
  SELECT id INTO v_quiz_id FROM public.quizzes WHERE title ILIKE '%Data Structures and Algorithm%' LIMIT 1;
  
  RAISE NOTICE 'Quiz ID: %', v_quiz_id;
  
  -- 2) Check if there are questions linked via direct quiz_id
  SELECT COUNT(*) INTO v_question_count FROM public.questions WHERE quiz_id = v_quiz_id;
  
  RAISE NOTICE 'Direct quiz_id questions count: %', v_question_count;
  
  -- Check if there are questions in question bank
  SELECT COUNT(*) INTO v_bank_count FROM public.questions WHERE quiz_id IS NULL;
  RAISE NOTICE 'Question bank count: %', v_bank_count;
  
  -- If no questions via quiz_id, try to link some existing questions from question bank
  IF v_question_count = 0 AND v_bank_count > 0 THEN
    RAISE NOTICE 'No questions via quiz_id, linking from question bank';
    
    -- Link some existing questions from the question bank (quiz_id IS NULL)
    INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, created_at)
    SELECT
      v_quiz_id,
      q.id AS question_id,
      ROW_NUMBER() OVER (ORDER BY q.created_at, q.id) - 1 AS order_index,
      NOW()
    FROM public.questions q
    WHERE q.quiz_id IS NULL
    ORDER BY RANDOM()
    LIMIT 5;  -- Link 5 random questions
    
    RAISE NOTICE 'Linked 5 questions from question bank';
  ELSIF v_question_count = 0 AND v_bank_count = 0 THEN
    RAISE NOTICE 'No questions in question bank, linking from other quizzes';
    
    -- Link questions from other quizzes
    INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, created_at)
    SELECT
      v_quiz_id,
      q.id AS question_id,
      ROW_NUMBER() OVER (ORDER BY q.created_at, q.id) - 1 AS order_index,
      NOW()
    FROM public.questions q
    WHERE q.quiz_id IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 5;  -- Link 5 random questions from other quizzes
    
    RAISE NOTICE 'Linked 5 questions from other quizzes';
  ELSE
    -- 3) If there are questions, backfill them to junction table
    INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, created_at)
    SELECT
      q.quiz_id,
      q.id AS question_id,
      ROW_NUMBER() OVER (PARTITION BY q.quiz_id ORDER BY q.created_at, q.id) - 1 AS order_index,
      NOW()
    FROM public.questions q
    WHERE q.quiz_id = v_quiz_id
    ON CONFLICT (quiz_id, question_id) DO NOTHING;
  END IF;
  
  -- 4) Publish the quiz
  UPDATE public.quizzes SET is_published = true WHERE id = v_quiz_id;
  
  RAISE NOTICE 'Quiz published successfully';
END $$;

-- 5) Verify the fix
SELECT 
  q.id,
  q.title,
  q.is_published,
  COUNT(qq.question_id) as junction_count
FROM public.quizzes q
LEFT JOIN public.quiz_questions qq ON qq.quiz_id = q.id
WHERE q.title ILIKE '%Data Structures and Algorithm%'
GROUP BY q.id, q.title, q.is_published;
