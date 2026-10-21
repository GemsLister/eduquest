-- ============================================================
-- Per-question Department Head comments
--
-- The Department Head can now comment on individual questions while
-- reviewing a quiz (same as the peer reviewer / Senior Faculty's
-- question_feedback). Stored separately so the reviewer's comments
-- are never overwritten.
-- ============================================================

ALTER TABLE public.quiz_analysis_submissions
  ADD COLUMN IF NOT EXISTS faculty_head_question_feedback JSONB;

COMMENT ON COLUMN public.quiz_analysis_submissions.faculty_head_question_feedback IS
  'Department Head comments keyed by questionId (kept separate from reviewer question_feedback).';

-- Make PostgREST pick up the new column immediately
NOTIFY pgrst, 'reload schema';
