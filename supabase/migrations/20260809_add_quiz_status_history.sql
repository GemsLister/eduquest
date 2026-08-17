-- ============================================================
-- Quiz Status History and Audit Trail Feature
-- Tracks quiz status changes and provides Department Head audit trail
-- ============================================================

-- 1) Add status column to quizzes table for current status tracking
ALTER TABLE public.quizzes
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'draft' CHECK (status IN (
  'draft',
  'submitted_for_review',
  'approved',
  'rejected',
  'scheduled',
  'published',
  'ongoing',
  'completed',
  'archived'
));

-- 2) Create quiz_status_history table for tracking status transitions
CREATE TABLE IF NOT EXISTS public.quiz_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_by_role VARCHAR(50),
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for quiz_status_history
CREATE INDEX IF NOT EXISTS idx_quiz_status_history_quiz_id ON public.quiz_status_history(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_status_history_created_at ON public.quiz_status_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_quiz_status_history_changed_by ON public.quiz_status_history(changed_by);

-- 3) Enable RLS for quiz_status_history
ALTER TABLE public.quiz_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies for quiz_status_history
-- Instructors can view history for their own quizzes
CREATE POLICY "Instructors can view their own quiz status history" ON public.quiz_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.quizzes q
      WHERE q.id = quiz_id AND q.instructor_id = auth.uid()
    )
  );

-- Faculty heads and admins can view all quiz status history
CREATE POLICY "Faculty heads and admins can view all quiz status history" ON public.quiz_status_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND (p.is_faculty_head = true OR p.is_admin = true)
    )
  );

-- 4) Create RPC function to log quiz status changes
CREATE OR REPLACE FUNCTION log_quiz_status_change(
  p_quiz_id UUID,
  p_new_status VARCHAR(50),
  p_reason TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_previous_status VARCHAR(50);
  v_history_id UUID;
BEGIN
  -- Get current status
  SELECT status INTO v_previous_status
  FROM public.quizzes
  WHERE id = p_quiz_id;

  -- Insert into history
  INSERT INTO public.quiz_status_history (
    quiz_id,
    previous_status,
    new_status,
    changed_by,
    changed_by_role,
    reason
  )
  VALUES (
    p_quiz_id,
    v_previous_status,
    p_new_status,
    auth.uid(),
    (SELECT 
      CASE 
        WHEN is_admin THEN 'admin'
        WHEN is_faculty_head THEN 'faculty_head'
        WHEN is_instructor THEN 'instructor'
        ELSE 'user'
      END 
      FROM public.profiles 
      WHERE id = auth.uid()
    ),
    p_reason
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

-- 5) Create RPC function to get quiz status history
CREATE OR REPLACE FUNCTION get_quiz_status_history(p_quiz_id UUID)
RETURNS TABLE (
  history_id UUID,
  previous_status VARCHAR(50),
  new_status VARCHAR(50),
  changed_by UUID,
  changed_by_name VARCHAR(255),
  changed_by_role VARCHAR(50),
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
    h.previous_status,
    h.new_status,
    h.changed_by,
    CONCAT(p.first_name, ' ', p.last_name) AS changed_by_name,
    h.changed_by_role,
    h.reason,
    h.created_at
  FROM public.quiz_status_history h
  LEFT JOIN public.profiles p ON p.id = h.changed_by
  WHERE h.quiz_id = p_quiz_id
  ORDER BY h.created_at ASC;
END;
$$;

-- 6) Create RPC function to log quiz operations to audit_trail
CREATE OR REPLACE FUNCTION log_quiz_audit(
  p_action VARCHAR(50),
  p_quiz_id UUID,
  p_details JSONB DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_audit_id UUID;
  v_old_values JSONB;
  v_new_values JSONB;
BEGIN
  -- Get current quiz values for old_values
  SELECT row_to_json(q) INTO v_old_values
  FROM public.quizzes q
  WHERE q.id = p_quiz_id;

  -- Insert into audit_trail
  INSERT INTO public.audit_trail (
    action,
    table_name,
    record_id,
    old_values,
    new_values,
    user_id,
    user_role,
    ip_address,
    user_agent
  )
  VALUES (
    p_action,
    'quizzes',
    p_quiz_id,
    v_old_values,
    p_details,
    auth.uid(),
    (SELECT 
      CASE 
        WHEN is_admin THEN 'admin'
        WHEN is_faculty_head THEN 'faculty_head'
        WHEN is_instructor THEN 'instructor'
        ELSE 'user'
      END 
      FROM public.profiles 
      WHERE id = auth.uid()
    ),
    NULL, -- ip_address would need to be passed from client
    NULL  -- user_agent would need to be passed from client
  )
  RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$;

-- 7) Create view for Department Head audit trail with quiz status
CREATE OR REPLACE VIEW faculty_head_quiz_audit_trail AS
SELECT
  at.id,
  at.action,
  at.table_name,
  at.record_id AS quiz_id,
  q.title AS quiz_title,
  q.status AS quiz_status,
  at.old_values,
  at.new_values,
  at.user_id,
  at.user_role,
  at.created_at,
  p.first_name,
  p.last_name,
  p.username,
  p.email
FROM public.audit_trail at
LEFT JOIN public.quizzes q ON q.id = at.record_id AND at.table_name = 'quizzes'
LEFT JOIN public.profiles p ON p.id = at.user_id
WHERE at.table_name = 'quizzes'
ORDER BY at.created_at DESC;

-- 8) Initialize status for existing quizzes based on current state
UPDATE public.quizzes
SET status = 
  CASE
    WHEN is_archived THEN 'archived'
    WHEN is_published THEN 'published'
    ELSE 'draft'
  END
WHERE status IS NULL OR status = '';
