-- Add revised_options column to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS revised_options TEXT[] DEFAULT NULL;

-- Also ensure revised_content can store just the question text efficiently
-- If it was JSONB, we can keep it or change to TEXT. Let's keep it flexible but 
-- the application will now use it primarily for the revised question text.
COMMENT ON COLUMN public.questions.revised_options IS 'Stores the revised choices/options for the question';