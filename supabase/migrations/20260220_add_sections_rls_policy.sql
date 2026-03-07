-- Add section_id column to quizzes if not exists
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL;

-- Create RLS policies for sections
-- Enable RLS on sections if not already enabled
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Policy: Instructors can view their own sections
CREATE POLICY "Instructors can view their own sections" ON public.sections
  FOR SELECT USING (auth.uid() = instructor_id);

-- Policy: Instructors can create sections
CREATE POLICY "Instructors can create sections" ON public.sections
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

-- Policy: Instructors can update their own sections
CREATE POLICY "Instructors can update their own sections" ON public.sections
  FOR UPDATE USING (auth.uid() = instructor_id);

-- Policy: Instructors can delete their own sections
CREATE POLICY "Instructors can delete their own sections" ON public.sections
  FOR DELETE USING (auth.uid() = instructor_id);

-- Create index on section_id in quizzes for better performance
CREATE INDEX IF NOT EXISTS idx_quizzes_section_id ON public.quizzes(section_id);

-- Create index on instructor_id and is_archived for sections
CREATE INDEX IF NOT EXISTS idx_sections_instructor_archived ON public.sections(instructor_id, is_archived);
