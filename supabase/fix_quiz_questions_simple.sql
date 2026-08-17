-- ============================================================
-- Simplified fix - Run this entire block as one query
-- ============================================================

DO $$
BEGIN
  -- 1) Make sure quiz_id is nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'questions' 
    AND column_name = 'quiz_id' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.questions ALTER COLUMN quiz_id DROP NOT NULL;
  END IF;
  
  -- 2) Create table if missing
  CREATE TABLE IF NOT EXISTS public.quiz_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(quiz_id, question_id)
  );
  
  -- 3) Create indexes
  CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON public.quiz_questions(question_id);
  CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions(quiz_id, order_index);
  
  -- 4) Backfill the junction table
  INSERT INTO public.quiz_questions (quiz_id, question_id, order_index, created_at)
  SELECT
    q.quiz_id,
    q.id AS question_id,
    ROW_NUMBER() OVER (PARTITION BY q.quiz_id ORDER BY q.created_at, q.id) - 1 AS order_index,
    NOW()
  FROM public.questions q
  WHERE q.quiz_id IS NOT NULL
  ON CONFLICT (quiz_id, question_id) DO NOTHING;
  
  -- 5) Enable RLS
  ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
  
  -- 6) Drop existing policies
  DROP POLICY IF EXISTS "Users can view quiz questions they have access to" ON public.quiz_questions;
  DROP POLICY IF EXISTS "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions;
  DROP POLICY IF EXISTS "Instructors can update quiz question order" ON public.quiz_questions;
  DROP POLICY IF EXISTS "Instructors can delete quiz questions" ON public.quiz_questions;
  
  -- 7) Create policies
  CREATE POLICY "Users can view quiz questions they have access to" ON public.quiz_questions
    FOR SELECT USING (
      EXISTS (SELECT 1 FROM public.quizzes qz WHERE qz.id = quiz_id AND (qz.instructor_id = auth.uid() OR qz.is_published = TRUE))
    );
  
  CREATE POLICY "Instructors can manage quiz questions for their own quizzes" ON public.quiz_questions
    FOR INSERT WITH CHECK (
      EXISTS (SELECT 1 FROM public.quizzes qz WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid())
    );
  
  CREATE POLICY "Instructors can update quiz question order" ON public.quiz_questions
    FOR UPDATE USING (
      EXISTS (SELECT 1 FROM public.quizzes qz WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid())
    );
  
  CREATE POLICY "Instructors can delete quiz questions" ON public.quiz_questions
    FOR DELETE USING (
      EXISTS (SELECT 1 FROM public.quizzes qz WHERE qz.id = quiz_id AND qz.instructor_id = auth.uid())
    );
END $$;

-- Verification query
SELECT 
  'Questions backfilled' as status,
  COUNT(*) as count
FROM public.quiz_questions;
