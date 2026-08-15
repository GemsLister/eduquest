-- ============================================================
-- Verification queries to check quiz and questions
-- Run this in Supabase Studio SQL Editor
-- ============================================================

-- 1) Check all quizzes and their question counts
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
GROUP BY q.id, q.title, q.instructor_id, q.is_published
ORDER BY junction_count DESC;

-- 2) Check questions with NULL quiz_id (standalone questions in bank)
SELECT COUNT(*) as standalone_questions_count
FROM public.questions 
WHERE quiz_id IS NULL;

-- 3) Check total questions in database
SELECT COUNT(*) as total_questions
FROM public.questions;

-- 4) Check total quizzes in database
SELECT COUNT(*) as total_quizzes
FROM public.quizzes;

-- 5) Check if quiz_questions junction table has any data
SELECT COUNT(*) as total_junction_entries
FROM public.quiz_questions;
