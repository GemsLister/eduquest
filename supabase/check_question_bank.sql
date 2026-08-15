-- ============================================================
-- Check if there are questions in the question bank
-- ============================================================

-- Check questions with NULL quiz_id (question bank)
SELECT COUNT(*) as question_bank_count
FROM public.questions 
WHERE quiz_id IS NULL;

-- Check total questions in database
SELECT COUNT(*) as total_questions
FROM public.questions;

-- Check questions with quiz_id (linked to quizzes)
SELECT COUNT(*) as linked_questions
FROM public.questions 
WHERE quiz_id IS NOT NULL;
