-- Add is_faculty_head column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_faculty_head BOOLEAN DEFAULT FALSE;

-- Update the status CHECK constraint on quiz_analysis_submissions to include faculty_head_review and faculty_head_approved
ALTER TABLE quiz_analysis_submissions DROP CONSTRAINT IF EXISTS quiz_analysis_submissions_status_check;
ALTER TABLE quiz_analysis_submissions ADD CONSTRAINT quiz_analysis_submissions_status_check
    CHECK (status IN ('pending', 'approved', 'revision_requested', 'rejected', 'faculty_head_review', 'faculty_head_approved'));

-- Add faculty_head columns to quiz_analysis_submissions
ALTER TABLE quiz_analysis_submissions ADD COLUMN IF NOT EXISTS faculty_head_approved_by UUID REFERENCES auth.users(id);
ALTER TABLE quiz_analysis_submissions ADD COLUMN IF NOT EXISTS faculty_head_approved_at TIMESTAMPTZ;

-- RLS: Faculty heads can view quizzes (needed for joins)
DROP POLICY IF EXISTS "Faculty heads can view all quizzes" ON public.quizzes;
CREATE POLICY "Faculty heads can view all quizzes"
ON public.quizzes
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_faculty_head = true
    )
);

-- RLS: Faculty heads can view all submissions that are approved or in faculty_head_review
DROP POLICY IF EXISTS "Faculty heads can view submissions" ON quiz_analysis_submissions;
CREATE POLICY "Faculty heads can view submissions"
ON quiz_analysis_submissions
FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_faculty_head = true
    )
);

-- RLS: Faculty heads can update submissions (for approval)
DROP POLICY IF EXISTS "Faculty heads can update submissions" ON quiz_analysis_submissions;
CREATE POLICY "Faculty heads can update submissions"
ON quiz_analysis_submissions
FOR UPDATE
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_faculty_head = true
    )
)
WITH CHECK (
    EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
        AND profiles.is_faculty_head = true
    )
);
