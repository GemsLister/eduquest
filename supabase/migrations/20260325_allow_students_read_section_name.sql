-- Allow anyone to read section name/exam_code if the section has a published quiz assigned
CREATE POLICY "Anyone can view sections with published quizzes" ON public.sections
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quiz_sections qs
      JOIN public.quizzes q ON q.id = qs.quiz_id
      WHERE qs.section_id = sections.id AND q.is_published = TRUE
    )
  );
