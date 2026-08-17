-- ============================================================
-- Data Normalization: Instructor-Subject-Section Relationships
-- Properly separates subjects from instructor assignments
-- ============================================================

-- 1) Remove instructor_id from subjects table (subjects should be independent)
ALTER TABLE public.subjects
DROP COLUMN IF EXISTS instructor_id;

-- Remove the old unique constraint since instructor_id is gone
ALTER TABLE public.subjects
DROP CONSTRAINT IF EXISTS subjects_instructor_id_name_key;

-- Add new unique constraint on name and code (subjects should be unique by name/code)
ALTER TABLE public.subjects
ADD CONSTRAINT subjects_name_code_unique UNIQUE (name, code);

-- 2) Create instructor_subjects junction table
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

-- 3) Create instructor_subject_sections junction table
-- This links an instructor-subject assignment to one or more sections
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

-- 4) Migrate existing data from old schema to new schema
-- Step 4a: Create instructor_subjects records from existing subjects with instructor_id
INSERT INTO public.instructor_subjects (instructor_id, subject_id, assigned_at)
SELECT 
  s.instructor_id, 
  s.id as subject_id, 
  s.created_at as assigned_at
FROM public.subjects s
WHERE s.instructor_id IS NOT NULL
ON CONFLICT (instructor_id, subject_id) DO NOTHING;

-- Step 4b: Create instructor_subject_sections records from existing sections with subject_id
INSERT INTO public.instructor_subject_sections (instructor_subject_id, section_id, assigned_at)
SELECT 
  iss.id as instructor_subject_id,
  sec.id as section_id,
  sec.created_at as assigned_at
FROM public.sections sec
JOIN public.subjects s ON s.id = sec.subject_id
JOIN public.instructor_subjects iss ON iss.instructor_id = sec.instructor_id AND iss.subject_id = s.id
WHERE sec.subject_id IS NOT NULL
ON CONFLICT (instructor_subject_id, section_id) DO NOTHING;

-- 5) Update RLS policies for subjects (now instructor-independent)
DROP POLICY IF EXISTS "Instructors can view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can create subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can update their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can delete their own subjects" ON public.subjects;

CREATE POLICY "Authenticated users can view subjects" ON public.subjects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Instructors can create subjects" ON public.subjects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_instructor = true
    )
  );

CREATE POLICY "Instructors can update subjects they are assigned to" ON public.subjects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.subject_id = subjects.id AND iss.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete subjects they are assigned to" ON public.subjects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.subject_id = subjects.id AND iss.instructor_id = auth.uid()
    )
  );

-- 6) Enable RLS for new junction tables
ALTER TABLE public.instructor_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.instructor_subject_sections ENABLE ROW LEVEL SECURITY;

-- RLS policies for instructor_subjects
CREATE POLICY "Instructors can view their own subject assignments" ON public.instructor_subjects
  FOR SELECT USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can create their own subject assignments" ON public.instructor_subjects
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete their own subject assignments" ON public.instructor_subjects
  FOR DELETE USING (auth.uid() = instructor_id);

-- RLS policies for instructor_subject_sections
CREATE POLICY "Instructors can view their own section assignments" ON public.instructor_subject_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.id = instructor_subject_sections.instructor_subject_id 
      AND iss.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can create their own section assignments" ON public.instructor_subject_sections
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.id = instructor_subject_sections.instructor_subject_id 
      AND iss.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Instructors can delete their own section assignments" ON public.instructor_subject_sections
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.id = instructor_subject_sections.instructor_subject_id 
      AND iss.instructor_id = auth.uid()
    )
  );

-- 7) Update sections RLS policies to work with new schema
DROP POLICY IF EXISTS "Instructors can view their own sections" ON public.sections;
DROP POLICY IF EXISTS "Instructors can create sections" ON public.sections;
DROP POLICY IF EXISTS "Instructors can update their own sections" ON public.sections;
DROP POLICY IF EXISTS "Instructors can delete their own sections" ON public.sections;

CREATE POLICY "Instructors can view their own sections" ON public.sections
  FOR SELECT USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can create sections" ON public.sections
  FOR INSERT WITH CHECK (auth.uid() = instructor_id);

CREATE POLICY "Instructors can update their own sections" ON public.sections
  FOR UPDATE USING (auth.uid() = instructor_id);

CREATE POLICY "Instructors can delete their own sections" ON public.sections
  FOR DELETE USING (auth.uid() = instructor_id);

-- 8) Create RPC function to get instructor's subjects with their assigned sections
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

-- 9) Create RPC function to assign subject to instructor
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
  -- Only allow self-assignment or admin assignment
  IF p_instructor_id != auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.is_admin = true
  ) THEN
    RAISE EXCEPTION 'You can only assign subjects to yourself';
  END IF;

  INSERT INTO public.instructor_subjects (instructor_id, subject_id)
  VALUES (p_instructor_id, p_subject_id)
  ON CONFLICT (instructor_id, subject_id) DO NOTHING
  RETURNING id INTO v_instructor_subject_id;

  RETURN v_instructor_subject_id;
END;
$$;

-- 10) Create RPC function to assign sections to instructor-subject combination
CREATE OR REPLACE FUNCTION assign_sections_to_instructor_subject(
  p_instructor_subject_id UUID,
  p_section_ids UUID[]
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_section_id UUID;
BEGIN
  -- Verify the instructor_subject belongs to the current user
  IF NOT EXISTS (
    SELECT 1 FROM public.instructor_subjects iss
    WHERE iss.id = p_instructor_subject_id AND iss.instructor_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only assign sections to your own subject assignments';
  END IF;

  -- Insert each section assignment
  FOREACH v_section_id IN ARRAY p_section_ids
  LOOP
    INSERT INTO public.instructor_subject_sections (instructor_subject_id, section_id)
    VALUES (p_instructor_subject_id, v_section_id)
    ON CONFLICT (instructor_subject_id, section_id) DO NOTHING;
  END LOOP;

  RETURN TRUE;
END;
$$;

-- 11) Create RPC function to remove section assignment from instructor-subject
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
  -- Verify the instructor_subject belongs to the current user
  IF NOT EXISTS (
    SELECT 1 FROM public.instructor_subjects iss
    WHERE iss.id = p_instructor_subject_id AND iss.instructor_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'You can only remove sections from your own subject assignments';
  END IF;

  DELETE FROM public.instructor_subject_sections
  WHERE instructor_subject_id = p_instructor_subject_id AND section_id = p_section_id;

  RETURN TRUE;
END;
$$;
