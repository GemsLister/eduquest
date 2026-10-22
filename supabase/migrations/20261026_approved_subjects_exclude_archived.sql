-- get_approved_subjects() feeds the instructor / Senior Faculty subject picker
-- when creating a section. It ignored is_archived, so subjects the Department
-- Head archived could still be picked. Same signature, archived rows excluded.
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
BEGIN
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
    AND COALESCE(s.is_archived, FALSE) = FALSE
  ORDER BY s.name, s.grade_level;
END;
$$;
