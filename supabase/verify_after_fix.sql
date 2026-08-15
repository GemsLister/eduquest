-- ============================================================
-- Verify quiz questions after backfill
-- ============================================================

-- Check all quizzes and their question counts
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
