-- Add columns to store the immediate previous version of a question for sequential revisions
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS previous_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS previous_options TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS previous_correct_answer TEXT DEFAULT NULL;
