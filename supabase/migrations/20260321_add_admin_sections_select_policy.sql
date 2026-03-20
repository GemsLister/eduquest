-- Allow admins to read all sections so admin dashboards can show real section names.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sections'
      AND policyname = 'Admins can view all sections'
  ) THEN
    CREATE POLICY "Admins can view all sections"
      ON public.sections
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
