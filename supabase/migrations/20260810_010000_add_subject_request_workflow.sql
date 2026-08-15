-- ============================================================
-- Subject Request Workflow Migration
-- Implements centralized subject management with approval workflow
-- ============================================================

-- 1) Update subjects table to support approval workflow

-- First, drop ALL existing policies on subjects table to avoid dependency issues
DROP POLICY IF EXISTS "Instructors can create subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can update their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can delete their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can view their own subjects or subjects they collab" ON public.subjects;
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can update subjects they are assigned to" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can delete subjects they are assigned to" ON public.subjects;

-- Add new columns for approval workflow
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'approved',
ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add grade_level column if it doesn't exist (from previous migration)
ALTER TABLE public.subjects
ADD COLUMN IF NOT EXISTS grade_level VARCHAR(20) NOT NULL DEFAULT '1st';

-- Add check constraint for valid grade level values if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'subjects_grade_level_check'
    ) THEN
        ALTER TABLE public.subjects
        ADD CONSTRAINT subjects_grade_level_check 
        CHECK (grade_level IN ('1st', '2nd', '3rd', '4th'));
    END IF;
END $$;

-- Add check constraint for valid status values
ALTER TABLE public.subjects
ADD CONSTRAINT subjects_status_check 
CHECK (status IN ('pending', 'approved', 'rejected'));

-- Update existing subjects to have approved status and set created_by
UPDATE public.subjects 
SET 
  status = 'approved',
  approved_at = created_at,
  created_by = instructor_id
WHERE created_by IS NULL;

-- Drop instructor_id column since we now use created_by and instructor_subjects table
ALTER TABLE public.subjects
DROP COLUMN IF EXISTS instructor_id;

-- Update unique constraint to remove instructor_id dependency
-- First drop the constraint if it exists (from previous migration)
ALTER TABLE public.subjects
DROP CONSTRAINT IF EXISTS subjects_name_code_grade_level_unique;

-- Then add it back with the correct columns
ALTER TABLE public.subjects
ADD CONSTRAINT subjects_name_code_grade_level_unique UNIQUE (name, code, grade_level);

-- Create index for grade level if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_subjects_grade_level ON public.subjects(grade_level);

-- 2) Create subject_requests table
CREATE TABLE IF NOT EXISTS public.subject_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_name VARCHAR(255) NOT NULL,
  subject_code VARCHAR(50),
  grade_level VARCHAR(20) NOT NULL DEFAULT '1st',
  description TEXT,
  requested_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_status VARCHAR(20) NOT NULL DEFAULT 'pending',
  rejection_reason TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT subject_requests_status_check 
    CHECK (request_status IN ('pending', 'approved', 'rejected')),
  CONSTRAINT subject_requests_grade_level_check 
    CHECK (grade_level IN ('1st', '2nd', '3rd', '4th'))
);

-- Indexes for subject_requests
CREATE INDEX IF NOT EXISTS idx_subject_requests_requested_by ON public.subject_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_subject_requests_status ON public.subject_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_subject_requests_grade_level ON public.subject_requests(grade_level);
CREATE INDEX IF NOT EXISTS idx_subject_requests_name_grade ON public.subject_requests(subject_name, grade_level);

-- 3) Enable RLS for subject_requests
ALTER TABLE public.subject_requests ENABLE ROW LEVEL SECURITY;

-- RLS policies for subject_requests
CREATE POLICY "Instructors can view their own requests" ON public.subject_requests
  FOR SELECT USING (auth.uid() = requested_by);

CREATE POLICY "Faculty heads can view all requests" ON public.subject_requests
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_faculty_head = true
    )
  );

CREATE POLICY "Instructors can create requests" ON public.subject_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by AND
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_instructor = true
    )
  );

CREATE POLICY "Faculty heads can update requests" ON public.subject_requests
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_faculty_head = true
    )
  )
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_faculty_head = true
  )
);

-- 4) Update RLS policies for subjects to support approval workflow
DROP POLICY IF EXISTS "Authenticated users can view subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can create subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can update subjects they are assigned to" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can delete subjects they are assigned to" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can view their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can update their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can delete their own subjects" ON public.subjects;
DROP POLICY IF EXISTS "Instructors can view their own subjects or subjects they collab" ON public.subjects;

CREATE POLICY "Authenticated users can view approved subjects" ON public.subjects
  FOR SELECT USING (
    status = 'approved' OR
    auth.uid() = created_by OR
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_faculty_head = true
    )
  );

CREATE POLICY "Faculty heads can create subjects" ON public.subjects
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_faculty_head = true
    )
  );

CREATE POLICY "Faculty heads can update subjects" ON public.subjects
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_faculty_head = true
    )
  );

CREATE POLICY "Faculty heads can delete subjects" ON public.subjects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles p 
      WHERE p.id = auth.uid() AND p.is_faculty_head = true
    )
  );

-- 5) Create RPC function to submit subject request with duplicate prevention
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
  -- Check if user is an instructor
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_instructor = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only instructors can submit subject requests');
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
    WHERE name = p_subject_name 
      AND (code = p_subject_code OR (p_subject_code IS NULL AND code IS NULL))
      AND grade_level = p_grade_level
      AND status = 'approved'
    LIMIT 1;
  ELSE
    SELECT id INTO v_existing_subject
    FROM public.subjects
    WHERE name = p_subject_name 
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
    AND subject_name = p_subject_name
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

