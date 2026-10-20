-- ============================================================
-- Peer review columns/policies + quiz workflow status values
--
-- 1. Brings the former supabase/phase2_migration.sql (run by hand in the
--    SQL editor) into the migrations folder so new environments get it.
-- 2. Submitters can no longer update their own review submission (they
--    could previously set it to "approved" through the API). Only the
--    assigned reviewer, Senior Faculty and Department Heads can.
-- 3. quizzes.status now accepts the workflow states the app logs
--    ("revision_requested", "forwarded_to_head"); before this, those
--    log_quiz_status_change calls failed silently.
-- ============================================================

-- 1. Peer review / GAD / AI tracking columns
ALTER TABLE public.quiz_analysis_submissions
  ADD COLUMN IF NOT EXISTS assigned_reviewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_quiz_analysis_submissions_reviewer
  ON public.quiz_analysis_submissions(assigned_reviewer_id);

ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS is_gad BOOLEAN DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_generated BOOLEAN DEFAULT false;
ALTER TABLE public.questions ADD COLUMN IF NOT EXISTS ai_revised BOOLEAN DEFAULT false;

-- 2. Row Level Security for review submissions
DROP POLICY IF EXISTS "Instructors can view own submissions" ON public.quiz_analysis_submissions;
DROP POLICY IF EXISTS "Assigned peer reviewers can view submissions" ON public.quiz_analysis_submissions;

CREATE POLICY "Assigned peer reviewers can view submissions"
ON public.quiz_analysis_submissions
FOR SELECT
TO authenticated
USING (
    auth.uid() = instructor_id
    OR auth.uid() = assigned_reviewer_id
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_faculty_head = true)
    )
);

DROP POLICY IF EXISTS "Admins can update submissions" ON public.quiz_analysis_submissions;
DROP POLICY IF EXISTS "Assigned peer reviewers can update submissions" ON public.quiz_analysis_submissions;

CREATE POLICY "Assigned peer reviewers can update submissions"
ON public.quiz_analysis_submissions
FOR UPDATE
TO authenticated
USING (
    (auth.uid() = assigned_reviewer_id AND auth.uid() <> instructor_id)
    OR EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND (profiles.is_admin = true OR profiles.is_faculty_head = true)
    )
);

-- 3. Quiz workflow status values
ALTER TABLE public.quizzes DROP CONSTRAINT IF EXISTS quizzes_status_check;
ALTER TABLE public.quizzes ADD CONSTRAINT quizzes_status_check CHECK (status IN (
  'draft',
  'submitted_for_review',
  'forwarded_to_head',
  'revision_requested',
  'approved',
  'rejected',
  'scheduled',
  'published',
  'ongoing',
  'completed',
  'archived'
));

-- Make PostgREST pick up the changes immediately
NOTIFY pgrst, 'reload schema';
