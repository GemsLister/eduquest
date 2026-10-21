-- ============================================================
-- Senior Faculty hardening
--
-- 1. Role and approval columns on profiles can no longer be changed through
--    the API by the account itself. "Users can update their own profile" has
--    no column restriction, so anyone could set is_admin = true on their own
--    row. Only the service role (edge functions, SQL editor) can grant roles;
--    Senior Faculty can still approve, enable and disable instructors.
-- 2. get_instructor_profiles (the Senior Faculty "Instructors" page) leaves
--    out Department Heads and pending registrations, and only answers
--    Senior Faculty.
-- 3. Nobody can review their own submission: Senior Faculty and Department
--    Heads could previously forward or approve a quiz they submitted.
-- ============================================================

-- 1. Protect role / approval columns
CREATE OR REPLACE FUNCTION public.protect_profile_role_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller_is_admin boolean;
BEGIN
  -- No end-user JWT: service role (edge functions) or the SQL editor
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Self-registration: always starts as a plain, pending account
  IF TG_OP = 'INSERT' THEN
    NEW.is_admin := false;
    NEW.is_faculty_head := false;
    NEW.is_approved := false;
    NEW.is_disabled := false;
    RETURN NEW;
  END IF;

  -- Roles are only granted by the service role
  NEW.is_admin := OLD.is_admin;
  NEW.is_faculty_head := OLD.is_faculty_head;

  SELECT COALESCE(p.is_admin, false) INTO caller_is_admin
  FROM public.profiles p
  WHERE p.id = auth.uid();

  -- Approval and account status are Senior Faculty decisions
  IF NOT COALESCE(caller_is_admin, false) THEN
    NEW.is_approved := OLD.is_approved;
    NEW.is_disabled := OLD.is_disabled;
    NEW.is_instructor := OLD.is_instructor;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_role_columns ON public.profiles;
CREATE TRIGGER protect_profile_role_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role_columns();

-- 2. Instructor listing for Senior Faculty
DROP FUNCTION IF EXISTS public.get_instructor_profiles();

CREATE OR REPLACE FUNCTION public.get_instructor_profiles()
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
    AND p.is_approved = true
    AND COALESCE(p.is_admin, false) = false
    AND COALESCE(p.is_faculty_head, false) = false
    AND EXISTS (
      SELECT 1 FROM public.profiles caller
      WHERE caller.id = auth.uid() AND caller.is_admin = true
    )
  ORDER BY p.created_at DESC;
$$;

-- 3. No self-review
DROP POLICY IF EXISTS "Assigned peer reviewers can update submissions" ON public.quiz_analysis_submissions;

CREATE POLICY "Assigned peer reviewers can update submissions"
ON public.quiz_analysis_submissions
FOR UPDATE
TO authenticated
USING (
    auth.uid() <> instructor_id
    AND (
        auth.uid() = assigned_reviewer_id
        OR EXISTS (
            SELECT 1 FROM public.profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.is_admin = true OR profiles.is_faculty_head = true)
        )
    )
);

NOTIFY pgrst, 'reload schema';
