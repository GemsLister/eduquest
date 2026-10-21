-- ============================================================
-- Remove profiles.department
--
-- EduQuest serves a single department (IT), so forwarded quizzes go to every
-- Department Head and per-department routing is not needed. This undoes
-- part 1 of 20261022_department_and_notification_realtime.sql; the realtime
-- publication for public.notifications (part 2) stays.
-- ============================================================

DROP INDEX IF EXISTS public.idx_profiles_department;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS department;

NOTIFY pgrst, 'reload schema';
