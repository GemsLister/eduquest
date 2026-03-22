-- Add columns to preserve the initial version of a question before any revisions
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS original_text TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_options TEXT[] DEFAULT NULL,
ADD COLUMN IF NOT EXISTS original_correct_answer TEXT DEFAULT NULL;

-- Populate original columns with current values if they are currently null
UPDATE public.questions 
SET 
  original_text = text,
  original_options = options,
  original_correct_answer = correct_answer
WHERE original_text IS NULL;