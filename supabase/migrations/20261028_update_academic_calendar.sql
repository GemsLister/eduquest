-- School calendar correction: 1st Semester runs August-December, 2nd Semester
-- January-May, and the school year ends in May. June-July is Summer (midyear)
-- of the school year that just ended; a new school year starts in August.
-- (20261027_semester_archiving.sql used June-October / November-March.)

-- 1) New date rule. current_academic_term() and the section trigger call this,
--    so new sections follow the corrected calendar automatically.
CREATE OR REPLACE FUNCTION public.academic_term_for_date(p_date TIMESTAMPTZ)
RETURNS TABLE (school_year TEXT, semester TEXT)
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    CASE
      WHEN EXTRACT(MONTH FROM p_date) >= 8
        THEN EXTRACT(YEAR FROM p_date)::INT || '-' || (EXTRACT(YEAR FROM p_date)::INT + 1)
      ELSE (EXTRACT(YEAR FROM p_date)::INT - 1) || '-' || EXTRACT(YEAR FROM p_date)::INT
    END,
    CASE
      WHEN EXTRACT(MONTH FROM p_date) >= 8 THEN '1st Semester'
      WHEN EXTRACT(MONTH FROM p_date) <= 5 THEN '2nd Semester'
      ELSE 'Summer'
    END;
$$;

-- 2) Re-tag sections whose term came from the old date rule. Sections tagged
--    from the Department Head's override (a different term) are left alone.
UPDATE public.sections s
SET school_year = (SELECT t.school_year FROM public.academic_term_for_date(s.created_at) t),
    semester = (SELECT t.semester FROM public.academic_term_for_date(s.created_at) t)
WHERE s.created_at IS NOT NULL
  AND s.school_year = CASE
      WHEN EXTRACT(MONTH FROM s.created_at) >= 6
        THEN EXTRACT(YEAR FROM s.created_at)::INT || '-' || (EXTRACT(YEAR FROM s.created_at)::INT + 1)
      ELSE (EXTRACT(YEAR FROM s.created_at)::INT - 1) || '-' || EXTRACT(YEAR FROM s.created_at)::INT
    END
  AND s.semester = CASE
      WHEN EXTRACT(MONTH FROM s.created_at) BETWEEN 6 AND 10 THEN '1st Semester'
      WHEN EXTRACT(MONTH FROM s.created_at) IN (4, 5) THEN 'Summer'
      ELSE '2nd Semester'
    END;
