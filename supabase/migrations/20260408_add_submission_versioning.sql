-- Add previous_submission_id to chain submission versions together
ALTER TABLE quiz_analysis_submissions
  ADD COLUMN IF NOT EXISTS previous_submission_id UUID REFERENCES quiz_analysis_submissions(id);
