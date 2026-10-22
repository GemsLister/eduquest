-- Allow Senior Faculty (admins) to read every quiz's section assignments, so the
-- instructor details page can count exams per section, including drafts.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quiz_sections'
      AND policyname = 'Admins can view all quiz sections'
  ) THEN
    CREATE POLICY "Admins can view all quiz sections"
      ON public.quiz_sections
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_admin = TRUE
        )
      );
  END IF;
END $$;
