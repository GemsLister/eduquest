-- ============================================================
-- Check section share tokens for Database Management quiz
-- Run this in Supabase Studio SQL Editor
-- ============================================================

-- 1) Find the Database Management quiz
SELECT 
  q.id,
  q.title,
  q.share_token as quiz_share_token,
  q.is_published
FROM public.quizzes q
WHERE q.title ILIKE '%DATABASE MANAGEMENT%'
ORDER BY q.created_at DESC;

-- 2) Check all sections for this quiz and their share tokens
SELECT 
  qs.id,
  qs.quiz_id,
  qs.section_id,
  qs.share_token as section_share_token,
  s.name as section_name,
  s.instructor_id
FROM public.quiz_sections qs
LEFT JOIN public.sections s ON s.id = qs.section_id
WHERE qs.quiz_id IN (
  SELECT id FROM public.quizzes WHERE title ILIKE '%DATABASE MANAGEMENT%'
)
ORDER BY s.name;

-- 3) Check if sections exist in the database
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

-- 4) Check if the specific share token exists in both tables
SELECT 
  'quizzes' as table_name,
  id,
  title,
  share_token
FROM public.quizzes 
WHERE share_token = 'B8CCMFE4OLTQ'

UNION ALL

SELECT 
  'quiz_sections' as table_name,
  qs.id as id,
  s.name as title,
  qs.share_token
FROM public.quiz_sections qs
LEFT JOIN public.sections s ON s.id = qs.section_id
WHERE qs.share_token = 'B8CCMFE4OLTQ';
