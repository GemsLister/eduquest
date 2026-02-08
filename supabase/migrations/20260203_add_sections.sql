-- Create sections table
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enrollment_code VARCHAR(50) UNIQUE,
  color_scheme VARCHAR(50) DEFAULT 'casual-green', -- casual-green, hornblende-green, etc.
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instructor_id, name)
);

-- Add section_id to quizzes table
ALTER TABLE public.quizzes 
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL;

-- Add is_student to profiles table (to differentiate roles)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_student BOOLEAN DEFAULT TRUE;

-- Create student_sections junction table for enrollment
CREATE TABLE IF NOT EXISTS public.student_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(student_id, section_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sections_instructor_id ON public.sections(instructor_id);
CREATE INDEX IF NOT EXISTS idx_sections_enrollment_code ON public.sections(enrollment_code);
CREATE INDEX IF NOT EXISTS idx_quizzes_section_id ON public.quizzes(section_id);
CREATE INDEX IF NOT EXISTS idx_student_sections_student_id ON public.student_sections(student_id);
CREATE INDEX IF NOT EXISTS idx_student_sections_section_id ON public.student_sections(section_id);

-- Enable Row Level Security
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_sections ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for sections
CREATE POLICY "Instructors can view their own sections" ON public.sections
  FOR SELECT USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can create sections" ON public.sections
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors can update their own sections" ON public.sections
  FOR UPDATE USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete their own sections" ON public.sections
  FOR DELETE USING (auth.uid() = instructor_id);

-- Create RLS policies for student_sections
CREATE POLICY "Users can view their own enrollments" ON public.student_sections
  FOR SELECT USING (auth.uid() = student_id OR
    EXISTS (
      SELECT 1 FROM public.sections s
      WHERE s.id = section_id AND s.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Students can enroll in sections" ON public.student_sections
  FOR INSERT WITH CHECK (auth.uid() = student_id);

CREATE POLICY "Students can unenroll from sections" ON public.student_sections
  FOR DELETE USING (auth.uid() = student_id);
