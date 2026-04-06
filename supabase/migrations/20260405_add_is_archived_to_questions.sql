-- Add is_archived column to questions table
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Create index for better query performance on is_archived filtering
CREATE INDEX IF NOT EXISTS idx_questions_is_archived
ON public.questions(is_archived);

-- Add comment for documentation
COMMENT ON COLUMN public.questions.is_archived IS 'Flag to indicate if a question is archived (hidden from active question bank)';
