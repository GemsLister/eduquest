-- ============================================================
-- Unified General System Activity & Audit Trail Migration
-- Enhances audit_trail table with structured action metadata and RPC query support
-- ============================================================

-- 1. Ensure columns exist on public.audit_trail
ALTER TABLE public.audit_trail
ADD COLUMN IF NOT EXISTS subject_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS section_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS item_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS previous_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS new_status VARCHAR(50),
ADD COLUMN IF NOT EXISTS reason TEXT,
ADD COLUMN IF NOT EXISTS change_summary TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2. Indexes for fast filtering
CREATE INDEX IF NOT EXISTS idx_audit_trail_table_record ON public.audit_trail(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_user_id ON public.audit_trail(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_created_at ON public.audit_trail(created_at DESC);

-- 3. Enable RLS
ALTER TABLE public.audit_trail ENABLE ROW LEVEL SECURITY;

-- Drop previous policies to recreate cleanly
DROP POLICY IF EXISTS "Users can view relevant activity audit logs" ON public.audit_trail;
CREATE POLICY "Users can view relevant activity audit logs" ON public.audit_trail
  FOR SELECT USING (
    user_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
    ) OR
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = record_id AND (q.instructor_id = auth.uid() OR q.is_private = false OR q.is_private IS NULL)
    )
  );

DROP POLICY IF EXISTS "Users can insert audit logs" ON public.audit_trail;
CREATE POLICY "Users can insert audit logs" ON public.audit_trail
  FOR INSERT WITH CHECK (
    auth.uid() = user_id OR user_id IS NULL
  );

-- 4. RPC to log structured system activity
CREATE OR REPLACE FUNCTION log_system_activity(
  p_action VARCHAR(100),
  p_table_name VARCHAR(50) DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_item_name VARCHAR(255) DEFAULT NULL,
  p_subject_name VARCHAR(255) DEFAULT NULL,
  p_section_name VARCHAR(255) DEFAULT NULL,
  p_previous_status VARCHAR(50) DEFAULT NULL,
  p_new_status VARCHAR(50) DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_change_summary TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
  v_user_role VARCHAR(50);
BEGIN
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

  -- Insert into audit_trail
  INSERT INTO public.audit_trail (
    action,
    table_name,
    record_id,
    item_name,
    subject_name,
    section_name,
    previous_status,
    new_status,
    reason,
    change_summary,
    user_id,
    user_role,
    new_values
  )
  VALUES (
    p_action,
    p_table_name,
    p_record_id,
    p_item_name,
    p_subject_name,
    p_section_name,
    p_previous_status,
    p_new_status,
    p_reason,
    p_change_summary,
    auth.uid(),
    COALESCE(v_user_role, 'instructor'),
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- 5. RPC to fetch unified system activity logs with profile, quiz, subject, and section details
CREATE OR REPLACE FUNCTION get_unified_system_activity(
  p_limit INT DEFAULT 150
)
RETURNS TABLE (
  log_id UUID,
  action VARCHAR,
  table_name VARCHAR,
  record_id UUID,
  item_name VARCHAR,
  subject_name VARCHAR,
  section_name VARCHAR,
  previous_status VARCHAR,
  new_status VARCHAR,
  reason TEXT,
  change_summary TEXT,
  user_id UUID,
  user_full_name TEXT,
  user_role VARCHAR,
  is_private_item BOOLEAN,
  owner_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS log_id,
    a.action,
    a.table_name,
    a.record_id,
    COALESCE(a.item_name, q.title, 'System Item') AS item_name,
    COALESCE(a.subject_name, sub.name, 'General Subject') AS subject_name,
    COALESCE(a.section_name, sec.name, 'General Section') AS section_name,
    a.previous_status,
    a.new_status,
    a.reason,
    a.change_summary,
    a.user_id,
    CONCAT(p.first_name, ' ', p.last_name) AS user_full_name,
    COALESCE(a.user_role, 'instructor') AS user_role,
    COALESCE(q.is_private, false) AS is_private_item,
    q.instructor_id AS owner_id,
    a.created_at
  FROM public.audit_trail a
  LEFT JOIN public.profiles p ON p.id = a.user_id
  LEFT JOIN public.quizzes q ON q.id = a.record_id AND a.table_name = 'quizzes'
  LEFT JOIN public.sections sec ON sec.id = q.section_id
  LEFT JOIN public.subjects sub ON sub.id = q.subject_id
  WHERE
    -- Security filter: user is author of log OR owner of quiz OR public quiz OR admin/head
    a.user_id = auth.uid() OR
    (q.id IS NOT NULL AND (q.instructor_id = auth.uid() OR COALESCE(q.is_private, false) = false)) OR
    EXISTS (
      SELECT 1 FROM public.profiles prof
      WHERE prof.id = auth.uid() AND (prof.is_faculty_head = true OR prof.is_admin = true)
    )
  ORDER BY a.created_at DESC
  LIMIT p_limit;
END;
$$;