-- 6) Create RPC function for faculty head to approve subject request
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
  -- Check if user is faculty head
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_faculty_head = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only faculty heads can approve subject requests');
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

  -- Approve the request: create the subject
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

  -- Assign the requesting instructor to the subject
  INSERT INTO public.instructor_subjects (instructor_id, subject_id)
  VALUES (v_request.requested_by, v_subject_id)
  ON CONFLICT (instructor_id, subject_id) DO NOTHING
  RETURNING id INTO v_instructor_subject_id;

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

-- 7) Create RPC function for faculty head to directly create subject
CREATE OR REPLACE FUNCTION create_subject_direct(
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
  v_subject_id UUID;
  v_existing_subject UUID;
  v_has_grade_level BOOLEAN;
BEGIN
  -- Check if user is faculty head
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.id = auth.uid() AND p.is_faculty_head = true
  ) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Only faculty heads can directly create subjects');
  END IF;

  -- Check if subjects table has grade_level column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'grade_level'
  ) INTO v_has_grade_level;

  -- Check for duplicate subject
  IF v_has_grade_level THEN
    SELECT id INTO v_existing_subject
    FROM public.subjects
    WHERE name = p_subject_name 
      AND (code = p_subject_code OR (p_subject_code IS NULL AND code IS NULL))
      AND grade_level = p_grade_level
    LIMIT 1;
  ELSE
    SELECT id INTO v_existing_subject
    FROM public.subjects
    WHERE name = p_subject_name 
      AND (code = p_subject_code OR (p_subject_code IS NULL AND code IS NULL))
    LIMIT 1;
  END IF;

  IF v_existing_subject IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'A subject with this name and grade level already exists', 'existing_subject_id', v_existing_subject);
  END IF;

  -- Create the subject
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
      p_subject_name,
      p_subject_code,
      p_grade_level,
      p_description,
      'approved',
      auth.uid(),
      NOW(),
      auth.uid()
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
      p_subject_name,
      p_subject_code,
      p_description,
      'approved',
      auth.uid(),
      NOW(),
      auth.uid()
    )
    RETURNING id INTO v_subject_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'subject_id', v_subject_id);
END;
$$;

-- 8) Create RPC function to get all approved subjects with assignment status
CREATE OR REPLACE FUNCTION get_approved_subjects()
RETURNS TABLE (
  id UUID,
  name VARCHAR(255),
  code VARCHAR(50),
  description TEXT,
  grade_level VARCHAR(20),
  is_assigned BOOLEAN,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_grade_level BOOLEAN;
BEGIN
  -- Check if subjects table has grade_level column
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'subjects' AND column_name = 'grade_level'
  ) INTO v_has_grade_level;

  IF v_has_grade_level THEN
    RETURN QUERY
    SELECT
      s.id,
      s.name,
      s.code,
      s.description,
      s.grade_level,
      EXISTS (
        SELECT 1 FROM public.instructor_subjects iss
        WHERE iss.subject_id = s.id AND iss.instructor_id = auth.uid()
      ) AS is_assigned,
      s.created_at
    FROM public.subjects s
    WHERE s.status = 'approved'
    ORDER BY s.name, s.grade_level;
  ELSE
    RETURN QUERY
    SELECT
      s.id,
      s.name,
      s.code,
      s.description,
      '1st'::VARCHAR(20) AS grade_level, -- Default value
      EXISTS (
        SELECT 1 FROM public.instructor_subjects iss
        WHERE iss.subject_id = s.id AND iss.instructor_id = auth.uid()
      ) AS is_assigned,
      s.created_at
    FROM public.subjects s
    WHERE s.status = 'approved'
    ORDER BY s.name;
  END IF;
END;
$$;

-- 9) Create RPC function to get instructor's subject requests
CREATE OR REPLACE FUNCTION get_my_subject_requests()
RETURNS TABLE (
  id UUID,
  subject_name VARCHAR(255),
  subject_code VARCHAR(50),
  grade_level VARCHAR(20),
  description TEXT,
  request_status VARCHAR(20),
  rejection_reason TEXT,
  created_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sr.id,
    sr.subject_name,
    sr.subject_code,
    sr.grade_level,
    sr.description,
    sr.request_status,
    sr.rejection_reason,
    sr.created_at,
    sr.reviewed_at
  FROM public.subject_requests sr
  WHERE sr.requested_by = auth.uid()
  ORDER BY sr.created_at DESC;
END;
$$;

-- 10) Create RPC function to get all subject requests for faculty head
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
    CONCAT(p.first_name, ' ', p.last_name) AS requester_name,
    p.email AS requested_by_email,
    sr.created_at,
    sr.reviewed_at
  FROM public.subject_requests sr
  LEFT JOIN public.profiles p ON p.id = sr.requested_by
  ORDER BY sr.created_at DESC;
END;
$$;

-- 11) Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_subject_requests_updated_at ON public.subject_requests;

CREATE TRIGGER update_subject_requests_updated_at BEFORE UPDATE ON public.subject_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();