-- ============================================================
-- Manual fix for quiz_questions junction table
-- Run this in Supabase Studio SQL Editor
-- ============================================================

-- 1) Make sure quiz_id is nullable on questions
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

-- 3) Indexes for junction table
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON public.quiz_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions(quiz_id, order_index);

-- 4) Backfill: for every question already linked via questions.quiz_id,
--    ensure it has a row in quiz_questions
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

-- 5) Enable RLS
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

-- 6) Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can update quiz question order" ON public.quiz_questions;
DROP POLICY IF EXISTS "Instructors can delete quiz questions" ON public.quiz_questions;

-- 7) Create policies
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

-- 8) Verify the backfill worked
SELECT 
  'Questions backfilled' as status,
  COUNT(*) as count
FROM public.quiz_questions;

-- 9) Check which quizzes have questions now
SELECT 
  q.title as quiz_title,
  COUNT(qq.question_id) as question_count
FROM public.quizzes q
LEFT JOIN public.quiz_questions qq ON qq.quiz_id = q.id
GROUP BY q.id, q.title
ORDER BY question_count DESC;
