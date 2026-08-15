-- ============================================================
-- Check current state of Database Management quiz sections
-- Run this in Supabase Studio SQL Editor
-- ============================================================

-- Show all sections assigned to Database Management quiz
SELECT 
  qs.id,
  qs.quiz_id,
  qs.section_id,
  qs.share_token as section_share_token,
  s.name as section_name,
  q.share_token as quiz_share_token
FROM public.quiz_sections qs
LEFT JOIN public.sections s ON s.id = qs.section_id
LEFT JOIN public.quizzes q ON q.id = qs.quiz_id
WHERE q.title ILIKE '%DATABASE MANAGEMENT%'
ORDER BY s.name;

-- Show all sections in the database (to see what's available)
SELECT 
  s.id,
  s.name,
  s.instructor_id,
  s.subject_id
FROM public.sections s
WHERE s.name ILIKE '%DATABASE MANAGEMENT%' 
   OR s.name ILIKE '%CLASS A%'
   OR s.name ILIKE '%CLASS D%'
ORDER BY s.name;
