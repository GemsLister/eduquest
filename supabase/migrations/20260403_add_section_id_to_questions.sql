-- Add section_id to questions table to track which subject/section a question belongs to
ALTER TABLE public.questions
ADD COLUMN IF NOT EXISTS section_id UUID REFERENCES public.sections(id) ON DELETE SET NULL;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_questions_section_id
ON public.questions(section_id);

-- Add RLS policy to allow instructors to update section_id for their questions
DROP POLICY IF EXISTS "Instructors can update section_id for their questions" ON public.questions;
CREATE POLICY "Instructors can update section_id for their questions" ON public.questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );
