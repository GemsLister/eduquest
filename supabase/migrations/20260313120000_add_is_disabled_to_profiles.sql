-- Add is_disabled column so admins can disable instructor access without deleting records.
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_disabled boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET is_disabled = false
WHERE is_disabled IS NULL;

-- Refresh instructor listing RPC to expose the disabled state in the admin table.
DROP FUNCTION IF EXISTS public.get_instructor_profiles();

CREATE OR REPLACE FUNCTION get_instructor_profiles()
RETURNS TABLE (
  id uuid,
  username text,
  first_name text,
  last_name text,
  email text,
  is_disabled boolean,
  created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.username,
    p.first_name,
    p.last_name,
    COALESCE(p.email, u.email) AS email,
    COALESCE(p.is_disabled, false) AS is_disabled,
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.is_instructor = true
    AND (p.is_admin IS NULL OR p.is_admin = false)
  ORDER BY p.created_at DESC;
$$;