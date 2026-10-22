-- Semester-based archiving for instructors and Senior Faculty.
--
-- * Every section belongs to a term (school_year + semester). New sections are
--   tagged automatically with the current term: the Department Head's
--   "Semester & School Year Override" setting when set, otherwise derived from
--   the date (June-October = 1st Semester, November-March = 2nd Semester,
--   April-May = Summer; June onwards starts a new school year).
-- * An instructor can archive a subject for themselves only: their sections
--   under it are archived and their link to the subject is marked archived.
--   The curriculum subject and other instructors are not affected.

-- 1) Term columns on sections + per-instructor archive flag on subject links
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS school_year TEXT;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS semester TEXT;
ALTER TABLE public.sections ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

ALTER TABLE public.instructor_subjects ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE public.instructor_subjects ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_sections_term ON public.sections(school_year, semester);

-- 2) Term for a given date (Philippine academic calendar)
CREATE OR REPLACE FUNCTION public.academic_term_for_date(p_date TIMESTAMPTZ)
RETURNS TABLE (school_year TEXT, semester TEXT)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN EXTRACT(MONTH FROM p_date) >= 6
        THEN EXTRACT(YEAR FROM p_date)::INT || '-' || (EXTRACT(YEAR FROM p_date)::INT + 1)
      ELSE (EXTRACT(YEAR FROM p_date)::INT - 1) || '-' || EXTRACT(YEAR FROM p_date)::INT
    END,
    CASE
      WHEN EXTRACT(MONTH FROM p_date) BETWEEN 6 AND 10 THEN '1st Semester'
      WHEN EXTRACT(MONTH FROM p_date) IN (4, 5) THEN 'Summer'
      ELSE '2nd Semester'
    END;
$$;

-- 3) Current term: Department Head override first, date rule as fallback
CREATE OR REPLACE FUNCTION public.current_academic_term()
RETURNS TABLE (school_year TEXT, semester TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sy TEXT;
  v_sem TEXT;
  v_derived RECORD;
BEGIN
  SELECT NULLIF(TRIM(t.school_year_override), ''), NULLIF(TRIM(t.semester_override), '')
    INTO v_sy, v_sem
  FROM public.tos_signatories t
  ORDER BY t.updated_at DESC NULLS LAST
  LIMIT 1;

  SELECT * INTO v_derived FROM public.academic_term_for_date(NOW());

  school_year := COALESCE(v_sy, v_derived.school_year);
  semester := COALESCE(v_sem, v_derived.semester);
  RETURN NEXT;
END;
$$;

-- 4) Tag new sections with the current term
CREATE OR REPLACE FUNCTION public.set_section_term()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_term RECORD;
BEGIN
  IF NEW.school_year IS NULL OR NEW.semester IS NULL THEN
    SELECT * INTO v_term FROM public.current_academic_term();
    NEW.school_year := COALESCE(NEW.school_year, v_term.school_year);
    NEW.semester := COALESCE(NEW.semester, v_term.semester);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_sections_set_term ON public.sections;
CREATE TRIGGER on_sections_set_term
  BEFORE INSERT ON public.sections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_section_term();

-- 5) Backfill existing sections from their creation date
UPDATE public.sections s
SET school_year = COALESCE(
      s.school_year,
      (SELECT t.school_year FROM public.academic_term_for_date(COALESCE(s.created_at, NOW())) t)
    ),
    semester = COALESCE(
      s.semester,
      (SELECT t.semester FROM public.academic_term_for_date(COALESCE(s.created_at, NOW())) t)
    )
WHERE s.school_year IS NULL OR s.semester IS NULL;

