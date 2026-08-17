-- ============================================================
-- Quiz Workflow History & Audit Trail Enhancement
-- Adds support for action types, section/subject context, and RLS security
-- ============================================================

-- 1) Create or update quiz_status_history table
CREATE TABLE IF NOT EXISTS public.quiz_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role VARCHAR(50),
  reason TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure indexes
CREATE INDEX IF NOT EXISTS idx_quiz_status_history_quiz_id ON public.quiz_status_history(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_status_history_created_at ON public.quiz_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_status_history_changed_by ON public.quiz_status_history(changed_by);

-- Enable RLS
ALTER TABLE public.quiz_status_history ENABLE ROW LEVEL SECURITY;

-- Drop previous policies to recreate cleanly
DROP POLICY IF EXISTS "Instructors can view history of their own quizzes and public quizzes" ON public.quiz_status_history;
CREATE POLICY "Instructors can view history of their own quizzes and public quizzes" ON public.quiz_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND (
        q.instructor_id = auth.uid() OR
        q.is_private = false OR
        q.is_private IS NULL
      )
    ) OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
    )
  );

-- RPC to log quiz status change with user role detection
CREATE OR REPLACE FUNCTION log_quiz_status_change(
  p_quiz_id UUID,
  p_new_status VARCHAR(50),
  p_reason TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_status VARCHAR(50);
  v_history_id UUID;
  v_user_role VARCHAR(50);
BEGIN
  -- Get current status
  SELECT status INTO v_previous_status
  FROM public.quizzes
  WHERE id = p_quiz_id;

  -- Determine user role
  SELECT 
    CASE 
      WHEN is_admin THEN 'admin'
      WHEN is_faculty_head THEN 'faculty_head'
      WHEN is_instructor THEN 'instructor'
      ELSE 'user'
    END INTO v_user_role
  FROM public.profiles 
  WHERE id = auth.uid();

  -- Insert history record
  INSERT INTO public.quiz_status_history (
    quiz_id,
    previous_status,
    new_status,
    changed_by,
    changed_by_role,
    reason,
    metadata
  )
  VALUES (
    p_quiz_id,
    v_previous_status,
    p_new_status,
    auth.uid(),
    COALESCE(v_user_role, 'instructor'),
    p_reason,
    p_metadata
  )
  RETURNING id INTO v_history_id;

  -- Update quiz status
  UPDATE public.quizzes
  SET status = p_new_status,
      updated_at = NOW()
  WHERE id = p_quiz_id;

  RETURN v_history_id;
END;
$$;

-- RPC to retrieve all quiz activity history entries for the current user
CREATE OR REPLACE FUNCTION get_user_quiz_activity_history(
  p_quiz_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS TABLE (
  history_id UUID,
  quiz_id UUID,
  quiz_title VARCHAR,
  quiz_status VARCHAR,
  is_private BOOLEAN,
  owner_id UUID,
  owner_name TEXT,
  previous_status VARCHAR,
  new_status VARCHAR,
  changed_by UUID,
  changed_by_name TEXT,
  changed_by_role VARCHAR,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    h.id AS history_id,
    h.quiz_id,
    q.title AS quiz_title,
    q.status AS quiz_status,
    COALESCE(q.is_private, false) AS is_private,
    q.instructor_id AS owner_id,
    CONCAT(op.first_name, ' ', op.last_name) AS owner_name,
    h.previous_status,
    h.new_status,
    h.changed_by,
    CONCAT(cp.first_name, ' ', cp.last_name) AS changed_by_name,
    h.changed_by_role,
    h.reason,
    h.created_at
  FROM public.quiz_status_history h
  JOIN public.quizzes q ON q.id = h.quiz_id
  LEFT JOIN public.profiles op ON op.id = q.instructor_id
  LEFT JOIN public.profiles cp ON cp.id = h.changed_by
  WHERE 
    (p_quiz_id IS NULL OR h.quiz_id = p_quiz_id)
    AND (
      q.instructor_id = auth.uid() OR
      COALESCE(q.is_private, false) = false OR
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
      )
    )
  ORDER BY h.created_at DESC
  LIMIT p_limit;
END;
$$;
