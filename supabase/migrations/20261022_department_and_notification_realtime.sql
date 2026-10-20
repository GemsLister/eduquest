-- ============================================================
-- Departments for routing + live notifications
--
-- 1. profiles.department lets a forwarded quiz notify only the Department
--    Heads of the submitting instructor's department. It is optional: when
--    either side has no department set, every Department Head is notified
--    (the previous behaviour).
-- 2. The notification bell subscribes to INSERTs on public.notifications,
--    which only fire when the table is part of the supabase_realtime
--    publication. Without this, new notifications appeared only on reload.
-- ============================================================

-- 1. Department on profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS department TEXT;

CREATE INDEX IF NOT EXISTS idx_profiles_department
  ON public.profiles (lower(department))
  WHERE department IS NOT NULL;

-- 2. Realtime for notifications
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime'
         AND schemaname = 'public'
         AND tablename = 'notifications'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  END IF;
END $$;
