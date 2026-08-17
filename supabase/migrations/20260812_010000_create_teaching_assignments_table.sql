-- ============================================================
-- Data Normalization: Teaching Assignments Table
-- Links Instructor, Subject, and Section with a unique constraint
-- ============================================================

CREATE TABLE IF NOT EXISTS public.teaching_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instructor_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT teaching_assignments_unique_assignment UNIQUE(instructor_id, subject_id, section_id)
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_instructor ON public.teaching_assignments(instructor_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_subject ON public.teaching_assignments(subject_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_section ON public.teaching_assignments(section_id);
CREATE INDEX IF NOT EXISTS idx_teaching_assignments_instructor_subject ON public.teaching_assignments(instructor_id, subject_id);

-- Enable RLS
ALTER TABLE public.teaching_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for teaching_assignments
DROP POLICY IF EXISTS "Instructors can view their own teaching assignments" ON public.teaching_assignments;
CREATE POLICY "Instructors can view their own teaching assignments" ON public.teaching_assignments
  FOR SELECT USING (
    instructor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (is_admin = TRUE OR is_faculty_head = TRUE)
    )
  );

DROP POLICY IF EXISTS "Instructors can create their own teaching assignments" ON public.teaching_assignments;
CREATE POLICY "Instructors can create their own teaching assignments" ON public.teaching_assignments
  FOR INSERT WITH CHECK (instructor_id = auth.uid());

DROP POLICY IF EXISTS "Instructors can delete their own teaching assignments" ON public.teaching_assignments;
CREATE POLICY "Instructors can delete their own teaching assignments" ON public.teaching_assignments
  FOR DELETE USING (instructor_id = auth.uid());

-- Data Migration: Populate teaching_assignments from existing sections table
INSERT INTO public.teaching_assignments (instructor_id, subject_id, section_id, created_at)
SELECT 
  sec.instructor_id, 
  sec.subject_id, 
  sec.id AS section_id,
  COALESCE(sec.created_at, NOW()) AS created_at
FROM public.sections sec
WHERE sec.instructor_id IS NOT NULL AND sec.subject_id IS NOT NULL
ON CONFLICT (instructor_id, subject_id, section_id) DO NOTHING;

-- Also migrate from instructor_subject_sections junction table if available
DO $$
BEGIN
  IF EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'instructor_subject_sections'
  ) THEN
    INSERT INTO public.teaching_assignments (instructor_id, subject_id, section_id, created_at)
    SELECT 
      iss.instructor_id,
      iss.subject_id,
      issec.section_id,
      COALESCE(issec.assigned_at, NOW())
    FROM public.instructor_subject_sections issec
    JOIN public.instructor_subjects iss ON issec.instructor_subject_id = iss.id
    WHERE iss.instructor_id IS NOT NULL AND iss.subject_id IS NOT NULL AND issec.section_id IS NOT NULL
    ON CONFLICT (instructor_id, subject_id, section_id) DO NOTHING;
  END IF;
END $$;
