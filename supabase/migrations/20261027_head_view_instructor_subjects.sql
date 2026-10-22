-- Let the Department Head and Senior Faculty see who teaches each subject, so the
-- curriculum page can list a subject's instructors. Read-only.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'instructor_subjects'
      AND policyname = 'Heads and admins can view all subject assignments'
  ) THEN
    CREATE POLICY "Heads and admins can view all subject assignments"
      ON public.instructor_subjects
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1
          FROM public.profiles p
          WHERE p.id = auth.uid()
            AND (p.is_faculty_head = TRUE OR p.is_admin = TRUE)
        )
      );
  END IF;
END $$;
