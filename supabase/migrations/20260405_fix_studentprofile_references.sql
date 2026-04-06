-- Update migrations to use studentprofile table instead of profiles

-- This migration assumes you have a studentprofile table with the following structure:
-- - id (UUID, references auth.users)
-- - first_name (TEXT)
-- - last_name (TEXT) 
-- - email (TEXT)

-- Ensure studentprofile table has proper relationship to auth.users
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'studentprofile_user_id_fkey' 
        AND table_name = 'studentprofile'
    ) THEN
        ALTER TABLE public.studentprofile 
        ADD CONSTRAINT studentprofile_user_id_fkey 
        FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
    END IF;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_studentprofile_user_id ON public.studentprofile(id);

-- Add comment for documentation
COMMENT ON TABLE public.studentprofile IS 'Student profile information linked to auth.users';

-- If you need to create the studentprofile table, uncomment and run this:
/*
CREATE TABLE IF NOT EXISTS public.studentprofile (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.studentprofile ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own profile" ON public.studentprofile
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.studentprofile
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Instructors can view student profiles" ON public.studentprofile
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.sections s
      JOIN public.quizzes q ON s.id = q.section_id
      WHERE s.instructor_id = auth.uid()
    )
  );
*/
