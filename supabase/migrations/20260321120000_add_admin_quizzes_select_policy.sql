-- Allow admins to read all quizzes so admin review pages can embed quiz details.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'quizzes'
      AND policyname = 'Admins can view all quizzes'
  ) THEN
    CREATE POLICY "Admins can view all quizzes"
      ON public.quizzes
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
