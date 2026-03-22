-- Add a revision_history JSONB column to store an array of all past versions with their timestamps
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;
