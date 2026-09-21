-- Migration: Fix Subject Request Workflow RLS, Schema & RPCs
-- Date: 2026-09-22
-- Description:
-- 1. Fix get_all_subject_requests() return type error (CONCAT returning text vs VARCHAR(255))
-- 2. Allow both Instructors (is_instructor = true) and Senior Faculty (is_admin = true) to submit requests
-- 3. Allow both Faculty Heads (is_faculty_head = true) and Senior Faculty/Admins (is_admin = true) to view and approve/reject requests
-- 4. Fix RLS policies on public.subject_requests

-- ============================================================================
-- 1. Fix RLS policies on public.subject_requests
-- ============================================================================
ALTER TABLE public.subject_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Instructors can view their own requests" ON public.subject_requests;
DROP POLICY IF EXISTS "Faculty heads can view all requests" ON public.subject_requests;
DROP POLICY IF EXISTS "Instructors can create requests" ON public.subject_requests;
DROP POLICY IF EXISTS "Faculty heads can update requests" ON public.subject_requests;
DROP POLICY IF EXISTS "Users can create subject requests" ON public.subject_requests;
DROP POLICY IF EXISTS "Staff can view subject requests" ON public.subject_requests;
DROP POLICY IF EXISTS "Staff can update subject requests" ON public.subject_requests;

-- Allow users to view their own requests, and Department Heads / Admins to view all
CREATE POLICY "Users can view own or all requests as head" ON public.subject_requests
  FOR SELECT USING (
    auth.uid() = requested_by OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
    )
  );

-- Allow both Instructors and Senior Faculty/Admins to create requests
CREATE POLICY "Instructors and senior faculty can create requests" ON public.subject_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND (p.is_instructor = true OR p.is_admin = true)
    )
  );

-- Allow Department Heads and Admins to update requests (approve/reject)
CREATE POLICY "Faculty heads and admins can update requests" ON public.subject_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
    )
  );

-- ============================================================================
-- 2. Fix submit_subject_request RPC function
-- ============================================================================
CREATE OR REPLACE FUNCTION submit_subject_request(
  p_subject_name VARCHAR(255),
  p_subject_code VARCHAR(50),
  p_grade_level VARCHAR(20),
  p_description TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request_id UUID;
  v_existing_subject UUID;
  v_existing_request UUID;
  v_has_grade_level BOOLEAN;
BEGIN
  -- Check if user is an instructor or senior faculty (admin)
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.is_instructor = true OR p.is_admin = true)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only instructors and senior faculty can submit subject requests');
  END IF;

  -- Check if subjects table has grade_level column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'grade_level'
  ) INTO v_has_grade_level;

  -- Check for duplicate approved subject
  IF v_has_grade_level THEN
    SELECT id INTO v_existing_subject
    FROM public.subjects
    WHERE LOWER(name) = LOWER(p_subject_name)
      AND (code = p_subject_code OR (p_subject_code IS NULL AND code IS NULL))
      AND grade_level = p_grade_level
      AND status = 'approved'
    LIMIT 1;
  ELSE
    SELECT id INTO v_existing_subject
    FROM public.subjects
    WHERE LOWER(name) = LOWER(p_subject_name)
      AND (code = p_subject_code OR (p_subject_code IS NULL AND code IS NULL))
      AND status = 'approved'
    LIMIT 1;
  END IF;

  IF v_existing_subject IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A subject with this name and grade level already exists', 'existing_subject_id', v_existing_subject);
  END IF;

  -- Check for duplicate pending request
  SELECT id INTO v_existing_request
  FROM public.subject_requests
  WHERE requested_by = auth.uid()
    AND LOWER(subject_name) = LOWER(p_subject_name)
    AND (subject_code = p_subject_code OR (p_subject_code IS NULL AND subject_code IS NULL))
    AND grade_level = p_grade_level
    AND request_status = 'pending'
  LIMIT 1;

  IF v_existing_request IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'You already have a pending request for this subject', 'existing_request_id', v_existing_request);
  END IF;

  -- Create the subject request
  INSERT INTO public.subject_requests (
    subject_name, 
    subject_code, 
    grade_level, 
    description, 
    requested_by
  )
  VALUES (
    p_subject_name, 
    p_subject_code, 
    p_grade_level, 
    p_description, 
    auth.uid()
  )
  RETURNING id INTO v_request_id;

  RETURN jsonb_build_object('success', true, 'request_id', v_request_id);
