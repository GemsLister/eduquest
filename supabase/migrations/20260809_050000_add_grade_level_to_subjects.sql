-- ============================================================
-- Add Grade Level to Subjects
-- ============================================================

-- 1) Add grade_level column to subjects table
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS grade_level VARCHAR(20) NOT NULL DEFAULT '1st';

-- Add check constraint for valid grade levels
ALTER TABLE public.subjects
ADD CONSTRAINT subjects_grade_level_check 
CHECK (grade_level IN ('1st', '2nd', '3rd', '4th'));

-- 2) Update unique constraint to include grade level
ALTER TABLE public.subjects
DROP CONSTRAINT IF EXISTS subjects_name_code_unique;

ALTER TABLE public.subjects
ADD CONSTRAINT subjects_name_code_grade_level_unique UNIQUE (name, code, grade_level);

-- 3) Create index for grade level filtering
CREATE INDEX IF NOT EXISTS idx_subjects_grade_level ON public.subjects(grade_level);

-- 4) Update RLS policies to allow filtering by grade level
-- No changes needed - existing policies already allow authenticated users to view subjects

-- 5) Create RPC function to get subjects by grade level
CREATE OR REPLACE FUNCTION get_subjects_by_grade_level(p_grade_level VARCHAR)
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  code VARCHAR(50),
  description TEXT,
  grade_level VARCHAR(20),
  is_archived BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_assigned BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.name,
    s.code,
    s.description,
    s.grade_level,
    s.is_archived,
    s.created_at,
    s.updated_at,
    EXISTS (
      SELECT 1 FROM public.instructor_subjects iss
      WHERE iss.subject_id = s.id AND iss.instructor_id = auth.uid()
    ) AS is_assigned
  FROM public.subjects s
  WHERE s.grade_level = p_grade_level
  ORDER BY s.name;
END;
$$;

-- 6) Create RPC function to get all grade levels with subject counts
CREATE OR REPLACE FUNCTION get_grade_levels_with_counts()
RETURNS TABLE (
  grade_level VARCHAR(20),
  subject_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.grade_level,
    COUNT(*) AS subject_count
  FROM public.subjects s
  GROUP BY s.grade_level
  ORDER BY 
    CASE s.grade_level
      WHEN '1st' THEN 1
      WHEN '2nd' THEN 2
      WHEN '3rd' THEN 3
      WHEN '4th' THEN 4
    END;
END;
$$;

-- 7) Create RPC function to assign instructor to a subject
CREATE OR REPLACE FUNCTION join_subject(p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is an instructor
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_instructor = true
  ) THEN
    RAISE EXCEPTION 'Only instructors can join subjects';
  END IF;

  -- Insert instructor-subject assignment
  INSERT INTO public.instructor_subjects (instructor_id, subject_id)
  VALUES (auth.uid(), p_subject_id)
  ON CONFLICT (instructor_id, subject_id) DO NOTHING;

  RETURN TRUE;
END;
$$;

-- 8) Create RPC function to remove instructor from a subject
CREATE OR REPLACE FUNCTION leave_subject(p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.instructor_subjects
  WHERE instructor_id = auth.uid() AND subject_id = p_subject_id;

  RETURN TRUE;
END;
$$;
