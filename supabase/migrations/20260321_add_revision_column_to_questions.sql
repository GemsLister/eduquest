-- Add revision column to questions table to store revised content without overwriting original
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS revised_content JSONB DEFAULT NULL;

-- Comment for documentation
COMMENT ON COLUMN public.questions.revised_content IS 'Stores the revised version of the question (text, options, correct_answer) for instructor review before finalization';