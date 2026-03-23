-- Add section_id column to quiz_attempts table
ALTER TABLE public.quiz_attempts
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_section_id ON public.quiz_attempts(section_id);
