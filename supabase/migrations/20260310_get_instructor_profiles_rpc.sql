-- RPC function to fetch instructor profiles with emails from auth.users
CREATE OR REPLACE FUNCTION get_instructor_profiles()
RETURNS TABLE (
  id uuid,
  username text,
  first_name text,
  last_name text,
  email text,
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
    p.created_at
  FROM public.profiles p
  JOIN auth.users u ON p.id = u.id
  WHERE p.is_instructor = true
    AND (p.is_admin IS NULL OR p.is_admin = false)
  ORDER BY p.created_at DESC;
$$;
