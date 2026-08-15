-- ============================================================
-- Check specific quiz for DATA STRUCTURE AND ALGORITHM
-- Run this in Supabase Studio SQL Editor
-- ============================================================

-- 1) Check if the quiz exists and its question counts
SELECT 
  q.id,
  q.title,
  q.instructor_id,
  q.is_published,
  COUNT(qq.question_id) as junction_count,
  COUNT(q2.id) as direct_quiz_id_count
FROM public.quizzes q
LEFT JOIN public.quiz_questions qq ON qq.quiz_id = q.id
LEFT JOIN public.questions q2 ON q2.quiz_id = q.id
WHERE q.title ILIKE '%DATA STRUCTURE%'
GROUP BY q.id, q.title, q.instructor_id, q.is_published;

-- 2) Check the structure of questions table first
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'questions'
ORDER BY ordinal_position;

-- 3) If quiz exists, check the actual questions (using * to see all columns)
SELECT q.*
FROM public.questions q
WHERE q.quiz_id = (SELECT id FROM public.quizzes WHERE title ILIKE '%DATA STRUCTURE%' LIMIT 1)
LIMIT 10;

-- 4) Check junction table entries for this quiz
SELECT qq.*, q.text as question_text
FROM public.quiz_questions qq
JOIN public.questions q ON q.id = qq.question_id
WHERE qq.quiz_id = (SELECT id FROM public.quizzes WHERE title ILIKE '%DATA STRUCTURE%' LIMIT 1)
LIMIT 10;
