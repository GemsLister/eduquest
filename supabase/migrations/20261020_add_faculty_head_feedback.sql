-- ============================================================
-- Separate Department Head feedback from reviewer feedback
--
-- Previously, a Department Head "Request Revision" overwrote
-- quiz_analysis_submissions.admin_feedback, which already held the
-- peer reviewer's / Senior Faculty's feedback. The reviewer's comments
-- were lost. These columns keep the Department Head decision separate.
-- ============================================================

ALTER TABLE public.quiz_analysis_submissions
  ADD COLUMN IF NOT EXISTS faculty_head_feedback TEXT,
  ADD COLUMN IF NOT EXISTS faculty_head_reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS faculty_head_reviewed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.quiz_analysis_submissions.faculty_head_feedback IS
  'Revision instructions written by the Department Head (kept separate from reviewer admin_feedback).';
COMMENT ON COLUMN public.quiz_analysis_submissions.faculty_head_reviewed_by IS
  'Department Head who approved or returned the submission.';
COMMENT ON COLUMN public.quiz_analysis_submissions.faculty_head_reviewed_at IS
  'When the Department Head approved or returned the submission.';

CREATE INDEX IF NOT EXISTS idx_quiz_analysis_submissions_faculty_head_reviewed_by
  ON public.quiz_analysis_submissions(faculty_head_reviewed_by);

-- Make PostgREST pick up the new columns immediately
NOTIFY pgrst, 'reload schema';
