-- Link 5 random questions from other quizzes to the quiz
INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, created_at)
SELECT
  '3d18f974-3b29-4534-b1af-f5ccb92ad2f1'::uuid,
  q.id AS question_id,
  ROW_NUMBER() OVER (ORDER BY q.created_at, q.id) - 1 AS order_index,
  NOW()
FROM public.questions q
WHERE q.quiz_id IS NOT NULL
LIMIT 5;

-- Publish the quiz
UPDATE public.quizzes
SET is_published = true
WHERE id = '3d18f974-3b29-4534-b1af-f5ccb92ad2f1'::uuid;

-- Verify
SELECT 
  q.id,
  q.title,
  q.is_published,
  COUNT(qq.question_id) as junction_count
FROM public.quizzes q
LEFT JOIN public.quiz_questions qq ON qq.quiz_id = q.id
WHERE q.title ILIKE '%Data Structures and Algorithm%'
GROUP BY q.id, q.title, q.is_published;
