CREATE TABLE IF NOT EXISTS public.quiz_sections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(quiz_id, section_id)
);

ALTER TABLE public.quiz_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Instructors can manage their quiz sections" ON public.quiz_sections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

CREATE POLICY "Users can view quiz sections for published quizzes" ON public.quiz_sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (q.instructor_id = auth.uid() OR q.is_published = TRUE)
    )
  );

-- Migrate existing relationships
INSERT INTO public.quiz_sections (quiz_id, section_id)
SELECT id, section_id FROM public.quizzes WHERE section_id IS NOT NULL ON CONFLICT DO NOTHING;
