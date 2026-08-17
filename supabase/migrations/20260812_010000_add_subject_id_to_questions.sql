-- ============================================================
-- Add subject_id to questions table for centralized Question Bank
-- ============================================================
-- This migration enables questions to be organized by subject rather than by section,
-- preventing duplicate subject categorization (e.g., "Database Management - Section A",
-- "Database Management - Section B") and allowing all questions of the same subject
-- to be grouped together in a single Question Bank.

-- 1) Add subject_id column to questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- 2) Create index for better query performance on subject_id
CREATE INDEX IF NOT EXISTS idx_questions_subject_id ON public.questions(subject_id);

-- 3) Create composite index for questions with both subject_id and section_id
-- This allows efficient queries for questions by subject while preserving section metadata
CREATE INDEX IF NOT EXISTS idx_questions_subject_section ON public.questions(subject_id, section_id);

-- 4) Backfill subject_id from section relationships for existing questions
-- For questions that have a section_id, copy the subject_id from that section
UPDATE public.questions q
SET subject_id = s.subject_id
FROM public.sections s
WHERE q.section_id = s.id
  AND q.subject_id IS NULL;

-- 5) For questions from quizzes, derive subject_id from the quiz's section or subject
UPDATE public.questions q
SET subject_id = COALESCE(qz.subject_id, s.subject_id)
FROM public.quizzes qz
LEFT JOIN public.sections s ON qz.section_id = s.id
WHERE q.quiz_id = qz.id
  AND q.subject_id IS NULL;

-- 6) Add RLS policy for subject_id updates
CREATE POLICY "Instructors can update subject_id for their questions" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.id = section_id AND s.instructor_id = auth.uid()
    )
  );

-- 7) Add comment to document the purpose of section_id vs subject_id
COMMENT ON COLUMN public.questions.section_id IS 'Metadata field indicating the section where the question originated or was used. For categorization and filtering, use subject_id instead.';
COMMENT ON COLUMN public.questions.subject_id IS 'Primary categorization field. All questions with the same subject_id appear in the same Question Bank, regardless of their section_id.';
