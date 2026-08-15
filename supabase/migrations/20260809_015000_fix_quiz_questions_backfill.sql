-- ============================================================
-- Fix-up migration: safely rebuild quiz_questions junction table
-- state after the earlier migration failed at the backfill step.
-- All operations are idempotent / use IF NOT EXISTS or DROP IF EXISTS.
-- ============================================================

-- 1) Make sure quiz_id is nullable on questions (bank support)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'questions'
      AND column_name  = 'quiz_id'
      AND is_nullable  = 'NO'
  ) THEN
    ALTER TABLE public.questions ALTER COLUMN quiz_id DROP NOT NULL;
  END IF;
END $$;

-- 2) Create quiz_questions junction table if missing
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quiz_id, question_id)
);

-- 3) Indexes for junction table (idempotent)
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON public.quiz_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions(quiz_id, order_index);

-- 4) Backfill: for every question already linked via questions.quiz_id,
--    ensure it has a row in quiz_questions. Use created_at + id for stable
--    ordering (questions table has never had an order_index column).
INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, created_at)
SELECT
  q.quiz_id,
  q.id AS question_id,
  ROW_NUMBER() OVER (
    PARTITION BY q.quiz_id
    ORDER BY q.created_at, q.id
  ) - 1 AS order_index,
  NOW()
FROM public.questions q
WHERE q.quiz_id IS NOT NULL
ON CONFLICT (quiz_id, question_id) DO NOTHING;

-- 5) Ensure RLS is enabled on quiz_questions
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- 6) Policies — drop if they exist so we can re-create cleanly
DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can update quiz question order" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can delete quiz questions" ON public.quiz_questions;

CREATE POLICY "Users can view quiz questions they have access to" ON public.quiz_questions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id
      AND (qz.instructor_id = auth.uid() OR qz.is_published = TRUE)
    )
  );

CREATE POLICY "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can update quiz question order" ON public.quiz_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete quiz questions" ON public.quiz_questions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes qz
      WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid()
    )
  );

-- ============================================================
-- 6) Allow authenticated users to READ quiz_analysis_submissions
--    for published / open quizzes.
--    This enables the PublicQuizPage snapshot fallback to restore
--    questions when actual question rows are missing in the database.
-- ============================================================
DO $$
BEGIN
  ALTER TABLE public.quiz_analysis_submissions ENABLE ROW LEVEL SECURITY;
END $$;

DROP POLICY IF EXISTS "Authenticated users can read snapshot data for published quizzes" ON public.quiz_analysis_submissions;

CREATE POLICY "Authenticated users can read snapshot data for published quizzes"
ON public.quiz_analysis_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_id
      AND q.is_published = TRUE
      AND (q.is_open IS NULL OR q.is_open = TRUE)
  )
);
