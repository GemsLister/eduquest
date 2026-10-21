-- Add is_private column to public.questions table if it does not exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'questions' 
          AND column_name = 'is_private'
    ) THEN
        ALTER TABLE public.questions ADD COLUMN is_private BOOLEAN DEFAULT TRUE;
    END IF;
END $$;
