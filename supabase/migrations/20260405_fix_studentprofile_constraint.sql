-- Fix syntax error for studentprofile foreign key constraint
-- PostgreSQL doesn't support ADD CONSTRAINT IF NOT EXISTS, so we use DO block

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

-- Add comment
COMMENT ON TABLE public.studentprofile IS 'Student profile information linked to auth.users';
