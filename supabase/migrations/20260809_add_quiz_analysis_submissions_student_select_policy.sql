-- ============================================================
-- Allow students / authenticated users to read quiz_analysis_submissions
-- question snapshots for PUBLISHED quizzes (RLS policy).
-- 
-- Rationale: The public quiz page needs to FALLBACK to the last
-- submitted review snapshot's JSONB (questionSnapshots / analysis)
-- when the actual question rows are missing from the database.
-- This is read-only access and limited to published/open quizzes.
-- The existing instructor/admin policies remain untouched.
-- ============================================================

DO $$
BEGIN
  -- Make sure RLS is enabled (idempotent)
  ALTER TABLE public.quiz_analysis_submissions ENABLE ROW LEVEL SECURITY;
END $$;

DROP POLICY IF EXISTS "Authenticated users can read snapshot data for published quizzes" ON public.quiz_analysis_submissions;

CREATE POLICY "Authenticated users can read snapshot data for published quizzes"
ON public.quiz_analysis_submissions
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.quizzes q
    WHERE q.id = quiz_id
      AND q.is_published = TRUE
      AND (q.is_open IS NULL OR q.is_open = TRUE)
  )
);
