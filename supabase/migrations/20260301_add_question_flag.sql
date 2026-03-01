-- Add flag column to questions table
ALTER TABLE public.questions 
ADD COLUMN IF NOT EXISTS flag VARCHAR(50) DEFAULT 'pending' CHECK (flag IN ('pending', 'approved', 'needs_revision'));

-- Create index for faster flag queries
CREATE INDEX IF NOT EXISTS idx_questions_flag ON public.questions(flag);

-- Update RLS policy to include flag
-- The existing SELECT policy already covers this table
