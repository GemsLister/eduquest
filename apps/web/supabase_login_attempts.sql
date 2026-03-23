-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- 1. Create login_attempts table
CREATE TABLE IF NOT EXISTS public.login_attempts (
  email TEXT PRIMARY KEY,
  attempts INT DEFAULT 0,
  locked_until TIMESTAMPTZ,
  last_attempt_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RPC: Check lockout and record a failed attempt
CREATE OR REPLACE FUNCTION public.record_failed_login(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_attempts INT;
  v_locked_until TIMESTAMPTZ;
  v_max_attempts INT := 5;
  v_lockout_minutes INT := 30;
BEGIN
  -- Upsert: insert or get existing row
  INSERT INTO public.login_attempts (email, attempts, locked_until, last_attempt_at)
  VALUES (p_email, 0, NULL, NOW())
  ON CONFLICT (email) DO NOTHING;

  -- Check current lockout
  SELECT attempts, locked_until INTO v_attempts, v_locked_until
  FROM public.login_attempts WHERE email = p_email;

  -- If locked and not expired, return locked status
  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN json_build_object(
      'is_locked', true,
      'remaining_attempts', 0,
      'minutes_left', CEIL(EXTRACT(EPOCH FROM (v_locked_until - NOW())) / 60)
    );
  END IF;

  -- If lock expired, reset
  IF v_locked_until IS NOT NULL AND v_locked_until <= NOW() THEN
    UPDATE public.login_attempts
    SET attempts = 0, locked_until = NULL
    WHERE email = p_email;
    v_attempts := 0;
  END IF;

  -- Increment attempts
  v_attempts := v_attempts + 1;

  -- Lock if max reached
  IF v_attempts >= v_max_attempts THEN
    UPDATE public.login_attempts
    SET attempts = v_attempts, locked_until = NOW() + (v_lockout_minutes || ' minutes')::INTERVAL, last_attempt_at = NOW()
    WHERE email = p_email;

    RETURN json_build_object(
      'is_locked', true,
      'remaining_attempts', 0,
      'minutes_left', v_lockout_minutes
    );
  ELSE
    UPDATE public.login_attempts
    SET attempts = v_attempts, last_attempt_at = NOW()
    WHERE email = p_email;

    RETURN json_build_object(
      'is_locked', false,
      'remaining_attempts', v_max_attempts - v_attempts,
      'minutes_left', 0
    );
  END IF;
END;
$$;

-- 3. RPC: Reset attempts on successful login
CREATE OR REPLACE FUNCTION public.reset_login_attempts(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.login_attempts WHERE email = p_email;
END;
$$;

-- 4. RPC: Check if locked (without recording attempt)
CREATE OR REPLACE FUNCTION public.check_login_lockout(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_locked_until TIMESTAMPTZ;
BEGIN
  SELECT locked_until INTO v_locked_until
  FROM public.login_attempts WHERE email = p_email;

  IF v_locked_until IS NOT NULL AND v_locked_until > NOW() THEN
    RETURN json_build_object(
      'is_locked', true,
      'minutes_left', CEIL(EXTRACT(EPOCH FROM (v_locked_until - NOW())) / 60)
    );
  END IF;

  RETURN json_build_object('is_locked', false, 'minutes_left', 0);
END;
$$;

-- 5. Grant anonymous access to these RPCs
GRANT EXECUTE ON FUNCTION public.record_failed_login(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.reset_login_attempts(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION public.record_failed_login(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_login_attempts(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_login_lockout(TEXT) TO authenticated;

-- 6. Disable RLS on login_attempts (only accessed via SECURITY DEFINER RPCs)
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
-- No RLS policies = no direct access. Only the RPCs (SECURITY DEFINER) can touch this table.
