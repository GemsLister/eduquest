-- Fix script to create missing instructor_subjects table
-- This script creates the instructor_subjects junction table and related structures

-- 1) Create instructor_subjects junction table
CREATE TABLE IF NOT EXISTS public.instructor_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instructor_id, subject_id)
);

-- Indexes for instructor_subjects
CREATE INDEX IF NOT EXISTS idx_instructor_subjects_instructor_id ON public.instructor_subjects(instructor_id);
CREATE INDEX IF NOT EXISTS idx_instructor_subjects_subject_id ON public.instructor_subjects(subject_id);

-- 2) Create instructor_subject_sections junction table
CREATE TABLE IF NOT EXISTS public.instructor_subject_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_subject_id UUID NOT NULL REFERENCES public.instructor_subjects(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(instructor_subject_id, section_id)
);

-- Indexes for instructor_subject_sections
CREATE INDEX IF NOT EXISTS idx_instructor_subject_sections_instructor_subject_id ON public.instructor_subject_sections(instructor_subject_id);
CREATE INDEX IF NOT EXISTS idx_instructor_subject_sections_section_id ON public.instructor_subject_sections(section_id);

-- 3) Enable RLS for new junction tables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'instructor_subjects'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.instructor_subjects ENABLE ROW LEVEL SECURITY;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'instructor_subject_sections'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE public.instructor_subject_sections ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

-- 4) RLS policies for instructor_subjects
DROP POLICY IF EXISTS "Instructors can view their own subject assignments" ON public.instructor_subjects;
CREATE POLICY "Instructors can view their own subject assignments" ON public.instructor_subjects
  FOR SELECT USING (auth.uid() = instructor_id);

DROP POLICY IF EXISTS "Instructors can create their own subject assignments" ON public.instructor_subjects;
CREATE POLICY "Instructors can create their own subject assignments" ON public.instructor_subjects
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

DROP POLICY IF EXISTS "Instructors can delete their own subject assignments" ON public.instructor_subjects;
CREATE POLICY "Instructors can delete their own subject assignments" ON public.instructor_subjects
  FOR DELETE USING (auth.uid() = instructor_id);

-- 5) RLS policies for instructor_subject_sections
DROP POLICY IF EXISTS "Instructors can view their own section assignments" ON public.instructor_subject_sections;
CREATE POLICY "Instructors can view their own section assignments" ON public.instructor_subject_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.id = instructor_subject_sections.instructor_subject_id 
      AND iss.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors can create their own section assignments" ON public.instructor_subject_sections;
CREATE POLICY "Instructors can create their own section assignments" ON public.instructor_subject_sections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.id = instructor_subject_sections.instructor_subject_id 
      AND iss.instructor_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Instructors can delete their own section assignments" ON public.instructor_subject_sections;
CREATE POLICY "Instructors can delete their own section assignments" ON public.instructor_subject_sections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.id = instructor_subject_sections.instructor_subject_id 
      AND iss.instructor_id = auth.uid()
    )
  );

-- 6) Create RPC function to get instructor's subjects with their assigned sections
CREATE OR REPLACE FUNCTION get_instructor_subjects_with_sections()
RETURNS TABLE (
  subject_id UUID,
  subject_name VARCHAR(255),
  subject_code VARCHAR(50),
  subject_description TEXT,
  instructor_subject_id UUID,
  section_id UUID,
  section_name VARCHAR(255),
  section_exam_code VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id AS subject_id,
    s.name AS subject_name,
    s.code AS subject_code,
    s.description AS subject_description,
    iss.id AS instructor_subject_id,
    sec.id AS section_id,
    sec.name AS section_name,
    sec.exam_code AS section_exam_code
  FROM public.instructor_subjects iss
  JOIN public.subjects s ON s.id = iss.subject_id
  LEFT JOIN public.instructor_subject_sections issec ON issec.instructor_subject_id = iss.id
  LEFT JOIN public.sections sec ON sec.id = issec.section_id
  WHERE iss.instructor_id = auth.uid()
  ORDER BY s.name, sec.name;
END;
$$;

-- 7) Create RPC function to assign subject to instructor
CREATE OR REPLACE FUNCTION assign_subject_to_instructor(
  p_subject_id UUID,
  p_instructor_id UUID DEFAULT auth.uid()
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor_subject_id UUID;
BEGIN
  INSERT INTO public.instructor_subjects (instructor_id, subject_id)
  VALUES (p_instructor_id, p_subject_id)
  ON CONFLICT (instructor_id, subject_id) DO NOTHING
  RETURNING id INTO v_instructor_subject_id;
  
  RETURN v_instructor_subject_id;
END;
$$;

-- 8) Create RPC function to assign sections to instructor-subject
CREATE OR REPLACE FUNCTION assign_sections_to_instructor_subject(
  p_instructor_subject_id UUID,
  p_section_ids UUID[]
)
RETURNS TABLE (instructor_subject_section_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.instructor_subject_sections (instructor_subject_id, section_id)
  SELECT p_instructor_subject_id, unnest(p_section_ids)
  ON CONFLICT (instructor_subject_id, section_id) DO NOTHING
  RETURNING id;
END;
$$;

-- 9) Create RPC function to remove section from instructor-subject
CREATE OR REPLACE FUNCTION remove_section_from_instructor_subject(
  p_instructor_subject_id UUID,
  p_section_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.instructor_subject_sections
  WHERE instructor_subject_id = p_instructor_subject_id AND section_id = p_section_id;
  
  RETURN FOUND;
END;
$$;

-- 10) Create RPC function to join subject
CREATE OR REPLACE FUNCTION join_subject(p_subject_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_instructor_subject_id UUID;
BEGIN
  INSERT INTO public.instructor_subjects (instructor_id, subject_id)
  VALUES (auth.uid(), p_subject_id)
  ON CONFLICT (instructor_id, subject_id) DO NOTHING
  RETURNING id INTO v_instructor_subject_id;
  
  RETURN v_instructor_subject_id;
END;
$$;

-- 11) Create RPC function to leave subject
CREATE OR REPLACE FUNCTION leave_subject(p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.instructor_subjects
  WHERE instructor_id = auth.uid() AND subject_id = p_subject_id;
  
  RETURN FOUND;
END;
$$;