END;
$$;

-- ============================================================================
-- 3. Fix get_all_subject_requests RPC function (casting CONCAT to VARCHAR)
-- ============================================================================
CREATE OR REPLACE FUNCTION get_all_subject_requests()
RETURNS TABLE (
  id UUID,
  subject_name VARCHAR(255),
  subject_code VARCHAR(50),
  grade_level VARCHAR(20),
  description TEXT,
  request_status VARCHAR(20),
  rejection_reason TEXT,
  requested_by UUID,
  requester_name VARCHAR(255),
  requested_by_email VARCHAR(255),
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if caller is faculty head or admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    sr.id,
    sr.subject_name,
    sr.subject_code,
    sr.grade_level,
    sr.description,
    sr.request_status,
    sr.rejection_reason,
    sr.requested_by,
    CAST(COALESCE(NULLIF(CONCAT(p.first_name, ' ', p.last_name), ' '), p.username, p.email, 'Faculty Member') AS VARCHAR(255)) AS requester_name,
    CAST(p.email AS VARCHAR(255)) AS requested_by_email,
    sr.created_at,
    sr.reviewed_at
  FROM public.subject_requests sr
  LEFT JOIN public.profiles p ON p.id = sr.requested_by
  ORDER BY sr.created_at DESC;
END;
$$;

-- ============================================================================
-- 4. Fix approve_subject_request RPC function
-- ============================================================================
CREATE OR REPLACE FUNCTION approve_subject_request(
  p_request_id UUID,
  p_rejection_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request RECORD;
  v_subject_id UUID;
  v_instructor_subject_id UUID;
  v_has_grade_level BOOLEAN;
BEGIN
  -- Check if user is faculty head or admin
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only faculty heads and admins can approve subject requests');
  END IF;

  -- Get the request
  SELECT * INTO v_request
  FROM public.subject_requests
  WHERE id = p_request_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Subject request not found');
  END IF;

  IF v_request.request_status != 'pending' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Request has already been processed');
  END IF;

  -- If rejection reason provided, reject the request
  IF p_rejection_reason IS NOT NULL THEN
    UPDATE public.subject_requests
    SET 
      request_status = 'rejected',
      rejection_reason = p_rejection_reason,
      reviewed_by = auth.uid(),
      reviewed_at = NOW(),
      updated_at = NOW()
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true, 'action', 'rejected', 'request_id', p_request_id);
  END IF;

  -- Check if subjects table has grade_level column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'grade_level'
  ) INTO v_has_grade_level;

  -- Approve the request: create the subject (without instructor_id)
  IF v_has_grade_level THEN
    INSERT INTO public.subjects (
      name, 
      code, 
      grade_level, 
      description, 
      status, 
      approved_by, 
      approved_at, 
      created_by
    )
    VALUES (
      v_request.subject_name,
      v_request.subject_code,
      v_request.grade_level,
      v_request.description,
      'approved',
      auth.uid(),
      NOW(),
      v_request.requested_by
    )
    RETURNING id INTO v_subject_id;
  ELSE
    INSERT INTO public.subjects (
      name, 
      code, 
      description, 
      status, 
      approved_by, 
      approved_at, 
      created_by
    )
    VALUES (
      v_request.subject_name,
      v_request.subject_code,
      v_request.description,
      'approved',
      auth.uid(),
      NOW(),
      v_request.requested_by
    )
    RETURNING id INTO v_subject_id;
  END IF;

  -- Assign the requesting instructor to the subject in instructor_subjects junction
  IF v_request.requested_by IS NOT NULL THEN
    INSERT INTO public.instructor_subjects (instructor_id, subject_id)
    VALUES (v_request.requested_by, v_subject_id)
    ON CONFLICT (instructor_id, subject_id) DO NOTHING
    RETURNING id INTO v_instructor_subject_id;
  END IF;

  -- Update the request status
  UPDATE public.subject_requests
  SET 
    request_status = 'approved',
    reviewed_by = auth.uid(),
    reviewed_at = NOW(),
    updated_at = NOW()
  WHERE id = p_request_id;

  RETURN jsonb_build_object(
    'success', true, 
    'action', 'approved', 
    'request_id', p_request_id,
    'subject_id', v_subject_id,
    'instructor_subject_id', v_instructor_subject_id
  );
END;
$$;
