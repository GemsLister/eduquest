-- Prevent duplicate quiz attempts per student per section (identified by email).
-- A student can take the same quiz once per section, but not twice in the same section.
-- section_id can be NULL, so we need separate indexes for NULL and non-NULL cases
-- (PostgreSQL treats NULLs as distinct in unique indexes).

-- First clean up existing duplicates, keeping only the earliest attempt.

-- Remove duplicate completed attempts WITH a section (keep the first one)
DELETE FROM public.quiz_attempts a
USING public.quiz_attempts b
WHERE a.quiz_id = b.quiz_id
  AND a.student_email = b.student_email
  AND a.section_id = b.section_id
  AND a.status = 'completed'
  AND b.status = 'completed'
  AND a.started_at > b.started_at;

-- Remove duplicate completed attempts WITHOUT a section (keep the first one)
DELETE FROM public.quiz_attempts a
USING public.quiz_attempts b
WHERE a.quiz_id = b.quiz_id
  AND a.student_email = b.student_email
  AND a.section_id IS NULL
  AND b.section_id IS NULL
  AND a.status = 'completed'
  AND b.status = 'completed'
  AND a.started_at > b.started_at;

-- Remove duplicate in-progress attempts WITH a section (keep the first one)
DELETE FROM public.quiz_attempts a
USING public.quiz_attempts b
WHERE a.quiz_id = b.quiz_id
  AND a.student_email = b.student_email
  AND a.section_id = b.section_id
  AND a.status = 'in_progress'
  AND b.status = 'in_progress'
  AND a.started_at > b.started_at;

-- Remove duplicate in-progress attempts WITHOUT a section (keep the first one)
DELETE FROM public.quiz_attempts a
USING public.quiz_attempts b
WHERE a.quiz_id = b.quiz_id
  AND a.student_email = b.student_email
  AND a.section_id IS NULL
  AND b.section_id IS NULL
  AND a.status = 'in_progress'
  AND b.status = 'in_progress'
  AND a.started_at > b.started_at;

-- Unique indexes for attempts WITH a section_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_completed_attempt_per_student_section
ON public.quiz_attempts (quiz_id, student_email, section_id)
WHERE status = 'completed' AND section_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_inprogress_attempt_per_student_section
ON public.quiz_attempts (quiz_id, student_email, section_id)
WHERE status = 'in_progress' AND section_id IS NOT NULL;

-- Unique indexes for attempts WITHOUT a section_id (NULL section)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_completed_attempt_per_student_no_section
ON public.quiz_attempts (quiz_id, student_email)
WHERE status = 'completed' AND section_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_inprogress_attempt_per_student_no_section
ON public.quiz_attempts (quiz_id, student_email)
WHERE status = 'in_progress' AND section_id IS NULL;
