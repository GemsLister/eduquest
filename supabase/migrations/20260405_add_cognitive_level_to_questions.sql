-- Add cognitive_level column to questions table for HOTS/LOTS categorization
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS cognitive_level VARCHAR(20) DEFAULT 'LOTS' CHECK (cognitive_level IN ('HOTS', 'LOTS'));

-- Add is_archived column to questions table (if not already exists)
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_questions_cognitive_level
ON public.questions(cognitive_level);

CREATE INDEX IF NOT EXISTS idx_questions_is_archived
ON public.questions(is_archived);

-- Add comments for documentation
COMMENT ON COLUMN public.questions.cognitive_level IS 'Cognitive level of the question: HOTS (Higher Order Thinking Skills) or LOTS (Lower Order Thinking Skills)';
COMMENT ON COLUMN public.questions.is_archived IS 'Flag to indicate if a question is archived (hidden from active question bank)';

-- Update RLS policy to allow instructors to update cognitive_level and is_archived for their questions
DROP POLICY IF EXISTS "Instructors can update cognitive_level for their questions" ON public.questions;
CREATE POLICY "Instructors can update cognitive_level for their questions" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- Allow instructors to insert questions with cognitive_level
DROP POLICY IF EXISTS "Instructors can create questions" ON public.questions;
CREATE POLICY "Instructors can create questions" ON public.questions
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );
