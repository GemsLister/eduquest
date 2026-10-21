-- ============================================================
-- Ban already-disabled accounts in Supabase Auth
--
-- toggle-instructor-status now bans an account in auth.users when it is
-- disabled (and lifts the ban when it is enabled), so the account can't sign
-- in or refresh its session. Accounts disabled before that change only have
-- profiles.is_disabled set; this brings them in line.
-- ============================================================

UPDATE auth.users u
SET banned_until = now() + interval '100 years'
FROM public.profiles p
WHERE p.id = u.id
  AND p.is_disabled = true
  AND (u.banned_until IS NULL OR u.banned_until < now());
