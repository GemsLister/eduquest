-- ============================================================
-- Check DATA STRUCTURE AND ALGORITHM quiz specifically
-- ============================================================

-- Check if the quiz exists and has questions
SELECT 
  q.id,
  q.title,
  q.instructor_id,
  q.is_published,
  COUNT(qq.question_id) as junction_count
FROM public.quizzes q
LEFT JOIN public.quiz_questions qq ON qq.quiz_id = q.id
WHERE q.title ILIKE '%DATA STRUCTURE%'
GROUP BY q.id, q.title, q.instructor_id, q.is_published;

-- If quiz exists, check the actual questions
SELECT qq.*, q.text as question_text
FROM public.quiz_questions qq
JOIN public.questions q ON q.id = qq.question_id
WHERE qq.quiz_id = (SELECT id FROM public.quizzes WHERE title ILIKE '%DATA STRUCTURE%' LIMIT 1)
ORDER BY qq.order_index
LIMIT 10;
