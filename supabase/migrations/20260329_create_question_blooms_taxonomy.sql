-- Create question_blooms_taxonomy table
-- This table stores individual questions with their subjects, quiz names, and Bloom's taxonomy classifications

CREATE TABLE IF NOT EXISTS public.question_blooms_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  
  -- Question Information
  question_text TEXT NOT NULL,
  quiz_name TEXT NOT NULL,
  subject_name TEXT,
  
  -- Correct Answer Information
  correct_answer TEXT NOT NULL,
  answer_options JSONB, -- Store multiple choice options or other answer formats
  answer_explanation TEXT, -- Explanation of why this is correct
  
  -- Bloom's Taxonomy Classification
  blooms_taxonomy_level TEXT NOT NULL CHECK (blooms_taxonomy_level IN (
    'Remembering',
    'Understanding', 
    'Applying',
    'Analyzing',
    'Evaluating',
    'Creating'
  )),
  
  -- Instructor's Classification (if different from automatic)
  instructor_classified_level TEXT CHECK (instructor_classified_level IN (
    'Remembering',
    'Understanding', 
    'Applying',
    'Analyzing',
    'Evaluating',
    'Creating'
  )),
  
  -- Metadata
  difficulty_level TEXT CHECK (difficulty_level IN ('Easy', 'Medium', 'Hard')),
  question_type TEXT CHECK (question_type IN ('Multiple Choice', 'True/False', 'Short Answer', 'Essay')),
  points_value DECIMAL(5,2) DEFAULT 1.00,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  classified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  classified_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_question_blooms_quiz_id ON public.question_blooms_taxonomy(quiz_id);
CREATE INDEX IF NOT EXISTS idx_question_blooms_subject_id ON public.question_blooms_taxonomy(subject_id);
CREATE INDEX IF NOT EXISTS idx_question_blooms_taxonomy_level ON public.question_blooms_taxonomy(blooms_taxonomy_level);
CREATE INDEX IF NOT EXISTS idx_question_blooms_question_id ON public.question_blooms_taxonomy(question_id);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.question_blooms_taxonomy ENABLE ROW LEVEL SECURITY;

-- Policy: Instructors can view and manage their own quiz questions
CREATE POLICY "Instructors can manage their quiz questions" ON public.question_blooms_taxonomy
  FOR ALL USING (
    auth.uid() = (
      SELECT q.instructor_id 
      FROM public.quizzes q 
      WHERE q.id = public.question_blooms_taxonomy.quiz_id
    )
  );

-- Policy: Students can view questions for their enrolled quizzes
CREATE POLICY "Students can view enrolled quiz questions" ON public.question_blooms_taxonomy
  FOR SELECT USING (
    EXISTS (
      SELECT 1 
      FROM public.quiz_enrollments qe
      JOIN public.quizzes q ON qe.quiz_id = q.id
      WHERE qe.student_id = auth.uid() 
        AND q.id = public.question_blooms_taxonomy.quiz_id
    )
  );

-- Comments for documentation
COMMENT ON TABLE public.question_blooms_taxonomy IS 'Stores questions with their subjects, quiz names, Bloom''s taxonomy classifications, and correct answers';
COMMENT ON COLUMN public.question_blooms_taxonomy.question_text IS 'The full text of the question';
COMMENT ON COLUMN public.question_blooms_taxonomy.quiz_name IS 'Name of the quiz this question belongs to';
COMMENT ON COLUMN public.question_blooms_taxonomy.subject_name IS 'Name of the subject this question belongs to';
COMMENT ON COLUMN public.question_blooms_taxonomy.correct_answer IS 'The correct answer for this question';
COMMENT ON COLUMN public.question_blooms_taxonomy.answer_options IS 'JSON object containing answer options (multiple choice, true/false, etc.)';
COMMENT ON COLUMN public.question_blooms_taxonomy.answer_explanation IS 'Explanation of why the correct answer is right';
COMMENT ON COLUMN public.question_blooms_taxonomy.blooms_taxonomy_level IS 'Automatic Bloom''s taxonomy classification based on question complexity';
COMMENT ON COLUMN public.question_blooms_taxonomy.instructor_classified_level IS 'Instructor''s manual Bloom''s taxonomy classification';
COMMENT ON COLUMN public.question_blooms_taxonomy.difficulty_level IS 'Question difficulty: Easy, Medium, or Hard';
COMMENT ON COLUMN public.question_blooms_taxonomy.question_type IS 'Type of question: Multiple Choice, True/False, Short Answer, or Essay';
