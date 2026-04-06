-- Create quiz_blooms_taxonomy table
-- This table stores instructor's Bloom's Taxonomy classification for quiz questions

CREATE TABLE IF NOT EXISTS public.quiz_blooms_taxonomy (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  bloom_level TEXT NOT NULL CHECK (bloom_level IN ('Remembering', 'Understanding', 'Applying', 'Analyzing', 'Evaluating', 'Creating')),
  instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure each question has only one bloom level per quiz
  UNIQUE(quiz_id, question_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_quiz_blooms_taxonomy_quiz_id ON public.quiz_blooms_taxonomy(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_blooms_taxonomy_question_id ON public.quiz_blooms_taxonomy(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_blooms_taxonomy_bloom_level ON public.quiz_blooms_taxonomy(bloom_level);

-- Create updated_at trigger
CREATE TRIGGER update_quiz_blooms_taxonomy_updated_at 
    BEFORE UPDATE ON public.quiz_blooms_taxonomy 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE public.quiz_blooms_taxonomy ENABLE ROW LEVEL SECURITY;

-- Policy: Instructors can manage their quiz blooms taxonomy
CREATE POLICY "Instructors can manage quiz blooms taxonomy"
    ON public.quiz_blooms_taxonomy FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes 
            WHERE quizzes.id = quiz_id 
            AND quizzes.instructor_id = auth.uid()
        )
    );

-- Policy: Users can view blooms taxonomy for their quizzes
CREATE POLICY "Users can view quiz blooms taxonomy"
    ON public.quiz_blooms_taxonomy FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.quizzes 
            WHERE quizzes.id = quiz_id 
            AND quizzes.instructor_id = auth.uid()
        )
    );

-- Comments for documentation
COMMENT ON TABLE public.quiz_blooms_taxonomy IS 'Stores instructor''s Bloom''s Taxonomy classification for quiz questions';
COMMENT ON COLUMN public.quiz_blooms_taxonomy.quiz_id IS 'Reference to the quiz';
COMMENT ON COLUMN public.quiz_blooms_taxonomy.question_id IS 'Reference to the question';
COMMENT ON COLUMN public.quiz_blooms_taxonomy.bloom_level IS 'Bloom''s Taxonomy level (Remembering, Understanding, Applying, Analyzing, Evaluating, Creating)';
COMMENT ON COLUMN public.quiz_blooms_taxonomy.instructor_id IS 'Reference to the instructor who classified the question';

-- Sample data for testing (you can remove this after testing)
-- This shows how to insert data for a quiz with 10 questions
-- Replace the UUIDs with your actual quiz and question IDs

-- Example: 6 Evaluating questions, 2 Analyzing questions, 2 Remembering questions
/*
INSERT INTO public.quiz_blooms_taxonomy (quiz_id, question_id, bloom_level, instructor_id) VALUES
-- 6 Evaluating questions
('your-quiz-id-1', 'question-id-1', 'Evaluating', 'instructor-id'),
('your-quiz-id-1', 'question-id-2', 'Evaluating', 'instructor-id'),
('your-quiz-id-1', 'question-id-3', 'Evaluating', 'instructor-id'),
('your-quiz-id-1', 'question-id-4', 'Evaluating', 'instructor-id'),
('your-quiz-id-1', 'question-id-5', 'Evaluating', 'instructor-id'),
('your-quiz-id-1', 'question-id-6', 'Evaluating', 'instructor-id'),

-- 2 Analyzing questions  
('your-quiz-id-1', 'question-id-7', 'Analyzing', 'instructor-id'),
('your-quiz-id-1', 'question-id-8', 'Analyzing', 'instructor-id'),

-- 2 Remembering questions
('your-quiz-id-1', 'question-id-9', 'Remembering', 'instructor-id'),
('your-quiz-id-1', 'question-id-10', 'Remembering', 'instructor-id');
*/
