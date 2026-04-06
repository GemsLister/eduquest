-- Migration: Add Student Profiles Support with Bloom's Taxonomy Analysis
-- Purpose: Add indexes and optimize queries for student performance tracking by Bloom's levels

-- Add blooms_level column to questions table if it doesn't exist
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS blooms_level VARCHAR(50);

-- Add indexes for student_profile table
CREATE INDEX IF NOT EXISTS idx_student_profile_student_id
ON public.student_profile(student_id);

CREATE INDEX IF NOT EXISTS idx_student_profile_student_email
ON public.student_profile(student_email);

-- Add indexes for quiz_attempts performance queries
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_section_status
ON public.quiz_attempts(section_id, status)
WHERE status = 'completed';

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student_email_status
ON public.quiz_attempts(student_email, status)
WHERE status = 'completed';

-- Add indexes for questions and Bloom's taxonomy
CREATE INDEX IF NOT EXISTS idx_questions_quiz_blooms
ON public.questions(quiz_id, blooms_level);

CREATE INDEX IF NOT EXISTS idx_questions_blooms_level
ON public.questions(blooms_level);

-- Add indexes for sections and quizzes
CREATE INDEX IF NOT EXISTS idx_sections_instructor_archived
ON public.sections(instructor_id, is_archived);

CREATE INDEX IF NOT EXISTS idx_quizzes_instructor_section
ON public.quizzes(instructor_id, section_id);

-- Create a view for student performance by Bloom's Taxonomy level
CREATE OR REPLACE VIEW public.student_blooms_performance AS
SELECT 
  qa.section_id,
  qa.student_email,
  qa.student_name,
  q.blooms_level,
  qa.score,
  qa.id as attempt_id,
  q.id as question_id
FROM public.quiz_attempts qa
LEFT JOIN public.questions q ON q.quiz_id = qa.quiz_id
WHERE qa.status = 'completed' AND q.blooms_level IS NOT NULL;

-- Comment on the view
COMMENT ON VIEW public.student_blooms_performance IS 'Student performance analysis by Bloom''s Taxonomy levels for the Student Profiles feature';
