-- ============================================================
-- Question Bank / Quiz Bank Separation
-- Allow questions to exist independently in the bank and be
-- reused across multiple quiz sets via junction table
-- ============================================================

-- 1) Make quiz_id optional on questions (so questions can exist in the bank standalone)
ALTER TABLE public.questions
ALTER COLUMN quiz_id DROP NOT NULL;

-- 2) Create quiz_questions junction table
CREATE TABLE IF NOT EXISTS public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quiz_id, question_id)
);

-- Indexes for junction table
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON public.quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_question_id ON public.quiz_questions(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_order ON public.quiz_questions(quiz_id, order_index);

-- 3) Backfill existing relationships into quiz_questions from questions.quiz_id
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

-- 4) Add RLS policies for junction table
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;

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
