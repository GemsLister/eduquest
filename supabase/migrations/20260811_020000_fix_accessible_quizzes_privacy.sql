-- Update get_accessible_quizzes() function to respect is_private field
-- This ensures that private quizzes are only visible to the instructor who created them
-- Public quizzes can be shared with co-instructors in the same subject

CREATE OR REPLACE FUNCTION get_accessible_quizzes()
RETURNS TABLE (
  quiz_id UUID,
  title VARCHAR(255),
  subject_id UUID,
  subject_name VARCHAR(255),
  subject_code VARCHAR(50),
  owner_id UUID,
  owner_name VARCHAR(255),
  is_collaborative BOOLEAN,
  is_published BOOLEAN,
  is_private BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    q.id AS quiz_id,
    q.title,
    q.subject_id,
    s.name AS subject_name,
    s.code AS subject_code,
    q.instructor_id AS owner_id,
    CONCAT(p.first_name, ' ', p.last_name) AS owner_name,
    q.is_collaborative,
    q.is_published,
    q.is_private,
    q.created_at
  FROM public.quizzes q
  LEFT JOIN public.subjects s ON s.id = q.subject_id
  LEFT JOIN public.profiles p ON p.id = q.instructor_id
  WHERE
    -- User is the owner (can see own quizzes regardless of privacy)
    q.instructor_id = auth.uid() OR
    -- Quiz is published (for students)
    q.is_published = TRUE OR
    -- User has a section with the same subject AND quiz is public
    (
      q.is_private = false AND
      EXISTS (
        SELECT 1 FROM public.sections sec
        WHERE sec.subject_id = q.subject_id AND sec.instructor_id = auth.uid()
      )
    )
  ORDER BY q.created_at DESC;
END;
$$;
