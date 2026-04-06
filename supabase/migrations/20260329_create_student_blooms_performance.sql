-- Create student_blooms_performance table
-- This table stores student performance across all Bloom's Taxonomy cognitive domains

-- First, drop the view if it exists
DROP VIEW IF EXISTS public.student_blooms_performance CASCADE;

-- Now create the table
CREATE TABLE IF NOT EXISTS public.student_blooms_performance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  student_email TEXT,
  
  -- Bloom's Taxonomy Performance Data
  remembering_correct INTEGER DEFAULT 0,
  remembering_total INTEGER DEFAULT 0,
  remembering_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  understanding_correct INTEGER DEFAULT 0,
  understanding_total INTEGER DEFAULT 0,
  understanding_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  applying_correct INTEGER DEFAULT 0,
  applying_total INTEGER DEFAULT 0,
  applying_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  analyzing_correct INTEGER DEFAULT 0,
  analyzing_total INTEGER DEFAULT 0,
  analyzing_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  evaluating_correct INTEGER DEFAULT 0,
  evaluating_total INTEGER DEFAULT 0,
  evaluating_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  creating_correct INTEGER DEFAULT 0,
  creating_total INTEGER DEFAULT 0,
  creating_percentage DECIMAL(5,2) DEFAULT 0.00,
  
  -- Metadata
  total_questions INTEGER DEFAULT 0,
  total_correct INTEGER DEFAULT 0,
  overall_percentage DECIMAL(5,2) DEFAULT 0.00,
  attempt_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance (only if table was created)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'student_blooms_performance' AND table_schema = 'public') THEN
        CREATE INDEX IF NOT EXISTS idx_student_blooms_performance_student_id ON public.student_blooms_performance(student_id);
        CREATE INDEX IF NOT EXISTS idx_student_blooms_performance_quiz_id ON public.student_blooms_performance(quiz_id);
        CREATE INDEX IF NOT EXISTS idx_student_blooms_performance_section_id ON public.student_blooms_performance(section_id);
        CREATE INDEX IF NOT EXISTS idx_student_blooms_performance_attempt_date ON public.student_blooms_performance(attempt_date);
    END IF;
END $$;

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_student_blooms_performance_updated_at 
    BEFORE UPDATE ON public.student_blooms_performance 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS)
ALTER TABLE public.student_blooms_performance ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own performance
CREATE POLICY "Users can view own blooms performance"
    ON public.student_blooms_performance FOR SELECT
    USING (auth.uid() = student_id);

-- Policy: Instructors can view performance for their sections
CREATE POLICY "Instructors can view section blooms performance"
    ON public.student_blooms_performance FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.sections 
            WHERE sections.id = section_id 
            AND sections.instructor_id = auth.uid()
        )
    );

-- Policy: System can insert performance data
CREATE POLICY "System can insert blooms performance"
    ON public.student_blooms_performance FOR INSERT
    WITH CHECK (true);

-- Policy: System can update performance data
CREATE POLICY "System can update blooms performance"
    ON public.student_blooms_performance FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Comments for documentation
COMMENT ON TABLE public.student_blooms_performance IS 'Stores student performance across Bloom''s Taxonomy cognitive domains for each quiz attempt';
COMMENT ON COLUMN public.student_blooms_performance.student_id IS 'Reference to the authenticated user';
COMMENT ON COLUMN public.student_blooms_performance.quiz_id IS 'Reference to the quiz attempted';
COMMENT ON COLUMN public.student_blooms_performance.section_id IS 'Reference to the section/class';
COMMENT ON COLUMN public.student_blooms_performance.remembering_percentage IS 'Performance percentage for Remembering domain';
COMMENT ON COLUMN public.student_blooms_performance.understanding_percentage IS 'Performance percentage for Understanding domain';
COMMENT ON COLUMN public.student_blooms_performance.applying_percentage IS 'Performance percentage for Applying domain';
COMMENT ON COLUMN public.student_blooms_performance.analyzing_percentage IS 'Performance percentage for Analyzing domain';
COMMENT ON COLUMN public.student_blooms_performance.evaluating_percentage IS 'Performance percentage for Evaluating domain';
COMMENT ON COLUMN public.student_blooms_performance.creating_percentage IS 'Performance percentage for Creating domain';
