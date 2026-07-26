-- ============================================================
-- Data Normalization: Separate subjects table
-- ============================================================

-- 1) Create subjects table (reusable across sections)
CREATE TABLE IF NOT EXISTS public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(50),
  description TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instructor_id, name)
);

-- Indexes for subjects
CREATE INDEX IF NOT EXISTS idx_subjects_instructor_id ON public.subjects(instructor_id);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON public.subjects(code);

-- 2) Add subject_id to sections table (foreign key)
ALTER TABLE public.sections
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

-- Index for sections.subject_id
CREATE INDEX IF NOT EXISTS idx_sections_subject_id ON public.sections(subject_id);

-- 3) Add subject_id to quizzes table (optional direct link for faster queries)
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES public.subjects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quizzes_subject_id ON public.quizzes(subject_id);

-- ============================================================
-- RLS policies for subjects
-- ============================================================
ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can view their own subjects" ON public.subjects
  FOR SELECT USING (auth.uid() = instructor_id OR EXISTS (
    SELECT 1 FROM public.sections s WHERE s.subject_id = subjects.id
  ));

CREATE POLICY "Instructors can create subjects" ON public.subjects
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors can update their own subjects" ON public.subjects
  FOR UPDATE USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete their own subjects" ON public.subjects
  FOR DELETE USING (auth.uid() = instructor_id);
