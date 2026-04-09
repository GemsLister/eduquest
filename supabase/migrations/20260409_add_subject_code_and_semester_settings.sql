-- Add subject_code column to sections table
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS subject_code VARCHAR(50);

-- Drop the old unique constraint that only checks (instructor_id, name)
-- This was too restrictive: same course can be taught in multiple sections
ALTER TABLE public.sections DROP CONSTRAINT IF EXISTS sections_instructor_id_name_key;

-- Add a new unique constraint that includes description (section/schedule)
-- so "AppDev - T301" and "AppDev - T302" are both allowed
ALTER TABLE public.sections ADD CONSTRAINT sections_instructor_id_name_description_key
  UNIQUE (instructor_id, name, description);

-- Add semester and school year override fields to tos_signatories
ALTER TABLE tos_signatories ADD COLUMN IF NOT EXISTS semester_override TEXT;
ALTER TABLE tos_signatories ADD COLUMN IF NOT EXISTS school_year_override TEXT;