-- 6) Close the caller's open exams that no longer have any active section
CREATE OR REPLACE FUNCTION public.close_exams_without_active_sections(p_section_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_closed INTEGER;
BEGIN
  UPDATE public.quizzes q
  SET is_open = FALSE
  WHERE q.instructor_id = auth.uid()
    AND q.is_open = TRUE
    AND (
      q.section_id = ANY (p_section_ids)
      OR EXISTS (
        SELECT 1 FROM public.quiz_sections qs
        WHERE qs.quiz_id = q.id AND qs.section_id = ANY (p_section_ids)
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.quiz_sections qs
      JOIN public.sections s ON s.id = qs.section_id
      WHERE qs.quiz_id = q.id AND COALESCE(s.is_archived, FALSE) = FALSE
    );
  GET DIAGNOSTICS v_closed = ROW_COUNT;
  RETURN v_closed;
END;
$$;

REVOKE ALL ON FUNCTION public.close_exams_without_active_sections(UUID[]) FROM PUBLIC, anon, authenticated;

-- 7) Archive a subject for the caller only
CREATE OR REPLACE FUNCTION public.archive_my_subject(p_subject_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
  v_closed INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  WITH archived AS (
    UPDATE public.sections
    SET is_archived = TRUE, archived_at = NOW()
    WHERE instructor_id = auth.uid()
      AND subject_id = p_subject_id
      AND COALESCE(is_archived, FALSE) = FALSE
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids FROM archived;

  IF array_length(v_ids, 1) > 0 THEN
    v_closed := public.close_exams_without_active_sections(v_ids);
  END IF;

  INSERT INTO public.instructor_subjects (instructor_id, subject_id, is_archived, archived_at)
  VALUES (auth.uid(), p_subject_id, TRUE, NOW())
  ON CONFLICT (instructor_id, subject_id)
  DO UPDATE SET is_archived = TRUE, archived_at = NOW();

  RETURN jsonb_build_object(
    'sections_archived', COALESCE(array_length(v_ids, 1), 0),
    'exams_closed', v_closed
  );
END;
$$;

-- 8) Archive specific sections of the caller (end-of-term reminder).
--    Subjects left with no active section are archived for the caller too.
CREATE OR REPLACE FUNCTION public.archive_my_sections(p_section_ids UUID[])
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids UUID[];
  v_closed INTEGER := 0;
  v_subjects INTEGER := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  WITH archived AS (
    UPDATE public.sections
    SET is_archived = TRUE, archived_at = NOW()
    WHERE instructor_id = auth.uid()
      AND id = ANY (p_section_ids)
      AND COALESCE(is_archived, FALSE) = FALSE
    RETURNING id
  )
  SELECT COALESCE(array_agg(id), '{}') INTO v_ids FROM archived;

  IF array_length(v_ids, 1) > 0 THEN
    v_closed := public.close_exams_without_active_sections(v_ids);

    WITH emptied AS (
      UPDATE public.instructor_subjects iss
      SET is_archived = TRUE, archived_at = NOW()
      WHERE iss.instructor_id = auth.uid()
        AND iss.is_archived = FALSE
        AND iss.subject_id IN (SELECT subject_id FROM public.sections WHERE id = ANY (v_ids))
        AND NOT EXISTS (
          SELECT 1 FROM public.sections s
          WHERE s.instructor_id = auth.uid()
            AND s.subject_id = iss.subject_id
            AND COALESCE(s.is_archived, FALSE) = FALSE
        )
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_subjects FROM emptied;
  END IF;

  RETURN jsonb_build_object(
    'sections_archived', COALESCE(array_length(v_ids, 1), 0),
    'exams_closed', v_closed,
    'subjects_archived', v_subjects
  );
END;
$$;

-- 9) Restore a subject for the caller, optionally only one term's sections.
--    Exams closed by archiving stay closed; the instructor reopens them.
CREATE OR REPLACE FUNCTION public.restore_my_subject(
  p_subject_id UUID,
  p_school_year TEXT DEFAULT NULL,
  p_semester TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_restored INTEGER;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  UPDATE public.sections
  SET is_archived = FALSE, archived_at = NULL
  WHERE instructor_id = auth.uid()
    AND subject_id = p_subject_id
    AND is_archived = TRUE
    AND (p_school_year IS NULL OR school_year = p_school_year)
    AND (p_semester IS NULL OR semester = p_semester);
  GET DIAGNOSTICS v_restored = ROW_COUNT;

  INSERT INTO public.instructor_subjects (instructor_id, subject_id, is_archived, archived_at)
  VALUES (auth.uid(), p_subject_id, FALSE, NULL)
  ON CONFLICT (instructor_id, subject_id)
  DO UPDATE SET is_archived = FALSE, archived_at = NULL;

  RETURN jsonb_build_object('sections_restored', v_restored);
END;
$$;

-- 10) Re-adding an archived subject next term reactivates the link.
--     Dropped first: the live function's return type can differ from the
--     migration files, and CREATE OR REPLACE can't change a return type.
DROP FUNCTION IF EXISTS join_subject(UUID);
CREATE FUNCTION join_subject(p_subject_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.is_instructor = true
  ) THEN
    RAISE EXCEPTION 'Only instructors can join subjects';
  END IF;

  INSERT INTO public.instructor_subjects (instructor_id, subject_id)
  VALUES (auth.uid(), p_subject_id)
  ON CONFLICT (instructor_id, subject_id)
  DO UPDATE SET is_archived = FALSE, archived_at = NULL;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION join_subject(UUID) TO authenticated;

-- 11) "Already teaching" in the subject picker ignores archived links
DROP FUNCTION IF EXISTS get_approved_subjects();
CREATE FUNCTION get_approved_subjects()
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
      WHERE iss.subject_id = s.id
        AND iss.instructor_id = auth.uid()
        AND iss.is_archived = FALSE
    ) AS is_assigned,
    s.created_at
  FROM public.subjects s
  WHERE s.status = 'approved'
    AND COALESCE(s.is_archived, FALSE) = FALSE
  ORDER BY s.name, s.grade_level;
END;
$$;

GRANT EXECUTE ON FUNCTION get_approved_subjects() TO authenticated;
